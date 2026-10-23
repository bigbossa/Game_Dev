// Gear gate table (world-data.js GATE): a level-L player in different gear tiers against a same-level normal monster
// (base formula with MON_TOUGH and the gate, no per-monster multipliers). Basic attacks only, so the numbers compare
// gear tiers / levels; real play with skills is faster.
//   node tools/gear-gate.cjs            table for every class
//   cells: seconds to kill one monster / share of max HP lost per kill
const C = require('../shared/world-data');
const GEARS = [['Normal+0', 0, 0], ['Epic+0', 2, 0], ['Epic+5', 2, 5], ['Mythic+0', 5, 0], ['Mythic+5', 5, 5], ['Mythic+10', 5, 10]];
const SEEDS = [11, 222, 3333, 4444, 5555, 6666];
const MON_CD = 1300;   // a typical monster attack interval (MON_ART cd)
function gearOf(L, grade, plus, seed) {
  const best = (list) => list.filter((it) => it.lvl <= L).at(-1), eq = {};
  for (const b of [best(C.WEAPONS), ...C.ARMOR_SLOTS.map((s) => best(C.ARMORS.filter((a) => a.slot === s)))]) {
    eq[b.slot] = (grade ? `${b.id}#${grade}.${seed}` : b.id) + (plus ? `+${plus}` : '');
  }
  return eq;
}
const monsterAt = (L) => C.monStats(L, false);   // the live formula (gate + early-level ease), same level: no level gap
// { ttk: seconds, hit: one monster hit / max HP, loss: max HP lost per kill }
function fight(cls, L, grade, plus) {
  const m = monsterAt(L), alloc = C.guidePoints(cls, {}, L, Infinity);
  let ttk = 0, hit = 0;
  for (const seed of SEEDS) {
    const s = C.playerStats(cls, L, gearOf(L, grade, plus, seed), alloc);
    const cp = C.roleOf(cls).critPower + (s.fx.critDmg || 0), c = Math.min(0.75, s.crit);
    const dmg = (raw) => Math.max(raw * C.DMG_FLOOR, raw - m.def * 0.6);
    const avg = ((1 - c) * dmg(s.atk) + c * dmg(s.atk * cp)) * (1 + (s.fx.pve || 0)) * s.pveMult;
    ttk += (m.hp / avg) * C.basicCd(C.basicOf(cls), s.aspd) / 1000;
    hit += Math.max(m.atk * C.DMG_FLOOR, m.atk - s.def * 0.6) * (1 - (s.fx.guard || 0)) / s.maxHp;
  }
  ttk /= SEEDS.length; hit /= SEEDS.length;
  return { ttk, hit, loss: (ttk / (MON_CD / 1000)) * hit };
}
module.exports = { fight, GEARS };
if (require.main === module) {
  console.log(`gear gate from Lv.${C.MON_GATE.from}: reference Epic +${C.MON_GATE.plus.join('→+')} · def ${C.MON_GATE.def.join('→')} of the weakest class ATK · hit ${C.MON_GATE.hit.join('→')} of max HP`);
  console.log('cells: seconds to kill one same-level monster (basic attacks) / max HP lost per kill');
  for (const cls of C.CLASS_IDS) {
    console.log(`\n${C.CLASSES[cls].name} (${cls})`.padEnd(14) + GEARS.map((g) => g[0].padStart(13)).join(''));
    for (const L of [59, 60, 70, 80, 90, 100, 110, 120, 130]) {
      console.log(`  Lv.${L}`.padEnd(13) + GEARS.map(([, g, p]) => { const r = fight(cls, L, g, p); return `${r.ttk.toFixed(1)}s/${Math.round(r.loss * 100)}%`.padStart(13); }).join(''));
    }
  }
}
