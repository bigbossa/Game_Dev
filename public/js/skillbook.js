// Skill book (K): the class's skill tree split into paths by unlock level (C.SKILL_PATHS). The player spends skill
// points to learn a skill, stack its level (C.SKILL_MAX) and unlock its evolutions, and chooses which key 1-9 each
// skill sits on (drag a card onto the skill bar, or pick the key). The server owns the state (G.skl).
(function () {
  const BOOK = { open: false };
  window.BOOK = BOOK;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = (d) => G.socket && G.socket.emit('skills', d);
  const fmt = (n) => Number(n).toLocaleString();

  function card(sk, S, lvl) {
    const sl = S.sk[sk.id] || 0, rank = C.skillRankOf(S, sk.id), cap = C.skillCap(sk, lvl);
    const info = C.skillInfoAt(sk, rank), free = S.free || 0;
    const key = S.bar.indexOf(sk.id);
    const maximum = sk.free || sk.passive ? 1 : sk.maxRank || C.SKILL_MAX;
    const power = sk.free && sk.arbiter ? C.arbiterPower(lvl, true) : C.skillPower(sl, rank);
    const spec = sk.arbiter && C.arbiterSpec(sk, sl || 1, rank);
    const pct = value => +(value * 100).toFixed(1);
    const buffInfo = !sl || !spec ? '' : spec.kind === 'resonance' ? `บัพ ${(spec.duration/1000).toFixed(2)} วิ · โบนัสครบ 5 ชั้น +${pct(spec.bonus)}%`
      : spec.kind === 'astral' ? `บัพ ${(spec.duration/1000).toFixed(2)} วิ · ดาบเสริม ${pct(spec.bonus)}% ATK`
      : spec.kind === 'ward' ? `ลดดาเมจ ${pct(spec.guard)}% (PvP ${pct(spec.guard*.75)}%) · ${spec.duration/1000} วิ`
      : spec.kind === 'form' ? `ดาเมจ +${pct(spec.damage)}% (PvP +${pct(spec.damage*2/3)}%) · ตีเร็ว +${pct(spec.aspd)}% · ${spec.duration/1000} วิ` : '';
    const canUp = cap > sl && free > 0;
    const upWhy = sl >= maximum ? 'สเต็กเต็ม' : !cap ? `ต้องการ Lv.${sk.lvl}` : sl >= cap ? `สเต็กถัดไป Lv.${sk.lvl + sl * C.SKILL_LVL_GAP}` : !free ? 'แต้มไม่พอ' : '';
    let html = `<div class="sk-card${sl ? ' got' : ''}${!cap ? ' locked' : ''}" data-id="${sk.id}" draggable="${sl && !sk.passive ? 'true' : 'false'}">` +
      `<div class="sk-ico" title="${sl && !sk.passive ? 'ลากไปวางบนแถบสกิล' : ''}"></div><div class="sk-main">` +
      `<div class="sk-title"><b>${esc(info.name)}</b>${rank ? ` <span class="sk-stars">${'★'.repeat(rank)}</span>` : ''} <small>Lv.${sk.lvl}${sk.mp ? ` · ปราณ ${C.skillMp(sk, lvl)}` : ''} · คูลดาวน์ ${(sk.cd / 1000).toFixed(1)} วิ</small></div>` +
      `<div class="sk-desc">${esc(info.desc)}</div>` +
      (buffInfo ? `<div class="sk-desc"><b>${esc(buffInfo)}</b></div>` : '') +
      (window.SkillDesigns?.[sk.id]?`<div class="sk-desc"><small>กระบวนท่า: ${esc(SkillDesigns[sk.id].title)}</small></div>`:'') +
      `<div class="sk-lvl"><span class="sk-pips">${Array.from({ length: maximum }, (_, i) => `<i class="${i < sl ? 'on' : i < cap ? 'can' : ''}"></i>`).join('')}</span>` +
      `<span>สเต็ก <b>${sl}</b>/${maximum}${sl && !sk.passive && !buffInfo ? ` · พลัง ×${power.toFixed(2)}` : ''}${sk.free ? ' · ฝึกตามเลเวล ไม่ใช้แต้ม' : ''}</span></div>` +
      `<div class="sk-acts"><button type="button" data-up="${sk.id}"${canUp ? '' : ' disabled'} title="${esc(upWhy)}">${sl ? '+1 สเต็ก' : 'เรียนสกิล'}</button>` +
      `<label class="sk-key">${sk.passive ? 'พาสซีฟ' : 'ปุ่ม'} <select data-bar="${sk.id}"${sl && !sk.passive ? '' : ' disabled'}><option value="-1">—</option>` +
      C.BAR_KEYS.map((k, i) => `<option value="${i}"${key === i ? ' selected' : ''}>${k}</option>`).join('') + `</select></label></div>`;
    // evolution path of this skill
    if (sk.evo && sk.evo.length) {
      html += '<div class="sk-evos">';
      sk.evo.forEach((e, i) => {
        const done = i < rank, why = done ? '' : C.evoBlock(sk, S, lvl, i);
        html += `<div class="sk-evo${done ? ' done' : !why ? ' ready' : ''}"><span class="bk-tag evo">ขั้น ${i + 1}</span>` +
          `<b>${esc(e.name)}</b> <small>Lv.${e.lvl} · สเต็ก ${C.EVO_NEED[i]} · ${C.EVO_COST} แต้ม</small>` +
          (done ? ' <span class="sk-ok">✓</span>' : `<button type="button" data-evo="${sk.id}"${why ? ` disabled title="${esc(why)}"` : ''}>อัพขั้น</button>`) +
          `<div class="bk-desc">${esc(e.desc)}</div></div>`;
      });
      html += '</div>';
    }
    return html + '</div></div>';
  }

  function render() {
    const S = G.skl;
    if (!S) return;
    const lvl = (G.stats && G.stats.lvl) || 1, st = C.stageOf(lvl);
    const cls = C.CLASSES[G.cls] || C.CLASSES.dualblade;
    const cost = lvl < 30 ? 0 : lvl * 100;
    $('bookPanel').querySelector('.panel-head span').textContent = `📜 คัมภีร์วิชา${cls.name}`;
    const evolution = G.cls === 'arbiter' ? C.ARBITER_STAGES[C.arbiterStage(lvl)].name : '';
    let html = `<div class="bk-now">แต้มสกิลคงเหลือ <b class="sk-free">${S.free}</b> <small>(ได้ 1 แต้มทุกเลเวล)</small>` +
      (evolution ? ` · <b>${esc(evolution)}</b> · ตีธรรมดาโตตาม Lv ×${C.arbiterPower(lvl,true).toFixed(2)} · 8 สกิลและท่าไม้ตาย Lv.120/130 ใช้แต้มเรียนและอัพขั้น` : ` · ขั้นวิชา <b>${st}</b>/13 ${esc(C.STANCES[st] || '')}`) +
      `<div class="sk-tools"><label><input type="checkbox" id="skAuto"${S.auto ? ' checked' : ''}> อัปสกิลอัตโนมัติเมื่อเลเวลอัป</label>` +
      `<button type="button" class="sk-reset">รีเซ็ตสกิล${cost ? ` (${fmt(cost)} ทอง)` : ' (ฟรีก่อน Lv.30)'}</button></div>` +
      `<small class="sk-hint">เรียนสกิล → อัปสเต็ก (สูงสุด ${C.SKILL_MAX}) → อัพขั้นวิชาเมื่อถึงเลเวล · ลากการ์ดไปวางบนแถบสกิล หรือเลือก "ปุ่ม" เพื่อจัดตำแหน่ง</small></div>`;
    for (const path of C.SKILL_PATHS) {
      const list = cls.skills.filter((s) => s.lvl >= path.from && s.lvl <= path.to);
      if (!list.length) continue;
      const open = lvl >= path.from;
      html += `<div class="sk-path${open ? ' open' : ''}"><div class="sk-path-head">${path.name} <small>Lv.${path.from}–${path.to}${open ? '' : ' · ยังไม่ถึงเลเวล'}</small></div>` +
        list.map((sk) => card(sk, S, lvl)).join('') + '</div>';
    }
    const list = $('bookList'), top = list.scrollTop;
    list.innerHTML = html;
    list.scrollTop = top;
    for (const el of list.querySelectorAll('.sk-card')) {
      const ico = HUD.icon(el.dataset.id, (G.me && G.me.faction) || 'dharma');
      el.querySelector('.sk-ico').appendChild(ico);
    }
  }

  // put a skill on key slot i (-1 = take it off the bar); a skill already elsewhere moves, the old occupant swaps in
  BOOK.place = function (id, i) {
    const S = G.skl;
    if (!S || !C.ALL_SKILLS[id] || C.ALL_SKILLS[id].passive) return;
    const bar = S.bar.slice(), from = bar.indexOf(id);
    if (from >= 0) bar[from] = i >= 0 ? bar[i] : null;
    if (i >= 0) bar[i] = id;
    send({ cmd: 'bar', bar });
  };
  BOOK.set = function (d) {
    if (!d) return;
    const barChanged = !G.skl || String(G.skl.bar) !== String(d.bar);
    G.skl = d;
    if (barChanged) { HUD.buildBar(); if (G.rebuildKeys) G.rebuildKeys(); }
    const b = $('bookBtn');
    b.classList.toggle('has', d.free > 0);
    b.dataset.n = d.free > 0 ? d.free : '';
    if (BOOK.open) render();
  };
  BOOK.toggle = function (force) {
    const open = force !== undefined ? !!force : !BOOK.open;
    if (open === BOOK.open) return;
    BOOK.open = open;
    if (open) render();
    $('bookPanel').classList.toggle('hidden', !open);
  };
  BOOK.refresh = () => { if (BOOK.open) render(); };

  const panel = $('bookPanel');
  panel.querySelector('.close').addEventListener('click', () => BOOK.toggle(false));
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.up) send({ cmd: 'up', id: b.dataset.up });
    else if (b.dataset.evo) send({ cmd: 'evo', id: b.dataset.evo });
    else if (b.classList.contains('sk-reset')) { if (confirm('คืนแต้มสกิลทั้งหมดเพื่อแจกใหม่?')) send({ cmd: 'reset' }); }
  });
  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'skAuto') send({ cmd: 'auto', on: t.checked });
    else if (t.dataset.bar) BOOK.place(t.dataset.bar, Number(t.value));
    t.blur();
  });
  panel.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('.sk-card');
    if (!c || c.getAttribute('draggable') !== 'true') return;
    e.dataTransfer.setData('text/skill', c.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
})();
