// Outfit masks used to recolour armour on the character sheets.
// Reads the ธรรมะ sheets (dharma.png / dharma-attack.png) plus the blade layers and writes
//   public/assets/armor-walk.png / armor-attack.png
// R = shirt (robe + blue cloth), G = pants, B = bracers/gauntlets; value = recolour strength.
// A second mask (armor2-walk.png / armor2-attack.png) holds the pauldrons in R.
// The อธรรม attack sheet is recoloured pixel-for-pixel from the ธรรมะ one, so one mask serves both; when the อธรรม
// walk is drawn from its own design sheet (sprites.json adharmaWalk) it gets its own masks (armor-walk-adharma.png):
// black robe, red cloth instead of blue, its own hair left alone.
// `node tools/armor-masks.js --preview` also writes a colour-coded preview next to the masks.
const path = require('path');
const L = require('./img-lib');
const { rgb2hsl, writePng } = L;

const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'public', 'assets');
const SPR = require(path.join(A, 'sprites.json'));
const PREVIEW = process.argv.includes('--preview');

function build(sheetName, bladeName, fw, fh, out, adh = false) {
  const src = L.readPng(path.join(A, sheetName));
  const blade = L.readPng(path.join(A, bladeName));
  const W = src.width, H = src.height, d = src.data, bd = blade.data;
  const mask = new Uint8ClampedArray(W * H * 4), mask2 = new Uint8ClampedArray(W * H * 4);
  const info = new Array(W * H);
  // skin and blade edges (both dilated) are never recoloured
  const skin = new Uint8Array(W * H), bladeIn = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (d[i + 3] && d[i] > 170 && d[i + 2] > 125 && d[i] > d[i + 2] + 24 && d[i + 1] > d[i + 2]) skin[k] = 1; // not gold trims
    if (bd[i + 3] > 20) bladeIn[k] = 1;
  }
  const dilate = (m, R) => {
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) o[ny * W + nx] = 1;
      }
    }
    return o;
  };
  const nearSkin = dilate(skin, 3), nearBlade = dilate(bladeIn, 2);
  // per-pixel classes
  for (let k = 0; k < W * H; k++) {
    const i = k * 4;
    if (d[i + 3] < 40 || nearBlade[k]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const [h, s, l] = rgb2hsl(r, g, b);
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    // the accent cloth: blue (ธรรมะ) / red (อธรรม design)
    const red = adh && (h >= 335 || h <= 12) && s > 0.35 && chroma > 0.18;
    const warm = r > b + 24 && !red;           // skin, hair, gold trims, boots
    const blue = adh ? red : h >= 185 && h <= 255;
    const streak = !adh && blue && s > 0.82 && chroma > 0.55; // baked slash streaks in attack poses
    info[k] = { l, chroma, warm, blue, streak };
  }
  const cols = Math.round(W / fw), rows = Math.round(H / fh);
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) {
    // body box (no blades / streaks)
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = ry * fh; y < (ry + 1) * fh; y++) for (let x = cx * fw; x < (cx + 1) * fw; x++) {
      const p = info[y * W + x];
      if (!p || p.streak || (p.blue && !adh)) continue;   // blue slash trails would stretch the box
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) continue;
    // body centre = median column of the pixels in the torso band
    const BH = y1 - y0;
    const colsCount = [];
    for (let y = Math.round(y0 + BH * 0.45); y < y0 + BH * 0.7; y++) for (let x = x0; x <= x1; x++) if (info[y * W + x]) colsCount.push(x);
    colsCount.sort((a, b) => a - b);
    const mid = colsCount.length ? colsCount[colsCount.length >> 1] : (x0 + x1) / 2;
    const half = Math.max(10, BH * 0.22);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * W + x, p = info[k];
      if (!p || p.streak || p.warm) continue;
      const yr = (y - y0) / BH, rel = Math.abs(x - mid) / half;
      if (nearSkin[k] && yr < 0.6) continue;                                   // face, neck, hands
      let R = 0, G = 0, B = 0, S = 0;
      // pauldrons: armour on the top of the arms, beside the collar
      if (yr >= 0.45 && yr < 0.6 && rel > (adh ? 0.6 : 0.3) && rel < 1.6 && p.l < 0.38) S = 255;   // (อธรรม: the chest is black too)
      if (S) { const i = k * 4; mask2[i] = S; mask2[i + 3] = 255; continue; }
      if (yr < 0.46) {
        // head: only the blue hair ribbon follows the shirt colour, faintly
        if (p.blue && p.chroma > 0.15 && !adh) R = 120;                        // (อธรรม: red hair streaks stay)
      } else if (yr < 0.8) {
        const dark = p.l < 0.34;
        if (dark && rel > 0.55 && yr < 0.74) B = 255;                         // gauntlets on the arms
        else if (adh) { if (p.blue) R = 255; else if (dark) R = 90; }         // อธรรม: red cloth + black robe (light touch, like the white robe)
        else if (dark && yr > 0.62) G = 220;                                  // waist / top of the trousers
        else if (p.blue && p.chroma > 0.12) R = 255;                          // blue cloth, trims, pattern
        else if (p.l > 0.6 && p.chroma < 0.2) R = 90;                         // white robe: light touch
        else if (dark) R = 150;                                               // belt / collar shading
      } else {
        const dark = p.l < 0.42;
        if (dark) G = 255;                                                    // trousers
        else if (p.blue && p.chroma > 0.12) R = 230;                          // robe skirt trims
        else if (p.l > 0.6 && p.chroma < 0.2) R = 90;
      }
      if (R || G || B) { const i = k * 4; mask[i] = R; mask[i + 1] = G; mask[i + 2] = B; mask[i + 3] = 255; }
    }
  }
  writePng(path.join(A, out), W, H, mask);
  writePng(path.join(A, out.replace('armor-', 'armor2-')), W, H, mask2);
  if (PREVIEW) {
    const pv = new Uint8ClampedArray(d);
    for (let k = 0; k < W * H; k++) {
      const i = k * 4;
      if (mask2[i + 3]) { for (let j = 0; j < 3; j++) pv[i + j] = pv[i + j] * 0.2 + [255, 220, 0][j] * 0.8; continue; }
      if (!mask[i + 3]) continue;
      const a = Math.max(mask[i], mask[i + 1], mask[i + 2]) / 255 * 0.8;
      const c = mask[i] >= mask[i + 1] && mask[i] >= mask[i + 2] ? [255, 40, 40] : mask[i + 1] >= mask[i + 2] ? [40, 255, 60] : [60, 120, 255];
      for (let j = 0; j < 3; j++) pv[i + j] = pv[i + j] * (1 - a) + c[j] * a;
    }
    writePng(path.join(process.env.MASK_PREVIEW_DIR || A, out.replace('.png', '-preview.png')), W, H, pv);
  }
  console.log('armor mask', out, `${cols}x${rows}`);
}

build('dharma.png', 'blade-walk.png', SPR.frameWidth, SPR.frameHeight, 'armor-walk.png');
if (SPR.adharmaWalk) build('adharma.png', 'blade-walk-adharma.png', SPR.frameWidth, SPR.frameHeight, 'armor-walk-adharma.png', true);
if (SPR.attack) build('dharma-attack.png', 'blade-attack.png', SPR.attack.frameWidth, SPR.attack.frameHeight, 'armor-attack.png');
