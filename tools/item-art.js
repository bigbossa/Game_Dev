// Shared helpers for item.png (twin-blade concept sheet): panel grid, cleanup and faction recolours.
const L = require('./img-lib');
const { crop, removeBg, bbox, blit, cloneImg, rgb2hsl, hsl2rgb } = L;

// Panel grid detected from the sheet (5 columns x 2 rows); blade area sits below the LV badge
const PX = [[5, 220], [230, 446], [454, 669], [677, 892], [901, 1117]];
const PY = [[228, 688], [782, 1362]];

// drop small disconnected bits (panel ornaments) before trimming
function dropSpecks(img, minSize = 160) {
  const { w, h, d } = img, seen = new Uint8Array(w * h);
  for (let k0 = 0; k0 < w * h; k0++) {
    if (seen[k0] || d[k0 * 4 + 3] < 20) continue;
    const comp = [k0]; seen[k0] = 1;
    for (let n = 0; n < comp.length; n++) {
      const k = comp[n], x = k % w, y = (k / w) | 0;
      for (const [dx, dy] of L.N8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (!seen[nk] && d[nk * 4 + 3] >= 20) { seen[nk] = 1; comp.push(nk); }
      }
    }
    if (comp.length < minSize) for (const k of comp) d[k * 4 + 3] = 0;
  }
  return img;
}
function trim(img) {
  const b = bbox(img);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const d = new Uint8ClampedArray(w * h * 4);
  blit(d, w, h, img, -b.x0, -b.y0);
  return { w, h, d, ox: b.x0, oy: b.y0 };
}

// blue -> crimson, violet -> magenta-red; gold, steel and dark tones untouched
function toAdharma(img) {
  const out = cloneImg(img), d = out.d;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const chroma = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255;
    if (chroma < 0.08 || h < 180 || h > 300) continue;
    const nh = h < 255 ? 356 : 332;
    const [r, g, b] = hsl2rgb(nh, Math.min(1, s * 1.05), l * (l > 0.75 ? 0.95 : 0.85));
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return out;
}
// training blades: wooden-brown grip instead of blue, dull steel
function toStarter(img) {
  const out = cloneImg(img), d = out.d;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const [r, g, b] = h > 180 && h < 300 && s > 0.2 ? hsl2rgb(28, 0.35, l * 0.8) : hsl2rgb(h, s * 0.15, l * 0.86);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return out;
}

// the cleaned (untrimmed) panel of weapon tier 1..10
function panel(src, tier) {
  const row = tier > 5 ? 1 : 0, col = (tier - 1) % 5;
  const [x0, x1] = PX[col], [y0, y1] = PY[row];
  const img = removeBg(crop(src, x0 + 8, y0, x1 - 8, y1), {
    bgMin: 205, bgChroma: 28, shadowFrom: null, loosePockets: true, pureMin: 236, glow: true,
  });
  return dropSpecks(img);
}

module.exports = { PX, PY, dropSpecks, trim, toAdharma, toStarter, panel };
