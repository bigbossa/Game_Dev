// Enhancement materials by item level (C.MAT_TIERS): basic < Lv.60, mid Lv.60-99, high Lv.100+. Each item takes
// only its own tier of stones / talismans; buying and selling every material works. World prototype only.
const assert = require('node:assert/strict');
const C = require('../shared/world-data');
const World = require('../server/world');
const realRandom = Math.random;
function fixture() {
  const w = Object.create(World.prototype);
  w.players = new Map(); w.toasts = [];
  w.emitNear = () => {}; w.emitEquip = () => {}; w.sendInv = () => {}; w.save = () => {}; w.systemChat = () => {};
  w.toast = (p, t) => w.toasts.push(t);
  const p = { id: 'p', name: 'p', lvl: 130, cls: 'dualblade', gold: 1e9, stones: 0, charms: C.cleanCharms({}),
    inv: Array(C.BAG_SIZE).fill(null), eq: { weapon: 'w0' }, mapId: 'village', x: 0, y: 0 };
  p.stats = C.playerStats(p.cls, p.lvl, p.eq, {});
  return { w, p };
}
const enhance = (w, p, idx, use = {}) => w.enhance(p, { where: 'inv', idx, ...use });
try {
  assert.equal(C.matTier(59), 0); assert.equal(C.matTier(60), 1); assert.equal(C.matTier(99), 1); assert.equal(C.matTier(100), 2);
  for (const [k, min] of [['stone2', 10000], ['stone3', 100000], ['guard2', 100000], ['luck2', 100000], ['guard3', 1e6], ['luck3', 1e6]])
    assert(C.ENH_CHARMS[k].price >= min, `${k} price`);
  // luck talismans: +10% up to +8, little at the last two steps
  assert.equal(C.ENHANCE.rateWith(7, true), C.ENHANCE.rate[7] + 0.1);
  assert(C.ENHANCE.rateWith(8, true) <= 0.12 && C.ENHANCE.rateWith(9, true) <= 0.05, '+9 / +10 barely helped by luck');
  assert.equal(C.ENH_CHARMS.stone2.price, 10000); assert.equal(C.ENH_CHARMS.stone3.price, 100000);
  // ร้านตีบวก: one gold price per attempt (C.ENHANCE.quote). A Lv.80 item never touches basic materials: with none of
  // its own tier owned, the stones and ticked talismans are bought in the same payment; owned ones are used first.
  for (const [id, tier] of [['w8', 1], ['sh8', 2], ['w5', 0]]) {
    const { w, p } = fixture(), base = C.ITEMS[id];
    p.inv[0] = id; Math.random = () => 0;
    const sk = C.matKey('stone', tier), gk = C.matKey('guard', tier), lk = C.matKey('luck', tier);
    if (tier) { p.stones = 999; p.charms.guard = p.charms.luck = 9; }
    let gold = p.gold, q = C.ENHANCE.quote(p, base, 0, { guard: 1, luck: 1, item: base });
    assert.equal(q.total, C.ENHANCE.cost(base, 0) + q.guardPrice + q.luckPrice, id + ': work (stones included) + both talismans in one price');
    assert(q.guardPrice > 0 && q.luckPrice > 0 && q.stoneOff === 0);
    enhance(w, p, 0, { guard: 1, luck: 1 });
    assert.equal(p.inv[0], `${id}+1`, `${id}: enhanced without owning any materials`);
    assert.equal(gold - p.gold, q.total, 'charged exactly the quoted price, once');
    if (tier) { assert.equal(p.stones, 999); assert.equal(p.charms.guard, 9, 'other tiers untouched'); }
    // owned materials of its own tier are used first: the stones' share comes off the price, owned talismans cost nothing
    if (tier) p.charms[sk] = 10; else p.stones = 999;
    p.charms[gk] = 2; p.charms[lk] = 2;
    gold = p.gold; enhance(w, p, 0, { guard: 1, luck: 1 });
    assert.equal(p.inv[0], `${id}+2`);
    assert.equal(gold - p.gold, C.ENHANCE.cost(base, 1) - Math.round(C.ENHANCE.cost(base, 1) * C.ENHANCE.STONE_SHARE / 10) * 10, 'own stones take their share off');
    assert.equal(C.matHave(p, 'stone', tier), (tier ? 10 : 999) - C.ENHANCE.stoneCount(base, 1));
    assert.equal(p.charms[gk], 1); assert.equal(p.charms[lk], 1);
    // a failed try with the guard ticked keeps the item (talisman bought on the spot once none are left)
    p.charms[gk] = 0; Math.random = () => 0.99; gold = p.gold;
    enhance(w, p, 0, { guard: 1 });
    assert.equal(p.inv[0], `${id}+2`, 'guarded failure keeps the item');
    assert.equal(gold - p.gold, C.ENHANCE.quote({ ...p, charms: { ...p.charms } }, base, 2, { guard: 1, item: C.ITEMS[`${id}+2`] }).total);
  }
  // refused before anything is spent: a request paying with another tier, a price above the one shown, too little gold
  for (const [id, tier, wrongs] of [['w5', 0, [1, 2]], ['w8', 1, [0, 2]], ['sh8', 2, [0, 1]]]) {
    const { w, p } = fixture(); p.inv[0] = id; Math.random = () => 0;
    const before = () => JSON.stringify([p.stones, p.charms, p.gold, p.inv[0]]), was = before();
    for (const t of wrongs) enhance(w, p, 0, { tier: t });
    const q = C.ENHANCE.quote(p, C.ITEMS[id], 0, { guard: 1, item: C.ITEMS[id] });
    enhance(w, p, 0, { guard: 1, total: q.total - 1 });
    assert.equal(before(), was, 'nothing spent on a refused try');
    p.gold = q.total - 1; enhance(w, p, 0, { guard: 1 }); assert.equal(p.inv[0], id, 'not enough gold');
    p.gold = q.total; enhance(w, p, 0, { guard: 1, tier, total: q.total });
    assert.equal(p.inv[0], `${id}+1`); assert.equal(p.gold, 0, 'the whole price, nothing more');
  }
  // enhancing / rerolling happens at the ร้านตีบวก only
  {
    const { w, p } = fixture(); p.inv[0] = 'w5'; Math.random = () => 0;
    w.nearSmith = () => true; w.nearApothecary = () => false; w.nearEnhancer = () => false;
    w.onShop(p, { act: 'enhance', where: 'inv', idx: 0, key: 'w5' }); assert.equal(p.inv[0], 'w5', 'not at the blacksmith');
    w.nearSmith = () => false; w.nearEnhancer = () => true;
    w.onShop(p, { act: 'enhance', where: 'inv', idx: 0, key: 'w5' }); assert.equal(p.inv[0], 'w5+1', 'at the enhancement shop');
  }
  // the material shop
  {
    const { w, p } = fixture();
    let gold = p.gold;
    w.nearSmith = () => true; w.nearApothecary = () => false; w.nearEnhancer = () => false; // standing at the blacksmith
    // enhancement stones / talismans are part of the ร้านตีบวก price: the blacksmith only buys them back
    for (const k of ['stone2', 'guard2', 'luck2', 'stone3', 'guard3', 'luck3', 'guard', 'luck']) {
      w.onShop(p, { act: 'buyCharm', k, n: 1 }); assert.equal(p.charms[k], 0, `${k} is no longer sold`);
    }
    w.onShop(p, { act: 'buyStone', n: 10 }); assert.equal(p.stones, 0, 'basic stones are no longer sold');
    assert.equal(p.gold, gold, 'nothing charged');
    p.charms.stone3 = 3; p.stones = 20;
    w.onShop(p, { act: 'sellCharm', k: 'stone3', n: 1 }); assert.equal(p.charms.stone3, 2, 'old stock sells back');
    w.onShop(p, { act: 'sellStone', n: 10 }); assert.equal(p.stones, 10);
    // reroll stones are not sold any more either (paid at the ร้านตีบวก)
    for (const k of ['reaffix', 'reaffix2', 'repassive3']) { w.onShop(p, { act: 'buyCharm', k, n: 1 }); assert.equal(p.charms[k], 0, `${k} is no longer sold`); }
  }
  // สุ่มออฟชั่นใหม่ at the ร้านตีบวก: an owned stone of the item's tier first, otherwise its price in gold
  {
    const { w, p } = fixture(); w.nearEnhancer = () => true; w.nearSmith = w.nearApothecary = () => false;
    p.inv[0] = C.gradeId('w8', 2);
    const base = C.ITEMS.w8, cost = C.ENHANCE.rerollPrice(base, 'affix');
    assert(cost < C.ENH_CHARMS.reaffix2.price, 'cheaper than the old fixed stone');
    let gold = p.gold, key = p.inv[0];
    w.onShop(p, { act: 'reroll', where: 'inv', idx: 0, key, kind: 'affix' });
    assert.notEqual(p.inv[0], key, 'rerolled'); assert.equal(gold - p.gold, cost, 'paid in gold');
    p.charms.reaffix2 = 1; gold = p.gold; key = p.inv[0];
    w.onShop(p, { act: 'reroll', where: 'inv', idx: 0, key, kind: 'affix' });
    assert.equal(p.charms.reaffix2, 0); assert.equal(p.gold, gold, 'owned stone used, no gold');
    p.gold = cost - 1; key = p.inv[0];
    w.onShop(p, { act: 'reroll', where: 'inv', idx: 0, key, kind: 'affix' });
    assert.equal(p.inv[0], key, 'not enough gold: nothing rerolled');
  }
  console.log('PASS: enhancement shop one-price attempts (work + talismans priced by the item, own materials first, own tier only), refusals, shop gating, material shop sells back only');
} finally {
  Math.random = realRandom;
}
