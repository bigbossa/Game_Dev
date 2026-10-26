// Auto-hunt bot (กล่องบอท): fights the monsters inside a radius around the spot where it was started, with the
// basic attack and/or the ticked skills, and drinks HP / MP potions under the set percentages.
// Settings are kept in the browser. The bot stops when the character dies or changes map; WASD / joystick /
// a click on the ground take over for a moment, then the bot carries on. main.js calls BOT.tick() every frame and
// BOT.drawWorld() under the characters, and hands over its helpers through BOT.api.
(function () {
  const BOT = { on: false, anchor: null, mapId: null, api: null, manualUntil: 0 };
  window.BOT = BOT;
  const $ = (id) => document.getElementById(id);
  // skills 2-9 of the character's class (G.cls is set at login)
  const clsOf = () => C.CLASSES[(window.G && G.cls) || 'dualblade'] || C.CLASSES.dualblade;
  const skillsOf = () => clsOf().skills.filter((s) => s.key !== '1' && !s.passive);
  const learned = (id) => !!(G.skl && G.skl.sk[id]);
  // the key the player put the skill on (– when it is not on the bar)
  const keyOf = (s) => { const i = G.skl ? G.skl.bar.indexOf(s.id) : -1; return i >= 0 ? C.BAR_KEYS[i] : G.skl ? '–' : s.key; };
  // reach of each skill (world px from the target's edge) and the order they are tried in (big ones first)
  // (heals / buffs are cast on the bot itself and its party: buffs when a fight starts, heals when someone is hurt)
  const RANGE = { lotus: 110, shadowstep: 260, rend: 140, tempest: 120, crescent: 160, skyfall: 260, thousand: 120, twindragon: 200,
    oathSlash: 100, arcblade: 250, oathResonance: 9999, astralBlades: 9999, oathAegis: 9999, bladeOrbit: 130, ascendantForm: 9999, finalVerdict: 240,
    ...Object.fromEntries(C.CLASSES.warrior.skills.filter(s=>s.key!=='1'&&s.frontline).map(s=>[s.id,s.frontline.ward?9999:(s.frontline.range||100)-15])),
    ...Object.fromEntries(C.CLASSES.spearman.skills.filter(s=>s.spear).map(s => [s.id, s.spear.range - 15])),
    ...Object.fromEntries(Object.values(C.ALL_SKILLS).filter(s=>s.ritual).map(s=>[s.id,s.ritual.range||s.ritual.radius-30])),
    skybolt: 360, mercy: 9999, aegis: 9999, heavens: 360, spiritsword: 460, might: 9999, meteor: 380, nirvana: 9999,
    scatter: 380, hawkeye: 9999, gale: 9999, skyrain: 320, deadeye: 500, rollshot: 300, blast: 400, stormphoenix: 600 };
  const PRIORITY = ['tempest', 'twindragon', 'thousand', 'skyfall', 'rend', 'crescent', 'lotus', 'shadowstep',
    'spearBreak', 'spearBoss', 'spearExecution', 'spearHeaven', 'spearChain', 'spearHeart', 'spearPin', 'spearCrush',
    'nirvana', 'mercy', 'aegis', 'might', 'heavens', 'meteor', 'skybolt', 'spiritsword',
    'hawkeye', 'gale', 'stormphoenix', 'skyrain', 'blast', 'deadeye', 'scatter', 'rollshot'];
  const HEALS = ['mercy', 'nirvana'];
  PRIORITY.unshift('oathAegis', 'ascendantForm', 'oathResonance', 'astralBlades', 'finalVerdict', 'bladeOrbit', 'arcblade', 'oathSlash');
  PRIORITY.unshift('ironGuard','rallyGuard','lastBastion','guardianOath','battleCry','sunderStrike','shieldBash','shieldSweep','earthShatter','citadelStrike');
  PRIORITY.unshift(...Object.values(C.ALL_SKILLS).filter(s=>s.ritual).sort((a,b)=>b.lvl-a.lvl).map(s=>s.id));
  const DEF = { radius: 450, basic: true, skills: { lotus: true, rend: true, crescent: true, skybolt: true, mercy: true, aegis: true,
    oathSlash: true, arcblade: true, oathResonance: true, astralBlades: true, oathAegis: true, bladeOrbit: true, ascendantForm: true, finalVerdict: true,
    spearCrush: true, spearBreak: true, spearHeart: true, spearBoss: true,
    shieldBash: true, shieldSweep: true, ironGuard: true, battleCry: true,
    spiritsword: true, scatter: true, hawkeye: true, gale: true, deadeye: true }, hpOn: true, hp: 50, mpOn: true, mp: 30 };
  let cfg = { ...DEF, skills: { ...DEF.skills } };
  try { const s = JSON.parse(localStorage.getItem('botCfg') || 'null'); if (s) cfg = { ...cfg, ...s, skills: { ...cfg.skills, ...(s.skills || {}) } }; } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem('botCfg', JSON.stringify(cfg)); } catch (e) { /* storage blocked */ } };
  BOT.cfg = () => cfg;

  // ------------------------------------------------------------ panel
  function render() {
    const lvl = (G.stats && G.stats.lvl) || 1;
    $('botRadius').value = cfg.radius; $('botRadiusV').textContent = cfg.radius;
    $('botBasic').checked = cfg.basic;
    $('botHpOn').checked = cfg.hpOn; $('botHp').value = cfg.hp; $('botHpV').textContent = cfg.hp + '%';
    $('botMpOn').checked = cfg.mpOn; $('botMp').value = cfg.mp; $('botMpV').textContent = cfg.mp + '%';
    $('botSkills').innerHTML = skillsOf().map((s) => {
      const lock = lvl < s.lvl || !learned(s.id);
      const why = lvl < s.lvl ? `Lv.${s.lvl}` : 'ยังไม่เรียน';
      return `<label class="bot-sk${lock ? ' locked' : ''}"${lock ? ` title="${why}"` : ''}>` +
        `<input type="checkbox" data-sk="${s.id}" ${cfg.skills[s.id] ? 'checked' : ''} ${lock ? 'disabled' : ''}>` +
        (keyOf(s) === '–' ? '<span class="k none" title="ยังไม่ได้ตั้งปุ่มบนแถบสกิล (บอทยังใช้ได้)">·</span>' : `<span class="k">${keyOf(s)}</span>`) + ` ${s.name}${lock ? ` <small>${why}</small>` : ''}</label>`;
    }).join('');
    status();
  }
  function status() {
    const b = $('botToggle');
    b.textContent = BOT.on ? '■ หยุดบอท' : '▶ เริ่มบอท (ล่าที่นี่)';
    b.classList.toggle('on', BOT.on);
    $('botBtn').classList.toggle('on', BOT.on);
    const s = $('botStatus');
    s.classList.toggle('hidden', !BOT.on);
    if (BOT.on) s.innerHTML = `🤖 บอทล่าอัตโนมัติ · รัศมี ${cfg.radius} <b>หยุด</b>`;
  }
  BOT.toggle = function (force) {
    const p = $('botPanel'), open = force !== undefined ? !!force : p.classList.contains('hidden');
    p.classList.toggle('hidden', !open);
    if (open) render();
  };
  // at = the spot to hunt round (back from บอทพับจอ after the connection dropped: main.js join), else here
  BOT.start = function (at) {
    const me = G.me;
    if (!me || me.dead) return;
    if (window.FOLLOW && FOLLOW.on) FOLLOW.stop();
    BOT.on = true; BOT.anchor = at ? { x: at.x, y: at.y } : { x: me.x, y: me.y }; BOT.mapId = G.mapId; BOT.manualUntil = 0;
    HUD.toast(at ? 'บอทพับจอ: ล่าต่อที่จุดเดิม' : `เริ่มบอท: ล่ามอนสเตอร์ในรัศมี ${cfg.radius} รอบจุดนี้`);
    status();
  };
  BOT.stop = function (why) {
    if (!BOT.on) return;
    BOT.on = false;
    if (BOT.away) { BOT.away = false; G.socket.emit('botAway', { on: false }); }
    if (G.order && G.order.bot) G.order = null;
    if (why) HUD.toast(why);
    status();
  };
  // the player steers (keys / joystick / ground click): the bot waits a moment
  BOT.manual = (ms = 2500) => { if (BOT.on) BOT.manualUntil = performance.now() + ms; };

  function bind() {
    const p = $('botPanel');
    p.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('close')) return BOT.toggle(false);
      if (b.id === 'botToggle') { if (BOT.on) BOT.stop('หยุดบอทแล้ว'); else BOT.start(); }
    });
    p.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'botRadius') { cfg.radius = +t.value; $('botRadiusV').textContent = cfg.radius; }
      else if (t.id === 'botHp') { cfg.hp = +t.value; $('botHpV').textContent = cfg.hp + '%'; }
      else if (t.id === 'botMp') { cfg.mp = +t.value; $('botMpV').textContent = cfg.mp + '%'; }
      else if (t.id === 'botBasic') cfg.basic = t.checked;
      else if (t.id === 'botHpOn') cfg.hpOn = t.checked;
      else if (t.id === 'botMpOn') cfg.mpOn = t.checked;
      else if (t.dataset.sk) cfg.skills[t.dataset.sk] = t.checked;
      save(); status();
    });
    $('botBtn').addEventListener('click', () => BOT.toggle());
    $('botStatus').addEventListener('click', () => BOT.stop('หยุดบอทแล้ว'));
  }

  // ------------------------------------------------------------ brain
  const skillDef = C.ALL_SKILLS;
  function ready(id) {
    const st = G.stats, sk = skillDef[id];
    return sk && st.lvl >= sk.lvl && learned(id) && st.mp >= C.skillMp(sk, st.lvl) && HUD.cdLeft(id) <= 0 && HUD.cdLeft('gcd') <= 0;
  }
  let nextThink = 0, nextMove = 0;
  BOT.tick = function (now) {
    if (!BOT.on || BOT.away) return;
    const me = G.me, st = G.stats, A = BOT.api;
    if (!me || !st || !A) return;
    if (me.dead) return BOT.stop('ตัวละครตาย · บอทหยุดทำงาน');
    if (G.mapLoading) return;
    if (G.mapId !== BOT.mapId) return BOT.stop('เปลี่ยนแผนที่ · บอทหยุดทำงาน');
    BOT.potions();                                           // potions first (they work while the player steers too)
    if (AscendedSkills.active(me, now)) return;
    if (now < BOT.manualUntil || now < nextThink) return;
    nextThink = now + 110;
    const R = cfg.radius, an = BOT.anchor;
    const inArea = (e, pad = 0) => Math.hypot(e.x - an.x, e.y - an.y) <= R + pad;
    // keep the current target while it stays in the area; otherwise the nearest (edge to edge, A.gapTo), a monster
    // already hitting me winning only against one about as near (within 150)
    let t = A.targetEnt();
    if (t && (t.kind !== 'm' || !inArea(t, 80))) t = null;
    if (!t) {
      let best = null, bd = Infinity;
      for (const e of G.ents.values()) {
        if (e.kind !== 'm' || !A.isFoe(e) || !inArea(e)) continue;
        const d = A.gapTo(e) - (e.aggro ? 150 : 0);
        if (d < bd) { bd = d; best = e; }
      }
      t = best;
      if (t) A.setTarget(t, true);
    }
    if (!t) {
      // nothing to fight: walk back to the spot
      if (Math.hypot(me.x - an.x, me.y - an.y) > 60 && now > nextMove) {
        nextMove = now + 600;
        A.orderMove(an.x, an.y, 'move');
        if (G.order) G.order.bot = true;
      }
      return;
    }
    BOT.fight(t, now);
  };
  // HP / MP potions under the set percentages (the bot, and following the party leader: follow.js)
  // comes from the bag now (INV.useKind), so this is a no-op once the matching potion runs out.
  // Runs every frame (called before BOT.tick's own throttle), so it MUST check the item's own cooldown
  // (HUD.cds['pot_hp']/['pot_mp'], set by the server's 'cast' event on a successful use) itself — otherwise,
  // before the server's heal reaches back to update G.stats.hp, this fires again every frame and spams
  // rejected useItem requests (seen as the potion appearing to fire twice in a row).
  BOT.potions = function () {
    const st = G.stats;
    if (cfg.hpOn && st.hp < st.mhp * cfg.hp / 100 && HUD.cdLeft('pot_hp') <= 0) INV.useKind('hp');
    if (cfg.mpOn && st.mp < st.mmp * cfg.mp / 100 && HUD.cdLeft('pot_mp') <= 0) INV.useKind('mp');
  };
  // one think step against target t with the bot's settings: the first ticked skill that is ready and in reach,
  // then the basic attack (or, skills only, close in to cast)
  BOT.fight = function (t, now) {
    const me = G.me, st = G.stats, A = BOT.api;
    const d = Math.hypot(t.x - me.x, t.y - me.y) - A.radiusOf(t);
    // skills: the first ticked one that is ready and in reach
    const mine = new Set(skillsOf().map((s) => s.id));
    const picked = PRIORITY.filter((id) => mine.has(id) && cfg.skills[id] && st.lvl >= skillDef[id].lvl);
    // heals only when someone in the party (or me) is hurt
    const hurt = st.hp < st.mhp * 0.7 || (window.PARTY && PARTY.list.some((m) => !m.dead && m.map === G.mapId && m.hp < m.mhp * 0.6));
    for (const id of picked) {
      if (HEALS.includes(id) && !hurt) continue;
      if (skillDef[id].arbiter && C.BUFF_SKILLS.includes(id) &&
          (d > 320 || (st.bf || []).some(b => b[0] === id && b[1] > 0))) continue;
      if (d <= RANGE[id] && ready(id)) { G.useSlot(id); break; }
    }
    if (cfg.basic) {
      if (!G.order || G.order.type !== 'attack' || G.order.id !== t.id) G.order = { type: 'attack', id: t.id, bot: true };
    } else if (picked.length) {
      // skills only: close in to the shortest ticked reach, then stand and cast
      const reach = Math.min(...picked.map((id) => RANGE[id]).filter((r) => r < 9999), 330) * 0.75;
      if (d > reach) { if (now > nextMove) { nextMove = now + 350; A.orderMove(t.x, t.y, 'move'); if (G.order) G.order.bot = true; } }
      else if (G.order && G.order.bot) G.order = null;
    }
  };

  // บอทพับจอ: a hidden page (window minimised, phone screen off / app switched) is throttled or stopped by the
  // browser, so the server hunts in its place with these settings until the page is back (server onBotAway).
  // If the connection drops meanwhile the character stays in the world; logging back in carries on (BOT.start(at)).
  BOT.away = false;
  function handOver() {
    if (document.hidden && BOT.on && !BOT.away && G.socket) {
      BOT.away = true;
      if (G.order && G.order.bot) G.order = null;
      const mine = new Set(skillsOf().map((s) => s.id));
      // arbiter buffs only once a fight is near (BOT.fight)
      const skills = PRIORITY.filter((id) => mine.has(id) && cfg.skills[id]).map((id) =>
        [id, skillDef[id].arbiter && C.BUFF_SKILLS.includes(id) ? Math.min(RANGE[id] || 0, 320) : RANGE[id] || 0, HEALS.includes(id)]);
      G.socket.emit('botAway', { on: true, x: BOT.anchor.x, y: BOT.anchor.y, r: cfg.radius, basic: cfg.basic, skills,
        hpOn: cfg.hpOn, hp: cfg.hp, mpOn: cfg.mpOn, mp: cfg.mp });
    } else if (!document.hidden && BOT.away) {
      BOT.away = false;
      G.socket.emit('botAway', { on: false });              // the server hands the character back (a 'correct')
    }
  }
  document.addEventListener('visibilitychange', handOver);

  // radius ring on the ground round the bot's spot
  BOT.drawWorld = function (g, t) {
    if (!BOT.on || !BOT.anchor) return;
    const { x, y } = BOT.anchor;
    g.save();
    g.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2);
    g.strokeStyle = '#7cff8a'; g.lineWidth = 2; g.setLineDash([12, 10]);
    g.beginPath(); g.arc(x, y, cfg.radius, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]); g.globalAlpha = 0.6; g.fillStyle = '#7cff8a';
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    g.restore();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
