// Leaderboard (🏆 button / R): tabs level · PvP kills · factions. The server rebuilds it at most once a minute
// (server 'rank' → { board, list, me, total, faction, score, next }); the player's own place stays at the bottom.
(function () {
  const RANK = { open: false, board: 'level', data: null };
  window.RANK = RANK;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => Math.round(n).toLocaleString('th-TH');
  const send = () => G.socket && G.socket.emit('rank', { board: RANK.board });
  const TABS = [['level', 'เลเวล'], ['pvp', 'สังหาร PvP'], ['faction', 'ฝ่าย']];
  const MEDAL = ['🥇', '🥈', '🥉'];
  let timer = null;

  RANK.toggle = function (force) {
    const open = force !== undefined ? !!force : !RANK.open;
    if (open === RANK.open) return;
    RANK.open = open;
    $('rankPanel').classList.toggle('hidden', !open);
    clearInterval(timer);
    if (!open) return;
    send();
    timer = setInterval(send, 30000);
    render();
  };
  RANK.set = (d) => { if (d && d.board === RANK.board) { RANK.data = d; render(); } };

  const clsName = (cls) => (C.CLASSES[cls] || C.CLASSES.dualblade).name;
  const portrait = (cls, f) => { if(cls==='boxer')return BoxerLook.portrait(f);const sheet = (C.CLASSES[cls] || {}).sheet; return `assets/${sheet ? sheet + '-' : ''}${f}-portrait.png`; };
  const value = (r) => (RANK.board === 'pvp' ? `<b>${fmt(r.pvp)}</b> <small>คิล</small>` : `<b>Lv.${r.lvl}</b>`);
  function row(r, place, me) {
    return `<div class="rank-row${me ? ' me' : ''}">
        <span class="rank-no">${place ? MEDAL[place - 1] || place : '–'}</span>
        <img src="${portrait(r.cls, r.f)}" alt="">
        <span class="rank-name" style="color:${C.FACTIONS[r.f].color}">${esc(r.n)}${me ? ' <small>(คุณ)</small>' : ''}</span>
        <span class="rank-cls">${esc(clsName(r.cls))}</span>
        <span class="rank-val">${value(r)}</span>
      </div>`;
  }
  function renderList(d) {
    const name = G.me && G.me.name, me = d.me;
    const rows = d.list.map((r, i) => row(r, i + 1, r.n === name)).join('');
    let mine = '';
    if (me && (!me.rank || me.rank > d.list.length))
      mine = row(me, me.rank, true) + (me.rank ? '' : `<div class="rank-mine-note">${RANK.board === 'pvp' ? 'ยังไม่มีคิลที่นับในอันดับ' : 'ยังไม่อยู่ในอันดับ'}</div>`);
    return `<div class="rank-list">${rows || '<div class="who-empty">ยังไม่มีข้อมูล</div>'}</div>
      ${mine ? `<div class="rank-mine">${mine}</div>` : ''}
      <p class="who-hint">${fmt(d.total)} ตัวละคร · ${RANK.board === 'pvp'
        ? 'นับเฉพาะคิลผู้เล่นที่เลเวลต่ำกว่าไม่เกิน 20 และคนเดิมนับได้ 1 ครั้งทุก 10 นาที'
        : 'เรียงตามเลเวล แล้ว EXP'}</p>`;
  }
  function renderFaction(d) {
    const card = (f) => {
      const x = d.faction[f], F = C.FACTIONS[f];
      return `<div class="rank-fac" style="border-color:${F.color}">
          <b style="color:${F.color}">ฝ่าย${esc(F.name)}</b><small>${esc(F.title)}</small>
          <div class="rank-fac-score">${fmt(d.score[f] || 0)}<small>คะแนนสนามรบตอนนี้</small></div>
          <ul><li>ตัวละคร <b>${fmt(x.chars)}</b></li><li>คิล PvP รวม <b>${fmt(x.pvp)}</b></li>
            <li>Lv.100 ขึ้นไป <b>${fmt(x.lvl100)}</b></li><li>อันดับ 1 <b>${esc(x.top || '–')}</b></li></ul>
        </div>`;
    };
    return `<div class="rank-facs">${card('dharma')}${card('adharma')}</div>
      <p class="who-hint">คะแนนสนามรบ: สังหารศัตรู +1 · ปราบราชันมารโลหิต +10 (เริ่มนับใหม่เมื่อเซิร์ฟเวอร์รีสตาร์ท)</p>`;
  }
  function render() {
    if (!RANK.open) return;
    const d = RANK.data && RANK.data.board === RANK.board ? RANK.data : null;
    $('rankTabs').innerHTML = TABS.map(([id, n]) => `<button type="button" data-board="${id}" class="${id === RANK.board ? 'on' : ''}">${n}</button>`).join('');
    $('rankBody').innerHTML = !d ? '<div class="who-empty">กำลังโหลด…</div>'
      : (RANK.board === 'faction' ? renderFaction(d) : renderList(d))
        + `<p class="who-hint">อัปเดตทุก 1 นาที · ล่าสุด ${new Date(d.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ปุ่มลัด R</p>`;
  }

  const panel = $('rankPanel');
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.close')) return RANK.toggle(false);
    const tab = e.target.closest('[data-board]');
    if (tab && tab.dataset.board !== RANK.board) { RANK.board = tab.dataset.board; send(); render(); }
  });
  $('rankBtn').addEventListener('click', () => RANK.toggle());
})();
