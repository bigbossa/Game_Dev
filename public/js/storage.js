// Storage (คลังเก็บของ): each character's own C.STORAGE_SIZE slots + gold, opened at the blacksmith or the teleport
// stone of any camp (📦 in the bag, or the button in the shop / stone panels). While it is open, double-click /
// right-click on a bag item stores it and on a storage item takes it back; ticked bag items go in together.
// The server checks the spot and keeps the items (World.onStorage); actions carry the item key like the bag's.
(function () {
  const STORE = { open: false, items: [], gold: 0 };
  window.STORE = STORE;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.floor(n).toLocaleString();
  const send = (d) => G.socket && G.socket.emit('storage', d);

  STORE.toggle = function (force) {
    const open = force !== undefined ? !!force : !STORE.open;
    if (open && !G.nearCamp()) return HUD.toast('เปิดคลังได้ที่ช่างตีดาบหรือศิลาเคลื่อนย้ายในค่ายพัก');
    STORE.open = open;
    $('storagePanel').classList.toggle('hidden', !open);
    if (open) { send({ cmd: 'open' }); INV.toggle(true); }
    INV.render();
  };
  STORE.put = (i) => { const key = INV.state.inv[i]; if (key) send({ cmd: 'put', idx: i, key }); };
  STORE.putMany = (idxs) => send({ cmd: 'put', idxs, keys: idxs.map((i) => INV.state.inv[i]) });
  const take = (i) => { const key = STORE.items[i]; if (key) send({ cmd: 'take', idx: i, key }); };

  function build() {
    const grid = $('storageGrid');
    for (let i = 0; i < C.STORAGE_SIZE; i++) {
      const s = document.createElement('div');
      s.className = 'bag-slot';
      s.addEventListener('dblclick', () => take(i));
      s.addEventListener('contextmenu', (e) => { e.preventDefault(); take(i); });
      s.addEventListener('mouseenter', (e) => {
        const it = C.ITEMS[STORE.items[i]];
        if (it) INV.tip.show(e, INV.itemTip(it, '<br><small style="color:#e8c26a">ดับเบิลคลิก/คลิกขวา = นำออกใส่กระเป๋า</small>'));
      });
      s.addEventListener('mousemove', (e) => INV.tip.move(e));
      s.addEventListener('mouseleave', () => INV.tip.hide());
      s.addEventListener('click', () => { if (window.G && G.touch && STORE.items[i]) take(i); });   // touch: tap = take out
      grid.appendChild(s);
    }
    $('storagePanel').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('close')) return STORE.toggle(false);
      const n = Math.max(0, Math.floor(Number($('storeGoldIn').value) || 0));
      if (b.dataset.st === 'sort') send({ cmd: 'sort' });
      else if (b.dataset.st === 'dep') { if (n) send({ cmd: 'gold', n }); $('storeGoldIn').value = ''; }
      else if (b.dataset.st === 'wd') { if (n) send({ cmd: 'gold', n: -n }); $('storeGoldIn').value = ''; }
      else if (b.dataset.st === 'depAll') send({ cmd: 'gold', n: INV.state.gold });
    });
  }

  STORE.set = function (d) {
    STORE.items = d.items || [];
    STORE.gold = d.gold || 0;
    render();
  };
  function render() {
    const slots = $('storageGrid').children, f = INV.faction;
    for (let i = 0; i < slots.length; i++) {
      const it = C.ITEMS[STORE.items[i]], s = slots[i];
      s.className = 'bag-slot' + INV.gradeClass(it);
      if (!it) { s.innerHTML = ''; s.style.borderColor = ''; continue; }
      s.classList.add('filled');
      s.style.borderColor = C.RARITY[it.rarity].color;
      s.innerHTML = `<img src="${WeaponLook.iconSrc(it.base || it.id, f)}" alt="" draggable="false"><span class="lv">${it.lvl}</span>${it.plus ? `<span class="plus p${it.plus}">+${it.plus}</span>` : ''}`;
    }
    $('storeCount').textContent = `${STORE.items.filter(Boolean).length}/${C.STORAGE_SIZE}`;
    $('storeGold').textContent = fmt(STORE.gold);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
