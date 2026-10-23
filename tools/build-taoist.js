// Slice the นักพรต (Taoist) AI sheets in modelนักพรต/ into game sprite sheets for both factions.
// The faction of every sheet is told apart by its colours (red/black = อธรรม), so file names don't matter.
//   *walk*.png  ธรรมะ on the left half, อธรรม on the right; 7 columns (S SE E NE N W SW) x 4 rows
//               (idle + 3 walk frames). NW is the mirrored NE pose.
//   *cast*.png  one faction per file, 8 columns (S SE E NE N NW W SW) x 3 rows (hand seal, whisk up, palm push)
//   *weapons*.png  10 fly-whisks (5 x 2), white/blue = ธรรมะ, red = อธรรม (item icons)
// Output (public/assets): taoist-<faction>.png (walk 8 dirs x 3 frames), taoist-<faction>-attack.png (cast poses),
//   taoist-<faction>-portrait.png, items/taoist-w1..w10[-a].png and taoist.json (frame meta)
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { removeBg, bbox, blit, writePng, scaleImg } = L;

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'modelนักพรต');
const OUT = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(path.join(OUT, 'items'), { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
const pick = (word) => files.filter((f) => f.toLowerCase().includes(word));
const read = (f) => L.readPng(path.join(SRC, f));

const { factionOf, grid, cutCell, trim, mirror, byDirs, median, bladeBodyH, pack, weaponPts, prep, cutModelSheet } = require('./sheet-cut');

// dark อธรรม outfits: paper pockets between hair strands are off-white, and their glow is pink
const bgFor = (faction, glow) => (faction === 'adharma'
  ? { pureMin: 243, loosePockets: true, glow: glow ? 'red' : false }
  : { glow: glow ? true : false });
// which drawn column (or its mirror, "m3") is used for each direction S SE E NE N NW W SW — the AI does not
// always draw the columns in the asked order, so this lives in modelนักพรต/directions.json
const DIRS_FILE = path.join(SRC, 'directions.json');
const DIRS = fs.existsSync(DIRS_FILE) ? JSON.parse(fs.readFileSync(DIRS_FILE, 'utf8')) : {};
// ---------------------------------------------------------------- armour masks + weapon points
// Same channels as tools/armor-masks.js (the twin blades): R = shirt (robe, value = recolour strength), G = trousers,
// B = arms (the นักพรต's wide sleeves); the second mask (shoulders) stays empty: pauldrons are drawn on the neck anchors.
// Skin, hair, gold, the talismans, the gourd and anything warm stay as drawn. The head (top 40%) is never recoloured.
function taoMasks(P, faction, out) {
  const { sheet: d, SW: W, SH: H, meta } = P, fw = meta.frameWidth, fh = meta.frameHeight;
  const mask = new Uint8ClampedArray(W * H * 4), mask2 = new Uint8ClampedArray(W * H * 4);
  const adh = faction === 'adharma';
  const skin = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) { const i = k * 4; if (d[i + 3] && d[i] > 170 && d[i + 2] > 125 && d[i] > d[i + 2] + 24 && d[i + 1] > d[i + 2]) skin[k] = 1; }
  const nearSkin = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (skin[y * W + x])
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) nearSkin[ny * W + nx] = 1; }
  const rows = Math.round(H / fh);
  for (let r = 0; r < rows; r++) for (let c = 0; c < 8; c++) {
    const X = c * fw, Y = r * fh;
    let y0 = 1e9, y1 = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[((Y + y) * W + X + x) * 4 + 3] > 60) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (y1 < 0) continue;
    const BH = y1 - y0, mid = meta.anchorX, half = Math.max(10, BH * 0.2);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < fw; x++) {
      const k = (Y + y) * W + X + x, i = k * 4;
      if (d[i + 3] < 40 || nearSkin[k]) continue;
      const yr = (y - y0) / BH, rel = Math.abs(x - mid) / half;
      if (yr < 0.4) continue;
      const R0 = d[i], G0 = d[i + 1], B0 = d[i + 2];
      const [h, sat, l] = L.rgb2hsl(R0, G0, B0);
      const chroma = (Math.max(R0, G0, B0) - Math.min(R0, G0, B0)) / 255;
      const red = (h >= 335 || h <= 12) && sat > 0.35 && chroma > 0.18;
      const warm = R0 > B0 + 24 && !red;                     // skin, hair, gold, talismans, gourd, boots
      const blue = h >= 185 && h <= 255 && chroma > 0.1;
      const accent = adh ? red : blue;
      if (warm || (!accent && chroma > 0.25)) continue;     // purple sash, yellow paper ...
      // อธรรม back views: the long black hair (with its red streaks) hangs over the robe, leave it alone
      if (adh && c >= 3 && c <= 5 && rel < 1.05 && yr < 0.78) continue;
      const dark = l < (adh ? 0.3 : 0.32), light = l > 0.6 && chroma < 0.2;
      let R = 0, G = 0, B = 0;
      if (yr < 0.8 && rel > 0.95) B = accent ? 255 : light || dark ? 200 : 0;                   // wide sleeves
      else if (yr >= 0.8 && (adh ? dark && rel < 1.1 : dark && blue)) G = 255;                  // trousers
      else if (!adh && yr >= 0.62 && dark && blue) G = 230;                                     // navy trousers higher up
      else if (accent) R = 255;                                                                 // trims, collar, cuffs
      else if (light) R = 90;                                                                   // white robe: light touch
      else if (dark) R = adh ? 90 : 150;                                                        // black robe / navy sash
      if (R || G || B) { mask[i] = R; mask[i + 1] = G; mask[i + 2] = B; mask[i + 3] = 255; }
    }
  }
  writePng(path.join(OUT, `armor-${out}.png`), W, H, mask);
  writePng(path.join(OUT, `armor2-${out}.png`), W, H, mask2);
}

// ---------------------------------------------------------------- design sheets (front / side / back)
// taoist-<faction>-design.png: three full-body views on the left, a face close-up and the weapon on the right.
// The body views are the three tallest blobs; every smaller blob that sits under one of them belongs to it.
function designViews(src, faction) {
  const img = removeBg(L.crop(src, 0, 0, src.width, src.height), { shadowFrom: null, ...bgFor(faction, false) });
  const { w, h, d } = img;
  const lab = new Int32Array(w * h).fill(-1), comps = [];
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
    comps.push({ id, n: list.length, x0, x1, y0, y1 });
  }
  const bodies = comps.filter((c) => c.y1 - c.y0 > h * 0.6 && c.n > 4000).sort((a, b) => b.n - a.n).slice(0, 3).sort((a, b) => a.x0 - b.x0);
  if (bodies.length < 3) throw new Error('แผ่นออกแบบต้องมีภาพเต็มตัว 3 ท่า (หน้า ข้าง หลัง)');
  const owner = new Int32Array(comps.length).fill(-1);
  bodies.forEach((b, i) => { owner[b.id] = i; });
  for (const c of comps) {
    if (owner[c.id] >= 0 || c.n < 30) continue;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const i = bodies.findIndex((b) => cx >= b.x0 - 10 && cx <= b.x1 + 10 && cy >= b.y0 - 10 && cy <= b.y1 + 10);
    if (i >= 0) owner[c.id] = i;
  }
  return bodies.map((b, i) => {
    const X0 = Math.min(...comps.filter((c) => owner[c.id] === i).map((c) => c.x0)), X1 = Math.max(...comps.filter((c) => owner[c.id] === i).map((c) => c.x1));
    const Y0 = Math.min(...comps.filter((c) => owner[c.id] === i).map((c) => c.y0)), Y1 = Math.max(...comps.filter((c) => owner[c.id] === i).map((c) => c.y1));
    const ow = X1 - X0 + 1, oh = Y1 - Y0 + 1, o = new Uint8ClampedArray(ow * oh * 4);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const k = y * w + x;
      if (lab[k] < 0 || owner[lab[k]] !== i) continue;
      const a = k * 4, q = ((y - Y0) * ow + (x - X0)) * 4;
      o[q] = d[a]; o[q + 1] = d[a + 1]; o[q + 2] = d[a + 2]; o[q + 3] = d[a + 3];
    }
    return { w: ow, h: oh, d: o };
  });
}
const designs = {};
for (const f of pick('design')) {
  const src = read(f), faction = factionOf(src, 0, 0, src.width, src.height);
  designs[faction] = designViews(src, faction);
  if (process.env.DESIGN_PREVIEW_DIR)
    designs[faction].forEach((v, i) => writePng(path.join(process.env.DESIGN_PREVIEW_DIR, `${faction}-view${i}.png`), v.w, v.h, v.d));
  console.log(f, '->', faction, 'design views', designs[faction].map((v) => `${v.w}x${v.h}`).join(' '));
}

// ---------------------------------------------------------------- walk
const TARGET_H = bladeBodyH();
console.log('twin-blade body height', TARGET_H);
const meta = { walk: {}, attack: {} };   // per faction: each sheet has its own cell size
const done = new Set();
// ---- "model <faction>.png": the same template as the twin blades' model.png — a turnaround of 8 directions
// on top, then the walk cycle (8 directions x 3 frames) in labelled cells. Column order (directions.json "model"):
// Front, Front-Right, Right, Back-Right, Back, Back-Left, Left, Front-Left = S SE E NE N NW W SW.
for (const f of files.filter((n) => /^model[\s_-]/i.test(n))) {
  const src = read(f), faction = factionOf(src, 0, 0, src.width, src.height);
  const { frames, turn } = cutModelSheet(src, bgFor(faction, false), DIRS.model, TARGET_H);
  const P = pack(frames, 4);
  writePng(path.join(OUT, `taoist-${faction}.png`), P.SW, P.SH, P.sheet);
  meta.walk[faction] = { ...P.meta, weaponPts: weaponPts(frames, TARGET_H) };
  taoMasks(P, faction, `tao-walk-${faction}`);
  // portrait: the turnaround's front view, 360 px tall
  let face = turn[0];
  if (face.h > 360) face = trim(scaleImg(face, 360 / face.h));
  writePng(path.join(OUT, `taoist-${faction}-portrait.png`), face.w, face.h, face.d);
  done.add(faction);
  console.log(f, '->', faction, 'walk + turnaround', P.meta.frameWidth, 'x', P.meta.frameHeight);
}

// ---- older sources (only for a faction without its model file): the 7-column walk sheet + the design sheet
const walkFile = pick('walk')[0];
if (!walkFile && done.size < 2) throw new Error('ไม่พบไฟล์ท่าเดิน (model <ฝ่าย>.png หรือ *walk*.png) ใน modelนักพรต/');
if (walkFile && done.size < 2) {
  const src = read(walkFile), half = Math.floor(src.width / 2);
  for (const R of [{ x0: 0, y0: 0, x1: half, y1: src.height }, { x0: half, y0: 0, x1: src.width, y1: src.height }]) {
    const faction = factionOf(src, R.x0, R.y0, R.x1, R.y1);
    if (done.has(faction)) continue;
    const cells = grid(src, R, 4, 7);
    const cut = cells.map((c) => ({ ...c, img: trim(cutCell(src, c, bgFor(faction, false))) }));
    // walk rows 1..3 become frames 0..2; each row is scaled on its own (the AI drew the last row smaller)
    const frames = [];
    for (let r = 1; r <= 3; r++) {
      const row = cut.filter((c) => c.r === r).sort((a, b) => a.c - b.c);
      const s = TARGET_H / median(row.map((c) => c.img.h));
      const by = row.map((c) => prep(c.img, s));
      // 7 drawn views -> 8 directions (directions.json "walk"; default: S SE E NE N, NW = mirrored NE, W SW)
      frames.push(byDirs(by, DIRS.walk || ['0', '1', '2', '3', '4', 'm3', '5', '6']));
    }
    // row 3 = standing still, from the design sheet (front / side / back; side faces right, W = mirrored)
    const D = designs[faction];
    if (D) {
      const [fr, sd, bk] = D.map((v) => prep(v, TARGET_H / v.h));
      const sw = { img: mirror(sd.img), fx: sd.img.w - sd.fx };
      frames.push([fr, fr, sd, bk, bk, bk, sw, fr]);
    }
    const P = pack(frames, frames.length);
    writePng(path.join(OUT, `taoist-${faction}.png`), P.SW, P.SH, P.sheet);
    meta.walk[faction] = { ...P.meta, weaponPts: weaponPts(frames, TARGET_H) };
    taoMasks(P, faction, `tao-walk-${faction}`);
    // portrait: the design sheet's front view (sharp, 360 px tall), else the walk sheet's idle front pose
    let idle = D ? D[0] : cut.find((c) => c.r === 0 && c.c === 0).img;
    if (idle.h > 360) idle = trim(scaleImg(idle, 360 / idle.h));
    writePng(path.join(OUT, `taoist-${faction}-portrait.png`), idle.w, idle.h, idle.d);
    console.log(walkFile, faction, 'walk', P.meta.frameWidth, 'x', P.meta.frameHeight);
  }
}

// ---------------------------------------------------------------- cast (attack / skill poses)
// a sheet named after both factions holds both (side-view combo strips): not in the 8-direction layout, skipped
for (const f of pick('cast').filter((n) => !(n.includes('taoist-dharma-cast') && n.includes('taoist-adharma-cast')))) {
  const src = read(f);
  const faction = factionOf(src, 0, 0, src.width, src.height);
  const cells = grid(src, { x0: 0, y0: 0, x1: src.width, y1: src.height }, 3, 8);
  const cut = cells.map((c) => ({ ...c, img: trim(cutCell(src, c, bgFor(faction, true))) }));
  // one scale for the sheet, taken from the upright hand-seal row, so the raised whisk stays above the head
  const s = TARGET_H / median(cut.filter((c) => c.r === 0).map((c) => c.img.h));
  const frames = [0, 1, 2].map((r) => byDirs(cut.filter((c) => c.r === r).sort((a, b) => a.c - b.c).map((c) => prep(c.img, s)), DIRS[`cast-${faction}`]));
  const P = pack(frames, 3);
  meta.attack[faction] = { ...P.meta, weaponPts: weaponPts(frames, TARGET_H) };
  writePng(path.join(OUT, `taoist-${faction}-attack.png`), P.SW, P.SH, P.sheet);
  taoMasks(P, faction, `tao-attack-${faction}`);
  console.log(f, '->', faction, 'cast', P.meta.frameWidth, 'x', P.meta.frameHeight, f.includes(faction) ? '' : '(ชื่อไฟล์ไม่ตรงกับสีชุด — ใช้ตามสีชุด)');
}

// ---------------------------------------------------------------- weapon icons
for (const f of pick('weapon')) {
  const src = read(f);
  const faction = factionOf(src, 0, 0, src.width, src.height);
  const cells = grid(src, { x0: 0, y0: 0, x1: src.width, y1: src.height }, 2, 5);
  cells.sort((a, b) => a.r - b.r || a.c - b.c).forEach((c, i) => {
    let img = trim(cutCell(src, c, bgFor(faction, true)));
    if (img.h > 260) img = trim(scaleImg(img, 260 / img.h));
    writePng(path.join(OUT, 'items', `taoist-w${i + 1}${faction === 'adharma' ? '-a' : ''}.png`), img.w, img.h, img.d);
  });
  console.log(f, '->', faction, 'weapon icons x', cells.length);
}

fs.writeFileSync(path.join(OUT, 'taoist.json'), JSON.stringify(meta));
console.log('done', JSON.stringify(meta));
