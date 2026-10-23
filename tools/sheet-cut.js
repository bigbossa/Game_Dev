// Cutting AI-drawn character sheets into game sprite sheets (shared by build-taoist.js and build-archer.js).
// Images are {w, h, d} RGBA (tools/img-lib.js); sheets read with L.readPng are {width, height, data}.
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { removeBg, bbox, blit, scaleImg } = L;

const OUT = path.join(__dirname, '..', 'public', 'assets');

const isInk = (d, i) => {
  const mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2]);
  return mn < 232 || mx - mn > 22;
};
// red/black outfit = อธรรม
function factionOf(src, x0, y0, x1, y1) {
  const W = src.width, d = src.data;
  let red = 0, ink = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * W + x) * 4;
    if (!isInk(d, i)) continue;
    ink++;
    if (d[i] > d[i + 1] + 60 && d[i] > d[i + 2] + 40) red++;
  }
  return red / Math.max(1, ink) > 0.12 ? 'adharma' : 'dharma';
}
// ink runs of a profile (gaps up to `gap` px are bridged)
function runs(arr, lo, hi, th, gap) {
  const r = [];
  let s = -1, last = -1e9;
  for (let i = lo; i < hi; i++) {
    if (arr[i] <= th) continue;
    if (s < 0) s = i;
    else if (i - last > gap) { r.push([s, last]); s = i; }
    last = i;
  }
  if (s >= 0) r.push([s, last]);
  return r;
}
// exactly n bands: split the widest band at its emptiest line, merge the smallest into its neighbour
function toBands(prof, lo, hi, n, gap) {
  let b = runs(prof, lo, hi, 1, gap);
  const smooth = (i) => (prof[i - 2] || 0) + (prof[i - 1] || 0) + prof[i] + (prof[i + 1] || 0) + (prof[i + 2] || 0);
  while (b.length > n) {
    let k = 0;
    for (let i = 1; i < b.length; i++) if (b[i][1] - b[i][0] < b[k][1] - b[k][0]) k = i;
    const j = k === 0 ? 1 : k === b.length - 1 ? k - 1 : b[k - 1][1] - b[k - 1][0] < b[k + 1][1] - b[k + 1][0] ? k - 1 : k + 1;
    const a = Math.min(j, k);
    b.splice(a, 2, [b[a][0], b[a + 1][1]]);
  }
  while (b.length < n) {
    let k = 0;
    for (let i = 1; i < b.length; i++) if (b[i][1] - b[i][0] > b[k][1] - b[k][0]) k = i;
    const [s, e] = b[k], parts = Math.min(n - b.length + 1, Math.max(2, Math.round((e - s) / ((hi - lo) / n))));
    // cut where the profile is lowest, near the even positions
    let cut = s, best = Infinity;
    const want = s + (e - s) / parts, win = (e - s) / parts * 0.3;
    for (let i = Math.round(want - win); i <= want + win; i++) { const v = smooth(i); if (v < best) { best = v; cut = i; } }
    b.splice(k, 1, [s, cut - 1], [cut + 1, e]);
  }
  return b;
}
// cells of a sheet region: rows x cols, each { r, c, x0, y0, x1, y1 }
function grid(src, R, rows, cols) {
  const W = src.width, d = src.data;
  const m = 8;
  const rowP = new Array(src.height).fill(0);
  for (let y = R.y0 + m; y < R.y1 - m; y++) for (let x = R.x0 + m; x < R.x1 - m; x++) if (isInk(d, (y * W + x) * 4)) rowP[y]++;
  const rb = toBands(rowP, R.y0 + m, R.y1 - m, rows, 6);
  const cells = [];
  rb.forEach(([y0, y1], r) => {
    const colP = new Array(W).fill(0);
    for (let y = y0; y <= y1; y++) for (let x = R.x0 + m; x < R.x1 - m; x++) if (isInk(d, (y * W + x) * 4)) colP[x]++;
    toBands(colP, R.x0 + m, R.x1 - m, cols, 3).forEach(([x0, x1], c) => cells.push({ r, c, x0, y0, x1, y1 }));
  });
  return cells;
}
// cut one cell out (a few px of margin), clear the paper, keep the character: the biggest blob plus the
// pieces that do not come from a neighbouring cell (small bits touching the left / right edge)
function cutCell(src, cell, bgOpts, pad = 6) {
  const x0 = Math.max(0, cell.x0 - pad), y0 = Math.max(0, cell.y0 - pad);
  const x1 = Math.min(src.width, cell.x1 + pad + 1), y1 = Math.min(src.height, cell.y1 + pad + 1);
  const img = removeBg(L.crop(src, x0, y0, x1, y1), { shadowFrom: null, ...bgOpts });
  const { w, h, d } = img;
  const lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let k0 = 0; k0 < w * h; k0++) {
    if (lab[k0] >= 0 || d[k0 * 4 + 3] <= 20) continue;
    const id = comps.length, list = [k0];
    lab[k0] = id;
    let edge = false, bx0 = w, bx1 = -1, by0 = h, by1 = -1;
    for (let n = 0; n < list.length; n++) {
      const k = list[n], x = k % w, y = (k / w) | 0;
      if (x <= 1 || x >= w - 2) edge = true;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (lab[nk] < 0 && d[nk * 4 + 3] > 20) { lab[nk] = id; list.push(nk); }
      }
    }
    comps.push({ n: list.length, edge, bx0, bx1, by0, by1 });
  }
  if (!comps.length) return img;
  const big = comps.reduce((a, b) => (b.n > a.n ? b : a));
  // small bits only at the very top / bottom of the cell are hair or feet of the row above / below
  const strayRow = (cp) => cp.n < big.n * 0.05 && (cp.by1 < h * 0.12 || cp.by0 > h * 0.88);
  const keep = comps.map((cp) => cp === big || (cp.n > big.n * 0.002 && !(cp.edge && cp.n < big.n * 0.2) && !strayRow(cp)));
  for (let k = 0; k < w * h; k++) if (lab[k] >= 0 && !keep[lab[k]]) d[k * 4 + 3] = 0;
  else if (lab[k] < 0) d[k * 4 + 3] = 0;
  return img;
}
function trim(img) {
  const b = bbox(img);
  if (b.x1 < 0) return img;
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, d = new Uint8ClampedArray(w * h * 4);
  blit(d, w, h, img, -b.x0, -b.y0);
  return { w, h, d };
}
function mirror(img) {
  const { w, h, d } = img, o = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
    o[b] = d[a]; o[b + 1] = d[a + 1]; o[b + 2] = d[a + 2]; o[b + 3] = d[a + 3];
  }
  return { w, h, d: o };
}
// horizontal centre of the feet (lowest 10% of the body), so a whisk held to one side does not shift it
function feetX(img) {
  const { w, h, d } = img;
  let sx = 0, n = 0;
  for (let y = Math.floor(h * 0.9); y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 80) { sx += x; n++; }
  return n ? sx / n : w / 2;
}
// which drawn column (or its mirror, "m3") is used for each direction S SE E NE N NW W SW
function byDirs(row, spec) {
  if (!spec) return row;
  return spec.map((k) => {
    const s = String(k), m = s[0] === 'm', f = row[Number(m ? s.slice(1) : s)];
    return m ? { img: mirror(f.img), fx: f.img.w - f.fx } : f;
  });
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 1; };
// the twin-blade walk body height (public/assets/dharma.png): นักพรต frames are scaled to the same size
function bladeBodyH() {
  const spr = JSON.parse(fs.readFileSync(path.join(OUT, 'sprites.json'), 'utf8'));
  const img = L.readPng(path.join(OUT, 'dharma.png'));
  const hs = [];
  for (let c = 0; c < 8; c++) {
    let y0 = 1e9, y1 = -1;
    for (let y = 0; y < spr.frameHeight; y++) for (let x = 0; x < spr.frameWidth; x++) {
      const i = ((spr.frameHeight + y) * img.width + c * spr.frameWidth + x) * 4;
      if (img.data[i + 3] > 40) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (y1 > 0) hs.push(y1 - y0);
  }
  return median(hs);
}
// frames[row][dir] (dir = 0..7 in S SE E NE N NW W SW order) -> one sheet in the game layout:
// columns follow C.DIR_COL (S SE E NE N NW W SW), rows = frames, feet on the bottom line of each cell
function pack(frames, rows) {
  let side = 0, up = 0;
  for (const row of frames) for (const f of row) { side = Math.max(side, f.fx, f.img.w - f.fx); up = Math.max(up, f.img.h); }
  const HALF = Math.ceil(side) + 2, FW = HALF * 2, FH = Math.ceil(up) + 4;
  const SW = FW * 8, SH = FH * rows, sheet = new Uint8ClampedArray(SW * SH * 4);
  frames.forEach((row, r) => row.forEach((f, dir) => {
    blit(sheet, SW, SH, f.img, dir * FW + Math.round(HALF - f.fx), r * FH + (FH - 2 - f.img.h));
  }));
  return { sheet, SW, SH, meta: { frameWidth: FW, frameHeight: FH, anchorX: HALF, anchorY: FH - 2, framesPerDir: rows } };
}
// points round the whisk (and sleeve ends) for the weapon sparks: whatever sticks out of the body, relative to the
// feet, like the twin blades' bladePts. frames[row][dir] -> [row * 8 + dir] -> [[dx, dy], ...]
function weaponPts(frames, TARGET_H) {
  const out = [];
  frames.forEach((row, r) => row.forEach((f, c) => {
    const { w, h, d } = f.img, pts = [];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] < 120) continue;
      const out1 = Math.abs(x - f.fx) > TARGET_H * 0.3 || h - y > TARGET_H * 1.04;
      if (out1 && y < h * 0.92) pts.push([x - f.fx, y - h]);
    }
    pts.sort((a, b) => a[1] - b[1]);
    const n = Math.min(10, pts.length), pick = [];
    for (let k = 0; k < n; k++) pick.push(pts[Math.floor(((k + 0.5) / n) * pts.length)]);
    out[r * 8 + c] = pick;
  }));
  return out;
}
const prep = (img, s) => { const t = trim(s < 1 ? scaleImg(trim(img), s) : trim(img)); return { img: t, fx: feetX(t) }; };

// ---- "model <faction>.png": the template of the twin blades' model.png (1448 x 1086) — a turnaround of 8
// directions on top, then the walk cycle (8 directions x 3 frames) in labelled cells. Columns: Front, Front-Right,
// Right, Back-Right, Back, Back-Left, Left, Front-Left = S SE E NE N NW W SW (reordered by `spec`).
// Returns frames[row][dir] (rows 0-2 walk, row 3 = standing still from the turnaround) and the turnaround views.
const M_COLS = [10, 185, 368, 547, 726, 903, 1081, 1261, 1440], M_ROWS = [511, 689, 869, 1060], M_TURN = [48, 372];
function cutModelSheet(src, bgOpts, spec, targetH) {
  const kx = src.width / 1448, ky = src.height / 1086;
  const box = (x0, y0, x1, y1) => ({ x0: Math.round(x0 * kx), y0: Math.round(y0 * ky), x1: Math.round(x1 * kx), y1: Math.round(y1 * ky) });
  // cells cut a little inside their tinted borders (pad -4)
  const cutBox = (b) => trim(cutCell(src, b, bgOpts, -4));
  spec = spec || ['0', '1', '2', '3', '4', '5', '6', '7'];
  const frames = [];
  for (let r = 0; r < 3; r++) {
    const row = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => cutBox(box(M_COLS[c], M_ROWS[r], M_COLS[c + 1], M_ROWS[r + 1])));
    const sc = targetH / median(row.map((im) => im.h));
    frames.push(byDirs(row.map((im) => prep(im, sc)), spec));
  }
  const turn = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => cutBox(box(M_COLS[c], M_TURN[0], M_COLS[c + 1], M_TURN[1])));
  const st = targetH / median(turn.map((im) => im.h));
  frames.push(byDirs(turn.map((im) => prep(im, st)), spec));
  return { frames, turn };
}

module.exports = { isInk, factionOf, runs, toBands, grid, cutCell, trim, mirror, feetX, byDirs, median, bladeBodyH, pack, weaponPts, prep, cutModelSheet };
