// Cache crisp, isolated frames. Transparent gutters prevent neighbouring poses
// from bleeding into one another while the camera moves at fractional pixels.
(function () {
  const cache = new WeakMap(), PAD = 2;
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  function build(img, cw, ch, fw, fh) {
    const cols = Math.round(img.width / fw), rows = Math.round(img.height / fh);
    const pitchX = cw + PAD * 2, pitchY = ch + PAD * 2;
    const out = canvas(cols * pitchX, rows * pitchY);
    return { img: out, cw, ch, pitchX, pitchY, pad: PAD, k: cw / fw, cols, rows, ready: new Set() };
  }
  function paintFrame(atlas, img, fw, fh, col, row) {
    const key = row * atlas.cols + col;
    if (atlas.ready.has(key)) return;
    const { cw, ch, pitchX, pitchY } = atlas;
    const frame = canvas(pitchX, pitchY), g = frame.getContext('2d');
    const cell = canvas(fw, fh), cg = cell.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    cg.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
    let source = cell;
    // Reduce individual cells so resampling never picks up an adjacent direction.
    while (source.width / 2 >= cw * 1.4 && source.height / 2 >= ch * 1.4) {
      const next = canvas(Math.ceil(source.width / 2), Math.ceil(source.height / 2));
      const ng = next.getContext('2d'); ng.imageSmoothingQuality = 'high';
      ng.drawImage(source, 0, 0, next.width, next.height); source = next;
    }
    g.drawImage(source, 0, 0, source.width, source.height, PAD, PAD, cw, ch);
    // Do not read pixels back from the GPU during a walk/turn. Isolated cells and
    // high-quality downsampling preserve clean edges without synchronous sharpening.
    atlas.img.getContext('2d').drawImage(frame, col * pitchX, row * pitchY);
    atlas.ready.add(key);
  }
  function sheet(img, scale, fw, fh, zooming = false, col, row) {
    const q = Math.max(.08, Math.min(1, scale));
    const cw = Math.max(1, Math.round(fw * q)), ch = Math.max(1, Math.round(fh * q));
    const key = `${fw}:${fh}:${cw}:${ch}`;
    let sizes = cache.get(img);
    if (!sizes) { sizes = new Map(); cache.set(img, sizes); }
    let result = sizes.get(key);
    if (!result && zooming && sizes.size) {
      let nearest = Infinity;
      for (const [saved, value] of sizes) {
        if (!saved.startsWith(`${fw}:${fh}:`)) continue;
        const distance = Math.abs(value.cw - cw) + Math.abs(value.ch - ch);
        if (distance < nearest) { nearest = distance; result = value; }
      }
    }
    if (!result) {
      result = build(img, cw, ch, fw, fh); sizes.set(key, result);
      if (sizes.size > 6) sizes.delete(sizes.keys().next().value);
    }
    // The game requests only the visible pose; other poses are prepared on demand.
    // Full-atlas callers (exporters and checks) can omit the cell coordinates.
    if (col !== undefined && row !== undefined) paintFrame(result, img, fw, fh, col, row);
    else for (let y = 0; y < result.rows; y++) for (let x = 0; x < result.cols; x++)
      paintFrame(result, img, fw, fh, x, y);
    return result;
  }
  window.SpriteDetail = { sheet };
})();
