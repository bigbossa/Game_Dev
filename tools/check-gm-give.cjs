// GM gifts to another character by name: online (straight into the bag + a toast), offline (into the save),
// unknown name (an error, nothing given), the "@name" chat suffix, and that /p party chat keeps its "@" text.
const assert = require('node:assert');
const C = require('../shared/world-data');
const World = require('../server/world');

const w = Object.create(World.prototype);
w.players = new Map(); w.parties = new Map();
const replies = [], toasts = [], saved = [];
w.gmReply = (p, t) => replies.push([p.name, t]);
w.toast = (p, t) => toasts.push([p.name, t]);
w.sendInv = () => {}; w.save = (p) => saved.push(p.name);
const data = {};
w.store = { get: (n) => data[n.trim().toLowerCase()] || null, put: (r) => { data[r.name.toLowerCase()] = r; }, flush() { this.flushed = true; } };
const mk = (id, name) => ({ id, name, inv: Array(C.BAG_SIZE).fill(null), stones: 0, gold: 0, charms: C.cleanCharms(), socket: { emit() {} } });
const gm = mk('p1', 'Boss'), on = mk('p2', 'Online');
w.players.set(gm.id, gm); w.players.set(on.id, on);
data.sleepy = { name: 'Sleepy', inv: ['w1', null], gold: 5, stones: 2 };

// online, case-insensitive, via the chat suffix
w.chatCommand(gm, '/item w9 2 mythic @online');
assert.strictEqual(on.inv.filter(Boolean).length, 2, 'online target gets 2 items');
assert.strictEqual(C.ITEMS[on.inv[0]].grade, 5, 'grade carried');
assert.strictEqual(gm.inv.filter(Boolean).length, 0, 'GM gets nothing');
assert.ok(toasts.some(([n]) => n === 'Online'), 'target is told');
assert.ok(replies.at(-1)[1].includes('→ Online'), 'GM reply names the target');
w.chatCommand(gm, '/gold 1000 @Online'); w.chatCommand(gm, '/stone 50 @Online'); w.chatCommand(gm, '/charm 3 guard @Online');
assert.deepStrictEqual([on.gold, on.stones, on.charms.guard, gm.gold], [1000, 50, 3, 0]);

// offline: written into the save
w.onGm(gm, { cmd: 'set', id: 6, g: 'legendary', to: 'sleepy' });
w.onGm(gm, { cmd: 'gold', n: 100, to: 'Sleepy' });
const r = data.sleepy;
assert.strictEqual(r.inv.length, C.BAG_SIZE, 'bag normalised');
assert.strictEqual(r.inv[0], 'w1', 'old items kept');
assert.strictEqual(r.inv.filter(Boolean).length, 1 + C.ARMOR_SLOTS.length, 'set added');
assert.strictEqual(r.gold, 105); assert.strictEqual(r.stones, 2);
assert.ok(w.store.flushed, 'saved to disk');
assert.ok(replies.at(-1)[1].includes('ออฟไลน์'), 'GM told it is offline');

// unknown name: nothing changes
const before = JSON.stringify([gm.inv, on.inv]);
w.chatCommand(gm, '/item w9 @Nobody');
assert.ok(replies.at(-1)[1].includes('ไม่พบตัวละคร'), 'unknown name error');
assert.strictEqual(JSON.stringify([gm.inv, on.inv]), before);

// no name: the GM's own bag, as before
w.chatCommand(gm, '/item w9');
assert.strictEqual(gm.inv.filter(Boolean).length, 1);

// party chat keeps "@" text
let said = null; w.partyChat = (p, t) => { said = t; };
w.chatCommand(gm, '/p meet @gate');
assert.strictEqual(said, 'meet @gate');
console.log('gm give ok', replies.length, 'replies');
