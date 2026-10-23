// Level boundaries, saved IDs, GM set lookup, loot availability and rolled equipment effects.
const assert = require('node:assert/strict');
const C = require('../shared/world-data');
const World = require('../server/world');
const levels = Array.from({ length: 13 }, (_, i) => (i + 1) * 10);
const w = Object.create(World.prototype);
w.toast = w.sendInv = w.emitEquip = () => {};
w.refreshStats = p => { p.stats = C.playerStats(p.cls, p.lvl, p.eq, {}); };
const drops = new Set(Object.values(C.DROPS).flatMap(d => d.items.map(([id]) => id)));
assert.deepEqual(C.WEAPONS.map(w => w.lvl), [1, ...levels]);
assert.equal(w.resolveItem('110'), 'w13');
assert.equal(C.ITEMS.w11.lvl, 120); assert.equal(C.ITEMS.w12.lvl, 130);
assert(drops.has('w13'), 'Lv.110 weapon obtainable');
for (let grade = 0; grade < C.GRADES.length; grade++) for (const plus of [0, 10]) {
  const key = C.makeKey('w13', grade, 2027, plus), it = C.ITEMS[key];
  assert(it.core.atk > C.ITEMS[C.makeKey('w10', grade, 2027, plus)].core.atk);
  assert(it.core.atk < C.ITEMS[C.makeKey('w11', grade, 2027, plus)].core.atk);
  const p = { cls: 'dualblade', lvl: 109, eq: {}, inv: [key] };
  w.onEquip(p, 0); assert.equal(p.eq.weapon, undefined);
  p.lvl = 110; w.onEquip(p, 0); assert.equal(p.eq.weapon, key);
}
assert.deepEqual(C.ARMOR_SETS.map(s => s.lvl).sort((a, b) => a - b), levels);
for (const slot of C.ARMOR_SLOTS) {
  assert.deepEqual(C.ARMORS.filter(a => a.slot === slot).map(a => a.lvl), levels);
}
let variants = 0;
for (const lvl of levels) {
  const ids = w.resolveSet(String(lvl));
  assert.equal(ids.length, 4);
  assert.deepEqual(new Set(ids.map(id => C.ITEMS[id].slot)), new Set(C.ARMOR_SLOTS));
  const tier = C.ITEMS[ids[0]].tier;
  assert.deepEqual(w.resolveSet(`tier:${tier}`), ids);
  assert.deepEqual(w.resolveSet(C.ARMOR_SETS[tier - 1].name), ids);
  assert(C.armorLookTier(tier) >= 1 && C.armorLookTier(tier) <= 9);
  for (const id of ids) {
    assert.equal(C.ITEMS[id].lvl, lvl);
    assert(drops.has(id), `${id} is obtainable`);
    for (let grade = 0; grade < C.GRADES.length; grade++) for (const plus of [0, 10]) {
      const key = C.makeKey(id, grade, 2027, plus), it = C.ITEMS[key];
      for (const stat of ['atk', 'def', 'hp', 'mp', 'speed', 'crit']) assert(Number.isFinite(it[stat]), `${key}: ${stat}`);
      assert.equal(it.grade, grade); assert.equal(it.plus || 0, plus);
      assert.equal(!!it.option, grade >= 3); assert.equal(!!it.passive, grade >= 4);
      const p = { cls: 'dualblade', lvl: lvl - 1, eq: {}, inv: [key] };
      w.onEquip(p, 0);
      assert.equal(p.inv[0], key); assert.equal(p.eq[it.slot], undefined);
      p.lvl = lvl; w.onEquip(p, 0);
      assert.equal(p.eq[it.slot], key); assert.equal(p.inv[0], null);
      if (it.option) assert(p.stats.fx[it.option[0]] > 0, `${key}: option applied`);
      if (it.passive) assert(p.stats.fx[it.passive[0]] > 0, `${key}: passive applied`);
      variants++;
    }
  }
  for (const cls of C.CLASS_IDS) {
    C.setViewClass(cls);
    for (const id of ids) assert(C.ITEMS[id].name && !C.ITEMS[id].name.includes('undefined'));
  }
}
C.setViewClass('dualblade');
// Previously saved items keep their identities, including the Lv.120/130 endgame gear.
const oldLevels = [10, 20, 30, 40, 60, 80, 100, 120, 130];
for (const prefix of ['sh', 'pa', 'br', 'sd']) oldLevels.forEach((lvl, i) => {
  const it = C.ITEMS[`${prefix}${i + 1}#5.77+10`];
  assert.equal(it.lvl, lvl); assert.equal(it.tier, i + 1);
});
for (const weapon of C.WEAPONS.filter(it => it.lvl >= 10)) {
  assert.equal(w.resolveSet(String(weapon.lvl)).length, 4, `matching set for ${weapon.id}`);
}
assert.equal(w.resolveSet('tier:14'), null);
assert.equal(w.resolveSet('140'), null);
console.log(`PASS: 13 complete armour levels, ${variants} variants/equip boundaries/effects, saved IDs, class names, GM lookup and loot availability`);
