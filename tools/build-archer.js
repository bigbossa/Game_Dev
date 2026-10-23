// Slice the นักธนู (archer) AI sheets in modelนักธนู/ into game sprite sheets for both factions.
//   model <ชื่อ>.png   the twin blades' model.png template: 8-direction turnaround + walk cycle (8 dirs x 3 frames)
//   attack<ชื่อ>.png   "Attack Cycle": 4 x 2 panels (Front, Front-Right, Right, Back-Right / Back, Back-Left, Left,
//                      Front-Left), each with 3 frames side by side that overlap a little (nock, full draw, release)
// The faction comes from the file name (อธรรม = adharma, else ธรรมะ), checked against the outfit colours.
// Output (public/assets): archer-<faction>.png (walk 3 frames + standing row), archer-<faction>-attack.png,
//   archer-<faction>-portrait.png and archer.json (frame meta, same shape as taoist.json)
// ARCHER_PREVIEW=<dir> also writes the cut attack frames there for checking.
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { removeBg, blit, writePng, scaleImg } = L;
const { factionOf, trim, byDirs, median, bladeBodyH, pack, weaponPts, prep, cutModelSheet } = require('./sheet-cut');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'modelนักธนู');
const OUT = path.join(ROOT, 'public', 'assets');
const PREVIEW = process.env.ARCHER_PREVIEW;

const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
const read = (f) => L.readPng(path.join(SRC, f));
const factionOfFile = (f, src) => {
  const byName = f.includes('อธรรม') ? 'adharma' : f.includes('ธรรม') ? 'dharma' : null;
  return byName || factionOf(src, 0, 0, src.width, src.height);
};
// paper caught between the bow string, arm and body counts as paper (loosePockets); อธรรม: off-white pockets too
// (not for ธรรมะ: its near-white back cape would get holes)
const bgFor = (faction) => (faction === 'adharma' ? { pureMin: 243, loosePockets: true } : { loosePockets: true });
// optional per-direction column order, like modelนักพรต/directions.json
const DIRS_FILE = path.join(SRC, 'directions.json');
const DIRS = fs.existsSync(DIRS_FILE) ? JSON.parse(fs.readFileSync(DIRS_FILE, 'utf8')) : {};

// ---------------------------------------------------------------- attack panels
// panel content boxes of the 1448 x 1086 template (inside the tinted frames, above the 1 / 2 / 3 labels)
const P_COLS = [[14, 358], [370, 716], [729, 1076], [1088, 1436]], P_ROWS = [[130, 470], [606, 928]];
// the three figures stand about here across a panel (fractions of its width): 1 left, 2 middle, 3 lower right
const FIG_X = [0.2, 0.52, 0.83];
// the AI draws the left-facing panels (Back-Left, Left, Front-Left) with the figures out of place, so by default
// those directions are the right-facing ones mirrored (directions.json "attack-<faction>" can change it)
const ATTACK_DIRS = ['0', '1', '2', '3', '4', 'm3', 'm2', 'm1'];

// connected blobs of an alpha image: { lab, comps: [{ n, x0, x1, y0, y1 }] }
function blobs(img) {
  const { w, h, d } = img, lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let k0 = 0; k0 < w * h; k0++) {
    if (lab[k0] >= 0 || d[k0 * 4 + 3] <= 20) continue;
    const id = comps.length, list = [k0];
    lab[k0] = id;
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let n = 0; n < list.length; n++) {
      const k = list[n], x = k % w, y = (k / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (lab[nk] < 0 && d[nk * 4 + 3] > 20) { lab[nk] = id; list.push(nk); }
      }
    }
    comps.push({ n: list.length, x0, x1, y0, y1 });
  }
  return { lab, comps };
}
// a top-to-bottom cut between two figures that crosses as little drawing as possible (seam carving):
// x per row, kept between lo and hi, moving at most 2 px per row; dark line art costs more than glow
function seam(img, lo, hi) {
  const { w, h, d } = img, W = hi - lo + 1;
  const cost = (x, y) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] <= 20) return 0;
    const l = (d[i] + d[i + 1] + d[i + 2]) / 765;
    return 1 + (1 - l) * 2;
  };
  const acc = new Float32Array(W * h), from = new Int8Array(W * h);
  for (let x = 0; x < W; x++) acc[x] = cost(lo + x, 0);
  for (let y = 1; y < h; y++) for (let x = 0; x < W; x++) {
    let best = Infinity, bk = 0;
    for (let k = -2; k <= 2; k++) {
      const px = x + k;
      if (px < 0 || px >= W) continue;
      const v = acc[(y - 1) * W + px] + Math.abs(k) * 0.05;
      if (v < best) { best = v; bk = k; }
    }
    acc[y * W + x] = best + cost(lo + x, y);
    from[y * W + x] = bk;
  }
  let x = 0;
  for (let k = 1; k < W; k++) if (acc[(h - 1) * W + k] < acc[(h - 1) * W + x]) x = k;
  const path = new Int32Array(h);
  for (let y = h - 1; y >= 0; y--) { path[y] = lo + x; x += from[y * W + x]; }
  return path;
}
// the soft grey ground shadow round the feet (lowest 15% of the body): light, colourless pixels reached from
// the transparent background
function dropShadow(img, body) {
  const { w, h, d } = img, y0 = Math.floor(body.y1 - (body.y1 - body.y0) * 0.15);
  const isShadow = (k) => {
    const i = k * 4, mn = Math.min(d[i], d[i + 1], d[i + 2]), mx = Math.max(d[i], d[i + 1], d[i + 2]);
    return d[i + 3] > 20 && mn > 170 && mx - mn < 30;
  };
  const stack = [];
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (d[k * 4 + 3] > 20) continue;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
      if (nx >= 0 && ny >= y0 && nx < w && ny < h && isShadow(ny * w + nx)) { d[(ny * w + nx) * 4 + 3] = 0; stack.push(ny * w + nx); }
  }
  while (stack.length) {
    const k = stack.pop(), x = k % w, y = (k / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
      if (nx >= 0 && ny >= y0 && nx < w && ny < h && isShadow(ny * w + nx)) { d[(ny * w + nx) * 4 + 3] = 0; stack.push(ny * w + nx); }
  }
}
// the three figures of one panel: split by two seams, then each keeps its body (biggest blob) and the bits
// that do not lean on a seam (bow tips, arrow, leaf / energy streaks)
function panelFrames(src, box, bg) {
  const img = removeBg(L.crop(src, box[0], box[1], box[2], box[3]), { shadowFrom: null, ...bg });
  const { w, h, d } = img;
  const cx = FIG_X.map((f) => Math.round(f * w));
  const s1 = seam(img, cx[0] + 18, cx[1] - 18), s2 = seam(img, cx[1] + 12, cx[2] - 12);
  return [0, 1, 2].map((k) => {
    const o = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) {
      const a = k === 0 ? 0 : k === 1 ? s1[y] : s2[y], b = k === 0 ? s1[y] : k === 1 ? s2[y] : w;
      for (let x = a; x < b; x++) { const i = (y * w + x) * 4; o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3]; }
    }
    const part = { w, h, d: o }, { lab, comps } = blobs(part);
    if (!comps.length) return { img: part, body: 1 };
    const big = comps.reduce((p, q) => (q.n > p.n ? q : p));
    const nearSeam = (c) => (k > 0 && c.x0 <= Math.max(...(k === 1 ? s1 : s2).slice(c.y0, c.y1 + 1)) + 2) ||
      (k < 2 && c.x1 >= Math.min(...(k === 0 ? s1 : s2).slice(c.y0, c.y1 + 1)) - 2);
    // the neighbouring frame's raised bow / shot streaks: loose pieces that end in the top 30% of the body
    // (or start below the feet)
    const loose = (c) => (c.y1 < big.y0 + (big.y1 - big.y0) * 0.3 && c.n < big.n * 0.25) || c.y0 > big.y1 - 4;
    const keep = comps.map((c) => c === big || (c.n > big.n * 0.002 && !(nearSeam(c) && c.n < big.n * 0.15) && !loose(c)));
    for (let p = 0; p < w * h; p++) if (lab[p] >= 0 && !keep[lab[p]]) o[p * 4 + 3] = 0;
    dropShadow(part, big);
    return { img: trim(part), body: big.y1 - big.y0 + 1 };
  });
}

// ---------------------------------------------------------------- build
const TARGET_H = bladeBodyH();
console.log('twin-blade body height', TARGET_H);
const meta = { walk: {}, attack: {} };

for (const f of files.filter((n) => /^model/i.test(n))) {
  const src = read(f), faction = factionOfFile(f, src);
  const { frames, turn } = cutModelSheet(src, bgFor(faction), DIRS.model, TARGET_H);
  const P = pack(frames, 4);
  writePng(path.join(OUT, `archer-${faction}.png`), P.SW, P.SH, P.sheet);
  meta.walk[faction] = { ...P.meta, weaponPts: weaponPts(frames, TARGET_H) };
  let face = turn[0];
  if (face.h > 360) face = trim(scaleImg(face, 360 / face.h));
  writePng(path.join(OUT, `archer-${faction}-portrait.png`), face.w, face.h, face.d);
  console.log(f, '->', faction, 'walk + turnaround', P.meta.frameWidth, 'x', P.meta.frameHeight);
}

for (const f of files.filter((n) => /^attack/i.test(n))) {
  const src = read(f), faction = factionOfFile(f, src);
  const kx = src.width / 1448, ky = src.height / 1086;
  const cut = [];                                 // cut[dir] = [frame1, frame2, frame3]
  for (const [y0, y1] of P_ROWS) for (const [x0, x1] of P_COLS)
    cut.push(panelFrames(src, [Math.round(x0 * kx), Math.round(y0 * ky), Math.round(x1 * kx), Math.round(y1 * ky)], bgFor(faction)));
  // one scale for the sheet, from the bodies of the upright first frames
  const s = TARGET_H / median(cut.map((p) => p[0].body));
  // "attack-frames-<faction>": { "<panel>": [frame for row 0, row 1, row 2] } swaps in a cleaner frame of the same panel
  const fix = DIRS[`attack-frames-${faction}`] || {};
  const pickF = (p, i, r) => p[(fix[i] || [0, 1, 2])[r]];
  const frames = [0, 1, 2].map((r) => byDirs(cut.map((p, i) => prep(pickF(p, i, r).img, s)), DIRS[`attack-${faction}`] || ATTACK_DIRS));
  const P = pack(frames, 3);
  meta.attack[faction] = { ...P.meta, weaponPts: weaponPts(frames, TARGET_H) };
  writePng(path.join(OUT, `archer-${faction}-attack.png`), P.SW, P.SH, P.sheet);
  if (PREVIEW) {
    fs.mkdirSync(PREVIEW, { recursive: true });
    writePng(path.join(PREVIEW, `archer-${faction}-attack.png`), P.SW, P.SH, P.sheet);
  }
  console.log(f, '->', faction, 'attack', P.meta.frameWidth, 'x', P.meta.frameHeight);
}

if (!meta.walk.dharma || !meta.walk.adharma) throw new Error('ต้องมีไฟล์ model ของทั้งสองฝ่ายใน modelนักธนู/');
fs.writeFileSync(path.join(OUT, 'archer.json'), JSON.stringify(meta));
console.log('done');
