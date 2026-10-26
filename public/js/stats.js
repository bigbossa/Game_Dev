// Stat points (C): every level gives C.STAT_PTS points the player spends on attack / defence / HP / MP /
// attack speed / crit, or lets them flow into one stat (or the class build guide) automatically. The server owns
// the numbers. On top: a radar of the player's build against the class guide (C.STAT_GUIDES), with the real stats.
(function () {
  const STATS = { open: false, a: {}, auto: '', free: 0 };
  window.STATS = STATS;
  const $ = (id) => document.getElementById(id);
  const send = (d) => G.socket && G.socket.emit('stat', d);
  const fmt = (n) => Number(n).toLocaleString();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cls = () => (window.G && G.cls) || 'dualblade';

  // ---- radar: one axis per stat point (C.PT_KEYS). Radius = how far that stat is invested at this level:
  // a capped stat (ตีเร็ว / คริติคอล) against its cap, the others against half of all the level's points.
  // Filled shape = the player's points, dashed = the class guide. Labels carry the real stat (gear included).
  const LABEL = { atk: 'พลังโจมตี', def: 'ป้องกัน', hp: 'พลังชีวิต', mp: 'ปราณ', aspd: 'ตีเร็ว', crit: 'คริติคอล' };
  function realStat(k) {
    const s = (window.G && G.stats) || {};
    return { atk: fmt(s.atk || 0), def: fmt(s.def || 0), hp: fmt(s.mhp || 0), mp: fmt(s.mmp || 0), aspd: `+${s.aspd || 0}%`, crit: `${s.crit || 0}%` }[k];
  }
  function radar(lvl) {
    const tot = C.statPtsTotal(lvl), goal = C.guideTarget(cls(), lvl, STATS.lim);
    const axisMax = (k) => Math.max(1, C.STAT_POINTS[k].max ? Math.min(C.STAT_POINTS[k].max, tot) : tot * 0.5);
    const W = 300, H = 236, cx = W / 2, cy = 118, R = 78, n = C.PT_KEYS.length;
    const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
    const poly = (vals) => vals.map((f, i) => pt(i, Math.max(0.03, Math.min(1, f))).map((v) => v.toFixed(1)).join(',')).join(' ');
    let svg = `<svg class="st-radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟค่าสถานะ">`;
    for (const f of [0.25, 0.5, 0.75, 1]) svg += `<polygon class="rd-ring${f === 1 ? ' outer' : ''}" points="${poly(C.PT_KEYS.map(() => f))}"/>`;
    C.PT_KEYS.forEach((k, i) => { const [x, y] = pt(i, 1); svg += `<line class="rd-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    svg += `<polygon class="rd-goal" points="${poly(C.PT_KEYS.map((k) => goal[k] / axisMax(k)))}"/>`;
    const mine = C.PT_KEYS.map((k) => (STATS.a[k] || 0) / axisMax(k));
    svg += `<polygon class="rd-mine" points="${poly(mine)}"/>`;
    mine.forEach((f, i) => { const [x, y] = pt(i, Math.max(0.03, Math.min(1, f))); svg += `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`; });
    C.PT_KEYS.forEach((k, i) => {
      const [x, y] = pt(i, 1.2), anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
      const dy = y < cy - 40 ? -10 : y > cy + 40 ? 6 : -4;
      svg += `<text class="rd-name" x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}">${LABEL[k]}</text>` +
        `<text class="rd-val" x="${x.toFixed(1)}" y="${(y + dy + 13).toFixed(1)}" text-anchor="${anchor}">${realStat(k)}</text>`;
    });
    return svg + '</svg>';
  }
  function guideBox(lvl) {
    const g = C.statGuide(cls()), goal = C.guideTarget(cls(), lvl, STATS.lim);
    const order = C.PT_KEYS.filter((k) => g.share[k]).sort((a, b) => g.share[b] - g.share[a]);
    const canGuide = STATS.free > 0 && Object.keys(C.guidePoints(cls(), STATS.a, lvl, STATS.free, STATS.lim)).length > 0;
    const critFull = STATS.lim && STATS.lim.crit < C.STAT_POINTS.crit.max;
    return `<div class="st-guide"><div class="st-guide-h">แนวทางอัป${esc(C.CLASSES[cls()].name)}</div>` +
      `<div class="st-guide-order">${order.map((k) => `<span>${LABEL[k]} <b>${Math.round(g.share[k] * 100)}%</b></span>`).join('')}</div>` +
      `<div class="st-guide-tip">${esc(g.tip)}</div>` +
      (critFull ? `<div class="st-guide-note">อุปกรณ์ให้คริติคอลสูงแล้ว: คริติคอลรวมจำกัด ${Math.round(C.CRIT_CAP * 100)}% จึงลงแต้มคริได้คุ้มสูงสุด ${STATS.lim.crit} แต้ม ส่วนที่เหลือแนวทางย้ายไปค่าอื่นให้</div>` : '') +
      `<div class="st-legend"><span class="lg-mine"></span>แต้มของคุณ <span class="lg-goal"></span>แนวทาง · เป้าที่ Lv.${lvl}: ${order.map((k) => `${LABEL[k]} ${goal[k]}`).join(' · ')}</div>` +
      `<button type="button" class="st-guide-btn"${canGuide ? '' : ' disabled'}>แจกแต้มที่เหลือตามแนวทาง${STATS.free ? ` (${STATS.free} แต้ม)` : ''}</button></div>`;
  }

  function render() {
    const lvl = (G.stats && G.stats.lvl) || 1;
    const cost = lvl < 30 ? 0 : lvl * 100;
    const goal = C.guideTarget(cls(), lvl, STATS.lim);
    STATS.drawn = statKey();
    let html = `<div class="st-top">${radar(lvl)}${guideBox(lvl)}</div>` +
      `<div class="st-free">แต้มคงเหลือ <b>${STATS.free}</b> <small>(ได้ ${C.STAT_PTS} แต้มทุกเลเวล · รวม ${C.statPtsTotal(lvl)} แต้มที่ Lv.${lvl})</small></div>`;
    for (const k of C.PT_KEYS) {
      const d = C.STAT_POINTS[k], n = STATS.a[k] || 0, full = d.max && n >= d.max;
      const off = !STATS.free || full ? ' disabled' : '';
      html += `<div class="st-row">` +
        `<div class="st-name">${d.th}<small>${d.fmt(d.per)} / แต้ม${d.max ? ` · สูงสุด ${d.max}` : ''}${goal[k] ? ` · <span class="st-goal${n >= goal[k] ? ' ok' : ''}">แนวทาง ${goal[k]}</span>` : ''}</small></div>` +
        `<div class="st-val"><b>${n}</b><small>${n ? d.fmt(n * d.per) : '—'}</small></div>` +
        `<button type="button" data-k="${k}" data-n="1"${off}>+1</button>` +
        `<button type="button" data-k="${k}" data-n="5"${off}>+5</button>` +
        `<button type="button" data-k="${k}" data-n="1000"${off} title="ใส่แต้มที่เหลือทั้งหมด">MAX</button></div>`;
    }
    html += `<div class="st-auto"><label>อัปอัตโนมัติเมื่อเลเวลอัป <select id="stAuto"><option value="">ปิด (แจกแต้มเอง)</option>` +
      `<option value="${C.STAT_GUIDE_KEY}"${STATS.auto === C.STAT_GUIDE_KEY ? ' selected' : ''}>ตามแนวทางอาชีพ (แนะนำ)</option>` +
      C.PT_KEYS.map((k) => `<option value="${k}"${STATS.auto === k ? ' selected' : ''}>${C.STAT_POINTS[k].th}</option>`).join('') +
      `</select></label></div>` +
      `<div class="st-foot"><button type="button" class="st-reset">รีเซ็ตแต้ม${cost ? ` (${fmt(cost)} ทอง)` : ' (ฟรีก่อน Lv.30)'}</button></div>`;
    $('statPts').innerHTML = html;
  }
  // the real stats on the radar change with gear / level / buffs: redraw while the panel is open
  function statKey() { const s = (window.G && G.stats) || {}; return [s.lvl, s.atk, s.def, s.mhp, s.mmp, s.aspd, s.crit].join('|'); }
  setInterval(() => { if (STATS.open && statKey() !== STATS.drawn) render(); }, 500);

  STATS.set = function (d) {
    if (!d) return;
    STATS.a = d.a || {}; STATS.auto = d.auto || ''; STATS.free = d.free || 0; STATS.lim = d.lim || null;
    STATS.badge(STATS.free);
    if (STATS.open) render();
  };
  // the red dot on the button while points are waiting
  STATS.badge = function (free) {
    const b = $('statBtn');
    b.classList.toggle('has', free > 0);
    b.dataset.n = free > 0 ? free : '';
  };
  STATS.toggle = function (force) {
    const open = force !== undefined ? !!force : !STATS.open;
    if (open === STATS.open) return;
    STATS.open = open;
    if (open) render();
    $('statPanel').classList.toggle('hidden', !open);
  };

  $('statPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('close')) return STATS.toggle(false);
    if (b.classList.contains('st-reset')) {
      UI.confirm('คืนแต้มสถานะทั้งหมดเพื่อแจกใหม่', { title: 'รีเซ็ตแต้มสถานะ?', icon: '💪', ok: 'รีเซ็ตแต้ม' }).then((ok) => ok && send({ cmd: 'reset' }));
      return;
    }
    if (b.classList.contains('st-guide-btn')) return send({ cmd: 'guide' });
    if (b.dataset.k) send({ cmd: 'add', k: b.dataset.k, n: Number(b.dataset.n) });
  });
  $('statPanel').addEventListener('change', (e) => {
    if (e.target.id === 'stAuto') { send({ cmd: 'auto', k: e.target.value }); e.target.blur(); }
  });
  $('statBtn').addEventListener('click', () => STATS.toggle());
})();
