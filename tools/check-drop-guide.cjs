// The world map drop guide (C.dropGuide / C.gradeChances) must show what the server really rolls.
// Kills every monster type many times through World.rollLoot and compares, per monster:
//   - how often each guide row (a weapon, or the 4 pieces of a set) drops      vs  row.chance
//   - how often a dropped item is Unique / Legendary / Mythic                   vs  the guide's grade odds
// Run after changing any drop %:  npm run check:drops
const assert = require('node:assert/strict');
const C = require('../shared/world-data'), World = require('../server/world');
const KILLS = Number(process.argv[2]) || 6000;
// allowed gap: 4.5 standard deviations of the sample plus a little rounding room
const near = (seen, p, n) => Math.abs(seen / n - p) <= 4.5 * Math.sqrt(Math.max(p * (1 - p), 1e-6) / n) + 0.002;
const w = Object.create(World.prototype);
w.systemChat = () => {}; w.toast = () => {}; w.sendInv = () => {};
let checked = 0;
for (const type of Object.keys(C.DROPS)) {
  const guide = C.dropGuide(type);
  if (!guide) continue;
  const rowOf = new Map();
  for (const r of guide.items) for (const id of r.ids) rowOf.set(id, r);
  const seen = new Map(guide.items.map((r) => [r, 0]));
  const grades = [0, 0, 0, 0, 0, 0], expect = [0, 0, 0, 0, 0, 0];
  let items = 0;
  for (let i = 0; i < KILLS; i++) {
    let got = null;
    const p = { gold: 0, stats: { fx: {} }, autoSell: [], inv: [null], socket: { emit: (ev, d) => { if (ev === 'loot') got = d.item; } } };
    w.rollLoot(p, type);
    if (!got) continue;
    const it = C.ITEMS[got], r = rowOf.get(C.parseId(got).id);
    assert(r, `${type}: dropped ${got}, which the guide does not list`);
    seen.set(r, seen.get(r) + 1); grades[it.grade || 0]++; items++;
  }
  for (const r of guide.items) {
    assert(near(seen.get(r), r.chance, KILLS), `${guide.name}: Lv.${r.lvl} ${r.kind} drops ${(seen.get(r) / KILLS * 100).toFixed(2)}% but the guide says ${(r.chance * 100).toFixed(2)}%`);
    const g = C.gradeChances(guide.lvl, r.lvl, guide.boss);
    g.forEach((v, k) => { expect[k] += v * r.chance; });
  }
  const sum = expect.reduce((a, b) => a + b, 0);
  for (let k = 3; k < 6; k++) assert(near(grades[k], expect[k] / sum, items), `${guide.name}: ${C.GRADES[k].name} ${(grades[k] / items * 100).toFixed(2)}% vs expected ${(expect[k] / sum * 100).toFixed(2)}%`);
  if (guide.boss) assert.equal(grades[0] + grades[1] + grades[2], 0, `${guide.name}: a boss item below Unique`);
  // the guide's per-monster grade line is the odds of an item at the monster's own level
  assert.deepEqual(guide.high, C.gradeChances(guide.lvl, guide.lvl, guide.boss).slice(3));
  checked++;
}
console.log(`PASS: drop guide matches World.rollLoot for ${checked} monster types (${KILLS} kills each): item rows and Unique/Legendary/Mythic odds`);
