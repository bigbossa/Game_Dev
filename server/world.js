// Authoritative game world: players, monsters, combat, factions.
const C = require('../shared/world-data'); // common.js + hunting maps / monsters

const SEED = 20261018;
const TICK_MS = 50;
const VIEW_X = 1400;
const VIEW_Y = 1000;
const RESPAWN_MS = 6000;
// GM/test commands (spawn items, set level, add gold, delete characters).
// GM unset = only accounts marked GM (npm run gm -- <บัญชี>) · GM=all = every player spawns with /gm, no code · GM=0 = off
// Deleting characters (/user) always needs a GM account that unlocked with /gmcode.
const GM_MODE = (() => {
  const v = String(process.env.GM || '').toLowerCase();
  if (['0', 'off', 'false'].includes(v)) return 'off';
  return ['all', '1', 'on', 'true'].includes(v) ? 'all' : 'account';
})();
const MAX_CHARS = Math.max(1, Number(process.env.MAX_CHARS) || 6);   // characters per account
// a GM account's commands stay locked until "/gmcode <GM_CODE>" (locked again by "/out <GM_CODE>" or logging out).
// GM_CODE unset = GM commands can never be unlocked. A wrong code looks exactly like an unknown command.
const GM_CODE = String(process.env.GM_CODE || '').trim();
const GM_CODE_TRIES = 5;                  // wrong codes before /gmcode stops working for this login for 10 minutes
const GM_CODE_LOCK_MS = 10 * 60 * 1000;
// leaderboard (🏆 / R): rebuilt at most once a minute, top RANK_TOP rows per board
const RANK_MS = 60000;
const RANK_TOP = 50;
// a player kill counts on the PvP board only when the victim is at most RANK_LVL_GAP levels below the killer
// and was not already counted by that killer in the last RANK_REPEAT_MS (stops farming an alt or a low player)
const RANK_LVL_GAP = 20;
const RANK_REPEAT_MS = 10 * 60 * 1000;
const TILE = C.TILE;

// skills of each class by id (a character can only cast its own class's skills)
const SKILLS = {};
for (const c of Object.values(C.CLASSES)) { SKILLS[c.id] = {}; for (const s of c.skills) SKILLS[c.id][s.id] = s; }
// how long the caster shows as "attacking" to others
const ACT_MS = { fang: 320, lotus: 660, shadowstep: 320, rend: 430, tempest: 2800, crescent: 380, skyfall: 620, thousand: 1100, twindragon: 700,
  jade: 360, skybolt: 520, mercy: 600, aegis: 600, heavens: 800, spiritsword: 420, might: 600, meteor: 700, nirvana: 800,
  hawkshot: 320, scatter: 440, hawkeye: 520, gale: 520, skyrain: 900, deadeye: 520, rollshot: 380, blast: 520, stormphoenix: 720 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};
function segDist(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy;
  let t = L ? ((px - x0) * vx + (py - y0) * vy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
}
const radiusOf = (e) => (e.def ? e.def.radius : 16);
const isPlayer = (e) => !!e.socket;
const NAME_RE = /^[\p{L}\p{M}\p{N}_ ]{2,16}$/u;

class World {
  constructor(io, store, accounts) {
    this.io = io;
    // every map is generated once; players and monsters carry the id of the map they are on (mapId)
    this.maps = {};
    C.MAP_ORDER.forEach((id, i) => {
      const def = C.MAPS[id];
      const map = def.pvp ? C.generateMap(SEED) : C.generateField(def, SEED + 101 * (i + 1));
      this.maps[id] = {
        def, map, monsters: [],
        payload: {
          id, w: map.w, h: map.h, tile: TILE, seed: SEED, version: map.version || 1,
          tiles: Buffer.from(map.tiles).toString('base64'),
          solid: Buffer.from(map.solid).toString('base64'),
          objects: map.objects,
        },
      };
    });
    this.store = store;
    this.accounts = accounts;
    this.players = new Map();
    this.bySocket = new Map();
    this.monsters = [];
    this.mById = new Map();
    this.timers = [];
    this.seq = 1;
    this.score = { dharma: 0, adharma: 0 };
    this.rank = null;              // last built leaderboard (buildRank)
    this.rankBuilding = null;
    this.parties = new Map();
    this.partySeq = 1;
    this.spawnAllMonsters();
    this.last = Date.now();
    if (GM_MODE !== 'off' && !GM_CODE) console.log('GM_CODE ไม่ได้ตั้งใน .env — คำสั่ง GM ปลดล็อกไม่ได้');
    if (GM_MODE === 'all') console.log('GM: ทุกคนพิมพ์ /gm เสกไอเทม/ชุด/ตี+/เลเวลได้ (GM=all) · ลบตัวละคร /user ยังต้องบัญชี GM + /gmcode');
    else if (GM_MODE === 'account') console.log('GM/test commands: GM accounts only (npm run gm -- <บัญชี>) — start with GM=0 to disable');
    setInterval(() => this.tick(), TICK_MS);
    setInterval(() => this.sendMinimap(), 1000);
    setInterval(() => { for (const pt of this.parties.values()) this.sendParty(pt); }, 500);
    setInterval(() => this.saveAll(), 20000);
  }

  // ------------------------------------------------------------ connection
  onConnect(socket) {
    const withPlayer = (fn) => (d) => {
      const p = this.bySocket.get(socket.id);
      if (p) fn.call(this, p, d);
    };
    const acked = (fn) => (d, ack) => {
      ack = typeof ack === 'function' ? ack : () => {};
      Promise.resolve(fn.call(this, socket, d, ack)).catch((e) => {
        console.error('account:', e);
        ack({ ok: false, msg: 'ระบบฐานข้อมูลขัดข้อง ลองใหม่อีกครั้ง' });
      });
    };
    socket.on('auth', acked(this.onAuth));
    socket.on('claim', acked(this.onClaim));
    socket.on('delChar', acked(this.onDelChar));
    socket.on('logout', acked(this.onLogout));
    socket.on('password', acked(this.onPassword));
    socket.on('join', acked(this.join));
    socket.on('input', withPlayer(this.onInput));
    socket.on('skill', withPlayer(this.castSkill));
    socket.on('useItem', withPlayer(this.onUseItem));
    socket.on('chat', withPlayer(this.onChat));
    socket.on('respawn', withPlayer(this.respawn));
    socket.on('equip', withPlayer(this.onEquip));
    socket.on('autoEquip', withPlayer(this.onAutoEquip));
    socket.on('lock', withPlayer(this.onLock));
    socket.on('unequip', withPlayer(this.onUnequip));
    socket.on('shop', withPlayer(this.onShop));
    socket.on('autosell', withPlayer(this.onAutoSell));
    socket.on('bag', withPlayer(this.onBag));
    socket.on('storage', withPlayer(this.onStorage));
    socket.on('discard', withPlayer(this.onDiscard));
    socket.on('gm', withPlayer(this.onGm));
    socket.on('warp', withPlayer(this.onWarp));
    socket.on('gate', withPlayer(this.onGate));
    socket.on('party', withPlayer(this.onParty));
    socket.on('stat', withPlayer(this.onStat));
    socket.on('pk', withPlayer(this.onPk));
    socket.on('skills', withPlayer(this.onSkills));
    socket.on('users', withPlayer(this.onUsers));
    socket.on('who', withPlayer(this.onWho));
    socket.on('rank', withPlayer(this.onRank));
    socket.on('leaveChar', acked(this.onLeaveChar));
    socket.on('disconnect', () => {
      const p = this.bySocket.get(socket.id);
      if (!p) return;
      this.leaveWorld(p, socket.id);
    });
  }
  // shared by the disconnect handler and "เปลี่ยนตัวละคร" (leaveChar): save, drop from the world, tell nearby
  // players. The socket itself is untouched — leaveChar keeps it connected so the client can reuse it for the
  // character-select screen without a fresh login.
  leaveWorld(p, socketId) {
    if (!p.deleted) this.save(p);             // a character deleted by a GM is not written back
    this.cancelRitual(p);
    this.store.flush();
    this.partyLeave(p);
    this.players.delete(p.id);
    this.bySocket.delete(socketId);
    this.dropAggro(p);
    if (!p.deleted) this.systemChat(`${p.name} ออกจากยุทธภพ`);
  }
  // "เปลี่ยนตัวละคร": leaves the current character (same cleanup as disconnecting) but keeps the socket and
  // account session alive, then hands back the account's character list like onClaim/onDelChar do.
  onLeaveChar(socket, d, ack) {
    const p = this.bySocket.get(socket.id);
    if (!p) return ack({ ok: false });
    this.leaveWorld(p, socket.id);
    ack({ ok: true, ...this.charState(socket.data.account) });
  }

  // ------------------------------------------------------------ accounts (server/accounts.js)
  // d.mode: 'login' / 'register' (user + pass) or 'token' (the remember-me token kept by the browser)
  async onAuth(socket, d, ack) {
    if (this.bySocket.has(socket.id) || !d || typeof d !== 'object') return ack({ ok: false, msg: 'เข้าเกมแล้ว' });
    const A = this.accounts;
    let account, token, note = '';
    if (d.mode === 'token') {
      account = await A.bySession(d.token);
      if (!account) return ack({ ok: false, expired: true, msg: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
      token = d.token;
    } else {
      const register = d.mode === 'register';
      const res = register ? await A.register(d.user, d.pass) : await A.login(d.user, d.pass);
      if (res.error) return ack({ ok: false, msg: res.error });
      account = res.account;
      token = await A.newSession(account.id);
      // a new account named like an imported character that has no owner yet takes it
      const rec = register && this.store.get(account.username);
      if (rec && rec.accountId == null) {
        rec.accountId = account.id;
        this.store.put(rec);
        this.store.flush();
        note = `ผูกตัวละครเดิม "${rec.name}" เข้าบัญชีนี้แล้ว`;
      }
    }
    socket.data.account = account;
    socket.data.token = token;
    ack({ ok: true, token, user: account.username, note, ...this.charState(account) });
  }
  charState(account) {
    const online = new Set([...this.players.values()].map((x) => x.name.toLowerCase()));
    const chars = this.store.ofAccount(account.id)
      .map((r) => ({ name: r.name, faction: r.faction, cls: r.cls || 'dualblade', lvl: r.lvl || 1, map: r.map || C.START_MAP, online: online.has(r.name.toLowerCase()) }))
      .sort((a, b) => b.lvl - a.lvl || a.name.localeCompare(b.name));
    return { chars, max: MAX_CHARS };
  }
  // a character imported from players.json (no owner yet) joins the logged-in account
  onClaim(socket, d, ack) {
    const account = socket.data.account;
    if (!account) return ack({ ok: false, auth: true, msg: 'กรุณาเข้าสู่ระบบก่อน' });
    const rec = this.store.get(String((d && d.name) || '').trim().replace(/\s+/g, ' '));
    if (!rec || rec.accountId != null) return ack({ ok: false, msg: 'ไม่พบตัวละครเดิมที่ยังไม่มีเจ้าของชื่อนี้' });
    if (this.store.ofAccount(account.id).length >= MAX_CHARS) return ack({ ok: false, msg: `บัญชีหนึ่งมีตัวละครได้ไม่เกิน ${MAX_CHARS} ตัว` });
    rec.accountId = account.id;
    this.store.put(rec);
    this.store.flush();
    ack({ ok: true, msg: `ผูกตัวละคร "${rec.name}" เข้าบัญชีแล้ว`, ...this.charState(account) });
  }
  // the player deletes one of their own characters from the character list (asks the account password again)
  async onDelChar(socket, d, ack) {
    const account = socket.data.account;
    if (!account) return ack({ ok: false, auth: true, msg: 'กรุณาเข้าสู่ระบบก่อน' });
    if (this.bySocket.has(socket.id) || !d || typeof d !== 'object') return ack({ ok: false, msg: 'ลบตัวละครระหว่างเล่นไม่ได้' });
    const rec = this.store.get(String(d.name || '').trim().replace(/\s+/g, ' '));
    if (!rec || rec.accountId !== account.id) return ack({ ok: false, msg: 'ไม่พบตัวละครนี้ในบัญชีของคุณ' });
    if (!(await this.accounts.verifyPassword(account.id, d.pass))) return ack({ ok: false, msg: 'รหัสผ่านไม่ถูกต้อง' });
    // checked after the password wait: the character may have logged in from another device meanwhile
    if ([...this.players.values()].some((x) => x.name.toLowerCase() === rec.name.toLowerCase()))
      return ack({ ok: false, msg: 'ตัวละครนี้กำลังออนไลน์อยู่ ออกจากเกมก่อนแล้วค่อยลบ' });
    if (this.store.get(rec.name) !== rec) return ack({ ok: false, msg: 'ไม่พบตัวละครนี้ในบัญชีของคุณ' });
    this.store.remove(rec.name);
    await this.store.flush();
    ack({ ok: true, msg: `ลบตัวละคร "${rec.name}" แล้ว`, ...this.charState(account) });
  }
  async onLogout(socket, d, ack) {
    if (this.bySocket.has(socket.id)) return ack({ ok: false });
    await this.accounts.endSession(socket.data.token);
    socket.data.account = socket.data.token = null;
    ack({ ok: true });
  }
  async onPassword(socket, d, ack) {
    const account = socket.data.account;
    if (!account || !d) return ack({ ok: false, msg: 'กรุณาเข้าสู่ระบบก่อน' });
    const res = await this.accounts.changePassword(account.id, d.old, d.pass);
    if (res.error) return ack({ ok: false, msg: res.error });
    const token = await this.accounts.newSession(account.id);
    socket.data.token = token;
    ack({ ok: true, token, msg: 'เปลี่ยนรหัสผ่านแล้ว (อุปกรณ์อื่นต้องเข้าสู่ระบบใหม่)' });
  }
  // canGm: the account may use GM commands · isGm: and it unlocked them this login (/gmcode)
  canGm(p) { return GM_MODE === 'all' || (GM_MODE === 'account' && !!p.gm); }
  isGm(p) { return this.canGm(p) && !!p.gmOn; }
  // the /gm spawn panel (items, sets, +, level, gold, warp): everyone under GM=all, otherwise an unlocked GM
  canSpawn(p) { return GM_MODE === 'all' || this.isGm(p); }
  // /gmcode <code> · /out <code>: anything wrong answers like an unknown command, so nobody learns GM exists
  gmUnlock(p, code, on) {
    const now = Date.now(), unknown = () => this.toast(p, 'ไม่รู้จักคำสั่งนี้');
    if (!this.canGm(p) || !GM_CODE || now < (p.gmLockUntil || 0)) return unknown();
    if (String(code || '') !== GM_CODE) {
      p.gmTries = (p.gmTries || 0) + 1;
      if (p.gmTries >= GM_CODE_TRIES) { p.gmTries = 0; p.gmLockUntil = now + GM_CODE_LOCK_MS; }
      return unknown();
    }
    p.gmTries = 0;
    if (!on && !p.gmOn) return unknown();
    p.gmOn = on;
    p.socket.emit('gmmode', this.canSpawn(p));
    this.toast(p, on ? '🔓 เปิดคำสั่งผู้ดูแลแล้ว (/gm = หน้าต่าง · /out <รหัส> = ปิด)' : '🔒 ปิดคำสั่งผู้ดูแลแล้ว');
  }

  // d = { name } plays a character of the account · d = { create: 1, name, faction, cls } makes a new one
  join(socket, d, ack) {
    if (this.bySocket.has(socket.id)) return ack({ ok: false, msg: 'เข้าเกมแล้ว' });
    const account = socket.data.account;
    if (!account) return ack({ ok: false, auth: true, msg: 'กรุณาเข้าสู่ระบบก่อน' });
    d = d && typeof d === 'object' ? d : {};
    const name = String(d.name || '').trim().replace(/\s+/g, ' ');
    if (!NAME_RE.test(name)) return ack({ ok: false, msg: 'ชื่อต้องยาว 2-16 ตัวอักษร (ไทย/อังกฤษ/ตัวเลข)' });
    for (const p of this.players.values())
      if (p.name.toLowerCase() === name.toLowerCase()) return ack({ ok: false, msg: 'ตัวละครนี้กำลังออนไลน์อยู่' });
    let rec = this.store.get(name);
    if (d.create) {
      if (rec) return ack({ ok: false, msg: 'ชื่อตัวละครนี้มีผู้ใช้แล้ว' });
      if (this.store.ofAccount(account.id).length >= MAX_CHARS) return ack({ ok: false, msg: `บัญชีหนึ่งมีตัวละครได้ไม่เกิน ${MAX_CHARS} ตัว` });
      rec = {
        name, faction: d.faction === 'adharma' ? 'adharma' : 'dharma', cls: C.CLASSES[d.cls] ? d.cls : 'dualblade',
        lvl: 1, exp: 0, kills: 0, deaths: 0, pvp: 0, accountId: account.id,
      };
      this.store.put(rec);
    } else if (!rec || rec.accountId !== account.id) return ack({ ok: false, msg: 'ไม่พบตัวละครนี้ในบัญชีของคุณ' });
    const r = rec, note = '';
    const now = Date.now();
    const p = {
      id: 'p' + this.seq++, socket, name: r.name, faction: r.faction, cls: C.CLASSES[r.cls] ? r.cls : 'dualblade',
      accountId: account.id, gm: !!account.is_gm,
      lvl: r.lvl || 1, exp: r.exp || 0, kills: r.kills || 0, deaths: r.deaths || 0,
      pvp: r.pvp || 0, pvpSeen: new Map(),   // ranked PvP kills · victim name → when it last counted
      x: 0, y: 0, dir: 2, moving: false, dead: false, respawnAt: 0,
      cds: {}, dots: [], combo: 0, buffs: {},
      lastInput: now, lockUntil: 0, lastHurt: 0, actUntil: 0, guardT: 0, lastChat: 0,
    };
    // inventory / equipment / gold (older saves have none)
    p.inv = Array.from({ length: C.BAG_SIZE }, (_, i) => (r.inv && C.ITEMS[r.inv[i]] ? r.inv[i] : null));
    const wid = r.eq && C.ITEMS[r.eq.weapon] ? r.eq.weapon : 'w0';
    p.eq = { weapon: C.ITEMS[wid].lvl <= p.lvl ? wid : 'w0' };
    if (p.eq.weapon !== wid) this.addItem(p, wid);
    for (const slot of C.ARMOR_SLOTS) {
      const it = r.eq && C.ITEMS[r.eq[slot]];
      p.eq[slot] = null;
      if (!it || it.slot !== slot) continue;
      if (it.lvl <= p.lvl) p.eq[slot] = it.id;
      else this.addItem(p, it.id);
    }
    p.gold = Math.max(0, Math.floor(Number(r.gold) || 0));
    p.stones = Math.max(0, Math.min(C.ENH_STONE.max, Math.floor(Number(r.stones) || 0)));   // หินตีบวก
    p.charms = C.cleanCharms(r.charms);                     // ยันต์กันแตก / ยันต์เพิ่มโอกาส
    p.autoSell = C.cleanAutoSell(r.autoSell);               // grades sold the moment they drop
    p.autoSort = !!r.autoSort;                              // keep the bag sorted (C.sortBag) whenever an item comes in
    p.eqMode = C.AUTO_EQUIP_MODES[r.eqMode] ? r.eqMode : 'grade';   // focus of "สวมของดีสุด" (C.AUTO_EQUIP_MODES)
    p.autoEquip = !!r.autoEquip;                            // wear better gear by that focus on every drop / level-up
    p.locks = C.cleanLocks(r.locks);                        // ล็อกไอเทม (C.lockId): can't be sold or thrown away
    // คลังเก็บของ: the character's own storage (items + gold), opened at a camp's blacksmith / teleport stone
    p.storage = Array.from({ length: C.STORAGE_SIZE }, (_, i) => (r.storage && C.ITEMS[r.storage[i]] ? r.storage[i] : null));
    p.storeGold = Math.max(0, Math.floor(Number(r.storeGold) || 0));
    const owned = new Set([...p.inv, ...Object.values(p.eq), ...p.storage].filter(Boolean).map(C.lockId));
    p.locks = p.locks.filter((id) => owned.has(id));         // locks of pieces sold, broken or traded away
    // แต้มสถานะ: older saves have none, their points are all free to spend
    p.alloc = C.cleanAlloc(r.alloc, p.lvl);
    p.autoStat = C.STAT_POINTS[r.autoStat] || r.autoStat === C.STAT_GUIDE_KEY ? r.autoStat : '';
    // field PvP: always off at login; evil points (<= 0) keep recovering while offline
    p.pk = false; p.defend = new Map(); p.pkFight = 0;
    p.evil = Math.min(0, Math.round(Number(r.evil) || 0));
    p.evilAt = Number(r.evilAt) || Date.now();
    this.decayEvil(p, Date.now());
    // แต้มสกิล: learned skills, their levels, evolutions and the 1-9 bar (older saves are auto-allocated)
    p.skl = C.cleanSkills(p.cls, r.skl, p.lvl);
    p.stats = C.playerStats(p.cls, p.lvl, p.eq, p.alloc);
    p.hp = p.stats.maxHp;
    p.mp = p.stats.maxMp;
    // saves from before the hunting maps have no map id: they start in the village
    const savedMap = rec && this.maps[rec.map] ? rec.map : null;
    p.mapId = savedMap || C.START_MAP;
    const def = this.defOf(p);
    const okSaved = savedMap && Number.isFinite(rec.x) && C.canStand(this.mapOf(p), rec.x, rec.y) &&
      !(def.pvp && C.baseAt(rec.x, rec.y) === C.enemyOf(p.faction));
    const s = okSaved ? { x: rec.x, y: rec.y } : C.spawnOf(def, p.faction);
    p.x = s.x; p.y = s.y;
    this.players.set(p.id, p);
    this.bySocket.set(socket.id, p);
    this.save(p);
    ack({ ok: true, id: p.id, note, me: this.meFull(p), map: p.mapId, score: this.score, inv: this.invState(p), st: this.statState(p), skl: this.skillState(p), gm: this.canSpawn(p) });
    this.systemChat(`${p.name} (ฝ่าย${C.FACTIONS[p.faction].name}) เข้าสู่ยุทธภพ`);
  }

  meFull(p) {
    return {
      id: p.id, name: p.name, faction: p.faction, cls: p.cls, x: p.x, y: p.y,
      ...this.meLite(p), speed: p.stats.speed,
    };
  }
  meLite(p) {
    return {
      hp: Math.ceil(p.hp), mp: Math.floor(p.mp), mhp: p.stats.maxHp, mmp: p.stats.maxMp,
      lvl: p.lvl, exp: Math.floor(p.exp), need: C.expToNext(p.lvl), atk: p.stats.atk, def: p.stats.def,
      crit: Math.round(this.critOf(p) * 100), k: p.kills, d: p.deaths, spd: p.stats.speed,
      aspd: Math.round((p.stats.aspd + this.buffVal(p, 'aspd')) * 100), pts: C.statPtsFree(p.alloc, p.lvl), bf: this.buffList(p),
      pexp: this.partyRules(p).exp === 'each' ? 0 : Math.round(C.partyExpBonus(this.expGroup(p, p.mapId, p.x, p.y).length) * 100),   // party EXP bonus now (%)
      evasion: Math.round(p.stats.evasion * 100), accuracy: Math.round(p.stats.accuracy * 100),
      resistance: Math.round(p.stats.resistance * 100), control: this.controlState(p),
      // field PvP: on/off, evil points, ms to the next +10, ms left of the last player fight (PvP cannot be switched off)
      pk: p.pk ? 1 : 0, ev: p.evil || 0, evIn: p.evil < 0 ? Math.max(0, p.evilAt + C.PK.evilEveryMs - Date.now()) : 0,
      pkF: Math.max(0, (p.pkFight || 0) - Date.now()),
    };
  }
  // lim = points still worth spending with the current gear (crit stops at the total crit cap)
  statState(p) { return { a: p.alloc, auto: p.autoStat, free: C.statPtsFree(p.alloc, p.lvl), lim: C.statLimits(p.cls, p.lvl, p.eq, p.alloc) }; }
  sendStat(p) { p.socket.emit('stat', this.statState(p)); }
  skillState(p) { return { ...p.skl, free: C.skillPtsFree(p.skl, p.lvl) }; }
  sendSkills(p) { p.socket.emit('skills', this.skillState(p)); }
  invState(p) { return { inv: p.inv, eq: p.eq, gold: p.gold, stones: p.stones, charms: p.charms, autoSell: p.autoSell, autoSort: p.autoSort, eqMode: p.eqMode, autoEquip: p.autoEquip, locks: p.locks }; }
  // auto-sort keeps the bag in order after every change (items in or out, equip, sell, store...)
  sendInv(p) {
    if (p.autoSort) p.inv = C.sortBag(p.inv);
    p.socket.emit('inv', this.invState(p));
  }
  // `id` may itself carry a count ("potHpS*5", e.g. a whole stack coming back from storage); consumables
  // stack onto existing slots of the same item (up to C.STACK_MAX) before opening new ones. Checks total
  // room first so this never partially lands — either the whole amount fits, or nothing changes.
  addItem(p, id) {
    const base = C.ITEMS[id];
    if (base && base.kind) {
      let remaining = C.stackCount(id);
      let capacity = 0;
      for (const key of p.inv) capacity += key === null ? C.STACK_MAX : C.ITEMS[key] === base ? C.STACK_MAX - C.stackCount(key) : 0;
      if (capacity < remaining) return false;
      for (let i = 0; i < p.inv.length && remaining > 0; i++) {
        if (!p.inv[i] || C.ITEMS[p.inv[i]] !== base) continue;
        const n = C.stackCount(p.inv[i]), add = Math.min(C.STACK_MAX - n, remaining);
        if (add > 0) { p.inv[i] = C.stackKey(base.id, n + add); remaining -= add; }
      }
      while (remaining > 0) {
        const i = p.inv.indexOf(null), add = Math.min(C.STACK_MAX, remaining);
        p.inv[i] = C.stackKey(base.id, add);
        remaining -= add;
      }
      return true;
    }
    const i = p.inv.indexOf(null);
    if (i < 0) return false;
    p.inv[i] = id;
    return true;
  }
  // a bag action names the item it meant (key): when the bag was re-sorted meanwhile, the slot no longer matches
  // and the action is refused instead of hitting another item
  bagKeyOk(p, idx, key) {
    if (key === undefined || p.inv[idx] === key) return true;
    this.bagStale(p);
    return false;
  }
  bagStale(p) {
    this.toast(p, 'กระเป๋าถูกจัดเรียงใหม่ ลองอีกครั้ง');
    this.sendInv(p);
  }
  // ------------------------------------------------------------ storage (คลังเก็บของ, per character)
  nearCamp(p) {
    if (p.dead) return false;
    const st = C.stoneOf(this.defOf(p), p.faction);
    return this.nearSmith(p) || this.nearApothecary(p) || this.nearEnhancer(p) || Math.hypot(p.x - st.x, p.y - st.y) < 200;
  }
  sendStorage(p) { p.socket.emit('storage', { items: p.storage, gold: p.storeGold }); }
  // d.cmd: 'open' · 'put' { idx, key } | { idxs, keys } (bag → storage) · 'take' { idx, key } (storage → bag)
  //        'gold' { n } (> 0 deposit, < 0 withdraw) · 'sort'
  onStorage(p, d) {
    if (!d || typeof d !== 'object') return;
    if (!this.nearCamp(p)) return this.toast(p, 'เปิดคลังได้ที่ช่างตีดาบหรือศิลาเคลื่อนย้ายในค่ายพัก');
    if (d.cmd === 'put') {
      const idxs = d.idxs ? this.bagIdxs(p, d.idxs, d.keys) : this.validIdx(d.idx) && this.bagKeyOk(p, d.idx, d.key) && p.inv[d.idx] ? [d.idx] : [];
      let n = 0, last = null;
      for (const i of idxs) {
        const j = p.storage.indexOf(null);
        if (j < 0) { this.toast(p, 'คลังเต็มแล้ว'); break; }
        last = p.storage[j] = p.inv[i];
        p.inv[i] = null;
        n++;
      }
      if (n) this.toast(p, n === 1 ? `ฝาก ${C.ITEMS[last].name} เข้าคลัง` : `ฝาก ${n} ชิ้นเข้าคลัง`);
    } else if (d.cmd === 'take') {
      const i = d.idx;
      if (!Number.isInteger(i) || i < 0 || i >= C.STORAGE_SIZE || !p.storage[i]) return;
      if (d.key !== undefined && p.storage[i] !== d.key) { this.toast(p, 'คลังถูกจัดเรียงใหม่ ลองอีกครั้ง'); return this.sendStorage(p); }
      const id = p.storage[i];
      if (!this.addItem(p, id)) return this.toast(p, 'กระเป๋าเต็ม');
      p.storage[i] = null;
    } else if (d.cmd === 'gold') {
      const n = Math.floor(Number(d.n) || 0);
      if (n > 0) { const k = Math.min(n, p.gold); p.gold -= k; p.storeGold += k; if (k) this.toast(p, `ฝากทอง ${k.toLocaleString()}`); }
      else if (n < 0) { const k = Math.min(-n, p.storeGold); p.storeGold -= k; p.gold += k; if (k) this.toast(p, `ถอนทอง ${k.toLocaleString()}`); }
    } else if (d.cmd === 'sort') p.storage = C.sortBag(p.storage);
    else if (d.cmd !== 'open') return;
    this.sendStorage(p);
    if (d.cmd !== 'open' && d.cmd !== 'sort') { this.sendInv(p); this.save(p); }
  }
  // d.cmd 'sort' = sort the bag now · 'auto' with d.on = keep it sorted
  //   'mode' with d.mode = focus of "สวมของดีสุด" · 'autoequip' with d.on = wear better gear on every drop / level-up
  onBag(p, d) {
    if (!d || typeof d !== 'object') return;
    if (d.cmd === 'auto') p.autoSort = !!d.on;
    else if (d.cmd === 'mode') { if (!C.AUTO_EQUIP_MODES[d.mode]) return; p.eqMode = d.mode; }
    else if (d.cmd === 'autoequip') {
      p.autoEquip = !!d.on;
      this.toast(p, p.autoEquip ? `สวมของดีกว่าอัตโนมัติ: เปิด (เน้น${C.AUTO_EQUIP_MODES[p.eqMode].th})` : 'สวมของดีกว่าอัตโนมัติ: ปิด');
      if (p.autoEquip) this.autoWear(p);
    } else if (d.cmd !== 'sort') return;
    if (d.cmd === 'sort') p.inv = C.sortBag(p.inv);
    this.sendInv(p);
  }
  isLocked(p, key) { return !!key && (p.locks || []).includes(C.lockId(key)); }
  // ล็อก / ปลดล็อก: d.keys = the gear pieces (bag or worn), d.on = lock them or not
  onLock(p, d) {
    if (!d || !Array.isArray(d.keys)) return;
    const ids = [...new Set(d.keys.slice(0, C.BAG_SIZE).filter((k) => typeof k === 'string' && C.ITEMS[k] && !C.ITEMS[k].kind
      && (p.inv.includes(k) || Object.values(p.eq).includes(k))).map(C.lockId))];
    if (!ids.length) return;
    const set = new Set(p.locks || []);
    for (const id of ids) if (d.on) set.add(id); else set.delete(id);
    if (set.size > C.LOCK_MAX) return this.toast(p, `ล็อกได้ไม่เกิน ${C.LOCK_MAX} ชิ้น`);
    p.locks = [...set];
    this.toast(p, `${d.on ? 'ล็อก' : 'ปลดล็อก'} ${ids.length} ชิ้นแล้ว`);
    this.sendInv(p);
    this.save(p);
  }

  save(p) {
    this.store.put({
      name: p.name, faction: p.faction, cls: p.cls, lvl: p.lvl, exp: Math.floor(p.exp),
      kills: p.kills, deaths: p.deaths, pvp: p.pvp || 0, map: p.mapId, x: Math.round(p.x), y: Math.round(p.y),
      inv: p.inv, eq: p.eq, gold: p.gold, stones: p.stones, charms: p.charms, autoSell: p.autoSell, autoSort: p.autoSort, eqMode: p.eqMode, autoEquip: p.autoEquip, locks: p.locks,
      storage: p.storage, storeGold: p.storeGold,
      alloc: p.alloc, autoStat: p.autoStat, skl: p.skl, evil: p.evil || 0, evilAt: p.evilAt || 0,
    });
  }
  saveAll() {
    for (const p of this.players.values()) this.save(p);
    this.store.flush();
  }

  // ------------------------------------------------------------ player actions
  onInput(p, d) {
    if (!d || p.dead) return;
    const now = Date.now();
    if (now < (p.stunUntil || 0) || now < (p.rootUntil || 0)) {
      p.moving = false; p.lastInput = now;
      p.socket.emit('correct', { x: p.x, y: p.y });
      return;
    }
    if (now < p.lockUntil) return;
    const x = Number(d.x), y = Number(d.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dt = Math.min(1000, Math.max(0, now - p.lastInput));
    p.lastInput = now;
    const moved = Math.hypot(x - p.x, y - p.y);
    const allowed = (p.stats.speed * C.combatMoveScale(p.cls, now < p.actUntil, p, now) * dt) / 1000 * 1.5 + 26;
    if (moved > allowed || !C.canStand(this.mapOf(p), x, y)) {
      p.socket.emit('correct', { x: p.x, y: p.y });
      return;
    }
    p.x = x; p.y = y;
    p.dir = (d.dir | 0) & 7;
    p.moving = !!d.moving;
  }

  castSkill(p, d) {
    if (!d) return;
    const sk = SKILLS[p.cls][d.id];
    const now = Date.now();
    if (!sk || p.dead || now < p.lockUntil || now < (p.stunUntil || 0)) return;
    if (now < (p.rootUntil || 0) && (sk.spear || sk.ritual || C.MOVE_SKILLS.includes(sk.id))) return;
    if (p.lvl < sk.lvl) return this.toast(p, `ต้องการเลเวล ${sk.lvl} เพื่อใช้ ${sk.name}`);
    const sl = p.skl.sk[sk.id] || 0;
    if (!sl) return this.toast(p, `ยังไม่ได้เรียน ${sk.name} (กด K เพื่อใช้แต้มสกิล)`);
    if ((p.cds[sk.id] || 0) > now + 40) return;
    const basic = sk.key === '1';                    // the basic attack (key 1 of every class) has no shared cooldown
    if (!basic && (p.gcd || 0) > now + 40) return;
    const mpCost = C.skillMp(sk, p.lvl);
    if (p.mp < mpCost) return this.toast(p, 'ปราณไม่พอ');
    let a = Number(d.a);
    if (!Number.isFinite(a)) a = (p.dir * Math.PI) / 4;
    // Spear skills lock exactly one legal melee target before spending resources.
    const front = sk.frontline;
    const frontTarget = front && front.damage && !front.area && this.slashTarget(p, a, front.range, Math.PI, d.tid);
    if (front && front.damage && !front.area && (!frontTarget || (d.tid && frontTarget.id !== d.tid))) return;
    const frontClear = target => {
      const map=this.mapOf(p),n=Math.max(1,Math.ceil(dist(p,target)/12));
      for(let i=1;i<n;i++)if(C.solidAt(map,p.x+(target.x-p.x)*i/n,p.y+(target.y-p.y)*i/n))return false;
      return true;
    };
    if(frontTarget){if(!frontClear(frontTarget))return;a=Math.atan2(frontTarget.y-p.y,frontTarget.x-p.x);}
    const spearTarget = sk.spear && this.slashTarget(p, a, sk.spear.range, Math.PI, d.tid);
    if (sk.spear && (!spearTarget || (d.tid && spearTarget.id !== d.tid))) return;
    p.mp -= mpCost;
    // วายุเร่งรุด (gear passive): this cast's cooldown is cut only when the passive fires
    const swift = !basic && p.stats.fx.swift && Math.random() < ((p.stats.procs && p.stats.procs.swift) || 0) ? p.stats.fx.swift : 0;
    const cd = basic ? C.basicCd(sk, p.stats.aspd + this.buffVal(p, 'aspd')) : Math.round(sk.cd * (1 - swift));
    p.cds[sk.id] = now + cd;
    if (!basic) p.gcd = now + C.GCD_MS;
    p.dir = C.dirFromAngle(a);
    p.actUntil = now + (sk.spear ? sk.spear.windup + 220 : ACT_MS[sk.id] || 320);
    p.socket.emit('cast', { id: sk.id, cd });
    // rank = evolutions the player unlocked (r tells clients which look to draw); power also grows with the skill level
    const rank = C.skillRankOf(p.skl, sk.id), mult = C.skillPower(sl, rank);
    const fx = (data) => this.fx(p, { id: p.id, r: rank, sl, ...data });
    const alive = () => this.alive(p);
    if (front) {
      const mapId = p.mapId, epoch = p.controlEpoch || 0;
      const castId=p.frontlineSeq=(p.frontlineSeq||0)+1;
      const valid = () => alive() && p.mapId === mapId && (p.controlEpoch || 0) === epoch && Date.now() >= (p.stunUntil || 0) && Date.now() >= (p.rootUntil || 0);
      const cancel = () => {
        if(p.frontlineSeq===castId){p.lockUntil=Math.min(p.lockUntil||0,Date.now());p.actUntil=Date.now();}
        this.emitNear(mapId,p.x,p.y,'fx',{id:p.id,t:'frontlineCancel',skill:sk.id,castId});
      };
      p.actUntil = now + (front.windup || 200) + 200;
      fx({ t: sk.id, castId, tid:frontTarget?.id, a, x: p.x, y: p.y, dur: p.actUntil - now, radius: front.range || 90 });
      if (front.ward) {
        const amount = front.ward + (rank ? ({ ironGuard: 0.05, rallyGuard: 0.04, lastBastion: 0.05 }[sk.id] || 0) : 0);
        const duration = front.duration + (sk.id === 'ironGuard' && rank ? 1000 : 0);
        for (const q of front.party ? this.partyNear(p, front.range) : [p])
          this.addBuff(q, sk.id, duration, { frontGuard: amount }, amount);
      } else if (front.taunt) {
        // every monster around the warrior turns on them (no target cap)
        const range = front.ranges[rank] || front.range;
        for (const m of this.enemiesOf(p, p.x, p.y, range)) {
          if (isPlayer(m) || now < (m.tauntImmuneUntil || 0) || dist(p,m) > range + radiusOf(m) ||
              C.safeAt(this.defOf(p), p.x, p.y) || Math.hypot(m.x - m.hx, m.y - m.hy) > (m.def.boss ? 640 : 560)) continue;
          const duration = m.def.boss ? 1500 : 2500;
          // Threat is also the boss damage-credit ledger. Taunts must never add fake damage/XP.
          m.taunt = { target: p.id, previous: m.target, until: now + duration };
          m.target = p.id; m.returning = false; m.nextRetarget = now + duration;
          m.tauntImmuneUntil = now + duration + front.immune;
        }
      } else {
        p.lockUntil = now + front.windup;
        this.later(front.windup, () => {
          if (!valid()) return cancel();
          const opts = {};
          if (front.stun) opts.stun = rank ? 700 : front.stun;
          if (front.slow) opts.slow = front.slow;
          if (sk.id === 'shieldSweep' && rank) opts.slow = 1000;
          if (front.armorBreak) opts.armorBreak = rank ? 0.25 : front.armorBreak;
          const range = sk.id === 'earthShatter' && rank ? 200 : front.range;
          if (front.area) {
            if (sk.id === 'shieldSweep') this.hitCone(p, a, range, Math.PI * 0.4, front.damage * mult, opts);
            else this.hitCircle(p, p.x, p.y, range, front.damage * mult, opts);
          } else {
            if(!frontTarget || frontTarget.dead || frontTarget.mapId!==mapId ||
                !this.enemiesOf(p,p.x,p.y,range).includes(frontTarget) || dist(p,frontTarget)>range+radiusOf(frontTarget) || !frontClear(frontTarget))return cancel();
            this.applyDamage(p,frontTarget,front.damage*mult,opts);
          }
          fx({t:'frontlineHit',skill:sk.id,castId,a,x:frontTarget?.x??p.x,y:frontTarget?.y??p.y});
        });
      }
      return;
    }
    if (sk.spear) {
      const spec = sk.spear, target = spearTarget, mapId = p.mapId, epoch = p.controlEpoch || 0;
      const beats=C.spearSequence(sk,rank),duration=beats.at(-1).at+240;
      const face = Math.atan2(target.y - p.y, target.x - p.x);
      p.dir = C.dirFromAngle(face); p.actUntil = now + duration;
      p.lockUntil = now + beats.at(-1).at;
      if (spec.windup >= C.SPEAR_WINDUP_GUARD.minWindup) p.spearGuard = { until: p.lockUntil, epoch };   // applyDamage
      fx({ t: sk.id, a: face, tid: target.id, n: beats.length, g: beats[1]?beats[1].at-beats[0].at:180,
        delay:beats[0].at,dur:duration,beats:beats.map(b=>({at:b.at,move:b.move,area:b.area})) });
      let cancelled=false;
      const clearLine=(x0,y0,x1,y1)=>{const map=this.maps[mapId].map,n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/12));
        for(let i=1;i<n;i++)if(C.solidAt(map,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))return false;return true;};
      for (let i = 0; i < beats.length; i++) this.later(beats[i].at, () => {
        // A broken combo never resumes or selects another primary target.
        if(cancelled)return;
        if (!alive() || target.dead || p.mapId !== mapId || target.mapId !== mapId ||
            (p.controlEpoch || 0) !== epoch || Date.now() < (p.stunUntil || 0) ||
            Date.now() < (p.rootUntil || 0) ||
            dist(p, target) > spec.range + radiusOf(target) ||
            !this.enemiesOf(p, p.x, p.y, spec.range).includes(target) || !clearLine(p.x,p.y,target.x,target.y)) {
          cancelled=true;p.lockUntil=Math.min(p.lockUntil,Date.now());p.actUntil=Date.now();p.spearGuard=null;
          fx({t:'spearCancel',skill:sk.id});return;
        }
        const beat=beats[i],last=i===beats.length-1;
        // Snapshot the valid collateral targets before damage can kill the primary.
        const area=beat.area,cx=area?.shape==='cone'?p.x:target.x,cy=area?.shape==='cone'?p.y:target.y;
        const others=area?this.enemiesOf(p,cx,cy,area.radius).filter(e=>e!==target&&!e.dead&&e.mapId===mapId&&
          C.spearAreaContains(area,cx,cy,face,e.x,e.y)&&clearLine(cx,cy,e.x,e.y))
          .sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy)||String(a.id).localeCompare(String(b.id))).slice(0,area.cap):[];
        fx({t:'spearBeat',skill:sk.id,tid:target.id,step:i,final:last,x:target.x,y:target.y,cx,cy,a:face,area});
        let power = beat.power;
        if (!isPlayer(target) && sk.id !== 'spearThrust') power *= C.SPEAR_PVE_MULT;    // PvE-only skill buff; basic attack and PvP untouched
        const opts = {defK:beat.defK,onHitWeight:beat.defK};
        if (last&&sk.id === 'spearBreak') opts.armorBreak = rank ? 0.35 : 0.25;
        if (last&&sk.id === 'spearHeart') { opts.bleed = true; if (rank) opts.slow = 1500; }
        if (last&&sk.id === 'spearCrush' && rank) opts.slow = 1000;
        if (last&&sk.id === 'spearPin') opts.slow = rank ? 2500 : 1500;
        if (sk.id === 'spearBoss' && !isPlayer(target) && target.def.boss) power *= rank ? 1.5 : 1.35;
        const maxHp = isPlayer(target) ? target.stats.maxHp : target.def.hp;
        if (sk.id === 'spearExecution' && maxHp > 0 && target.hp / maxHp <= (rank ? 0.4 : 0.3))
          power *= rank > 1 ? 1.4 : 1.25;
        this.applyDamage(p, target, power * mult, opts);
        for(const e of others){
          // Collateral has its own PvE scaling, no boss/execute bonus or primary-only debuffs.
          const power=beat.power*area.scale*mult*(isPlayer(e)?1:C.SPEAR_PVE_MULT);
          this.applyDamage(p,e,power,{defK:beat.defK*area.scale,onHitWeight:0});
        }
      });
      return;
    }
    // aimed point (target or cursor) clamped to max range
    const aimAt = (max, def) => {
      let tx = Number(d.tx), ty = Number(d.ty);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) { tx = p.x + Math.cos(a) * def; ty = p.y + Math.sin(a) * def; }
      const L = Math.hypot(tx - p.x, ty - p.y);
      if (L > max) { tx = p.x + ((tx - p.x) / L) * max; ty = p.y + ((ty - p.y) / L) * max; }
      return [tx, ty];
    };

    if (sk.ritual) {
      const spec = sk.ritual, mapId = p.mapId, epoch = p.controlEpoch || 0;
      const [x, y] = aimAt(spec.range, spec.range * .7);
      const token = { skill: sk.id, mapId, x, y, epoch, originX: p.x, originY: p.y };
      p.ritual = token; p.moving = false;
      p.lockUntil = p.actUntil = now + spec.cast + spec.recovery;
      fx({ t: 'ritualStart', skill: sk.id, cls: p.cls, a, x, y, radius: spec.radius, cast: spec.cast });
      // the move goes on only while nothing broke it (death, warp, disconnect, stun / root cancel it outright)
      const going = () => {
        if (p.ritual !== token) return false;
        if (!alive() || p.mapId !== mapId || (p.controlEpoch || 0) !== epoch ||
            Date.now() < (p.stunUntil || 0) || Date.now() < (p.rootUntil || 0)) { this.cancelRitual(p); return false; }
        return true;
      };
      // the hits of the move (star lines / afterimages) share spec.share of the damage, the finishing blow the rest
      // (each part takes its share of the target's armour: the parts add up to the old single blast)
      const first = spec.first ?? spec.windup, part = spec.share / spec.hits;
      for (let i = 0; i < spec.hits; i++) this.later(first + i * spec.gap, () => {
        if (going()) this.hitCircle(p, x, y, spec.radius, spec.damage * part * mult, { defK: part });
      });
      this.later(spec.cast, () => {
        if (!going()) return;
        p.ritual = null;
        fx({ t: 'ritualRelease', skill: sk.id, cls: p.cls, a, x, y, radius: spec.radius, recovery: spec.recovery });
        this.hitCircle(p, x, y, spec.radius, spec.damage * (1 - spec.share) * mult, { defK: 1 - spec.share });
      });
      return;
    }
    switch (sk.id) {
      // ---------------- ดาบคู่: every skill fights at arm's length ----------------
      case 'fang': {
        // the basic attack hits ONE enemy: the locked target if it is in reach, else the nearest in front;
        // เขี้ยวคู่พยัคฆ์คลั่ง: every third strike is a heavy cross cut that also clips the enemies round the target
        p.combo = ((p.combo || 0) + 1) % 3;
        const heavy = rank && p.combo === 0;
        fx({ t: 'fang', a, c: heavy ? 2 : p.combo % 2 });
        const tgt = this.slashTarget(p, a, heavy ? 135 : rank ? 150 : 105, heavy ? Math.PI : (68 * Math.PI) / 180, d.tid);
        if (tgt) {
          this.applyDamage(p, tgt, (heavy ? 1.5 : 1) * mult);
          if (heavy)
            for (const e of this.enemiesOf(p, tgt.x, tgt.y, 90))
              if (e !== tgt && dist(e, tgt) <= 80 + radiusOf(e)) this.applyDamage(p, e, 0.6 * mult);
        }
        break;
      }
      case 'lotus': {
        // spins round the body; บัวเหล็กพันกลีบ drags monsters in and the last spin hits harder
        const spins = rank ? 4 : 3, R = rank ? 155 : 135;
        fx({ t: 'lotus', n: spins });
        for (let i = 0; i < spins; i++)
          this.later(i * 200, () => {
            if (!alive()) return;
            if (rank) this.pull(p, 175, 36);
            this.hitCircle(p, p.x, p.y - 10, R, (rank && i === spins - 1 ? 1.3 : 0.78) * mult);
          });
        break;
      }
      case 'shadowstep': {
        // blink behind the target and stab it in the back; no target in reach = a dash cutting through the path
        const tgt = this.slashTarget(p, a, 280, Math.PI, d.tid);
        const x0 = p.x, y0 = p.y;
        let x, y;
        if (tgt) {
          const b = Math.atan2(tgt.y - y0, tgt.x - x0), off = radiusOf(tgt) + 26;
          const bx = tgt.x + Math.cos(b) * off, by = tgt.y + Math.sin(b) * off;
          [x, y] = this.dashEnd(p, b, Math.hypot(bx - x0, by - y0));
          if (Math.hypot(bx - x, by - y) <= 8 && C.canStand(this.mapOf(p), bx, by)) { x = bx; y = by; }
        } else [x, y] = this.dashEnd(p, a, 260);
        const face = tgt ? Math.atan2(tgt.y - y, tgt.x - x) : a;
        p.x = x; p.y = y; p.dir = C.dirFromAngle(face);
        p.lockUntil = now + 200; p.lastInput = now + 200;
        fx({ t: 'shadowstep', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x), y1: Math.round(y), a: face, tid: tgt ? tgt.id : undefined });
        if (tgt) {
          this.later(120, () => { if (alive() && !tgt.dead) this.applyDamage(p, tgt, 1.7 * mult, { slow: 1000 }); });
          if (rank) for (let i = 1; i <= 2; i++) this.later(120 + i * 140, () => { if (alive() && !tgt.dead) this.applyDamage(p, tgt, 0.8 * mult); });
        } else this.hitPath(p, x0, y0, x, y, 46, 1.2 * mult);
        if (rank) this.later(520, () => { if (alive()) this.hitCircle(p, p.x, p.y, 110, 0.9 * mult); });  // shadow burst
        break;
      }
      case 'rend': {
        // a cross cut in front: bleed + broken armour (the target's defence drops for 5 s)
        const range = rank ? 200 : 170, brk = rank ? 0.35 : 0.25;
        fx({ t: 'rend', a });
        p.lockUntil = now + 160;
        this.later(130, () => { if (alive()) this.hitCone(p, a, range, (55 * Math.PI) / 180, 2.1 * mult, { bleed: true, armorBreak: brk }); });
        if (rank) this.later(420, () => { if (alive()) this.hitCone(p, a, range, (65 * Math.PI) / 180, 1.5 * mult, { armorBreak: brk }); });
        break;
      }
      case 'tempest': {
        // spirit blades circle the caster for ~2.6 s and cut round wherever it walks; evolutions end in a blade burst
        const n = [8, 10, 12][rank], R = [170, 200, 230][rank], gap = Math.round(2600 / n);
        fx({ t: 'tempest', n, R, g: gap });
        for (let i = 0; i < n; i++)
          this.later(250 + i * gap, () => { if (alive()) this.hitCircle(p, p.x, p.y - 10, R, 0.8 * mult); });
        if (rank) this.later(250 + n * gap + 150, () => { if (alive()) this.hitCircle(p, p.x, p.y - 10, R + 30, (rank > 1 ? 4 : 2.5) * mult); });
        break;
      }
      case 'crescent': {
        // a wide sweeping arc in front (130°); จันทร์คู่: a second arc back the other way that slows
        const range = rank ? 220 : 190, half = (65 * Math.PI) / 180;
        fx({ t: 'crescent', a, R: range });
        this.later(90, () => { if (alive()) this.hitCone(p, a, range, half, 1.5 * mult); });
        if (rank) this.later(310, () => { if (alive()) this.hitCone(p, a, range, half, 1.2 * mult, { slow: 1000 }); });
        break;
      }
      case 'skyfall': {
        const moveEpoch = p.controlEpoch || 0, startMap = p.mapId;
        // jump (over rivers / rocks too) and crash down on the last standable point toward the aim
        const [tx, ty] = aimAt(280, 200);
        const x0 = p.x, y0 = p.y, L = Math.hypot(tx - x0, ty - y0);
        let x = x0, y = y0;
        for (let s = 8; s <= L; s += 8) {
          const nx = x0 + ((tx - x0) / L) * s, ny = y0 + ((ty - y0) / L) * s;
          if (C.canStand(this.mapOf(p), nx, ny)) { x = nx; y = ny; }
        }
        p.lockUntil = now + 520;
        p.lastInput = now + 520;
        fx({ t: 'skyfall', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x), y1: Math.round(y) });
        this.later(460, () => {
          if (!alive() || (p.controlEpoch || 0) !== moveEpoch || p.mapId !== startMap) return;
          p.x = x; p.y = y;
          this.hitCircle(p, x, y, rank ? 175 : 150, 2 * mult, rank ? { burn: true, stun: 500 } : { stun: 500 });
          if (rank) this.later(320, () => { if (alive()) this.hitCircle(p, x, y, 240, 1.1 * mult); });
        });
        break;
      }
      case 'thousand': {
        // a blur of strikes on ONE enemy in reach (if it falls, the rest cut whatever is in front)
        const tgt = this.slashTarget(p, a, 150, Math.PI, d.tid);
        const n = rank ? 12 : 8, face = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : a;
        p.lockUntil = now + 80 + n * 90; p.dir = C.dirFromAngle(face);
        fx({ t: 'thousand', a: face, n, tid: tgt ? tgt.id : undefined });
        for (let i = 0; i < n; i++)
          this.later(80 + i * 90, () => {
            if (!alive()) return;
            if (tgt && !tgt.dead && dist(tgt, p) <= 220 + radiusOf(tgt)) this.applyDamage(p, tgt, (rank ? 0.5 : 0.45) * mult);
            else this.hitCone(p, face, 150, 0.6, 0.45 * mult);
          });
        if (rank) this.later(80 + n * 90 + 120, () => {
          if (!alive()) return;
          const c = tgt && !tgt.dead ? tgt : p;
          this.hitCircle(p, c.x, c.y, 160, 2.2 * mult);
        });
        break;
      }
      case 'twindragon': {
        // charge 220 px with the twin dragons (cutting the path), then the dragons erupt round the landing point
        const x0 = p.x, y0 = p.y, [x, y] = this.dashEnd(p, a, 220);
        p.x = x; p.y = y;
        p.lockUntil = now + 380; p.lastInput = now + 380;
        fx({ t: 'twindragon', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x), y1: Math.round(y), a });
        this.hitPath(p, x0, y0, x, y, 60, 1.2 * mult);
        const bursts = rank ? [[190, 2.6], [230, 1.4], [270, 1.4]] : [[190, 2.6]];
        bursts.forEach(([R, m], i) => this.later(260 + i * 260, () => {
          if (alive()) this.hitCircle(p, x, y, R, m * mult, rank && !i ? { burn: true } : undefined);
        }));
        break;
      }

      // ---------------- นักพรต: spells from range, party heals and party buffs ----------------
      case 'jade': {
        // a jade talisman flies to ONE enemy (the locked target when in range); ยันต์หยกสามดารา adds two more
        const R = 380;
        const main = this.slashTarget(p, a, R, Math.PI, d.tid);
        const tgts = main ? [main] : [];
        if (rank && main)
          for (const e of this.enemiesOf(p, main.x, main.y, 220).sort((u, v) => dist(u, main) - dist(v, main)))
            if (tgts.length < 3 && e !== main && dist(e, p) <= R + radiusOf(e)) tgts.push(e);
        const [tx, ty] = main ? [main.x, main.y - radiusOf(main) * 0.4] : aimAt(R, R);
        fx({ t: 'jade', a, tx: Math.round(tx), ty: Math.round(ty), ids: tgts.map((e) => e.id) });
        tgts.forEach((e, i) => {
          const fly = 90 + Math.min(320, dist(p, e) * 0.55);
          this.later(fly + i * 40, () => { if (alive() && !e.dead) this.applyDamage(p, e, (i ? 0.68 : 1.3) * mult); });
        });
        break;
      }
      case 'skybolt': {
        const [tx, ty] = aimAt(380, 220);
        p.lockUntil = now + 220;
        fx({ t: 'skybolt', x: Math.round(tx), y: Math.round(ty) });
        if (!rank) this.later(300, () => { if (alive()) this.hitCircle(p, tx, ty, 120, 1.9 * mult); });
        else for (let w = 0; w < 3; w++)  // อสนีเก้าชั้นฟ้า: three waves, each one stuns
          this.later(300 + w * 260, () => { if (alive()) this.hitCircle(p, tx, ty, 170, 0.95 * mult, { stun: 600 }); });
        break;
      }
      case 'mercy': {
        // a small instant group heal, once per cast: the caster and party members in 480 (allies get 20% more),
        // slow / root washed off. บัวทิพย์ฟื้นชีวา heals 35% more at once (no healing over time).
        p.lockUntil = now + 250;
        const who = this.partyNear(p, 480);
        const amount = (q) => Math.round((q.stats.maxHp * 0.08 + p.stats.atk * 1.3 * mult) * (q === p ? C.TAOIST_SELF_HEAL_MULT : 1.2) * (rank ? 1.35 : 1));
        fx({ t: 'mercy', ids: who.map((q) => q.id), x: Math.round(p.x), y: Math.round(p.y) });
        for (const q of who) {
          this.healPlayer(q, amount(q));
          q.slowUntil = q.rootUntil = 0;
          this.sendControl(q);
        }
        break;
      }
      case 'aegis': {
        // party buff: damage taken down (25-30%, evolved 35-40%)
        const who = this.partyNear(p, 480), dur = rank ? 10000 : 8000;
        const guard = (rank ? 0.35 : 0.25) + Math.min(0.05, (sl - 1) * 0.005);
        for (const q of who) this.addBuff(q, 'aegis', dur, { guard }, guard);
        fx({ t: 'aegis', ids: who.map((q) => q.id), d: dur });
        break;
      }
      case 'heavens': {
        // a ritual array at range: enemies inside take damage and slow down, the caster's party inside is healed
        const [tx, ty] = aimAt(380, 200);
        const R = [190, 230, 270][rank], ticks = [7, 9, 11][rank];
        p.lockUntil = now + 300;
        fx({ t: 'heavens', x: Math.round(tx), y: Math.round(ty), R, n: ticks });
        for (let i = 0; i < ticks; i++)
          this.later(350 + i * 420, () => {
            if (!alive()) return;
            this.hitCircle(p, tx, ty, R, 0.85 * mult, { slow: 700 });
            for (const q of this.partyNear(p, 1000))
              if (Math.hypot(q.x - tx, q.y - ty) <= R + 16) this.healPlayer(q, Math.round(q.stats.maxHp * 0.015 + p.stats.atk * 0.2 * mult));
          });
        if (rank)
          this.later(350 + ticks * 420 + 200, () => { if (alive()) this.hitCircle(p, tx, ty, R, (rank > 1 ? 4 : 2.5) * mult); });
        break;
      }
      case 'spiritsword': {
        // spirit sword(s) flying L px in 440 ms, piercing; each enemy hit once per sword
        const L = rank ? 600 : 520, x0 = p.x, y0 = p.y - 24;
        fx({ t: 'spiritsword', a });
        for (const da of rank ? [-0.36, -0.18, 0, 0.18, 0.36] : [0]) {
          const hit = new Set(), b = a + da;
          for (let k = 1; k <= 8; k++)
            this.later(k * 55, () => {
              if (!alive()) return;
              const dd = (L * k) / 8, x = x0 + Math.cos(b) * dd, y = y0 + Math.sin(b) * dd;
              for (const e of this.enemiesOf(p, x, y, 80)) {
                if (hit.has(e.id) || Math.hypot(e.x - x, e.y - radiusOf(e) * 0.4 - y) > 44 + radiusOf(e)) continue;
                hit.add(e.id);
                this.applyDamage(p, e, (rank ? 1.25 : 1.75) * mult);
              }
            });
        }
        break;
      }
      case 'might': {
        // party buff: damage dealt up 15% (evolved 25% and +8% crit)
        const who = this.partyNear(p, 480), dur = rank ? 15000 : 12000;
        const dmg = (rank ? 0.25 : 0.15) + Math.min(0.05, (sl - 1) * 0.005);
        for (const q of who) this.addBuff(q, 'might', dur, { dmg, crit: rank ? 0.08 : 0 }, dmg);
        fx({ t: 'might', ids: who.map((q) => q.id), d: dur });
        break;
      }
      case 'meteor': {
        // meteors fall one after another round the aimed point (C.meteorPoints, the same on every client)
        const [tx, ty] = aimAt(400, 220);
        const n = rank ? 8 : 5, R = rank ? 150 : 130;
        p.lockUntil = now + 300;
        fx({ t: 'meteor', x: Math.round(tx), y: Math.round(ty), n });
        C.meteorPoints(Math.round(tx), Math.round(ty), n).forEach(([x, y], i) =>
          this.later(500 + i * 220, () => { if (alive()) this.hitCircle(p, x, y, R, 1.45 * mult, rank ? { burn: true } : undefined); }));
        if (rank) this.later(500 + n * 220 + 300, () => { if (alive()) this.hitCircle(p, tx, ty, 220, 2.6 * mult); });
        break;
      }
      case 'nirvana': {
        // big group heal: HP, 15% MP to the others, every control state washed off (stun too); evolved: a 40% guard + 5 pulses
        p.lockUntil = now + 300;
        const who = this.partyNear(p, 520);
        fx({ t: 'nirvana', ids: who.map((q) => q.id), x: Math.round(p.x), y: Math.round(p.y) });
        for (const q of who) {
          this.healPlayer(q, Math.round((q.stats.maxHp * 0.25 + p.stats.atk * 3 * mult) * (q === p ? C.TAOIST_SELF_HEAL_MULT : 1.2)));
          if (q !== p) q.mp = Math.min(q.stats.maxMp, q.mp + q.stats.maxMp * 0.15);   // party only: never refunds its own cost
          q.stunUntil = q.rootUntil = q.slowUntil = 0;
          this.sendControl(q);
          if (rank) this.addBuff(q, 'nirvana', 4000, { guard: 0.4 }, 0.4);
        }
        if (rank)
          for (let i = 1; i <= 5; i++)
            this.later(i * 1000, () => {
              if (!alive()) return;
              for (const q of this.partyNear(p, 520)) this.healPlayer(q, Math.round(q.stats.maxHp * 0.03 + p.stats.atk * 0.3 * mult));
            });
        break;
      }

      // ---------------- นักธนู: ranged shots, crit / attack-speed self buffs, a few volleys ----------------
      case 'hawkshot': {
        // one arrow at ONE enemy (the locked target when in range); ศรเหยี่ยวคู่: a second arrow (60%), and every
        // 3rd shot goes through to the next enemy behind the target. พายุเร่งพันศร (gale) adds a shadow arrow nearby.
        const R = 400;
        const main = this.slashTarget(p, a, R, Math.PI, d.tid);
        const [tx, ty] = main ? [main.x, main.y - radiusOf(main) * 0.4] : aimAt(R, R);
        const near = (pick) => this.enemiesOf(p, main.x, main.y, 230).filter((e) => e !== main && pick(e))
          .sort((u, v) => dist(u, main) - dist(v, main))[0] || null;
        let behind = null, echo = null;
        if (rank && main) {
          p.combo = ((p.combo || 0) + 1) % 3;
          if (p.combo === 2) behind = near((e) => dist(e, p) > dist(main, p));
        }
        if (main && this.buffVal(p, 'echo')) echo = near((e) => e !== behind);
        fx({ t: 'hawkshot', a, tx: Math.round(tx), ty: Math.round(ty), ids: main ? [main.id] : [], n: rank ? 2 : 1,
          b: behind ? behind.id : undefined, e: echo ? echo.id : undefined });
        if (main) {
          const fly = 70 + Math.min(260, dist(p, main) * 0.45);
          this.later(fly, () => { if (alive() && !main.dead) this.applyDamage(p, main, 1.1 * mult); });
          if (rank) this.later(fly + 110, () => { if (alive() && !main.dead) this.applyDamage(p, main, 0.6 * mult); });
          if (behind) this.later(fly + 90, () => { if (alive() && !behind.dead) this.applyDamage(p, behind, 0.8 * mult); });
          if (echo) this.later(fly + 60, () => { if (alive() && !echo.dead) this.applyDamage(p, echo, 0.45 * mult); });
        }
        break;
      }
      case 'scatter': {
        // a fan of arrows flying L px in 300 ms; each enemy is hit by one arrow per volley (พายุศรพิรุณ: 2 volleys of 7)
        const n = rank ? 7 : 5, spread = rank ? 0.95 : 0.65, L = rank ? 480 : 420, x0 = p.x, y0 = p.y - 26;
        fx({ t: 'scatter', a, n, L, v: rank ? 2 : 1 });
        for (let v = 0; v < (rank ? 2 : 1); v++) {
          const hit = new Set();
          for (let i = 0; i < n; i++) {
            const b = a + (i / (n - 1) - 0.5) * spread;
            for (let k = 1; k <= 6; k++)
              this.later(v * 260 + k * 50, () => {
                if (!alive()) return;
                const dd = (L * k) / 6, x = x0 + Math.cos(b) * dd, y = y0 + Math.sin(b) * dd;
                for (const e of this.enemiesOf(p, x, y, 70)) {
                  if (hit.has(e.id) || Math.hypot(e.x - x, e.y - radiusOf(e) * 0.4 - y) > 30 + radiusOf(e)) continue;
                  hit.add(e.id);
                  this.applyDamage(p, e, (rank ? 0.95 : 1.2) * mult);
                }
              });
          }
        }
        break;
      }
      case 'hawkeye': {
        // crit buff on the archer (sure = ศรเจาะหัวใจ always crits); evolved: the party nearby gets half
        const dur = rank ? 12000 : 10000, crit = (rank ? 0.25 : 0.15) + Math.min(0.05, (sl - 1) * 0.005), critDmg = rank ? 0.5 : 0.3;
        const who = rank ? this.partyNear(p, 480) : [p];
        for (const q of who)
          if (q === p) this.addBuff(q, 'hawkeye', dur, { crit, critDmg, sure: 1 }, crit);
          else this.addBuff(q, 'hawkeye', dur, { crit: crit / 2, critDmg: critDmg / 2 }, crit / 2);
        fx({ t: 'hawkeye', ids: who.map((q) => q.id), d: dur });
        break;
      }
      case 'gale': {
        // attack-speed buff on the archer (the basic attack fires faster); evolved: + a shadow arrow per basic shot
        const dur = rank ? 10000 : 8000, aspd = (rank ? 0.5 : 0.35) + Math.min(0.11, (sl - 1) * 0.01);
        this.addBuff(p, 'gale', dur, { aspd, echo: rank ? 1 : 0 }, aspd);
        fx({ t: 'gale', ids: [p.id], d: dur });
        break;
      }
      case 'skyrain': {
        // arrows shot into the sky rain down on an area in waves
        const [tx, ty] = aimAt(340, 220);
        const R = [170, 215, 260][rank], waves = [7, 9, 11][rank];
        p.lockUntil = now + 320;
        fx({ t: 'skyrain', x: Math.round(tx), y: Math.round(ty), R, n: waves });
        for (let i = 0; i < waves; i++)
          this.later(420 + i * 220, () => { if (alive()) this.hitCircle(p, tx, ty, R, 0.8 * mult); });
        if (rank)
          this.later(420 + waves * 220 + 200, () => { if (alive()) this.hitCircle(p, tx, ty, R * 0.75, (rank > 1 ? 4.5 : 3) * mult); });
        break;
      }
      case 'deadeye': {
        // an armour-piercing shot at ONE enemy far away; a sure crit while เนตรเหยี่ยว is up (evolved: splits to 2 more)
        const R = 520;
        const main = this.slashTarget(p, a, R, 0.6, d.tid);
        const [tx, ty] = main ? [main.x, main.y - radiusOf(main) * 0.4] : aimAt(R, R);
        const splits = rank && main ? this.enemiesOf(p, main.x, main.y, 200).filter((e) => e !== main)
          .sort((u, v) => dist(u, main) - dist(v, main)).slice(0, 2) : [];
        const sure = this.buffVal(p, 'sure') ? { crit: true } : undefined;
        p.lockUntil = now + 220;
        fx({ t: 'deadeye', a, tx: Math.round(tx), ty: Math.round(ty), ids: main ? [main.id, ...splits.map((e) => e.id)] : [], s: sure ? 1 : 0 });
        if (main) {
          const fly = 180 + Math.min(160, dist(p, main) * 0.25);
          this.later(fly, () => { if (alive() && !main.dead) this.applyDamage(p, main, (rank ? 3.3 : 2.6) * mult, sure); });
          splits.forEach((e, i) => this.later(fly + 120 + i * 60, () => { if (alive() && !e.dead) this.applyDamage(p, e, 1.4 * mult); }));
        }
        break;
      }
      case 'rollshot': {
        // roll 220 px away from the aim, loose 3 (5) arrows forward and shoot faster for 3 s; evolved: a wind bomb behind
        const x0 = p.x, y0 = p.y, [x, y] = this.dashEnd(p, a + Math.PI, 220), n = rank ? 5 : 3;
        p.x = x; p.y = y;
        p.lockUntil = now + 260; p.lastInput = now + 260;
        this.addBuff(p, 'rollshot', 3000, { aspd: 0.2 }, 0.2);
        fx({ t: 'rollshot', x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x), y1: Math.round(y), a, n });
        for (let i = 0; i < n; i++) this.later(200 + i * 90, () => { if (alive()) this.hitCone(p, a, 440, 0.25, 0.9 * mult); });
        if (rank) this.later(320, () => { if (alive()) this.hitCircle(p, x0, y0, 130, 1.3 * mult, { slow: 1500 }); });
        break;
      }
      case 'blast': {
        // a fire arrow arcs onto the point and explodes (burn); ศรอัคนีสามดารา: three blasts in a triangle
        const [tx, ty] = aimAt(420, 260);
        p.lockUntil = now + 240;
        fx({ t: 'blast', a, x: Math.round(tx), y: Math.round(ty) });
        C.blastPoints(Math.round(tx), Math.round(ty), a, rank).forEach(([x, y], i) =>
          this.later(420 + i * 120, () => { if (alive()) this.hitCircle(p, x, y, rank ? 150 : 170, (rank ? 1.6 : 2.2) * mult, { burn: true }); }));
        break;
      }
      case 'stormphoenix': {
        // a giant thunder-phoenix arrow flying 680 px in 720 ms; each enemy is struck up to 3 times and slowed
        const L = 680, steps = 9, x0 = p.x, y0 = p.y - 24, hits = new Map();
        p.lockUntil = now + 320;
        fx({ t: 'stormphoenix', a });
        for (let k = 1; k <= steps; k++)
          this.later(160 + k * 80, () => {
            if (!alive()) return;
            const dd = (L * k) / steps, x = x0 + Math.cos(a) * dd, y = y0 + Math.sin(a) * dd;
            for (const e of this.enemiesOf(p, x, y, 130)) {
              const c = hits.get(e.id) || 0;
              if (c >= 3 || Math.hypot(e.x - x, e.y - radiusOf(e) * 0.4 - y) > 85 + radiusOf(e)) continue;
              hits.set(e.id, c + 1);
              this.applyDamage(p, e, 1.0 * mult, c ? undefined : { slow: 1200 });
            }
          });
        if (rank) this.later(160 + steps * 80 + 150, () => {
          if (alive()) this.hitCircle(p, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L + 20, 230, 3.2 * mult);
        });
        break;
      }
    }
  }

  // ------------------------------------------------------------ buffs (บัพ)
  // p.buffs[id] = { until, k, guard / dmg / crit / critDmg / aspd / echo / sure }; id = the skill that gave it.
  // Recasting refreshes it, but a weaker cast (smaller k) never overwrites a stronger one that is still running.
  addBuff(q, id, ms, vals, k) {
    const now = Date.now(), b = q.buffs || (q.buffs = {}), old = b[id];
    if (old && now < old.until && k < old.k) return false;
    b[id] = { ...vals, k, until: now + ms, dur: ms };
    return true;
  }
  // sum of one value over the running buffs (0 for monsters)
  buffVal(q, key) {
    if (!q.buffs) return 0;
    const now = Date.now();
    let v = 0;
    for (const b of Object.values(q.buffs)) if (now < b.until)
      v = key === 'frontGuard' ? Math.max(v, b[key] || 0) : v + (b[key] || 0);
    return v;
  }
  // [skill id, ms left, full duration] of each running buff, for the HUD
  buffList(p) {
    const now = Date.now(), out = [];
    for (const [id, b] of Object.entries(p.buffs || {})) {
      if (now < b.until) out.push([id, b.until - now, b.dur]);
      else delete p.buffs[id];
    }
    return out;
  }
  critOf(p) { return Math.min(0.85, p.stats.crit + this.buffVal(p, 'crit')); }
  // last standable point up to D px along angle a (dash-type movement stops at walls / water)
  dashEnd(p, a, D) {
    const map = this.mapOf(p);
    let x = p.x, y = p.y;
    for (let s = 8; s <= D; s += 8) {
      const nx = p.x + Math.cos(a) * s, ny = p.y + Math.sin(a) * s;
      if (!C.canStand(map, nx, ny)) break;
      x = nx; y = ny;
    }
    return [x, y];
  }
  // enemies within w of the segment (x0, y0)-(x1, y1): what a dash / charge cuts through
  hitPath(p, x0, y0, x1, y1, w, mult, opts) {
    for (const e of this.enemiesOf(p, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) / 2 + w + 30))
      if (segDist(e.x, e.y, x0, y0, x1, y1) <= w + radiusOf(e)) this.applyDamage(p, e, mult, opts);
  }

  // นักพรต heals / party buffs: the caster and party members near it (allies only on the PvP map)
  partyNear(p, range) {
    const pt = this.partyOf(p), pvp = this.defOf(p).pvp;
    const out = [p];
    if (pt) for (const id of pt.members) {
      const q = this.players.get(id);
      if (q && q !== p && !q.dead && q.mapId === p.mapId && dist(q, p) <= range && (!pvp || q.faction === p.faction)) out.push(q);
    }
    return out;
  }
  healPlayer(q, v) {
    if (q.dead || v <= 0) return;
    const got = Math.min(v, Math.round(q.stats.maxHp - q.hp));
    q.hp = Math.min(q.stats.maxHp, q.hp + v);
    if (got > 0) this.emitNear(q.mapId, q.x, q.y, 'healed', { id: q.id, v: got });
  }

  // monsters around p are dragged toward it (พายุดาบอสนี); bosses don't budge
  pull(p, range, step) {
    const map = this.mapOf(p), def = this.defOf(p);
    for (const m of this.maps[p.mapId].monsters) {
      if (m.dead || m.def.boss) continue;
      const dx = p.x - m.x, dy = p.y - m.y, L = Math.hypot(dx, dy);
      if (L > range || L < 44) continue;
      const k = Math.min(step, L - 40) / L, nx = m.x + dx * k, ny = m.y + dy * k;
      if (C.canStand(map, nx, ny, 16) && !C.noMonster(def, nx, ny)) { m.x = nx; m.y = ny; }
    }
  }


  // ------------------------------------------------------------ items
  validIdx(idx) { return Number.isInteger(idx) && idx >= 0 && idx < C.BAG_SIZE; }

  // consumables (potions, the town scroll): stack in one bag slot, one used off the stack at a time, never equipped
  onUseItem(p, d) {
    if (p.dead || !d || typeof d !== 'object' || !this.validIdx(d.idx) || !this.bagKeyOk(p, d.idx, d.key)) return;
    const it = C.ITEMS[p.inv[d.idx]];
    if (!it || !it.kind) return;
    const now = Date.now();
    const consume = () => { const n = C.stackCount(p.inv[d.idx]); p.inv[d.idx] = n > 1 ? C.stackKey(it.id, n - 1) : null; };
    if (it.kind === 'warp') {
      const def = this.defOf(p);
      if (def.pvp) return this.toast(p, 'ใช้ใบวาร์ปกลับเมืองไม่ได้ในสนามรบ');
      if (now - p.lastHurt < 6000 || (p.pkFight && p.pkFight > now)) return this.toast(p, 'ใช้ใบวาร์ปกลับเมืองไม่ได้ขณะต่อสู้');
      consume();
      this.sendInv(p);
      this.changeMap(p, p.mapId, C.spawnOf(def, p.faction));
      return this.toast(p, 'ใช้ใบวาร์ปกลับเมือง');
    }
    const stat = it.kind === 'mp' ? 'mp' : 'hp', max = stat === 'mp' ? p.stats.maxMp : p.stats.maxHp;
    p.itemCd = p.itemCd || {};
    const left = (p.itemCd[stat] || 0) - now;
    if (left > 0) return this.toast(p, `ใช้${stat === 'mp' ? 'ยามานา' : 'ยาฟื้นพลัง'}ได้อีกใน ${(left / 1000).toFixed(1)} วิ`);
    if (p[stat] >= max) return this.toast(p, `${stat === 'mp' ? 'ปราณ' : 'พลังชีวิต'}เต็มอยู่แล้ว`);
    p[stat] = Math.min(max, p[stat] + max * it.pct);
    p.itemCd[stat] = now + C.ITEM_USE_CD;
    consume();
    this.sendInv(p);
    p.socket.emit('cast', { id: 'pot_' + stat, cd: C.ITEM_USE_CD });
    this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'heal', id: p.id, k: stat });
    this.toast(p, `ใช้ ${it.name}`);
  }
  onEquip(p, d) {
    const obj = d && typeof d === 'object';
    const idx = obj ? d.idx : d;
    if (p.dead || !this.validIdx(idx) || !this.bagKeyOk(p, idx, obj ? d.key : undefined)) return;
    const it = C.ITEMS[p.inv[idx]];
    if (!it || it.kind) return;
    if (p.lvl < it.lvl) return this.toast(p, `ต้องการเลเวล ${it.lvl} เพื่อสวมใส่ ${it.name}`);
    const old = p.eq[it.slot];
    p.eq[it.slot] = it.id;
    p.inv[idx] = old || null;
    this.refreshStats(p);
    this.sendInv(p);
    this.emitEquip(p, it.slot);
    this.toast(p, `สวมใส่ ${it.name}`);
  }
  // สวมของดีที่สุดอัตโนมัติ: pick, among what is worn and what is in the bag (and wearable at this level), the
  // outfit that scores best for the chosen focus (C.AUTO_EQUIP_MODES): first the focus stat of the whole outfit
  // (playerStats, so the crit cap and the option caps count — a 6th exp piece past the cap gains nothing), then
  // the bag-sort quality (level, then grade, then + level) summed over the slots. Slots are improved one at a time
  // until nothing changes; a tie keeps whatever is already worn, so equal gear is never shuffled around.
  onAutoEquip(p, d) {
    if (p.dead) return;
    if (d && C.AUTO_EQUIP_MODES[d.mode]) p.eqMode = d.mode;
    const label = C.AUTO_EQUIP_MODES[p.eqMode].th, changed = this.equipBest(p);
    if (changed) {
      this.sendInv(p);
      this.toast(p, `สวมของดีที่สุด (เน้น${label}) ให้แล้ว ${changed} ชิ้น`);
      this.save(p);
    } else this.toast(p, `สวมของดีที่สุด (เน้น${label}) อยู่แล้วทุกช่อง`);
  }
  // the "สวมอัตโนมัติ" setting (p.autoEquip) after a drop or a level-up: quiet unless something was put on
  // (the caller sends the bag); returns how many slots changed
  autoWear(p) {
    if (!p.autoEquip || p.dead) return 0;
    const changed = this.equipBest(p);
    if (changed) this.toast(p, `สวมของดีกว่าอัตโนมัติ (เน้น${C.AUTO_EQUIP_MODES[p.eqMode].th}) ${changed} ชิ้น`);
    return changed;
  }
  // swaps in the best outfit for p.eqMode, refreshes the stats when anything changed; returns how many slots changed
  equipBest(p) {
    const mode = p.eqMode;
    const eq = { ...p.eq }, pick = {};                         // pick[slot] = bag index to wear there
    const score = () => C.autoEquipScore(p.cls, p.lvl, eq, p.alloc, mode), better = C.autoEquipBetter;
    let best = score();
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const slot of C.SLOTS) {
        let cur = eq[slot];
        for (let i = 0; i < p.inv.length; i++) {
          const it = C.ITEMS[p.inv[i]];
          if (!it || it.kind || it.slot !== slot || it.lvl > p.lvl || pick[slot] === i) continue;
          eq[slot] = it.id;
          const sc = score();
          if (better(sc, best)) { best = sc; pick[slot] = i; cur = it.id; moved = true; } else eq[slot] = cur;
        }
      }
      if (!moved) break;
    }
    let changed = 0;
    for (const slot of C.SLOTS) {
      const i = pick[slot];
      if (i === undefined) continue;                           // bag has nothing better than what's worn
      const old = p.eq[slot];
      p.eq[slot] = p.inv[i];
      p.inv[i] = old || null;
      this.emitEquip(p, slot);
      changed++;
    }
    if (changed) this.refreshStats(p);
    return changed;
  }
  // take an armour piece off (the weapon slot always keeps at least the training blades)
  onUnequip(p, slot) {
    if (p.dead || !C.ARMOR_SLOTS.includes(slot) || !p.eq[slot]) return;
    const it = C.ITEMS[p.eq[slot]];
    if (!this.addItem(p, it.id)) return this.toast(p, 'กระเป๋าเต็ม ถอดไม่ได้');
    p.eq[slot] = null;
    this.refreshStats(p);
    this.sendInv(p);
    this.emitEquip(p, slot);
    this.toast(p, `ถอด ${it.name}`);
  }
  // recompute stats after an equipment change, keeping hp/mp ratios sane
  refreshStats(p) {
    p.stats = C.playerStats(p.cls, p.lvl, p.eq, p.alloc);
    p.hp = Math.min(p.hp, p.stats.maxHp);
    p.mp = Math.min(p.mp, p.stats.maxMp);
    // gear changed how many crit points are still useful: the stat panel's guide follows it
    const lim = JSON.stringify(C.statLimits(p.cls, p.lvl, p.eq, p.alloc));
    if (p.limKey !== undefined && lim !== p.limKey && p.socket) this.sendStat(p);
    p.limKey = lim;
  }
  emitEquip(p, slot) {
    this.emitNear(p.mapId, p.x, p.y, 'fx', {
      t: 'equip', id: p.id, f: p.faction, slot,
      wt: C.ITEMS[p.eq.weapon].tier, wp: C.ITEMS[p.eq.weapon].plus || 0, ar: C.armorTiers(p.eq), gg: C.gearGrades(p.eq), wg: C.ITEMS[p.eq.weapon].grade || 0,
      gp: C.gearPlus(p.eq),
    });
  }

  mapOf(e) { return this.maps[e.mapId].map; }
  defOf(e) { return this.maps[e.mapId].def; }
  nearSmith(p) {
    const s = C.smithOf(this.defOf(p), p.faction);
    return Math.hypot(p.x - s.x, p.y - s.y) < 200;
  }
  nearApothecary(p) {
    const s = C.apothecaryOf(this.defOf(p), p.faction);
    return Math.hypot(p.x - s.x, p.y - s.y) < 200;
  }
  nearEnhancer(p) {
    const s = C.enhancerOf(this.defOf(p), p.faction);
    return Math.hypot(p.x - s.x, p.y - s.y) < 200;
  }

  // ------------------------------------------------------------ maps
  // monsters chasing p let go (map change / logout)
  dropAggro(p) {
    for (const m of this.monsters) if (m.target === p.id || m.threat.has(p.id)) {
      m.threat.delete(p.id);
      if (m.target === p.id) { m.target = null; m.returning = true; }
    }
  }
  changeMap(p, to, pos) {
    const from = { mapId: p.mapId, x: p.x, y: p.y };
    this.changeMapOne(p, to, pos);
    // a leader takes the members following it along (alive, on the old map near it; on the PvP map only its own faction)
    const pt = this.partyOf(p);
    if (!pt || pt.leader !== p.id) return;
    let i = 0;
    for (const id of pt.members) {
      const q = this.players.get(id);
      if (!q || q === p || !q.follow || q.dead || q.mapId !== from.mapId || Math.hypot(q.x - from.x, q.y - from.y) > C.PARTY_RANGE) continue;
      if (this.defOf(p).pvp && q.faction !== p.faction) { this.toast(q, `ตาม ${p.name} เข้าสนามรบไม่ได้ (ต่างฝ่าย)`); continue; }
      const a = (i++ / 8) * Math.PI * 2, spot = { x: p.x + Math.cos(a) * 50, y: p.y + 30 + Math.sin(a) * 30 };
      this.changeMapOne(q, to, C.canStand(this.maps[to].map, spot.x, spot.y) ? spot : { x: p.x, y: p.y });
      this.toast(q, `ติดตาม ${p.name} ไป ${this.defOf(p).name}`);
    }
  }
  changeMapOne(p, to, pos) {
    this.dropAggro(p);
    this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'spawn', id: p.id, f: p.faction });
    p.mapId = to;
    const s = pos || C.spawnOf(this.defOf(p), p.faction);
    Object.assign(p, { x: s.x, y: s.y, dots: [], lockUntil: 0, lastInput: Date.now(), moving: false });
    this.clearControl(p);
    p.socket.emit('mapchange', { id: to, x: p.x, y: p.y });
    this.later(400, () => { if (this.players.get(p.id) === p && p.mapId === to) this.emitNear(to, p.x, p.y, 'fx', { t: 'spawn', id: p.id, f: p.faction }); });
    this.save(p);
  }
  // teleport stone in every camp (and in each faction's base on the PvP map): to = target map id
  onWarp(p, to) {
    if (p.dead || typeof to !== 'string' || !this.maps[to] || to === p.mapId) return;
    const st = C.stoneOf(this.defOf(p), p.faction);
    if (Math.hypot(p.x - st.x, p.y - st.y) > 200) return this.toast(p, 'ต้องอยู่ใกล้ศิลาเคลื่อนย้าย');
    // any map, at any level (the warp list only recommends levels), for a fare that grows with the distance (C.warpCost)
    const cost = C.warpCost(p.mapId, to);
    if (p.gold < cost) return this.toast(p, `ทองไม่พอค่าวาร์ป ${cost.toLocaleString()} ทอง (มี ${p.gold.toLocaleString()})`);
    p.gold -= cost;
    this.sendInv(p);
    this.changeMap(p, to);
    this.toast(p, `จ่ายค่าวาร์ป ${cost.toLocaleString()} ทอง`);
  }
  // walking into a gate at the edge of a hunting map: i = gate index
  onGate(p, i) {
    const gates = this.defOf(p).gates;
    const g = !p.dead && gates && Number.isInteger(i) && gates[i];
    if (!g || Math.hypot(p.x - g.x, p.y - g.y) > 110) return;
    this.changeMap(p, g.to, C.arrival(g.to, p.mapId));
  }
  onShop(p, d) {
    if (!d || p.dead) return;
    const atSmith = this.nearSmith(p), atApoth = this.nearApothecary(p), atEnh = this.nearEnhancer(p);
    if (!atSmith && !atApoth && !atEnh) return this.toast(p, 'ต้องอยู่ใกล้ร้านช่างตีดาบ ร้านขายยา หรือร้านตีบวกในฐานของฝ่ายตัวเอง');
    // ตีบวก / สุ่มออฟชั่นใหม่ happen at the enhancement shop only
    if ((d.act === 'enhance' || d.act === 'reroll') && !atEnh) return this.toast(p, 'ตีบวกและสุ่มออฟชั่นได้ที่ร้านตีบวกเท่านั้น');
    if (d.act === 'buy') {
      const it = C.ITEMS[d.id];
      if (!it || it.plus || it.grade) return;          // d.id always names the base; grade (gear) is picked via d.grade
      if (it.kind && !atApoth) return this.toast(p, `${it.name} ซื้อได้ที่ร้านขายยาเท่านั้น`);
      if (!it.kind && !atSmith) return this.toast(p, `${it.name} ซื้อได้ที่ร้านช่างตีดาบเท่านั้น`);
      if (it.kind) {
        // consumables only: buy a typed quantity at once (potions, the town scroll), stacked straight into the bag
        const n = Math.max(1, Math.min(C.STACK_MAX, Math.floor(Number(d.n)) || 1)), cost = it.price * n;
        if (p.gold < cost) return this.toast(p, `ทองไม่พอ (ต้องการ ${cost.toLocaleString()} ทอง)`);
        if (!this.addItem(p, C.stackKey(it.id, n))) return this.toast(p, 'กระเป๋าเต็ม');
        p.gold -= cost;
        this.toast(p, n > 1 ? `ซื้อ ${it.name} ×${n} แล้ว` : `ซื้อ ${it.name} แล้ว`);
      } else {
        // gear: Normal..Unique only (Legendary/Mythic stay drop-only) — price scales with level and grade
        const grade = Math.max(0, Math.min(C.SHOP_BUY_GRADE_MAX, Math.floor(Number(d.grade)) || 0));
        const cost = C.shopGearPrice(it, grade);   // one formula for every grade so price always climbs with it
        if (p.gold < cost) return this.toast(p, `ทองไม่พอ (ต้องการ ${cost.toLocaleString()} ทอง)`);
        const key = grade ? C.gradeId(it.id, grade) : it.id;
        if (!this.addItem(p, key)) return this.toast(p, 'กระเป๋าเต็ม');
        p.gold -= cost;
        const bought = C.ITEMS[key];
        this.toast(p, grade ? `ซื้อ ${bought.name} [${C.GRADES[grade].name}] แล้ว` : `ซื้อ ${bought.name} แล้ว`);
      }
    } else if (d.act === 'sell') {
      if (!this.validIdx(d.idx) || !this.bagKeyOk(p, d.idx, d.key)) return;
      const it = C.ITEMS[p.inv[d.idx]];
      if (!it) return;
      if (this.isLocked(p, p.inv[d.idx])) return this.toast(p, `${it.name} ถูกล็อกอยู่ ขายไม่ได้`);
      const gold = C.sellPrice(it) * C.stackCount(p.inv[d.idx]);   // a potion stack sells all at once
      p.inv[d.idx] = null;
      p.gold += gold;
      this.toast(p, `ขาย ${it.name} ได้ ${gold.toLocaleString()} ทอง`);
    } else if (d.act === 'sellMany') {
      // the bag's ticked items (inventory.js multi-select) in one go
      const all = this.bagIdxs(p, d.idxs, d.keys), idxs = all.filter((i) => !this.isLocked(p, p.inv[i]));
      if (!idxs.length) return all.length ? this.toast(p, 'ไอเทมที่เลือกถูกล็อกอยู่ทั้งหมด') : undefined;
      let gold = 0;
      for (const i of idxs) { gold += C.sellPrice(C.ITEMS[p.inv[i]]) * C.stackCount(p.inv[i]); p.inv[i] = null; }
      p.gold += gold;
      this.toast(p, `ขาย ${idxs.length} ชิ้น ได้ ${gold.toLocaleString()} ทอง${all.length > idxs.length ? ` (ข้ามที่ล็อก ${all.length - idxs.length} ชิ้น)` : ''}`);
    } else if (d.act === 'buyStone' || d.act === 'sellStone') {
      const S = C.ENH_STONE, n = Math.max(1, Math.min(S.max, Math.floor(Number(d.n)) || 1));   // typed quantity (inventory.js)
      if (d.act === 'buyStone') {
        return this.toast(p, 'ไม่ต้องซื้อหินแล้ว: ร้านตีบวกรวมค่าหินไว้ในราคาตีบวก (ขายหินที่มีอยู่คืนได้)');
        const k = Math.min(n, S.max - p.stones);
        if (k <= 0) return this.toast(p, `${S.name}เต็มแล้ว`);
        if (p.gold < k * S.price) return this.toast(p, 'ทองไม่พอ');
        p.gold -= k * S.price; p.stones += k;
        this.toast(p, `ซื้อ${S.name} ×${k} แล้ว (มี ${p.stones} ก้อน)`);
      } else {
        const k = Math.min(n, p.stones);
        if (k <= 0) return this.toast(p, `ไม่มี${S.name}`);
        p.stones -= k; p.gold += k * S.sell;
        this.toast(p, `ขาย${S.name} ×${k} ได้ ${k * S.sell} ทอง`);
      }
    } else if (d.act === 'buyCharm' || d.act === 'sellCharm') {
      const S = C.ENH_CHARMS[d.k];
      if (!S) return;
      const n = Math.max(1, Math.min(S.max, Math.floor(Number(d.n)) || 1));                   // typed quantity (inventory.js)
      const have = p.charms[d.k] || 0;
      if (d.act === 'buyCharm') {
        if (['stone', 'guard', 'luck', 'reaffix', 'repassive'].includes(S.kind)) return this.toast(p, `ซื้อ${S.name}ไม่ได้แล้ว: ติ๊กยันต์ที่ร้านตีบวกแล้วจ่ายรวมในราคาตีบวก (ขายของที่มีอยู่คืนได้)`);
        const k = Math.min(n, S.max - have);
        if (k <= 0) return this.toast(p, `${S.name}เต็มแล้ว`);
        if (p.gold < k * S.price) return this.toast(p, `ทองไม่พอ (${S.name} ใบละ ${S.price.toLocaleString()} ทอง)`);
        p.gold -= k * S.price; p.charms[d.k] = have + k;
        this.toast(p, `ซื้อ${S.name} ×${k} แล้ว (มี ${p.charms[d.k]} ใบ)`);
      } else {
        const k = Math.min(n, have);
        if (k <= 0) return this.toast(p, `ไม่มี${S.name}`);
        p.charms[d.k] = have - k; p.gold += k * S.sell;
        this.toast(p, `ขาย${S.name} ×${k} ได้ ${(k * S.sell).toLocaleString()} ทอง`);
      }
    } else if (d.act === 'enhance') {
      return this.enhance(p, d);
    } else if (d.act === 'reroll') {
      return this.reroll(p, d);
    } else return;
    this.sendInv(p);
    this.save(p);
  }
  // bag setting (anywhere): d.grades = the grade indexes to sell the moment they drop
  onAutoSell(p, d) {
    p.autoSell = C.cleanAutoSell(d && d.grades);
    this.toast(p, p.autoSell.length ? `ขายอัตโนมัติ: ${p.autoSell.map((g) => C.GRADES[g].name).join(', ')}` : 'ปิดขายอัตโนมัติ');
    this.sendInv(p);
    this.save(p);
  }
  // enhancement at the ร้านตีบวก (weapon + the 4 armour pieces): d.where = 'eq' with d.slot (worn) | 'inv' with d.idx.
  // d.guard / d.luck: use one ยันต์กันแตก / ยันต์เพิ่มโอกาส on this attempt (used up whatever the result).
  // One gold payment (C.ENHANCE.quote): fee + the stones + any ticked talisman, owned stones / talismans used first.
  // The success chance falls with every + level; a failed try may break or demote the item (see below).
  enhance(p, d) {
    const fromBag = d.where === 'inv';
    const slot = fromBag ? null : C.SLOTS.includes(d.slot) ? d.slot : 'weapon';
    if (fromBag && (!this.validIdx(d.idx) || !this.bagKeyOk(p, d.idx, d.key))) return;
    const key = fromBag ? p.inv[d.idx] : p.eq[slot];
    const it = C.ITEMS[key];
    if (!C.ENHANCE.canEnhance(it)) return this.toast(p, 'ตีบวกได้เฉพาะอาวุธและชุดสวมใส่');
    const plus = it.plus || 0;
    if (plus >= C.MAX_PLUS) return this.toast(p, `${it.name} ตีบวกสูงสุดแล้ว`);
    // materials of the item's own tier (C.matTier: basic < Lv.60 · mid Lv.60-99 · high Lv.100+)
    const base = C.ITEMS[C.parseId(key).id], tier = C.matTier(base.lvl || 1);
    // materials of another tier never enhance anything (d.tier = the tier the shop meant to pay with)
    if (d.tier !== undefined && Number(d.tier) !== tier)
      return this.toast(p, `วัสดุผิดขั้น: ${it.name} Lv.${base.lvl} ใช้หินและยันต์${C.MAT_TIERS[tier].th}เท่านั้น`);
    const guard = !!d.guard, luck = !!d.luck, gk = C.matKey('guard', tier), lk = C.matKey('luck', tier);
    const q = C.ENHANCE.quote(p, base, plus, { guard, luck, item: it });
    // d.total = the price the shop showed: never charge more than that (e.g. stones sold meanwhile)
    if (d.total !== undefined && q.total > Number(d.total)) return this.toast(p, 'ราคาเปลี่ยนแล้ว กรุณากดตีบวกอีกครั้ง');
    if (p.gold < q.total) return this.toast(p, `ทองไม่พอ (ตีบวกครั้งนี้ ${q.total.toLocaleString()} ทอง)`);
    if (q.ownStones) { if (tier) p.charms[C.matKey('stone', tier)] -= q.ownStones; else p.stones -= q.ownStones; }
    if (q.guardOwn) p.charms[gk]--;
    if (q.luckOwn) p.charms[lk]--;
    p.gold -= q.total;
    const ok = Math.random() < C.ENHANCE.rateWith(plus, luck);
    const soft = plus >= C.ENHANCE.softPlusMin && plus <= C.ENHANCE.softPlusMax;
    let saved = false, demoted = false, broke = false, next = plus;
    if (ok) next = plus + 1;
    else if (guard) saved = true;                                             // the guard talisman took the hit
    else if (soft) {
      // +1..+6, no guard: outright break happens less often than a "soft" fail (C.ENHANCE.softBreakChance < 0.5);
      // a soft fail then splits 50/50 between keeping the level and dropping it by one — dropping from +1 breaks it instead
      if (Math.random() < C.ENHANCE.softBreakChance) broke = true;
      else if (Math.random() < C.ENHANCE.softDemoteChance) {
        if (plus - 1 <= 0) broke = true; else { demoted = true; next = plus - 1; }
      }
    } else broke = true;
    const nk = broke ? null : C.plusId(key, next);
    if (fromBag) p.inv[d.idx] = nk;
    else {
      p.eq[slot] = nk || (slot === 'weapon' ? 'w0' : null);      // a destroyed weapon leaves the training blades
      this.refreshStats(p);
    }
    this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'enh', id: p.id, f: p.faction, ok: ok ? 1 : 0, plus: broke ? 0 : next, eq: fromBag ? 0 : 1, wt: base.tier || 0, broke: broke ? 1 : 0 });
    if (!fromBag) this.emitEquip(p, slot);
    if (ok) this.toast(p, `ตีบวกสำเร็จ! ${C.ITEMS[nk].name}`);
    else if (broke) this.toast(p, `ตีบวกล้มเหลว... ${it.name} แตกสลายหายไป`);
    else if (saved) this.toast(p, `ตีบวกล้มเหลว · ${C.ENH_CHARMS[gk].name}คุ้มครองไว้ ${it.name} ไม่แตก`);
    else if (demoted) this.toast(p, `ตีบวกล้มเหลว · ${it.name} ลดระดับเหลือ +${next}`);
    else this.toast(p, 'ตีบวกล้มเหลว (ระดับคงเดิม)');
    if (ok && next >= 8) this.systemChat(`⚡ ${p.name} ตีบวก "${C.ITEMS[nk].name}" สำเร็จ!`, C.ITEMS[nk], next >= C.MAX_PLUS);
    if (broke && plus >= 7) this.systemChat(`💥 ${p.name} ตีบวก "${it.name}" ล้มเหลว ไอเทมแตกสลาย`, it);
    this.sendInv(p);
    this.save(p);
  }
  // หินสุ่มออฟชั่น / หินสุ่มสกิลติดตัว: d.kind = 'affix' (green-font stat bonuses, Rare+) or 'passive' (✦ skill +
  // ◆ special option, Legendary+). Re-seeds just that part (C.gradedItem's aSeed/pSeed) — base stats, grade, +
  // level and the OTHER random part never change. Same d.where/idx/slot addressing as enhance().
  reroll(p, d) {
    const fromBag = d.where === 'inv';
    const slot = fromBag ? null : C.SLOTS.includes(d.slot) ? d.slot : 'weapon';
    if (fromBag && (!this.validIdx(d.idx) || !this.bagKeyOk(p, d.idx, d.key))) return;
    const key = fromBag ? p.inv[d.idx] : p.eq[slot];
    const it = C.ITEMS[key];
    if (!it || !it.grade) return this.toast(p, 'สุ่มใหม่ได้เฉพาะไอเทมเกรด Rare ขึ้นไป');
    const kind = d.kind === 'passive' ? 'passive' : 'affix';
    const G = C.GRADES[it.grade];
    if (kind === 'affix' && !G.affix[1]) return this.toast(p, `${it.name} ไม่มีออฟชั่นให้สุ่มใหม่ (ต้อง Rare ขึ้นไป)`);
    if (kind === 'passive' && !G.passive) return this.toast(p, `${it.name} ไม่มีสกิลติดตัวให้สุ่มใหม่ (ต้อง Legendary ขึ้นไป)`);
    const base = C.ITEMS[C.parseId(key).id], tier = C.matTier(base.lvl || 1);
    // an owned stone of the item's tier first, otherwise the ร้านตีบวก price in gold (C.ENHANCE.rerollPrice)
    const mk = C.matKey(kind === 'affix' ? 'reaffix' : 'repassive', tier), cost = C.ENHANCE.rerollPrice(base, kind);
    if (p.charms[mk] > 0) p.charms[mk]--;
    else if (p.gold < cost) return this.toast(p, `ทองไม่พอ (สุ่ม${kind === 'affix' ? 'ออฟชั่น' : 'สกิลติดตัว'}ใหม่ ${cost.toLocaleString()} ทอง)`);
    else p.gold -= cost;
    const k = C.parseId(key);
    const nk = kind === 'affix' ? C.makeKey(k.id, k.grade, k.seed, k.plus, C.newSeed(), k.pSeed)
      : C.makeKey(k.id, k.grade, k.seed, k.plus, k.aSeed, C.newSeed());
    if (fromBag) p.inv[d.idx] = nk;
    else { p.eq[slot] = nk; this.refreshStats(p); }
    if (!fromBag) this.emitEquip(p, slot);
    this.toast(p, `สุ่ม${kind === 'affix' ? 'ออฟชั่น' : 'สกิลติดตัว'}ใหม่ให้ ${C.ITEMS[nk].name} แล้ว`);
    this.sendInv(p);
    this.save(p);
  }

  // idx = one bag slot, or an array of slots (the bag's ticked items)
  // idx: a slot · [slots] · { idx, key } · { idxs, keys }
  onDiscard(p, d) {
    let idx = d, keys;
    if (d && typeof d === 'object' && !Array.isArray(d)) { idx = d.idxs || d.idx; keys = d.idxs ? d.keys : [d.key]; if (!d.idxs) idx = [idx]; }
    if (Array.isArray(idx)) {
      const all = this.bagIdxs(p, idx, keys), idxs = all.filter((i) => !this.isLocked(p, p.inv[i]));
      if (!idxs.length) return all.length ? this.toast(p, 'ไอเทมที่เลือกถูกล็อกอยู่ทั้งหมด') : undefined;
      for (const i of idxs) p.inv[i] = null;
      this.toast(p, `ทิ้ง ${idxs.length} ชิ้นแล้ว${all.length > idxs.length ? ` (ข้ามที่ล็อก ${all.length - idxs.length} ชิ้น)` : ''}`);
      return this.sendInv(p);
    }
    if (!this.validIdx(idx) || !p.inv[idx]) return;
    const it = C.ITEMS[p.inv[idx]];
    if (this.isLocked(p, p.inv[idx])) return this.toast(p, `${it.name} ถูกล็อกอยู่ ทิ้งไม่ได้`);
    p.inv[idx] = null;
    this.toast(p, `ทิ้ง ${it.name} แล้ว`);
    this.sendInv(p);
  }
  // distinct valid bag slots that hold an item, from a client-sent list
  // keys (optional, same order) = the items the client saw there: any mismatch refuses the whole list
  bagIdxs(p, list, keys) {
    if (!Array.isArray(list)) return [];
    if (Array.isArray(keys) && list.some((i, k) => p.inv[i] !== keys[k])) { this.bagStale(p); return []; }
    return [...new Set(list.slice(0, C.BAG_SIZE))].filter((i) => this.validIdx(i) && p.inv[i] && C.ITEMS[p.inv[i]]);
  }

  // gold + maybe an item of one kill. opts.at = the monster: in a party with the item rule 'party'
  // (C.PARTY_ITEM_MODES, แบบ Ragnarok) the members near it split the gold evenly and the item goes to one of them at random
  rollLoot(p, type, opts = {}) {
    const D = C.DROPS[type];
    if (!D) return;
    const base = (D.gold[0] + Math.random() * (D.gold[1] - D.gold[0])) * (opts.goldScale ?? 1);
    let item = null;
    if (!opts.noItem) {
      if (D.pickOne) {
        let r = Math.random() * D.items.reduce((a, [, w]) => a + w, 0);
        for (const [id, w] of D.items) { r -= w; if (r <= 0) { item = id; break; } }
        item = item || D.items[0][0];
      } else {
        for (const [id, ch] of D.items) if (Math.random() < ch) { item = id; break; }
      }
    }
    if (item) {
      // grade: Epic+ on any item of the monster's own table (C.canDropHigh); bosses always Unique+
      const mon = C.MONSTERS[type];
      item = C.gradeId(item, C.rollGrade(mon.lvl, C.ITEMS[item].lvl, !!mon.boss));
    }
    // opts.recipients (e.g. every boss contributor, regardless of party) overrides the usual party-near split
    const near = opts.recipients || (opts.at && this.partyRules(p).item === 'party' ? this.expGroup(p, opts.at.mapId, opts.at.x, opts.at.y) : [p]);
    if (near.length < 2) return this.giveLoot(p, base, item);
    // the item: round-robin turn in party member order (fair, predictable, not random, not damage/distance-weighted).
    // the sequence is always the FULL party roster (fixed length), never the "near" subset — unlike the old code,
    // whether someone is in range right now cannot shift what position everyone else's turn lands on.
    // one whose bag is full (and who would keep it) is skipped for now, the pointer still only advances past the winner
    let to = null;
    if (item) {
      // the turn counter lives on the party normally, or on opts.turnHolder (the boss itself) for boss kills
      const turnHolder = opts.turnHolder || this.partyOf(p) || {};
      const pt = this.partyOf(p);
      const roster = pt ? pt.members : near.map((q) => q.id);
      const nearIds = new Set(near.map((q) => q.id));
      const turn = (turnHolder.lootTurn || 0) % roster.length;
      const order = [];
      for (let i = 0; i < roster.length; i++) {
        const id = roster[(turn + i) % roster.length];
        if (nearIds.has(id)) order.push(this.players.get(id));
      }
      to = order.find((q) => (q.autoSell || []).includes(C.ITEMS[item].grade || 0) || q.inv.includes(null)) || order[0];
      turnHolder.lootTurn = (roster.indexOf(to.id) + 1) % roster.length;
    }
    for (const q of near) this.giveLoot(q, base / near.length, q === to ? item : null, false);
    // Unique+ already went to everyone (giveLoot → systemChat)
    if (to && !(to.autoSell || []).includes(C.ITEMS[item].grade || 0) && (C.ITEMS[item].grade || 0) < 3) {
      const it = C.ITEMS[item], text = `${to.name} ได้รับ ${it.name}${it.grade ? ` [${C.GRADES[it.grade].name}]` : ''}`, pt = this.partyOf(p);
      if (pt) this.partyNotice(pt, text, it);
      else for (const q of near) q.socket.emit('chat', { sys: 1, t: text, ...this.chatItem(it) });   // boss contributors without a party
    }
  }
  // one player's part of a kill: gold (+ own gold bonus) and maybe an item (auto-sold when its grade is ticked).
  // log = put a gear drop below Unique in the own chat (own: 1, the client hides grades under its chosen lowest one);
  // Unique+ are announced to everyone, a shared kill has its own party notice
  giveLoot(p, baseGold, item, log = true) {
    const gold = Math.round(baseGold * (1 + (p.stats.fx.gold || 0)));
    p.gold += gold;
    let got = null, sold = null, soldGold = 0;
    if (item) {
      // auto-sell: the picked grades turn straight into gold (works anywhere, even with a full bag)
      if ((p.autoSell || []).includes(C.ITEMS[item].grade || 0)) {
        sold = item; soldGold = C.sellPrice(C.ITEMS[item]); p.gold += soldGold;
      } else if (this.addItem(p, item)) got = item;
      else this.toast(p, `กระเป๋าเต็ม! ${C.ITEMS[item].name} หล่นหาย`);
    }
    p.socket.emit('loot', sold ? { gold, item: null, sold, soldGold } : { gold, item: got });
    const it = got && C.ITEMS[got];
    if (it && it.grade >= 3)
      this.systemChat(`✨ ${p.name} ได้รับ${C.SLOT_NAMES[it.slot]}ระดับ ${C.GRADES[it.grade].name} "${it.name}"!`, it, it.grade >= 5);
    else if (it && log && !it.kind) p.socket.emit('chat', { sys: 1, own: 1, t: `ได้รับ ${it.name} [${C.GRADES[it.grade || 0].name}]`, ...this.chatItem(it) });
    if (it && !it.kind) this.autoWear(p);
    this.sendInv(p);
  }

  // ------------------------------------------------------------ party (either faction, up to C.PARTY_MAX)
  partyOf(p) { return (p.party && this.parties.get(p.party)) || null; }
  // online player by exact name, otherwise the first whose name starts with it
  findPlayer(name) {
    const q = String(name || '').trim().toLowerCase();
    if (!q) return null;
    let part = null;
    for (const p of this.players.values()) {
      const n = p.name.toLowerCase();
      if (n === q) return p;
      if (!part && n.startsWith(q)) part = p;
    }
    return part;
  }
  onParty(p, d) {
    if (!d || typeof d !== 'object') return;
    switch (d.cmd) {
      case 'invite': return this.partyInvite(p, d.id ? this.players.get(d.id) : this.findPlayer(d.name));
      case 'accept': return this.partyAccept(p, String(d.from || ''));
      case 'decline': return this.partyDecline(p, String(d.from || ''), !!d.timeout);
      case 'request': return this.partyRequest(p, d.id ? this.players.get(d.id) : this.findPlayer(d.name));
      case 'approve': return this.partyApprove(p, String(d.from || ''));
      case 'deny': return this.partyDeny(p, String(d.from || ''), !!d.timeout);
      case 'leave': return this.partyLeave(p);
      case 'kick': return this.partyKick(p, d.id ? this.players.get(d.id) : this.findPlayer(d.name));
      case 'rules': return this.partySetRules(p, d);
      case 'follow': return this.partyFollow(p, !!d.on);
    }
  }
  // the member whose level is more than C.PARTY_LVL_GAP away from q's (the party, or just the inviter), if any
  partyGapOf(q, from) {
    const pt = this.partyOf(from), members = pt ? pt.members.map((id) => this.players.get(id)).filter(Boolean) : [from];
    return members.find((m) => Math.abs(m.lvl - q.lvl) > C.PARTY_LVL_GAP) || null;
  }
  partyInvite(p, q) {
    if (!q || q === p) return this.toast(p, 'ไม่พบผู้เล่นที่ออนไลน์ชื่อนี้');
    const pt = this.partyOf(p);
    if (pt && pt.leader !== p.id) return this.toast(p, 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่ชวนสมาชิกได้');
    if (pt && pt.members.length >= C.PARTY_MAX) return this.toast(p, `ปาร์ตี้เต็มแล้ว (${C.PARTY_MAX} คน)`);
    if (q.party) return this.toast(p, `${q.name} อยู่ในปาร์ตี้อื่นแล้ว`);
    const gap = this.partyGapOf(q, p);
    if (gap) return this.toast(p, `ชวนไม่ได้: ${q.name} Lv.${q.lvl} ห่างจาก ${gap === p ? 'คุณ' : gap.name} Lv.${gap.lvl} เกิน ${C.PARTY_LVL_GAP} เลเวล`);
    if (!q.invites) q.invites = new Map();
    // joining always needs the invitee's answer (popup: accept / decline); one pending invite per inviter
    if ((q.invites.get(p.id) || 0) > Date.now()) return this.toast(p, `ส่งคำเชิญถึง ${q.name} แล้ว กำลังรอการตอบรับ`);
    q.invites.set(p.id, Date.now() + C.PARTY_INVITE_MS);
    q.socket.emit('partyInvite', { from: p.id, name: p.name, lvl: p.lvl, cls: p.cls, f: p.faction,
      size: pt ? pt.members.length : 1, ttl: C.PARTY_INVITE_MS, rules: pt ? pt.rules : C.PARTY_DEFAULT });
    this.toast(p, `ส่งคำเชิญปาร์ตี้ถึง ${q.name} แล้ว รอการตอบรับ`);
  }
  partyAccept(p, fromId) {
    const until = p.invites && p.invites.get(fromId);
    if (p.invites) p.invites.delete(fromId);
    const from = this.players.get(fromId);
    if (!until || until < Date.now() || !from) return this.toast(p, 'คำเชิญปาร์ตี้หมดอายุแล้ว');
    if (p.party) return this.toast(p, 'คุณอยู่ในปาร์ตี้อยู่แล้ว');
    let pt = this.partyOf(from);
    if (pt && pt.leader !== from.id) return this.toast(p, 'คำเชิญปาร์ตี้หมดอายุแล้ว');
    if (pt && pt.members.length >= C.PARTY_MAX) return this.toast(p, 'ปาร์ตี้เต็มแล้ว');
    const gap = this.partyGapOf(p, from);                  // levels may have changed while the invite waited
    if (gap) return this.toast(p, `เข้าปาร์ตี้ไม่ได้: เลเวลห่างจาก ${gap.name} Lv.${gap.lvl} เกิน ${C.PARTY_LVL_GAP} เลเวล`);
    if (!pt) {
      pt = { id: 'pt' + this.partySeq++, leader: from.id, members: [from.id], rules: { ...C.PARTY_DEFAULT } };
      this.parties.set(pt.id, pt);
      from.party = pt.id;
    }
    pt.members.push(p.id);
    p.party = pt.id;
    p.invites.clear();
    this.partyNotice(pt, `${p.name} เข้าร่วมปาร์ตี้`);
    this.sendParty(pt);
  }
  partyDecline(p, fromId, timeout) {
    if (!p.invites || !p.invites.has(fromId)) return;
    p.invites.delete(fromId);
    const from = this.players.get(fromId);
    if (from) this.toast(from, timeout ? `${p.name} ไม่ได้ตอบรับคำเชิญปาร์ตี้` : `${p.name} ปฏิเสธคำเชิญปาร์ตี้`);
  }
  // ขอเข้าร่วมปาร์ตี้: the other direction of partyInvite — p asks to join q's party (or q directly, if solo).
  // Always routed to the party's leader so it doesn't matter which member p clicked on.
  partyRequest(p, q) {
    if (!q || q === p) return this.toast(p, 'ไม่พบผู้เล่นที่ออนไลน์ชื่อนี้');
    if (p.party) return this.toast(p, 'คุณอยู่ในปาร์ตี้อยู่แล้ว');
    const pt = this.partyOf(q);
    const leader = pt ? this.players.get(pt.leader) : q;
    if (!leader) return this.toast(p, 'ไม่พบหัวหน้าปาร์ตี้');
    if (pt && pt.members.length >= C.PARTY_MAX) return this.toast(p, `ปาร์ตี้เต็มแล้ว (${C.PARTY_MAX} คน)`);
    const gap = this.partyGapOf(p, leader);
    if (gap) return this.toast(p, `ขอเข้าร่วมไม่ได้: เลเวลห่างจาก ${gap === leader ? leader.name : gap.name} Lv.${gap.lvl} เกิน ${C.PARTY_LVL_GAP} เลเวล`);
    if (!leader.partyRequests) leader.partyRequests = new Map();
    // one pending request per requester, same cooldown window as an invite
    if ((leader.partyRequests.get(p.id) || 0) > Date.now()) return this.toast(p, `ส่งคำขอเข้าร่วมถึง ${leader.name} แล้ว กำลังรอการตอบรับ`);
    leader.partyRequests.set(p.id, Date.now() + C.PARTY_INVITE_MS);
    leader.socket.emit('partyRequest', { from: p.id, name: p.name, lvl: p.lvl, cls: p.cls, f: p.faction,
      size: pt ? pt.members.length : 1, ttl: C.PARTY_INVITE_MS });
    this.toast(p, `ส่งคำขอเข้าร่วมปาร์ตี้ถึง ${leader.name} แล้ว รอการตอบรับ`);
  }
  partyApprove(leader, fromId) {
    const until = leader.partyRequests && leader.partyRequests.get(fromId);
    if (leader.partyRequests) leader.partyRequests.delete(fromId);
    const p = this.players.get(fromId);
    if (!until || until < Date.now() || !p) return this.toast(leader, 'คำขอเข้าร่วมหมดอายุแล้ว');
    if (p.party) return this.toast(leader, `${p.name} อยู่ในปาร์ตี้อื่นแล้ว`);
    let pt = this.partyOf(leader);
    if (pt && pt.leader !== leader.id) return this.toast(leader, 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่อนุมัติคำขอเข้าร่วมได้');
    if (pt && pt.members.length >= C.PARTY_MAX) return this.toast(leader, 'ปาร์ตี้เต็มแล้ว');
    const gap = this.partyGapOf(p, leader);                // levels may have changed while the request waited
    if (gap) return this.toast(leader, `รับเข้าปาร์ตี้ไม่ได้: เลเวลห่างจาก ${gap.name} Lv.${gap.lvl} เกิน ${C.PARTY_LVL_GAP} เลเวล`);
    if (!pt) {
      pt = { id: 'pt' + this.partySeq++, leader: leader.id, members: [leader.id], rules: { ...C.PARTY_DEFAULT } };
      this.parties.set(pt.id, pt);
      leader.party = pt.id;
    }
    pt.members.push(p.id);
    p.party = pt.id;
    this.partyNotice(pt, `${p.name} เข้าร่วมปาร์ตี้`);
    this.sendParty(pt);
  }
  partyDeny(leader, fromId, timeout) {
    if (!leader.partyRequests || !leader.partyRequests.has(fromId)) return;
    leader.partyRequests.delete(fromId);
    const p = this.players.get(fromId);
    if (p) this.toast(p, timeout ? `${leader.name} ไม่ได้ตอบรับคำขอเข้าร่วม` : `${leader.name} ปฏิเสธคำขอเข้าร่วมปาร์ตี้`);
  }
  // leaving / kicked / disconnected; a party left with one member is disbanded, a leaving leader hands over
  partyLeave(p, why) {
    const pt = this.partyOf(p);
    p.party = null;
    p.follow = false;
    if (!pt) return;
    pt.members = pt.members.filter((id) => id !== p.id);
    p.socket.emit('party', null);
    if (pt.members.length < 2) {
      for (const id of pt.members) {
        const q = this.players.get(id);
        if (!q) continue;
        q.party = null;
        q.socket.emit('party', null);
        this.toast(q, 'ปาร์ตี้ถูกยุบแล้ว');
      }
      this.parties.delete(pt.id);
      return;
    }
    let msg = why || `${p.name} ออกจากปาร์ตี้`;
    if (pt.leader === p.id) {
      pt.leader = pt.members[0];
      msg += ` · ${this.players.get(pt.leader).name} เป็นหัวหน้าปาร์ตี้คนใหม่`;
    }
    this.partyNotice(pt, msg);
    this.sendParty(pt);
  }
  partyKick(p, q) {
    const pt = this.partyOf(p);
    if (!pt) return this.toast(p, 'คุณไม่ได้อยู่ในปาร์ตี้');
    if (pt.leader !== p.id) return this.toast(p, 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่เชิญสมาชิกออกได้');
    if (!q || q === p || q.party !== pt.id) return this.toast(p, 'ไม่พบสมาชิกคนนี้ในปาร์ตี้');
    this.toast(q, 'คุณถูกเชิญออกจากปาร์ตี้');
    this.partyLeave(q, `${q.name} ถูกเชิญออกจากปาร์ตี้`);
  }
  // the leader picks how EXP (d.exp) and loot (d.item) of kills are shared (C.PARTY_EXP_MODES / C.PARTY_ITEM_MODES)
  partySetRules(p, d) {
    const pt = this.partyOf(p);
    if (!pt) return this.toast(p, 'คุณไม่ได้อยู่ในปาร์ตี้');
    if (pt.leader !== p.id) return this.toast(p, 'เฉพาะหัวหน้าปาร์ตี้เท่านั้นที่ตั้งค่าการแบ่งได้');
    const changed = [];
    if (C.PARTY_EXP_MODES[d.exp] && d.exp !== pt.rules.exp) { pt.rules.exp = d.exp; changed.push(`EXP: ${C.PARTY_EXP_MODES[d.exp].name}`); }
    if (C.PARTY_ITEM_MODES[d.item] && d.item !== pt.rules.item) { pt.rules.item = d.item; changed.push(`ไอเทม: ${C.PARTY_ITEM_MODES[d.item].name}`); }
    if (!changed.length) return;
    this.partyNotice(pt, `หัวหน้าเปลี่ยนการแบ่ง → ${changed.join(' · ')}`);
    this.sendParty(pt);
  }
  // a member walks with the leader and helps it fight (client: follow.js); the server only carries the flag,
  // sends the leader's spot / target in the party state and takes followers along when the leader changes map
  partyFollow(p, on) {
    const pt = this.partyOf(p);
    if (on && (!pt || pt.leader === p.id)) return this.toast(p, 'ติดตามได้เฉพาะสมาชิกปาร์ตี้ที่ไม่ใช่หัวหน้า');
    if (!!p.follow === on) return;
    p.follow = on;
    if (pt) this.sendParty(pt);
  }
  partyNotice(pt, text, it) {
    const m = { sys: 1, ch: 'p', t: `[ปาร์ตี้] ${text}`, ...this.chatItem(it) };
    for (const id of pt.members) { const q = this.players.get(id); if (q) q.socket.emit('chat', m); }
  }
  partyChat(p, text, link = {}) {
    const pt = this.partyOf(p);
    if (!pt) return this.toast(p, 'คุณไม่ได้อยู่ในปาร์ตี้');
    if (!text) return;
    for (const id of pt.members) { const q = this.players.get(id); if (q) q.socket.emit('chat', { n: p.name, f: p.faction, t: text, ch: 'p', ...link }); }
  }
  // members' HP/MP/level/map, sent to every member twice a second
  sendParty(pt) {
    const list = pt.members.map((id) => this.players.get(id)).filter(Boolean);
    const m = list.map((q) => ({
      id: q.id, n: q.name, lvl: q.lvl, hp: Math.ceil(q.hp), mhp: q.stats.maxHp, mp: Math.floor(q.mp), mmp: q.stats.maxMp,
      map: q.mapId, dead: q.dead ? 1 : 0, x: Math.round(q.x), y: Math.round(q.y), fo: q.follow ? 1 : 0,
      t: q.id === pt.leader && q.lastHit && Date.now() - q.lastHitAt < 4000 ? q.lastHit : null,   // what the leader is fighting
    }));
    for (const q of list) q.socket.emit('party', { leader: pt.leader, rules: pt.rules, m });
  }

  // ------------------------------------------------------------ GM / test tools
  // GM replies never go to the chat log: the client shows them in the GM panel / as a toast
  gmReply(p, text) { p.socket.emit('gmmsg', text); }

  // item by id (w5 / sh3), weapon level (50), weapon tier (5) or part of its Thai name
  resolveItem(q) {
    q = String(q || '').trim().toLowerCase();
    if (C.ITEMS[q]) return q;
    const n = Number(q);
    if (Number.isInteger(n)) {
      const byLvl = C.WEAPONS.find((w) => w.lvl === n && n >= 10);
      if (byLvl) return byLvl.id;
      if (C.WEAPON_BY_TIER[n]) return C.WEAPON_BY_TIER[n].id;
    }
    const byName = q && C.ALL_ITEMS.find((w) => w.name.toLowerCase().includes(q));
    return byName ? byName.id : null;
  }
  // grade by index (0-5) or name (normal / rare / epic / unique / legendary / mythic, English or Thai); null = none given
  resolveGrade(q) {
    q = String(q ?? '').trim().toLowerCase();
    if (!q) return null;
    const n = Number(q);
    if (Number.isInteger(n)) return n >= 0 && n < C.GRADES.length ? n : -1;
    return C.GRADES.findIndex((g) => g.name.toLowerCase().startsWith(q) || g.th.startsWith(q));
  }
  // Armour set by required level, legacy tier, explicit tier:N, or part of its name.
  resolveSet(q) {
    q = String(q || '').trim().toLowerCase();
    const n = Number(q);
    let i = -1;
    if (/^tier:\d+$/.test(q)) {
      const tier = Number(q.slice(5));
      i = tier >= 1 && tier <= C.ARMOR_SETS.length ? tier - 1 : -1;
    } else if (Number.isInteger(n)) {
      i = C.ARMOR_SETS.findIndex((s) => s.lvl === n);
      if (i < 0 && n >= 1 && n <= C.ARMOR_SETS.length) i = n - 1;
    } else if (q) i = C.ARMOR_SETS.findIndex((s) => s.name.includes(q));
    return i < 0 ? null : C.ARMORS.filter((a) => a.tier === i + 1).map((a) => a.id);
  }

  // map by id, list number (1-8) or part of its Thai name
  resolveMap(q) {
    q = String(q || '').trim().toLowerCase();
    if (C.MAPS[q]) return q;
    const n = Number(q);
    if (Number.isInteger(n) && C.MAP_ORDER[n - 1]) return C.MAP_ORDER[n - 1];
    return (q && C.MAP_ORDER.find((id) => C.MAPS[id].name.includes(q))) || null;
  }

  setLevel(p, lvl) {
    p.lvl = Math.max(1, Math.min(C.MAX_LVL, lvl));
    p.exp = 0;
    p.alloc = C.cleanAlloc(p.alloc, p.lvl);
    if (p.autoStat) this.addStat(p, p.autoStat, Infinity);
    p.skl = C.cleanSkills(p.cls, p.skl, p.lvl);
    if (p.skl.auto) this.autoLearn(p);
    // equipment above the new level goes back to the bag
    for (const slot of C.SLOTS) {
      const it = C.ITEMS[p.eq[slot]];
      if (!it || it.lvl <= p.lvl) continue;
      p.eq[slot] = slot === 'weapon' ? 'w0' : null;
      if (!this.addItem(p, it.id)) this.gmReply(p, `กระเป๋าเต็ม ${it.name} หายไป`);
      this.emitEquip(p, slot);
    }
    p.stats = C.playerStats(p.cls, p.lvl, p.eq, p.alloc);
    p.hp = p.stats.maxHp;
    p.mp = p.stats.maxMp;
    this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'lvl', id: p.id, lvl: p.lvl, f: p.faction });
    this.sendStat(p);
    this.sendSkills(p);
  }

  // d.to (item / set / stone / charm / gold): a character name to give it to instead of the GM
  // d: { cmd: 'item', id, n, g } | { cmd: 'set', id, g } | { cmd: 'lvl', lvl } | { cmd: 'exp', n } | { cmd: 'gold', n } | { cmd: 'heal' } | { cmd: 'clearbag' }
  onGm(p, d) {
    if (!this.canSpawn(p)) return this.toast(p, 'ไม่รู้จักคำสั่งนี้');
    if (!d || typeof d !== 'object') return;
    const grade = this.resolveGrade(d.g);
    if (grade < 0) return this.gmReply(p, `ไม่พบระดับ "${d.g}" (ใช้ 0-5 หรือ ${C.GRADES.map((g) => g.name.toLowerCase()).join(' / ')})`);
    // every spawned copy gets its own roll; no grade given = keep what the id says (plain id = Normal)
    const make = (id) => (grade === null ? id : C.plusId(C.gradeId(id, grade), C.parseId(id).plus));
    const gName = grade ? ` [${C.GRADES[grade].name}]` : '';
    // d.to = a character name: gifts (items, sets, stones, gold, talismans) go to that character instead of the GM:
    // straight into the bag when online, into the save when offline (it is there at the next login)
    const GIFTS = ['item', 'set', 'stone', 'gold', 'charm'];
    let h = p, q = null, rec = null;
    if (GIFTS.includes(d.cmd) && String(d.to || '').trim()) {
      const name = String(d.to).trim().slice(0, 32);
      q = [...this.players.values()].find((x) => !x.deleted && x.name.toLowerCase() === name.toLowerCase()) || null;
      if (!q) rec = this.store.get(name);
      if (!q && !rec) return this.gmReply(p, `ไม่พบตัวละคร "${name}"`);
      h = q || { name: rec.name, inv: Array.from({ length: C.BAG_SIZE }, (_, i) => (rec.inv && C.ITEMS[rec.inv[i]] ? rec.inv[i] : null)),
        stones: Math.max(0, Math.floor(Number(rec.stones) || 0)), gold: Math.max(0, Math.floor(Number(rec.gold) || 0)), charms: C.cleanCharms(rec.charms) };
    }
    const who = h === p ? '' : ` → ${h.name}${q ? '' : ' (ออฟไลน์ · เก็บลงเซฟ)'}`;
    const reply = (t) => { this.gmReply(p, t + who); if (q && q !== p) this.toast(q, `🎁 ได้รับของรางวัล: ${t.replace(/^เสก\s*/, '')}`); };   // never says it came from a GM
    switch (d.cmd) {
      case 'item': {
        const all = d.id === 'all';
        const ids = all ? C.WEAPONS.slice(1).map((w) => w.id) : [this.resolveItem(d.id)];
        if (!ids[0]) return this.gmReply(p, `ไม่พบไอเทม "${d.id}" (ใช้ w0-w13, sh1-sh13, pa1-pa13, br1-br13, sd1-sd13, เลเวล 10-130 ทุก 10 LV หรือ all)`);
        const n = all ? 1 : Math.max(1, Math.min(C.BAG_SIZE, Math.floor(Number(d.n) || 1)));
        let given = 0, wanted = 0;
        for (const id of ids) for (let i = 0; i < n; i++) { wanted++; if (this.addItem(h, make(id))) given++; }
        reply(`เสก${all ? 'อาวุธทุกระดับ' : ` ${C.ITEMS[ids[0]].name}`}${gName} ${given} ชิ้น${given < wanted ? ` (กระเป๋าเต็ม ขาด ${wanted - given})` : ''}`);
        break;
      }
      case 'set': {
        const ids = this.resolveSet(d.id);
        if (!ids) return this.gmReply(p, `ไม่พบชุดเกราะ "${d.id}" (ใช้ tier:1 ถึง tier:${C.ARMOR_SETS.length} หรือเลเวล ${C.ARMOR_SETS.map((s) => s.lvl).sort((a, b) => a - b).join('/')})`);
        let given = 0;
        for (const id of ids) if (this.addItem(h, make(id))) given++;
        reply(`เสกชุด${C.ARMOR_SETS[C.ITEMS[ids[0]].tier - 1].name}${gName} ${given}/${ids.length} ชิ้น${given < ids.length ? ' (กระเป๋าเต็ม)' : ''}`);
        break;
      }
      case 'lvl': {
        const lvl = Math.floor(Number(d.lvl));
        if (!Number.isFinite(lvl)) return this.gmReply(p, `ระบุเลเวล 1-${C.MAX_LVL}`);
        this.setLevel(p, lvl);
        this.gmReply(p, `ตั้งเลเวลเป็น ${p.lvl}`);
        break;
      }
      case 'exp': {
        // Raw EXP for the invoking GM, using normal level/skill/stat progression.
        const raw = typeof d.n === 'string' || typeof d.n === 'number' ? String(d.n).trim() : '';
        const n = Number(raw);
        if (!/^\+?\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1 || n > 1000000000 || d.to) {
          return this.gmReply(p, 'ใช้ /exp +10 เพื่อเพิ่ม EXP 10 หน่วยให้ตัวเอง (จำนวนเต็ม 1–1,000,000,000)');
        }
        if (p.dead) return this.gmReply(p, 'ตายอยู่ กดเกิดใหม่ก่อน');
        if (p.lvl >= C.MAX_LVL) return this.gmReply(p, `เลเวลสูงสุด ${C.MAX_LVL} แล้ว ไม่สามารถเพิ่ม EXP ได้`);
        const before = p.lvl;
        this.gainExp(p, n);
        if (p.lvl === before) this.sendStat(p);
        const progress = p.lvl >= C.MAX_LVL ? 'เลเวลสูงสุด' : `EXP ${p.exp.toLocaleString()}/${C.expToNext(p.lvl).toLocaleString()}`;
        this.gmReply(p, `เพิ่ม EXP +${n.toLocaleString()} · Lv.${p.lvl} · ${progress}`);
        break;
      }
      case 'stone': {
        const n = Math.floor(Number(d.n)) || 0;
        h.stones = Math.max(0, Math.min(C.ENH_STONE.max, h.stones + n));
        reply(`${C.ENH_STONE.name} ${n >= 0 ? '+' : ''}${n} · ตอนนี้มี ${h.stones} ก้อน`);
        break;
      }
      case 'charm': {
        // /charm <n> [guard|luck|stone2|guard2|luck2|stone3|guard3|luck3] (every kind when none is given)
        const n = Math.floor(Number(d.n)) || 0, kinds = C.ENH_CHARMS[d.k] ? [d.k] : Object.keys(C.ENH_CHARMS);
        for (const k of kinds) h.charms[k] = Math.max(0, Math.min(C.ENH_CHARMS[k].max, (h.charms[k] || 0) + n));
        reply(kinds.map((k) => `${C.ENH_CHARMS[k].name} ${h.charms[k]} ใบ`).join(' · '));
        break;
      }
      case 'gold': {
        const n = Math.floor(Number(d.n));
        if (!Number.isFinite(n)) return this.gmReply(p, 'ระบุจำนวนทอง');
        h.gold = Math.max(0, Math.min(999999999, h.gold + n));
        reply(`${n >= 0 ? 'เพิ่ม' : 'ลด'}ทอง ${Math.abs(n).toLocaleString()} · ตอนนี้มี ${h.gold.toLocaleString()} ทอง`);
        break;
      }
      case 'heal': {
        if (p.dead) return this.gmReply(p, 'ตายอยู่ กดเกิดใหม่ก่อน');
        p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; p.cds = {}; p.dots = [];
        this.clearControl(p);
        p.socket.emit('gmreset');
        this.gmReply(p, 'ฟื้นพลัง ปราณ และรีเซ็ตคูลดาวน์แล้ว');
        break;
      }
      case 'plus': {
        // d.slot: weapon (default) | body | legs | arms | shoulder | armor (the 4 armour pieces) | all
        const n = Math.max(0, Math.min(C.MAX_PLUS, Math.floor(Number(d.n)) || 0));
        const want = String(d.slot || 'weapon').toLowerCase();
        const ALIAS = { w: 'weapon', sh: 'body', shirt: 'body', pa: 'legs', pants: 'legs', br: 'arms', sd: 'shoulder', a: 'armor', set: 'armor', ชุด: 'armor', ทั้งหมด: 'all' };
        const key = ALIAS[want] || want;
        const slots = key === 'all' ? C.SLOTS : key === 'armor' ? C.ARMOR_SLOTS : C.SLOTS.includes(key) ? [key] : null;
        if (!slots) return this.gmReply(p, 'ช่อง: weapon / body / legs / arms / shoulder / armor (ชุด 4 ชิ้น) / all');
        const done = [];
        for (const s of slots) {
          if (!p.eq[s]) continue;
          p.eq[s] = C.plusId(p.eq[s], n);
          done.push(C.ITEMS[p.eq[s]].name);
        }
        if (!done.length) return this.gmReply(p, 'ยังไม่ได้สวมชิ้นนั้น (เสกชุดแล้วสวมก่อน)');
        this.refreshStats(p);
        this.emitEquip(p, slots.includes('weapon') ? 'weapon' : slots[0]);
        this.gmReply(p, `ตีบวก +${n}: ${done.join(' · ')}`);
        break;
      }
      case 'clearbag': {
        p.inv.fill(null);
        this.gmReply(p, 'ล้างกระเป๋าแล้ว');
        break;
      }
      case 'goto': {
        // jump to a tile on the current map: /goto <tx> <ty>
        const x = (Math.floor(Number(d.tx)) + 0.5) * TILE, y = (Math.floor(Number(d.ty)) + 0.5) * TILE;
        if (!Number.isFinite(x) || !Number.isFinite(y) || p.dead) return this.gmReply(p, 'ใช้ /goto <tx> <ty> (พิกัดช่อง)');
        if (!C.canStand(this.mapOf(p), x, y)) return this.gmReply(p, 'ยืนตรงนั้นไม่ได้');
        this.changeMap(p, p.mapId, { x, y });
        break;
      }
      case 'map': {
        const to = this.resolveMap(d.id);
        if (!to) return this.gmReply(p, `ไม่พบแผนที่ "${d.id}" (ใช้ ${C.MAP_ORDER.join(' / ')} หรือ 1-${C.MAP_ORDER.length})`);
        if (p.dead) return this.gmReply(p, 'ตายอยู่ กดเกิดใหม่ก่อน');
        this.changeMap(p, to);
        this.gmReply(p, `วาร์ปไป ${C.MAPS[to].name} (${C.levelText(C.MAPS[to])})`);
        break;
      }
      default:
        return this.gmReply(p, `ให้ตัวละครอื่น: ต่อท้าย /item /set /gold /stone /charm ด้วย @ชื่อ (เช่น /item w9 1 mythic @ชื่อตัวละคร) · คำสั่ง: /item <w0-w13|sh1-${C.ARMOR_SETS.length}|pa1-${C.ARMOR_SETS.length}|br1-${C.ARMOR_SETS.length}|sd1-${C.ARMOR_SETS.length}|เลเวล|all> [จำนวน] [ระดับ 0-5|epic|mythic…] · /set <เลเวล 10-130 ทุก 10 LV|tier:1-${C.ARMOR_SETS.length}> [ระดับ] · /plus <0-10> [weapon|body|legs|arms|shoulder|armor|all] · /lv <1-${C.MAX_LVL}> · /exp +10 (เพิ่ม EXP ให้ตัวเอง) · /map <${C.MAP_ORDER.join('|')}> · /goto <tx> <ty> · /gold <จำนวน> · /stone <จำนวน> · /charm <จำนวน> [guard|luck|stone2|guard2|luck2|stone3|guard3|luck3] · /heal · /clearbag`);
    }
    if (h !== p) {                                             // a gift to someone else
      if (q) { this.sendInv(q); this.save(q); }
      else { Object.assign(rec, { inv: h.inv, stones: h.stones, gold: h.gold, charms: h.charms }); this.store.put(rec); this.store.flush(); }
      return;
    }
    this.sendInv(p);
    this.save(p);
  }

  chatCommand(p, text) {
    // "... @name" at the end of a GM gift command (/item /set /gold /stone /charm): give it to that character
    let to = '';
    const at = text.indexOf(' @');
    if (at > 0 && /^(item|i|set|armor|gold|g|stone|stones|charm|charms)$/i.test(text.slice(1).split(/\s+/)[0])) {
      to = text.slice(at + 2).trim();
      text = text.slice(0, at);
    }
    const [cmd, a, b, c] = text.slice(1).split(/\s+/);
    const rest = text.slice(1 + (cmd || '').length).trim();
    switch ((cmd || '').toLowerCase()) {
      // party (works with GM off too)
      case 'p': return this.partyChat(p, rest);
      case 'party': case 'invite': case 'pt':
        return rest ? this.partyInvite(p, this.findPlayer(rest)) : this.toast(p, 'พิมพ์ /party ชื่อผู้เล่น เพื่อชวนเข้าปาร์ตี้');
      case 'leave': case 'pleave': return this.partyLeave(p);
      case 'kick': case 'pkick': return this.partyKick(p, this.findPlayer(rest));
      case 'item': case 'i': return this.onGm(p, { cmd: 'item', id: a, n: b, g: c, to });
      case 'set': case 'armor': return this.onGm(p, { cmd: 'set', id: a, g: b, to });
      case 'plus': case 'enh': return this.onGm(p, { cmd: 'plus', n: a, slot: b });
      case 'lv': case 'lvl': case 'level': return this.onGm(p, { cmd: 'lvl', lvl: a });
      case 'exp': return this.onGm(p, { cmd: 'exp', n: rest });
      case 'gold': case 'g': return this.onGm(p, { cmd: 'gold', n: a, to });
      case 'stone': case 'stones': return this.onGm(p, { cmd: 'stone', n: a, to });
      case 'charm': case 'charms': return this.onGm(p, { cmd: 'charm', n: a, k: b, to });
      case 'heal': return this.onGm(p, { cmd: 'heal' });
      case 'clearbag': return this.onGm(p, { cmd: 'clearbag' });
      case 'map': case 'warp': case 'tp': return this.onGm(p, { cmd: 'map', id: a });
      case 'goto': return this.onGm(p, { cmd: 'goto', tx: a, ty: b });
      case 'gmcode': return this.gmUnlock(p, a, true);
      case 'out': return this.gmUnlock(p, a, false);
      default: return this.canSpawn(p) ? this.onGm(p, { cmd: 'help' }) : this.toast(p, 'ไม่รู้จักคำสั่งนี้');
    }
  }

  onChat(p, d) {
    const now = Date.now();
    if (now - p.lastChat < 600) return;
    p.lastChat = now;
    let text = String((d && d.text) || '').slice(0, 140).trim();
    if (!text) return;
    // แชร์ไอเทม: d.item = a gear piece the sender has (bag or worn), shown where the text says {i}
    const key = d && d.item, link = typeof key === 'string' && key.length < 80 && text.includes('{i}') && C.ITEMS[key]
      && !C.ITEMS[key].kind && (p.inv.includes(key) || Object.values(p.eq).includes(key)) ? { item: key, cls: p.cls } : {};
    if (!link.item) text = text.split('{i}').join('').trim();
    if (!text) return;
    if (/^\/p\s/i.test(text)) return this.partyChat(p, text.slice(3).trim(), link);
    if (text.startsWith('/') && !text.startsWith('/f ')) return this.chatCommand(p, text);
    if (text.startsWith('/f ')) {
      text = text.slice(3).trim();
      if (!text) return;
      for (const q of this.players.values())
        if (q.faction === p.faction) q.socket.emit('chat', { n: p.name, f: p.faction, t: text, ch: 'f', ...link });
    } else {
      for (const q of this.players.values()) q.socket.emit('chat', { n: p.name, f: p.faction, t: text, ch: 'a', ...link });
    }
  }

  respawn(p) {
    if (!p.dead || Date.now() < p.respawnAt) return;
    // camp of the current hunting map, or the own base on the PvP map
    const s = C.spawnOf(this.defOf(p), p.faction);
    p.x = s.x + (Math.random() - 0.5) * 60;
    p.y = s.y + (Math.random() - 0.5) * 40;
    if (!C.canStand(this.mapOf(p), p.x, p.y)) { p.x = s.x; p.y = s.y; }
    p.hp = p.stats.maxHp;
    p.mp = p.stats.maxMp;
    p.dead = false;
    p.dots = [];
    p.buffs = {};
    p.lockUntil = 0;
    this.clearControl(p);
    p.lastInput = Date.now();
    p.socket.emit('respawned', { x: p.x, y: p.y });
    this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'spawn', id: p.id, f: p.faction });
  }

  // ------------------------------------------------------------ combat
  controlState(p) {
    const now = Date.now();
    return { stun: Math.max(0, (p.stunUntil || 0) - now), root: Math.max(0, (p.rootUntil || 0) - now),
      slow: Math.max(0, (p.slowUntil || 0) - now) };
  }
  sendControl(p) { p.socket.emit('control', { ...this.controlState(p), x: p.x, y: p.y }); }
  clearControl(p) {
    this.cancelRitual(p);
    p.controlEpoch = (p.controlEpoch || 0) + 1;
    p.stunUntil = p.rootUntil = p.slowUntil = p.controlImmuneUntil = 0;
    this.sendControl(p);
  }
  applyControl(tgt, opts, now) {
    if (opts.dot || opts.proc) return;
    if (!isPlayer(tgt)) {
      if (opts.stun && !tgt.def.boss) tgt.stunUntil = Math.max(tgt.stunUntil || 0, now + opts.stun);
      if (opts.root && !tgt.def.boss) tgt.rootUntil = Math.max(tgt.rootUntil || 0, now + opts.root);
      const slow = opts.slow || (tgt.def.boss && (opts.stun || opts.root));
      if (slow) tgt.slowUntil = Math.max(tgt.slowUntil || 0, now + slow);
      return;
    }
    const resist = 1 - Math.min(0.7, tgt.stats.resistance || 0);
    let changed = false;
    const key = opts.stun ? 'stunUntil' : opts.root ? 'rootUntil' : null;
    if (key && now >= (tgt.controlImmuneUntil || 0)) {
      const duration = Math.round(Math.min(opts.stun || opts.root, opts.stun ? 1500 : 2000) * resist);
      tgt[key] = now + duration;
      tgt.controlEpoch = (tgt.controlEpoch || 0) + 1;
      this.cancelRitual(tgt);
      tgt.controlImmuneUntil = tgt[key] + 1200;
      tgt.moving = false;
      changed = true;
    }
    if (opts.slow) {
      tgt.slowUntil = Math.max(tgt.slowUntil || 0, now + Math.round(Math.min(2500, opts.slow) * resist));
      changed = true;
    }
    if (changed) this.sendControl(tgt);
  }
  cancelRitual(p) {
    if (!p.ritual) return;
    const r = p.ritual; p.ritual = null;
    p.lockUntil = p.actUntil = 0;
    this.emitNear(r.mapId, r.originX, r.originY, 'fx', { t: 'ritualCancel', id: p.id });
  }
  alive(p) { return this.players.get(p.id) === p && !p.dead; }

  // monsters on p's map, plus the players p may hit (canPk: the PvP map, or field PvP on the hunting maps)
  enemiesOf(p, x, y, range) {
    const out = [];
    const M = this.maps[p.mapId], now = Date.now();
    for (const m of M.monsters)
      if (!m.dead && Math.abs(m.x - x) < range + 80 && Math.abs(m.y - y) < range + 80) out.push(m);
    for (const q of this.players.values())
      if (q.mapId === p.mapId && Math.abs(q.x - x) < range + 40 && Math.abs(q.y - y) < range + 40 && this.canPk(p, q, now)) out.push(q);
    return out;
  }
  // ------------------------------------------------------------ field PvP (C.PK)
  // may player src damage player tgt? PvP map: the other faction, nobody in a base. Hunting maps: the other faction,
  // both Lv.PK.minLvl+, both outside the camps, not party mates, and src has PvP on or is defending against tgt.
  canPk(src, tgt, now = Date.now()) {
    if (src === tgt || src.dead || tgt.dead || src.faction === tgt.faction || src.mapId !== tgt.mapId) return false;
    const def = this.defOf(src);
    if (def.pvp) return !C.baseAt(tgt.x, tgt.y) && !C.baseAt(src.x, src.y);
    if (src.lvl < C.PK.minLvl || tgt.lvl < C.PK.minLvl) return false;
    if (C.safeAt(def, src.x, src.y) || C.safeAt(def, tgt.x, tgt.y)) return false;
    if (src.party && src.party === tgt.party) return false;
    return !!src.pk || this.defending(src, tgt, now);
  }
  // p was attacked by q a moment ago and may hit back without PvP on (and without evil points for the kill)
  defending(p, q, now = Date.now()) { return ((p.defend && p.defend.get(q.id)) || 0) > now; }
  // a field PvP blow: the one hit may answer the attacker; both are in a fight (PvP stays on)
  markPk(src, tgt, now) {
    if (!this.defending(src, tgt, now)) (tgt.defend || (tgt.defend = new Map())).set(src.id, now + C.PK.defendMs);
    src.pkFight = tgt.pkFight = now + C.PK.combatMs;
  }
  addEvil(p, d) {
    if (!(p.evil < 0)) p.evilAt = Date.now();          // the hourly clock starts at the first evil point
    p.evil = Math.min(0, (p.evil || 0) + d);
  }
  // +PK.evilStep per PK.evilEveryMs since p.evilAt, back to 0 at most
  decayEvil(p, now) {
    if (!(p.evil < 0)) { p.evil = 0; return; }
    const steps = Math.floor((now - p.evilAt) / C.PK.evilEveryMs);
    if (steps <= 0) return;
    p.evil = Math.min(0, p.evil + steps * C.PK.evilStep);
    p.evilAt += steps * C.PK.evilEveryMs;
    if (p.socket) this.toast(p, p.evil ? `แต้มชั่วร้ายลดลงเหลือ ${p.evil}` : 'แต้มชั่วร้ายหมดแล้ว ชื่อกลับเป็นปกติ');
  }
  // d: { on: true / false }
  onPk(p, d) {
    const on = !!(d && d.on), now = Date.now();
    if (on === !!p.pk) return;
    if (on && p.lvl < C.PK.minLvl) return this.toast(p, `เปิดสถานะ PvP ได้ตั้งแต่ Lv.${C.PK.minLvl}`);
    if (!on && (p.pkFight || 0) > now) return this.toast(p, `กำลังต่อสู้กับผู้เล่น ปิด PvP ได้ในอีก ${Math.ceil((p.pkFight - now) / 1000)} วินาที`);
    p.pk = on;
    this.toast(p, on
      ? `⚔ เปิดสถานะ PvP: โจมตีผู้เล่นฝ่ายตรงข้ามนอกเขตปลอดภัยได้ · ฆ่าผู้เล่นนอกสนามรบ แต้มชั่วร้าย -${C.PK.evilPerKill} (ชื่อแดง) ฟื้นคืน ${C.PK.evilStep} ทุก 1 ชั่วโมง`
      : 'ปิดสถานะ PvP แล้ว');
  }
  hitCone(p, a, range, half, mult, opts) {
    for (const e of this.enemiesOf(p, p.x, p.y, range)) {
      const ey = e.y - radiusOf(e) * 0.4;
      const d = Math.hypot(e.x - p.x, ey - (p.y - 18));
      if (d > range + radiusOf(e)) continue;
      if (d > 28 && angDiff(Math.atan2(ey - (p.y - 18), e.x - p.x), a) > half) continue;
      this.applyDamage(p, e, mult, opts);
    }
  }
  // single enemy for the basic attack: the requested target id if it is inside the cone, else the closest one
  slashTarget(p, a, range, half, tid) {
    let best = null, bd = Infinity;
    for (const e of this.enemiesOf(p, p.x, p.y, range)) {
      const ey = e.y - radiusOf(e) * 0.4;
      const d = Math.hypot(e.x - p.x, ey - (p.y - 18));
      if (d > range + radiusOf(e)) continue;
      if (d > 28 && angDiff(Math.atan2(ey - (p.y - 18), e.x - p.x), a) > half) continue;
      if (tid && e.id === tid) return e;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  hitCircle(p, x, y, r, mult, opts) {
    for (const e of this.enemiesOf(p, x, y, r))
      if (Math.hypot(e.x - x, e.y - y) <= r + radiusOf(e)) this.applyDamage(p, e, mult, opts);
  }

  applyDamage(src, tgt, mult, opts = {}) {
    if (tgt.dead) return 0;
    const now = Date.now();
    const sP = isPlayer(src), tP = isPlayer(tgt);
    if (sP && tP) {
      if (!this.canPk(src, tgt, now)) return 0;
      if (!this.defOf(src).pvp) this.markPk(src, tgt, now);
    }
    // Accuracy counters evasion. Stuns disable dodging; periodic/proc damage never rolls a dodge.
    const evade = tP && now >= (tgt.stunUntil || 0)
      ? Math.max(0, (tgt.stats.evasion || 0) - (sP ? src.stats.accuracy || 0 : 0)) : 0;
    if (!opts.dot && !opts.proc && !opts.flat && evade && Math.random() < evade) {
      this.emitNear(tgt.mapId, tgt.x, tgt.y, 'evade', { id: tgt.id });
      return 0;
    }
    const atk = sP ? src.stats.atk : src.def.atk;
    let crit = false, dmg;
    if (opts.flat) dmg = opts.flat;
    else {
      let raw = atk * mult * (0.9 + Math.random() * 0.2);
      if (sP) raw *= 1 + this.buffVal(src, 'dmg');                                    // ยันต์ปลุกเทพยุทธ์
      if (sP && (opts.crit || Math.random() < this.critOf(src))) {                     // เนตรเหยี่ยว: crit chance / power
        raw *= C.roleOf(src.cls).critPower + (src.stats.fx.critDmg || 0) + this.buffVal(src, 'critDmg');
        crit = true;
      }
      let def = tP ? tgt.stats.def : tgt.def.def;
      if (now < (tgt.breakUntil || 0)) def *= 1 - (tgt.breakK || 0);                  // ฉีกเกราะกากบาท
      if (sP && src.stats.fx.pierce) def *= 1 - src.stats.fx.pierce;                   // gear option «ทะลวงเกราะ»
      // defK: one part of a split blow takes only its share of the armour, so the parts add up to the whole blow
      dmg = Math.max(raw * C.DMG_FLOOR, raw - def * 0.6 * (opts.defK ?? 1));      // armour never makes anyone immune
    }
    if (opts.reflect) { /* โล่หนาม: already the final share of the blow taken (thorns) */ }
    else if (sP && tP) dmg *= 0.7 * (1 + (src.stats.fx.pvp || 0)); // PvP damage scaling
    else if (sP) dmg *= (1 + (src.stats.fx.pve || 0)) * (src.stats.pveMult || 1)    // + weapon level / enhancement vs monsters
      * C.levelGapMul(src.lvl, tgt.def.lvl || 0).dealt                                   // monsters above the player shrug blows off
      * (this.taoistSolo(src) ? C.TAOIST_SOLO.dealt : 1)
      * (this.warriorSolo(src) ? C.WARRIOR_SOLO.dealt : 1);
    else if (tP) dmg *= C.levelGapMul(tgt.lvl, src.def.lvl || 0).taken                   // ... and hit harder
      * (this.taoistSolo(tgt) ? C.TAOIST_SOLO.taken : 1);
    if (tP) {
      const tfx = tgt.stats.fx;
      const ward = Math.max(this.buffVal(tgt, 'guard'), this.buffVal(tgt, 'frontGuard')); // tank wards never multiply healer wards
      // ปราการสุดท้าย (gear passive): below 35% HP, a blow is reduced only when the passive fires
      const wall = tfx.bulwark && tgt.hp < tgt.stats.maxHp * 0.35 && Math.random() < ((tgt.stats.procs && tgt.stats.procs.bulwark) || 0);
      // ทวน locked in a heavy strike (C.SPEAR_WINDUP_GUARD); a stun / root since the cast ends it
      const sg = tgt.spearGuard;
      const spear = sg && now < sg.until && (tgt.controlEpoch || 0) === sg.epoch ? C.SPEAR_WINDUP_GUARD.reduce : 0;
      const red = (tfx.guard || 0) + (wall ? tfx.bulwark : 0) + ward + spear;
      if (red) dmg *= 1 - Math.min(0.7, red);
    }
    this.applyControl(tgt, opts, now);
    dmg = Math.max(1, Math.round(dmg));
    if (tP && !opts.reflect) dmg = Math.max(1, dmg - this.cover(tgt, src, dmg, sP));
    tgt.hp -= dmg;
    tgt.lastHurt = now;
    if (!tP) {
      tgt.threat.set(src.id, (tgt.threat.get(src.id) || 0) + dmg);
      if (isPlayer(src)) { src.lastHit = tgt.id; src.lastHitAt = now; }   // party members following src assist on it
      if (sP && !tgt.target) { tgt.target = src.id; this.alertPack(tgt, src); }
      if (sP) tgt.returning = false;
    }
    if (sP && !opts.dot && !opts.reflect) this.onHitFx(src, tgt, dmg, opts);
    if (opts.bleed)
      tgt.dots.push({ src: src.id, n: 4, next: now + 1000, dmg: Math.max(1, Math.round(atk * 0.32)) });
    if (opts.armorBreak && (now >= (tgt.breakUntil || 0) || opts.armorBreak >= (tgt.breakK || 0))) {
      tgt.breakUntil = now + 5000; tgt.breakK = opts.armorBreak;
    }
    if (opts.burn && tgt.dots.length < 6)   // fire: อุกกาบาตพยัคฆ์ / มังกรคู่ / ดาวตก / ศรระเบิดอัคนี
      tgt.dots.push({ src: src.id, n: 4, next: now + 1000, dmg: Math.max(1, Math.round(atk * 0.4)) });
    // s = attacker (players only) so clients can draw the impact in its weapon's colours
    this.emitNear(tgt.mapId, tgt.x, tgt.y, 'hit', { id: tgt.id, v: dmg, c: crit ? 1 : 0, k: opts.dot ? 1 : 0, s: sP ? src.id : undefined });
    if (tgt.hp <= 0) {
      tgt.hp = 0;
      if (tP) this.killPlayer(tgt, src);
      else this.killMonster(tgt, src);
    }
    if (tP && tgt.cls === 'warrior' && !opts.dot && !opts.reflect) this.thorns(tgt, src, dmg, now);
    return dmg;
  }
  // นักรบแนวหน้า โล่หนาม (C.WARRIOR_THORNS): part of a blow taken goes back to the attacker
  thorns(p, src, dmg, now) {
    const T = C.WARRIOR_THORNS;
    if (!p.skl.sk.ironGuard || src === p || src.dead || src.mapId !== p.mapId) return;
    const guard = p.buffs && p.buffs.ironGuard && now < p.buffs.ironGuard.until;
    const v = Math.min(dmg * (guard ? T.guard : T.base) * (isPlayer(src) ? T.pvp : 1), p.stats.atk * T.capAtk);
    if (v >= 1) this.applyDamage(p, src, 0, { flat: Math.round(v), reflect: true, proc: true });
  }

  // นักรบแนวหน้า โล่รับแทน (C.WARRIOR_COVER): the healthiest warrior of tgt's party near it takes part of the blow.
  // Returns how much tgt is spared; the warrior's own wards / gear guard shrink what actually reaches it.
  cover(tgt, src, dmg, fromPlayer) {
    const W = C.WARRIOR_COVER, pt = this.partyOf(tgt), pvp = this.defOf(tgt).pvp;
    if (!pt || dmg < 2) return 0;
    let w = null;
    for (const id of pt.members) {
      const q = this.players.get(id);
      if (!q || q === tgt || q === src || q.cls !== 'warrior' || q.dead || q.mapId !== tgt.mapId || dist(q, tgt) > W.range
        || q.hp <= q.stats.maxHp * W.minHp || (pvp && q.faction !== tgt.faction)) continue;
      if (!w || q.hp / q.stats.maxHp > w.hp / w.stats.maxHp) w = q;
    }
    if (!w) return 0;
    const part = Math.floor(dmg * W.share * (fromPlayer ? W.pvp : 1));
    if (part < 1) return 0;
    const ward = Math.max(this.buffVal(w, 'guard'), this.buffVal(w, 'frontGuard')) + (w.stats.fx.guard || 0);
    const taken = Math.min(w.hp - 1, Math.round(part * (1 - Math.min(0.7, ward))));
    if (taken > 0) {
      w.hp -= taken; w.lastHurt = Date.now();
      this.emitNear(w.mapId, w.x, w.y, 'hit', { id: w.id, v: taken, c: 0, k: 1 });
      this.emitNear(w.mapId, w.x, w.y, 'fx', { t: 'cover', id: w.id, to: tgt.id });
    }
    return part;
  }

  // special options / passives of the attacker's gear on a landed hit
  onHitFx(p, tgt, dmg, opts) {
    const fx = p.stats.fx;
    // Splitting a spear strike must not multiply its mana/proc budget.
    const weight=opts.onHitWeight??1;
    if (fx.mana) p.mp = Math.min(p.stats.maxMp, p.mp + p.stats.maxMp * fx.mana * weight);
    if (fx.thunder && !opts.proc && Math.random() < Math.min(1,fx.thunder*weight))
      this.later(140, () => {
        if (!this.alive(p) || tgt.dead) return;
        this.emitNear(tgt.mapId, tgt.x, tgt.y, 'fx', { t: 'bolt', x: Math.round(tgt.x), y: Math.round(tgt.y), f: p.faction });
        this.applyDamage(p, tgt, 1.2, { proc: true });
      });
  }
  reap(p) {
    // วิญญาณยมทูต (gear passive): a kill heals only when the passive fires, at most once per REAPER_CD_MS
    const now = Date.now();
    if (!p.stats.fx.reaper || p.dead || now < (p.reapAt || 0)) return;
    if (Math.random() >= ((p.stats.procs && p.stats.procs.reaper) || 0)) return;
    p.reapAt = now + C.REAPER_CD_MS;
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * p.stats.fx.reaper);
  }

  killMonster(m, src) {
    const now = Date.now();
    this.cancelMonsterSkill(m);
    m.dead = true;
    m.respawnAt = now + m.def.respawn;
    m.dots = [];
    m.target = null;
    this.emitNear(m.mapId, m.x, m.y, 'die', { id: m.id });
    if (m.def.boss) {
      const back = `จะปรากฏตัวอีกครั้งใน ${Math.round(m.def.respawn / 60000)} นาที`;
      const total = [...m.threat.values()].reduce((a, b) => a + b, 0) || 1;
      const contributors = [];
      for (const [pid, dmg] of m.threat) {
        const p = this.players.get(pid);
        if (!p) continue;
        const share = Math.max(0.15, dmg / total);
        this.gainExp(p, Math.round(m.def.exp * share * C.levelExpMul(p.lvl) * (1 + (p.stats.fx.exp || 0))));
        contributors.push(p);
      }
      // gold and the one guaranteed item are split equally among every contributor (round-robin for
      // the item, same fairness as a normal mob kill) — no longer weighted by damage share or by who tagged it
      if (contributors.length) this.rollLoot(contributors[0], m.type, { recipients: contributors, turnHolder: m });
      if (isPlayer(src) && this.defOf(m).pvp) {
        this.score[src.faction] += 10;
        this.io.emit('score', this.score);
        this.systemChat(`⚔ ${m.def.name} ถูกปราบโดย ${src.name} — ฝ่าย${C.FACTIONS[src.faction].name} ได้รับ 10 คะแนน! · ${back}`);
      } else if (isPlayer(src)) this.systemChat(`⚔ ${m.def.name} (${this.defOf(m).name}) ถูกปราบโดย ${src.name}! · ${back}`);
    } else if (isPlayer(src)) {
      this.shareExp(src, m);
      this.rollLoot(src, m.type, { at: m });
    }
    if (isPlayer(src)) this.reap(src);
    m.threat.clear();
  }

  killPlayer(v, src) {
    const now = Date.now();
    v.dead = true;
    v.respawnAt = now + RESPAWN_MS;
    v.deaths++;
    v.dots = [];
    this.clearControl(v);
    v.moving = false;
    const by = isPlayer(src) ? src.name : src.def.name;
    if (isPlayer(src)) {
      src.kills++;
      this.countPvp(src, v, now);
      this.reap(src);
      this.gainExp(src, 40 + v.lvl * 16);
      this.io.emit('feed', { k: src.name, kf: src.faction, v: v.name, vf: v.faction });
      if (this.defOf(v).pvp) {
        this.score[src.faction]++;
        this.io.emit('score', this.score);
      } else if (!this.defending(src, v, now) && !(v.evil < 0)) {
        // field PvP kill: evil points unless it was self-defence or the victim was already evil
        this.addEvil(src, -C.PK.evilPerKill);
        this.toast(src, `☠ ฆ่าผู้เล่นนอกสนามรบ: แต้มชั่วร้าย -${C.PK.evilPerKill} (รวม ${src.evil}) · ฟื้นคืน ${C.PK.evilStep} ทุก 1 ชั่วโมง`);
      }
    }
    if (v.defend) v.defend.clear();
    v.socket.emit('dead', { by, t: RESPAWN_MS });
    this.emitNear(v.mapId, v.x, v.y, 'die', { id: v.id });
    for (const m of this.monsters) if (m.target === v.id) { m.target = null; m.threat.delete(v.id); m.returning = true; }
  }

  // party members who share a kill at (x, y): alive, same map, within PARTY_RANGE (the killer always counts);
  // on the PvP map only the killer's own faction
  // นักพรต with no party member in range (C.TAOIST_SOLO applies)
  taoistSolo(p) { return p.cls === 'taoist' && this.expGroup(p, p.mapId, p.x, p.y).length < 2; }
  // นักรบแนวหน้า with no party member in range (C.WARRIOR_SOLO applies)
  warriorSolo(p) { return p.cls === 'warrior' && this.expGroup(p, p.mapId, p.x, p.y).length < 2; }
  // นักพรต who learned น้ำทิพย์ชโลมชีวา: heals itself and party members near it every few seconds (C.TAOIST_MERCY_AURA)
  mercyAura(p, now) {
    const A = C.TAOIST_MERCY_AURA, sl = p.skl.sk.mercy || 0;
    if (p.cls !== 'taoist' || !sl || now < (p.mercyAuraAt || 0)) return;
    p.mercyAuraAt = now + A.everyMs;
    const pct = A.min + (A.max - A.min) * (Math.min(sl, C.SKILL_MAX) - 1) / (C.SKILL_MAX - 1)
      + (C.skillRankOf(p.skl, 'mercy') ? A.evo : 0);
    for (const q of this.partyNear(p, A.range)) {
      if (now < (q.mercyAuraUntil || 0)) continue;        // already healed by another นักพรต this round
      q.mercyAuraUntil = now + A.everyMs - 100;
      const pvp = this.defOf(q).pvp || q.pk;               // battlefield or field PvP switched on
      this.healPlayer(q, Math.round(q.stats.maxHp * pct * (pvp ? A.pvp : 1)));
    }
  }
  expGroup(src, mapId, x, y) {
    const pt = this.partyOf(src);
    if (!pt) return [src];
    const pvp = this.maps[mapId].def.pvp;
    return pt.members.map((id) => this.players.get(id))
      .filter((q) => q && (q === src || (!q.dead && q.mapId === mapId && Math.hypot(q.x - x, q.y - y) < C.PARTY_RANGE &&
        (!pvp || q.faction === src.faction))));
  }
  partyRules(p) { const pt = this.partyOf(p); return pt ? pt.rules : C.PARTY_DEFAULT; }
  // monster EXP: alone = all of it. In a party (leader's rule, C.PARTY_EXP_MODES):
  // share = the members near the kill pool it (+PARTY_BONUS per extra member) and split it by level
  // each  = the members near the kill who hit it get the part of their own damage, no party bonus
  // every share then gets that member's own level penalty, level EXP rate (C.levelExpMul) and EXP gear bonus
  shareExp(src, m) {
    const near = this.expGroup(src, m.mapId, m.x, m.y);
    const gain = (q, v) => this.gainExp(q, Math.max(1, Math.round(v * C.expPenalty(q.lvl, m.def.lvl) * C.levelExpMul(q.lvl) * (1 + (q.stats.fx.exp || 0)))));
    if (near.length > 1 && this.partyRules(src).exp === 'each') {
      const hit = near.filter((q) => m.threat.get(q.id) > 0);
      if (!hit.includes(src)) hit.push(src);
      const total = hit.reduce((a, q) => a + (m.threat.get(q.id) || 0), 0);
      for (const q of hit) gain(q, total ? m.def.exp * (m.threat.get(q.id) || 0) / total : m.def.exp / hit.length);
      return;
    }
    const pool = m.def.exp * (1 + C.partyExpBonus(near.length));
    const sumLvl = near.reduce((a, q) => a + q.lvl, 0);
    for (const q of near) gain(q, pool * (q.lvl / sumLvl));
  }

  gainExp(p, amount) {
    if (amount <= 0 || p.lvl >= C.MAX_LVL) return;
    const lvl0 = p.lvl;
    p.exp += amount;
    p.socket.emit('exp', amount);
    while (p.lvl < C.MAX_LVL && p.exp >= C.expToNext(p.lvl)) {
      p.exp -= C.expToNext(p.lvl);
      p.lvl++;
      if (p.autoStat) this.addStat(p, p.autoStat, C.STAT_PTS);
      p.stats = C.playerStats(p.cls, p.lvl, p.eq, p.alloc);
      p.hp = p.stats.maxHp;
      p.mp = p.stats.maxMp;
      this.emitNear(p.mapId, p.x, p.y, 'fx', { t: 'lvl', id: p.id, lvl: p.lvl, f: p.faction });
      for (const s of C.CLASSES[p.cls].skills) {
        if (s.lvl === p.lvl && s.key !== '1') this.toast(p, `เรียนสกิลใหม่ได้แล้ว: ${s.name} (กด K)`);
        for (const e of s.evo || []) if (e.lvl === p.lvl) this.toast(p, `อัพขั้นสกิลได้: ${s.name} → ${e.name} (กด K)`);
      }
    }
    if (p.lvl !== lvl0) {
      if (this.autoWear(p)) {                                // gear that was too high-level may fit now
        p.hp = p.stats.maxHp; p.mp = p.stats.maxMp;          // a level-up still ends at full
        this.sendInv(p);
      }
      if (p.skl.auto) this.autoLearn(p);
      const free = C.skillPtsFree(p.skl, p.lvl);
      if (free > 0) this.toast(p, `มีแต้มสกิล ${free} แต้ม — กด K เพื่ออัปสกิล`);
      this.sendSkills(p);
    }
    if (p.lvl >= C.MAX_LVL) p.exp = 0;
    if (p.lvl !== lvl0) {
      const free = C.statPtsFree(p.alloc, p.lvl);
      if (free > 0) this.toast(p, `ได้รับแต้มสถานะ! มี ${free} แต้ม — กด C เพื่ออัปค่าพลัง`);
      this.sendStat(p);
    }
  }

  // ------------------------------------------------------------ GM: saved characters (/user)
  // d: { cmd: 'list' } | { cmd: 'del', name } | { cmd: 'del', names: [...] }. Replies go to the GM's user panel, never the chat.
  // online players, for everyone: d.cmd 'list' → the roster; 'inspect' with d.id → one player's worn equipment
  // (item keys, so the client shows grade / affixes / + level) and main stats
  onWho(p, d) {
    const now = Date.now();
    if (now - (p.lastWho || 0) < 250) return;                 // a little flood guard
    p.lastWho = now;
    if (d && d.cmd === 'inspect') {
      const q = this.players.get(String(d.id || ''));
      if (!q || q.deleted) return p.socket.emit('inspect', { id: d.id, gone: true });
      const s = q.stats;
      return p.socket.emit('inspect', {
        id: q.id, name: q.name, lvl: q.lvl, cls: q.cls, faction: q.faction, map: q.mapId, eq: q.eq,
        st: { hp: s.maxHp, mp: s.maxMp, atk: s.atk, def: s.def, crit: Math.round(this.critOf(q) * 100), speed: s.speed },
      });
    }
    const list = [...this.players.values()].filter((q) => !q.deleted)
      .map((q) => ({ id: q.id, n: q.name, lvl: q.lvl, cls: q.cls, f: q.faction, map: q.mapId, gr: C.gearGrade(q.eq), ev: q.evil || 0 }))
      .sort((a, b) => b.lvl - a.lvl || a.n.localeCompare(b.n));
    p.socket.emit('who', { list, me: p.id });
  }
  // ------------------------------------------------------------ leaderboard (🏆 / R)
  countPvp(src, v, now) {
    if (v.lvl < src.lvl - RANK_LVL_GAP) return;
    const k = v.name.toLowerCase(), last = src.pvpSeen.get(k);
    if (last && now - last < RANK_REPEAT_MS) return;
    src.pvpSeen.set(k, now);
    src.pvp = (src.pvp || 0) + 1;
  }
  // every saved character, with the live values of those online. GM accounts are ranked like everyone else,
  // so a missing name never gives a GM away
  async buildRank() {
    const live = new Map([...this.players.values()].filter((q) => !q.deleted).map((q) => [q.name.toLowerCase(), q]));
    const rows = [];
    for (const r of this.store.list()) {
      const q = live.get(r.name.toLowerCase()), src = q || r;
      rows.push({ n: r.name, f: r.faction === 'adharma' ? 'adharma' : 'dharma', cls: src.cls || 'dualblade', lvl: src.lvl || 1, exp: Math.floor(src.exp || 0), pvp: src.pvp || 0 });
    }
    const level = [...rows].sort((a, b) => b.lvl - a.lvl || b.exp - a.exp || a.n.localeCompare(b.n));
    const pvp = rows.filter((r) => r.pvp > 0).sort((a, b) => b.pvp - a.pvp || b.lvl - a.lvl || a.n.localeCompare(b.n));
    const faction = {};
    for (const f of ['dharma', 'adharma']) {
      const mine = rows.filter((r) => r.f === f), top = level.find((r) => r.f === f);
      faction[f] = { chars: mine.length, pvp: mine.reduce((s, r) => s + r.pvp, 0), lvl100: mine.filter((r) => r.lvl >= 100).length, top: top ? top.n : '' };
    }
    this.rank = { at: Date.now(), level, pvp, faction };
    return this.rank;
  }
  rankFresh() {
    if (this.rank && Date.now() - this.rank.at < RANK_MS) return Promise.resolve(this.rank);
    if (!this.rankBuilding) this.rankBuilding = this.buildRank().finally(() => { this.rankBuilding = null; });
    return this.rankBuilding;
  }
  // d: { board: 'level' | 'pvp' | 'faction' } → top RANK_TOP rows + the asking player's own place
  onRank(p, d) {
    const now = Date.now();
    if (now - (p.lastRank || 0) < 500) return;
    p.lastRank = now;
    const board = d && ['level', 'pvp', 'faction'].includes(d.board) ? d.board : 'level';
    this.rankFresh().then((rk) => {
      if (!this.players.has(p.id)) return;
      const out = { board, at: rk.at, next: rk.at + RANK_MS, score: this.score, faction: rk.faction };
      if (board !== 'faction') {
        const list = rk[board], i = list.findIndex((r) => r.n.toLowerCase() === p.name.toLowerCase());
        const strip = (r) => ({ n: r.n, f: r.f, cls: r.cls, lvl: r.lvl, pvp: r.pvp });
        out.list = list.slice(0, RANK_TOP).map(strip);
        out.total = list.length;
        out.me = i >= 0 ? { rank: i + 1, ...strip(list[i]) } : { rank: 0, n: p.name, f: p.faction, cls: p.cls, lvl: p.lvl, pvp: p.pvp || 0 };
      }
      p.socket.emit('rank', out);
    }).catch((e) => console.error('leaderboard:', e.message));
  }
  onUsers(p, d) {
    if (!this.isGm(p)) return this.toast(p, 'ไม่รู้จักคำสั่งนี้');
    if (!d || typeof d !== 'object') return;
    if (d.cmd === 'del') {
      const names = (Array.isArray(d.names) ? d.names : [d.name]).slice(0, 5000).map((n) => String(n || ''));
      const done = [];
      let self = false, missing = 0;
      for (const name of names) {
        const rec = this.store.get(name);
        if (!rec) { missing++; continue; }
        if (rec.name.toLowerCase() === p.name.toLowerCase()) { self = true; continue; }
        // online: kick first, and mark it so the disconnect does not save it again
        const q = [...this.players.values()].find((x) => x.name.toLowerCase() === rec.name.toLowerCase());
        if (q) {
          q.deleted = true;
          q.socket.emit('toast', 'ตัวละครนี้ถูกลบโดย GM');
          q.socket.disconnect(true);
        }
        this.store.remove(rec.name);
        done.push(rec.name);
      }
      this.store.flush();
      const msg = [];
      if (done.length) msg.push(done.length === 1 ? `ลบตัวละคร ${done[0]} แล้ว` : `ลบตัวละคร ${done.length} ตัวแล้ว`);
      if (self) msg.push('ข้ามตัวที่กำลังเล่นอยู่');
      if (missing) msg.push(`ไม่พบ ${missing} ชื่อ`);
      this.toast(p, msg.join(' · ') || 'ไม่ได้ลบอะไร');
    } else if (d.cmd !== 'list') return;
    const online = new Set([...this.players.values()].map((x) => x.name.toLowerCase()));
    p.socket.emit('users', this.store.list().map((r) => ({
      name: r.name, faction: r.faction, cls: r.cls || 'dualblade', lvl: r.lvl || 1, map: r.map || '',
      online: online.has(r.name.toLowerCase()), me: r.name.toLowerCase() === p.name.toLowerCase(),
    })).sort((a, b) => b.lvl - a.lvl || a.name.localeCompare(b.name)));
  }

  // ------------------------------------------------------------ skill points (แต้มสกิล)
  // a newly learned skill goes on its own key when that is free, else the first empty key
  barAdd(p, ids) {
    const bar = p.skl.bar;
    for (const id of ids) {
      if (bar.includes(id)) continue;
      const def = C.BAR_KEYS.indexOf(SKILLS[p.cls][id].key);
      const i = bar[def] ? bar.indexOf(null) : def;
      if (i >= 0) bar[i] = id;
    }
  }
  // automatic mode: spend the free points like the old system did, and put new skills on the bar
  autoLearn(p) {
    const before = new Set(Object.keys(p.skl.sk));
    C.autoSkills(p.cls, p.skl, p.lvl);
    this.barAdd(p, Object.keys(p.skl.sk).filter((id) => !before.has(id)));
  }
  // d: { cmd: 'up', id } learn / +1 level | { cmd: 'evo', id } next evolution | { cmd: 'reset' } | { cmd: 'auto', on }
  //    | { cmd: 'bar', bar: [9 skill ids or null] } (which skill sits on keys 1-9)
  onSkills(p, d) {
    if (!d || typeof d !== 'object') return;
    const sk = SKILLS[p.cls][d.id], S = p.skl;
    if (d.cmd === 'up') {
      if (!sk) return;
      const n = S.sk[sk.id] || 0, cap = C.skillCap(sk, p.lvl);
      if (!cap) return this.toast(p, `ต้องการเลเวล ${sk.lvl} เพื่อเรียน ${sk.name}`);
      if (n >= C.SKILL_MAX) return this.toast(p, `${sk.name} สเต็กเต็มแล้ว`);
      if (n >= cap) return this.toast(p, `สเต็ก ${n + 1} ต้องการเลเวลตัวละคร ${sk.lvl + n * C.SKILL_LVL_GAP}`);
      if (C.skillPtsFree(S, p.lvl) <= 0) return this.toast(p, 'แต้มสกิลไม่พอ');
      S.sk[sk.id] = n + 1;
      if (!n) this.barAdd(p, [sk.id]);
      this.toast(p, n ? `${sk.name} สเต็ก ${n + 1}` : `เรียนสกิล ${sk.name} แล้ว`);
    } else if (d.cmd === 'evo') {
      if (!sk) return;
      const i = S.ev[sk.id] || 0, why = C.evoBlock(sk, S, p.lvl, i);
      if (why) return this.toast(p, why);
      S.ev[sk.id] = i + 1;
      this.toast(p, `วิชาพัฒนา! ${sk.name} → ${sk.evo[i].name}`);
    } else if (d.cmd === 'reset') {
      const cost = this.statResetCost(p);
      if (p.gold < cost) return this.toast(p, `ทองไม่พอ (รีเซ็ตสกิลใช้ ${cost.toLocaleString()} ทอง)`);
      p.gold -= cost;
      const basic = C.basicOf(p.cls);
      S.sk = { [basic.id]: 1 }; S.ev = {};
      this.toast(p, `รีเซ็ตแต้มสกิลแล้ว${cost ? ` (-${cost.toLocaleString()} ทอง)` : ''}`);
      this.sendInv(p);
    } else if (d.cmd === 'auto') {
      S.auto = !!d.on;
      if (S.auto) this.autoLearn(p);
      this.toast(p, S.auto ? 'อัปสกิลอัตโนมัติ: เปิด' : 'อัปสกิลอัตโนมัติ: ปิด (แจกแต้มเอง)');
    } else if (d.cmd === 'bar') {
      if (!Array.isArray(d.bar)) return;
      p.skl = C.cleanSkills(p.cls, { ...S, bar: d.bar.slice(0, C.BAR_KEYS.length) }, p.lvl);
    } else return;
    this.sendSkills(p);
    this.save(p);
  }

  // ------------------------------------------------------------ stat points (แต้มสถานะ)
  // spend up to n free points on stat k (respects the per-stat cap); returns how many were spent.
  // k = C.STAT_GUIDE_KEY spreads them toward the class build guide (C.guidePoints)
  addStat(p, k, n) {
    if (k === C.STAT_GUIDE_KEY) {
      const add = C.guidePoints(p.cls, p.alloc, p.lvl, n, C.statLimits(p.cls, p.lvl, p.eq, p.alloc));
      for (const [s, v] of Object.entries(add)) p.alloc[s] += v;
      return Object.values(add).reduce((t, v) => t + v, 0);
    }
    const def = C.STAT_POINTS[k];
    if (!def) return 0;
    n = Math.min(n, C.statPtsFree(p.alloc, p.lvl), (def.max || Infinity) - p.alloc[k]);
    if (n <= 0) return 0;
    p.alloc[k] += n;
    return n;
  }
  statResetCost(p) { return p.lvl < 30 ? 0 : p.lvl * 100; }
  // d: { cmd: 'add', k, n } | { cmd: 'guide' } | { cmd: 'reset' } | { cmd: 'auto', k }  ('' = auto off, 'guide' = class guide)
  onStat(p, d) {
    if (!d || typeof d !== 'object') return;
    if (d.cmd === 'add') {
      const k = String(d.k), n = Math.max(1, Math.min(1000, Math.floor(Number(d.n)) || 1));
      if (!C.STAT_POINTS[k]) return;
      if (C.statPtsFree(p.alloc, p.lvl) <= 0) return this.toast(p, 'ไม่มีแต้มสถานะเหลือ');
      if (!this.addStat(p, k, n)) return this.toast(p, `${C.STAT_POINTS[k].th} อัปได้สูงสุด ${C.STAT_POINTS[k].max} แต้ม`);
      if (k === 'crit' && p.alloc.crit > C.statLimits(p.cls, p.lvl, p.eq, p.alloc).crit)
        this.toast(p, `คริติคอลรวมเต็มเพดาน ${Math.round(C.CRIT_CAP * 100)}% แล้ว แต้มที่เกินไม่มีผล (รีเซ็ตแต้มเพื่อย้ายไปค่าอื่นได้)`);
    } else if (d.cmd === 'guide') {
      // all free points toward the class build guide
      if (C.statPtsFree(p.alloc, p.lvl) <= 0) return this.toast(p, 'ไม่มีแต้มสถานะเหลือ');
      const n = this.addStat(p, C.STAT_GUIDE_KEY, Infinity);
      this.toast(p, n ? `แจกแต้มตามแนวทาง${C.CLASSES[p.cls].name}แล้ว ${n} แต้ม` : 'ค่าสถานะตามแนวทางเต็มเพดานแล้ว แจกแต้มที่เหลือเองได้');
    } else if (d.cmd === 'reset') {
      const cost = this.statResetCost(p);
      if (p.gold < cost) return this.toast(p, `ทองไม่พอ (รีเซ็ตแต้มใช้ ${cost.toLocaleString()} ทอง)`);
      p.gold -= cost;
      for (const k of C.PT_KEYS) p.alloc[k] = 0;
      this.toast(p, `รีเซ็ตแต้มสถานะแล้ว${cost ? ` (-${cost.toLocaleString()} ทอง)` : ''}`);
      this.sendInv(p);
    } else if (d.cmd === 'auto') {
      // from the next level on, each level's points go straight into this stat
      p.autoStat = C.STAT_POINTS[d.k] || d.k === C.STAT_GUIDE_KEY ? d.k : '';
      const what = p.autoStat === C.STAT_GUIDE_KEY ? `ตามแนวทาง${C.CLASSES[p.cls].name}` : p.autoStat && C.STAT_POINTS[p.autoStat].th;
      this.toast(p, p.autoStat ? `อัปอัตโนมัติ: ${what} ทุกครั้งที่เลเวลอัป` : 'ปิดอัปอัตโนมัติ (แจกแต้มเอง)');
    } else return;
    this.refreshStats(p);
    this.sendStat(p);
    this.save(p);
  }

  // ------------------------------------------------------------ monsters
  spawnAllMonsters() {
    for (const mapId of C.MAP_ORDER) {
      const M = this.maps[mapId];
      for (const z of M.def.zones) {
        if (z.packs && !z.fixed) this.pickPacks(M, z);
        for (let i = 0; i < z.count; i++) {
          const m = { id: 'm' + this.seq++, type: z.type, tIdx: C.MONSTER_TYPES.indexOf(z.type), def: C.MONSTERS[z.type], zone: z, mapId };
          if (z.packCenters) { m.pack = i % z.packCenters.length; z.packCenters[m.pack].members.push(m); }
          this.placeMonster(m);
          M.monsters.push(m);
          this.monsters.push(m);
          this.mById.set(m.id, m);
        }
      }
    }
  }
  // pack spots inside an area: standable, outside the camp, spread apart (at least 5 tiles when possible)
  pickPacks(M, z) {
    const map = M.map, def = M.def, out = [];
    for (let tries = 0; tries < 400 && out.length < z.packs; tries++) {
      const x = (z.x0 + 1 + Math.random() * (z.x1 - z.x0 - 1)) * TILE, y = (z.y0 + 1 + Math.random() * (z.y1 - z.y0 - 1)) * TILE;
      if (!C.canStand(map, x, y, 26) || C.noMonster(def, x, y)) continue;
      const minD = (tries < 300 ? 5 : 2.5) * TILE;
      if (out.some((c) => Math.hypot(c.x - x, c.y - y) < minD)) continue;
      out.push({ x, y, members: [] });
    }
    if (out.length) z.packCenters = out;
  }
  placeMonster(m) {
    const z = m.zone, map = this.mapOf(m), def = this.defOf(m);
    let x = 0, y = 0;
    if (def.pvp && m.def.boss) {
      x = (C.CENTER.tx + 0.5) * TILE; y = (C.CENTER.ty - 2) * TILE;
    } else if (z.fixed) {
      x = ((z.x0 + z.x1 + 1) / 2) * TILE; y = ((z.y0 + z.y1 + 1) / 2) * TILE;
    } else if (z.packCenters && m.pack !== undefined) {
      // a pack member: close around its pack's spot
      const c = z.packCenters[m.pack];
      x = c.x; y = c.y;
      for (let tries = 0; tries < 60; tries++) {
        const a = Math.random() * Math.PI * 2, r = (0.6 + Math.random() * 1.6) * TILE;
        const nx = c.x + Math.cos(a) * r, ny = c.y + Math.sin(a) * r;
        if (C.canStand(map, nx, ny, 18) && !C.noMonster(def, nx, ny)) { x = nx; y = ny; break; }
      }
    } else {
      for (let tries = 0; tries < 300; tries++) {
        x = (z.x0 + Math.random() * (z.x1 - z.x0 + 1)) * TILE;
        y = (z.y0 + Math.random() * (z.y1 - z.y0 + 1)) * TILE;
        if (C.canStand(map, x, y, 18) && !C.noMonster(def, x, y)) break;
      }
    }
    Object.assign(m, {
      x, y, hx: x, hy: y, wx: x, wy: y, hp: m.def.hp, dead: false, target: null, threat: new Map(),
      face: Math.random() < 0.5 ? 1 : -1, moving: false, nextAtk: 0, nextWander: Date.now() + Math.random() * 3000,
      returning: false, dots: [], nextSpecial: Date.now() + 4000, lastHurt: 0, nextRetarget: 0,
      stunUntil: 0, rootUntil: 0, slowUntil: 0, monsterCast: null, taunt: null, tauntImmuneUntil: 0,
    });
  }

  // a pack member was attacked: the others of its pack close by join the fight against the same player
  alertPack(m, src) {
    const c = m.zone && m.zone.packCenters && m.pack !== undefined && m.zone.packCenters[m.pack];
    if (!c) return;
    for (const o of c.members) {
      if (o === m || o.dead || o.target || o.returning || Math.hypot(o.x - m.x, o.y - m.y) > 320) continue;
      o.target = src.id; o.threat.set(src.id, 1);
    }
  }

  moveToward(m, tx, ty, step, ghost) {
    if (step <= 0) return;
    const dx = tx - m.x, dy = ty - m.y, L = Math.hypot(dx, dy);
    if (L < 1) return;
    const s = Math.min(step, L), nx = m.x + (dx / L) * s, ny = m.y + (dy / L) * s;
    const map = this.mapOf(m), def = this.defOf(m);
    const ok = (x, y) => ghost || (C.canStand(map, x, y, 16) && !C.noMonster(def, x, y));
    if (ok(nx, ny)) { m.x = nx; m.y = ny; }
    else if (ok(nx, m.y)) m.x = nx;
    else if (ok(m.x, ny)) m.y = ny;
    else { m.nextWander = 0; return; }
    if (Math.abs(dx) > 2) m.face = dx > 0 ? 1 : -1;
    m.moving = true;
  }

  cancelMonsterSkill(m) {
    if(!m.monsterCast)return;
    this.emitNear(m.mapId,m.x,m.y,'fx',{t:'monsterCancel',id:m.id,mapId:m.mapId,token:m.monsterCast.token});
    m.monsterCast=null;
  }
  startMonsterSkill(m,target,now) {
    const sk=m.def.skill;
    if(!sk||m.monsterCast||now<(m.nextSpecial||0)||dist(m,target)>sk.range)return false;
    const cast={...sk,art:sk.id,t:'monsterWindup',id:m.id,token:m.id+':'+now,mapId:m.mapId,
      x:sk.shape==='circle'&&!sk.self?target.x:m.x,y:sk.shape==='circle'&&!sk.self?target.y:m.y,
      a:Math.atan2(target.y-m.y,target.x-m.x),d:sk.cast,until:now+sk.cast};
    m.monsterCast=cast;m.nextSpecial=now+sk.cd;m.nextAtk=now+sk.cast+650;m.moving=false;
    m.face=target.x>=m.x?1:-1;
    this.emitNear(m.mapId,m.x,m.y,'fx',cast);
    this.later(sk.cast,()=>{
      if(m.monsterCast!==cast)return;
      const live=this.players.get(m.target),time=Date.now();
      if(m.dead||m.returning||m.mapId!==cast.mapId||time<(m.stunUntil||0)||!live||live.dead||live.mapId!==cast.mapId||C.safeAt(this.defOf(m),live.x,live.y)||dist(m,live)>900||Math.hypot(m.x-m.hx,m.y-m.hy)>(m.def.boss?640:560)){
        this.cancelMonsterSkill(m);return;
      }
      m.monsterCast=null;
      this.emitNear(cast.mapId,cast.x,cast.y,'fx',{...cast,t:'monsterRelease'});
      for(const q of this.players.values())if(!q.dead&&q.mapId===cast.mapId&&!C.safeAt(this.defOf(m),q.x,q.y)&&C.monsterSkillContains(cast,q.x,q.y))this.applyDamage(m,q,sk.power);
    });
    return true;
  }
  updateMonster(m, dt, now) {
    if (m.dead) {
      this.cancelMonsterSkill(m);
      if (now >= m.respawnAt) {
        this.placeMonster(m);
        this.emitNear(m.mapId, m.x, m.y, 'fx', { t: 'mspawn', x: m.x, y: m.y });
        if (m.def.boss) this.systemChat(`☠ ${m.def.name} ได้ปรากฏตัวที่${this.defOf(m).pvp ? 'สนามรบกลาง' : this.defOf(m).name}อีกครั้ง!`);
      }
      return;
    }
    const d = m.def, mdef = this.defOf(m);
    m.moving = false;
    const leash = d.boss ? 640 : 560;
    if (m.taunt) {
      const inLeash = Math.hypot(m.x - m.hx, m.y - m.hy) <= leash;
      const legal = q => q && !q.dead && q.mapId === m.mapId && inLeash &&
        !C.safeAt(mdef, q.x, q.y) && dist(m, q) <= 900;
      const forced = this.players.get(m.taunt.target);
      if (now < m.taunt.until && legal(forced) && !m.returning) m.target = forced.id;
      else {
        // Resume the prior fight, or another real contributor, when the taunt ends or its caster leaves.
        let prior = this.players.get(m.taunt.previous);
        if (!legal(prior)) prior = null;
        if (!prior && inLeash) for (const [pid, damage] of m.threat) {
          const q = this.players.get(pid);
          if (legal(q) && (!prior || damage > (m.threat.get(prior.id) || 0))) prior = q;
        }
        // Nobody else was fighting it: the taunt itself opened the fight (monsters never pick one on their own),
        // so it keeps on the taunter until the normal break rules. Still no fake threat / XP / loot credit.
        if (!prior && legal(forced)) prior = forced;
        m.taunt = null; m.target = prior ? prior.id : null; m.returning = !prior;
        m.nextRetarget = now + 2000;
        if (!inLeash) m.threat.clear(); // retain the existing leash-reset rule
      }
    }
    if (now < (m.stunUntil || 0)) { this.cancelMonsterSkill(m); return; }
    const spd = d.speed * (now < (m.rootUntil || 0) ? 0 : now < (m.slowUntil || 0) ? 0.45 : 1);
    let tgt = m.target ? this.players.get(m.target) : null;
    if (tgt && (tgt.dead || tgt.mapId !== m.mapId || C.safeAt(mdef, tgt.x, tgt.y) || Math.hypot(m.x - m.hx, m.y - m.hy) > leash || dist(m, tgt) > 900)) {
      tgt = null; m.target = null; m.threat.clear(); m.returning = true;
    }
    if (tgt && !m.taunt && m.threat.size > 1 && now > m.nextRetarget) {
      m.nextRetarget = now + 2000;
      let best = tgt, bestV = m.threat.get(tgt.id) || 0;
      for (const [pid, v] of m.threat) {
        const q = this.players.get(pid);
        if (q && !q.dead && q.mapId === m.mapId && v > bestV * 1.2 && dist(q, m) < 600) { best = q; bestV = v; }
      }
      tgt = best; m.target = best.id;
    }
    // monsters never pick a fight: re-acquire a target only among players already in its threat
    // (someone who already attacked it), never an unprovoked player who merely walked close
    if (!tgt && !m.returning && m.threat.size > 0) {
      let best = null, bd = d.aggro > 0 ? d.aggro : Infinity;
      for (const [pid] of m.threat) {
        const q = this.players.get(pid);
        if (!q || q.dead || q.mapId !== m.mapId || C.safeAt(mdef, q.x, q.y)) continue;
        const dd = dist(q, m);
        if (dd < bd) { bd = dd; best = q; }
      }
      if (best) { tgt = best; m.target = best.id; }
    }

    if(!tgt)this.cancelMonsterSkill(m);
    if(m.monsterCast)return;
    if (tgt) {
      const dd = dist(m, tgt);
      if(this.startMonsterSkill(m,tgt,now))return;
      const reach = d.atkRange + 14;
      if (dd > reach * 0.8) this.moveToward(m, tgt.x, tgt.y, spd * dt);
      else if (Math.abs(tgt.x - m.x) > 2) m.face = tgt.x > m.x ? 1 : -1;
      if (dd <= reach && now >= m.nextAtk) {
        m.nextAtk = now + d.atkCd;
        this.emitNear(m.mapId, m.x, m.y, 'matk', { id: m.id, tid: tgt.id });
        const target = tgt;
        this.later(200, () => {
          if (!m.dead && !m.returning && !target.dead && target.mapId===m.mapId && !C.safeAt(mdef,target.x,target.y) && this.players.get(target.id) === target && dist(m, target) <= reach + 34)
            this.applyDamage(m, target, 1);
        });
      }
      if (d.boss && !d.skill && now >= m.nextSpecial) {
        m.nextSpecial = now + 7000;
        const sx = m.x, sy = m.y, R = 220;
        this.emitNear(m.mapId, sx, sy, 'fx', { t: 'tele', x: sx, y: sy, r: R, d: 1200 });
        this.later(1200, () => {
          if (m.dead) return;
          this.emitNear(m.mapId, sx, sy, 'fx', { t: 'slam', x: sx, y: sy, r: R });
          for (const q of this.players.values())
            if (!q.dead && q.mapId === m.mapId && Math.hypot(q.x - sx, q.y - sy) <= R && !C.safeAt(mdef, q.x, q.y)) this.applyDamage(m, q, 1.7);
        });
      }
    } else if (m.returning) {
      this.moveToward(m, m.hx, m.hy, spd * 1.4 * dt, true);
      if (Math.hypot(m.x - m.hx, m.y - m.hy) < 16) { m.returning = false; m.hp = d.hp; }
    } else {
      if (now > m.nextWander) {
        m.nextWander = now + 2500 + Math.random() * 4500;
        const a = Math.random() * Math.PI * 2, r = Math.random() * (d.boss ? 80 : m.pack !== undefined ? 55 : 150);   // packs stay together
        m.wx = m.hx + Math.cos(a) * r; m.wy = m.hy + Math.sin(a) * r;
      }
      if (Math.hypot(m.wx - m.x, m.wy - m.y) > 6) this.moveToward(m, m.wx, m.wy, spd * 0.45 * dt);
      if (m.hp < d.hp && now - m.lastHurt > 5000) m.hp = Math.min(d.hp, m.hp + d.hp * 0.06 * dt);
    }
  }

  // ------------------------------------------------------------ loop
  later(ms, fn) { this.timers.push({ at: Date.now() + ms, fn }); }

  processDots(e, now) {
    if (!e.dots.length || e.dead) return;
    for (const dot of e.dots) {
      if (now < dot.next) continue;
      dot.next += 1000;
      dot.n--;
      const src = this.players.get(dot.src) || this.mById.get(dot.src);
      if (src && !e.dead) this.applyDamage(src, e, 0, { flat: dot.dmg, dot: true });
    }
    e.dots = e.dots.filter((x) => x.n > 0);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.2, (now - this.last) / 1000);
    this.last = now;

    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= now);
      this.timers = this.timers.filter((t) => t.at > now);
      for (const t of due) { try { t.fn(); } catch (err) { console.error(err); } }
    }

    // monsters on maps nobody is on stay frozen (they still respawn)
    const active = new Set();
    for (const p of this.players.values()) active.add(p.mapId);
    for (const m of this.monsters) {
      if (!m.dead && !active.has(m.mapId)) continue;
      this.updateMonster(m, dt, now);
      this.processDots(m, now);
    }

    for (const p of this.players.values()) {
      if (p.dead) {
        if (now > p.respawnAt + 20000) this.respawn(p);
        continue;
      }
      this.processDots(p, now);
      if (p.evil < 0) this.decayEvil(p, now);
      if (p.dead) continue;
      this.mercyAura(p, now);
      // own base (PvP map) or a camp (hunting maps) counts as home
      const def = this.defOf(p);
      const base = def.pvp ? C.baseAt(p.x, p.y) : C.safeAt(def, p.x, p.y) ? p.faction : null;
      const S = p.stats;
      if (base === p.faction) {
        p.hp += S.maxHp * 0.06 * dt;
        p.mp += S.maxMp * 0.06 * dt;
      } else if (base) {
        // the enemy base's guardian ward burns intruders
        p.guardT += dt;
        if (p.guardT >= 1) {
          p.guardT -= 1;
          const dmg = Math.round(S.maxHp * 0.08);
          p.hp -= dmg;
          p.lastHurt = now;
          this.emitNear(p.mapId, p.x, p.y, 'hit', { id: p.id, v: dmg, c: 0, k: 2 });
          if (p.hp <= 0) { p.hp = 0; this.killPlayer(p, { def: { name: 'พลังพิทักษ์ฐาน' } }); continue; }
        }
      } else {
        if (now - p.lastHurt > 6000) p.hp += S.maxHp * 0.012 * dt;
        p.mp += S.maxMp * C.roleOf(p.cls).manaRegen * dt;
      }
      p.hp = Math.min(S.maxHp, p.hp);
      p.mp = Math.min(S.maxMp, p.mp);
    }
    this.sendSnapshots(now);
  }

  sendSnapshots(now) {
    const plist = [...this.players.values()];
    for (const p of plist) {
      const P = [], M = [];
      for (const q of plist) {
        if (q.mapId !== p.mapId || Math.abs(q.x - p.x) > VIEW_X || Math.abs(q.y - p.y) > VIEW_Y) continue;
        P.push([q.id, Math.round(q.x), Math.round(q.y), q.dir, q.moving ? 1 : 0, Math.ceil(q.hp), q.stats.maxHp,
          q.faction === 'dharma' ? 0 : 1, q.name, q.lvl, q.dead ? 1 : 0, now < q.actUntil ? 1 : 0,
          C.ITEMS[q.eq.weapon].tier, C.armorTiers(q.eq), C.ITEMS[q.eq.weapon].plus || 0, C.gearGrades(q.eq), C.ITEMS[q.eq.weapon].grade || 0,
          C.CLASS_IDS.indexOf(q.cls), C.gearPlus(q.eq),
          q.pk ? 1 : 0, q.evil || 0, this.canPk(p, q, now) ? 1 : 0]);         // field PvP: flag, evil points, p may hit q
      }
      const pt = this.partyOf(p), ours = pt ? new Set(pt.members) : new Set([p.id]);   // aggro 2 = on p or its party
      for (const m of this.maps[p.mapId].monsters) {
        if (m.dead || Math.abs(m.x - p.x) > VIEW_X || Math.abs(m.y - p.y) > VIEW_Y) continue;
        M.push([m.id, m.tIdx, Math.round(m.x), Math.round(m.y), m.face, m.moving ? 1 : 0, Math.ceil(m.hp), m.def.hp,
          m.target ? (ours.has(m.target) ? 2 : 1) : 0,m.monsterCast?{...m.monsterCast,d:Math.max(1,m.monsterCast.until-now)}:null]);
      }
      p.socket.emit('snap', { t: now, mid: p.mapId, p: P, m: M, me: this.meLite(p) });
    }
  }

  // minimap: everyone on the same hunting map, only allies on the PvP map; plus the map's boss
  sendMinimap() {
    const online = { dharma: 0, adharma: 0 };
    for (const p of this.players.values()) online[p.faction]++;
    for (const p of this.players.values()) {
      const M = this.maps[p.mapId], pvp = M.def.pvp;
      const a = [];
      for (const q of this.players.values())
        if (!q.dead && q.mapId === p.mapId && (!pvp || q.faction === p.faction)) a.push([q.id, Math.round(q.x), Math.round(q.y)]);
      const boss = M.monsters.find((m) => m.def.boss);
      p.socket.emit('mm', { a, b: boss ? [Math.round(boss.x), Math.round(boss.y), boss.dead ? 0 : 1] : null, on: online });
    }
  }

  emitNear(mid, x, y, ev, data, range = 1600) {
    for (const p of this.players.values())
      if (p.mapId === mid && Math.abs(p.x - x) < range && Math.abs(p.y - y) < range) p.socket.emit(ev, data);
  }
  fx(p, data) { this.emitNear(p.mapId, p.x, p.y, 'fx', { ...data, f: p.faction }); }
  toast(p, text) { p.socket.emit('toast', text); }
  // `it` = the item a line announces: the chat colours the line by its grade (g) and highlights its name (it);
  // big = also a banner in the middle of every screen with a chime (Mythic drops, +10 enhancement)
  systemChat(text, it, big) {
    const m = { sys: 1, t: text, ...this.chatItem(it), ...(big ? { big: 1 } : {}) };
    for (const p of this.players.values()) p.socket.emit('chat', m);
  }
  chatItem(it) { return it && !it.kind ? { g: it.grade || 0, it: it.name } : {}; }
}

module.exports = World;
