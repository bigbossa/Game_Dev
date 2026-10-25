// แพทช์โน้ต (📢): what each update changed and when, from public/patch-notes.json (newest first).
// Opened from the login screen, the 📢 button in game, or the ☰ menu on touch screens. Times are shown in Thai time
// whatever the player's own clock is set to; an update older than the timed history may give only its day
// ("date": "2026-10-22"), shown without a time and kept in the file's order within that day. The browser remembers the newest update it has shown
// (localStorage 'patchSeen'): newer ones get a "ใหม่" tag and a red dot on the buttons, and a returning player
// sees the window once on the login screen after an update.
(function () {
  const $ = (id) => document.getElementById(id);
  const panel = $('patchPanel'), list = $('patchList'), link = $('patchLink'), btn = $('newsBtn');
  const SEEN = 'patchSeen';
  const KIND = {
    new: ['✨', 'ใหม่'], improve: ['⚡', 'ปรับปรุง'], balance: ['⚖', 'ปรับสมดุล'], fix: ['🔧', 'แก้ไข'],
  };
  const TZ = { timeZone: 'Asia/Bangkok' };
  const dayOf = (d) => d.toLocaleDateString('th-TH', { ...TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const timeOf = (d) => d.toLocaleTimeString('th-TH', { ...TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const weekdayOf = (d) => d.toLocaleDateString('th-TH', { ...TZ, weekday: 'long' });
  function ago(d) {
    const m = Math.round((Date.now() - d) / 60000);
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
    const days = Math.round(h / 24);
    return days < 30 ? `${days} วันที่แล้ว` : dayOf(d);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let notes = [], seen = null;
  try { seen = localStorage.getItem(SEEN); } catch (e) { /* storage optional */ }
  // updates newer than the last one shown here (all of them on a first visit: nothing is marked new then)
  const unseen = () => {
    if (!seen) return 0;
    const i = notes.findIndex((n) => n.id === seen);
    return i < 0 ? notes.length : i;
  };

  const when = (n) => new Date(n.dayOnly ? `${n.date}T12:00:00+07:00` : n.date);
  function render() {
    const fresh = unseen();
    $('patchCount').textContent = `ทั้งหมด ${notes.length} ครั้ง`;
    list.innerHTML = notes.map((n, i) => {
      const d = when(n);
      const head = `<span class="pn-when"><b>${dayOf(d)}</b><small>${weekdayOf(d)}${n.dayOnly ? '' : ` · ${timeOf(d)} น.`}</small></span>
        <span class="pn-title">${i < fresh ? '<i class="pn-new">ใหม่</i>' : ''}${esc(n.title)}<small>${esc(n.summary || '')}</small></span>`;
      const body = (n.sections || []).map((s) => {
        const [icon, label] = KIND[s.kind] || ['•', s.kind];
        return `<div class="pn-sec ${esc(s.kind)}"><h5>${icon} ${label}</h5><ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
      }).join('');
      // the newest one and every unread one start open
      return `<details class="pn-note"${i === 0 || i < fresh ? ' open' : ''}><summary>${head}<span class="pn-ago">${n.dayOnly ? '' : ago(d)}</span></summary><div class="pn-body">${body}</div></details>`;
    }).join('') || '<p class="pn-empty">ยังไม่มีแพทช์โน้ต</p>';
  }
  // the red dots and the "อัปเดตล่าสุด ..." line on the login screen
  function badges() {
    const n = unseen(), last = notes[0];
    for (const b of [link, btn]) if (b) { b.classList.toggle('has', n > 0); b.dataset.n = n > 0 ? n : ''; }
    if (last) $('patchWhen').textContent = `อัปเดตล่าสุด ${dayOf(when(last))}${last.dayOnly ? '' : ` · ${timeOf(when(last))} น.`}`;
  }
  function markSeen() {
    if (!notes.length) return;
    seen = notes[0].id;
    try { localStorage.setItem(SEEN, seen); } catch (e) { /* storage optional */ }
    badges();
  }

  const NOTES = (window.NOTES = { open: false });
  NOTES.toggle = function (force) {
    NOTES.open = force !== undefined ? !!force : !NOTES.open;
    if (NOTES.open) { render(); list.scrollTop = 0; markSeen(); }     // drawn first: the "ใหม่" tags show this once
    panel.classList.toggle('hidden', !NOTES.open);
  };
  panel.querySelector('.close').addEventListener('click', () => NOTES.toggle(false));
  link.addEventListener('click', () => NOTES.toggle(true));
  // เปิดทั้งหมด / พับทั้งหมด: older updates start folded
  $('patchAll').addEventListener('click', () => {
    const all = [...list.querySelectorAll('details')], open = !all.every((d) => d.open);
    all.forEach((d) => { d.open = open; });
    $('patchAll').textContent = open ? 'พับทั้งหมด' : 'เปิดทั้งหมด';
  });
  list.addEventListener('toggle', () => { $('patchAll').textContent = [...list.querySelectorAll('details')].every((d) => d.open) ? 'พับทั้งหมด' : 'เปิดทั้งหมด'; }, true);
  if (btn) btn.addEventListener('click', () => NOTES.toggle());

  fetch('patch-notes.json', { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
    notes = (d.notes || []).filter((n) => n.id && n.date);
    for (const n of notes) n.dayOnly = !n.date.includes('T');
    notes.sort((a, b) => when(b) - when(a));                           // stable: same-day entries keep the file's order
    // first visit: remember the newest without marking everything as new
    if (!seen && notes.length) { seen = notes[0].id; try { localStorage.setItem(SEEN, seen); } catch (e) { /* storage optional */ } }
    badges();
    link.classList.remove('hidden');
    // a returning player after an update: show it once, when the loading screen has made way for the login
    if (unseen() > 0) {
      const loading = $('loading');
      const show = () => { if (!$('login').classList.contains('hidden')) setTimeout(() => NOTES.toggle(true), 500); };
      if (loading.classList.contains('hidden')) show();
      else new MutationObserver((m, ob) => { if (loading.classList.contains('hidden')) { ob.disconnect(); show(); } }).observe(loading, { attributes: true, attributeFilter: ['class'] });
    }
  }).catch(() => { /* no notes: the link stays hidden */ });
})();
