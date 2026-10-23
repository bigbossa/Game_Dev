// World map (M / click the minimap): the whole current map with every monster area, its level and the boss lair.
// Click a label, a row of the list or any spot of the map = walk there (G.travelTo).
(function () {
  const WMAP = { open: false };
  window.WMAP = WMAP;
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const T = C.TILE;
  let spots = [], timer = null, scale = 1;

  // monster types of the map in level order, each with the centres of its areas (hunting maps have 2 per type)
  function groups(def) {
    const by = new Map();
    for (const z of def.zones || []) {
      const m = C.MONSTERS[z.type];
      if (!m) continue;
      const cx = z.cx ?? (z.x0 + z.x1) / 2, cy = z.cy ?? (z.y0 + z.y1) / 2;
      if (!by.has(z.type)) by.set(z.type, { type: z.type, m, pts: [] });
      by.get(z.type).pts.push({ x: (cx + 0.5) * T, y: (cy + 0.5) * T });
    }
    return [...by.values()].sort((a, b) => !!a.m.boss - !!b.m.boss || a.m.lvl - b.m.lvl);
  }
  // grey = too low (EXP cut), green = fair, orange = a few levels above, red = dangerous
  function lvlColor(mlvl) {
    const me = (G.stats && G.stats.lvl) || 1, d = mlvl - me;
    if (C.expPenalty(me, mlvl) < 1) return '#9a968c';
    return d >= 8 ? '#ff5a4a' : d >= 3 ? '#ffb84a' : '#7cff8a';
  }
  const campPos = () => C.spawnOf(G.mapDef, G.me.faction);
  function nearest(pts) {
    const me = G.me;
    return pts.reduce((b, p) => (Math.hypot(p.x - me.x, p.y - me.y) < Math.hypot(b.x - me.x, b.y - me.y) ? p : b));
  }

  function size() {
    const map = G.map, cv = $('wmCanvas');
    let w = Math.min(680, window.innerWidth - 48);
    let h = (w * map.h) / map.w;
    const maxH = window.innerHeight * (G.touch ? 0.62 : 0.56);
    if (h > maxH) { h = maxH; w = (h * map.w) / map.h; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = `${Math.round(w)}px`; cv.style.height = `${Math.round(h)}px`;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    scale = (w * dpr) / (map.w * T);
    return dpr;
  }

  function draw() {
    if (!WMAP.open || !G.map || !G.me) return;
    const cv = $('wmCanvas'), g = cv.getContext('2d'), dpr = cv.width / parseFloat(cv.style.width);
    const sx = (x) => x * scale, sy = (y) => y * scale;
    g.imageSmoothingEnabled = false;
    g.drawImage(G.minimapBase, 0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, cv.width, cv.height);
    spots = [];
    const def = G.mapDef, me = G.me, fs = Math.round(11 * dpr);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    // a clickable pill with text
    const pill = (x, y, text, col, bg, target, bold) => {
      g.font = `${bold ? 'bold ' : ''}${fs}px sans-serif`;
      const w = g.measureText(text).width + 10 * dpr, h = fs + 7 * dpr;
      const px = Math.max(2, Math.min(cv.width - w - 2, sx(x) - w / 2)), py = Math.max(2, Math.min(cv.height - h - 2, sy(y) - h / 2));
      g.fillStyle = bg; g.strokeStyle = col; g.lineWidth = dpr;
      g.beginPath(); g.roundRect ? g.roundRect(px, py, w, h, h / 2) : g.rect(px, py, w, h); g.fill(); g.stroke();
      g.fillStyle = col; g.fillText(text, px + w / 2, py + h / 2 + 0.5);
      if (target) spots.push({ x0: px, y0: py, x1: px + w, y1: py + h, ...target });
    };
    // live monsters in sight
    for (const e of G.ents.values()) {
      if (e.kind !== 'm' || e.dead || e.dying) continue;
      g.fillStyle = e.boss ? '#ff3a2a' : e.aggro ? '#ffb040' : 'rgba(255,240,200,0.85)';
      g.beginPath(); g.arc(sx(e.x), sy(e.y), (e.boss ? 3.2 : 1.8) * dpr, 0, TAU); g.fill();
    }
    // camp + gates
    const camp = campPos();
    pill(camp.x, camp.y, def.pvp ? '⛺ ฐานของคุณ' : '⛺ ค่ายพัก', '#ffe7a8', 'rgba(40,30,10,0.85)', { x: camp.x, y: camp.y, label: def.pvp ? 'ฐาน' : 'ค่ายพัก' }, true);
    for (const gt of def.gates || []) {
      const to = C.MAPS[gt.to];
      pill(gt.x, gt.y, `${gt.back ? '⇦' : '⇨'} ${to.name}`, '#a8d8ff', 'rgba(10,24,40,0.85)', { x: gt.x, y: gt.y, label: `ประตูไป${to.name}`, gate: true });
    }
    // monster areas: name + level, coloured by how the level suits the character
    for (const gr of groups(def)) {
      const col = gr.m.boss ? '#ff6a4a' : lvlColor(gr.m.lvl);
      for (const p of gr.pts) {
        if (!gr.m.boss) { g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = dpr; g.beginPath(); g.arc(sx(p.x), sy(p.y), 6 * T * scale, 0, TAU); g.stroke(); g.globalAlpha = 1; }
        pill(p.x, p.y, `${gr.m.boss ? '☠ ' : ''}${gr.m.name} Lv.${gr.m.lvl}`, col, 'rgba(10,10,14,0.82)', { x: p.x, y: p.y, label: gr.m.name }, gr.m.boss);
      }
    }
    // party members on this map
    const mm = (HUD.mm && HUD.mm.a) || [];
    for (const [id, x, y] of mm) {
      if (id === me.id || !PARTY.ids.has(id)) continue;
      g.fillStyle = '#5ab8ff'; g.strokeStyle = '#fff'; g.lineWidth = dpr;
      g.beginPath(); g.arc(sx(x), sy(y), 3.5 * dpr, 0, TAU); g.fill(); g.stroke();
    }
    // where we are walking to
    const o = G.order;
    if (o && o.type === 'travel') {
      g.strokeStyle = '#7cff8a'; g.setLineDash([4 * dpr, 4 * dpr]); g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.moveTo(sx(me.x), sy(me.y)); for (const [x, y] of o.path || []) g.lineTo(sx(x), sy(y)); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#7cff8a'; g.beginPath(); g.arc(sx(o.gx), sy(o.gy), 4 * dpr, 0, TAU); g.fill();
    }
    // me
    g.save(); g.translate(sx(me.x), sy(me.y)); g.rotate((me.dir * Math.PI) / 4); g.scale(dpr * 1.6, dpr * 1.6);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(5, 0); g.lineTo(-3.5, -3.5); g.lineTo(-2, 0); g.lineTo(-3.5, 3.5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  function renderList() {
    const def = G.mapDef, me = (G.stats && G.stats.lvl) || 1;
    const rows = groups(def).map((gr, i) => {
      const pen = C.expPenalty(me, gr.m.lvl), col = gr.m.boss ? '#ff6a4a' : lvlColor(gr.m.lvl);
      const note = gr.m.boss ? 'บอส' : pen < 1 ? `EXP ${Math.round(pen * 100)}%` : gr.m.lvl - me >= 8 ? 'อันตราย' : `${gr.pts.length} จุด`;
      return `<button type="button" class="wm-row" data-g="${i}"><span class="wm-name">${gr.m.boss ? '☠ ' : ''}${gr.m.name}</span>` +
        `<b style="color:${col}">Lv.${gr.m.lvl}</b><small>${note}</small></button>`;
    });
    $('wmTitle').textContent = `🗺 ${def.name} · ${C.levelText(def)}`;
    $('wmList').innerHTML = rows.join('') || '<div class="wm-empty">ไม่มีมอนสเตอร์ในแผนที่นี้</div>';
  }

  // ------------------------------------------------------------ 📖 drop guide: every map, every monster, the item levels
  // it drops (C.dropGuide). Filter by item level to find where an item comes from; a monster of this map = walk there.
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pct = (v) => (v >= 0.1 ? `${Math.round(v * 100)}%` : v >= 0.01 ? `${(v * 100).toFixed(1)}%` : `${(v * 100).toFixed(2)}%`);
  const monsOf = (id) => { const d = C.MAPS[id]; return [...(d.mons || []), ...(d.boss ? [d.boss] : [])]; };
  let guide = false, guideLvl = 0;                            // 0 = every item level
  // weapon names follow the class (ดาบคู่ / แส้ / ธนู / ทวน); a set is named after its body piece
  const setName = (r) => (G.cls === 'taoist' ? C.ITEMS[r.ids[0]].name.replace(/^ชุดคลุม/, 'ชุด') : `ชุด${C.ARMOR_SETS[r.tier - 1].name}`);
  function card(g, here) {
    const col = g.boss ? '#ff6a4a' : lvlColor(g.lvl);
    const items = g.items.map((r) => {
      const name = r.kind === 'weapon' ? C.ITEMS[r.ids[0]].name : setName(r), tip = r.ids.map((id) => C.ITEMS[id].name).join(' · ');
      return `<span class="dg-it${r.lvl === guideLvl ? ' hit' : ''}" title="${esc(tip)}"><i class="dg-kind ${r.kind}">${r.kind === 'weapon' ? 'อาวุธ' : 'ชุด'}</i>` +
        `${esc(name)} <b>Lv.${r.lvl}</b> <span class="dg-pc">${pct(r.chance)}</span>${r.high && !g.boss ? ' <i class="dg-hi">Epic+</i>' : ''}</span>`;
    }).join('');
    return `<div class="dg-mon${g.boss ? ' boss' : ''}${here ? ' here' : ''}" data-t="${g.type}">` +
      `<div class="dg-head"><span class="dg-name">${g.boss ? '☠ ' : ''}${esc(g.name)}</span><b style="color:${col}">Lv.${g.lvl}</b>` +
      `<small>💰 ${g.gold[0].toLocaleString()}–${g.gold[1].toLocaleString()} · ${g.boss ? 'ของแน่นอน 1 ชิ้น <b class="dg-u">เกรด Unique ขึ้นไปทุกครั้ง</b> (ดาเมจสูงสุด)' : `ดรอปของ ${pct(g.any)} ต่อตัว`}` +
      ` · โอกาสเกรด <span style="color:${C.GRADES[3].color}">U ${pct(g.high[0])}</span> <span style="color:${C.GRADES[4].color}">L ${pct(g.high[1])}</span> <span style="color:${C.GRADES[5].color}">M ${pct(g.high[2])}</span></small></div>` +
      `<div class="dg-items">${items}</div></div>`;
  }
  function renderGuide() {
    const cur = G.mapDef && G.mapDef.id;
    const all = C.MAP_ORDER.map((id) => [id, monsOf(id).map(C.dropGuide).filter(Boolean)]);
    const levels = [...new Set(all.flatMap(([, ms]) => ms.flatMap((g) => g.items.map((r) => r.lvl))))].sort((a, b) => a - b);
    let html = `<div class="dg-bar"><label>หาไอเทม <select id="dgLvl"><option value="0">ทุกเลเวล</option>` +
      levels.map((l) => `<option value="${l}"${l === guideLvl ? ' selected' : ''}>Lv.${l}</option>`).join('') + `</select></label>` +
      `<span class="dg-key"><i class="dg-hi">Epic+</i> ลุ้นเกรด Epic ขึ้นไปได้ · % มอนสเตอร์ = ต่อการฆ่า 1 ตัว · % บอส = โอกาสเป็นชิ้นนั้น · ชี้ที่ชุดเพื่อดูชื่อทั้ง 4 ชิ้น</span></div>`;
    // grade odds by monster level, straight from C.HIGH_BANDS / C.BOSS_GRADES: always what the server rolls
    const hi = C.GRADES.slice(3), cells = (list) => list.slice(3).map((v) => `<td>${pct(v)}</td>`).join('');
    html += `<table class="dg-bands"><tr><th>โอกาสเกรดต่อไอเทม 1 ชิ้น</th>${hi.map((g) => `<th style="color:${g.color}">${g.name}</th>`).join('')}</tr>` +
      C.gradeBands().map((b) => `<tr><td>มอน Lv.${b.from}${b.to ? `–${b.to}` : ' ขึ้นไป'} <small>×${b.mul}</small></td>${cells(b.chances)}</tr>`).join('') +
      `<tr class="boss"><td>☠ บอส (ได้ 1 ชิ้นแน่นอน)</td>${cells(C.gradeChances(1, 1, true))}</tr></table>`;
    // the current map first
    for (const [id, ms] of [...all].sort((a, b) => (b[0] === cur) - (a[0] === cur))) {
      const shown = ms.filter((g) => !guideLvl || g.items.some((r) => r.lvl === guideLvl));
      if (!shown.length) continue;
      const def = C.MAPS[id];
      html += `<details class="dg-map"${id === cur || guideLvl ? ' open' : ''}><summary>${id === cur ? '<span class="dg-here">อยู่ที่นี่</span> ' : ''}${esc(def.name)} <small>${C.levelText(def)}</small></summary>` +
        shown.map((g) => card(g, id === cur)).join('') + '</details>';
    }
    $('wmGuide').innerHTML = html;
  }
  function setGuide(on) {
    guide = on;
    $('mapPanel').classList.toggle('guide', on);
    $('wmGuide').classList.toggle('hidden', !on);
    $('wmGuideBtn').textContent = on ? '↩ กลับไปแผนที่' : '✦ คู่มือดรอป';
    if (on) renderGuide();
  }
  WMAP.guide = (on = true) => { if (!WMAP.open) WMAP.toggle(true); if (WMAP.open) setGuide(on); };
  $('wmGuideBtn').addEventListener('click', (e) => { e.stopPropagation(); setGuide(!guide); });
  $('wmGuide').addEventListener('change', (e) => { if (e.target.id === 'dgLvl') { guideLvl = Number(e.target.value); renderGuide(); } });
  $('wmGuide').addEventListener('click', (e) => {
    const c = e.target.closest('.dg-mon');
    if (!c) return;
    if (!c.classList.contains('here')) {
      const id = C.MAP_ORDER.find((m) => monsOf(m).includes(c.dataset.t));
      return HUD.toast(`${C.MONSTERS[c.dataset.t].name} อยู่ที่${C.MAPS[id].name}`);
    }
    const gr = groups(G.mapDef).find((q) => q.type === c.dataset.t);
    if (gr) { const p = nearest(gr.pts); setGuide(false); go(p.x, p.y, gr.m.name); }
  });

  WMAP.toggle = function (force) {
    const open = force !== undefined ? !!force : !WMAP.open;
    if (open && (!G.map || !G.me)) return;
    if (open === WMAP.open) return;
    WMAP.open = open;
    if (!open && guide) setGuide(false);
    $('mapPanel').classList.toggle('hidden', !open);
    clearInterval(timer);
    if (!open) return;
    size(); renderList(); draw();
    timer = setInterval(draw, 250);
  };
  // the map changed while the panel is open
  WMAP.refresh = function () { if (WMAP.open) { size(); renderList(); draw(); if (guide) renderGuide(); } };

  function go(x, y, label) {
    if (G.travelTo(x, y, label)) { if (G.touch) WMAP.toggle(false); else draw(); }
  }
  $('wmCanvas').addEventListener('click', (e) => {
    const cv = $('wmCanvas'), r = cv.getBoundingClientRect(), k = cv.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    const s = spots.slice().reverse().find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    if (s) return go(s.x, s.y, s.label);
    go(x / scale, y / scale, '');
  });
  $('wmCanvas').addEventListener('mousemove', (e) => {
    const cv = $('wmCanvas'), r = cv.getBoundingClientRect(), k = cv.width / r.width;
    const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    cv.style.cursor = spots.some((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) ? 'pointer' : 'crosshair';
  });
  $('mapPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('close')) return WMAP.toggle(false);
    if (b.dataset.g !== undefined) {
      const gr = groups(G.mapDef)[Number(b.dataset.g)];
      if (gr) { const p = nearest(gr.pts); go(p.x, p.y, gr.m.name); }
    }
  });
  addEventListener('resize', () => { if (WMAP.open) { size(); draw(); } });
})();
