// GM /exp: real progression and save paths with in-memory players/store only.
const assert = require('node:assert/strict');
const C = require('../shared/world-data');
const worldPath = require.resolve('../server/world');

function loadWorld(mode) {
  const oldMode = process.env.GM, oldModule = require.cache[worldPath];
  try {
    if (mode === undefined) delete process.env.GM;
    else process.env.GM = mode;
    delete require.cache[worldPath];
    return require(worldPath);
  } finally {
    if (oldMode === undefined) delete process.env.GM;
    else process.env.GM = oldMode;
    if (oldModule) require.cache[worldPath] = oldModule;
    else delete require.cache[worldPath];
  }
}

const World = loadWorld(); // default account permissions, regardless of the test shell's GM value
const copy = value => JSON.parse(JSON.stringify(value));
let serial = 0, checks = 0;
function fixture(Type = World, lvl = 1) {
  const w = Object.create(Type.prototype), records = new Map(), writes = [], effects = [];
  w.players = new Map(); w.parties = new Map();
  w.store = {
    put(record) { const saved = copy(record); records.set(saved.name, saved); writes.push(saved); },
    get(name) { return records.get(name); },
  };
  w.emitNear = (...args) => effects.push(args);
  function player(gm, name) {
    const cls = 'warrior', alloc = C.cleanAlloc({}, lvl), eq = { weapon: 'w0' };
    const stats = C.playerStats(cls, lvl, eq, alloc), messages = [];
    const p = {
      id: 'p' + ++serial, name, gm, gmOn: gm, cls, faction: 'dharma', lvl, exp: 0,
      mapId: C.START_MAP, x: 2000, y: 2000, stats, alloc, eq,
      hp: stats.maxHp, mp: stats.maxMp, dead: false, kills: 0, deaths: 0, pvp: 0,
      inv: Array(C.BAG_SIZE).fill(null), gold: 123, stones: 4, charms: C.cleanCharms(),
      storage: Array(C.STORAGE_SIZE).fill(null), storeGold: 456,
      autoSort: false, autoSell: {}, autoStat: '', evil: 0, evilAt: 0,
      skl: C.cleanSkills(cls, { v: C.SKILL_VER, sk: { guardSlash: 1 }, ev: {}, auto: false }, lvl),
      buffs: {}, lastChat: 0, socket: { emit: (event, data) => messages.push({ event, data: copy(data) }) },
      messages,
    };
    w.players.set(p.id, p);
    return p;
  }
  const p = player(true, 'Admin'), other = player(false, 'Other');
  return { w, p, other, records, writes, effects };
}

const events = (p, event) => p.messages.filter(m => m.event === event);
function state(p) {
  return copy({ lvl: p.lvl, exp: p.exp, stats: p.stats, alloc: p.alloc, skl: p.skl,
    hp: p.hp, mp: p.mp, dead: p.dead, inv: p.inv, eq: p.eq, gold: p.gold });
}
function denied(f, p, action, label) {
  const before = state(p), other = state(f.other), saved = f.writes.length, earned = events(p, 'exp').length;
  action();
  assert.deepEqual(state(p), before, label + ': character unchanged');
  assert.deepEqual(state(f.other), other, label + ': other character unchanged');
  assert.equal(f.writes.length, saved, label + ': no save');
  assert.equal(events(p, 'exp').length, earned, label + ': no EXP event');
  checks++;
}
function savedMatches(f) {
  const saved = f.records.get(f.p.name);
  assert(saved, 'actual World.save writes the invoking character');
  for (const key of ['name', 'cls', 'faction', 'lvl', 'exp', 'alloc', 'skl', 'eq', 'inv', 'gold'])
    assert.deepEqual(saved[key], f.p[key], 'saved ' + key);
  assert.equal(f.records.has(f.other.name), false, 'other character was not saved');
}
function cost(from, to) {
  let n = 0;
  for (let lvl = from; lvl < to; lvl++) n += C.expToNext(lvl);
  return n;
}

// Exact raw +10 via the full chat route. Gear/party/level EXP bonuses do not apply.
{
  const f = fixture(), otherBefore = state(f.other);
  f.p.exp = 7; f.p.stats.fx.exp = 0.5;
  f.p.party = f.other.party = 'party';
  f.w.parties.set('party', { members: [f.p.id, f.other.id], rules: { ...C.PARTY_DEFAULT } });
  assert.equal(f.w.isGm(f.p), true);
  assert.equal(f.w.isGm(f.other), false);
  f.w.onChat(f.p, { text: '/exp +10' });
  assert.equal(f.p.lvl, 1); assert.equal(f.p.exp, 17);
  assert.deepEqual(events(f.p, 'exp').map(m => m.data), [10]);
  assert.equal(events(f.p, 'stat').length, 1, 'non-level-up updates stats UI');
  assert.equal(events(f.p, 'inv').length, 1, 'shared onGm footer runs');
  assert.equal(events(f.p, 'gmmsg').length, 1);
  assert.deepEqual(state(f.other), otherBefore);
  assert.equal(f.writes.length, 1); savedMatches(f); checks++;
}

// Both chat and direct socket dispatch use the real account/off permission rules.
for (const Type of [World, loadWorld('0')]) {
  const f = fixture(Type);
  const rejected = Type === World ? [f.other] : [f.p, f.other];
  for (const p of rejected) {
    denied(f, p, () => f.w.onChat(p, { text: '/exp +10' }), 'chat permission');
    denied(f, p, () => f.w.onGm(p, { cmd: 'exp', n: 10 }), 'direct permission');
    assert(events(p, 'toast').length >= 2, 'permission failures get private feedback');
  }
}

// Numeric socket input and unsigned decimal text are accepted.
for (const n of [10, '10', '+10', '1', 1000000000]) {
  const f = fixture();
  f.w.onGm(f.p, { cmd: 'exp', n });
  assert.equal(events(f.p, 'exp')[0]?.data, Number(n));
  assert.equal(f.writes.length, 1); savedMatches(f); checks++;
}

// Crossing a threshold preserves residual EXP and normal level-up stats/skill points.
{
  const f = fixture(), freeSkills = C.skillPtsFree(f.p.skl, 1);
  f.p.exp = C.expToNext(1) - 5;
  f.w.chatCommand(f.p, '/exp +10');
  assert.equal(f.p.lvl, 2); assert.equal(f.p.exp, 5);
  assert.equal(C.statPtsFree(f.p.alloc, 2), C.STAT_PTS);
  assert.equal(C.skillPtsFree(f.p.skl, 2), freeSkills + 1);
  assert.deepEqual(f.p.stats, C.playerStats(f.p.cls, 2, f.p.eq, f.p.alloc));
  assert.equal(f.p.hp, f.p.stats.maxHp); assert.equal(f.p.mp, f.p.stats.maxMp);
  assert.equal(events(f.p, 'stat').length, 1, 'no duplicate stat event on level-up');
  assert.equal(events(f.p, 'skills').length, 1);
  savedMatches(f); checks++;
}
{
  const f = fixture(), freeSkills = C.skillPtsFree(f.p.skl, 1), amount = cost(1, 7) + 17;
  f.w.onGm(f.p, { cmd: 'exp', n: amount });
  assert.equal(f.p.lvl, 7); assert.equal(f.p.exp, 17);
  assert.equal(C.statPtsFree(f.p.alloc, 7), 6 * C.STAT_PTS);
  assert.equal(C.skillPtsFree(f.p.skl, 7), freeSkills + 6);
  assert.equal(f.effects.filter(args => args[4]?.t === 'lvl').length, 6);
  savedMatches(f); checks++;
}

// Automatic allocations still run through the real gainExp/addStat/autoLearn methods.
{
  const f = fixture(); f.p.autoStat = 'hp'; f.p.skl.auto = true;
  f.w.onGm(f.p, { cmd: 'exp', n: cost(1, 7) + 3 });
  assert.equal(f.p.lvl, 7); assert.equal(f.p.exp, 3);
  assert.equal(f.p.alloc.hp, 6 * C.STAT_PTS);
  assert.equal(C.statPtsFree(f.p.alloc, 7), 0);
  assert(f.p.skl.sk.shieldBash > 0); assert(f.p.skl.sk.battleCry > 0);
  assert(f.p.skl.bar.includes('battleCry'));
  assert(C.skillPtsFree(f.p.skl, 7) >= 0);
  assert.deepEqual(f.p.stats, C.playerStats(f.p.cls, 7, f.p.eq, f.p.alloc));
  savedMatches(f); checks++;
}

// There is no level cap: EXP carries past MAX_LVL (the top of the content) and keeps levelling.
{
  const f = fixture(World, C.MAX_LVL - 1);
  f.p.exp = C.expToNext(f.p.lvl) - 5;
  f.w.onGm(f.p, { cmd: 'exp', n: 1000000000 });
  assert(f.p.lvl > C.MAX_LVL); assert(f.p.exp < C.expToNext(f.p.lvl)); savedMatches(f); checks++;
}
{
  const f = fixture(); f.p.dead = true;
  denied(f, f.p, () => f.w.onGm(f.p, { cmd: 'exp', n: 10 }), 'dead admin');
  assert.match(events(f.p, 'gmmsg').at(-1).data, /ตาย/);
}

// Reject malformed/unsafe payloads before gainExp or persistence can mutate anything.
for (const n of [undefined, null, '', ' ', 0, '0', '+0', -10, '-10', 1.5, '1.5',
  NaN, Infinity, -Infinity, 'NaN', 'Infinity', '1e3', '0x10', '+', '++10', '+ 10',
  '10foo', '10 20', '10 @Other', 1000000001, '1000000001', Number.MAX_SAFE_INTEGER,
  '9007199254740993', true, false, {}, [], [10], { toString: () => '10' }]) {
  const f = fixture();
  denied(f, f.p, () => f.w.onGm(f.p, { cmd: 'exp', n }), 'invalid payload ' + String(n));
  assert.equal(events(f.p, 'gmmsg').length, 1, 'invalid payload gets usage feedback');
}
for (const text of ['/exp', '/exp +10 @Other', '/exp +10 extra', '/exp -10', '/exp 1.5']) {
  const f = fixture();
  denied(f, f.p, () => f.w.onChat(f.p, { text }), 'invalid chat ' + text);
}
{
  const f = fixture();
  denied(f, f.p, () => f.w.onGm(f.p, { cmd: 'exp', n: 10, to: f.other.name }), 'targeted socket command');
}

console.log(`PASS: ${checks} GM EXP cases; exact raw grants, account/off permissions, progression, auto allocations, cap, validation and actual save fields.`);
