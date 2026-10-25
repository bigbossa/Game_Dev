// Follow the party leader (ติดตามหัวหน้า): a member walks with the leader and helps it fight.
// The leader's spot and the monster it is hitting come with the party state (server: sendParty, x / y / t);
// the fighting itself uses the bot's skills and potion settings (BOT.fight / BOT.potions, กล่องบอท O).
// When the leader changes map the server takes the followers near it along. WASD / joystick / a click on the
// ground take over for a moment; the auto-hunt bot and following never run together.
(function () {
  const FOLLOW = { on: false, manualUntil: 0 };
  window.FOLLOW = FOLLOW;
  const $ = (id) => document.getElementById(id);
  const KEEP = 110;          // stand this close to the leader
  const LEASH = 650;         // never fight further than this from the leader
  const DEFEND = 260;        // monsters hitting me / the party this close are fought back even without the leader

  const leader = () => window.PARTY && PARTY.list.find((m) => m.id === PARTY.leader);
  const canFollow = () => !!(window.PARTY && PARTY.list.length && !PARTY.isLeader());

  function status() {
    const s = $('followStatus'), L = leader();
    s.classList.toggle('hidden', !FOLLOW.on);
    if (FOLLOW.on && L) {
      const away = L.map !== G.mapId ? ` (อยู่ที่${(C.MAPS[L.map] || {}).name || 'แผนที่อื่น'})` : '';
      s.innerHTML = `👥 ติดตาม ${PARTY.esc(L.n)}${away} <b>หยุด</b>`;
    }
  }
  FOLLOW.start = function () {
    if (!canFollow()) return HUD.toast('ติดตามได้เฉพาะสมาชิกปาร์ตี้ที่ไม่ใช่หัวหน้า');
    if (BOT.on) BOT.stop();
    FOLLOW.on = true;
    FOLLOW.manualUntil = 0;
    G.socket.emit('party', { cmd: 'follow', on: true });
    HUD.toast(`ติดตามหัวหน้า ${leader().n} · ใช้สกิลและยาตามที่ตั้งในกล่องบอท (O)`);
    status();
  };
  FOLLOW.stop = function (why) {
    if (!FOLLOW.on) return;
    FOLLOW.on = false;
    if (G.order && G.order.follow) G.order = null;
    if (G.socket) G.socket.emit('party', { cmd: 'follow', on: false });
    if (why) HUD.toast(why);
    status();
  };
  FOLLOW.toggle = () => (FOLLOW.on ? FOLLOW.stop('หยุดติดตามหัวหน้า') : FOLLOW.start());
  FOLLOW.manual = (ms = 2500) => { if (FOLLOW.on) FOLLOW.manualUntil = performance.now() + ms; };
  // party state changed: no party / became the leader = stop
  FOLLOW.sync = function () {
    if (FOLLOW.on && !canFollow()) FOLLOW.stop(PARTY.list.length ? 'คุณเป็นหัวหน้าปาร์ตี้แล้ว · หยุดติดตาม' : 'ออกจากปาร์ตี้ · หยุดติดตาม');
    else status();
  };

  let nextThink = 0, nextMove = 0;
  FOLLOW.tick = function (now) {
    if (!FOLLOW.on) return;
    const me = G.me, A = BOT.api, L = leader();
    if (!me || !A || !L || me.dead || G.mapLoading) return;
    BOT.potions();
    if (L.map !== G.mapId || L.dead) { if (G.order && G.order.follow) G.order = null; return; }
    if (AscendedSkills.active(me, now) || now < FOLLOW.manualUntil || now < nextThink) return;
    nextThink = now + 120;
    const le = G.ents.get(L.id), lx = le ? le.x : L.x, ly = le ? le.y : L.y;
    const fromLeader = (e) => Math.hypot(e.x - lx, e.y - ly);
    // what to fight: the leader's monster, else one hitting me nearby; never too far from the leader
    let t = L.t && G.ents.get(L.t);
    if (!A.isFoe(t) || t.kind !== 'm' || fromLeader(t) > LEASH) t = null;
    if (!t) {
      const cur = A.targetEnt();
      if (cur && cur.kind === 'm' && cur.ours && fromLeader(cur) <= LEASH) t = cur;
    }
    if (!t) {
      let bd = DEFEND;
      for (const e of G.ents.values()) {
        if (e.kind !== 'm' || !e.ours || !A.isFoe(e) || fromLeader(e) > LEASH) continue;
        const d = A.gapTo(e);
        if (d < bd) { bd = d; t = e; }
      }
    }
    if (t) {
      if (A.targetEnt() !== t) A.setTarget(t, true);
      BOT.fight(t, now);
      if (G.order && G.order.bot) G.order.follow = true;
      return;
    }
    // nothing to fight: keep close to the leader, each member on its own side so they do not stack
    const i = Math.max(0, PARTY.list.findIndex((m) => m.id === G.myId));
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2, gx = lx + Math.cos(a) * 60, gy = ly + Math.sin(a) * 40;
    const far = Math.hypot(me.x - lx, me.y - ly);
    if (far > KEEP) {
      if (now > nextMove || !G.order) {
        nextMove = now + (far > 400 ? 300 : 450);
        A.orderMove(C.canStand(G.map, gx, gy) ? gx : lx, C.canStand(G.map, gx, gy) ? gy : ly, 'move');
        if (G.order) G.order.follow = true;
      }
    } else if (G.order && G.order.follow) G.order = null;
  };

  function bind() { $('followStatus').addEventListener('click', () => FOLLOW.stop('หยุดติดตามหัวหน้า')); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
