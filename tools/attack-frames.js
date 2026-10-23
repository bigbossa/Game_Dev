const path = require('path');
const L = require('./img-lib');
const { N8, crop, removeBg, bbox, cloneImg, blit, writePng, scaleImg, bladeMaskShape, bladeLayer, samplePoints } = L;

// Attack cycle extraction (model-2.png): 8 panels x 3 overlapping poses.
// Poses are separated by geodesic growth from hand-placed seed boxes
// (head / torso / feet), in coordinates relative to each panel's figure area.

const ORIGINS = [[9, 130], [367, 130], [726, 130], [1085, 130], [9, 607], [367, 607], [726, 607], [1085, 607]];
const PW = 350, PH = 338, INSET = 3;

// seeds per panel, figures listed left -> right; the first box of each figure is its head
const SEEDS = [
  [ // Front
    [[35, 40, 100, 120], [40, 140, 100, 205], [25, 215, 50, 255], [88, 215, 112, 250]],
    [[150, 40, 235, 130], [150, 145, 205, 195], [130, 205, 148, 238]],
    [[245, 150, 315, 230], [235, 235, 320, 275], [172, 285, 208, 322], [282, 292, 312, 322]],
  ],
  [ // Front-Right
    [[55, 50, 125, 128], [40, 135, 120, 205], [22, 215, 52, 255], [97, 205, 122, 232]],
    [[160, 40, 230, 130], [160, 135, 215, 195], [148, 212, 172, 248]],
    [[250, 150, 320, 232], [245, 238, 315, 278], [188, 284, 222, 322], [302, 282, 328, 312]],
  ],
  [ // Right
    [[50, 40, 115, 120], [45, 130, 105, 205], [18, 215, 45, 252], [92, 212, 113, 233]],
    [[150, 45, 228, 125], [160, 130, 215, 205], [146, 215, 168, 252]],
    [[262, 168, 335, 235], [245, 242, 315, 282], [172, 290, 200, 318], [277, 300, 303, 328]],
  ],
  [ // Back-Right
    [[30, 50, 100, 130], [30, 135, 105, 205], [32, 222, 55, 258], [87, 228, 113, 268]],
    [[130, 55, 210, 135], [135, 135, 200, 205], [147, 222, 173, 258]],
    [[275, 95, 345, 165], [272, 170, 338, 235], [212, 255, 248, 292], [312, 255, 343, 283]],
  ],
  [ // Back
    [[25, 70, 100, 150], [35, 158, 105, 235], [27, 252, 53, 288], [82, 252, 113, 298]],
    [[135, 65, 205, 145], [205, 75, 230, 145], [148, 155, 225, 228], [137, 232, 163, 272], [202, 237, 223, 258]],
    [[245, 148, 320, 230], [240, 232, 320, 288], [202, 292, 233, 328], [290, 296, 313, 323]],
  ],
  [ // Back-Left
    [[15, 80, 95, 155], [30, 162, 110, 235], [32, 252, 53, 288], [97, 248, 123, 288]],
    [[160, 70, 235, 140], [140, 40, 165, 100], [140, 140, 225, 210], [137, 212, 163, 258], [202, 212, 223, 243]],
    [[255, 152, 330, 230], [235, 232, 315, 278], [168, 292, 203, 328], [272, 300, 303, 328]],
  ],
  [ // Left (drawn mirrored: lunge on the left, ready stance on the right)
    [[25, 150, 100, 230], [55, 232, 135, 278], [37, 292, 73, 328], [127, 292, 163, 328]],
    [[140, 85, 215, 140], [108, 68, 128, 98], [135, 145, 215, 208], [127, 212, 153, 238], [187, 222, 218, 258]],
    [[255, 95, 330, 145], [255, 148, 335, 212], [247, 217, 273, 243], [307, 212, 333, 253]],
  ],
  [ // Front-Left
    [[20, 95, 95, 165], [25, 170, 100, 232], [37, 242, 73, 292], [102, 242, 128, 272]],
    [[150, 85, 225, 140], [125, 35, 150, 85], [158, 142, 222, 198]],
    [[250, 150, 325, 215], [235, 218, 330, 278], [197, 292, 233, 323], [312, 282, 333, 308]],
  ],
];
// Animation order (ready -> strike -> follow-through) as indexes into the left->right list
const ORDER = [[0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [0, 1, 2], [2, 1, 0], [0, 1, 2]];


function segment(img, figs) {
  const { w, h, d } = img;
  const lab = new Int8Array(w * h).fill(-1);
  const q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  figs.forEach((rects, fi) => {
    for (const [x0, y0, x1, y1] of rects)
      for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++)
        for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
          const k = y * w + x;
          if (d[k * 4 + 3] > 0 && lab[k] < 0) { lab[k] = fi; q[qt++] = k; }
        }
  });
  while (qh < qt) {
    const k = q[qh++], x = k % w, y = (k / w) | 0;
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (lab[nk] < 0 && d[nk * 4 + 3] > 0) { lab[nk] = lab[k]; q[qt++] = nk; }
    }
  }
  return figs.map((_, fi) => {
    const o = { w, h, d: new Uint8ClampedArray(w * h * 4) };
    for (let k = 0; k < w * h; k++) if (lab[k] === fi) for (let c = 0; c < 4; c++) o.d[k * 4 + c] = d[k * 4 + c];
    return o;
  });
}

// feet centroid: mean x of opaque pixels in the lowest 14% of the figure
function feetX(img, bb) {
  const y0 = bb.y1 - Math.max(4, Math.round((bb.y1 - bb.y0) * 0.14));
  let sx = 0, n = 0;
  for (let y = y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++)
    if (img.d[(y * img.w + x) * 4 + 3] > 100) { sx += x; n++; }
  return n ? sx / n : (bb.x0 + bb.x1) / 2;
}

// Builds <faction>-attack.png and blade-attack.png in OUT, returns the frame metadata.
function buildAttack(asrc, walkH, recolorAdharma, OUT) {
  const raw = []; // raw[panel][animFrame] = { img, head }
  SEEDS.forEach((figs, pi) => {
    const [ox, oy] = ORIGINS[pi];
    const panel = removeBg(crop(asrc, ox + INSET, oy, ox + PW, oy + PH), { shadowFrom: 0.55, loosePockets: true, glow: true });
    const shifted = figs.map((rects) => rects.map(([a, b, c, d]) => [a - INSET, b, c - INSET, d]));
    const parts = segment(panel, shifted);
    raw[pi] = ORDER[pi].map((fi) => ({ img: parts[fi], head: shifted[fi][0] }));
  });

  // scale so the ready stance matches the walk sprite height
  const readyH = raw.reduce((a, p) => { const b = bbox(p[0].img); return a + (b.y1 - b.y0); }, 0) / 8;
  const S = walkH / readyH;
  console.log('attack scale', S.toFixed(3));

  // geometry (identical for both factions: recolouring never changes alpha)
  const geo = [];
  raw.forEach((p, pi) => p.forEach((f, ai) => {
    const sc = scaleImg(f.img, S), bb = bbox(sc);
    const hb = f.head, exclude = [hb[0] - 28, hb[1] - 50, hb[2] + 28, hb[3] + 8];
    const layer = scaleImg(bladeLayer(f.img, bladeMaskShape(f.img, { exclude, minSize: 45, minElong: 2.6, maxThick: 16, minL: 0.38 })), S);
    geo.push({ pi, ai, f, bb, ax: feetX(sc, bb), layer });
  }));
  let side = 0, up = 0;
  for (const g of geo) { side = Math.max(side, g.ax - g.bb.x0, g.bb.x1 - g.ax); up = Math.max(up, g.bb.y1 - g.bb.y0); }
  const half = Math.ceil(side) + 2;
  const meta = { frameWidth: half * 2, frameHeight: Math.ceil(up) + 4, anchorX: half, anchorY: Math.ceil(up) + 2, framesPerDir: 3, bladePts: [] };
  const { frameWidth: AW, frameHeight: AH, anchorX: AX, anchorY: AY } = meta;
  const SW = AW * 8, SH = AH * 3;

  const blades = new Uint8ClampedArray(SW * SH * 4);
  for (const g of geo) {
    const ox = g.pi * AW + Math.round(AX - g.ax), oy = g.ai * AH + (AY - g.bb.y1);
    blit(blades, SW, SH, g.layer, ox, oy);
    meta.bladePts[g.ai * 8 + g.pi] = samplePoints(g.layer, AX - (ox - g.pi * AW), AY - (oy - g.ai * AH));
  }
  writePng(path.join(OUT, 'blade-attack.png'), SW, SH, blades);

  for (const faction of ['dharma', 'adharma']) {
    const sheet = new Uint8ClampedArray(SW * SH * 4);
    for (const g of geo) {
      let img = cloneImg(g.f.img);
      if (faction === 'adharma') img = recolorAdharma(img, bladeMaskShape(img), g.f.head);
      img = scaleImg(img, S);
      blit(sheet, SW, SH, img, g.pi * AW + Math.round(AX - g.ax), g.ai * AH + (AY - g.bb.y1));
    }
    writePng(path.join(OUT, faction + '-attack.png'), SW, SH, sheet);
  }
  console.log('attack frame size', AW, AH);
  return meta;
}

module.exports = { buildAttack };
