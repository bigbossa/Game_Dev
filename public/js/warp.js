// Teleport stone panel: warp to any map at any level for a fare that grows with the distance (C.warpCost, the server
// charges it); maps above the character are only marked (the stone stands in every camp and in each faction's base on
// the PvP map). The 📦 button opens the storage.
(function () {
  const WARP = { open: false };
  window.WARP = WARP;
  const $ = (id) => document.getElementById(id);

  function render() {
    const lvl = (G.stats && G.stats.lvl) || 1, gold = (INV.state && INV.state.gold) || 0;
    $('warpGold').textContent = gold.toLocaleString();
    $('warpList').innerHTML = C.MAP_ORDER.map((id) => {
      const d = C.MAPS[id], here = id === G.mapId, hard = lvl < d.lv[0], cost = C.warpCost(G.mapId, id), poor = !here && gold < cost;
      const note = here ? 'คุณอยู่ที่นี่' : hard ? `⚠ มอนสเตอร์ Lv.${d.lv[0]}+ สูงกว่าคุณ · บอส Lv.${C.MONSTERS[d.boss].lvl}`
        : d.pvp ? 'สนามรบ PvP ธรรมะ ปะทะ อธรรม · บอสราชันมารโลหิต'
          : `บอส: ${C.MONSTERS[d.boss].name} Lv.${C.MONSTERS[d.boss].lvl}`;
      return `<button type="button" class="warp-row${here ? ' here' : ''}${hard ? ' hard' : ''}${d.pvp ? ' pvp' : ''}${poor ? ' poor' : ''}" data-id="${id}"${here || poor ? ' disabled' : ''}>` +
        `<span class="wn">${d.pvp ? '⚔ ' : ''}${d.name}</span><span class="wl">${C.levelText(d)}</span>` +
        `${here ? '' : `<span class="wc">💰 ${cost.toLocaleString()}</span>`}<small>${poor ? 'ทองไม่พอ · ' : ''}${note}</small></button>`;
    }).join('');
  }

  WARP.toggle = function (force) {
    const open = force !== undefined ? !!force : !WARP.open;
    if (open === WARP.open) return;
    WARP.open = open;
    if (open) render();
    $('warpPanel').classList.toggle('hidden', !open);
  };

  $('warpPanel').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('close')) return WARP.toggle(false);
    if (b.dataset.store) { WARP.toggle(false); return STORE.toggle(true); }
    if (b.dataset.id && !b.disabled) { G.socket.emit('warp', b.dataset.id); WARP.toggle(false); }
  });
})();
