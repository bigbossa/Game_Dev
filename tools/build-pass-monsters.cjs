// Pack authored alpha silhouettes, not fixed crops through uneven generated gutters.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const L = require('./img-lib');
const root = path.join(__dirname, '..');
const source = path.join(root, 'monster-art/pass-v2');
const output = path.join(root, 'public/assets/monsters');
const spec = require('../monster-art/pass-v2/SPRITES.json');

function extract(file) {
  const p = L.readPng(file), { width: w, height: h, data } = p;
  const seen = new Uint8Array(w * h), parts = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 24) continue;
    const pixels = [start]; seen[start] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let n = 0; n < pixels.length; n++) {
      const i = pixels[n], x = i % w, y = Math.floor(i / w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, j = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && !seen[j] && data[j * 4 + 3] >= 24) {
          seen[j] = 1; pixels.push(j);
        }
      }
    }
    if (pixels.length < 1000) continue; // omit isolated alpha dust
    const col = Math.floor((x0 + x1) / 2 / w * 8), row = Math.floor((y0 + y1) / 2 / h * 4);
    assert(x0 > 0 && y0 > 0 && x1 < w - 1 && y1 < h - 1, `${file}: clipped pose ${row}/${col}`);
    const iw = x1 - x0 + 1, ih = y1 - y0 + 1, d = new Uint8ClampedArray(iw * ih * 4);
    for (const i of pixels) d.set(data.subarray(i * 4, i * 4 + 4), ((Math.floor(i / w) - y0) * iw + i % w - x0) * 4);
    parts.push({ row, col, x0, y0, x1, y1, img: { w: iw, h: ih, d } });
  }
  const groups = new Map();
  for (const part of parts) {
    const key = `${part.row}/${part.col}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
  }
  assert.equal(groups.size, 32, `${file}: overlapping or missing cells (${groups.size}/32)`);
  // Leaves and the dew pearl can be separate islands. Preserve their relative
  // placement with the body instead of treating every alpha island as a pose.
  return [...groups.values()].map(group => {
    const x0 = Math.min(...group.map(p => p.x0)), y0 = Math.min(...group.map(p => p.y0));
    const iw = Math.max(...group.map(p => p.x1)) - x0 + 1, ih = Math.max(...group.map(p => p.y1)) - y0 + 1;
    assert(iw < w / 8 * 1.35 && ih < h / 4 * 1.2, `${file}: merged neighboring poses`);
    const d = new Uint8ClampedArray(iw * ih * 4);
    for (const p of group) L.blit(d, iw, ih, p.img, p.x0 - x0, p.y0 - y0);
    return { row: group[0].row, col: group[0].col, img: { w: iw, h: ih, d } };
  });
}

// Validate every source before replacing any runtime assets.
const sheets = spec.species.map(s => ({ ...s, cells: extract(path.join(source, `${s.id}-source.png`)) }));
fs.mkdirSync(output, { recursive: true });
const indexPath = path.join(output, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
for (const { id, cells } of sheets) {
  const contentHeight = 176, pad = 8;
  // All states of a direction share the idle scale: attacks retain their silhouette.
  for (let col = 0; col < 8; col++) {
    const poses = cells.filter(c => c.col === col);
    const scale = contentHeight / poses.find(c => c.row === 1).img.h;
    for (const c of poses) c.img = L.scaleImg(c.img, scale);
  }
  const fw = Math.max(...cells.map(c => c.img.w)) + pad * 2;
  const fh = Math.max(...cells.map(c => c.img.h)) + pad * 2;
  const rgba = new Uint8ClampedArray(fw * 8 * fh * 4 * 4);
  for (const c of cells) L.blit(rgba, fw * 8, fh * 4, c.img,
    c.col * fw + Math.round((fw - c.img.w) / 2), c.row * fh + fh - pad - c.img.h);
  const file = `${id}-v2.png`, version = crypto.createHash('sha256').update(rgba).digest('hex').slice(0, 12);
  L.writePng(path.join(output, file), fw * 8, fh * 4, rgba);
  // Omitting height preserves MON_ART height * species size from the existing game.
  index[id] = { file, version, fw, fh, cols: 8, rows: 4, ax: fw / 2, ay: fh - pad,
    contentHeight, idleRow: 1, walkRows: [0, 1, 2, 1], attackRow: 3, managedBy: 'build-pass-monsters' };
  console.log(`${id}: 32 poses, ${fw}x${fh} cells, ${version}`);
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
