// Slice model.png (walk) and model-2.png (attack) into game spritesheets for both factions.
// The อธรรม walk + portrait come from their own design sheet (แผ่นออกแบบตัวละครฝ่ายอธรรม.png, same layout as
// model.png) when it exists; otherwise model.png is recoloured. Attack poses are always model-2.png (+ recolour).
// Output (public/assets): dharma.png, adharma.png, *-attack.png, *-portrait.png,
//   blade-walk.png / blade-walk-adharma.png / blade-attack.png (sword layers) and sprites.json
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const { crop, removeBg, bbox, blit, writePng, cloneImg, rgb2hsl, hsl2rgb, bladeMaskShape, bladeLayer, samplePoints } = L;

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const src = L.readPng(path.join(ROOT, 'model.png'));
const ADH_FILE = path.join(ROOT, 'แผ่นออกแบบตัวละครฝ่ายอธรรม.png');
const adhSrc = fs.existsSync(ADH_FILE) ? L.readPng(ADH_FILE) : null;

// Walk cycle grid (detected from the sheet): 8 directions x 3 frames
const COLS = [10, 185, 368, 547, 726, 903, 1081, 1261, 1440];
const ROWS = [511, 689, 869, 1060];
// Source column order: Front, Front-Right, Right, Back-Right, Back, Back-Left, Left, Front-Left
const DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

// Steel blades in the walk poses: low-saturation grey pixels at the sides of the lower body.
function bladeMaskPos(img) {
  const { w, h, d } = img;
  const bb = bbox(img);
  const cx = (bb.x0 + bb.x1) / 2;
  const half = (bb.x1 - bb.x0) / 2;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x, i = k * 4; if (d[i + 3] === 0) continue;
      const [, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
      const rel = Math.abs(x - cx) / half;
      const yRel = (y - bb.y0) / (bb.y1 - bb.y0);
      if (s < 0.2 && l > 0.45 && rel > 0.55 && yRel > 0.38) m[k] = 1;
    }
  return m;
}

// Adharma: white robe -> black/charcoal, blue cloth -> crimson red, navy -> dark maroon-black.
function recolorAdharma(img, blade, headBox) {
  const { w, h, d } = img;
  const bb = bbox(img);
  const H = bb.y1 - bb.y0;
  const headLine = bb.y0 + H * 0.4;   // chibi head: keep eyes & skin
  const faceLine = bb.y0 + H * 0.56;  // lower face / chin zone uses skin proximity
  // attack poses: explicit head box instead of proportions
  const hb = headBox && [headBox[0] - 12, headBox[1] - 30, headBox[2] + 12, headBox[3] + 6];
  // skin mask dilated by 3px: light neutral pixels next to skin belong to the face
  const skin = new Uint8Array(w * h), nearSkin = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const i = k * 4;
    if (d[i + 3] && d[i] > 150 && d[i] > d[i + 2] + 24 && d[i + 1] > d[i + 2]) skin[k] = 1;
  }
  const R = 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!skin[y * w + x]) continue;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) nearSkin[ny * w + nx] = 1;
    }
  }
  for (let k = 0; k < w * h; k++) {
    const i = k * 4; if (d[i + 3] === 0) continue;
    const y = (k / w) | 0;
    const warm = d[i] > d[i + 2] + 24; // skin, gold, hair -> untouched unless blue
    const x = k % w;
    const inHead = hb
      ? (x >= hb[0] && x <= hb[2] && y >= hb[1] && y <= hb[3]) || (nearSkin[k] && y <= hb[3] + 22 && x >= hb[0] - 10 && x <= hb[2] + 10)
      : y < headLine || (y < faceLine && nearSkin[k]);
    const [hh, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    let out = null;
    if (blade && blade[k]) {
      out = hsl2rgb(355, Math.min(0.3, s + 0.15), l * 0.88); // steel with a blood tint
    } else {
      const blueish = hh >= 185 && hh <= 255;
      // chroma (0..1) is more honest than HSL saturation for near-white pixels
      const chroma = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255;
      if (warm || (inHead && !(blueish && chroma > 0.12))) {
        // leave skin, eyes, gold trims and hair alone
      } else if (l > 0.66 && (chroma < 0.16 || (blueish && chroma < 0.3))) {
        out = hsl2rgb(350, 0.14, 0.08 + (l - 0.66) * 0.5);      // white robe -> charcoal
      } else if (blueish && l > 0.66) {
        out = hsl2rgb(354, 0.55, 0.22 + (l - 0.66) * 0.4);      // light blue pattern -> dark crimson
      } else if (blueish && chroma > 0.12) {
        if (l < 0.3) out = hsl2rgb(352, Math.min(1, s * 0.6), l * 0.5);   // navy -> red-black
        else out = hsl2rgb(356, Math.min(0.95, s * 1.1), l * 0.8);        // blue trim -> red
      } else if (l > 0.55 && chroma < 0.16) {
        out = hsl2rgb(350, 0.14, 0.06 + (l - 0.55) * 0.4);      // light grey shading
      } else if (blueish) {
        out = hsl2rgb(350, s * 0.4, l * 0.55);
      }
    }
    if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; }
  }
  return img;
}

// Blade pixels in walk poses: elongated grey shapes, restricted to the lower/side area
function walkBladeMask(img) {
  const shape = bladeMaskShape(img, { minElong: 2.6, maxThick: 15 });
  const pos = bladeMaskPos(img);
  const m = new Uint8Array(img.w * img.h);
  for (let k = 0; k < m.length; k++) m[k] = shape[k] && pos[k] ? 1 : 0;
  return m;
}

// ---- build walk frames ----
// the design sheet's cells have tinted borders: cut a little further inside
const slice = (sheet, inset, bgOpts) => {
  const out = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) {
      const img = removeBg(crop(sheet, COLS[c] + inset, ROWS[r] + inset, COLS[c + 1] - inset + 1, ROWS[r + 1] - inset + 1), bgOpts);
      out.push({ r, c, img, bb: bbox(img), cellCx: img.w / 2 });
    }
  return out;
};
const frames = slice(src, 3);
// (its paper is a little off-white: the pockets between arms and body need a looser test)
const adhFrames = adhSrc ? slice(adhSrc, 5, { pureMin: 243, loosePockets: true }) : null;

// Common frame size: feet aligned to a baseline, cell centre aligned horizontally.
let maxSide = 0, maxUp = 0;
for (const f of [...frames, ...(adhFrames || [])]) {
  maxSide = Math.max(maxSide, f.cellCx - f.bb.x0, f.bb.x1 - f.cellCx);
  maxUp = Math.max(maxUp, f.bb.y1 - f.bb.y0);
}
const HALF = Math.ceil(maxSide) + 2;
const FW = HALF * 2, FH = Math.ceil(maxUp) + 4;
console.log('frame size', FW, FH);

const SW = FW * 8, SH = FH * 3;
const walkPts = new Array(24);
for (const faction of ['dharma', 'adharma']) {
  const own = faction === 'dharma' || adhFrames;     // drawn art (not a recolour): has its own blade layer
  const sheet = new Uint8ClampedArray(SW * SH * 4);
  const blades = own ? new Uint8ClampedArray(SW * SH * 4) : null;
  for (const f of faction === 'adharma' && adhFrames ? adhFrames : frames) {
    let img = cloneImg(f.img);
    const ox = f.c * FW + Math.round(HALF - f.cellCx);
    const oy = f.r * FH + (FH - 2 - f.bb.y1);
    if (!own) img = recolorAdharma(img, bladeMaskPos(img));
    else {
      const layer = bladeLayer(img, walkBladeMask(img));
      blit(blades, SW, SH, layer, ox, oy);
      // points relative to the frame anchor (feet)
      if (faction === 'dharma') walkPts[f.r * 8 + f.c] = samplePoints(layer, HALF - (ox - f.c * FW), FH - 2 - (oy - f.r * FH));
    }
    blit(sheet, SW, SH, img, ox, oy);
  }
  writePng(path.join(OUT, faction + '.png'), SW, SH, sheet);
  if (blades) writePng(path.join(OUT, faction === 'dharma' ? 'blade-walk.png' : 'blade-walk-adharma.png'), SW, SH, blades);

  // Portrait from the large front turnaround pose
  const design = faction === 'adharma' && adhSrc;
  let p = removeBg(crop(design ? adhSrc : src, 0, 52, 206, 372));
  if (faction === 'adharma' && !design) p = recolorAdharma(p, bladeMaskPos(p));
  const pb = bbox(p);
  const pw = pb.x1 - pb.x0 + 1, ph = pb.y1 - pb.y0 + 1;
  const pd = new Uint8ClampedArray(pw * ph * 4);
  blit(pd, pw, ph, p, -pb.x0, -pb.y0);
  writePng(path.join(OUT, faction + '-portrait.png'), pw, ph, pd);
}

// ---- attack cycle from model-2.png ----
const ATK_FILE = path.join(ROOT, 'model-2.png');
let attackMeta = null;
if (fs.existsSync(ATK_FILE)) {
  const { buildAttack } = require('./attack-frames');
  const walkH = frames.filter((f) => f.r === 1).reduce((a, f) => a + (f.bb.y1 - f.bb.y0), 0) / 8;
  attackMeta = buildAttack(L.readPng(ATK_FILE), walkH, recolorAdharma, OUT);
}

fs.writeFileSync(path.join(OUT, 'sprites.json'), JSON.stringify({
  frameWidth: FW, frameHeight: FH, directions: DIRS, framesPerDir: 3,
  anchorX: HALF, anchorY: FH - 2, // feet position inside each frame
  bladePts: walkPts,              // [row*8+col] -> [[dx,dy],...] relative to the feet
  adharmaWalk: !!adhFrames,       // อธรรม walk drawn separately: own blades / armour masks / head anchors
  attack: attackMeta,
}));
console.log('done');
