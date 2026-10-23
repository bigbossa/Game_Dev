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
  // a Lv.80 item refuses basic materials and takes mid ones; a Lv.120 item takes high ones
  for (const [id, tier] of [['w8', 1], ['sh8', 2], ['w5', 0]]) {
    const { w, p } = fixture(), base = C.ITEMS[id];
    p.inv[0] = id; p.stones = 999; p.charms.guard = p.charms.luck = 9;
    Math.random = () => 0;
    if (tier) {
      enhance(w, p, 0, { guard: 1, luck: 1 });
      assert.equal(p.inv[0], id, `${id}: basic materials do not work on Lv.${base.lvl}`);
      assert.equal(p.stones, 999); assert.equal(p.charms.guard, 9);
      const sk = C.matKey('stone', tier), gk = C.matKey('guard', tier), lk = C.matKey('luck', tier);
      p.charms[sk] = 10; p.charms[gk] = 2; p.charms[lk] = 2;
      enhance(w, p, 0, { guard: 1, luck: 1 });
      assert.equal(p.inv[0], `${id}+1`, `${id}: +1 with ${C.MAT_TIERS[tier].th} materials`);
      assert.equal(p.charms[sk], 10 - C.ENHANCE.stoneCount(base, 0)); assert.equal(p.charms[gk], 1); assert.equal(p.charms[lk], 1);
      // a failed try with the tier's guard keeps the item
      Math.random = () => 0.99; enhance(w, p, 0, { guard: 1 });
      assert.equal(p.inv[0], `${id}+1`, 'guarded failure keeps the item'); assert.equal(p.charms[gk], 0);
      assert.equal(C.ENHANCE.stoneCount(base, 9), C.ENHANCE.stones[9], 'mid / high stones: 1-6 per try, no level factor');
    } else {
      enhance(w, p, 0, { guard: 1 });
      assert.equal(p.inv[0], `${id}+1`); assert.equal(p.charms.guard, 8); assert(p.stones < 999);
    }
  }
  // the wrong tier never enhances: a ticked talisman of another tier, or a request paying with another tier, is refused
  // before anything is spent, for basic, mid and high items alike
  for (const [id, tier, wrongs] of [['w5', 0, [1, 2]], ['w8', 1, [0, 2]], ['sh8', 2, [0, 1]]]) {
    const { w, p } = fixture(); p.inv[0] = id; Math.random = () => 0;
    const own = (kind) => C.matKey(kind, tier);
    if (tier) p.charms[own('stone')] = 50; else p.stones = 999;
    for (const t of [0, 1, 2]) if (t !== tier) for (const k of ['guard', 'luck']) p.charms[C.matKey(k, t)] = 5;
    const before = JSON.stringify([p.stones, p.charms, p.gold]);
    for (const use of [{ guard: 1 }, { luck: 1 }]) {
      enhance(w, p, 0, use);
      assert.equal(p.inv[0], id, `${id}: another tier's talisman must not enhance`);
    }
    for (const t of wrongs) { enhance(w, p, 0, { tier: t }); assert.equal(p.inv[0], id, `${id}: paying with tier ${t} refused`); }
    assert.equal(JSON.stringify([p.stones, p.charms, p.gold]), before, 'nothing spent on a refused try');
    enhance(w, p, 0, { tier }); assert.equal(p.inv[0], `${id}+1`, 'its own tier works');
  }
  // the shop buys and sells every material tier
  {
    const { w, p } = fixture(), gold = p.gold;
    w.nearSmith = () => true; w.nearApothecary = () => false; // standing at the blacksmith, not the apothecary
    const bought = ['stone2', 'guard2', 'luck2', 'stone3', 'guard3', 'luck3'];
    for (const k of bought) {
      w.onShop(p, { act: 'buyCharm', k, n: 1 }); assert.equal(p.charms[k], 1, `buy ${k}`);
    }
    const spent = bought.reduce((t, k) => t + C.ENH_CHARMS[k].price, 0);
    assert.equal(gold - p.gold, spent);
    w.onShop(p, { act: 'sellCharm', k: 'stone3', n: 1 }); assert.equal(p.charms.stone3, 0);
    // typed quantities: one request buys / sells many (bounded by what one can hold and the gold)
    w.onShop(p, { act: 'buyCharm', k: 'stone2', n: 250 }); assert.equal(p.charms.stone2, 251);
    w.onShop(p, { act: 'buyCharm', k: 'luck2', n: 150 }); assert.equal(p.charms.luck2, 151, 'more than the old 99 per request');
    w.onShop(p, { act: 'sellCharm', k: 'stone2', n: 51 }); assert.equal(p.charms.stone2, 200);
    w.onShop(p, { act: 'buyStone', n: 5000 }); assert.equal(p.stones, 5000);
    p.gold = C.ENH_CHARMS.guard3.price * 2 + 5; w.onShop(p, { act: 'buyCharm', k: 'guard3', n: 3 });
    assert.equal(p.charms.guard3, 1, 'not enough gold for 3: nothing bought');
  }
  console.log('PASS: enhancement material tiers (basic < Lv.60 · mid Lv.60-99 · high Lv.100+), prices, use and shop');
} finally {
  Math.random = realRandom;
}
