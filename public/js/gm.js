// GM / test panel: spawn items, set level, add gold, heal. Opened by typing /gm in chat (never shown in the chat log), only when the server allows it
// (a GM account unlocks it with /gmcode <รหัส> and locks it again with /out <รหัส>: server 'gmmode').
(function () {
  const GM = { enabled: false };
  let built = false;
  window.GM = GM;
  const $ = (id) => document.getElementById(id);
  const send = (d) => G.socket && G.socket.emit('gm', d);

  GM.init = function (enabled) {
    GM.enabled = !!enabled;
    if (!GM.enabled) { $('gmPanel').classList.add('hidden'); $('userPanel').classList.add('hidden'); return; }
    if (built) return;
    built = true;
    const sel = $('gmItem');
    const opts = (list) => list.map((w) => `<option value="${w.id}">Lv.${w.lvl} ${w.name}</option>`).join('');
    sel.innerHTML = `<optgroup label="อาวุธ">${opts(C.WEAPONS)}</optgroup>` +
      C.ARMOR_SLOTS.map((s) => `<optgroup label="${C.SLOT_NAMES[s]}">${opts(C.ARMORS.filter((a) => a.slot === s))}</optgroup>`).join('');
    $('gmPlus').innerHTML = [0, 1, 3, 5, 6, 7, 8, 9, 10].map((n) => `<button type="button" data-gm="plus" data-v="${n}">+${n}</button>`).join('');
    const gradeSel = $('gmGrade');
    gradeSel.innerHTML = C.GRADES.map((g, i) => `<option value="${i}" style="color:${g.color}">${g.name} (${g.th})</option>`).join('');
    const setSel = $('gmSet');
    const sets = C.ARMOR_SETS.map((s, i) => ({ ...s, tier: i + 1 })).sort((a, b) => a.lvl - b.lvl);
    setSel.innerHTML = sets.map((s) => `<option value="tier:${s.tier}">Lv.${s.lvl} ชุด${s.name}</option>`).join('');
    setSel.value = `tier:${sets.at(-1).tier}`;
    $('gmMap').innerHTML = C.MAP_ORDER.map((id) => `<option value="${id}">${C.MAPS[id].name} (${C.levelText(C.MAPS[id])})</option>`).join('');
    $('gmLvl').max = C.MAX_LVL;
    sel.value = C.WEAPONS.at(-1).id;
    $('gmPanel').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('close')) return GM.toggle(false);
      const a = b.dataset.gm, v = b.dataset.v, to = $('gmTo').value.trim();   // gifts go to this character (empty = self)
      if (a === 'toself') $('gmTo').value = '';
      else if (a === 'item') send({ cmd: 'item', id: sel.value, n: Number($('gmQty').value) || 1, g: gradeSel.value, to });
      else if (a === 'allitems') send({ cmd: 'item', id: 'all', g: gradeSel.value, to });
      else if (a === 'set') send({ cmd: 'set', id: setSel.value, g: gradeSel.value, to });
      else if (a === 'plus') send({ cmd: 'plus', n: Number(v), slot: $('gmPlusSlot').value });
      else if (a === 'stone') send({ cmd: 'stone', n: Number(v), to });
      else if (a === 'clearbag') { if (confirm('ล้างไอเทมทั้งหมดในกระเป๋า?')) send({ cmd: 'clearbag' }); }
      else if (a === 'lvl') { if (v) $('gmLvl').value = v; send({ cmd: 'lvl', lvl: Number($('gmLvl').value) }); }
      else if (a === 'gold') send({ cmd: 'gold', n: Number(v || $('gmGold').value), to });
      else if (a === 'heal') send({ cmd: 'heal' });
      else if (a === 'map') send({ cmd: 'map', id: $('gmMap').value });
    });
  };
  // /user: every saved character, with a delete button (GM only; never shown in the chat)
  let users = [];
  const picked = new Set();               // ticked names (lower case)
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sendUsers = (d) => G.socket && G.socket.emit('users', d);
  function renderUsers() {
    const q = $('userSearch').value.trim().toLowerCase();
    const list = users.filter((u) => !q || u.name.toLowerCase().includes(q));
    $('userCount').textContent = `${list.length} / ${users.length} ตัวละคร`;
    $('userList').innerHTML = list.map((u) =>
      `<label class="user-row${u.online ? ' on' : ''}">` +
      (u.me ? '<input type="checkbox" disabled title="ตัวคุณ">' : `<input type="checkbox" data-pick="${esc(u.name)}"${picked.has(u.name.toLowerCase()) ? ' checked' : ''}>`) +
      `<span class="user-name" style="color:${(C.FACTIONS[u.faction] || C.FACTIONS.dharma).color}">${esc(u.name)}</span>` +
      `<small>Lv.${u.lvl} · ${esc((C.CLASSES[u.cls] || C.CLASSES.dualblade).name)} · ${esc((C.MAPS && C.MAPS[u.map] && C.MAPS[u.map].name) || '-')}${u.online ? ' · <b>ออนไลน์</b>' : ''}</small>` +
      (u.me ? '<em>ตัวคุณ</em>' : `<button type="button" data-del="${esc(u.name)}">ลบ</button>`) + '</label>').join('') ||
      '<div class="user-empty">ไม่พบตัวละคร</div>';
    syncPicked();
  }
  // rows shown by the search that can be ticked (never the GM's own character)
  const shownRows = () => [...$('userList').querySelectorAll('input[data-pick]')];
  function syncPicked() {
    const rows = shownRows(), on = rows.filter((c) => c.checked).length;
    const all = $('userAll');
    all.checked = rows.length > 0 && on === rows.length;
    all.indeterminate = on > 0 && on < rows.length;
    const b = $('userDelSel');
    b.disabled = picked.size === 0;
    b.textContent = `ลบที่เลือก (${picked.size})`;
  }
  GM.setUsers = function (list) {
    users = Array.isArray(list) ? list : [];
    // the GM panel's recipient field offers every saved character (online first)
    $('gmToList').innerHTML = [...users].sort((x, y) => (y.online ? 1 : 0) - (x.online ? 1 : 0)).filter((u) => !u.me)
      .map((u) => `<option value="${esc(u.name)}">Lv.${u.lvl} ${esc((C.CLASSES[u.cls] || C.CLASSES.dualblade).name)}${u.online ? ' · ออนไลน์' : ''}</option>`).join('');
    const still = new Set(users.map((u) => u.name.toLowerCase()));
    for (const n of [...picked]) if (!still.has(n)) picked.delete(n);
    renderUsers();
  };
  GM.users = function (open) {
    if (!GM.enabled) return;
    $('userPanel').classList.toggle('hidden', !open);
    if (open) { picked.clear(); $('userList').innerHTML = '<div class="user-empty">กำลังโหลด...</div>'; sendUsers({ cmd: 'list' }); }
  };
  $('userPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('close')) return GM.users(false);
    if (b.dataset.refresh) return sendUsers({ cmd: 'list' });
    if (b.id === 'userDelSel') {
      const names = users.filter((u) => picked.has(u.name.toLowerCase())).map((u) => u.name);
      if (!names.length) return;
      const preview = names.slice(0, 10).join(', ') + (names.length > 10 ? ` และอีก ${names.length - 10} ตัว` : '');
      if (confirm(`ลบตัวละคร ${names.length} ตัวถาวร?\n${preview}\n(เลเวล ไอเทม ทอง จะหายทั้งหมด)`)) { sendUsers({ cmd: 'del', names }); picked.clear(); }
      return;
    }
    e.preventDefault();                   // the row is a <label>: a click on its delete button must not tick the box
    const name = b.dataset.del;
    if (name && confirm(`ลบตัวละคร "${name}" ถาวร? (เลเวล ไอเทม ทอง จะหายทั้งหมด)`)) sendUsers({ cmd: 'del', name });
  });
  $('userSearch').addEventListener('input', renderUsers);
  $('userPanel').addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'userAll') {
      // select all = every row the search currently shows
      for (const c of shownRows()) { c.checked = t.checked; picked[t.checked ? 'add' : 'delete'](c.dataset.pick.toLowerCase()); }
    } else if (t.dataset.pick) picked[t.checked ? 'add' : 'delete'](t.dataset.pick.toLowerCase());
    else return;
    syncPicked();
  });

  // server replies to GM actions: a short log inside the panel + a toast, never the chat
  GM.msg = function (t) {
    const log = $('gmLog');
    const row = document.createElement('div');
    row.textContent = t;
    log.prepend(row);
    while (log.children.length > 8) log.lastChild.remove();
    HUD.toast(t.length > 90 ? t.slice(0, 90) + '…' : t);
  };
  GM.toggle = function (force) {
    if (!GM.enabled) return;
    const p = $('gmPanel');
    const open = force !== undefined ? force : p.classList.contains('hidden');
    p.classList.toggle('hidden', !open);
    if (open && G.stats) $('gmLvl').value = G.stats.lvl;
    if (open) sendUsers({ cmd: 'list' });     // names for the recipient field
  };
})();
