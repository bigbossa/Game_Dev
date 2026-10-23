// AI-drawn monster sprite sheets -> game sprite sheets (same idea as the character: 8 directions x 3 walk frames).
//
// Input   monster-art/<id>.png   <id> = monster id (see monster-art/PROMPTS.md), white or transparent background.
//         Default grid: 8 columns (S, SE, E, NE, N, NW, W, SW) x 3 rows (walk frames).
//         Another grid per file in monster-art/grid.json: { "<id>": [cols, rows] }
//         (cols = 1: a single side view facing right, mirrored in the game for the left side).
// Output  public/assets/monsters/<id>.png  uniform frames, feet on the bottom centre line
//         public/assets/monsters/index.json { <id>: { fw, fh, cols, rows, ax, ay } }
//
//   node tools/build-monsters.js            build every sheet found in monster-art/
//   node tools/build-monsters.js --prompts  (re)write monster-art/PROMPTS.md (one AI image prompt per monster)
const fs = require('fs');
const path = require('path');
const L = require('./img-lib');
const C = require('../shared/world-data');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'monster-art');
const OUT = path.join(ROOT, 'public', 'assets', 'monsters');
const MAX_H = 170;          // frames are scaled down so the tallest pose is at most this many px
// crop of an { w, h, d } image, inclusive box, alpha kept
function cropImg(img, x0, y0, x1, y1) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) d.set(img.d.subarray(((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x1 + 1) * 4), y * w * 4);
  return { w, h, d };
}
fs.mkdirSync(SRC, { recursive: true });

if (process.argv.includes('--prompts')) { writePrompts(); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
const gridCfg = fs.existsSync(path.join(SRC, 'grid.json')) ? JSON.parse(fs.readFileSync(path.join(SRC, 'grid.json'), 'utf8')) : {};
const indexFile = path.join(OUT, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
let built = 0;
for (const file of fs.readdirSync(SRC).filter((f) => /\.png$/i.test(f))) {
  const id = file.replace(/\.png$/i, '');
  if (!C.MONSTERS[id]) { console.warn(`skip ${file}: no monster with id "${id}"`); continue; }
  const [cols, rows] = gridCfg[id] || [8, 3];
  const src = L.readPng(path.join(SRC, file));
  const W = src.width, H = src.height, cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  const img = { w: W, h: H, d: new Uint8ClampedArray(src.data) };
  const transparent = img.d[3] < 10 && img.d[(W * H - 1) * 4 + 3] < 10;
  // cut every cell, drop the background, keep the content box
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let cell = cropImg(img, c * cw, r * ch, c * cw + cw - 1, r * ch + ch - 1);
    if (!transparent) cell = L.removeBg(cell, { shadowFrom: 0.7 });
    const bb = L.bbox(cell);
    if (bb.x1 < 0) { cells.push(null); continue; }
    cells.push({ img: cropImg(cell, bb.x0, bb.y0, bb.x1, bb.y1), w: bb.x1 - bb.x0 + 1, h: bb.y1 - bb.y0 + 1 });
  }
  const found = cells.filter(Boolean);
  if (!found.length) { console.warn(`skip ${file}: nothing found in the cells`); continue; }
  const maxH = Math.max(...found.map((q) => q.h)), maxW = Math.max(...found.map((q) => q.w));
  const s = Math.min(1, MAX_H / maxH);
  const pad = 4, fw = Math.ceil(maxW * s) + pad * 2, fh = Math.ceil(maxH * s) + pad * 2;
  const out = new Uint8ClampedArray(fw * cols * fh * rows * 4);
  cells.forEach((q, i) => {
    if (!q) return;
    const im = s < 1 ? L.scaleImg(q.img, s) : q.img;
    const c = i % cols, r = (i / cols) | 0;
    // centred horizontally, feet on the bottom line
    L.blit(out, fw * cols, fh * rows, im, c * fw + Math.round((fw - im.w) / 2), r * fh + fh - pad - im.h);
  });
  L.writePng(path.join(OUT, `${id}.png`), fw * cols, fh * rows, out);
  index[id] = { fw, fh, cols, rows, ax: fw / 2, ay: fh - pad };
  built++;
  console.log(`${id}: ${cols}x${rows} frames of ${fw}x${fh}${found.length < cells.length ? ` (${cells.length - found.length} empty cells)` : ''}`);
}
for (const id of Object.keys(index)) if (!index[id].managedBy && !fs.existsSync(path.join(SRC, `${id}.png`))) delete index[id];
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
console.log(`built ${built} monster sheet(s) -> ${path.relative(ROOT, OUT)}`);

// ---------------------------------------------------------------- prompts for an AI image generator
function writePrompts() {
  const lines = [
    '# Monster sprite prompts (AI image generator)',
    '',
    'สร้างภาพมอนสเตอร์ทีละตัวด้วย AI วาดภาพ (เช่น ChatGPT / Midjourney / Leonardo / SDXL) ด้วย prompt ด้านล่าง',
    'แล้วบันทึกเป็น `monster-art/<id>.png` (ชื่อไฟล์ = id ในหัวข้อ) จากนั้นสั่ง `npm run monsters` แล้วรีเฟรชเกม',
    '',
    '- เลย์เอาต์มาตรฐาน: **8 คอลัมน์ × 3 แถว** พื้นขาวล้วน (หรือพื้นโปร่งใส) แต่ละช่องตัวเดียวเต็มตัว',
    '- คอลัมน์ = ทิศ: หน้า (หันเข้ากล้อง), หน้า-ขวา, ขวา, หลัง-ขวา, หลัง, หลัง-ซ้าย, ซ้าย, หน้า-ซ้าย · แถว = เฟรมท่าเดิน 3 เฟรม',
    '- ถ้า AI ให้ภาพแค่ด้านข้างแถวเดียว ใส่ใน `monster-art/grid.json` เช่น `{ "boar": [1, 1] }` (หันขวา เกมจะกลับด้านให้เอง) หรือจำนวนช่องที่ได้จริง',
    '- ตัวไหนยังไม่มีภาพ เกมใช้ภาพวาดด้วยโค้ดแทน',
    '',
  ];
  const STYLE = 'cute chibi anime 2D MMORPG game sprite (Korean wuxia fantasy style like Yulgang), clean bold dark outlines, cel shading, vivid colours, crisp details';
  const LAYOUT = 'Sprite sheet with exactly 8 columns and 3 rows, evenly spaced cells, pure white background, no text, no grid lines, no ground shadow. ' +
    'Columns are the facing directions in this order: front (facing the viewer), front-right, right, back-right, back, back-left, left, front-left. ' +
    'Rows are 3 frames of a walking animation. The same creature in every cell, same size, feet on the same line, whole body visible.';
  for (const mapId of C.MAP_ORDER) {
    const d = C.MAPS[mapId];
    lines.push(`## ${d.name} (${C.levelText(d)})`, '');
    for (const id of [...(d.mons || []), d.boss]) {
      const m = C.MONSTERS[id];
      lines.push(`### \`${id}\` — ${m.name} (Lv.${m.lvl}${m.boss ? ' · บอส' : ''})`, '');
      lines.push('```', `${m.boss ? 'A large imposing boss: ' : ''}${m.en}. ${STYLE}. ${LAYOUT}`, '```', '');
    }
  }
  fs.writeFileSync(path.join(SRC, 'PROMPTS.md'), lines.join('\n'));
  console.log(`wrote ${path.relative(ROOT, path.join(SRC, 'PROMPTS.md'))}`);
}
