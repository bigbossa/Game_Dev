// Deterministic authoritative combat tests. No World constructor, account store, ports or real timers.
const assert = require('node:assert/strict');
const C = require('../shared/world-data');
const World = require('../server/world');
let now = 100000, serial = 0;
const realNow = Date.now, realRandom = Math.random;
Date.now = () => now;
Math.random = () => 0.5;
const rows = [];
function fixture(pvp = false) {
  const w = Object.create(World.prototype);
  w.players = new Map(); w.parties = new Map(); w.timers = []; w.events = [];
  w.fund = { until: 0 }; // No active donation EXP bonus in combat fixtures.
  w.maps = { arena: { def: { pvp, gates: [], camp: { x0: 0, y0: 0, x1: 4, y1: 4 } },
    map: { w: 200, h: 200, solid: new Uint8Array(40000) }, monsters: [] } };
  w.emitNear = (...args) => w.events.push(args);
  // Lethal-hit bookkeeping is outside these combat tests.
  w.killMonster = w.killPlayer = (t) => { t.dead = true; };
  return w;
}
function player(w, cls, lvl = 130, faction = 'dharma') {
  const stats = C.playerStats(cls, lvl, {}, {});
  const p = { id: `p${++serial}`, cls, lvl, faction, stats, x: 2000, y: 2000, dir: 0, mapId: 'arena',
    hp: stats.maxHp, mp: stats.maxMp, exp: 0, kills: 0, deaths: 0, alloc: {}, eq: {},
    cds: {}, dots: [], pot: {}, buffs: {}, lockUntil: 0, actUntil: 0, lastInput: now, moving: false,
    skl: C.cleanSkills(cls, null, lvl), messages: [] };
  p.socket = { emit: (ev, data) => p.messages.push({ ev, data }) };
  w.players.set(p.id, p);
  return p;
}
function monster(w, boss = false) {
  const m = { id: `m${++serial}`, x: 2080, y: 2000, mapId: 'arena', hp: 1e8, dots: [],
    def: { atk: 100, def: 10, radius: 20, boss, speed: 100, atkRange: 50, atkCd: 1000, aggro: 200 },
    threat: new Map(), target: null, hx: 2080, hy: 2000, nextAtk: 0 };
  w.maps.arena.monsters.push(m);
  return m;
}
function flush(w) {
  let guard = 0;
  while (w.timers.length) {
    assert(++guard < 1000, 'scheduled effects must terminate');
    w.timers.sort((a, b) => a.at - b.at);
    const t = w.timers.shift(); now = Math.max(now, t.at); t.fn();
  }
}
function ready(p) { p.cds = {}; p.gcd = p.lockUntil = 0; p.mp = p.stats.maxMp; }
try {
  // Role ordering and actual basic attack damage on the same target, with the same starter weapon.
  for (const lvl of [1, 10, 30, 60, 100, 130]) {
    const stats = Object.fromEntries(C.CLASS_IDS.map(cls => [cls, C.playerStats(cls, lvl, {}, {})]));
    assert(stats.taoist.maxHp > stats.dualblade.maxHp && stats.dualblade.maxHp > stats.archer.maxHp);
    assert(stats.taoist.def > stats.dualblade.def && stats.dualblade.def > stats.archer.def);
    const dps = {};
    for (const faction of ['dharma', 'adharma']) for (const cls of C.CLASS_IDS) {
      const w = fixture(), p = player(w, cls, lvl, faction), m = monster(w), sk = C.basicOf(cls);
      w.taoistSolo = () => false;   // base role order (party context); the solo farming buff is checked below
      const startHp = m.hp;
      for (let i = 0; i < 30; i++) {
        ready(p); w.castSkill(p, { id: sk.id, a: 0, tid: m.id }); flush(w);
      }
      const cd = C.basicCd(sk, p.stats.aspd);
      const damage = startHp - m.hp;
      assert(damage > 0);
      const rate = Math.round(damage / (30 * cd / 1000));
      if (faction === 'dharma') dps[cls] = rate;
      else assert.equal(rate, dps[cls], 'factions must have equal gameplay stats');
      rows.push({ lvl, faction, cls, hp: p.stats.maxHp, def: p.stats.def, basicCd: cd, basicDps: rate });
    }
    assert(dps.dualblade > dps.archer && dps.archer > dps.taoist, `basic DPS role order at ${lvl}`);
  }

  // Equal level-appropriate gear and legal stat allocation preserve role differences.
  for (const lvl of [30, 60, 100, 130]) {
    const eq = { weapon: C.WEAPONS.filter(w => w.lvl <= lvl).at(-1).id };
    for (const slot of C.ARMOR_SLOTS) eq[slot] = C.ARMORS.filter(a => a.slot === slot && a.lvl <= lvl).at(-1).id;
    const remaining = C.statPtsTotal(lvl) - 50;
    const alloc = C.cleanAlloc({ aspd: 30, crit: 20, hp: Math.floor(remaining / 2), atk: Math.ceil(remaining / 2) }, lvl);
    const s = Object.fromEntries(C.CLASS_IDS.map(cls => [cls, C.playerStats(cls, lvl, eq, alloc)]));
    assert(s.taoist.maxHp > s.dualblade.maxHp && s.dualblade.maxHp > s.archer.maxHp);
    assert(s.dualblade.atk > s.archer.atk && s.archer.atk > s.taoist.atk);
    assert.equal(s.dualblade.aspd, 0.57); assert.equal(s.archer.aspd, 0.45);
    for (const stats of Object.values(s)) assert(stats.crit <= 0.75 && stats.crit >= 0);
  }
  // The evolved melee combo finishes on hit three, and crits use the class multiplier.
  {
    const w = fixture(), p = player(w, 'dualblade'), m = monster(w), hits = [];
    for (let i = 0; i < 3; i++) {
      ready(p); const hp = m.hp; w.castSkill(p, { id: 'fang', a: 0, tid: m.id }); hits.push(hp - m.hp);
    }
    assert.equal(hits[0], hits[1]); assert(hits[2] > hits[1] * 1.4);
    p.stats.atk = 100; m.def.def = 0;
    Math.random = () => 0;
    assert.equal(w.applyDamage(p, m, 1), 158);
    Math.random = () => 0.5;
  }
  // Dodge cancels damage and on-hit states; accuracy counters it. DoTs/procs cannot be dodged.
  {
    const w = fixture(true), a = player(w, 'archer'), t = player(w, 'dualblade', 130, 'adharma'), m = monster(w);
    Math.random = () => 0.1;
    const hp = t.hp;
    assert.equal(w.applyDamage(m, t, 1, { stun: 3000 }), 0);
    assert.equal(t.hp, hp); assert(!t.stunUntil);
    assert(w.events.some(e => e[3] === 'evade'));
    assert(w.applyDamage(a, t, 1) > 0, 'archer accuracy counters 12 percentage points of evasion');
    Math.random = () => 0;
    assert(w.applyDamage(m, t, 1, { dot: true, flat: 5 }) > 0);
    assert(w.applyDamage(m, t, 1, { proc: true }) > 0);
    t.stunUntil = now + 100;
    assert(w.applyDamage(m, t, 1) > 0, 'stunned targets cannot dodge');
    Math.random = () => 0.5;
  }
  // PvP limits, resistance, immunity, movement and casting restrictions.
  {
    const w = fixture(true), a = player(w, 'archer'), t = player(w, 'taoist', 130, 'adharma');
    w.applyDamage(a, t, 1, { stun: 3000 });
    assert.equal(t.stunUntil - now, 1050);
    const end = t.stunUntil;
    now += 500; w.applyDamage(a, t, 1, { stun: 3000 });
    assert.equal(t.stunUntil, end, 'repeat hits must not extend stun');
    const mp = t.mp;
    w.castSkill(t, { id: 'mercy' }); assert.equal(t.mp, mp);
    const x = t.x;
    w.onInput(t, { x: x + 10, y: t.y }); assert.equal(t.x, x);
    now = end + 100; w.applyDamage(a, t, 1, { root: 3000 }); assert(!t.rootUntil);
    now = end + 1201; w.applyDamage(a, t, 1, { root: 3000 }); assert.equal(t.rootUntil - now, 1400);
    w.applyDamage(a, t, 1, { slow: 5000 }); assert.equal(t.slowUntil - now, 1750);
    w.castSkill(t, { id: 'jade', a: 0, tid: a.id }); assert(t.cds.jade > now, 'root permits attacks');
    w.clearControl(t);
    assert.equal(C.combatMoveScale(t.cls, false, t, now), 1);
    for (const cls of C.CLASS_IDS) {
      const p = player(w, cls);
      p.lastInput = now - 50; p.actUntil = now + 100; p.slowUntil = now + 500;
      const step = p.stats.speed * C.combatMoveScale(cls, true, p, now) * 0.05;
      w.onInput(p, { x: p.x + step, y: p.y, moving: true });
      assert.equal(p.x, 2000 + step, 'matching predicted movement is accepted');
      w.onInput(p, { x: p.x + 500, y: p.y, moving: true });
      assert.equal(p.x, 2000 + step, 'teleport input is rejected');
    }
  }
  // Friendly fire, non-PvP maps and bases must reject both damage and control.
  {
    const w = fixture(true), a = player(w, 'taoist'), t = player(w, 'archer');
    assert.equal(w.applyDamage(a, t, 10, { stun: 3000 }), 0); assert(!t.stunUntil);
    t.faction = 'adharma'; w.maps.arena.def.pvp = false;
    assert.equal(w.applyDamage(a, t, 10, { root: 3000 }), 0); assert(!t.rootUntil);
    w.maps.arena.def.pvp = true;
    Object.assign(t, C.spawnPoint('adharma'));
    assert.equal(w.applyDamage(a, t, 10, { slow: 3000 }), 0); assert(!t.slowUntil);
  }
  // Rooted monsters can attack at melee range; bosses only slow down.
  {
    const w = fixture(true), p = player(w, 'archer'), m = monster(w), boss = monster(w, true);
    w.applyDamage(p, m, 1, { root: 3000 }); assert.equal(m.rootUntil, now + 3000); assert(!m.stunUntil);
    m.x = p.x + 25; m.hx = m.x;
    w.updateMonster(m, 0.05, now);
    assert.equal(m.x, p.x + 25); assert(w.timers.length > 0, 'root must not silence monster attacks');
    w.applyDamage(p, boss, 1, { stun: 3000, root: 3000 });
    assert(!boss.stunUntil && !boss.rootUntil); assert.equal(boss.slowUntil, now + 3000);
  }
  // Party heal/cleanse, stronger ally heal, aegis strength, duration and cooldown.
  {
    const w = fixture(true), p = player(w, 'taoist'), ally = player(w, 'taoist'), stranger = player(w, 'taoist'),
      enemy = player(w, 'taoist', 130, 'adharma'), far = player(w, 'taoist');
    far.x += 600;
    p.party = 'party'; w.parties.set('party', { members: [p.id, ally.id, enemy.id, far.id], rules: { ...C.PARTY_DEFAULT } });
    for (const q of w.players.values()) { q.hp = 1; q.rootUntil = q.slowUntil = now + 1000; }
    w.castSkill(p, { id: 'mercy' });
    assert(ally.hp > p.hp && p.hp > 1); assert.equal(stranger.hp, 1); assert.equal(enemy.hp, 1); assert.equal(far.hp, 1);
    assert.equal(ally.rootUntil, 0); assert.equal(ally.slowUntil, 0); assert(enemy.rootUntil > now);
    const hp = p.hp, mp = p.mp;
    w.castSkill(p, { id: 'mercy' }); assert.equal(p.hp, hp); assert.equal(p.mp, mp);
    assert.equal(p.cds.mercy - now, C.ALL_SKILLS.mercy.cd);
    flush(w); ready(p);
    w.castSkill(p, { id: 'aegis' });
    const aegis = p.buffs.aegis;
    assert(aegis.guard >= 0.35 && aegis.guard <= 0.4); assert.equal(aegis.until - now, 10000);
    assert.equal(ally.buffs.aegis.guard, aegis.guard); assert(!enemy.buffs.aegis && !stranger.buffs.aegis);
    const originalEnd = ally.buffs.aegis.until, originalK = ally.buffs.aegis.guard;
    ready(p); p.skl.ev.aegis = 0; now += 1000; w.castSkill(p, { id: 'aegis' });
    assert.equal(ally.buffs.aegis.until, originalEnd); assert.equal(ally.buffs.aegis.guard, originalK);
    const m = monster(w);
    m.def.atk = 1000;
    const guarded = w.applyDamage(m, ally, 1);
    ally.buffs = {};
    assert(w.applyDamage(m, ally, 1) > guarded, 'aegis reduces real incoming damage');
    // ยันต์ปลุกเทพยุทธ์: the party deals more damage; enemies and strangers do not get it
    ready(p); w.castSkill(p, { id: 'might' });
    assert(ally.buffs.might.dmg >= 0.25 && !stranger.buffs.might && !enemy.buffs.might);
    const t = monster(w); t.def.def = 0;
    const strong = w.applyDamage(ally, t, 1);
    ally.buffs = {};
    assert(strong > w.applyDamage(ally, t, 1), 'might raises real outgoing damage');
    // พรสวรรค์ชุบชีวา: heals, washes off a stun and gives the evolved guard
    for (const q of [p, ally]) { q.hp = 1; q.stunUntil = now + 1000; }
    p.stunUntil = 0; ready(p); w.castSkill(p, { id: 'nirvana' });
    assert(ally.hp > 1 && ally.stunUntil === 0 && ally.buffs.nirvana.guard === 0.4);
    flush(w);
  }
  // Healing cooldowns gate repeat casts after the old cooldown, including evolved skills and gear reduction.
  for (const faction of ['dharma', 'adharma']) for (const evolved of [false, true]) for (const swift of [0, 0.1]) {
    for (const [id, oldCd] of [['mercy', 10000], ['nirvana', 30000]]) {
      const baseCd = C.ALL_SKILLS[id].cd;
      const w = fixture(), p = player(w, 'taoist', 130, faction);
      p.skl.sk[id] = 1; p.skl.ev[id] = evolved ? C.skillRank(C.ALL_SKILLS[id], p.lvl) : 0;
      p.stats.fx.swift = swift; p.stats.procs = { swift: swift ? 1 : 0 };   // force the passive to fire
      const start = now, expected = Math.round(baseCd * (1 - swift));
      w.castSkill(p, { id });
      assert.equal(p.cds[id], start + expected);
      assert.equal(p.messages.filter(m => m.ev === 'cast').at(-1).data.cd, expected, 'client receives actual cooldown');
      flush(w);
      now = start + oldCd;
      p.hp = 1;
      const mp = p.mp, casts = p.messages.filter(m => m.ev === 'cast').length;
      w.castSkill(p, { id });
      assert.equal(p.hp, 1); assert.equal(p.mp, mp);
      assert.equal(p.messages.filter(m => m.ev === 'cast').length, casts, 'old cooldown must not allow a recast');
      now = start + expected;
      w.castSkill(p, { id });
      assert(p.hp > 1); assert.equal(p.mp, mp - C.skillMp(C.ALL_SKILLS[id], p.lvl));
      assert.equal(p.messages.filter(m => m.ev === 'cast').length, casts + 1, 'recast succeeds when cooldown expires');
      flush(w);
    }
  }
  // Archer self buffs: attack speed shortens the real basic cooldown, the crit buff makes deadeye a sure crit.
  {
    const w = fixture(), p = player(w, 'archer'), m = monster(w);
    ready(p); w.castSkill(p, { id: 'hawkshot', a: 0, tid: m.id });
    const plain = p.cds.hawkshot - now;
    ready(p); w.castSkill(p, { id: 'gale' });
    assert(p.buffs.gale.aspd >= 0.5);
    ready(p); w.castSkill(p, { id: 'hawkshot', a: 0, tid: m.id });
    assert(p.cds.hawkshot - now < plain * 0.75, 'gale speeds up the basic attack');
    flush(w);
    const hp = m.hp; ready(p); w.castSkill(p, { id: 'hawkshot', a: 0, tid: m.id }); flush(w);
    assert(hp - m.hp > 0);
    ready(p); w.castSkill(p, { id: 'hawkeye' });
    assert(p.buffs.hawkeye.crit >= 0.25 && w.critOf(p) <= 0.85);
    w.events.length = 0; ready(p); w.castSkill(p, { id: 'deadeye', a: 0, tid: m.id }); flush(w);
    assert(w.events.some(e => e[3] === 'hit' && e[4].id === m.id && e[4].c === 1), 'hawkeye makes deadeye crit');
    now += 13000;
    assert.equal(w.buffVal(p, 'crit'), 0, 'buffs expire'); assert.deepEqual(w.buffList(p), []);
  }
  // ฉีกเกราะกากบาท: broken armour lets the next hits through harder; a weaker break does not replace a stronger one.
  {
    const w = fixture(), p = player(w, 'dualblade'), m = monster(w);
    m.def.def = 400;
    const before = w.applyDamage(p, m, 1);
    ready(p); w.castSkill(p, { id: 'rend', a: 0 }); flush(w);
    assert.equal(m.breakK, 0.35);
    assert(w.applyDamage(p, m, 1) > before, 'armour break lowers defence');
    w.applyDamage(p, m, 1, { armorBreak: 0.1 }); assert.equal(m.breakK, 0.35);
  }
  // Party EXP: members near the kill pool it with the party bonus (C.partyExpBonus: 2 players +25%, then +2% each); far members get nothing.
  {
    const w = fixture(), solo = player(w, 'archer', 50), m = monster(w);
    m.def = { ...m.def, exp: 1000, lvl: 50 }; m.mapId = 'arena';
    w.shareExp(solo, m); assert.equal(solo.exp, 1000);
    const team = [0, 1, 2, 3].map(() => player(w, 'dualblade', 50)), far = player(w, 'taoist', 50);
    far.x += 5000;
    w.parties.set('pt', { members: [...team, far].map((q) => q.id), rules: { ...C.PARTY_DEFAULT } }); for (const q of [...team, far]) q.party = 'pt';
    w.shareExp(team[0], m);
    assert.equal(C.partyExpBonus(4), 0.29);
    for (const q of team) assert.equal(q.exp, Math.round(1000 * (1 + C.partyExpBonus(4)) / 4));
    assert.equal(far.exp, 0);
    assert.equal(w.meLite(team[0]).pexp, Math.round(C.partyExpBonus(4) * 100));
  }
  // Party loot: round-robin turn in fixed party-roster order (predictable, not random, not damage-weighted).
  // The sequence length is the FULL roster, not whoever's "near" this particular kill, so members drifting in
  // and out of range (kiting, lagging behind) don't desync everyone else's turn the way a near-only sequence did.
  {
    const w = fixture(), m = monster(w);
    const team = ['A', 'B', 'C', 'D'].map(() => player(w, 'dualblade', 50));
    for (const q of team) { q.inv = new Array(40).fill(null); q.autoSell = []; }
    const pt = { members: team.map((q) => q.id), rules: { ...C.PARTY_DEFAULT } };
    w.parties.set('pt', pt); for (const q of team) q.party = 'pt';
    C.MONSTERS[m.type = 'wolf'] = C.MONSTERS.wolf || { hp: 1, lvl: 1 };
    C.DROPS.wolf = { gold: [0, 0], items: [['w1', 1]], pickOne: true };
    for (let i = 0; i < 80; i++) {
      // non-synchronized absences (different members away at different, coprime-ish intervals), like real play
      const away = new Set([i % 5 === 0 && team[3], i % 7 === 0 && team[1], i % 11 === 0 && team[0]].filter(Boolean));
      const near = team.filter((q) => !away.has(q));
      w.rollLoot(near[0], 'wolf', { recipients: near });
    }
    const got = team.map((q) => q.inv.filter((x) => x).length);
    assert(got.every((n) => n > 0), `every member must receive some items over time, not get shut out (${got})`);
    assert(Math.max(...got) - Math.min(...got) <= got.reduce((a, b) => a + b) * 0.3, `receipts should stay reasonably close (${got})`);
  }
  // นักพรต farming alone hits monsters harder and takes less (C.TAOIST_SOLO); off with a party member near, never in PvP.
  {
    const w = fixture(true), t = player(w, 'taoist', 60), m = monster(w);
    const soloOut = w.applyDamage(t, m, 1); t.hp = t.stats.maxHp; const soloIn = w.applyDamage(m, t, 1);
    const ally = player(w, 'dualblade', 60);
    w.parties.set('pt', { members: [t.id, ally.id], rules: { ...C.PARTY_DEFAULT } }); t.party = ally.party = 'pt';
    const ptOut = w.applyDamage(t, m, 1); t.hp = t.stats.maxHp; const ptIn = w.applyDamage(m, t, 1);
    assert(soloOut > ptOut * 1.3 && soloIn < ptIn * 0.9, `solo taoist ${soloOut}/${soloIn} vs party ${ptOut}/${ptIn}`);
    ally.x += 5000; assert.equal(w.applyDamage(t, m, 1), soloOut, 'party member out of range = solo again');
    const foe = player(w, 'archer', 60, 'adharma'), solo = w.applyDamage(t, foe, 1);
    w.taoistSolo = () => false; foe.hp = foe.stats.maxHp;
    assert.equal(w.applyDamage(t, foe, 1), solo, 'no solo bonus in PvP');
  }
  // Root blocks escape skills; a stun interrupts a leap before its delayed landing.
  {
    const w = fixture(true), p = player(w, 'dualblade');
    p.rootUntil = now + 1000; const mp = p.mp;
    for (const id of C.MOVE_SKILLS.filter(id => C.ALL_SKILLS[id].cls === 'dualblade')) w.castSkill(p, { id, a: 0 });
    assert.equal(p.mp, mp);
    w.clearControl(p);
    w.castSkill(p, { id: 'skyfall', a: 0, tx: p.x + 200, ty: p.y });
    const x = p.x; w.applyControl(p, { stun: 1000 }, now);
    flush(w); assert.equal(p.x, x, 'cancelled leap cannot teleport after the stun');
  }
  // Gear: no life steal at all; «ทะลวงเกราะ» took its place (same seeds) and is capped when stacked.
  {
    assert(!C.OPTIONS.leech && C.OPTIONS.pierce && Object.keys(C.OPTIONS)[0] === 'pierce', 'pierce sits where life steal was');
    const eq = {};
    for (const slot of C.SLOTS) {
      const base = C.ALL_ITEMS.filter((it) => it.slot === slot).at(-1);
      for (let seed = 1; seed < 4000 && !eq[slot]; seed++) {
        const key = C.gradeId(base.id, 5, seed), it = C.ITEMS[key];
        assert(!it.option || C.OPTIONS[it.option[0]], `${key}: unknown option`);
        if (it.option && it.option[0] === 'pierce') eq[slot] = key;
      }
    }
    assert.equal(Object.keys(eq).length, C.SLOTS.length, 'a Mythic pierce item for every slot');
    const fx = C.playerStats('dualblade', 130, eq, {}).fx;
    assert(!('leech' in fx) && fx.pierce === C.OPTIONS.pierce.cap, 'stacked pierce capped');
    const w = fixture(), p = player(w, 'dualblade'), m = monster(w);
    m.def = { ...m.def, def: 2000 }; const plain = w.applyDamage(p, m, 3);
    p.stats.fx = { ...p.stats.fx, pierce: 0.25 }; const hp = p.hp = 1;
    assert(w.applyDamage(p, m, 3) > plain, 'pierce ignores part of the armour'); assert.equal(p.hp, hp, 'and heals nothing');
    // skill MP costs follow the character's MP: never below the listed cost, a real share of the pool late on
    for (const cls of C.CLASS_IDS) for (const sk of C.CLASSES[cls].skills.filter((s) => s.mp)) {
      assert(C.skillMp(sk, 1) === sk.mp && C.skillMp(sk, 130) >= C.skillMp(sk, 60) && C.skillMp(sk, 60) >= sk.mp);
      assert(C.skillMp(sk, 130) <= C.statsFor(cls, 130).maxMp * C.MP_COST_CAP + 1);
    }
  }
  // Stat points drive attack speed / crit: slow start, the class build guide spends only free points within caps.
  for (const cls of C.CLASS_IDS) {
    const sk = C.basicOf(cls), lvl1 = C.playerStats(cls, 1, {}, {});
    const full = C.playerStats(cls, 130, {}, C.cleanAlloc({ aspd: 80, crit: 75 }, 130));
    assert(C.basicCd(sk, full.aspd) * 2 < C.basicCd(sk, lvl1.aspd), `${cls}: attack speed points more than double the swing rate`);
    assert(full.crit - lvl1.crit >= 0.3 - 1e-9, `${cls}: crit points add 30%`);
    for (const lvl of [1, 2, 30, 77, 130]) {
      const add = C.guidePoints(cls, {}, lvl, Infinity), spent = Object.values(add).reduce((t, v) => t + v, 0);
      assert.equal(spent, C.statPtsTotal(lvl), `${cls} Lv.${lvl}: guide spends every point`);
      for (const [k, v] of Object.entries(add)) assert(!C.STAT_POINTS[k].max || v <= C.STAT_POINTS[k].max);
      const part = C.guidePoints(cls, { atk: 5 }, lvl, 3);
      assert(Object.values(part).reduce((t, v) => t + v, 0) <= Math.min(3, Math.max(0, C.statPtsTotal(lvl) - 5)));
    }
    const w = fixture(), p = player(w, cls, 60);
    p.alloc = { atk: 0, def: 0, hp: 0, mp: 0, aspd: 0, crit: 0 }; p.gold = 0;
    w.refreshStats = () => {}; w.sendStat = () => {}; w.save = () => {}; w.toast = () => {};
    w.onStat(p, { cmd: 'guide' });
    assert.equal(C.statPtsFree(p.alloc, p.lvl), 0, `${cls}: 'guide' spends all free points`);
    w.onStat(p, { cmd: 'auto', k: C.STAT_GUIDE_KEY }); assert.equal(p.autoStat, C.STAT_GUIDE_KEY);
  }
  // Crit-heavy gear: the guide stops crit at the total cap and passes the rest on, nothing is wasted.
  {
    const eq = { weapon: 'w12#5.88+10', arms: 'br9#5.12+10' }, lim = C.statLimits('dualblade', 130, eq, {});
    assert(lim.crit < C.STAT_POINTS.crit.max, 'gear crit lowers the useful crit points');
    const add = C.guidePoints('dualblade', {}, 130, Infinity, lim), s = C.playerStats('dualblade', 130, eq, add);
    assert.equal(add.crit, lim.crit); assert.equal(s.crit, C.CRIT_CAP);
    assert.equal(Object.values(add).reduce((t, v) => t + v, 0), C.statPtsTotal(130), 'every point still spent');
    const less = C.playerStats('dualblade', 130, eq, { ...add, crit: add.crit - 1 });
    assert(less.crit < C.CRIT_CAP, 'one point fewer would not reach the cap');
  }
  // Gear gate (Lv.60+): monsters never get weaker than the old formula, and they hit Normal +0 gear clearly
  // harder than Epic +0 (more HP lost per kill), with no cliff at the first gated level.
  {
    const G = require('../tools/gear-gate.cjs');
    for (const [id, m] of Object.entries(C.MONSTERS)) {
      if (id === 'boss' || m.lvl < C.MON_GATE.from) continue;
      const B = m.boss ? { atk: 1.5, def: 2.25 } : { atk: 1, def: 1.4 }, L = m.lvl, ease = C.monEase(L, C.MON_EASE.atk);
      assert(m.def >= Math.floor((1 + 1.05 * L) * B.def), `${id} def not below the old formula`);
      assert(m.atk >= Math.floor((6 + 3.6 * L + 0.012 * L * L) * B.atk * ease), `${id} atk not below the (eased) old formula`);
    }
    // the gap grows with the gate ramp (Lv.59 without a gate is ~1.4x)
    for (const cls of C.CLASS_IDS) for (const [L, gap] of [[70, 1.4], [100, 1.5], [130, 1.6]]) {
      const normal = G.fight(cls, L, 0, 0), epic = G.fight(cls, L, 2, 0);
      assert(normal.loss > epic.loss * gap, `${cls} Lv.${L}: Normal +0 loses ${normal.loss.toFixed(2)} HP/kill vs Epic ${epic.loss.toFixed(2)}`);
    }
    for (const cls of C.CLASS_IDS) assert(G.fight(cls, C.MON_GATE.from, 2, 0).loss <= G.fight(cls, C.MON_GATE.from - 1, 2, 0).loss * 1.15, `${cls}: no cliff at the gate`);
  }
  // Gear passives fire at random with the grade's chance; วิญญาณยมทูต heals ≤ 5% and once per 3 s at most.
  {
    assert.equal(C.passiveChance('reaper', 5), C.GRADES[5].proc); assert.equal(C.passiveChance('reaper', 4), C.GRADES[4].proc);
    assert.equal(C.passiveChance('thunder', 5), 0, 'อสนีพิโรธ keeps its own chance');
    assert(C.PASSIVES.reaper.cap <= 0.05);
    const w = fixture(), p = player(w, 'dualblade');
    p.stats.fx = { ...p.stats.fx, reaper: 0.05 }; p.stats.procs = { reaper: 0.45 };
    const max = p.stats.maxHp;
    Math.random = () => 0.9; p.hp = 1; w.reap(p); assert.equal(p.hp, 1, 'no proc: no heal');
    Math.random = () => 0.1; w.reap(p); assert.equal(p.hp, 1 + max * 0.05, 'proc: heals the passive value');
    w.reap(p); w.reap(p); assert.equal(p.hp, 1 + max * 0.05, 'a multi-kill heals once');
    now += C.REAPER_CD_MS; w.reap(p); assert(p.hp > 1 + max * 0.05, 'heals again after the cooldown');
    // ปราการสุดท้าย: below 35% HP the cut applies only when it fires
    const m = monster(w); p.stats.fx = { bulwark: 0.6 }; p.stats.procs = { bulwark: 0.45 }; p.stats.evasion = 0;
    p.hp = max * 0.2; Math.random = () => 0.9; const full = w.applyDamage(m, p, 1);
    p.hp = max * 0.2; Math.random = () => 0.1; const cut = w.applyDamage(m, p, 1);
    assert(cut < full * 0.6, `bulwark cut ${cut} vs ${full}`);
    Math.random = () => 0.5;
  }
  // Damage to monsters comes from enhancing the whole outfit and a full-set grade, not from the item level;
  // at Lv.130 enhancing a Mythic outfit +0 → +10 must make kills several times faster.
  {
    const best = (list, L) => list.filter((it) => it.lvl <= L).at(-1);
    const outfit = (L, grade, plus, skip) => {
      const eq = {};
      for (const b of [best(C.WEAPONS, L), ...C.ARMOR_SLOTS.map((s) => best(C.ARMORS.filter((a) => a.slot === s), L))])
        if (b.slot !== skip) eq[b.slot] = C.plusId(C.gradeId(b.id, grade, 77), plus);
      return eq;
    };
    assert.equal(C.gearPve(outfit(130, 5, 0)).plus, 1, 'unenhanced: no enhancement bonus whatever the item level');
    assert.equal(C.gearPve(outfit(30, 5, 0)).mult, C.gearPve(outfit(130, 5, 0)).mult, 'item level alone adds nothing');
    assert.equal(C.gearPve(outfit(130, 5, 0)).set, C.SET_BONUS[5]);
    assert.equal(C.gearPve(outfit(130, 5, 0, 'legs')).set, 0, 'the set bonus needs all 5 slots');
    assert.equal(C.gearPve(outfit(130, 5, 10)).plus, 1 + C.PVE_PLUS_MAX);
    const armourOnly = { ...outfit(130, 5, 10), weapon: outfit(130, 5, 0).weapon };
    assert(C.gearPve(armourOnly).plus > 1.5, 'enhancing the armour counts too');
    const G = require('../tools/gear-gate.cjs');
    const t0 = G.fight('dualblade', 130, 5, 0).ttk, t10 = G.fight('dualblade', 130, 5, 10).ttk;
    assert(t0 > 6 && t0 / t10 > 3, `Lv.130 Mythic +0 ${t0.toFixed(1)} s vs +10 ${t10.toFixed(1)} s per kill`);
    assert(G.fight('dualblade', 30, 0, 0).ttk < 7, 'the early maps stay quick without enhancement');
  }
  // Early levels are eased (no cliff where the ease ends); monsters above the player resist and hit harder; armour
  // never makes anyone immune.
  {
    for (let L = 2; L <= C.MAX_LVL; L++) for (const boss of [false, true]) {
      const a = C.monStats(L - 1, boss), b = C.monStats(L, boss);
      assert(b.hp >= a.hp && b.atk >= a.atk * 0.97, `monster stats rise smoothly at Lv.${L}`);
    }
    assert(C.monEase(1, C.MON_EASE.hp) < 0.6 && C.monEase(C.MON_EASE.full, C.MON_EASE.hp) === 1);
    assert.deepEqual(C.levelGapMul(100, 100), { dealt: 1, taken: 1 });
    assert.deepEqual(C.levelGapMul(100, 100 + C.LVL_GAP.grace), { dealt: 1, taken: 1 });
    const g = C.levelGapMul(114, 130);
    assert(g.dealt < 0.5 && g.taken > 1.6, '16 levels above: far less damage dealt, far more taken');
    assert.deepEqual(C.levelGapMul(1, 130), { dealt: C.LVL_GAP.minDealt, taken: C.LVL_GAP.maxTaken });
    const w = fixture(), p = player(w, 'dualblade', 114), m = monster(w);
    m.def = { ...m.def, lvl: 114, def: 10 }; const same = w.applyDamage(p, m, 1);
    m.def = { ...m.def, lvl: 130 }; const above = w.applyDamage(p, m, 1);
    assert(above < same * 0.5, `blows on a Lv.130 monster shrink (${above} vs ${same})`);
    m.def = { ...m.def, lvl: 114, atk: 500 }; p.stats.def = 99999; p.stats.evasion = 0;
    assert(w.applyDamage(m, p, 1) >= Math.floor(500 * 0.9 * C.DMG_FLOOR), 'huge armour still takes the minimum damage');
  }
  // Every available skill executes through the real dispatcher at each evolution milestone.
  let casts = 0;
  for (const lvl of [1, 30, 60, 100, 130]) for (const cls of C.CLASS_IDS) for (const faction of ['dharma', 'adharma']) {
    for (const sk of C.CLASSES[cls].skills.filter(s => s.lvl <= lvl)) {
      const w = fixture(), p = player(w, cls, lvl, faction), m = monster(w);
      // Isolated skill test: reach its legal stack/rank; skill-point allocation is tested separately by the game.
      p.skl.sk[sk.id] = C.skillCap(sk, lvl); p.skl.ev[sk.id] = C.skillRank(sk, lvl);
      const mp = p.mp;
      w.castSkill(p, { id: sk.id, a: 0, tx: m.x, ty: m.y, tid: m.id });
      assert.equal(p.mp, mp - C.skillMp(sk, lvl), `${cls}/${sk.id} mana`);
      assert(p.cds[sk.id] > now); flush(w);
      assert(Number.isFinite(m.hp) && Number.isFinite(p.hp));
      casts++;
    }
  }
  console.table(rows.filter(r => r.faction === 'dharma'));
  console.log(`PASS: ${casts} skill casts; PvE/PvP, both factions, role DPS, evasion/accuracy, control, party support, buffs, armour break, party EXP, movement and interrupted leap.`);
} finally {
  Date.now = realNow; Math.random = realRandom;
}
