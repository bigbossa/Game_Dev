// Touch screens: the HUD's round buttons go into one ☰ menu, a grid of icons with Thai labels (a finger has no
// hover tooltip), instead of a long row / column of bare icons. The most used ones stay on screen beside the
// minimap: 💬 แชท · 🎒 กระเป๋า · 🤖 บอท · ☰ เมนู (style.css "touch HUD").
// The real buttons are moved into the grid, not copied, so their own click handlers and state classes (bot on,
// PvP on, unspent points, fund %) keep working. A mouse screen keeps the old layout and never sees the menu.
(function () {
  const $ = (id) => document.getElementById(id);
  const menu = $('menuPanel'), grid = $('menuGrid'), btn = $('menuBtn');
  if (!document.body.classList.contains('touch')) { menu.remove(); btn.remove(); return; }

  // menu entries in order; ids that are not HUD buttons yet get a small proxy button
  const PROXY = {
    mapBtn: ['🗺', 'แผนที่', () => WMAP.toggle(true)],
    charBtn: ['⇄', 'เปลี่ยนตัวละคร', () => $('switchCharBtn').click()],
  };
  const ITEMS = ['bookBtn', 'statBtn', 'mapBtn', 'whoBtn', 'pkBtn', 'rankBtn', 'fundBtn', 'helpBtn', 'fsBtn', 'charBtn'];
  for (const id of ITEMS) {
    let b = $(id);
    if (!b) {
      const [icon, label, fn] = PROXY[id];
      b = document.createElement('button');
      Object.assign(b, { id, type: 'button', textContent: icon, title: label });
      b.dataset.label = label;
      b.addEventListener('click', fn);
    }
    grid.appendChild(b);
  }

  const shown = () => !menu.classList.contains('hidden');
  function toggle(open = !shown()) {
    menu.classList.toggle('hidden', !open);
    btn.classList.toggle('on', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  btn.addEventListener('click', () => toggle());
  menu.querySelector('.close').addEventListener('click', () => toggle(false));
  // an entry was used: its own handler has run (bubbling reaches the grid after it), close the menu
  grid.addEventListener('click', (e) => { if (e.target.closest('button')) toggle(false); });

  // ☰ shows the unspent stat + skill points that statBtn / bookBtn carry (stats.js, skillbook.js: .has + data-n)
  const dots = ['statBtn', 'bookBtn'].map($);
  const sync = () => {
    const n = dots.reduce((s, b) => s + (b.classList.contains('has') ? +b.dataset.n || 1 : 0), 0);
    btn.classList.toggle('has', n > 0);
    btn.dataset.n = n > 99 ? '99+' : n;
  };
  for (const b of dots) new MutationObserver(sync).observe(b, { attributes: true, attributeFilter: ['class', 'data-n'] });
  sync();

  window.TMENU = { toggle };
})();
