// Weapons held by the character change with the equipped item (the blades are vector art drawn by
// public/js/item-art.js). This tool prepares the sprites for that:
// 1) measures where the two blades sit in every walk/attack frame (hilt -> tip): walk poses are detected
//    from the blade layers, attack poses are hand-placed in attack-blades.json -> public/assets/weapons.json
// 2) writes "bare" character sheets (*-bare.png) with the original blades removed, so the game can draw
//    the equipped weapon in their place.
// `node tools/weapon-sprites.js --preview` also writes debug images to WEAPON_PREVIEW_DIR (default: public/assets).
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { writePng } = L;

const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'public', 'assets');
const PREVIEW = process.argv.includes('--preview');
const PDIR = process.env.WEAPON_PREVIEW_DIR || A;
const meta = {};

// ------------------------------------------------------------ 1) blade geometry per frame
const SPR = JSON.parse(fs.readFileSync(path.join(A, 'sprites.json'), 'utf8'));

// clusters of blade pixels in one frame cell (fragments within R px are merged)
function clusters(mask, W, x0, y0, fw, fh, R = 3) {
  const inCell = [];
  const idx = new Int32Array(fw * fh).fill(-1);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++)
    if (mask[((y0 + y) * W + x0 + x) * 4 + 3] > 40) { idx[y * fw + x] = inCell.length; inCell.push([x, y]); }
  const comp = new Int32Array(inCell.length).fill(-1), out = [];
  for (let s = 0; s < inCell.length; s++) {
    if (comp[s] >= 0) continue;
    const list = [s]; comp[s] = out.length;
    for (let n = 0; n < list.length; n++) {
      const [x, y] = inCell[list[n]];
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= fh) continue;
        const j = idx[ny * fw + nx];
        if (j >= 0 && comp[j] < 0) { comp[j] = out.length; list.push(j); }
      }
    }
    out.push(list.map((i) => inCell[i]));
  }
  return out;
}
function pca(pts) {
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= pts.length; my /= pts.length;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const [x, y] of pts) { cxx += (x - mx) ** 2; cyy += (y - my) ** 2; cxy += (x - mx) * (y - my); }
  const a = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const ux = Math.cos(a), uy = Math.sin(a);
  let lo = Infinity, hi = -Infinity, wsum = 0;
  for (const [x, y] of pts) {
    const t = (x - mx) * ux + (y - my) * uy;
    lo = Math.min(lo, t); hi = Math.max(hi, t);
    wsum += Math.abs(-(x - mx) * uy + (y - my) * ux);
  }
  const len = hi - lo, thick = (wsum / pts.length) * 2 + 1;
  return { mx, my, ux, uy, lo, hi, len, thick, n: pts.length };
}
// torso centre of a frame (median column of the body band), relative to the cell
function torso(sheet, W, x0, y0, fw, fh, bladeMask) {
  let top = fh, bot = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((y0 + y) * W + x0 + x) * 4;
    if (sheet[i + 3] > 40 && !(bladeMask[i + 3] > 20)) { if (y < top) top = y; if (y > bot) bot = y; }
  }
  const H = bot - top, ys = [Math.round(top + H * 0.5), Math.round(top + H * 0.72)];
  const xs = [];
  for (let y = ys[0]; y <= ys[1]; y++) for (let x = 0; x < fw; x++) {
    const i = ((y0 + y) * W + x0 + x) * 4;
    if (sheet[i + 3] > 40 && !(bladeMask[i + 3] > 20)) xs.push(x);
  }
  xs.sort((a, b) => a - b);
  return [xs.length ? xs[xs.length >> 1] : fw / 2, top + H * 0.58];
}

function geometry(sheetName, maskName, meta) {
  const sheet = L.readPng(path.join(A, sheetName)), mask = L.readPng(path.join(A, maskName));
  const W = sheet.width, fw = meta.frameWidth, fh = meta.frameHeight;
  const frames = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const x0 = c * fw, y0 = r * fh;
    const body = torso(sheet.data, W, x0, y0, fw, fh, mask.data);
    const list = clusters(mask.data, W, x0, y0, fw, fh)
      .filter((p) => p.length >= 25)
      .map(pca)
      .filter((g) => g.len >= 14 && g.len / g.thick >= 2.2)
      .sort((a, b) => b.n - a.n)
      .slice(0, 2);
    const out = list.map((g) => {
      const e1 = [g.mx + g.ux * g.lo, g.my + g.uy * g.lo], e2 = [g.mx + g.ux * g.hi, g.my + g.uy * g.hi];
      const d1 = Math.hypot(e1[0] - body[0], e1[1] - body[1]), d2 = Math.hypot(e2[0] - body[0], e2[1] - body[1]);
      const [hilt, tip] = d1 <= d2 ? [e1, e2] : [e2, e1];
      // relative to the feet anchor, like bladePts
      return [hilt[0] - meta.anchorX, hilt[1] - meta.anchorY, tip[0] - meta.anchorX, tip[1] - meta.anchorY, g.thick].map((v) => +v.toFixed(1));
    });
    frames[r * 8 + c] = out;
  }
  return { frames, sheet, mask };
}
const geoWalk = geometry('dharma.png', 'blade-walk.png', SPR);
// อธรรม walk drawn from its own design sheet: its blades sit a little differently
const geoWalkA = SPR.adharmaWalk ? geometry('adharma.png', 'blade-walk-adharma.png', SPR) : null;
// attack poses overlap too much for detection: blades are hand-placed in attack-blades.json
let geoAtk = null;
if (SPR.attack) {
  const ann = JSON.parse(fs.readFileSync(path.join(__dirname, 'attack-blades.json'), 'utf8'));
  const m = SPR.attack;
  geoAtk = {
    sheet: L.readPng(path.join(A, 'dharma-attack.png')), mask: L.readPng(path.join(A, 'blade-attack.png')),
    all: [], frames: [],
  };
  for (let f = 0; f < 24; f++) {
    const list = ann[f] || [];
    geoAtk.all[f] = list.map(([hx, hy, tx, ty, draw]) => [hx - m.anchorX, hy - m.anchorY, tx - m.anchorX, ty - m.anchorY, 5, draw !== 0]);
    geoAtk.frames[f] = geoAtk.all[f].filter((b) => b[5]).map((b) => b.slice(0, 5));
  }
}
geoWalk.all = geoWalk.frames.map((list) => list.map((b) => [...b, true]));
meta.walk = geoWalk.frames;
if (geoWalkA) { geoWalkA.all = geoWalkA.frames.map((list) => list.map((b) => [...b, true])); meta.walkAdharma = geoWalkA.frames; }
if (geoAtk) meta.attack = geoAtk.frames;

// ------------------------------------------------------------ 2) bare sheets (blades removed)
// erase = steel / blade-layer pixels inside a capsule around every blade (from just past the hand to the tip);
// holes enclosed by the body are filled from their neighbours, the rest becomes transparent
function eraseMask(geo, m, isAttack) {
  const { sheet, mask } = geo, W = sheet.width, H = sheet.height, d = sheet.data;
  const er = new Uint8Array(W * H);
  geo.all.forEach((list, f) => {
    const ox = (f % 8) * m.frameWidth + m.anchorX, oy = Math.floor(f / 8) * m.frameHeight + m.anchorY;
    for (const [hx, hy, tx, ty, thick] of list) {
      const x0 = ox + hx, y0 = oy + hy, x1 = ox + tx, y1 = oy + ty;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const R = isAttack ? 6 : Math.max(4, thick / 2 + 2.5);
      const bx0 = Math.floor(Math.min(x0, x1) - R - 2), bx1 = Math.ceil(Math.max(x0, x1) + R + 2);
      const by0 = Math.floor(Math.min(y0, y1) - R - 2), by1 = Math.ceil(Math.max(y0, y1) + R + 2);
      for (let y = Math.max(0, by0); y <= Math.min(H - 1, by1); y++) for (let x = Math.max(0, bx0); x <= Math.min(W - 1, bx1); x++) {
        const t = (x - x0) * ux + (y - y0) * uy;
        if (t < 2 || t > len + 3) continue;             // keep the hand / hilt
        const dist = Math.abs(-(x - x0) * uy + (y - y0) * ux);
        if (dist > R) continue;
        const k = y * W + x, i = k * 4;
        if (d[i + 3] < 10) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, chroma = (mx - mn) / 255;
        const warm = r > b + 30 && chroma > 0.15;         // skin, gold trims
        if (warm) continue;
        if (mask.data[i + 3] > 20 || (chroma < 0.2 && l > 0.32) || (chroma < 0.16 && dist > R - 3)) er[k] = 1;
      }
    }
  });
  // dark outline pixels touching both an erased pixel and the background
  const out = new Uint8Array(er);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x, i = k * 4;
    if (er[k] || d[i + 3] < 10) continue;
    let nearEr = false, nearBg = false;
    for (const [dx, dy] of L.N8) { const n = k + dy * W + dx; if (er[n]) nearEr = true; if (d[n * 4 + 3] < 10) nearBg = true; }
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (nearEr && nearBg && (mx - mn) / 255 < 0.2 && mx < 120) out[k] = 1;
  }
  return out;
}
function applyErase(img, er) {
  const W = img.width, H = img.height, d = new Uint8ClampedArray(img.data);
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !er[y * W + x] && d[(y * W + x) * 4 + 3] > 120;
  // enclosed by body in most directions -> fill, otherwise transparent
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const fill = [];
  for (let k = 0; k < W * H; k++) {
    if (!er[k]) continue;
    const x = k % W, y = (k / W) | 0;
    let hits = 0;
    for (const [dx, dy] of DIRS) for (let s = 1; s <= 12; s++) { if (solid(x + dx * s, y + dy * s)) { hits++; break; } }
    if (hits >= 7) fill.push(k); else d[k * 4 + 3] = 0;
  }
  // diffuse colours into the filled holes from the outside in
  let todo = fill;
  const done = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (!er[k]) done[k] = 1;
  for (let pass = 0; pass < 30 && todo.length; pass++) {
    const next = [], upd = [];
    for (const k of todo) {
      const x = k % W, y = (k / W) | 0;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx, i = nk * 4;
        if (done[nk] && d[i + 3] > 120) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      }
      if (n) upd.push([k, r / n, g / n, b / n]); else next.push(k);
    }
    for (const [k, r, g, b] of upd) { const i = k * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; done[k] = 1; }
    todo = next;
  }
  for (const k of todo) d[k * 4 + 3] = 0;
  return d;
}
const bare = [];
// (factions = the sheets the geometry is erased from)
const shared = ['dharma', 'adharma'];
for (const [geo, m, atk, factions] of [[geoWalk, SPR, false, geoWalkA ? ['dharma'] : shared], [geoAtk, SPR.attack, true, shared], [geoWalkA, SPR, false, ['adharma']]]) {
  if (!geo) continue;
  const er = eraseMask(geo, m, atk);
  for (const faction of factions) {
    const name = `${faction}${atk ? '-attack' : ''}`;
    const img = L.readPng(path.join(A, name + '.png'));
    const d = applyErase(img, er);
    bare.push([name, img.width, img.height, d]);
  }
}

if (PREVIEW) {
  const line = (d, W, H, x0, y0, x1, y1, c) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const k = (py * W + px) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
  };
  for (const [name, geo, m] of [['walk', geoWalk, SPR], ['attack', geoAtk, SPR.attack]]) {
    if (!geo) continue;
    const { sheet } = geo, W = sheet.width, H = sheet.height;
    const d = new Uint8ClampedArray(W * H * 4);
    for (let k = 0; k < W * H; k++) { const a = sheet.data[k * 4 + 3] / 255; for (let j = 0; j < 3; j++) d[k * 4 + j] = sheet.data[k * 4 + j] * a + 80 * (1 - a); d[k * 4 + 3] = 255; }
    geo.frames.forEach((list, f) => {
      const ox = (f % 8) * m.frameWidth + m.anchorX, oy = Math.floor(f / 8) * m.frameHeight + m.anchorY;
      for (const [hx, hy, tx, ty] of list) {
        line(d, W, H, ox + hx, oy + hy, ox + tx, oy + ty, [255, 230, 0]);
        line(d, W, H, ox + hx - 2, oy + hy - 2, ox + hx + 2, oy + hy + 2, [255, 0, 0]);
        line(d, W, H, ox + hx - 2, oy + hy + 2, ox + hx + 2, oy + hy - 2, [255, 0, 0]);
      }
    });
    writePng(path.join(PDIR, `weapons-geo-${name}.png`), W, H, d);
  }
}

module.exports = { meta };
if (require.main === module) {
  for (const [name, w, h, d] of bare) writePng(path.join(A, `${name}-bare.png`), w, h, d);
  fs.writeFileSync(path.join(A, 'weapons.json'), JSON.stringify(meta));
  console.log('weapon geometry + bare sheets written');
}
