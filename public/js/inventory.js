// Inventory, equipment and blacksmith shop panels.
(function () {
  const INV = { state: { inv: [], eq: { weapon: 'w0' }, gold: 0 }, faction: 'dharma', shopOpen: false, potionShopOpen: false, enhShopOpen: false, shopTab: 'weapon', potQty: {} };
  window.INV = INV;
  INV.anyShopOpen = () => INV.shopOpen || INV.potionShopOpen || INV.enhShopOpen;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n.toLocaleString('th-TH');
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const lvl = () => (G.stats ? G.stats.lvl : 1);
  const pct = (v) => `${Math.round(v * 100)}%`;
  // enhancement stone icon (a faceted violet crystal with a spark)
  const STONE_ICON = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2ecff"/><stop offset=".45" stop-color="#9a7cff"/><stop offset="1" stop-color="#3a1a8a"/></linearGradient></defs>
    <path d="M16 2 27 11 22 29H10L5 11Z" fill="url(#a)" stroke="#1c0c40" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M16 2 12 11 16 29M16 2 20 11 16 29M5 11H27" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".9"/>
    <path d="M24 4l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#fff"/></svg>`);
  INV.STONE_ICON = STONE_ICON;
  // talismans: a paper charm with a red seal; guard = blue paper with a shield, luck = gold paper with a star
  const charmSvg = (paper, edge, mark) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <path d="M9 2h14l-1 28H10z" fill="${paper}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12 6h8M12 25h8" stroke="#c3262c" stroke-width="1.6" stroke-linecap="round"/>${mark}</svg>`);
  const CHARM_ICON = {
    guard: charmSvg('#d8f0ff', '#1d4f7a', '<path d="M16 9l6 2.4v4.4c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4v-4.4z" fill="#3a8ad8" stroke="#0e2c4a" stroke-width="1.2"/><path d="M13 16l2.2 2.2L19.4 13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    luck: charmSvg('#ffe9a8', '#7a4a10', '<path d="M16 9.5l1.9 4.1 4.4.5-3.3 3 1 4.4-4-2.3-4 2.3 1-4.4-3.3-3 4.4-.5z" fill="#ff6a3a" stroke="#7a1a10" stroke-width="1"/>'),
  };
  INV.CHARM_ICON = CHARM_ICON;
  // mid / high tier materials (C.MAT_TIERS): the stone turns azure / gold-red, the talismans get a silver / gold
  // edge, and every icon carries 2 or 3 tier pips at the bottom
  const pips = (n, col) => Array.from({ length: n }, (_, i) => `<circle cx="${16 + (i - (n - 1) / 2) * 5}" cy="29" r="1.8" fill="${col}" stroke="#000" stroke-width=".6"/>`).join('');
  const stoneSvg = (hi, mid, lo, pip) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
    <path d="M16 2 27 11 22 29H10L5 11Z" fill="url(#a)" stroke="#1c0c40" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M16 2 12 11 16 29M16 2 20 11 16 29M5 11H27" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".9"/>
    <path d="M24 4l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#fff"/>${pip}</svg>`);
  const tierCharm = (k, edge, pip) => charmSvg(k === 'guard' ? '#d8f0ff' : '#ffe9a8', edge, (k === 'guard'
    ? '<path d="M16 9l6 2.4v4.4c0 3.6-2.6 6.2-6 7.4-3.4-1.2-6-3.8-6-7.4v-4.4z" fill="#3a8ad8" stroke="#0e2c4a" stroke-width="1.2"/><path d="M13 16l2.2 2.2L19.4 13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M16 9.5l1.9 4.1 4.4.5-3.3 3 1 4.4-4-2.3-4 2.3 1-4.4-3.3-3 4.4-.5z" fill="#ff6a3a" stroke="#7a1a10" stroke-width="1"/>') + pip);
  // หินสุ่มออฟชั่น (green leaf mark) / หินสุ่มสกิลติดตัว (purple spark mark), each 3 tiers like guard/luck
  const REAFFIX_MARK = '<path d="M16 8c5 1 7 5 7 10-5 0-9-2-10-7-3 2-4 5-3 9-4-2-6-6-5-11 2-5 7-2 11-1z" fill="#4ad86a" stroke="#0e5a1e" stroke-width="1"/>';
  const REPASSIVE_MARK = '<path d="M16 8l2.2 5.1 5.4.6-4 3.7 1.2 5.4-4.8-2.8-4.8 2.8 1.2-5.4-4-3.7 5.4-.6z" fill="#c08aff" stroke="#3a1a6a" stroke-width="1"/>';
  const reaffixSvg = (edge, pip) => charmSvg('#d8ffe0', edge, REAFFIX_MARK + pip);
  const repassiveSvg = (edge, pip) => charmSvg('#f0e0ff', edge, REPASSIVE_MARK + pip);
  const MAT_ICON = {
    stone: [STONE_ICON, stoneSvg('#eafcff', '#4ac0ff', '#0a3a8a', pips(2, '#bff0ff')), stoneSvg('#fff6d0', '#ffb43a', '#8a1010', pips(3, '#ffe27a'))],
    guard: [CHARM_ICON.guard, tierCharm('guard', '#8a9ab0', pips(2, '#dfe8f5')), tierCharm('guard', '#b8860b', pips(3, '#ffd24a'))],
    luck: [CHARM_ICON.luck, tierCharm('luck', '#8a9ab0', pips(2, '#dfe8f5')), tierCharm('luck', '#b8860b', pips(3, '#ffd24a'))],
    reaffix: [reaffixSvg('#1d7a2a', ''), reaffixSvg('#8a9ab0', pips(2, '#dfe8f5')), reaffixSvg('#b8860b', pips(3, '#ffd24a'))],
    repassive: [repassiveSvg('#5a2a9a', ''), repassiveSvg('#8a9ab0', pips(2, '#dfe8f5')), repassiveSvg('#b8860b', pips(3, '#ffd24a'))],
  };
  INV.matIcon = (kind, tier) => MAT_ICON[kind][tier || 0];
  const TIER_COL = ['#c9b8ff', '#7fd4ff', '#ffc24a'];

  // ------------------------------------------------------------ tooltip
  let tip;
  function showTip(e, html) {
    if (!tip) { tip = document.getElementById('tooltip') || document.createElement('div'); tip.id = 'tooltip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block'; moveTip(e);
  }
  function moveTip(e) {
    if (!tip) return;
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 16)) + 'px';
    tip.style.top = Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, e.clientY - 40)) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  INV.tip = { show: showTip, move: moveTip, hide: hideTip };
  // stat bonuses of an item as short parts (["ATK +10", ...]); long = Thai labels for tooltips
  // it = an item or a plain stats object (it.core); weapons always show ATK
  function statParts(it, long, weapon = it.slot === 'weapon') {
    const L = long
      ? { atk: 'พลังโจมตี', crit: 'คริติคอล', def: 'ป้องกัน', hp: 'พลังชีวิต', mp: 'ปราณ', speed: 'ความเร็ว' }
      : { atk: 'ATK', crit: 'CRIT', def: 'DEF', hp: 'HP', mp: 'MP', speed: 'SPD' };
    const out = [];
    if (weapon || it.atk) out.push(`${L.atk} ${long ? '<b>' : ''}+${it.atk || 0}${long ? '</b>' : ''}`);
    if (it.crit) out.push(`${L.crit} ${long ? '<b>' : ''}+${pct(it.crit)}${long ? '</b>' : ''}`);
    if (it.def) out.push(`${L.def} ${long ? '<b>' : ''}+${it.def}${long ? '</b>' : ''}`);
    if (it.hp) out.push(`${L.hp} ${long ? '<b>' : ''}+${it.hp}${long ? '</b>' : ''}`);
    if (it.mp) out.push(`${L.mp} ${long ? '<b>' : ''}+${it.mp}${long ? '</b>' : ''}`);
    if (it.speed) out.push(`${L.speed} ${long ? '<b>' : ''}+${it.speed}${long ? '</b>' : ''}`);
    return out;
  }
  // affixes / special option / passive of a graded item, one tooltip line each
  function gradeLines(it) {
    const out = [];
    for (const [k, v] of it.affixes || []) {
      const A = C.AFFIXES[k];
      out.push(`<span style="color:#8fe08f">+${A.pct ? pct(v) : v} ${A.th}</span>`);
    }
    if (it.option) out.push(`<span style="color:${C.GRADES[3].color}">◆ ${esc(C.OPTIONS[it.option[0]].desc(it.option[1]))}</span>`);
    if (it.passive) {
      const P = C.PASSIVES[it.passive[0]];
      const ch = C.passiveChance(it.passive[0], it.grade || 0);
      out.push(`<span style="color:${C.GRADES[4].color}">✦ สกิลติดตัว: <b style="color:inherit">${esc(P.name)}</b> — ${esc(P.desc(it.passive[1]))}${ch ? ` <small>(โอกาสทำงาน ${Math.round(ch * 100)}%)</small>` : ''}</span>`);
    }
    // what the piece adds to the outfit (by set) and the colour of its light (by grade, per faction)
    const garb = window.ArmorLook && ArmorLook.garbOf(it.slot, it.tier, window.G && G.cls);
    if (garb) out.push(`<span style="color:#cfe0ff">◇ บนตัวละคร: ${esc(garb)}</span>`);
    if (it.grade >= 1) {
      const cls = window.G && G.cls, lc = ArmorLook.lightOf(INV.faction, it.grade, cls);
      out.push(`<span style="color:${C.GRADES[it.grade].color}">❖ เส้นแสงขอบตัว <b style="display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:-1px;background:${lc};box-shadow:0 0 6px ${lc}"></b> ${ArmorLook.lightName(INV.faction, cls, it.grade)} ระดับ ${it.grade}/5</span>`);
    }
    return out.length ? '<br>' + out.join('<br>') : '';
  }
  // grade class for slot borders (Legendary glow, Mythic rainbow)
  INV.gradeClass = (it) => (it && it.grade >= 4 ? ` g${it.grade}` : '');
  INV.itemTip = function (it, extra = '', qty = 1) {
    if (it.kind) return `<b style="color:${C.RARITY[0].color}">${esc(it.name)}</b>${qty > 1 ? ` <small style="color:#cfc8b8">×${qty}</small>` : ''}<br>
      <small style="color:#cfc8b8">${esc(it.desc)}</small><br>
      <small>ราคาขาย ${fmt(C.sellPrice(it))} ทอง${qty > 1 ? ` × ${qty} = ${fmt(C.sellPrice(it) * qty)} ทอง` : ''}</small>${extra}`;
    const r = C.GRADES[it.grade || 0];
    const ok = lvl() >= it.lvl;
    // compare with what is worn in the same slot
    let cmp = '';
    const worn = C.ITEMS[INV.state.eq[it.slot]];
    if (worn && worn.id !== it.id) cmp = `<br><small style="color:#9a9488">สวมอยู่: ${esc(worn.name)} (${statParts(worn).join(' · ')})</small>`;
    return `<b style="color:${r.color}">${esc(it.name)}</b><br>
      <small>${C.SLOT_NAMES[it.slot]} · <b style="color:${r.color}">${r.name}</b> (${r.th}) · <span style="color:${ok ? '#9fe89f' : '#ff7a6a'}">ต้องการ Lv.${it.lvl}</span></small><br>
      ${statParts(it.core || it, true, it.slot === 'weapon').join(' · ')}${C.ENHANCE.canEnhance(it) ? `<br><span style="color:#ffb870">⚔ ดาเมจใส่มอนสเตอร์ +${Math.round(C.ENHANCE.pveShare(it) * 100)}% <small>(จากตีบวก · ${it.slot === 'weapon' ? 'อาวุธ' : 'ชุดแต่ละชิ้น'} +10 = +${Math.round(C.PVE_PLUS_MAX * C.SLOT_PVE[it.slot] * 100)}%)</small></span>` : ''}${gradeLines(it)}<br>
      <small style="color:#cfc8b8">${esc(it.desc)}</small><br>
      <small>ราคาขาย ${fmt(C.sellPrice(it))} ทอง</small>${cmp}${extra}`;
  };

  // ------------------------------------------------------------ build
  INV.init = function (faction) {
    INV.faction = faction;
    const grid = $('bagGrid');
    grid.innerHTML = '';
    for (let i = 0; i < C.BAG_SIZE; i++) {
      const s = document.createElement('div');
      s.className = 'bag-slot';
      s.dataset.idx = i;
      s.addEventListener('dblclick', (e) => { if (!e.target.closest('.bag-check')) { if (STORE.open) STORE.put(i); else useItem(i); } });
      s.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.shiftKey) return discard(i);
        if (STORE.open) STORE.put(i); else if (INV.anyShopOpen()) sell(i); else useItem(i);
      });
      s.addEventListener('mouseenter', (e) => {
        const it = C.ITEMS[INV.state.inv[i]];
        const verb = it && it.kind ? 'ใช้' : 'สวมใส่';
        if (it) showTip(e, INV.itemTip(it, `<br><small style="color:#e8c26a">${INV.anyShopOpen() ? `คลิกขวา = ขาย · ดับเบิลคลิก = ${verb}` : `ดับเบิลคลิก/คลิกขวา = ${verb}`} · Shift+คลิกขวา = ทิ้ง</small>`, it.kind ? C.stackCount(INV.state.inv[i]) : 1));
      });
      s.addEventListener('mousemove', moveTip);
      s.addEventListener('mouseleave', hideTip);
      // touch screens: tap for details + action buttons (no double-click / right-click there)
      s.addEventListener('click', (e) => {
        if (e.target.closest('.bag-check')) { e.stopPropagation(); return toggleSel(i); }
        const it = window.G && G.touch && C.ITEMS[INV.state.inv[i]];
        if (!it) return;
        hideTip();
        itemMenu(INV.itemTip(it, '', it.kind ? C.stackCount(INV.state.inv[i]) : 1), [
          { label: it.kind ? 'ใช้' : 'สวมใส่', fn: () => useItem(i) },
          ...(INV.anyShopOpen() ? [{ label: `ขาย ${fmt(C.sellPrice(it) * (it.kind ? C.stackCount(INV.state.inv[i]) : 1))} ทอง`, fn: () => sell(i) }] : []),
          { label: 'ทิ้ง', cls: 'warn', fn: () => { if (confirm(`ทิ้ง ${it.name}?`)) discard(i); } },
        ]);
      });
      grid.appendChild(s);
    }
    for (const el of document.querySelectorAll('#eqGrid .eq-slot')) {
      const slot = el.dataset.slot;
      const off = () => { if (slot !== 'weapon' && INV.state.eq[slot]) { emit('unequip', slot); hideTip(); } };
      el.addEventListener('dblclick', off);
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); off(); });
      el.addEventListener('mouseenter', (e) => {
        const it = C.ITEMS[INV.state.eq[slot]];
        if (it) showTip(e, INV.itemTip(it, `<br><small style="color:#9fe89f">กำลังสวมใส่${slot !== 'weapon' ? ' · ดับเบิลคลิก/คลิกขวา = ถอด' : ''}</small>`));
        else showTip(e, `<b>${C.SLOT_NAMES[slot]}</b><br><small>ยังไม่ได้สวมใส่ · ได้จากมอนสเตอร์หรือร้านช่างตีดาบ</small>`);
      });
      el.addEventListener('mousemove', moveTip);
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('click', () => {
        const it = window.G && G.touch && C.ITEMS[INV.state.eq[slot]];
        if (!it) return;
        hideTip();
        itemMenu(INV.itemTip(it), slot !== 'weapon' ? [{ label: 'ถอด', fn: off }] : []);
      });
    }

    // shop rows (all items; the active tab decides which are shown)
    const list = $('shopList');
    list.innerHTML = '';
    for (const it of C.ALL_ITEMS) {
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.dataset.id = it.id;
      row.dataset.slot = it.slot;
      // Normal..Unique, each at its own price (C.shopGearPrice scales with level + grade); Legendary/Mythic stay drop-only
      const gradeBtn = (g) => `<button type="button" class="buy g${g}" data-grade="${g}" style="color:${C.GRADES[g].color}">${C.GRADES[g].name}<br>${fmt(C.shopGearPrice(it, g))}</button>`;
      row.innerHTML = `<div class="shop-icon" style="border-color:${C.RARITY[it.rarity].color}"><img src="${WeaponLook.iconSrc(it.id, faction)}" alt=""></div>
        <div class="shop-info"><div class="shop-name" style="color:${C.RARITY[it.rarity].color}">${esc(it.name)}</div>
        <div class="shop-meta"><span class="req">Lv.${it.lvl}</span> · ${statParts(it).join(' · ')}</div></div>
        <div class="buy-grades">${[0, 1, 2, C.SHOP_BUY_GRADE_MAX].map(gradeBtn).join('')}</div>`;
      row.querySelectorAll('.buy').forEach((b) => b.addEventListener('click', () => emit('shop', { act: 'buy', id: it.id, grade: +b.dataset.grade })));
      row.addEventListener('mouseenter', (e) => showTip(e, INV.itemTip(it, `<br><small>ราคาซื้อ (ธรรมดา) ${fmt(C.shopGearPrice(it, 0))} ทอง — เกรดสูงขึ้นแพงขึ้นตามระดับ</small>`)));
      row.addEventListener('mousemove', moveTip);
      row.addEventListener('mouseleave', hideTip);
      list.appendChild(row);
    }
    for (const im of document.querySelectorAll('.stone-ico')) im.src = STONE_ICON;
    for (const im of document.querySelectorAll('.charm-ico')) im.src = CHARM_ICON[im.dataset.k];
    for (const b of document.querySelectorAll('#shopTabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));
    setTab('weapon');

    // ร้านขายยา: its own building/panel, separate from the blacksmith — potions and the town scroll, bought by
    // the typed amount (a whole stack lands in the bag in one go, up to C.STACK_MAX)
    const potionList = $('potionList');
    potionList.innerHTML = '';
    const potSyncs = [];
    const POT_COLOR = { hp: '#ff8a7a', mp: '#7ac8ff', warp: '#ffd76a' };
    for (const it of C.CONSUMABLES) {
      const col = POT_COLOR[it.kind] || '#c8c8c8';
      const row = document.createElement('div');
      row.className = 'shop-row potion-row';
      row.dataset.id = it.id;
      row.innerHTML = `<div class="shop-icon" style="border-color:${col}"><img src="${WeaponLook.iconSrc(it.id, faction)}" alt=""></div>
        <div class="shop-info"><div class="shop-name" style="color:${col}">${esc(it.name)}</div>
        <div class="shop-meta">${esc(it.desc)}<br><b style="color:#ffd76a">${fmt(it.price)}</b> ทอง/ชิ้น</div></div>
        <div class="mat-qty"><span>จำนวน</span><input type="number" min="1" max="${C.STACK_MAX}" step="1" value="${INV.potQty[it.id] || 1}" inputmode="numeric">
          <button type="button" class="q-buy">ซื้อ</button><span class="q-tot"></span></div>`;
      const input = row.querySelector('input'), tot = row.querySelector('.q-tot'), buyBtn = row.querySelector('.q-buy');
      const qty = () => Math.max(1, Math.min(C.STACK_MAX, Math.floor(Number(input.value) || 1)));
      const sync = () => {
        const n = qty(); INV.potQty[it.id] = n;
        tot.innerHTML = `รวม <b>${fmt(it.price * n)}</b> ทอง`;
        buyBtn.disabled = INV.state.gold < it.price * n;
      };
      input.addEventListener('input', sync);
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') buyBtn.click(); });
      sync(); potSyncs.push(sync);
      buyBtn.addEventListener('click', () => emit('shop', { act: 'buy', id: it.id, n: qty() }));
      row.addEventListener('mouseenter', (e) => showTip(e, INV.itemTip(it, `<br><small>ราคาซื้อ ${fmt(it.price)} ทอง/ชิ้น</small>`)));
      row.addEventListener('mousemove', moveTip);
      row.addEventListener('mouseleave', hideTip);
      potionList.appendChild(row);
    }
    INV.syncPotionShop = () => potSyncs.forEach((f) => f());
    document.querySelectorAll('#invPanel .close, #shopPanel .close, #potionPanel .close, #enhPanel .close').forEach((b) => b.addEventListener('click', () => INV.closeAll()));
  };
  function setTab(tab) {
    INV.shopTab = tab;
    for (const b of document.querySelectorAll('#shopTabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const row of $('shopList').children) row.style.display = row.dataset.slot === tab ? '' : 'none';
    const own = tab === 'mats';                           // drawn into enhList, not shop rows
    $('shopList').classList.toggle('hidden', own);
    $('enhList').classList.toggle('hidden', !own);
    if (own) renderEnhance();
    $('shopList').scrollTop = 0;
  }

  // ------------------------------------------------------------ enhancement (ตีบวก): weapons + the 4 armour pieces
  // what one + level adds, e.g. "ATK 90 → 99 · DEF 34 → 37"
  function enhGain(it, next) {
    const L = { atk: 'ATK', def: 'DEF', hp: 'HP', mp: 'MP' }, a = it.core || it, b = next.core || next;
    return Object.keys(L).filter((k) => (b[k] || 0) !== (a[k] || 0) || (it.slot === 'weapon' && k === 'atk'))
      .map((k) => `${L[k]} ${a[k] || 0} → <b>${b[k] || 0}</b>`).join(' · ') +
      ` · ดาเมจมอน +${Math.round(C.ENHANCE.pveShare(it) * 100)}% → <b>+${Math.round(C.ENHANCE.pveShare(next) * 100)}%</b>`;
  }
  // ------------------------------------------------------------ ร้านตีบวก: pick an item, tick talismans, pay one price
  // INV.enhSel = { where: 'eq' | 'inv', key: slot | bag index } (the item there is looked up again on every render);
  // INV.enhOpt = the ticked talismans. The price comes from C.ENHANCE.quote, the same formula the server charges.
  INV.enhSel = null;
  INV.enhOpt = { guard: false, luck: false };
  function enhItems() {
    const st = INV.state, out = [];
    for (const slot of C.SLOTS) {
      const it = C.ITEMS[st.eq[slot]] || (slot === 'weapon' ? C.WEAPONS[0] : null);
      if (C.ENHANCE.canEnhance(it)) out.push({ where: 'eq', key: slot, it });
    }
    st.inv.forEach((id, i) => { const it = C.ITEMS[id]; if (C.ENHANCE.canEnhance(it)) out.push({ where: 'inv', key: i, it }); });
    return out;
  }
  // how a failed try ends (C.ENHANCE soft fails at +1..+6; dropping from +1 breaks it as well)
  function failShare(plus) {
    const E = C.ENHANCE, soft = plus >= E.softPlusMin && plus <= E.softPlusMax;
    if (!soft) return { brk: 1, demote: 0 };
    const demote = (1 - E.softBreakChance) * E.softDemoteChance;
    return plus - 1 <= 0 ? { brk: E.softBreakChance + demote, demote: 0 } : { brk: E.softBreakChance, demote };
  }
  function renderEnhShop() {
    const box = $('enhShop'), st = INV.state, f = INV.faction, E = C.ENHANCE, items = enhItems();
    let sel = INV.enhSel && items.find((x) => x.where === INV.enhSel.where && x.key === INV.enhSel.key);
    if (!sel) { sel = items[0] || null; INV.enhSel = sel && { where: sel.where, key: sel.key }; }
    box.innerHTML = '';
    // 1. the item
    box.insertAdjacentHTML('beforeend', '<div class="enh-sec">1. เลือกอาวุธหรือชุดที่จะตีบวก</div>');
    const pick = document.createElement('div');
    pick.className = 'enh-pick';
    for (const x of items) {
      const b = document.createElement('button'), it = x.it;
      b.type = 'button';
      b.className = 'enh-item' + (x === sel ? ' on' : '');
      b.style.borderColor = C.RARITY[it.rarity].color;
      b.innerHTML = `<img src="${WeaponLook.iconSrc(it.base || it.id, f)}" alt="">${it.plus ? `<span class="plus p${it.plus}">+${it.plus}</span>` : ''}<small>${x.where === 'eq' ? 'สวมอยู่' : 'กระเป๋า'}</small>`;
      b.addEventListener('click', () => { INV.enhSel = { where: x.where, key: x.key }; hideTip(); renderEnhShop(); });
      b.addEventListener('mouseenter', (e) => showTip(e, INV.itemTip(it)));
      b.addEventListener('mousemove', moveTip);
      b.addEventListener('mouseleave', hideTip);
      pick.appendChild(b);
    }
    box.appendChild(pick);
    if (!sel) { box.insertAdjacentHTML('beforeend', '<div class="enh-hint">ไม่มีอาวุธหรือชุดที่ตีบวกได้</div>'); return; }
    const it = sel.it, plus = it.plus || 0, base = C.ITEMS[it.base || it.id];
    const card = document.createElement('div');
    card.className = 'enh-card';
    card.innerHTML = `<div class="shop-name" style="color:${C.RARITY[it.rarity].color}">${esc(it.name)} <small>(${sel.where === 'eq' ? 'สวมอยู่' : 'ในกระเป๋า'})</small></div>`;
    box.appendChild(card);
    if (plus >= C.MAX_PLUS) { card.insertAdjacentHTML('beforeend', '<div class="enh-hint">ตีบวกสูงสุดแล้ว (+10)</div>'); rerollRow(card, sel); return; }
    const q = E.quote(st, base, plus, { ...INV.enhOpt, item: it }), rate = E.rateWith(plus, q.luck), next = C.ITEMS[C.plusId(it.id, plus + 1)];
    const risk = failShare(plus);
    const failTxt = q.guard ? '<span class="risk safe">ถ้าล้มเหลว: ยันต์กันแตกคุ้มครอง ไอเทมไม่แตก ระดับคงเดิม</span>'
      : risk.brk >= 1 ? `<span class="risk">⚠ ถ้าล้มเหลว (${pct(1 - rate)}) ไอเทมแตกหาย</span>`
      : `<span class="risk">⚠ ถ้าล้มเหลว: แตก ${pct(risk.brk)} · ลดระดับ ${pct(risk.demote)} · คงเดิม ${pct(1 - risk.brk - risk.demote)}</span>`;
    card.insertAdjacentHTML('beforeend', `<div class="shop-meta">+${plus} → <b>+${plus + 1}</b> · ${enhGain(it, next)}</div>
      <div class="enh-chance">โอกาสสำเร็จ <b>${pct(rate)}</b>${q.luck ? ' <small class="luck">(+ยันต์เพิ่มโอกาส)</small>' : ''}</div><div class="shop-meta">${failTxt}</div>`);
    // 2. talismans: ticked = one used on this try (an owned one first, otherwise bought within the same price)
    const opts = document.createElement('div');
    opts.className = 'charm-use';
    opts.innerHTML = '<span>2. ใช้ยันต์ (ติ๊กแล้วคิดรวมในราคาครั้งนี้):</span>' + ['guard', 'luck'].map((k) => {
      const S = C.matDef(k, q.tier), have = C.matHave(st, k, q.tier);
      return `<label><input type="checkbox" data-k="${k}" ${INV.enhOpt[k] ? 'checked' : ''}><img src="${INV.matIcon(k, q.tier)}" alt=""> ${S.name}
        <small>${have > 0 ? `ใช้ของที่มี (มี ${fmt(have)} ใบ)` : `+${fmt(q[k + 'Price'])} ทอง`}</small></label>`;
    }).join('');
    opts.addEventListener('change', (e) => { const k = e.target.dataset.k; if (k) { INV.enhOpt[k] = e.target.checked; renderEnhShop(); } });
    card.appendChild(opts);
    // 3. the one price: the work (stones included) + ticked talismans
    const stone = C.matDef('stone', q.tier), lines = [`ค่าตีบวก (รวมหิน) <b>${fmt(q.work)}</b>`];
    if (q.ownStones) lines.push(`ใช้${stone.name}ที่มี ${q.ownStones} ก้อน ลด <b>-${fmt(q.stoneOff)}</b>`);
    for (const k of ['guard', 'luck']) if (q[k]) lines.push(`${C.matDef(k, q.tier).name} ${q[k + 'Own'] ? '<small>ใช้ของที่มี</small>' : `<b>${fmt(q[k + 'Gold'])}</b>`}`);
    const poor = st.gold < q.total;
    card.insertAdjacentHTML('beforeend', `<div class="enh-bill">${lines.join(' · ')}<div class="enh-total">รวม <b>${fmt(q.total)}</b> ทอง${poor ? ' <span class="risk">ทองไม่พอ</span>' : ''}</div></div>
      <button type="button" class="enh-go" ${poor ? 'disabled' : ''}>⚒ ตีบวก +${plus + 1} · ${fmt(q.total)} ทอง</button>`);
    card.querySelector('.enh-go').addEventListener('click', () => {
      if (!q.guard && !confirm(`ตีบวก ${it.name} → +${plus + 1}\nโอกาสสำเร็จ ${pct(rate)} · ราคา ${fmt(q.total)} ทอง\nถ้าล้มเหลว ไอเทมอาจแตกหายถาวร (ติ๊กยันต์กันแตกเพื่อป้องกัน)\nต้องการตีบวกต่อ?`)) return;
      const use = { guard: q.guard ? 1 : 0, luck: q.luck ? 1 : 0, tier: q.tier, total: q.total };
      emit('shop', sel.where === 'eq' ? { act: 'enhance', where: 'eq', slot: sel.key, ...use } : { act: 'enhance', where: 'inv', idx: sel.key, key: st.inv[sel.key], ...use });
    });
    rerollRow(card, sel);
    const rates = E.rate.map((r, i) => `+${i + 1} ${pct(E.rateWith(i, q.luck))}`).join(' · ');
    box.insertAdjacentHTML('beforeend', `<div class="enh-rates">โอกาสสำเร็จแต่ละขั้น: ${rates}</div>`);
  }
  // หินสุ่มออฟชั่น / หินสุ่มสกิลติดตัว (paid here in gold, or an owned stone): reroll just the green-font affixes (Rare+) or the ✦
  // passive (Legendary+), everything else stays — shown only when the item has that part to reroll
  function rerollRow(card, sel) {
    const it = sel.it, st = INV.state, G = C.GRADES[it.grade || 0], tier = C.matTier(C.ITEMS[it.base || it.id].lvl || 1);
    if (!G.affix[1] && !G.passive) return;
    const btn = (kind, label, show) => {
      if (!show) return '';
      const kk = kind === 'affix' ? 'reaffix' : 'repassive', mk = C.matKey(kk, tier), m = C.matHave(st, kk, tier);
      const cost = C.ENHANCE.rerollPrice(C.ITEMS[it.base || it.id], kind), poor = m < 1 && st.gold < cost;
      return `<button type="button" class="reroll" data-kind="${kind}" ${poor ? 'disabled' : ''}>${label}<br><small>${m > 0 ? `ใช้ ${C.ENH_CHARMS[mk].name} (มี ${fmt(m)})` : `${fmt(cost)} ทอง${poor ? ' · ทองไม่พอ' : ''}`}</small></button>`;
    };
    card.insertAdjacentHTML('beforeend', `<div class="reroll-row">${btn('affix', 'สุ่มออฟชั่นใหม่', G.affix[1])}${btn('passive', 'สุ่มสกิลติดตัวใหม่', G.passive)}</div>`);
    card.querySelectorAll('.reroll').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.kind;
      if (!confirm(`สุ่ม${kind === 'affix' ? 'ออฟชั่น (ตัวหนังสือสีเขียว)' : 'สกิลติดตัว (✦)'}ใหม่ของ ${it.name}?\nค่าสถานะหลัก เกรด และระดับตีบวกไม่เปลี่ยน แต่ของเดิมจะหายไป`)) return;
      emit('shop', sel.where === 'eq' ? { act: 'reroll', where: 'eq', slot: sel.key, kind } : { act: 'reroll', where: 'inv', idx: sel.key, key: st.inv[sel.key], kind });
    }));
  }
  // enhancement materials: หินตีบวก + ยันต์กันแตก + ยันต์เพิ่มโอกาส, each with its count and buy / sell buttons
  // every tier (C.MAT_TIERS) × stone / guard / luck; the basic stone is ENH_STONE (buyStone), the rest are "charms"
  const MATS = [];
  C.MAT_TIERS.forEach((T, tier) => {
    const col = TIER_COL[tier], hi = tier > 0;
    for (const kind of ['stone', 'guard', 'luck', 'reaffix', 'repassive']) {
      // stones / guard / luck are paid inside the ร้านตีบวก price now: listed only to sell back old stock
      const k = C.matKey(kind, tier), basicStone = kind === 'stone' && !tier, noBuy = true;
      MATS.push({ k, tier, kind, S: C.matDef(kind, tier), icon: INV.matIcon(kind, tier), col, unit: kind === 'stone' ? 'ก้อน' : 'ใบ',
        noBuy, buy: noBuy ? [] : hi ? [1] : [1, 5], sell: kind === 'stone' && !hi ? [1, 10] : [1],
        have: (st) => C.matHave(st, kind, tier), act: (sell) => (basicStone ? (sell ? 'sellStone' : 'buyStone') : sell ? 'sellCharm' : 'buyCharm') });
    }
  });
  const TIER_NOTE = ['อุปกรณ์ต่ำกว่า Lv.60', 'อุปกรณ์ Lv.60–99', 'อุปกรณ์ Lv.100 ขึ้นไป'];
  // tiers = which tiers to show (the enhance tab only shows the ones its items need); all by default
  // the typed quantity of each material (kept across re-renders while the shop is open)
  INV.matQty = INV.matQty || {};
  function matShop(tiers) {
    const st = INV.state, wrap = document.createElement('div');
    wrap.className = 'mat-shop';
    let shownTier = -1;
    for (const M of MATS) {
      if (tiers && !tiers.has(M.tier)) continue;
      if (M.noBuy && !M.have(st)) continue;
      if (M.tier !== shownTier && (shownTier = M.tier) >= 0) wrap.insertAdjacentHTML('beforeend', `<div class="mat-tier" style="color:${M.col}">วัสดุ${C.MAT_TIERS[M.tier].th} <small>· ใช้ตีบวก${TIER_NOTE[M.tier]}</small></div>`);
      const have = M.have(st), box = document.createElement('div');
      box.className = `stone-shop mat-${M.k}`;
      box.innerHTML = `<div class="shop-icon"><img src="${M.icon}" alt=""></div>
        <div class="shop-info"><div class="shop-name" style="color:${M.col}">${M.S.name} <small>มี <b>${fmt(have)}</b> ${M.unit}</small></div>
        <div class="shop-meta">${M.noBuy ? 'ขายคืนได้ (ร้านตีบวกรวมค่านี้ในราคาตีบวกแล้ว)' : `ซื้อ <b class="price">${fmt(M.S.price)}</b>`} · ขาย ${fmt(M.S.sell)} ทอง/${M.unit}</div></div>
        <div class="btns">${M.buy.map((n) => `<button type="button" data-n="${n}" ${st.gold < n * M.S.price ? 'disabled' : ''}>ซื้อ ×${n}</button>`).join('')}
          ${M.sell.map((n) => `<button type="button" class="sell" data-n="${n}" data-sell="1" ${have < n ? 'disabled' : ''}>ขาย ×${n}</button>`).join('')}</div>
        <div class="mat-qty"><span>จำนวน</span><input type="number" min="1" max="${M.S.max}" step="1" value="${INV.matQty[M.k] || 1}" inputmode="numeric">
          <button type="button" class="q-max" title="จำนวนมากที่สุดที่ทองพอ">สูงสุด</button>
          <button type="button" class="q-buy">ซื้อ</button><button type="button" class="q-sell sell">ขาย</button><span class="q-tot"></span></div>`;
      if (M.noBuy) box.querySelectorAll('.q-max, .q-buy').forEach((b) => { b.hidden = true; });
      // typed quantity: 1..the most one can hold; the total updates while typing
      const input = box.querySelector('.mat-qty input'), tot = box.querySelector('.q-tot');
      const qty = () => Math.max(1, Math.min(M.S.max, Math.floor(Number(input.value) || 1)));
      const sync = () => {
        const n = qty(), room = M.S.max - have;
        INV.matQty[M.k] = n;
        tot.innerHTML = `ซื้อ <b>${fmt(n * M.S.price)}</b> · ขาย ${fmt(n * M.S.sell)} ทอง`;
        box.querySelector('.q-buy').disabled = st.gold < n * M.S.price || room < n;
        box.querySelector('.q-sell').disabled = have < n;
      };
      input.addEventListener('input', sync);
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') box.querySelector('.q-buy').click(); });
      sync();
      const buy = (n, sell) => {
        // everything but the basic stone is expensive: confirm every purchase
        if (!sell && (M.k !== 'stone' || M.tier) && !confirm(`ซื้อ${M.S.name} ×${fmt(n)} ราคา ${fmt(M.S.price * n)} ทอง?`)) return;
        if (sell && n >= 10 && !confirm(`ขาย${M.S.name} ×${fmt(n)} ได้ ${fmt(M.S.sell * n)} ทอง?`)) return;
        emit('shop', { act: M.act(sell), k: M.k, n });
      };
      box.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.classList.contains('q-max')) { input.value = Math.max(1, Math.min(M.S.max - have, Math.floor(st.gold / M.S.price))); sync(); return; }
        if (b.classList.contains('q-buy')) return buy(qty(), false);
        if (b.classList.contains('q-sell')) return buy(qty(), true);
        buy(+b.dataset.n, !!b.dataset.sell);
      });
      box.addEventListener('mouseenter', (e) => showTip(e, `<b style="color:${M.col}">${M.S.name}</b><br><small>${esc(M.S.desc)}</small>`));
      box.addEventListener('mousemove', moveTip);
      box.addEventListener('mouseleave', hideTip);
      wrap.appendChild(box);
    }
    return wrap;
  }
  // ✦ วัสดุตีบวก tab of the blacksmith: buy / sell every material tier (the ร้านตีบวก uses owned ones first)
  function renderEnhance() {
    const box = $('enhList');
    box.innerHTML = '';
    box.appendChild(matShop());
  }

  // bag actions send the item key too: the server refuses them if the bag was re-sorted meanwhile
  function useItem(i) {
    const key = INV.state.inv[i];
    if (!key) return;
    const it = C.ITEMS[key];
    emit(it && it.kind ? 'useItem' : 'equip', { idx: i, key });
  }
  // smallest potion of that kind in the bag (so the bigger ones are saved for when they're actually needed);
  // used by the bot and by follow.js's auto-potion. Returns false if none is carried.
  INV.useKind = function (kind) {
    let best = -1, bestPct = Infinity;
    for (let i = 0; i < INV.state.inv.length; i++) {
      const it = C.ITEMS[INV.state.inv[i]];
      if (it && it.kind === kind && it.pct < bestPct) { best = i; bestPct = it.pct; }
    }
    if (best < 0) return false;
    useItem(best);
    return true;
  };
  // item details with action buttons (touch screens)
  function itemMenu(html, actions) {
    let m = $('itemMenu');
    if (!m) { m = document.createElement('div'); m.id = 'itemMenu'; m.className = 'panel'; $('hud').appendChild(m); }
    m.innerHTML = `<div class="im-body">${html}</div><div class="im-btns">` +
      actions.map((a, k) => `<button type="button" data-k="${k}" class="${a.cls || ''}">${a.label}</button>`).join('') +
      '<button type="button" data-k="x" class="ghost">ปิด</button></div>';
    m.classList.remove('hidden');
    m.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      m.classList.add('hidden');
      if (b.dataset.k !== 'x') actions[+b.dataset.k].fn();
    };
  }
  function sell(i) {
    const it = C.ITEMS[INV.state.inv[i]];
    if (!it) return;
    if (it.grade >= C.EPIC && !confirm(`ขาย ${it.name} ในราคา ${fmt(C.sellPrice(it))} ทอง?`)) return;
    emit('shop', { act: 'sell', idx: i, key: INV.state.inv[i] });
  }
  function discard(i) {
    const it = C.ITEMS[INV.state.inv[i]];
    if (it && confirm(`ทิ้ง ${it.name}? (กู้คืนไม่ได้)`)) emit('discard', { idx: i, key: INV.state.inv[i] });
  }

  // ------------------------------------------------------------ multi-select: tick items, then sell / discard them together
  // sel: bag slot -> item key when ticked; a slot whose item changed (sold, moved, equipped) drops out on render
  const sel = new Map();
  function toggleSel(i) {
    const id = INV.state.inv[i];
    if (!id) return;
    if (sel.has(i)) sel.delete(i); else sel.set(i, id);
    INV.render();
  }
  const selected = () => [...sel.keys()].filter((i) => INV.state.inv[i] === sel.get(i)).sort((a, b) => a - b);
  function renderBagBar() {
    const idxs = selected(), n = idxs.length;
    const gold = idxs.reduce((t, i) => t + C.sellPrice(C.ITEMS[INV.state.inv[i]]) * C.stackCount(INV.state.inv[i]), 0);
    $('bagBar').classList.toggle('active', n > 0);
    $('bagSelInfo').innerHTML = n ? `เลือก <b>${n}</b> ชิ้น · ขายได้ <b class="gold">${fmt(gold)}</b> ทอง` : 'ติ๊ก ☐ ที่มุมไอเทมเพื่อเลือกหลายชิ้น';
    const q = (k) => $('bagBar').querySelector(`[data-bag="${k}"]`);
    q('none').disabled = !n;
    q('drop').disabled = !n;
    q('drop').textContent = n ? `ทิ้ง ${n} ชิ้น` : 'ทิ้ง';
    q('sell').disabled = !n || !INV.anyShopOpen();
    q('sell').textContent = n ? `ขาย ${n} ชิ้น` : 'ขาย';
    q('sell').title = INV.anyShopOpen() ? '' : 'ขายได้ที่ร้านช่างตีดาบหรือร้านขายยา (เปิดร้านก่อน)';
    q('all').disabled = !INV.state.inv.some((id, i) => id && !sel.has(i));
    q('store').classList.toggle('hidden', !STORE.open);
    q('store').disabled = !n;
    q('store').textContent = n ? `📦 ฝาก ${n} ชิ้น` : '📦 ฝาก';
    const used = INV.state.inv.filter(Boolean).length;
    $('bagCount').textContent = `${used}/${C.BAG_SIZE}`;
    $('bagCount').classList.toggle('full', used >= C.BAG_SIZE);
    const auto = document.querySelector('.bag-tools [data-bag="autosort"]');
    auto.classList.toggle('on', !!INV.state.autoSort);
    auto.textContent = INV.state.autoSort ? '☑ จัดอัตโนมัติ' : '☐ จัดอัตโนมัติ';
  }
  // high grades are named in the confirmation so nothing valuable goes by accident
  const rareNote = (items) => {
    const hi = items.filter((it) => it.grade >= C.EPIC);
    return hi.length ? `\n\n⚠ มีไอเทมระดับ Epic ขึ้นไป ${hi.length} ชิ้น:\n${hi.slice(0, 6).map((it) => `• ${it.name} (${C.GRADES[it.grade].name})`).join('\n')}${hi.length > 6 ? '\n…' : ''}` : '';
  };
  $('bagBar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const idxs = selected(), items = idxs.map((i) => C.ITEMS[INV.state.inv[i]]);
    if (b.dataset.bag === 'all') INV.state.inv.forEach((id, i) => { if (id) sel.set(i, id); });
    else if (b.dataset.bag === 'none') sel.clear();
    else if (b.dataset.bag === 'sell') {
      const gold = items.reduce((t, it) => t + C.sellPrice(it), 0);
      if (!confirm(`ขาย ${idxs.length} ชิ้น ได้ ${fmt(gold)} ทอง?${rareNote(items)}`)) return;
      emit('shop', { act: 'sellMany', idxs, keys: idxs.map((i) => INV.state.inv[i]) }); sel.clear();
    } else if (b.dataset.bag === 'store') {
      STORE.putMany(idxs); sel.clear();
    } else if (b.dataset.bag === 'drop') {
      if (!confirm(`ทิ้ง ${idxs.length} ชิ้น? (กู้คืนไม่ได้)${rareNote(items)}`)) return;
      emit('discard', { idxs, keys: idxs.map((i) => INV.state.inv[i]) }); sel.clear();
    }
    INV.render();
  });

  // sort now / keep sorted (server: onBag, C.sortBag)
  document.querySelector('.bag-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.bag === 'sort') emit('bag', { cmd: 'sort' });
    else if (b.dataset.bag === 'autosort') emit('bag', { cmd: 'auto', on: !INV.state.autoSort });
    else if (b.dataset.bag === 'autoequip') emit('autoEquip', {});
    else if (b.dataset.bag === 'storage') STORE.toggle();
  });

  // ------------------------------------------------------------ auto-sell: grades sold the moment they drop
  function renderAutoSell() {
    const box = $('autoSell');
    if (!box) return;
    const on = new Set(INV.state.autoSell || []);
    box.innerHTML = '<span class="as-label">ขายอัตโนมัติเมื่อดรอป:</span>' + C.GRADES.map((gr, g) =>
      `<button type="button" class="as-chip${on.has(g) ? ' on' : ''}" data-g="${g}" style="--gc:${gr.color}" title="${gr.th}">${gr.name}</button>`).join('');
  }
  $('autoSell') && $('autoSell').addEventListener('click', (e) => {
    const b = e.target.closest('.as-chip');
    if (!b) return;
    const g = +b.dataset.g, on = new Set(INV.state.autoSell || []);
    if (on.has(g)) on.delete(g);
    else {
      if (g >= C.EPIC && !confirm(`ขายอัตโนมัติไอเทมระดับ ${C.GRADES[g].name} ทุกชิ้นที่ดรอป?\nไอเทมระดับนี้หายากและจะถูกขายทันทีโดยไม่เข้ากระเป๋า`)) return;
      on.add(g);
    }
    emit('autosell', { grades: [...on] });
  });

  // ------------------------------------------------------------ render
  INV.set = function (state) {
    // ticked items that moved (sorted) stay ticked in their new slot
    const moved = [...sel].filter(([i, id]) => state.inv[i] !== id);
    for (const [i] of moved) sel.delete(i);
    for (const [, id] of moved) { const j = state.inv.findIndex((x, k) => x === id && !sel.has(k)); if (j >= 0) sel.set(j, id); }
    INV.state = state;
    INV.render();
  };
  INV.render = function () {
    const st = INV.state, f = INV.faction;
    const slots = $('bagGrid').children;
    for (let i = 0; i < slots.length; i++) {
      const it = C.ITEMS[st.inv[i]];
      const s = slots[i];
      s.className = 'bag-slot' + INV.gradeClass(it);
      if (sel.has(i) && st.inv[i] !== sel.get(i)) sel.delete(i);          // the item in this slot changed
      if (!it) { s.innerHTML = ''; s.style.borderColor = ''; continue; }
      s.classList.add('filled');
      s.classList.toggle('picked', sel.has(i));
      s.classList.toggle('toolow', lvl() < it.lvl);
      s.style.borderColor = C.RARITY[it.rarity].color;
      const qty = it.kind ? C.stackCount(st.inv[i]) : 0;
      s.innerHTML = `<img src="${WeaponLook.iconSrc(it.base || it.id, f)}" alt="" draggable="false">${it.kind ? '' : `<span class="lv">${it.lvl}</span>`}${it.plus ? `<span class="plus p${it.plus}">+${it.plus}</span>` : ''}${qty > 1 ? `<span class="qty">×${qty}</span>` : ''}` +
        `<span class="bag-check" role="checkbox" aria-checked="${sel.has(i)}" title="เลือก"></span>`;
    }
    renderBagBar();
    if (window.HUD && HUD.updatePotionCounts) HUD.updatePotionCounts();
    if (INV.syncPotionShop) INV.syncPotionShop();
    for (const el of document.querySelectorAll('#eqGrid .eq-slot')) {
      const slot = el.dataset.slot;
      const it = C.ITEMS[st.eq[slot]] || (slot === 'weapon' ? C.WEAPONS[0] : null);
      el.className = 'eq-slot' + INV.gradeClass(it);
      el.style.borderColor = it ? C.RARITY[it.rarity].color : '';
      el.classList.toggle('empty', !it);
      el.innerHTML = `${it ? `<img src="${WeaponLook.iconSrc(it.base || it.id, f)}" alt="" draggable="false">` + (it.plus ? `<span class="plus p${it.plus}">+${it.plus}</span>` : '') : ''}<span class="eq-label">${C.SLOT_NAMES[slot]}</span>`;
    }
    const w = C.ITEMS[st.eq.weapon] || C.WEAPONS[0];
    $('eqName').innerHTML = `<span style="color:${C.RARITY[w.rarity].color}">${esc(w.name)}</span>`;
    for (const el of document.querySelectorAll('.gold-val')) el.textContent = fmt(st.gold);
    // basic count, then mid / high when any are owned ("120 · 3 · 1")
    const tiers = (kind) => { const n = C.MAT_TIERS.map((T, t) => C.matHave(st, kind, t)); return n[1] || n[2] ? n.map(fmt).join(' · ') : fmt(n[0]); };
    for (const el of document.querySelectorAll('.stone-val')) { el.textContent = tiers('stone'); el.title = 'ขั้นต้น · ขั้นกลาง · ขั้นสูง'; }
    INV.renderStats();
    if (INV.shopTab === 'mats' && INV.shopOpen) renderEnhance();
    if (INV.enhShopOpen) renderEnhShop();
    for (const el of document.querySelectorAll('.guard-val')) el.textContent = tiers('guard');
    for (const el of document.querySelectorAll('.luck-val')) el.textContent = tiers('luck');
    renderAutoSell();
    // shop affordability
    for (const row of $('shopList').children) {
      const it = C.ITEMS[row.dataset.id];
      row.querySelector('.buy').disabled = st.gold < it.price;
      row.querySelector('.req').classList.toggle('bad', lvl() < it.lvl);
    }
  };
  // damage to monsters: the outfit's enhancement + the full-set grade bonus (C.gearPve)
  function pveRow() {
    const p = C.gearPve(INV.state.eq), G2 = C.GRADES[p.setGrade];
    const tip = `ตีบวกครบชุด: อาวุธ +10 = +${Math.round(C.PVE_PLUS_MAX * C.SLOT_PVE.weapon * 100)}% · ชุดแต่ละชิ้น +10 = +${Math.round(C.PVE_PLUS_MAX * C.SLOT_PVE.body * 100)}%` +
      ` · สวมครบ 5 ชิ้น ได้โบนัสตามระดับต่ำสุดของชุด: ${C.GRADES.slice(1).map((g, i) => `${g.name} +${Math.round(C.SET_BONUS[i + 1] * 100)}%`).join(' · ')}`;
    return `<div title="${tip}"><span>ดาเมจใส่มอนสเตอร์</span><b>×${p.mult.toFixed(2)}</b></div>` +
      `<div class="pve-break" title="${tip}"><span>ตีบวก ×${p.plus.toFixed(2)}</span><span>${p.setGrade < 0 ? 'ชุดไม่ครบ 5 ชิ้น' : p.set ? `ชุดครบ <b style="color:${G2.color}">${G2.name}</b> +${Math.round(p.set * 100)}%` : 'ชุดครบ (Normal) +0%'}</span></div>`;
  }
  INV.renderStats = function () {
    const s = G.stats;
    if (!s) return;
    // bonuses from everything worn
    const b = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, speed: 0 };
    for (const slot of C.SLOTS) {
      const it = C.ITEMS[INV.state.eq[slot]];
      if (!it) continue;
      for (const k of Object.keys(b)) b[k] += it[k] || 0;
    }
    const plus = (v, f = (x) => x) => (v ? ` <small>(+${f(v)})</small>` : '');
    $('statList').innerHTML = `
      <div><span>เลเวล</span><b>${s.lvl}</b></div>
      <div><span>พลังชีวิต</span><b>${s.mhp}${plus(b.hp)}</b></div>
      <div><span>ปราณ</span><b>${s.mmp}${plus(b.mp)}</b></div>
      <div><span>พลังโจมตี</span><b>${s.atk}${plus(b.atk)}</b></div>
      <div><span>ป้องกัน</span><b>${s.def}${plus(b.def)}</b></div>
      <div><span>คริติคอล</span><b>${s.crit}%${plus(b.crit, pct)}</b></div>
      <div><span>ความเร็ว</span><b>${s.spd || G.speed}${plus(b.speed)}</b></div>
      <div><span>ตีเร็ว</span><b>+${s.aspd || 0}%</b></div>
      <div title="โอกาสหลบก่อนหักความแม่นยำของผู้โจมตี; ขณะสตันหลบไม่ได้"><span>หลบหลีก</span><b>${s.evasion || 0}%</b></div>
      <div title="ลดโอกาสหลบของเป้าหมายตามจำนวนจุดเปอร์เซ็นต์"><span>แม่นยำ</span><b>${s.accuracy || 0}%</b></div>
      <div title="ลดระยะเวลาสตัน ตรึง และช้า"><span>ต้านทานควบคุม</span><b>${s.resistance || 0}%</b></div>
      ${pveRow()}`;
    const fx = C.gearFx(INV.state.eq), procs = C.gearProcs(INV.state.eq);
    const fxRows = Object.keys(fx).map((k) => C.OPTIONS[k]
      ? `<div class="fx-row" style="color:${C.GRADES[3].color}">◆ ${esc(C.OPTIONS[k].desc(fx[k]))}</div>`
      : `<div class="fx-row" style="color:${C.GRADES[4].color}">✦ ${esc(C.PASSIVES[k].name)}: ${esc(C.PASSIVES[k].desc(fx[k]))}${procs[k] ? ` · โอกาสทำงาน ${Math.round(procs[k] * 100)}%` : ''}</div>`);
    if (fxRows.length) $('statList').innerHTML += fxRows.join('');
  };

  // ------------------------------------------------------------ open / close
  INV.isOpen = () => !$('invPanel').classList.contains('hidden');
  INV.toggle = function (force) {
    const open = force !== undefined ? force : !INV.isOpen();
    $('invPanel').classList.toggle('hidden', !open);
    if (!open) { INV.closeShop(); hideTip(); }
    else { INV.render(); previewLoop(); }
  };
  INV.openShop = function () {
    INV.potionShopOpen = false;
    $('potionPanel').classList.add('hidden');
    INV.enhShopOpen = false;
    $('enhPanel').classList.add('hidden');
    INV.shopOpen = true;
    $('shopPanel').classList.remove('hidden');
    INV.toggle(true);
    renderBagBar();                      // selling the ticked items needs the shop open
  };
  INV.closeShop = function () {
    INV.shopOpen = false;
    $('shopPanel').classList.add('hidden');
    renderBagBar();
  };
  // ร้านขายยา: a separate panel/menu from the blacksmith, same proximity requirement (near the smith / stone)
  INV.openPotionShop = function () {
    INV.shopOpen = false;
    $('shopPanel').classList.add('hidden');
    INV.enhShopOpen = false;
    $('enhPanel').classList.add('hidden');
    INV.potionShopOpen = true;
    $('potionPanel').classList.remove('hidden');
    INV.toggle(true);
    renderBagBar();
  };
  INV.closePotionShop = function () {
    INV.potionShopOpen = false;
    $('potionPanel').classList.add('hidden');
    renderBagBar();
  };
  // ร้านตีบวก: its own building / panel (pick an item, tick talismans, one price)
  INV.openEnhShop = function () {
    INV.closeShop(); INV.closePotionShop();
    INV.enhShopOpen = true;
    $('enhPanel').classList.remove('hidden');
    INV.toggle(true);
    renderEnhShop();
    renderBagBar();
  };
  INV.closeEnhShop = function () {
    INV.enhShopOpen = false;
    $('enhPanel').classList.add('hidden');
    renderBagBar();
  };
  INV.closeAll = function () { INV.closeShop(); INV.closePotionShop(); INV.closeEnhShop(); INV.toggle(false); STORE.toggle(false); };

  // live character preview (rotates through the 8 directions)
  let previewing = false;
  function previewLoop() {
    if (!INV.isOpen()) { previewing = false; return; }
    if (previewing === 'tick') previewing = true;
    else if (previewing) return;            // already running
    previewing = true;
    const cv = $('invPreview'), g = cv.getContext('2d');
    const w = cv.clientWidth || 170, h = cv.clientHeight || 180;
    const ratio = CharacterMotion.pixelRatio(window.devicePixelRatio, w, h);
    const pw = Math.round(w * ratio), ph = Math.round(h * ratio);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, w, h);
    if (G.drawPreview) G.drawPreview(g, w, h, performance.now() / 1000);
    requestAnimationFrame(() => { previewing = 'tick'; previewLoop(); });
  }
})();
