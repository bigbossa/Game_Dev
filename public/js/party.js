// Party: member frame (HP/MP, map, leader), invite popup, the menu when clicking another player.
// Members near a kill share its EXP (server: shareExp). Chat: /p text · /party name · /leave · /kick name
(function () {
  const PARTY = { leader: null, list: [], ids: new Set(), rules: C.PARTY_DEFAULT };
  window.PARTY = PARTY;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const send = (d) => G.socket && G.socket.emit('party', d);
  const pct = (v, m) => `${Math.max(0, Math.min(1, m ? v / m : 0)) * 100}%`;

  PARTY.esc = esc;
  PARTY.isLeader = () => !!G.myId && PARTY.leader === G.myId;
  PARTY.set = function (d) {
    PARTY.leader = d ? d.leader : null;
    PARTY.list = d ? d.m : [];
    PARTY.rules = (d && d.rules) || C.PARTY_DEFAULT;
    PARTY.ids = new Set(PARTY.list.map((m) => m.id));
    render();
    if (window.FOLLOW) FOLLOW.sync();
  };

  // how kills are shared (แบบ Ragnarok): the leader clicks a rule to switch it, the others only see it
  const RULES = { exp: ['EXP', C.PARTY_EXP_MODES], item: ['ไอเทม', C.PARTY_ITEM_MODES] };
  function rulesHtml(lead) {
    return '<div class="pt-rules">' + Object.entries(RULES).map(([k, [label, modes]]) => {
      const m = modes[PARTY.rules[k]] || Object.values(modes)[0];
      const tip = esc(Object.values(modes).map((x) => `${x.name}: ${x.desc}`).join('\n') + (lead ? '\n(คลิกเพื่อเปลี่ยน)' : '\n(หัวหน้าปาร์ตี้เป็นคนตั้ง)'));
      return `<span class="pt-rule">${label} ${lead ? `<button type="button" data-rule="${k}" title="${tip}">${esc(m.name)}</button>` : `<b title="${tip}">${esc(m.name)}</b>`}</span>`;
    }).join('') + '</div>';
  }

  function render() {
    const box = $('partyFrame');
    if (!PARTY.list.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const lead = PARTY.isLeader();
    box.innerHTML = `<div class="pt-head"><span>👥 ปาร์ตี้ ${PARTY.list.length}/${C.PARTY_MAX}</span>` +
      `<span class="pt-btns"><button type="button" class="pt-leave" title="ออกจากปาร์ตี้">ออก</button>` +
      `<button type="button" class="hud-fold" data-fold="party" title="${HUD.layout.party ? 'แสดงสมาชิกปาร์ตี้' : 'ย่อปาร์ตี้'}"></button></span></div>` +
      rulesHtml(lead) +
      (lead ? '' : `<button type="button" class="pt-follow${window.FOLLOW && FOLLOW.on ? ' on' : ''}" title="เดินตามหัวหน้าและช่วยตีมอนตัวเดียวกัน · ใช้สกิลและยาตามกล่องบอท (O) · กดเดินเอง = พักชั่วคราว">${window.FOLLOW && FOLLOW.on ? '■ หยุดติดตาม' : '🚶 ติดตามหัวหน้า'}</button>`) +
      PARTY.list.map((m) => {
        const me = m.id === G.myId, away = m.map !== G.mapId;
        const where = m.dead ? '<small class="pt-dead">ตาย</small>' : away ? `<small>${esc((C.MAPS[m.map] || {}).name || '')}</small>` : '';
        return `<div class="pt-mem${me ? ' me' : ''}${away ? ' away' : ''}" data-id="${m.id}" title="${me ? '' : 'คลิก = เดินไปหา'}">` +
          `<div class="pt-name">${m.id === PARTY.leader ? '<span class="pt-crown">♛</span>' : ''}${m.fo ? '<span class="pt-fo" title="กำลังติดตามหัวหน้า">🚶</span>' : ''}${esc(m.n)} <small>Lv.${m.lvl}</small>${where}` +
          `${lead && !me ? `<button type="button" class="pt-kick" data-kick="${m.id}" title="เชิญออกจากปาร์ตี้">✕</button>` : ''}</div>` +
          `<div class="pt-bar hp"><i style="width:${pct(m.hp, m.mhp)}"></i></div><div class="pt-bar mp"><i style="width:${pct(m.mp, m.mmp)}"></i></div></div>`;
      }).join('');
  }

  $('partyFrame').addEventListener('click', (e) => {
    if (e.target.closest('.pt-follow')) { e.stopPropagation(); FOLLOW.toggle(); render(); return; }
    const rule = e.target.closest('[data-rule]');
    if (rule) {
      e.stopPropagation();
      const k = rule.dataset.rule, ids = Object.keys(RULES[k][1]);
      send({ cmd: 'rules', [k]: ids[(ids.indexOf(PARTY.rules[k]) + 1) % ids.length] });
      return;
    }
    const kick = e.target.closest('[data-kick]');
    if (kick) { e.stopPropagation(); const m = PARTY.list.find((q) => q.id === kick.dataset.kick); if (m && confirm(`เชิญ ${m.n} ออกจากปาร์ตี้?`)) send({ cmd: 'kick', id: m.id }); return; }
    if (e.target.closest('.pt-leave')) { if (confirm('ออกจากปาร์ตี้?')) send({ cmd: 'leave' }); return; }
    // walk to a member on this map
    const row = e.target.closest('.pt-mem');
    if (!row || row.dataset.id === G.myId) return;
    const m = PARTY.list.find((q) => q.id === row.dataset.id);
    if (!m) return;
    if (m.map !== G.mapId) return HUD.toast(`${m.n} อยู่ที่${(C.MAPS[m.map] || {}).name || 'แผนที่อื่น'}`);
    const e2 = G.ents.get(m.id), mm = ((HUD.mm && HUD.mm.a) || []).find((a) => a[0] === m.id);
    const pos = e2 ? { x: e2.x, y: e2.y } : mm ? { x: mm[1], y: mm[2] } : null;
    if (pos) G.travelTo(pos.x, pos.y + 30, m.n);
  });

  // ---------------- invites: joining always needs this popup's answer (ตกลง / ปฏิเสธ, or Y / N)
  // Invites from several players queue up and are shown one at a time; an unanswered one expires after its ttl
  // (the inviter is told it was not answered).
  let invite = null, inviteTimer = null, tick = null;
  const queue = [];
  PARTY.invite = function (d) {
    d.until = performance.now() + (d.ttl || C.PARTY_INVITE_MS);
    d.type = d.type || 'invite';
    const i = queue.findIndex((q) => q.from === d.from);
    if (i >= 0) queue.splice(i, 1);
    if (invite && invite.from === d.from) { invite = null; queue.unshift(d); next(); return; }   // renewed: show it again
    queue.push(d);
    if (!invite) next(); else showQueue();
  };
  // ขอเข้าร่วมปาร์ตี้: the reverse of an invite (someone asking to join you), shown in the same popup
  PARTY.request = function (d) { PARTY.invite({ ...d, type: 'request' }); };
  PARTY.pendingInvite = () => !!invite;
  const showQueue = () => { $('piQueue').textContent = queue.length ? `+${queue.length} รอ` : ''; };
  function next() {
    clearTimeout(inviteTimer); clearInterval(tick);
    while (queue.length && queue[0].until <= performance.now()) answerFor(queue.shift(), false, true);
    invite = queue.shift() || null;
    const box = $('partyInvite');
    if (!invite) { box.classList.add('hidden'); return; }
    const d = invite, cls = C.CLASSES[d.cls] || C.CLASSES.dualblade, fac = C.FACTIONS[d.f] || C.FACTIONS.dharma;
    $('piImg').src = cls.sheet ? `assets/${cls.sheet}-${fac.id}-portrait.png` : `assets/${fac.id}-portrait.png`;
    if (!cls.sheet && window.DualbladeModel?.ready) $('piImg').src = DualbladeModel.portrait(fac.id);
    if(cls.id==='archer'&&window.ArcherModel?.ready)$('piImg').src=ArcherModel.portrait(fac.id);
    if(cls.id==='spearman'&&fac.id==='adharma')$('piImg').src='assets/adharma-hair/spearman-adharma-portrait.png';
    $('piImg').parentElement.style.borderColor = fac.color;
    $('piLvl').textContent = d.lvl;
    $('piName').textContent = d.name;
    $('piMeta').innerHTML = `${esc(cls.name)} · <span style="color:${fac.color}">ฝ่าย${esc(fac.name)}</span>`;
    $('piTitle').textContent = d.type === 'request' ? 'คำขอเข้าร่วมปาร์ตี้' : 'คำเชิญเข้าปาร์ตี้';
    if (d.type === 'request') {
      $('piSize').textContent = `${d.name} ขอเข้าร่วมปาร์ตี้ของคุณ` + (d.size > 1 ? ` (ตอนนี้ ${d.size}/${C.PARTY_MAX} คน)` : '');
    } else {
      const r = d.rules || C.PARTY_DEFAULT;
      $('piSize').textContent = (d.size > 1 ? `ปาร์ตี้ตอนนี้ ${d.size}/${C.PARTY_MAX} คน` : 'ตั้งปาร์ตี้ใหม่กับคุณ') +
        ` · EXP ${C.PARTY_EXP_MODES[r.exp].name} · ไอเทม ${C.PARTY_ITEM_MODES[r.item].name}`;
    }
    showQueue();
    // countdown bar: restart the CSS animation for this invite's remaining time
    const left = Math.max(0, d.until - performance.now()), bar = $('piBar');
    bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = `piCountdown ${left}ms linear forwards`;
    const sec = () => { $('piSec').textContent = `${Math.max(0, Math.ceil((d.until - performance.now()) / 1000))} วิ`; };
    sec(); tick = setInterval(sec, 250);
    inviteTimer = setTimeout(() => answer(false, true), left);
    box.classList.remove('hidden');
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }
  function answerFor(d, yes, timeout) {
    const req = d.type === 'request';
    if (yes) send({ cmd: req ? 'approve' : 'accept', from: d.from });
    else send({ cmd: req ? 'deny' : 'decline', from: d.from, timeout: !!timeout });
  }
  function answer(yes, timeout) {
    if (!invite) return;
    const d = invite;
    invite = null;
    answerFor(d, yes, timeout);
    if (yes) while (queue.length) answerFor(queue.shift(), false);   // joined a party: decline the rest
    next();
  }
  $('ptAccept').addEventListener('click', () => answer(true));
  $('ptDecline').addEventListener('click', () => answer(false));
  addEventListener('keydown', (e) => {
    if (!invite || e.repeat) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (k === 'y') { e.preventDefault(); answer(true); } else if (k === 'n') { e.preventDefault(); answer(false); }
  });

  // ---------------- click on another player
  let menuFor = null;
  PARTY.menu = function (e, x, y) {
    menuFor = e.id;
    const inMine = PARTY.ids.has(e.id), canInvite = !inMine && (!PARTY.list.length || PARTY.isLeader());
    // a player joins only within ±PARTY_LVL_GAP levels of every member (the server checks it again)
    const levels = PARTY.list.length ? PARTY.list.map((m) => m.lvl) : [(G.stats && G.stats.lvl) || 1];
    const far = canInvite && levels.some((l) => Math.abs(l - (e.lvl || 1)) > C.PARTY_LVL_GAP);
    const btns = [];
    if (canInvite && !far) btns.push('<button type="button" data-act="invite">👥 ชวนเข้าปาร์ตี้</button>');
    if (far) btns.push(`<div class="pm-note">ชวนไม่ได้: เลเวลต้องห่างจากทุกคนในปาร์ตี้ไม่เกิน ${C.PARTY_LVL_GAP}</div>`);
    // ขอเข้าร่วม: the other direction — you ask to join their (or a would-be) party; the server checks the level gap
    if (!inMine && !PARTY.list.length) btns.push('<button type="button" data-act="request">🙋 ขอเข้าร่วมปาร์ตี้</button>');
    if (inMine && PARTY.isLeader()) btns.push('<button type="button" data-act="kick" class="warn">เชิญออกจากปาร์ตี้</button>');
    btns.push('<button type="button" data-act="inspect">🔍 ดูอุปกรณ์ที่สวมใส่</button>');
    if (btns.length === 1) btns.push(`<div class="pm-note">${inMine ? 'สมาชิกปาร์ตี้ของคุณ' : 'เฉพาะหัวหน้าปาร์ตี้ที่ชวนได้'}</div>`);
    const box = $('playerMenu');
    box.innerHTML = `<div class="pm-name" style="color:${C.FACTIONS[e.faction].color}">${esc(e.name)} <small>Lv.${e.lvl}</small></div>${btns.join('')}`;
    box.classList.remove('hidden');
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, x + 10))}px`;
    box.style.top = `${Math.max(6, Math.min(window.innerHeight - h - 6, y - h / 2))}px`;
  };
  PARTY.closeMenu = () => { $('playerMenu').classList.add('hidden'); menuFor = null; };
  $('playerMenu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !menuFor) return;
    if (b.dataset.act === 'invite') send({ cmd: 'invite', id: menuFor });
    if (b.dataset.act === 'request') send({ cmd: 'request', id: menuFor });
    if (b.dataset.act === 'kick') send({ cmd: 'kick', id: menuFor });
    if (b.dataset.act === 'inspect') WHO.inspect(menuFor);
    PARTY.closeMenu();
  });
  addEventListener('pointerdown', (e) => { if (menuFor && !e.target.closest('#playerMenu')) PARTY.closeMenu(); }, true);
})();
