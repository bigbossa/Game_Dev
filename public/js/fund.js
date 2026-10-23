// ระดมทุน (🏮 button / G): everyone puts bag gold into one pot; when it reaches C.FUND.goal the whole server gets
// EXP ×2 · drops ×2 for an hour, then the next round starts (server onFund → 'fund' { total, goal, round, left, top, last, mine }).
// The boost chip at the top of the screen counts the time left down by itself.
(function () {
  const FUND = { open: false, data: null, end: 0 };
  window.FUND = FUND;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => Math.round(n).toLocaleString('th-TH');
  const emit = (d) => G.socket && G.socket.emit('fund', d);
  const MEDAL = ['🥇', '🥈', '🥉'];
  const QUICK = [10000, 100000, 1000000];
  const clock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(x).padStart(2, '0')}`;
  };
  const bag = () => (window.INV && INV.state.gold) || 0;

  FUND.toggle = function (force) {
    const open = force !== undefined ? !!force : !FUND.open;
    if (open === FUND.open) return;
    FUND.open = open;
    $('fundPanel').classList.toggle('hidden', !open);
    if (open) { emit({ cmd: 'open' }); render(); }
  };
  FUND.set = function (d) {
    if (!d) return;
    FUND.data = d;
    FUND.end = d.left ? Date.now() + d.left : 0;
    chip();
    render();
  };

  FUND.render = () => render();                              // bag gold changed (inventory.js)
  // the button's badge (% of this round) and the boost chip (time left)
  function chip() {
    const d = FUND.data, on = FUND.end > Date.now();
    const c = $('fundBuff');
    c.classList.toggle('hidden', !on);
    if (on) c.innerHTML = `🔥 EXP ×${C.FUND.exp} · ดรอป ×${C.FUND.drop} <b>${clock(FUND.end - Date.now())}</b>`;
    const b = $('fundBtn');
    b.classList.toggle('on', on);
    b.dataset.pct = d ? `${Math.floor(d.total / d.goal * 100)}%` : '';
    b.title = `ระดมทุน (G)${d ? ` · รอบที่ ${d.round} ได้แล้ว ${fmt(d.total)} / ${fmt(d.goal)} ทอง` : ''}${on ? ` · บัพเหลือ ${clock(FUND.end - Date.now())}` : ''}`;
    const t = $('fundLeft');
    if (t) t.textContent = on ? clock(FUND.end - Date.now()) : '';
  }
  setInterval(() => { if (FUND.end) { chip(); if (FUND.end <= Date.now()) { FUND.end = 0; render(); } } }, 1000);

  const donors = (list, empty) => (list && list.length
    ? `<ol class="fund-top">${list.map((x, i) => `<li><span>${MEDAL[i] || i + 1}</span><b>${esc(x.n)}</b><em>${fmt(x.g)}</em></li>`).join('')}</ol>`
    : `<div class="who-empty">${empty}</div>`);
  function render() {
    if (!FUND.open) return;
    const d = FUND.data;
    if (!d) { $('fundBody').innerHTML = '<div class="who-empty">กำลังโหลด…</div>'; return; }
    const pct = Math.min(100, d.total / d.goal * 100), on = FUND.end > Date.now(), mins = Math.round(C.FUND.ms / 60000);
    // redrawn on every gift / loot: keep the amount being typed
    const was = $('fundAmt'), typed = was ? was.value : '', focused = !!was && document.activeElement === was;
    $('fundBody').innerHTML = `
      <div class="fund-status${on ? ' on' : ''}">${on
        ? `🔥 บัพทั้งเซิร์ฟทำงานอยู่: <b>EXP ×${C.FUND.exp}</b> · <b>ดรอป ×${C.FUND.drop}</b> · เหลือ <b id="fundLeft">${clock(FUND.end - Date.now())}</b>`
        : `ระดมครบ ${fmt(d.goal)} ทอง = ทั้งเซิร์ฟได้ <b>EXP ×${C.FUND.exp}</b> · <b>ดรอป ×${C.FUND.drop}</b> นาน ${mins} นาที`}</div>
      <div class="fund-round">รอบที่ ${fmt(d.round)}</div>
      <div class="fund-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${d.goal}" aria-valuenow="${d.total}"><i style="width:${pct}%"></i><span>${pct < 10 ? (Math.floor(pct * 10) / 10).toFixed(1) : Math.floor(pct)}%</span></div>
      <div class="fund-nums"><b>${fmt(d.total)}</b> / ${fmt(d.goal)} ทอง · ขาดอีก ${fmt(d.goal - d.total)}</div>
      <div class="fund-give">
        <input id="fundAmt" type="number" inputmode="numeric" min="${C.FUND.min}" step="1000" placeholder="จำนวนทอง (ขั้นต่ำ ${fmt(C.FUND.min)})">
        <button type="button" class="bag-btn" data-give="1">🏮 ร่วมทุน</button>
      </div>
      <div class="fund-quick">${QUICK.map((n) => `<button type="button" class="bag-btn ghost" data-add="${n}">+${fmt(n)}</button>`).join('')}
        <button type="button" class="bag-btn ghost" data-add="all">ทั้งหมด</button></div>
      <p class="who-hint">ทองในกระเป๋า ${fmt(bag())} · คุณร่วมรอบนี้แล้ว ${fmt(d.mine)} ทอง · ร่วม ${fmt(C.FUND.shout)} ขึ้นไปประกาศทั้งเซิร์ฟ</p>
      <h4 class="fund-h">ผู้ร่วมทุนสูงสุดรอบนี้</h4>${donors(d.top, 'ยังไม่มีผู้ร่วมทุน — เป็นคนแรกเลย!')}
      ${d.last && d.last.length ? `<h4 class="fund-h">ขอบคุณผู้ร่วมทุนรอบที่แล้ว</h4>${donors(d.last, '')}` : ''}
      <p class="who-hint">EXP ×${C.FUND.exp} จากมอนสเตอร์และบอส · โอกาสดรอปไอเทม ×${C.FUND.drop} (บอสดรอปไอเทม 2 ชิ้น) · ระหว่างบัพระดมครบอีกรอบ = ต่อเวลาเพิ่ม ${mins} นาที · ทองที่เกินยกไปรอบถัดไป · ปุ่มลัด G</p>`;
    const amt = $('fundAmt');
    amt.value = typed;
    if (focused) amt.focus();
  }

  const panel = $('fundPanel');
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.close')) return FUND.toggle(false);
    const amt = $('fundAmt');
    const add = e.target.closest('[data-add]');
    if (add && amt) {
      const v = add.dataset.add === 'all' ? bag() : Math.min(bag(), (Math.floor(Number(amt.value)) || 0) + Number(add.dataset.add));
      amt.value = v > 0 ? String(v) : '';
      return amt.focus();
    }
    if (!e.target.closest('[data-give]') || !amt) return;
    const gold = Math.floor(Number(amt.value));
    if (!(gold >= C.FUND.min)) return HUD.toast(`ใส่ทองอย่างน้อย ${fmt(C.FUND.min)}`);
    if (gold > bag()) return HUD.toast('ทองในกระเป๋าไม่พอ');
    if (!confirm(`ร่วมระดมทุน ${fmt(gold)} ทอง?\nทองที่ร่วมแล้วขอคืนไม่ได้`)) return;
    emit({ cmd: 'give', gold });
    amt.value = '';
  });
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation();                                     // typing the amount is not a hotkey
    if (e.key === 'Enter') panel.querySelector('[data-give]').click();
    if (e.key === 'Escape') FUND.toggle(false);
  });
  $('fundBtn').addEventListener('click', () => FUND.toggle());
  $('fundBuff').addEventListener('click', () => FUND.toggle(true));
})();
