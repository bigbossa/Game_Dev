// Field PvP (C.PK): the PvP switch, self-defence, camps / parties / levels, evil points, their hourly recovery and
// the per-viewer "hostile" bit in snapshots. World prototype only: no accounts, ports or real timers.
const assert = require('node:assert/strict');
const C = require('../shared/world-data');
const World = require('../server/world');
let now = 1_000_000, serial = 0;
const realNow = Date.now, realRandom = Math.random;
Date.now = () => now;
Math.random = () => 0.5;
function fixture(pvp = false) {
  const w = Object.create(World.prototype);
  w.players = new Map(); w.parties = new Map(); w.timers = []; w.events = []; w.monsters = []; w.toasts = [];
  w.score = { dharma: 0, adharma: 0 }; w.io = { emit: () => {} };
  w.maps = { field: { def: { pvp, name: 'ทดสอบ', gates: [], camp: { x0: 0, y0: 0, x1: 4, y1: 4 } },
    map: { w: 200, h: 200, solid: new Uint8Array(40000) }, monsters: [] } };
  w.emitNear = (...args) => w.events.push(args);
  w.toast = (p, t) => w.toasts.push([p.name, t]);
  w.gainExp = () => {};
  return w;
}
function player(w, faction, lvl = 60, x = 2000) {
  const stats = C.playerStats('dualblade', lvl, {}, {});
  const p = { id: `p${++serial}`, name: `p${serial}`, cls: 'dualblade', lvl, faction, stats, x, y: 2000, dir: 0, mapId: 'field',
    hp: stats.maxHp, mp: stats.maxMp, kills: 0, deaths: 0, pvp: 0, pvpSeen: new Map(),
    cds: {}, dots: [], pot: {}, buffs: {}, lockUntil: 0, actUntil: 0,
    pk: false, defend: new Map(), pkFight: 0, evil: 0, evilAt: now, messages: [], eq: { weapon: 'w0' } };
  p.socket = { emit: (ev, data) => p.messages.push({ ev, data }) };
  w.players.set(p.id, p);
  return p;
}
const hit = (w, a, b) => { const hp = b.hp; w.applyDamage(a, b, 1); return hp - b.hp; };
const kill = (w, a, b) => { b.hp = 1; w.applyDamage(a, b, 5); assert(b.dead, 'victim dies'); };
try {
  // switched off: hunting maps stay safe
  {
    const w = fixture(), a = player(w, 'dharma'), b = player(w, 'adharma', 60, 2060);
    assert.equal(hit(w, a, b), 0); assert.equal(w.canPk(a, b), false);
    w.onPk(a, { on: true }); assert.equal(a.pk, true);
    assert(hit(w, a, b) > 0, 'PvP on hits the other faction');
    const ally = player(w, 'dharma', 60, 2040);
    assert.equal(hit(w, a, ally), 0, 'never the own faction');
    // the one attacked may hit back for PK.defendMs without PvP on, then not any more
    assert(hit(w, b, a) > 0, 'self-defence'); assert.equal(b.pk, false);
    assert.equal(w.canPk(b, player(w, 'dharma', 60, 2080)), false, 'self-defence only against the attacker');
    now += C.PK.defendMs + C.PK.combatMs + 1;
    assert.equal(hit(w, b, a), 0, 'defence window over');
  }
  // camps, levels and party mates are protected
  {
    const w = fixture(), a = player(w, 'dharma'), low = player(w, 'adharma', C.PK.minLvl - 1, 2050);
    a.pk = true;
    assert.equal(hit(w, a, low), 0, 'under the PvP level');
    w.onPk(low, { on: true }); assert.equal(low.pk, false, 'too low to switch on');
    const inCamp = player(w, 'adharma', 60, C.TILE * 2); inCamp.y = C.TILE * 2;
    assert.equal(hit(w, a, inCamp), 0, 'camp is safe');
    const mate = player(w, 'adharma', 60, 2050); a.party = mate.party = 'pt';
    assert.equal(hit(w, a, mate), 0, 'party mates of the other faction are safe');
  }
  // evil points: aggressor -10 per kill; self-defence and killing an evil player cost nothing
  {
    const w = fixture(), a = player(w, 'dharma'), b = player(w, 'adharma', 60, 2050), c = player(w, 'adharma', 60, 2060);
    w.onPk(a, { on: true });
    kill(w, a, b);
    assert.equal(a.evil, -C.PK.evilPerKill); assert.equal(w.score.dharma, 0, 'no battlefield score on a hunting map');
    hit(w, a, c); kill(w, c, a);
    assert.equal(c.evil, 0, 'self-defence kill is not evil');
    a.dead = false; a.hp = a.stats.maxHp; c.pk = true; now += C.PK.defendMs + 1;
    kill(w, c, a);
    assert.equal(c.evil, 0, 'killing an evil player is not evil');
    // cannot switch off mid-fight
    const d = player(w, 'adharma', 60, 2070); a.dead = false; a.hp = a.stats.maxHp;
    hit(w, a, d); w.onPk(a, { on: false }); assert.equal(a.pk, true, 'still fighting');
    now += C.PK.combatMs + 1; w.onPk(a, { on: false }); assert.equal(a.pk, false);
  }
  // recovery: +10 every hour (real time), from the first evil kill; offline time counts at login
  {
    const w = fixture(), a = player(w, 'dharma');
    w.addEvil(a, -30); const t0 = now;
    w.decayEvil(a, t0 + C.PK.evilEveryMs - 1); assert.equal(a.evil, -30);
    w.decayEvil(a, t0 + C.PK.evilEveryMs); assert.equal(a.evil, -20);
    w.addEvil(a, -10); assert.equal(a.evil, -30, 'a new kill keeps the running clock');
    w.decayEvil(a, t0 + 5 * C.PK.evilEveryMs); assert.equal(a.evil, 0, 'never above 0');
    const b = player(w, 'dharma'); w.addEvil(b, -20); now += 2.5 * C.PK.evilEveryMs; w.decayEvil(b, now);
    assert.equal(b.evil, 0, 'offline hours recovered');
  }
  // the PvP battlefield keeps its rules: the other faction without the switch, and the score counts
  {
    const w = fixture(true), a = player(w, 'dharma'), b = player(w, 'adharma', 60, 2050);
    assert(hit(w, a, b) > 0); kill(w, a, b);
    assert.equal(w.score.dharma, 1); assert.equal(a.evil, 0, 'battlefield kills are not evil');
  }
  // snapshots carry the flag, the evil points and whether the viewer may hit that player
  {
    const w = fixture(), a = player(w, 'dharma'), b = player(w, 'adharma', 60, 2050);
    a.pk = true; b.evil = -20;
    w.meLite = () => ({}); w.sendSnapshots(now);
    const snap = a.messages.filter((m) => m.ev === 'snap').at(-1).data, rowB = snap.p.find((r) => r[0] === b.id);
    assert.deepEqual(rowB.slice(-3), [0, -20, 1]);
    const back = b.messages.filter((m) => m.ev === 'snap').at(-1).data.p.find((r) => r[0] === a.id);
    assert.deepEqual(back.slice(-3), [1, 0, 0], 'b cannot hit a until attacked');
  }
  console.log('PASS: field PvP switch, self-defence, camp/level/party protection, evil points and recovery, battlefield rules, snapshots');
} finally {
  Date.now = realNow; Math.random = realRandom;
}
