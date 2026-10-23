// Validate decoded PNGs, not merely file presence. Run: node tools/check-warrior-art.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readPng } = require('./img-lib');

const root = path.join(__dirname, '..');
const assetDir = path.join(root, 'public/assets/warrior-v3');
const meta = JSON.parse(fs.readFileSync(path.join(assetDir, 'model.json'), 'utf8'));
const { frameWidth: width, frameHeight: height, anchorX, anchorY } = meta;
assert.equal(meta.version, 3);
assert.equal(meta.paintedHelmet, true);
assert.equal(width, 320);
assert.equal(height, 280);
assert.equal(anchorX, 160);
assert.equal(anchorY, 252);
assert.equal(meta.walkFrames, 4);
assert.equal(meta.attackFrames, 3);
assert.equal(meta.heldWeapon, true, 'painted sword/shield must not get a second procedural weapon');
assert.deepEqual(Object.keys(meta.landmarks).sort(), ['adharma', 'dharma']);

function frame(png, row, col) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = ((row * height + y) * png.width + col * width) * 4;
    png.data.copy(pixels, y * width * 4, start, start + width * 4);
  }
  return pixels;
}

function bounds(pixels, w, h, threshold = 0) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, solid = 0, transparent = 0, partial = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = pixels[(y * w + x) * 4 + 3];
    if (a === 0) transparent++;
    else if (a < 255) partial++;
    if (a > 128) solid++;
    if (a <= threshold) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, solid, transparent, partial };
}

// A large connected body prevents a field of stray pixels from passing the nonempty test.
function largestBody(pixels) {
  const seen = new Uint8Array(width * height), queue = new Uint32Array(width * height);
  let largest = 0;
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || pixels[i * 4 + 3] <= 128) continue;
    seen[i] = 1; queue[0] = i;
    let end = 1;
    for (let next = 0; next < end; next++) {
      const k = queue[next], x = k % width, y = Math.floor(k / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!seen[n] && pixels[n * 4 + 3] > 128) { seen[n] = 1; queue[end++] = n; }
      }
    }
    largest = Math.max(largest, end);
  }
  return largest;
}

const digest = pixels => crypto.createHash('sha256').update(pixels).digest('hex');
const summary = { frames: 0, portraits: 0, sources: 0, minAtlasMargin: Infinity, maxFeetOffset: 0, maxCentreOffset: 0 };
const factionDigests = [];
for (const faction of ['dharma', 'adharma']) {
  const source = readPng(path.join(root, 'class-art/warrior-v3', faction + '-source.png'));
  assert.equal(source.width, 1402); assert.equal(source.height, 1122);
  const sourceBounds = bounds(source.data, source.width, source.height);
  assert(sourceBounds.transparent > source.width * source.height * .1, faction + ': source must preserve transparency');
  summary.sources++;
  let idle;
  for (const pose of ['walk', 'attack']) {
    const label = `${faction}-${pose}`, count = meta[pose + 'Frames'];
    const png = readPng(path.join(assetDir, label + '.png'));
    assert.equal(png.width, width * 8, label + ': eight direction columns');
    assert.equal(png.height, height * count, label + ': frame rows');
    const marks = meta.landmarks[faction][pose];
    assert.equal(marks.length, count * 8, label + ': one landmark per frame');
    const frames = Array.from({ length: count }, (_, row) => Array.from({ length: 8 }, (_, col) => frame(png, row, col)));
    factionDigests.push(digest(png.data));
    for (let row = 0; row < count; row++) for (let col = 0; col < 8; col++) {
      const tag = `${label} frame ${row} direction ${col}`, pixels = frames[row][col], b = bounds(pixels, width, height);
      assert(b.transparent > width * height * .4, tag + ': missing alpha background');
      assert(b.partial > 20, tag + ': expected antialiased transparent artwork');
      assert(b.solid > 6000 && largestBody(pixels) > 4000, tag + ': empty/fragmented character');
      assert(b.x1 - b.x0 >= 65 && b.y1 - b.y0 >= 100, tag + ': undersized body');
      const margin = Math.min(b.x0, b.y0, width - 1 - b.x1, height - 1 - b.y1);
      assert(margin >= 2, tag + ': pixels touch atlas cell edge (clipping/bleeding risk)');
      summary.minAtlasMargin = Math.min(summary.minAtlasMargin, margin);

      let feetY = -1, headY = height;
      for (let y = 0; y < height; y++) {
        let opaque = 0;
        for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > 128) opaque++;
        if (opaque >= 5) { feetY = y; headY = Math.min(headY, y); }
      }
      let feetLeft = width, feetRight = -1;
      for (let y = Math.max(0, feetY - 11); y <= feetY; y++) for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] <= 128) continue;
        feetLeft = Math.min(feetLeft, x); feetRight = Math.max(feetRight, x);
      }
      const feetOffset = Math.abs(feetY - anchorY), centreOffset = Math.abs((feetLeft + feetRight) / 2 - anchorX);
      assert(feetOffset <= 2 && b.y1 <= anchorY + 4, tag + ': feet drift vertically');
      assert(centreOffset <= 5, tag + ': feet drift horizontally');
      summary.maxFeetOffset = Math.max(summary.maxFeetOffset, feetOffset);
      summary.maxCentreOffset = Math.max(summary.maxCentreOffset, centreOffset);
      const mark = marks[row * 8 + col];
      for (const key of ['headTop', 'feetY', 'sourceCentre', 'sourceFeet']) assert(Number.isInteger(mark[key]), tag + ': invalid ' + key);
      assert.equal(mark.feetY, anchorY, tag + ': landmark feet');
      assert(Math.abs(mark.headTop - headY) <= 6, tag + ': landmark head does not match pixels');
      assert(mark.sourceCentre >= 0 && mark.sourceCentre < source.width, tag + ': invalid source centre');
      assert(mark.sourceFeet >= 0 && mark.sourceFeet < source.height, tag + ': invalid source feet');

      // NW/W/SW must reflect NE/E/SE, with all RGBA channels preserved.
      if (col > 4) {
        const opposite = frames[row][8 - col];
        let matches = true;
        for (let y = 0; y < height && matches; y++) for (let x = 0; x < width && matches; x++) {
          const a = (y * width + x) * 4, z = (y * width + width - 1 - x) * 4;
          for (let channel = 0; channel < 4; channel++) if (pixels[a + channel] !== opposite[z + channel]) { matches = false; break; }
        }
        assert(matches, tag + ': incorrect mirrored direction');
      }
      summary.frames++;
    }
    for (let col = 0; col < 8; col++) {
      assert.notEqual(digest(frames[0][col]), digest(frames[1][col]), label + ': animation has no pose change');
      if (pose === 'walk') assert.notEqual(digest(frames[0][col]), digest(frames[2][col]), label + ': both steps are identical');
    }
    if (pose === 'attack') idle = frames[0][0];
  }
  const portrait = readPng(path.join(assetDir, faction + '-portrait.png'));
  const p = bounds(portrait.data, portrait.width, portrait.height);
  assert(p.transparent > portrait.width * portrait.height * .1, faction + ': opaque portrait background');
  assert(p.solid > 6000 && p.partial > 20, faction + ': empty portrait');
  const ib = bounds(idle, width, height, 20);
  assert.equal(portrait.width, ib.x1 - ib.x0 + 1, faction + ': portrait crop width');
  assert.equal(portrait.height, ib.y1 - ib.y0 + 1, faction + ': portrait crop height');
  let portraitMatches = true;
  for (let y = 0; y < portrait.height && portraitMatches; y++) for (let x = 0; x < portrait.width && portraitMatches; x++) {
    const a = (y * portrait.width + x) * 4, b = ((y + ib.y0) * width + x + ib.x0) * 4;
    for (let channel = 0; channel < 4; channel++) if (portrait.data[a + channel] !== idle[b + channel]) { portraitMatches = false; break; }
  }
  assert(portraitMatches, faction + ': portrait does not match default standing art');
  summary.portraits++;
}
assert.notEqual(factionDigests[0], factionDigests[2], 'both factions accidentally use identical walk art');
assert.notEqual(factionDigests[1], factionDigests[3], 'both factions accidentally use identical attack art');
assert.equal(summary.frames, 112);
console.log('PASS: warrior art PNG checks ' + JSON.stringify(summary));
