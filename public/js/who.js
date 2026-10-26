// Online players (👥 button / P): everyone in the world with level, class, faction and map; click one to inspect what
// they wear (server 'who' → list, 'inspect' → one player's equipment and main stats). Hover an item for its details.
(function () {
  const WHO = { open: false, list: [], me: null, view: null };
  window.WHO = WHO;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const send = (d) => G.socket && G.socket.emit('who', d);
  const fmt = (n) => Math.round(n).toLocaleString('th-TH');
  let timer = null, filter = '';

  WHO.toggle = function (force) {
    const open = force !== undefined ? !!force : !WHO.open;
    if (open === WHO.open) return;
    WHO.open = open;
    $('whoPanel').classList.toggle('hidden', !open);
    clearInterval(timer); hideTip();
    if (!open) return;
    WHO.view = null; send({ cmd: 'list' });
    timer = setInterval(() => { if (!WHO.view) send({ cmd: 'list' }); }, 5000);   // the list stays fresh while open
    render();
  };
  WHO.setList = (d) => { WHO.list = (d && d.list) || []; WHO.me = d && d.me; if (WHO.open && !WHO.view) render(); };
  WHO.setInspect = (d) => { if (!WHO.open) WHO.toggle(true); WHO.view = d; render(); };
  // open the panel straight on one player (from the list, or the menu when clicking a player in the world)
  WHO.inspect = (id) => { WHO.toggle(true); WHO.view = { loading: true, id }; render(); send({ cmd: 'inspect', id }); };

  const clsName = (cls) => (C.CLASSES[cls] || C.CLASSES.dualblade).name;
  const portrait = (cls, f) => { if(cls==='boxer')return BoxerLook.portrait(f);const sheet = (C.CLASSES[cls] || {}).sheet; return `assets/${sheet ? sheet + '-' : ''}${f}-portrait.png`; };
  // an item as the inspected player's class calls it (the viewer's own class renames weapons: แส้ / ธนู / ทวน ...)
  function asOf(it, cls) {
    const b = C.ITEMS[it.base || it.id] || it;
    let name = (b.names && b.names[cls]) || b.name;
    if (it.option && C.OPTIONS[it.option[0]]) name += ` «${C.OPTIONS[it.option[0]].title}»`;
    if (it.plus) name = `+${it.plus} ${name}`;
    return { ...it, name, desc: (b.descs && b.descs[cls]) || it.desc };
  }
  WHO.asOf = asOf;                                   // shared item links in the chat name the item as the sender's class
  // item icons are drawn for a class: draw them for the inspected player's class
  function iconOf(it, cls, f) {
    const saved = G.cls; G.cls = cls;
    try { return WeaponLook.iconSrc(it.base || it.id, f); } finally { G.cls = saved; }
  }
  const STAT = [['atk', 'ATK'], ['def', 'DEF'], ['hp', 'HP'], ['mp', 'MP'], ['crit', 'คริ', (v) => `${Math.round(v * 100)}%`], ['speed', 'ความเร็ว']];
  const statLine = (it) => STAT.filter(([k]) => it[k]).map(([k, n, f]) => `${n} ${f ? f(it[k]) : fmt(it[k])}`).join(' · ');

  function renderList() {
    const q = filter.trim().toLowerCase(), rows = WHO.list.filter((p) => !q || p.n.toLowerCase().includes(q));
    const nD = WHO.list.filter((p) => p.f !== 'adharma').length, nA = WHO.list.length - nD;
    return `<div class="who-bar"><input id="whoFind" type="search" placeholder="ค้นหาชื่อ…" value="${esc(filter)}" autocomplete="off">
        <span class="who-count">ออนไลน์ <b>${WHO.list.length}</b> คน · <span class="fd">ธรรมะ ${nD}</span> · <span class="fa">อธรรม ${nA}</span></span></div>
      <div class="who-list">${rows.map((p) => `<button type="button" class="who-row${p.id === WHO.me ? ' me' : ''}" data-id="${esc(p.id)}">
          <img src="${portrait(p.cls, p.f)}" alt=""><span class="who-name" style="color:${p.ev < 0 ? '#ff3b3b' : C.FACTIONS[p.f].color}">${esc(p.n)}${p.ev < 0 ? ` (${p.ev})` : ''}${p.id === WHO.me ? ' <small>(คุณ)</small>' : ''}</span>
          <span class="who-lv">Lv.${p.lvl}</span><span class="who-cls">${esc(clsName(p.cls))}</span>
          <span class="who-map">${esc((C.MAPS[p.map] || {}).name || '')}</span>
          ${p.gr ? `<span class="who-gr" style="color:${C.GRADES[p.gr].color}" title="เกรดสูงสุดที่สวม">${C.GRADES[p.gr].name}</span>` : '<span class="who-gr"></span>'}
        </button>`).join('') || '<div class="who-empty">ไม่พบผู้เล่น</div>'}</div>
      <p class="who-hint">คลิกชื่อเพื่อดูอุปกรณ์ที่สวมใส่ · ปุ่มลัด P</p>`;
  }
  function renderView(v) {
    if (v.loading) return '<div class="who-empty">กำลังโหลด…</div>';
    if (v.gone) return '<button type="button" class="who-back">← รายชื่อ</button><div class="who-empty">ผู้เล่นนี้ออฟไลน์แล้ว</div>';
    const slots = C.SLOTS.map((slot) => {
      const raw = v.eq && C.ITEMS[v.eq[slot]], it = raw && asOf(raw, v.cls);
      if (!it) return `<div class="who-eq empty"><div class="who-ico"></div><div><small>${C.SLOT_NAMES[slot]}</small><br><span class="who-none">ไม่ได้สวมใส่</span></div></div>`;
      const g = C.GRADES[it.grade || 0];
      return `<div class="who-eq" data-slot="${slot}"><div class="who-ico" style="border-color:${g.color}"><img src="${iconOf(raw, v.cls, v.faction)}" alt="">${it.plus ? `<span class="plus p${it.plus}">+${it.plus}</span>` : ''}</div>
        <div class="who-it"><small>${C.SLOT_NAMES[slot]} · <b style="color:${g.color}">${g.name}</b> · Lv.${it.lvl}</small><br><b style="color:${g.color}">${esc(it.name)}</b><br><small class="who-st">${statLine(it)}</small></div></div>`;
    }).join('');
    const s = v.st || {};
    return `<button type="button" class="who-back">← รายชื่อ</button>
      <div class="who-head"><img src="${portrait(v.cls, v.faction)}" alt="">
        <div><b style="color:${C.FACTIONS[v.faction].color}">${esc(v.name)}</b> <small>Lv.${v.lvl}</small><br>
        <small>${esc(clsName(v.cls))} · ฝ่าย${esc(C.FACTIONS[v.faction].name)} · ${esc((C.MAPS[v.map] || {}).name || '')}</small></div>
        ${v.id !== WHO.me && G.myId ? '<button type="button" class="who-invite">👥 ชวนเข้าปาร์ตี้</button>' : ''}
        ${v.id !== WHO.me && G.myId && !(window.PARTY && PARTY.list.length) ? '<button type="button" class="who-request">🙋 ขอเข้าร่วม</button>' : ''}</div>
      <div class="who-stats"><span>HP <b>${fmt(s.hp || 0)}</b></span><span>MP <b>${fmt(s.mp || 0)}</b></span><span>ATK <b>${fmt(s.atk || 0)}</b></span>
        <span>DEF <b>${fmt(s.def || 0)}</b></span><span>คริ <b>${s.crit || 0}%</b></span><span>ความเร็ว <b>${fmt(s.speed || 0)}</b></span></div>
      <div class="who-eqs">${slots}</div>
      <p class="who-hint">ชี้ที่ไอเทมเพื่อดูรายละเอียดเต็ม</p>`;
  }
  function render() {
    if (!WHO.open) return;
    const box = $('whoBody'), keep = document.activeElement && document.activeElement.id === 'whoFind';
    box.innerHTML = WHO.view ? renderView(WHO.view) : renderList();
    $('whoTitle').textContent = WHO.view && WHO.view.name ? `👥 ${WHO.view.name}` : '👥 ผู้เล่นออนไลน์';
    if (keep) { const f = $('whoFind'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  }

  // ---- item tooltip (the inventory's own tooltip text, for the inspected player's item)
  let tip = null;
  function showTip(e, html) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'whoTip'; tip.className = 'who-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block'; moveTip(e);
  }
  function moveTip(e) { if (!tip) return; tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 16))}px`; tip.style.top = `${Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, e.clientY + 12))}px`; }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  const panel = $('whoPanel');
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.close')) return WHO.toggle(false);
    if (e.target.closest('.who-back')) { WHO.view = null; hideTip(); send({ cmd: 'list' }); return render(); }
    if (e.target.closest('.who-invite') && WHO.view) { G.socket && G.socket.emit('party', { cmd: 'invite', id: WHO.view.id }); return; }
    if (e.target.closest('.who-request') && WHO.view) { G.socket && G.socket.emit('party', { cmd: 'request', id: WHO.view.id }); return; }
    const row = e.target.closest('.who-row');
    if (row) WHO.inspect(row.dataset.id);
  });
  panel.addEventListener('input', (e) => { if (e.target.id === 'whoFind') { filter = e.target.value; render(); } });
  panel.addEventListener('keydown', (e) => e.stopPropagation());       // typing in the search box is not a hotkey
  panel.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.who-eq[data-slot]'), v = WHO.view;
    if (!row || !v || !v.eq) return;
    const raw = C.ITEMS[v.eq[row.dataset.slot]];
    if (raw && window.INV) showTip(e, INV.itemTip(asOf(raw, v.cls)));
  });
  panel.addEventListener('mousemove', (e) => { if (e.target.closest('.who-eq[data-slot]')) moveTip(e); else hideTip(); });
  panel.addEventListener('mouseleave', hideTip);
  $('whoBtn').addEventListener('click', () => WHO.toggle());
})();
