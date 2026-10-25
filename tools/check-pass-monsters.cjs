const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const C = require('../shared/world-data');
const spec = require('../monster-art/pass-v2/SPRITES.json');
const dir = path.join(__dirname, '../public/assets/monsters');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
assert.deepEqual(spec.species.map(s => s.id), [...C.MAPS.pass.mons, C.MAPS.pass.boss]);
const reports = [];
for (const { id } of spec.species) {
  const m = index[id], p = PNG.sync.read(fs.readFileSync(path.join(dir, m.file)));
  assert.equal(m.managedBy, 'build-pass-monsters');
  assert.equal(m.cols, 8); assert.equal(m.rows, 4);
  assert.equal(m.idleRow, 1); assert.equal(m.attackRow, 3);
  assert.deepEqual(m.walkRows, [0, 1, 2, 1]);
  assert.equal(p.width, m.fw * 8); assert.equal(p.height, m.fh * 4);
  const hashes = new Set();
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    let count = 0, top = m.fh, bottom = 0;
    const buf = Buffer.alloc(m.fw * m.fh * 4);
    for (let y = 0; y < m.fh; y++) for (let x = 0; x < m.fw; x++) {
      const i = ((row * m.fh + y) * p.width + col * m.fw + x) * 4, a = p.data[i + 3];
      p.data.copy(buf, (y * m.fw + x) * 4, i, i + 4);
      if (a > 60) { count++; top = Math.min(top, y); bottom = Math.max(bottom, y); }
      if (x < 4 || y < 4 || x >= m.fw - 4 || y >= m.fh - 4) assert.equal(a, 0, `${id} clipped ${row}/${col}`);
    }
    assert(count > 3000, `${id} empty or incomplete ${row}/${col}`);
    assert(Math.abs(bottom - m.ay) < 4, `${id} unstable ground anchor ${row}/${col}`);
    if (row === 1) assert(Math.abs(bottom - top + 1 - m.contentHeight) < 4, `${id} idle scale mismatch`);
    hashes.add(crypto.createHash('sha256').update(buf).digest('hex'));
  }
  assert.equal(hashes.size, 32, `${id} repeated poses`);
  const version = crypto.createHash('sha256').update(p.data).digest('hex').slice(0, 12);
  assert.equal(version, m.version, `${id} stale cache version`);
  reports.push({ id, frames: 32, transparentBorders: true, stableAnchors: true });
}
assert.equal(index.kingboar.managedBy, 'build-kingboar');
console.log(JSON.stringify({ species: reports, totalFrames: 224, bossPreserved: true }, null, 2));
