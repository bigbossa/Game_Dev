// Popup windows (.panel: bag, shop, skill book, stats, bot, map, players, warp, GM ... and the help box):
// - drag the title bar (mouse or finger) to move the window; the spot is remembered in this browser per window
//   (localStorage 'panelPos'), double-click the title bar = back to its normal place
// - clicking a window brings it to the front
// - a window never runs off the screen: it is kept inside the window and capped to the room below its top edge,
//   so long content scrolls inside it (style.css: .panel overflow-y) instead of being cut off
// - long tooltips (#tooltip, .who-tip) stay on screen and scroll with the mouse wheel
// - upright phone: every window is a sheet along the bottom (style.css "bottom sheets"), one at a time (a shop /
//   the storage keep the bag beside them); swipe the title bar down to close it instead of dragging it around
(function () {
  const KEY = 'panelPos', M = 6, Z0 = 21, MIN_H = 160;   // MIN_H: a moved window always shows at least this much
  const SHEET_MQ = matchMedia('(orientation: portrait) and (max-width: 600px)');
  const sheet = () => SHEET_MQ.matches && document.body.classList.contains('touch');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { saved = {}; }
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private mode */ } };
  const shown = (p) => p.isConnected && !p.classList.contains('hidden') && p.offsetParent !== null;
  const handleOf = (p) => (p.id === 'help' ? p.querySelector('h3') : p.querySelector(':scope > .panel-head'));

  // ---- front / back: the last window touched sits on top (z 21..)
  const order = [];
  function toFront(p) {
    const i = order.indexOf(p);
    if (i >= 0) order.splice(i, 1);
    order.push(p);
    order.forEach((q, n) => { q.style.zIndex = Z0 + n; });
  }

  // ---- height cap: whatever room is left between the window's top and the bottom of the screen — on a computer,
  // the top of the skill bar where the window is over it, so the bar's buttons stay in sight and clickable
  function floorOf(p) {
    const bar = document.getElementById('skillbar');
    if (document.body.classList.contains('touch') || !bar || bar.offsetParent === null) return innerHeight - M;
    const b = bar.getBoundingClientRect(), r = p.getBoundingClientRect();
    return r.right > b.left && r.left < b.right && b.top > innerHeight / 2 ? b.top - M : innerHeight - M;
  }
  function fit(p) {
    if (!shown(p)) return;
    p.style.maxHeight = '';
    const cs = getComputedStyle(p), css = parseFloat(cs.maxHeight) || Infinity;
    let room;
    if (p.dataset.moved) room = floorOf(p) - p.getBoundingClientRect().top;
    else if (cs.top === 'auto' || /matrix\([^)]*,\s*-?[1-9][\d.]*\)$/.test(cs.transform)) return;   // bottom-anchored / centred: own CSS cap
    else room = floorOf(p) - Math.max(M, p.getBoundingClientRect().top);
    room = Math.max(60, Math.floor(room));
    if (room < css) p.style.maxHeight = room + 'px';
  }
  // ---- explicit position (after a drag or from the saved spot), clamped so the title bar stays reachable
  function place(p, x, y) {
    const w = p.offsetWidth, low = Math.min(p.scrollHeight, MIN_H);
    x = Math.max(M, Math.min(innerWidth - w - M, x));
    y = Math.max(M, Math.min(innerHeight - low - M, y));
    Object.assign(p.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, right: 'auto', bottom: 'auto', transform: 'none', margin: '0' });
    p.dataset.moved = '1';
    fit(p);
  }
  function reset(p) {
    for (const k of ['left', 'top', 'right', 'bottom', 'transform', 'margin', 'maxHeight']) p.style[k] = '';
    delete p.dataset.moved;
    delete saved[p.id]; store();
    fit(p);
  }
  // on show / window resize: saved spot (clamped to the current screen), then the height cap
  function settle(p) {
    if (!shown(p)) return;
    if (sheet()) { for (const k of ['left', 'top', 'right', 'bottom', 'transform', 'margin', 'maxHeight']) p.style[k] = ''; delete p.dataset.moved; return; }
    const s = p.id && saved[p.id];
    if (s) place(p, s[0], s[1]); else fit(p);
  }

  // a shop / the storage open together with the bag: on an upright phone they share the screen, shop on top and
  // bag below (style.css body.panel-split), so items can be tapped to sell / store while the shop stays in sight
  const SPLIT = ['shopPanel', 'enhPanel', 'potionPanel', 'storagePanel'];
  function syncSplit() {
    const open = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden'); };
    document.body.classList.toggle('panel-split', open('invPanel') && SPLIT.some(open));
  }
  // sheets: a window that opens closes the other ones through their own ✕ (so each module tidies its state),
  // except the bag next to a shop / the storage
  const pair = (a, b) => (a === 'invPanel' && SPLIT.includes(b)) || (b === 'invPanel' && SPLIT.includes(a));
  function closeOthers(p) {
    if (!sheet() || !p.id || p.id === 'itemMenu') return;
    for (const q of document.querySelectorAll('.panel, #help')) {
      if (q === p || !q.id || q.id === 'itemMenu' || !shown(q) || pair(p.id, q.id)) continue;
      const x = q.id === 'help' ? q.querySelector('.help-close') : q.querySelector(':scope > .panel-head .close');
      if (x) x.click(); else q.classList.add('hidden');
    }
  }
  function hook(p) {
    if (p._panelHooked) return;
    p._panelHooked = true;
    // windows with a title bar take part in the front/back order; menus without one (#itemMenu) keep their CSS z-index
    const head = handleOf(p), win = !!(head && p.id);
    if (win) p.addEventListener('pointerdown', () => toFront(p), true);
    let wasShown = shown(p);
    new MutationObserver(() => {
      syncSplit();
      const now = shown(p);
      if (now && !wasShown) closeOthers(p);
      wasShown = now;
      if (now) { if (win) toFront(p); settle(p); }
    }).observe(p, { attributes: true, attributeFilter: ['class'] });
    if (win) {
      head.classList.add('drag-handle');
      head.title = head.title || 'ลากเพื่อย้ายหน้าต่าง · ดับเบิลคลิก = กลับตำแหน่งเดิม';
      let drag = null;
      head.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button, input, select, a, label')) return;
        const r = p.getBoundingClientRect();
        drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, y0: e.clientY, swipe: sheet() };
        head.setPointerCapture(e.pointerId);
        if (!drag.swipe) p.classList.add('dragging');
        e.preventDefault();
      });
      head.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.swipe) p.style.translate = `0 ${Math.max(0, e.clientY - drag.y0)}px`;
        else place(p, e.clientX - drag.dx, e.clientY - drag.dy);
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        if (d.swipe) {
          p.style.translate = '';
          const x = p.id === 'help' ? p.querySelector('.help-close') : head.querySelector('.close');
          if (e.type === 'pointerup' && e.clientY - d.y0 > 70 && x) x.click();
          return;
        }
        p.classList.remove('dragging');
        if (p.dataset.moved) { saved[p.id] = [parseInt(p.style.left, 10), parseInt(p.style.top, 10)]; store(); }
      };
      head.addEventListener('pointerup', end);
      head.addEventListener('pointercancel', end);
      head.addEventListener('dblclick', (e) => { if (!sheet() && !e.target.closest('button')) reset(p); });
    }
    if (shown(p)) settle(p);
  }
  const scan = () => document.querySelectorAll('.panel, #help').forEach(hook);
  scan();
  // panels made later (the item menu on touch screens)
  const hud = document.getElementById('hud');
  if (hud) new MutationObserver(scan).observe(hud, { childList: true });
  addEventListener('resize', () => document.querySelectorAll('.panel, #help').forEach(settle));

  // ---- tooltips follow the mouse and cannot take clicks, so the wheel scrolls a long one while it is open
  addEventListener('wheel', (e) => {
    for (const t of document.querySelectorAll('#tooltip, .who-tip')) {
      // (position: fixed elements have no offsetParent, so check the box itself)
      if (t.style.display === 'none' || !t.isConnected || !t.clientHeight || t.scrollHeight <= t.clientHeight + 1) continue;
      t.scrollTop += e.deltaY;
      e.preventDefault(); e.stopPropagation();
      return;
    }
  }, { capture: true, passive: false });
  // a new tooltip starts at its top
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) if (n.id === 'tooltip' || (n.classList && n.classList.contains('who-tip'))) watchTip(n);
  }).observe(document.body, { childList: true });
  function watchTip(t) {
    if (t._tipHooked) return;
    t._tipHooked = true;
    const check = () => { t.scrollTop = 0; t.classList.toggle('tip-more', t.scrollHeight > t.clientHeight + 1); };
    new MutationObserver(check).observe(t, { childList: true });
    check();   // the first text is set in the same step that adds the tooltip
  }
  document.querySelectorAll('#tooltip, .who-tip').forEach(watchTip);

  window.PANELS = { fit, reset, settle, toFront };
})();
