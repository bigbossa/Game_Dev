// Client core: loading, login, networking, input, prediction, rendering.
(function () {
  const TILE = C.TILE;
  const Motion = CharacterMotion;
  // character sprite scale in the world; LOOK_K scales the auras / rings / tags drawn around it
  // (they were tuned for the old 0.5 scale)
  const PLAYER_SCALE = 0.46;
  // monsters are drawn this much larger than their world size (hit areas / name tags follow; the server's
  // ranges and radii stay as they are)
  const MON_SCALE = 1.2;
  const monH = (type) => MonsterArt.heightOf(type) * MON_SCALE;
  const LOOK_K = PLAYER_SCALE / 0.5;
  const PH = Math.round(100 * LOOK_K), PH_HIT = Math.round(80 * LOOK_K); // name-tag height / hit-box height
  // Every class is drawn as tall as the ทวน (the reference): each sheet was drawn at its own size, so the shorter
  // ones are scaled up round the feet (measured head-to-feet on the standing frames, both factions, Lv.1 and Lv.130).
  const CLASS_K = { spearman: 1, taoist: 1.13, archer: 1.37, dualblade: 1.38 };
  const sizeK = (e) => (e && e.kind !== 'm' && CLASS_K[e.cls || 'dualblade']) || 1;
  const SKILL = C.ALL_SKILLS;
  const ATK_DUR = { fang: 300, spin: 420, rend: 430, lotus: 660, shadowstep: 300, tempest: 2700, crescent: 380, skyfall: 520, thousand: 1060, twindragon: 640,
    jade: 340, skybolt: 520, mercy: 620, aegis: 620, heavens: 800, spiritsword: 420, might: 620, meteor: 700, nirvana: 820,
    hawkshot: 330, scatter: 440, hawkeye: 520, gale: 520, skyrain: 880, deadeye: 520, rollshot: 380, blast: 520, stormphoenix: 720 };
  // ground-aimed skills: rank => [max range, area radius] (server/world.js castSkill)
  const AIM_HINT = {
    finalVerdict: () => [280, 145],
    ...Object.fromEntries(Object.values(SKILL).filter(s=>s.ritual).map(s=>[s.id,()=>[s.ritual.range,s.ritual.radius]])),
    skyfall: (r) => [280, r ? 175 : 150], heavens: (r) => [380, [190, 230, 270][r]], meteor: (r) => [400, r ? 220 : 170],
    skyrain: (r) => [340, [170, 215, 260][r]], blast: (r) => [420, r ? 220 : 170], skybolt: (r) => [380, r ? 170 : 120],
  };
  const NO_ARMOR = [0, 0, 0, 0];
  const NO_GEAR = [0, 0, 0, 0, 0];

  const G = (window.G = { ents: new Map(), myId: null, me: null, stats: null, map: null, mapId: null, mapDef: null });
  // phones / tablets: joystick, round skill buttons, compact HUD (body.touch in style.css)
  G.touch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  if (G.touch) document.body.classList.add('touch');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let DPR = 1, VW = 0, VH = 0, zoom = 1;
  const cam = { x: 0, y: 0 };
  let SPR = null, TAO = null;   // TAO = นักพรต frame meta (assets/taoist.json): { walk: {faction: meta}, attack: {...} }
  // classes drawn from their own sheets (C.CLASSES[cls].sheet): frame meta by class, same shape as TAO
  const OWN = {};
  const ownMeta = (cls) => OWN[cls] || null;
  const IMG = {};

  // ------------------------------------------------------------ boot
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function boot() {
    resize();
    SPR = await fetch('assets/sprites.json').then((r) => r.json());
    // AI-drawn monster sheets (optional, tools/build-monsters.js)
    MonsterArt.setSprites(await fetch('assets/monsters/index.json?v=village-monsters-v2').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
    // Load the replacement model directly; old bodies/masks must never re-enter this renderer.
    const weapMeta = await DualbladeModel.load(loadImg, IMG, SPR);
    await WarriorLook.load(loadImg);
    await ArbiterLook.load(loadImg);
    if (document.fonts && document.fonts.load) { try { await document.fonts.load('600 16px Kanit'); } catch (e) { /* font optional */ } }
    // level looks (hair / crown / wings / halo / horns) are measured on the ธรรมะ sheets; the อธรรม walk is its own
    // drawing (แผ่นออกแบบตัวละครฝ่ายอธรรม.png) and gets its own analysis
    ModelTiers.analyse('walk', IMG.dharma, SPR);
    if (SPR.adharmaWalk) ModelTiers.analyse('walk-adharma', IMG.adharma, SPR);
    if (SPR.attack) ModelTiers.analyse('attack', IMG['dharma-attack'], SPR.attack);
    DualbladeModel.register();
    // นักพรต: own sheets per faction, analysed for the level looks (hair, crowns, wings, halo / horns)
    try {
      TAO = await fetch('assets/taoist-v2/taoist.json').then((r) => r.json());
      TaoistGear.register(TAO);
      for (const f of ['dharma', 'adharma']) {
        IMG[`taoist-${f}`] = await loadImg(`assets/taoist-v2/taoist-${f}.png`);
        // armour recolour masks (optional: without them armour only changes stats)
        for (const k of [`tao-walk-${f}`, `tao-attack-${f}`]) for (const n of [`armor-${k}`, `armor2-${k}`]) { try { IMG[n] = await loadImg(`assets/taoist-v2/${n}.png`); } catch (e) { /* optional */ } }
        ModelTiers.analyse(ModelTiers.key(f, false, 'taoist'), IMG[`taoist-${f}`], TAO.walk[f]);
        if (TAO.attack[f]) {
          IMG[`taoist-${f}-attack`] = await loadImg(`assets/taoist-v2/taoist-${f}-attack.png`);
          TaoistPose.prepare(f, IMG, TAO);
          ModelTiers.analyse(ModelTiers.key(f, true, 'taoist'), IMG[`taoist-${f}-attack`], TAO.attack[f]);
        }
      }
      if (window.ItemArt && ItemArt.loadClassIcons) await ItemArt.loadClassIcons('taoist');
    } catch (e) { console.warn('ไม่พบสไปรต์นักพรต (npm run taoist)', e); TAO = null; }
    if (TAO) OWN.taoist = TAO;
    // นักธนู (and any later class with its own sheets): walk + attack sheets per faction, analysed for the level looks
    for (const c of Object.values(C.CLASSES)) {
      if (!c.sheet || c.id === 'taoist') continue;
      try {
        if(c.id==='archer'){
          const M=await ArcherModel.load(loadImg,IMG);
          for(const f of ['dharma','adharma'])for(const atk of [false,true]){
            ModelTiers.analyse(ModelTiers.key(f,atk,'archer'),IMG['archer-'+f+(atk?'-attack':'')],M[atk?'attack':'walk'][f]);
            ArcherModel.register(f,atk);
          }
          OWN.archer=M;continue;
        }
        const M = await fetch(`assets/${c.sheet}.json`).then((r) => r.json());
        const darkSpearMeta=c.id==='spearman'?await fetch('assets/adharma-hair/spearman.json').then(r=>{if(!r.ok)throw Error('Missing dark spear hair metadata');return r.json();}):null;
        if(darkSpearMeta){M.walk.adharma=darkSpearMeta.walk.adharma;M.attack.adharma=darkSpearMeta.attack.adharma;}
        for (const f of ['dharma', 'adharma']) {
          const artRoot=c.id==='spearman'&&f==='adharma'?'assets/adharma-hair':'assets';
          IMG[`${c.sheet}-${f}`] = await loadImg(`${artRoot}/${c.sheet}-${f}.png`);
          if (M.attack[f]) {
            IMG[`${c.sheet}-${f}-attack`] = await loadImg(`${artRoot}/${c.sheet}-${f}-attack.png`);
          }
          if (c.id === 'archer') ArcherGear.prepare(f, IMG, M);
          if (c.id === 'archer') ArcherPose.prepare(f, M);
          if (c.id === 'archer') ArcherRoyal.prepare(f, IMG, M);
          if (c.id === 'spearman') {
            const [icon,walk,attack]=await Promise.all([loadImg(`assets/spearman-${f}-weapon.png`),loadImg(`${artRoot}/spearman-${f}-short.png`),loadImg(`${artRoot}/spearman-${f}-short-attack.png`)]);
            const variants={};
            if(f==='adharma'){
              variants.short={walk,attack};variants.long={walk:IMG['spearman-'+f],attack:IMG['spearman-'+f+'-attack']};
              await Promise.all(['medium','royal'].map(async style=>{
                const [walk,attack]=await Promise.all([loadImg(`${artRoot}/spearman-${f}-${style}.png`),loadImg(`${artRoot}/spearman-${f}-${style}-attack.png`)]);
                variants[style]={walk,attack};
              }));
            }
            SpearmanLook.prepare(f,icon,M,walk,attack,variants,f==='adharma'?darkSpearMeta:{});
          }
          ModelTiers.analyse(ModelTiers.key(f, false, c.id), IMG[`${c.sheet}-${f}`], M.walk[f]);
          if (M.attack[f]) ModelTiers.analyse(ModelTiers.key(f, true, c.id), IMG[`${c.sheet}-${f}-attack`], M.attack[f]);
        }
        OWN[c.id] = M;
      } catch (e) { console.warn(`ไม่พบสไปรต์${c.name} (npm run ${c.sheet})`, e); }
    }
    WeaponLook.init(IMG, SPR);
    for (const [cls, M] of Object.entries(OWN)) WeaponLook.setClassPoints(cls, M);   // where the weapon sparks come from
    if (weapMeta) WeaponLook.initArt(weapMeta);
    ArmorLook.init(IMG);
    Art.buildProps();
    await VillageArt.load(loadImg);
    await loadMap(C.START_MAP);                    // login backdrop; the character's own map loads on join
    $('loading').classList.add('hidden');
    initLogin();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ maps
  // terrain of each map is fetched once and kept; switching maps swaps G.map and rebuilds the caches
  const mapCache = {};
  const dec = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  async function loadMap(id) {
    if (!mapCache[id]) mapCache[id] = await fetch(`/api/map/${id}`).then((r) => r.json());
    const d = mapCache[id];
    G.mapId = id;
    G.mapDef = C.MAPS[id];
    G.map = { id, w: d.w, h: d.h, tiles: dec(d.tiles), solid: dec(d.solid), objects: d.objects };
    Art.setMap(G.mapDef);
    chunkCache.clear();
    indexProps();
    G.minimapBase = Art.renderMinimap(G.map);
    HUD.setMap(G.mapDef);
  }

  // ------------------------------------------------------------ props index
  const PCH = Art.CHUNK * TILE;
  let propChunks = [], PCW = 0, sigil = null;
  function indexProps() {
    sigil = null;
    PCW = Math.ceil(G.map.w / Art.CHUNK);
    const PCH_N = Math.ceil(G.map.h / Art.CHUNK);
    propChunks = Array.from({ length: PCW * PCH_N }, () => []);
    for (const o of G.map.objects) {
      if (o[0] === 'sigil') { sigil = { x: o[2], y: o[3] }; continue; }
      const sp = Art.propSprite(o);
      if (!sp) continue;
      const p = { kind: 'prop', x: o[2], y: o[3], sp };
      const cx = Math.min(PCW - 1, Math.floor(p.x / PCH)), cy = Math.min(PCH_N - 1, Math.floor(p.y / PCH));
      propChunks[cy * PCW + cx].push(p);
    }
  }

  // ------------------------------------------------------------ socket
  const socket = io();
  G.socket = socket;
  socket.on('connect_error', () => { $('loginMsg').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; });
  socket.on('disconnect', () => {
    if (G.myId) { HUD.toast('ขาดการเชื่อมต่อจากเซิร์ฟเวอร์ — กำลังโหลดใหม่...'); setTimeout(() => location.reload(), 2500); }
  });

  socket.on('snap', (s) => {
    if (!G.myId || G.mapLoading || (s.mid && s.mid !== G.mapId)) return;
    const receivedAt = performance.now();
    const seen = new Set();
    for (const a of s.p) {
      const [id, x, y, dir, mv, hp, mhp, fi, name, lvl, dead, , wt, ar, wp, gg, wg, ci, gp, pk, ev, hs, arb] = a;
      let e = G.ents.get(id);
      if (!e) { e = { kind: 'p', id, x, y, tx: x, ty: y, dir, animT: 0, flash: 0 }; G.ents.set(id, e); }
      if (id !== G.myId && !e.leap) {
        Motion.snapshot(e, x, y, !!mv, receivedAt, dir);
      }
      Object.assign(e, { hp, mhp, faction: fi ? 'adharma' : 'dharma', cls: C.CLASS_IDS[ci] || 'dualblade', name, lvl, dead: !!dead, wt: wt || 0, ar: ar || NO_ARMOR, wp: wp || 0, gg: gg || NO_GEAR, gr: gg ? Math.max(...gg) : 0, wg: wg || 0, gp: gp || NO_GEAR,
        pk: !!pk, ev: ev || 0, hs: !!hs, arbiterForm: !!arb?.[0], oathStacks: arb?.[1] || 0, astralBlades: !!arb?.[2] });
      if (!dead) e.dying = 0;
      seen.add(id);
    }
    for (const a of s.m) {
      const [id, ti, x, y, face, mv, hp, mhp, aggro, cast] = a;
      let e = G.ents.get(id);
      const type = C.MONSTER_TYPES[ti], def = C.MONSTERS[type];
      if (!e || e.dying) {
        e = { kind: 'm', id, type, x, y, tx: x, ty: y, flash: 0, seed: Math.random() * 10, name: def.name, lvl: def.lvl, boss: !!def.boss };
        G.ents.set(id, e);
      }
      const dir8 = Math.abs(x - e.tx) + Math.abs(y - e.ty) > 1.5 ? C.dirFromVec(x - e.tx, y - e.ty) : e.dir8;
      Motion.snapshot(e, x, y, !!mv, receivedAt, dir8, face);
      Object.assign(e, { hp, mhp, aggro: !!aggro, ours: aggro === 2 });   // ours: hitting me or my party (follow.js)
      if(cast&&e.monsterToken!==cast.token){FX.monsterSkill(cast);e.monsterToken=cast.token;e.castUntil=receivedAt+cast.d;}
      if(!cast)e.castUntil=0;
      seen.add(id);
    }
    for (const [id, e] of G.ents) if (!seen.has(id) && (e.kind === 'p' || !e.dying)) G.ents.delete(id);
    G.stats = s.me;
    syncControl(s.me.control);
    if (s.me.spd) G.speed = s.me.spd;
  });

  function syncControl(d) {
    const now = performance.now();
    G.control = { stunUntil: now + (d?.stun || 0), rootUntil: now + (d?.root || 0), slowUntil: now + (d?.slow || 0) };
    if (G.me && (d?.stun || d?.root)) {
      if(d?.stun || G.me.cls==='spearman' || G.me.cls==='warrior') SkillPerformance.cancel(G.me.id,undefined,!!(G.me.ritual||C.ALL_SKILLS[G.me.skillMotion?.skill]?.spear||C.ALL_SKILLS[G.me.skillMotion?.skill]?.frontline));
      G.me.moving = false; G.me.dash = null; G.me.leap = null;
      if (Number.isFinite(d.x) && Number.isFinite(d.y)) Motion.correction(G.me, d.x, d.y);
    }
  }
  socket.on('control', syncControl);
  socket.on('evade', (d) => {
    const e = G.ents.get(d.id);
    if (e) FX.text(e.x, e.y - PH_HIT * sizeK(e) * 0.75, 'หลบหลีก', '#b5eaff', 16);
  });
  socket.on('correct', (d) => { const me = G.me; if (me && !G.mapLoading) { Motion.correction(me, d.x, d.y); me.dash = null; } });
  // gate / teleport stone / GM warp: load the new map, keep only me
  socket.on('mapchange', async (d) => {
    const me = G.me;
    if (!me) return;
    G.mapLoading = true;
    SkillPerformance.clear();
    FX.list=FX.list.filter(f=>!f.monsterEffect && !f.arbiterEffect);
    syncControl(null);
    G.order = null; me.dash = null; me.atk = null;
    for (const id of [...G.ents.keys()]) if (id !== G.myId) G.ents.delete(id);
    INV.closeShop(); WARP.toggle(false);
    try { await loadMap(d.id); } catch (err) { console.error(err); HUD.toast('โหลดแผนที่ไม่สำเร็จ'); }
    me.x = me.tx = d.x; me.y = me.ty = d.y;
    Motion.reset(me);
    WMAP.refresh();
    cam.x = me.x; cam.y = me.y - 40;
    lastArea = ''; gateWait = performance.now() + 1500;
    G.mapLoading = false;
    FX.spawn(me.id, me.faction);
  });
  socket.on('cast', (d) => {
    HUD.setCd(d.id, d.cd);
    const sk = SKILL[d.id];
    if (sk && (sk.spear || sk.frontline || sk.arbiter)) { if (G.spearWait) G.spearWait[d.id] = 0; if (sk.key !== '1') HUD.setCd('gcd', C.GCD_MS); }
  });
  socket.on('gmreset', () => { HUD.cds = {}; });
  socket.on('gmmsg', (t) => GM.msg(String(t)));
  socket.on('gmmode', (on) => GM.init(on));       // /gmcode · /out
  socket.on('users', (list) => GM.setUsers(list));
  socket.on('who', (d) => WHO.setList(d));
  socket.on('inspect', (d) => WHO.setInspect(d));
  socket.on('rank', (d) => RANK.set(d));
  socket.on('fund', (d) => FUND.set(d));
  socket.on('stat', (d) => STATS.set(d));
  socket.on('skills', (d) => BOOK.set(d));
  socket.on('toast', (t) => HUD.toast(t));
  socket.on('chat', (m) => HUD.chat(m));
  socket.on('feed', (d) => HUD.feed(d));
  socket.on('score', (s) => HUD.score(s));
  socket.on('mm', (d) => { HUD.mm = d; HUD.online(d.on); });
  socket.on('party', (d) => PARTY.set(d));
  socket.on('storage', (d) => STORE.set(d));
  socket.on('partyInvite', (d) => PARTY.invite(d));
  socket.on('partyRequest', (d) => PARTY.request(d));
  socket.on('inv', (st) => {
    INV.set(st);
    if (G.me) { const w = C.ITEMS[st.eq.weapon] || C.WEAPONS[0]; G.me.wt = w.tier; G.me.wp = w.plus || 0; G.me.ar = C.armorTiers(st.eq); G.me.gg = C.gearGrades(st.eq); G.me.gr = C.gearGrade(st.eq); G.me.wg = w.grade || 0; G.me.gp = C.gearPlus(st.eq); }
  });
  socket.on('loot', (d) => {
    const me = G.me;
    if (!me) return;
    if (d.gold) FX.text(me.x - 30, me.y - 90, `+${d.gold} ทอง`, '#ffd23a', 15, { vy: -50, max: 1200 });
    if (d.sold) {                                          // auto-sell: the drop went straight to gold
      const it = C.ITEMS[d.sold], gr = C.GRADES[it.grade || 0];
      HUD.toast(`ขายอัตโนมัติ ${it.name} [${gr.name}] +${d.soldGold.toLocaleString()} ทอง`);
      FX.text(me.x + 20, me.y - 110, `ขาย ${it.name} +${d.soldGold}`, gr.color, 14, { vy: -40, max: 1500 });
    }
    if (d.item) {
      const it = C.ITEMS[d.item], gr = C.GRADES[it.grade || 0], col = gr.color;
      HUD.toast(`ได้รับ ${it.name} [${gr.name}]`);
      FX.text(me.x, me.y - 120, it.name, col, 18, { vy: -35, max: 2200 });
      FX.burst(me.x, me.y - 40, 30, [col, '#ffffff', '#ffe08a'], { speed: 160, up: 80, life: 900 });
    }
  });
  socket.on('exp', (v) => { const me = G.me; if (me) FX.text(me.x + 30, me.y - 70, `+${v} EXP`, '#ffd76a', 15, { vy: -45, max: 1100 }); });
  socket.on('dead', (d) => { if (G.me) { G.me.dead = true; G.me.dash = null; } G.order = null; HUD.death(d.by, d.t); });
  socket.on('respawned', (d) => {
    const me = G.me; if (!me) return;
    me.x = d.x; me.y = d.y; me.dead = false; me.dying = 0;
    Motion.reset(me);
    cam.x = me.x; cam.y = me.y;
    HUD.alive();
  });

  socket.on('hit', (d) => {
    const e = G.ents.get(d.id);
    if (!e) return;
    e.flash = 1;
    const h = e.kind === 'm' ? monH(e.type) : PH_HIT * sizeK(e);
    const yy = e.y - h * 0.55;
    const mine = d.id === G.myId;
    if (d.k !== 1) FX.hit(e.x, yy, null, !!d.c, d.s);
    let color = '#ffffff', size = 20, text = String(d.v);
    if (mine) { color = '#ff5a5a'; text = `-${d.v}`; }
    else if (d.k === 1) { color = '#ff6a8a'; size = 15; }
    else if (d.c) { color = '#ffd33a'; size = 28; text = `${d.v}!`; }
    if (d.k === 2) { color = '#ff9a3a'; size = 16; }
    FX.text(e.x, yy - 20, text, color, size);
    if (!mine && G.me && Math.hypot(e.x - G.me.x, e.y - G.me.y) < 500) G.lastTarget = { id: d.id, t: performance.now() };
  });
  socket.on('healed', (d) => {
    const e = G.ents.get(d.id);
    if (!e) return;
    FX.text(e.x, e.y - PH_HIT * sizeK(e) * 0.75, `+${d.v}`, '#7cff8a', 18);
  });
  socket.on('die', (d) => {
    const e = G.ents.get(d.id);
    if (!e) return;
    e.dying = performance.now();
    SkillPerformance.cancel(e.id);
    const col = e.kind === 'm' ? (e.boss ? '#ff4a3a' : '#e8f4ff') : C.FACTIONS[e.faction].color;
    FX.death(e.x, e.y, col);
    if (e.boss) FX.shake = 18;
  });
  socket.on('matk', (d) => {
    const m = G.ents.get(d.id), t = G.ents.get(d.tid);
    if (!m) return;
    m.atkT = performance.now();
    if (t) { m.face = t.x >= m.x ? 1 : -1; m.dir8 = C.dirFromVec(t.x - m.x, t.y - m.y); setTimeout(() => FX.claw(t.x, t.y - 34), 190); }
  });
  socket.on('fx', (d) => {
    const e = G.ents.get(d.id);
    if (d.t === 'arbiter') {
      if (d.mapId !== G.mapId) return;
      if (e && d.phase === 'windup') { startAtk(e, d.skill, d.a); e.atk.dur = d.dur + 200; }
      ArbiterLook.play(d); return;
    }
    SkillPerformance.play(d);
    if(d.t==='frontlineCancel'||d.t==='frontlineHit')return;
    if (C.ALL_SKILLS[d.t]?.frontline) {
      if (e) { startAtk(e, d.t, d.a); e.atk.dur = d.dur; }
      WarriorLook.play(d); return;
    }
    if(d.t==='monsterWindup'||d.t==='monsterRelease'||d.t==='monsterCancel'){if(d.mapId&&d.mapId!==G.mapId)return;FX.monsterSkill(d);if(e){e.monsterToken=d.token;e.castUntil=d.t==='monsterWindup'?performance.now()+d.d:0;if(d.t==='monsterRelease')e.atkT=performance.now();}return;}
    if (d.t === 'ritualStart' || d.t === 'ritualRelease' || d.t === 'ritualCancel') { AscendedSkills.play(d); return; }
    switch (d.t) {
      // class skills: the pose here, the art in SkillFX (skill-fx.js); moving skills also move the caster
      case 'fang': startAtk(e, d.c === 2 ? 'spin' : 'fang', d.a); SkillFX.play(d); break;
      case 'lotus': startAtk(e, 'lotus'); if (e && d.n > 3) e.atk.dur = 860; SkillFX.play(d); break;
      case 'tempest': startAtk(e, 'tempest'); if (e) e.atk.dur = 250 + d.n * d.g; SkillFX.play(d); break;
      case 'skyfall':
        // jump arc: every client (including mine) moves the jumper from x0,y0 to x1,y1 over 460 ms
        if (e) { startAtk(e, 'skyfall', Math.atan2(d.y1 - d.y0, d.x1 - d.x0)); e.leap = { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, t0: performance.now(), dur: 460 }; }
        if (d.id === G.myId && G.me) { G.me.dash = null; G.order = null; }
        SkillFX.play(d);
        break;
      case 'shadowstep': case 'twindragon': case 'rollshot': {
        const dur = { shadowstep: 150, twindragon: 220, rollshot: 260 }[d.t];
        startAtk(e, d.t, d.a);
        SkillFX.play(d);
        if (d.id === G.myId && G.me) G.me.dash = { x0: G.me.x, y0: G.me.y, x1: d.x1, y1: d.y1, t0: performance.now(), dur };
        else if (e) { e.x = e.tx = d.x1; e.y = e.ty = d.y1; }
        break;
      }
      case 'rend': case 'crescent': case 'thousand': case 'jade': case 'spiritsword': case 'hawkshot': case 'scatter':
      case 'spearThrust': case 'spearCrush': case 'spearChain': case 'spearBreak': case 'spearExecution':
      case 'spearHeart': case 'spearPin': case 'spearBoss': case 'spearHeaven':
        startAtk(e, d.t, d.a);
        if (e && e.atk && C.ALL_SKILLS[d.t]?.spear) Object.assign(e.atk, { dur: d.dur, delay: d.delay, gap: d.g, hits: d.n, beats:d.beats });
        SkillFX.play(d); break;
      case 'spearBeat': SpearmanFX.impact(d); break;
      case 'spearCancel':
        if(e?.atk?.kind===d.skill)e.atk=null;
        SpearmanFX.cancel(d.id,d.skill);break;
      case 'deadeye': case 'blast': case 'stormphoenix':
        startAtk(e, d.t, d.a); SkillFX.play(d); break;
      case 'skybolt': case 'heavens': case 'meteor': case 'skyrain':
        if (e) startAtk(e, d.t, Math.atan2(d.y - e.y, d.x - e.x)); SkillFX.play(d); break;
      case 'mercy': case 'aegis': case 'might': case 'nirvana': case 'hawkeye': case 'gale':
        startAtk(e, d.t); SkillFX.play(d); break;
      case 'equip':
        if (e) { e.wt = d.wt; if (d.ar) e.ar = d.ar; if (d.wp !== undefined) e.wp = d.wp; if (d.gg) { e.gg = d.gg; e.gr = Math.max(...d.gg); } if (d.wg !== undefined) e.wg = d.wg; if (d.gp) e.gp = d.gp; }
        FX.equip(d.id, d.f, d.slot);
        break;
      case 'enh': FX.enhance(d.id, d.f, d.ok, d.plus, d.broke); break;
      case 'bolt': // Legendary passive "อสนีพิโรธ": a lightning strike on the target
        FX.bolt(d.x + (Math.random() - 0.5) * 40, d.y - 300, d.x, d.y - 20, '#ffffff', d.f === 'adharma' ? '#ff4a6a' : '#7ac8ff');
        FX.burst(d.x, d.y - 20, 18, ['#ffffff', '#ffe08a', d.f === 'adharma' ? '#ff4a6a' : '#7ac8ff'], { speed: 180, up: 60, life: 500 });
        break;
      case 'heal': FX.heal(d.id, d.k); break;
      case 'cover': FX.cover(d.id, d.to); break;
      case 'lvl': {
        FX.levelUp(d.id, d.f);
        const was = e ? ModelTiers.tierOf(e.lvl || 1) : 0, now = ModelTiers.tierOf(d.lvl);
        if (e) e.lvl = d.lvl;
        if (d.id === G.myId) {
          HUD.toast(`เลเวลอัพ! ตอนนี้ Lv.${d.lvl}`);
          BOOK.refresh();
          if (d.lvl % 10 === 0 && d.lvl / 10 <= 13) { // every 10 levels: a new martial stage (stance + skill)
            HUD.toast(`บรรลุขั้นวิชาที่ ${d.lvl / 10}: ${C.STANCES[d.lvl / 10]} · กด K ดูคัมภีร์วิชา`);
            if (e) FX.text(e.x, e.y - 150, `ขั้นวิชา ${d.lvl / 10}`, '#9fe8ff', 26, { max: 2200, vy: -30 });
          }
        }
        if (now > was) {                                    // new look unlocked
          FX.equip(d.id, d.f);
          if (d.id === G.myId) HUD.toast(`ปลดล็อกลักษณะใหม่: ${ModelTiers.nameOf(now, d.f || (e && e.faction), e && e.cls)} (ทรงผมและออร่าเปลี่ยน)`);
        }
        break;
      }
      case 'spawn': FX.spawn(d.id, d.f); break;
      case 'tele': FX.tele(d.x, d.y, d.r, d.d); break;
      case 'slam': FX.slam(d.x, d.y, d.r); break;
      case 'mspawn': FX.burst(d.x, d.y - 20, 18, ['#ffffff', '#cfe6ff', '#bbbbbb'], { speed: 80, up: 40, life: 700 }); break;
    }
  });

  function startAtk(e, kind, a) {
    if (!e) return;
    const dir = a !== undefined ? C.dirFromAngle(a) : e.dir;
    e.atk = { kind, t0: performance.now(), dir, a: a !== undefined ? a : (dir * Math.PI) / 4, dur: ATK_DUR[kind] };
    e.dir = dir;
  }

  // ------------------------------------------------------------ login
  // 1) log in / sign up (server/accounts.js) → 2) pick a character of the account → 3) or make a new one
  // the browser keeps a remember-me token (da_token), so a reload goes straight to the character list
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage optional */ } },
  };
  const msg = (text, ok) => { $('loginMsg').textContent = text || ''; $('loginMsg').classList.toggle('ok', !!ok); };
  const showStep = (id) => ['authStep', 'charStep', 'createStep'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
  let acct = null;                                 // { user, chars, max } of the logged-in account

  function enterGame(data, btn) {
    if (btn) btn.disabled = true;
    msg('');
    socket.emit('join', data, async (res) => {
      if (!res || !res.ok) {
        if (btn) btn.disabled = false;
        if (res && res.auth) { store.set('da_token', null); showStep('authStep'); }
        msg((res && res.msg) || 'เข้าเกมไม่สำเร็จ');
        return;
      }
      store.set('da_name', res.me.name);
      store.set('da_cls', res.me.cls);
      try { if (res.map && res.map !== G.mapId) await loadMap(res.map); } catch (err) { console.error(err); }
      if (btn) btn.disabled = false;
      startGame(res);
    });
  }

  function showChars(state) {
    Object.assign(acct, state);
    $('acctName').textContent = acct.user;
    $('charCount').textContent = `(${acct.chars.length}/${acct.max})`;
    $('newCharBtn').disabled = acct.chars.length >= acct.max;
    const list = $('charList');
    list.textContent = '';
    if (!acct.chars.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'ยังไม่มีตัวละคร — สร้างตัวใหม่ หรือผูกตัวละครเดิมด้านล่าง';
      list.appendChild(e);
    }
    const last = (store.get('da_name') || '').toLowerCase();
    for (const c of acct.chars) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `char-card ${c.faction}` + (c.name.toLowerCase() === last ? ' last' : '');
      const map = C.MAPS[c.map];
      b.innerHTML = '<span class="cn"></span><span class="ci"></span>' + (c.online ? '<span class="on">● กำลังออนไลน์</span>' : '');
      b.querySelector('.cn').textContent = c.name;
      b.querySelector('.ci').textContent = `Lv.${c.lvl} · ${(C.CLASSES[c.cls] || C.CLASSES.dualblade).name} · ฝ่าย${C.FACTIONS[c.faction].name}` + (map ? ` · ${map.name}` : '');
      b.addEventListener('click', () => enterGame({ name: c.name }, b));
      const w = document.createElement('div');
      w.className = 'char-wrap';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'char-del';
      del.title = 'ลบตัวละคร';
      del.textContent = '🗑';
      del.disabled = !!c.online;
      del.addEventListener('click', () => askDelete(c.name));
      w.append(b, del);
      list.appendChild(w);
    }
    $('delBox').classList.add('hidden');
    showStep('charStep');
  }
  // 🗑 on a card: confirm with the account password, the server deletes and sends the new list
  let delName = '';
  function askDelete(name) {
    delName = name;
    $('delName').textContent = name;
    $('delPass').value = '';
    $('delBox').classList.remove('hidden');
    $('delPass').focus();
    msg('');
  }
  function doDelete() {
    const pass = $('delPass').value;
    if (!pass) return msg('กรุณาใส่รหัสผ่าน');
    $('delOk').disabled = true;
    socket.emit('delChar', { name: delName, pass }, (res) => {
      $('delOk').disabled = false;
      if (!res || !res.ok) {
        if (res && res.auth) { store.set('da_token', null); showStep('authStep'); }
        return msg((res && res.msg) || 'ลบตัวละครไม่สำเร็จ');
      }
      if ((store.get('da_name') || '').toLowerCase() === delName.toLowerCase()) store.set('da_name', null);
      showChars(res);
      msg(res.msg, true);
    });
  }

  function loggedIn(res) {
    store.set('da_token', res.token);
    acct = { user: res.user };
    showChars(res);
    msg(res.note || '', true);
  }

  function initLogin() {
    // show/hide password: toggles the paired input's type, works for every .pw-eye on the page
    document.querySelectorAll('.pw-eye').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = $(btn.dataset.for);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
        btn.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
      });
    });
    // ---- step 1: log in / sign up
    let mode = 'login';
    const setMode = (m) => {
      mode = m;
      document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('selected', t.dataset.mode === m));
      $('pass2Wrap').classList.toggle('hidden', m !== 'register');
      $('passInput').autocomplete = m === 'register' ? 'new-password' : 'current-password';
      $('authBtn').textContent = m === 'register' ? 'สมัครบัญชี' : 'เข้าสู่ระบบ';
      msg('');
    };
    document.querySelectorAll('.auth-tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    const auth = () => {
      const user = $('userInput').value.trim(), pass = $('passInput').value;
      if (user.length < 2) return msg('กรุณาใส่ชื่อบัญชี');
      if (!pass) return msg('กรุณาใส่รหัสผ่าน');
      if (mode === 'register' && pass !== $('pass2Input').value) return msg('ยืนยันรหัสผ่านไม่ตรงกัน');
      $('authBtn').disabled = true;
      msg('');
      socket.emit('auth', { mode, user, pass }, (res) => {
        $('authBtn').disabled = false;
        if (!res || !res.ok) return msg((res && res.msg) || 'เข้าสู่ระบบไม่สำเร็จ');
        $('passInput').value = $('pass2Input').value = '';
        store.set('da_user', res.user);
        loggedIn(res);
      });
    };
    $('authBtn').addEventListener('click', auth);
    [$('userInput'), $('passInput'), $('pass2Input')].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') auth(); }));
    $('userInput').value = store.get('da_user') || '';

    // ---- step 2: character list, claim an old character, password, log out
    $('newCharBtn').addEventListener('click', () => { msg(''); showStep('createStep'); $('nameInput').focus(); });
    $('backBtn').addEventListener('click', () => { msg(''); showStep('charStep'); });
    const claim = () => {
      const name = $('claimInput').value.trim();
      if (name.length < 2) return msg('กรุณาใส่ชื่อตัวละครเดิม');
      $('claimBtn').disabled = true;
      socket.emit('claim', { name }, (res) => {
        $('claimBtn').disabled = false;
        if (!res || !res.ok) return msg((res && res.msg) || 'ผูกตัวละครไม่สำเร็จ');
        $('claimInput').value = '';
        showChars(res);
        msg(res.msg, true);
      });
    };
    $('claimBtn').addEventListener('click', claim);
    $('delOk').addEventListener('click', doDelete);
    $('delPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doDelete(); });
    $('delCancel').addEventListener('click', () => { $('delBox').classList.add('hidden'); $('delPass').value = ''; });
    $('claimInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') claim(); });
    $('pwToggle').addEventListener('click', () => $('pwBox').classList.toggle('hidden'));
    $('pwBtn').addEventListener('click', () => {
      $('pwBtn').disabled = true;
      socket.emit('password', { old: $('pwOld').value, pass: $('pwNew').value }, (res) => {
        $('pwBtn').disabled = false;
        if (!res || !res.ok) return msg((res && res.msg) || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
        store.set('da_token', res.token);
        $('pwOld').value = $('pwNew').value = '';
        $('pwBox').classList.add('hidden');
        msg(res.msg, true);
      });
    });
    $('logoutBtn').addEventListener('click', () => {
      socket.emit('logout', {}, () => {});
      store.set('da_token', null);
      acct = null;
      setMode('login');
      showStep('authStep');
      $('passInput').focus();
    });

    initCreate();

    // remember-me: a saved token skips step 1
    const token = store.get('da_token');
    if (token) {
      showStep('');
      socket.emit('auth', { mode: 'token', token }, (res) => {
        if (res && res.ok) return loggedIn(res);
        store.set('da_token', null);
        showStep('authStep');
        if (res && !res.expired) msg(res.msg);
        $('passInput').focus();
      });
    } else {
      showStep('authStep');
      ($('userInput').value ? $('passInput') : $('userInput')).focus();
    }
  }

  // ---- step 3: a new character (faction, class, name)
  function initCreate() {
    let faction = 'dharma', cls = 'dualblade';
    // a class drawn from its own sheets can only be picked once they are built (npm run taoist / archer)
    const ready = (c) => !C.CLASSES[c].sheet || !!ownMeta(c);
    try { const c = localStorage.getItem('da_cls'); if (C.CLASSES[c] && ready(c)) cls = c; } catch (e) { /* storage optional */ }
    // the faction cards show the chosen class
    const showCls = () => {
      const c = C.CLASSES[cls];
      $('clsDesc').textContent = `${c.name}: ${c.desc}`;
      document.querySelectorAll('.cls[data-c]').forEach((x) => x.classList.toggle('selected', x.dataset.c === cls));
      const pre = C.CLASSES[cls].sheet ? C.CLASSES[cls].sheet + '-' : '';
      document.querySelectorAll('.fcard').forEach((x) => { x.querySelector('img').src = pre==='archer-'&&ArcherModel.ready?ArcherModel.portrait(x.dataset.f):!pre && DualbladeModel.ready ? DualbladeModel.portrait(x.dataset.f) : `assets/${pre==='spearman-'&&x.dataset.f==='adharma'?'adharma-hair/':''}${pre}${x.dataset.f}-portrait.png`; });
      if (cls === 'warrior') document.querySelectorAll('.fcard').forEach(x => { x.querySelector('img').src = WarriorLook.portrait(x.dataset.f); });
      if (cls === 'arbiter') document.querySelectorAll('.fcard').forEach(x => { x.querySelector('img').src = ArbiterLook.portrait(x.dataset.f); });
      if (cls === 'taoist') document.querySelectorAll('.fcard').forEach(x => { x.querySelector('img').src = `assets/taoist-v2/taoist-${x.dataset.f}-portrait.png`; });
    };
    document.querySelectorAll('.cls[data-c]').forEach((b) => {
      if (!ready(b.dataset.c)) { b.disabled = true; b.classList.add('locked'); return; }
      b.addEventListener('click', () => { cls = b.dataset.c; showCls(); });
    });
    showCls();
    document.querySelectorAll('.fcard').forEach((b) => b.addEventListener('click', () => {
      faction = b.dataset.f;
      document.querySelectorAll('.fcard').forEach((x) => x.classList.toggle('selected', x === b));
    }));
    const play = () => {
      const name = $('nameInput').value.trim();
      if (name.length < 2) return msg('กรุณาใส่ชื่อตัวละครอย่างน้อย 2 ตัวอักษร');
      enterGame({ create: 1, name, faction, cls }, $('playBtn'));
    };
    $('playBtn').addEventListener('click', play);
    $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  }

  function startGame(res) {
    const m = res.me;
    G.myId = res.id;
    G.speed = m.speed;
    // the character's class: its skills on 1-9, weapon names / icons, basic-attack reach
    G.cls = C.CLASSES[m.cls] ? m.cls : 'dualblade';
    const CL = C.CLASSES[G.cls];
    if (CL.sheet && !ownMeta(G.cls)) HUD.toast(`ยังไม่มีสไปรต์${CL.name} — สั่ง npm run ${CL.sheet} แล้วรีเฟรช`);
    C.setViewClass(G.cls);
    // shop tabs follow the class's slot names (นักพรต: ชุดคลุม / ข้อมือ / ผ้าคลุมไหล่)
    document.querySelectorAll('#shopTabs [data-tab]').forEach((b) => { const n = C.SLOT_NAMES[b.dataset.tab]; if (n && b.dataset.tab !== 'weapon') b.textContent = n; });
    G.skl = null;
    G.rebuildKeys();
    const me = { kind: 'p', id: m.id, x: m.x, y: m.y, tx: m.x, ty: m.y, dir: 2, animT: 0, flash: 0, faction: m.faction, cls: G.cls, name: m.name, lvl: m.lvl, hp: m.hp, mhp: m.mhp };
    Motion.reset(me);
    G.me = me;
    G.ents.set(me.id, me);
    G.stats = m;
    cam.x = me.x; cam.y = me.y;
    $('login').classList.add('hidden');
    HUD.init(m);
    HUD.score(res.score);
    INV.init(m.faction);
    GM.init(res.gm);
    STATS.set(res.st);
    BOOK.set(res.skl);
    if (res.inv) {
      INV.set(res.inv);
      me.wt = (C.ITEMS[res.inv.eq.weapon] || C.WEAPONS[0]).tier;
      me.wp = (C.ITEMS[res.inv.eq.weapon] || C.WEAPONS[0]).plus || 0;
      me.gp = C.gearPlus(res.inv.eq);
      me.ar = C.armorTiers(res.inv.eq);
      me.gg = C.gearGrades(res.inv.eq);
      me.gr = C.gearGrade(res.inv.eq);
      me.wg = (C.ITEMS[res.inv.eq.weapon] || C.WEAPONS[0]).grade || 0;
    } else HUD.toast('เซิร์ฟเวอร์ยังเป็นเวอร์ชันเก่า — กรุณารีสตาร์ทเซิร์ฟเวอร์เพื่อใช้ระบบไอเทม');
    HUD.update(m);
    if (res.note) HUD.toast(res.note);
    HUD.chat({ sys: 1, t: `ยินดีต้อนรับสู่ยุทธภพ ${m.name}! กด H เพื่อดูวิธีเล่น` });
    HUD.chat({ sys: 1, t: `แผนที่ล่ามอนสเตอร์ใช้ร่วมกันทั้งสองฝ่าย · สู้กับฝ่ายตรงข้ามได้เมื่อเปิดสถานะ PvP (⚔ หรือ U · Lv.${C.PK.minLvl}+) ฆ่าผู้เล่นนอกสนามรบ แต้มชั่วร้าย -${C.PK.evilPerKill} · ไปสนามรบธรรมะ-อธรรมได้ที่ศิลาเคลื่อนย้ายในค่าย` });
    canvas.focus();
  }

  // ------------------------------------------------------------ input
  const keys = new Set();
  let mouse = { x: 0, y: 0, down: false };
  const chatInput = $('chatInput');
  // any focused text field (chat, GM inputs) swallows game keys
  const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'); };
  addEventListener('keydown', (e) => {
    if (!G.myId) return;
    if (document.activeElement === chatInput) {
      if (e.key === 'Enter') {
        const t = chatInput.value.trim();
        // /gm opens the GM panel; it is handled here and never sent, so it never shows in the chat
        if (/^\/gm(\s|$)/i.test(t)) { if (GM.enabled) GM.toggle(true); else HUD.toast('ไม่รู้จักคำสั่งนี้'); }
        else if (/^\/user(\s|$)/i.test(t)) { if (GM.enabled) GM.users(true); else HUD.toast('ไม่รู้จักคำสั่งนี้'); }
        else if (t) socket.emit('chat', HUD.takeLink(t));                // a shared item: { text with {i}, item }
        chatInput.value = ''; chatInput.blur();
      } else if (e.key === 'Escape') chatInput.blur();
      return;
    }
    if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (e.key === 'Enter') { if (HUD.chatHidden()) HUD.setChat(true); chatInput.focus(); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === ' ' || k === 'tab') e.preventDefault();
    if (e.repeat) return;
    // number slots: 1 = basic attack on the selected target, 2-9 = skills (aimed at the selected target)
    const slot = SLOT_KEYS[k];
    if (slot === basicId()) attackTarget();
    else if (slot) G.useSlot(slot);
    else if (k === ' ') attackTarget();
    else if (k === 'tab') cycleTarget();
    else if (k === '=' || k === '+') zoomBy(1.15);
    else if (k === '-' || k === '_') zoomBy(1 / 1.15);
    else if (k === 'k') BOOK.toggle();
    else if (k === 'c') STATS.toggle();
    else if (k === 'o') BOT.toggle();
    else if (k === 'q') G.useSlot('pot_hp');
    else if (k === 'e') G.useSlot('pot_mp');
    else if (k === 'h') $('help').classList.toggle('hidden');
    else if (k === 'i' || k === 'b') INV.toggle();
    else if (k === 'f') interact();
    else if (k === 'm') WMAP.toggle();
    else if (k === 'p') WHO.toggle();
    else if (k === 'r') RANK.toggle();
    else if (k === 'g') FUND.toggle();
    else if (k === 'u') HUD.togglePk();
    else if (k === 'l') HUD.toggleChat();
    else if (k === 'escape') { INV.closeAll(); GM.toggle(false); WARP.toggle(false); BOOK.toggle(false); STATS.toggle(false); GM.users(false); BOT.toggle(false); WMAP.toggle(false); RANK.toggle(false); FUND.toggle(false); PARTY.closeMenu(); setTarget(null); }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; joyEnd({ pointerId: joy.id }); });
  function interact() {
    if (nearSmith()) { if (INV.shopOpen) INV.closeAll(); else INV.openShop(); }
    else if (nearApothecary()) { if (INV.potionShopOpen) INV.closeAll(); else INV.openPotionShop(); }
    else if (nearEnhancer()) { if (INV.enhShopOpen) INV.closeAll(); else INV.openEnhShop(); }
    else if (nearStone()) WARP.toggle();
  }
  // pointer events cover mouse, pen and touch: tap = click, hold and drag = walk toward the finger
  let canvasPointer = null;
  // phones: two fingers on the game screen pinch-zoom the camera (same range as the mouse wheel). While pinching,
  // and until the fingers are lifted, taps do not walk or select.
  const touches = new Map();
  let pinchDist = 0, pinching = false;
  const fingerGap = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinching && touches.size >= 2) { const d = fingerGap(); zoomBy(d / pinchDist); pinchDist = d; return; }
    }
    if (pinching) return;
    if (canvasPointer === null || e.pointerId === canvasPointer) { mouse.x = e.clientX; mouse.y = e.clientY; }
  });
  const fingerUp = (e) => {
    if (!touches.delete(e.pointerId)) return;
    if (touches.size < 2) pinchDist = 0;
    if (!touches.size) pinching = false;
  };
  addEventListener('pointerup', fingerUp);
  addEventListener('pointercancel', fingerUp);
  // click = select a target (attacks come from the number slots) · click the ground = walk there
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) {                       // second finger: pinch instead of the first finger's tap
        pinching = true; pinchDist = fingerGap();
        canvasPointer = null; mouse.down = false;
        if (G.order && G.order.type === 'move' && performance.now() - G.order.t < 400) G.order = null;
        return;
      }
      if (pinching) return;                          // a finger left over from a pinch
    }
    canvasPointer = e.pointerId;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.down = true;
    if (typing()) document.activeElement.blur();
    const me = G.me;
    if (!me || me.dead) return;
    const foe = enemyUnderMouse();
    if (foe) { mouse.down = false; setTarget(foe); return; }
    const ally = allyUnderMouse();
    if (ally) { mouse.down = false; PARTY.menu(ally, e.clientX, e.clientY); return; }
    BOT.manual(3000);                                       // walking by hand: the bot waits
    FOLLOW.manual(3000);
    const w = mouseWorld();
    if (smithUnderMouse(w)) { const s = smithPos(); orderMove(s.x, s.y + 46, 'interact'); return; }
    if (apothecaryUnderMouse(w)) { const s = apothecaryPos(); orderMove(s.x, s.y + 46, 'potionshop'); return; }
    if (enhancerUnderMouse(w)) { const s = enhancerPos(); orderMove(s.x, s.y + 46, 'enhshop'); return; }
    if (stoneUnderMouse(w)) { const s = stonePos(); orderMove(s.x, s.y + 44, 'stone'); return; }
    orderMove(w.x, w.y, 'move');
    FX.clickMark(w.x, w.y, '#7cff8a');
  });
  addEventListener('pointerup', (e) => { if (e.pointerId === canvasPointer) { canvasPointer = null; mouse.down = false; } });
  // mouse wheel: zoom the camera in / out (kept between sessions)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0015));
  }, { passive: false });
  addEventListener('pointercancel', (e) => { if (e.pointerId === canvasPointer) { canvasPointer = null; mouse.down = false; } });
  $('interactHint').addEventListener('click', () => interact());
  $('minimap').addEventListener('click', () => WMAP.toggle(true));
  $('bookBtn').addEventListener('click', () => BOOK.toggle());
  $('chatBtn').addEventListener('click', () => {
    const c = $('chat'), open = !c.classList.contains('open');
    if (open && HUD.chatHidden()) HUD.setChat(true);
    c.classList.toggle('open', open);
    if (open) chatInput.focus(); else chatInput.blur();
  });

  // ------------------------------------------------------------ touch: virtual joystick (bottom left)
  const joy = { id: null, x: 0, y: 0 };
  const joyEl = $('joy'), knob = $('joyKnob');
  function joyMove(e) {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2, max = R * 0.62;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const L = Math.hypot(dx, dy);
    if (L > max) { dx = (dx / L) * max; dy = (dy / L) * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const live = Math.min(1, L / max) > 0.18;                  // dead zone
    joy.x = live ? dx / max : 0; joy.y = live ? dy / max : 0;
  }
  function joyEnd(e) { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
  joyEl.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
  joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e); });
  joyEl.addEventListener('pointerup', joyEnd);
  joyEl.addEventListener('pointercancel', joyEnd);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $('helpBtn').addEventListener('click', () => $('help').classList.toggle('hidden'));
  $('help').querySelector('.help-close').addEventListener('click', () => $('help').classList.add('hidden'));

  // ------------------------------------------------------------ touch: fullscreen (⛶)
  // Fullscreen API (Android Chrome / iPad); iPhone Safari has none → hint to add the game to the home screen
  // (manifest.webmanifest display: fullscreen). The choice is remembered and re-applied on the next tap,
  // because browsers only allow fullscreen from a user gesture.
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) document.body.classList.add('standalone');
  let fsWant = false;
  try { fsWant = localStorage.getItem('fullscreen') === '1'; } catch (e) { /* storage blocked */ }
  function fsEnter() {
    const d = document.documentElement;
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen();
    if (p && p.catch) p.catch(() => {});
  }
  function fsExit() {
    const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen && document.webkitExitFullscreen();
    if (p && p.catch) p.catch(() => {});
  }
  function fsRemember(on) {
    fsWant = on;
    try { localStorage.setItem('fullscreen', on ? '1' : '0'); } catch (e) { /* storage blocked */ }
  }
  $('fsBtn').addEventListener('click', () => {
    if (!fsOk) { HUD.toast('เบราว์เซอร์นี้เต็มจอไม่ได้ · กด แชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดเกมจากไอคอน'); return; }
    if (fsEl()) { fsRemember(false); fsExit(); } else { fsRemember(true); fsEnter(); }
  });
  function fsChange() { $('fsBtn').classList.toggle('on', !!fsEl()); resize(); }
  document.addEventListener('fullscreenchange', fsChange);
  document.addEventListener('webkitfullscreenchange', fsChange);
  // back to fullscreen on the first tap after a reload, if the player turned it on (once per page load, so
  // leaving with the phone's back gesture is not undone on every tap)
  if (G.touch && fsOk && !standalone && fsWant) {
    const again = (e) => {
      if (e.target && e.target.id === 'fsBtn') return;
      removeEventListener('pointerup', again, true);
      if (!fsEl()) fsEnter();
    };
    addEventListener('pointerup', again, true);
  }
  $('bagBtn').addEventListener('click', () => INV.toggle());
  // เปลี่ยนตัวละคร: leave this character (same cleanup as closing the tab) and go back to the character list,
  // keeping the login session — reloading is the simplest safe way to reset every bit of game/HUD state at once
  $('switchCharBtn').addEventListener('click', () => {
    if (!confirm('ออกจากตัวละครนี้เพื่อเปลี่ยนตัวละคร?')) return;
    socket.emit('leaveChar', {}, (res) => { if (res && res.ok) location.reload(); });
  });
  // blacksmith, apothecary (ร้านขายยา), enhancement shop (ร้านตีบวก) + teleport stone of the current map (own base on the PvP map)
  const smithPos = () => C.smithOf(G.mapDef, G.me.faction);
  const apothecaryPos = () => C.apothecaryOf(G.mapDef, G.me.faction);
  const enhancerPos = () => C.enhancerOf(G.mapDef, G.me.faction);
  const stonePos = () => C.stoneOf(G.mapDef, G.me.faction);
  function nearSmith() {
    const me = G.me;
    if (!me || me.dead || G.mapLoading) return false;
    const s = smithPos();
    return Math.hypot(me.x - s.x, me.y - s.y) < 170;
  }
  function nearApothecary() {
    const me = G.me;
    if (!me || me.dead || G.mapLoading) return false;
    const s = apothecaryPos();
    return Math.hypot(me.x - s.x, me.y - s.y) < 170;
  }
  function nearEnhancer() {
    const me = G.me;
    if (!me || me.dead || G.mapLoading) return false;
    const s = enhancerPos();
    return Math.hypot(me.x - s.x, me.y - s.y) < 170;
  }
  G.nearCamp = () => nearSmith() || nearApothecary() || nearEnhancer() || nearStone();          // storage (storage.js)
  function nearStone() {
    const me = G.me;
    if (!me || me.dead || G.mapLoading) return false;
    const s = stonePos();
    return Math.hypot(me.x - s.x, me.y - s.y) < 170;
  }
  // F prompt near the blacksmith / apothecary / teleport stone; walking away closes their panels
  let hintShown = '';
  function updateInteract() {
    const near = nearSmith() ? 'smith' : nearApothecary() ? 'apothecary' : nearEnhancer() ? 'enhancer' : nearStone() ? 'stone' : '';
    if (near !== hintShown) {
      $('interactHint').classList.toggle('hidden', !near);
      $('interactHint').innerHTML = near === 'stone' ? 'กด <b>F</b> เพื่อใช้ศิลาเคลื่อนย้าย'
        : near === 'apothecary' ? 'กด <b>F</b> เพื่อเปิดร้านขายยา' : near === 'enhancer' ? 'กด <b>F</b> เพื่อเปิดร้านตีบวก' : 'กด <b>F</b> เพื่อเปิดร้านช่างตีดาบ';
      hintShown = near;
    }
    if (near !== 'smith' && INV.shopOpen) INV.closeShop();
    if (near !== 'apothecary' && INV.potionShopOpen) INV.closePotionShop();
    if (near !== 'enhancer' && INV.enhShopOpen) INV.closeEnhShop();
    if (near !== 'stone' && WARP.open) WARP.toggle(false);
    if (!near && STORE.open) STORE.toggle(false);
  }
  // walking into a gate asks the server to move to the next / previous map
  let gateWait = 0;
  function checkGates(now) {
    const me = G.me, gates = G.mapDef && G.mapDef.gates;
    if (!gates || me.dead || G.mapLoading || now < gateWait) return;
    gates.forEach((g, i) => {
      if (Math.hypot(me.x - g.x, me.y - g.y) > 60) return;
      socket.emit('gate', i);
      gateWait = now + 1500;
      G.order = null;
    });
  }
  $('respawnBtn').addEventListener('click', () => socket.emit('respawn'));

  const mouseWorld = () => ({ x: cam.x + (mouse.x - VW / 2) / zoom, y: cam.y + (mouse.y - VH / 2) / zoom });
  G.toScreen = (x, y) => ({ x: (x - cam.x) * zoom + VW / 2, y: (y - cam.y) * zoom + VH / 2 });
  const aimAngle = () => { const w = mouseWorld(), me = G.me; return Math.atan2(w.y - (me.y - 30), w.x - me.x); };

  // ------------------------------------------------------------ click orders
  // players are foes when the server says I may hit them (World.canPk): the other faction on the PvP map, or field
  // PvP on the hunting maps (my PvP switched on, or hitting back at someone who attacked me)
  const isFoe = (e) => e && !e.dead && !e.dying && e !== G.me && (e.kind === 'm' || !!e.hs);
  const radiusOf = (e) => (e.kind === 'm' ? C.MONSTERS[e.type].radius : 16);
  // ------------------------------------------------------------ selected target (click / Tab), attacked with the number slots
  const SLOT_KEYS = Object.fromEntries(C.CLASSES.dualblade.skills.map((s) => [s.key, s.id]));   // replaced at login (G.cls)
  // keys 1-9 follow the player's own skill-bar layout (G.skl.bar), else each skill's default key
  G.rebuildKeys = function () {
    for (const k of Object.keys(SLOT_KEYS)) delete SLOT_KEYS[k];
    const skills = C.CLASSES[G.cls || 'dualblade'].skills;
    const bar = (G.skl && G.skl.bar) || skills.map((sk) => sk.id);
    C.BAR_KEYS.forEach((k, i) => { if (bar[i]) SLOT_KEYS[k] = bar[i]; });
  };
  G.target = null;
  const targetEnt = () => { const t = G.target && G.ents.get(G.target); return isFoe(t) ? t : null; };
  function setTarget(e, quiet) {
    const id = e ? e.id : null;
    if (id !== G.target && G.order && G.order.type === 'attack' && G.order.id !== id) G.order = null;   // stop hitting the old one
    G.target = id;
    if (e) { if (!quiet) FX.clickMark(e.x, e.y, '#ff4a3a'); G.lastTarget = { id, t: performance.now() }; }
  }
  // basic attack (slot 1 / Space): walk to the selected target and keep slashing it; no target = the nearest enemy
  function attackTarget() {
    const me = G.me;
    if (!me || me.dead) return;
    let t = targetEnt();
    if (!t) { t = nearestFoe(G.touch ? 520 : 460); if (t) setTarget(t); }
    if (t) { if (!G.order || G.order.type !== 'attack' || G.order.id !== t.id) G.order = { type: 'attack', id: t.id }; return; }
    if (!G.touch) { const w = mouseWorld(); G.useSlot(basicId(), { a: aimAngle(), tx: w.x, ty: w.y }); }   // nothing near: slash toward the cursor
    else G.useSlot(basicId());
  }
  // Tab: the next enemy by distance (nearest first, then further ones)
  function cycleTarget() {
    const me = G.me;
    if (!me) return;
    const list = [...G.ents.values()].filter((e) => isFoe(e) && Math.hypot(e.x - me.x, e.y - me.y) < 700)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    if (!list.length) return;
    const i = list.findIndex((e) => e.id === G.target);
    setTarget(list[(i + 1) % list.length]);
  }
  function enemyUnderMouse() {
    const w = mouseWorld();
    let best = null, bd = Infinity;
    for (const e of G.ents.values()) {
      if (!isFoe(e)) continue;
      const h = e.kind === 'm' ? monH(e.type) : PH_HIT * sizeK(e);
      // generous hit box: from the feet to the top of the sprite
      const pad = G.touch ? 18 : 0;
      const rx = Math.max(26, radiusOf(e) * (e.kind === 'm' ? MON_SCALE : 1) + 10) + pad;
      if (Math.abs(w.x - e.x) > rx || w.y > e.y + 14 + pad || w.y < e.y - h - 6 - pad) continue;
      const d = Math.hypot(w.x - e.x, w.y - (e.y - h / 2));
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // another player who is not a foe (click = party menu)
  function allyUnderMouse() {
    const w = mouseWorld(), pad = G.touch ? 18 : 0;
    for (const e of G.ents.values()) {
      if (e.kind !== 'p' || e === G.me || e.dead || isFoe(e)) continue;
      if (Math.abs(w.x - e.x) <= 26 * sizeK(e) + pad && w.y <= e.y + 14 + pad && w.y >= e.y - PH_HIT * sizeK(e) - 6 - pad) return e;
    }
    return null;
  }
  function smithUnderMouse(w) {
    const s = G.me && smithPos();
    return s && Math.abs(w.x - s.x) < 72 && w.y < s.y + 12 && w.y > s.y - 140;
  }
  function apothecaryUnderMouse(w) {
    const s = G.me && apothecaryPos();
    return s && Math.abs(w.x - s.x) < 72 && w.y < s.y + 12 && w.y > s.y - 140;
  }
  function enhancerUnderMouse(w) {
    const s = G.me && enhancerPos();
    return s && Math.abs(w.x - s.x) < 72 && w.y < s.y + 12 && w.y > s.y - 140;
  }
  function stoneUnderMouse(w) {
    const s = G.me && stonePos();
    return s && Math.abs(w.x - s.x) < 40 && w.y < s.y + 30 && w.y > s.y - 110;
  }
  // helpers for the auto-hunt bot (bot.js)
  BOT.api = { isFoe, radiusOf, targetEnt: () => targetEnt(), setTarget: (e, q) => setTarget(e, q), orderMove: (x, y, type) => orderMove(x, y, type) };
  function orderMove(x, y, type) {
    const me = G.me;
    const path = PF.find(G.map, me.x, me.y, x, y);
    if (!path) { G.order = null; return; }
    G.order = { type, gx: x, gy: y, path, t: performance.now(), stuck: 0 };
  }
  // world map / party frame: walk to any point of the current map (search the whole grid, the bot stops)
  G.travelTo = function (x, y, label) {
    const me = G.me;
    if (!me || me.dead || G.mapLoading) return false;
    const path = PF.find(G.map, me.x, me.y, x, y, G.map.w * G.map.h);
    if (!path) { HUD.toast('ไม่มีทางเดินไปจุดนั้น'); return false; }
    if (BOT.on) BOT.stop('หยุดบอท: เดินทางตามแผนที่');
    if (FOLLOW.on) FOLLOW.stop('หยุดติดตาม: เดินทางตามแผนที่');
    G.order = { type: 'travel', gx: x, gy: y, path, t: performance.now(), stuck: 0, label };
    FX.clickMark(x, y, '#7cff8a');
    if (label) HUD.toast(`กำลังเดินไป ${label}`);
    return true;
  };
  // walk along o.path; returns true when the end is reached
  function followPath(o, dt) {
    const me = G.me;
    if (!o.path || !o.path.length) { me.moving = false; return true; }
    const [wx, wy] = o.path[0];
    const dx = wx - me.x, dy = wy - me.y, L = Math.hypot(dx, dy);
    const step = G.speed * dt * C.combatMoveScale(G.cls, !!me.atk, G.control, performance.now());
    const ox = me.x, oy = me.y;
    if (L <= step) {
      if (C.canStand(G.map, wx, wy)) { me.x = wx; me.y = wy; }
      o.path.shift();
    } else {
      const nx = me.x + (dx / L) * step, ny = me.y + (dy / L) * step;
      if (C.canStand(G.map, nx, ny)) { me.x = nx; me.y = ny; }
      else if (C.canStand(G.map, nx, me.y)) me.x = nx;
      else if (C.canStand(G.map, me.x, ny)) me.y = ny;
    }
    const moved = Math.hypot(me.x - ox, me.y - oy);
    o.stuck = moved < step * 0.2 ? (o.stuck || 0) + dt : 0;
    if (o.stuck > 0.3) {                                      // blocked: ask for a new path, give up after a few tries
      o.path = null; o.stuck = 0; o.retries = (o.retries || 0) + 1;
      if (o.retries > 3) G.order = null;
    }
    if (moved > 0.01) { me.moving = true; if (!me.atk) me.dir = C.dirFromVec(me.x - ox, me.y - oy); }
    return !!o.path && o.path.length === 0;
  }
  function runOrder(dt, now) {
    const me = G.me, o = G.order;
    me.moving = false;
    if (o.type === 'attack') {
      const t = G.ents.get(o.id);
      if (!isFoe(t)) { G.order = null; return; }
      const r = radiusOf(t), ty = t.y - r * 0.4;
      const d = Math.hypot(t.x - me.x, ty - (me.y - 18));
      const pend = o.skill && SKILL[o.skill];                // a skill pressed while out of reach (ทวน)
      if (pend ? inSpearReach(t, pend) : d <= C.basicReach(G.cls, G.stats?.lvl || 1) + r * 0.6) {
        const a = Math.atan2(ty - (me.y - 18), t.x - me.x);
        if (!me.atk) me.dir = C.dirFromAngle(a);
        if (pend) { o.skill = null; G.useSlot(pend.id, { a, tx: t.x, ty: t.y, tid: t.id }); }
        else G.useSlot(basicId(), { a, tx: t.x, ty: t.y, tid: t.id });
        o.path = null;
        return;
      }
      if (!o.path || now - (o.pathT || 0) > 350 || Math.hypot(t.x - o.gx, t.y - o.gy) > 40) {
        o.path = PF.find(G.map, me.x, me.y, t.x, t.y);
        o.pathT = now; o.gx = t.x; o.gy = t.y;
        if (!o.path) { G.order = null; return; }
      }
      followPath(o, dt);
      return;
    }
    // move / interact; holding the button keeps steering toward the cursor
    if (o.type === 'move' && mouse.down && now - o.t > 180) {
      const w = mouseWorld();
      if (Math.hypot(w.x - o.gx, w.y - o.gy) > 24) orderMove(w.x, w.y, 'move');
      else o.t = now;
      if (!G.order) return;
    }
    const cur = G.order;
    if (!cur.path) {
      cur.path = PF.find(G.map, me.x, me.y, cur.gx, cur.gy, cur.type === 'travel' ? G.map.w * G.map.h : undefined);
      if (!cur.path) { G.order = null; return; }
    }
    const done = followPath(cur, dt);
    if (done && G.order === cur) {
      if (cur.type === 'travel' && cur.label) HUD.toast(`ถึง ${cur.label} แล้ว`);
      if (cur.type === 'interact' && nearSmith()) INV.openShop();
      if (cur.type === 'potionshop' && nearApothecary()) INV.openPotionShop();
      if (cur.type === 'enhshop' && nearEnhancer()) INV.openEnhShop();
      if (cur.type === 'stone' && nearStone()) WARP.toggle(true);
      G.order = null;
    }
  }
  function nearestFoe(range) {
    let best = null, bd = range;
    for (const e of G.ents.values()) {
      if (!isFoe(e)) continue;
      const d = Math.hypot(e.x - G.me.x, e.y - G.me.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // skills aim at the attack target when there is one, otherwise at the cursor
  // (touch: the nearest enemy, or straight ahead)
  function aimFor() {
    const me = G.me, o = G.order;
    let t = targetEnt() || (o && o.type === 'attack' ? G.ents.get(o.id) : null);
    if (!isFoe(t) && G.touch) t = nearestFoe(460);
    if (isFoe(t)) return { a: Math.atan2(t.y - radiusOf(t) * 0.4 - (me.y - 18), t.x - me.x), tx: t.x, ty: t.y, tid: t.id };
    if (G.touch) { const a = (me.dir * Math.PI) / 4; return { a, tx: me.x + Math.cos(a) * 200, ty: me.y + Math.sin(a) * 200 }; }
    const w = mouseWorld();
    return { a: aimAngle(), tx: w.x, ty: w.y };
  }

  // skill-bar buttons; on touch the attack button locks onto the nearest enemy and keeps fighting it
  // the class's basic attack (key 1): ฟันคู่ / ยันต์อัคนี
  const basicId = () => C.basicOf(G.cls).id;
  G.pressSlot = function (id) {
    if (id === basicId()) return attackTarget();
    G.useSlot(id);
  };

  G.useSlot = function (id, aim) {
    const me = G.me, st = G.stats;
    if (!me || me.dead || !st) return;
    if (id === 'pot_hp' || id === 'pot_mp') {
      if (!(window.INV && INV.useKind(id === 'pot_hp' ? 'hp' : 'mp'))) HUD.toast(id === 'pot_hp' ? 'ไม่มียาฟื้นพลัง' : 'ไม่มียามานา');
      return;
    }
    const sk = SKILL[id];
    if (!sk || sk.passive || sk.cls !== (G.cls || 'dualblade') || AscendedSkills.active(me)) return;
    if (performance.now() < (G.control?.stunUntil || 0)) return;
    if (performance.now() < (G.control?.rootUntil || 0) && (sk.spear || sk.ritual || (sk.arbiter && !['ward','form'].includes(sk.arbiter.kind)) || C.MOVE_SKILLS.includes(id))) return;
    if (st.lvl < sk.lvl) { if (id !== basicId()) HUD.toast(`ต้องการเลเวล ${sk.lvl}`); return; }
    if (G.skl && !G.skl.sk[id]) { HUD.toast(`ยังไม่ได้เรียน ${sk.name} — กด K เพื่อใช้แต้มสกิล`); return; }
    if (HUD.cdLeft(id) > 0 || (id !== basicId() && HUD.cdLeft('gcd') > 0)) return;
    if (st.mp < C.skillMp(sk, st.lvl)) { HUD.toast('ปราณไม่พอ'); return; }
    // ทวน: every art needs one enemy in reach (the server refuses it otherwise). No enemy = nothing happens and no
    // cooldown; an enemy out of reach = walk up to it first (runOrder casts the skill on arrival).
    if ((sk.spear || (sk.frontline?.damage && !sk.frontline.area) || ['single', 'basic'].includes(sk.arbiter?.kind)) && !(aim && aim.tid)) {
      const t = spearTargetFor();
      if (!t) { if (id !== basicId()) HUD.toast('ไม่มีเป้าหมาย'); return; }
      if (!inSpearReach(t, sk)) { G.order = { type: 'attack', id: t.id, skill: id }; return; }
      aim = aimAtFoe(t);
    }
    if (sk.spear || sk.frontline || sk.ritual || sk.arbiter) {
      const wait = G.spearWait || (G.spearWait = {});        // one request in flight per skill
      if (performance.now() < (wait[id] || 0)) return;
      wait[id] = performance.now() + 350;
    }
    const t = aim || aimFor();
    socket.emit('skill', { id, a: t.a, tx: t.tx, ty: t.ty, tid: t.tid });
    if (C.MOVE_SKILLS.includes(id) && G.order && G.order.type !== 'attack') G.order = null; // moving skills replace a walk
    if (!sk.spear && !sk.frontline && !sk.ritual && !sk.arbiter) {
      HUD.setCd(id, id === basicId() ? C.basicCd(sk, (st.aspd || 0) / 100) : sk.cd);
      if (id !== basicId()) HUD.setCd('gcd', C.GCD_MS);
    }
    HUD.flashSlot(id);
  };
  // the enemy a spear art goes for: the selected one, the one being attacked, else the nearest (which becomes selected)
  function spearTargetFor() {
    const o = G.order;
    let t = targetEnt() || (o && o.type === 'attack' ? G.ents.get(o.id) : null);
    if (isFoe(t)) return t;
    t = nearestFoe(G.touch ? 520 : 460);
    if (t) setTarget(t);
    return t;
  }
  // same distance test as the server's slashTarget, a little short of it for movement between updates
  const spearGap = (t) => { const r = radiusOf(t); return Math.hypot(t.x - G.me.x, t.y - r * 0.4 - (G.me.y - 18)) - r; };
  const inSpearReach = (t, sk) => spearGap(t) <= (sk.id === 'oathBasic' ? C.basicReach(G.cls, G.stats?.lvl || 1) + 12 : (sk.spear || sk.frontline || sk.arbiter).range) - 12;
  const aimAtFoe = (t) => ({ a: Math.atan2(t.y - radiusOf(t) * 0.4 - (G.me.y - 18), t.x - G.me.x), tx: t.x, ty: t.y, tid: t.id });

  // ------------------------------------------------------------ simulation
  let lastSend = 0, lastSent = null;
  function updateMe(dt, now) {
    const me = G.me;
    if (!me) return;
    if (me.dead || G.mapLoading) { me.moving = false; return; }
    if (now < (G.control?.stunUntil || 0)) { me.moving = false; return; }
    if (me.leap) { me.moving = false; return; }          // position follows the jump arc (updateEnts)
    if (AscendedSkills.active(me, now)) { me.moving = false; return; }
    checkGates(now);
    if (me.dash) {
      const p = Math.min(1, (now - me.dash.t0) / me.dash.dur);
      me.x = me.dash.x0 + (me.dash.x1 - me.dash.x0) * p;
      me.y = me.dash.y0 + (me.dash.y1 - me.dash.y0) * p;
      if (p >= 1) me.dash = null;
      me.moving = false;
      return;
    }
    let dx = 0, dy = 0;
    if (!typing()) {
      if (keys.has('a') || keys.has('arrowleft')) dx--;
      if (keys.has('d') || keys.has('arrowright')) dx++;
      if (keys.has('w') || keys.has('arrowup')) dy--;
      if (keys.has('s') || keys.has('arrowdown')) dy++;
    }
    const stick = joy.x || joy.y;
    if (stick) { dx = joy.x; dy = joy.y; }
    if (dx || dy) {
      // keyboard / joystick movement overrides any click order (and makes the bot wait)
      G.order = null;
      BOT.manual(1500);
      FOLLOW.manual(1500);
      me.moving = true;
      const L = Math.hypot(dx, dy), sp = G.speed * dt * C.combatMoveScale(G.cls, !!me.atk, G.control, now) * (stick ? Math.min(1, Math.max(0.45, L * 1.25)) : 1);
      const nx = me.x + (dx / L) * sp, ny = me.y + (dy / L) * sp;
      const ox = me.x, oy = me.y;
      if (C.canStand(G.map, nx, me.y)) me.x = nx;
      if (C.canStand(G.map, me.x, ny)) me.y = ny;
      me.moving = Math.hypot(me.x - ox, me.y - oy) > .01;
      if (!me.atk) me.dir = C.dirFromVec(dx, dy);
    } else if (G.order) runOrder(dt, now);
    else me.moving = false;
    if (G.target && !targetEnt()) G.target = null;          // the selected target died / left
    // network
    if (now - lastSend > 50) {
      const cur = { x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, moving: me.moving ? 1 : 0 };
      const changed = !lastSent || cur.x !== lastSent.x || cur.y !== lastSent.y || cur.dir !== lastSent.dir || cur.moving !== lastSent.moving;
      if (changed || now - lastSend > 400) {
        socket.emit('input', cur);
        lastSent = cur; lastSend = now;
      }
    }
  }

  function updateEnts(dt, now) {
    for (const [id, e] of G.ents) {
      if (e.leap) {                                       // พยัคฆ์ทะยานฟ้า: glide along the jump, land on x1,y1
        const L = e.leap, p = Math.min(1, (now - L.t0) / L.dur);
        e.x = L.x0 + (L.x1 - L.x0) * p; e.y = L.y0 + (L.y1 - L.y0) * p;
        if (p >= 1) { e.x = e.tx = L.x1; e.y = e.ty = L.y1; e.leap = null; Motion.reset(e); if (e === G.me) FX.shake = Math.max(FX.shake, 6); }
      } else if (e !== G.me) Motion.remote(e, now);
      Motion.update(e, dt);
      e.flash = Math.max(0, e.flash - dt * 6);
      if (e.atk && now - e.atk.t0 > (e.atk.dur || ATK_DUR[e.atk.kind])) e.atk = null;
      if (e.dying && e.kind === 'm' && now - e.dying > 700) G.ents.delete(id);
    }
  }

  let lastArea = '';
  let areaCheck = 0;
  function checkArea(now) {
    const me = G.me, def = G.mapDef;
    if (!me || G.mapLoading || now - areaCheck < 400) return;
    areaCheck = now;
    const name = C.mapAreaName(def, me.x, me.y);
    if (G.mapId + name === lastArea) return;
    lastArea = G.mapId + name;
    let sub;
    if (def.pvp) {
      const base = C.baseAt(me.x, me.y);
      sub = 'เขตต่อสู้ PvP';
      if (base === me.faction) sub = 'เขตปลอดภัย · ฟื้นฟูพลังรวดเร็ว';
      else if (base) sub = 'อันตราย! พลังพิทักษ์ฐานศัตรูเผาผลาญผู้บุกรุก';
      else if (name === 'สนามรบกลาง') sub = 'ถิ่นของราชันมารโลหิต · เขต PvP';
    } else {
      const z = def.zones.find((q) => q.name === name);
      if (C.safeAt(def, me.x, me.y)) sub = 'เขตปลอดภัย · ฟื้นฟูพลังรวดเร็ว · ร้านช่างตีดาบ · ศิลาเคลื่อนย้าย';
      else if (z) sub = `${C.MONSTERS[z.type].boss ? 'บอส ' : 'มอนสเตอร์ '}Lv.${C.MONSTERS[z.type].lvl}`;
      else sub = `${C.levelText(def)} · แผนที่รวมทุกฝ่าย · PvP เมื่อเปิด ⚔`;
    }
    HUD.zone(name, sub);
  }

  // ------------------------------------------------------------ rendering
  function resize() {
    VW = innerWidth; VH = innerHeight;
    DPR = Motion.pixelRatio(window.devicePixelRatio, VW, VH);
    canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    baseZoom = Math.max(0.6, Math.min(1.35, Math.min(VH / 780, VW / 900)));
    zoom = baseZoom * zoomMul;
  }
  // wheel / +/- zoom on top of the window fit: 0.55x (see more) .. 1.8x (closer), never below 0.42 overall
  let baseZoom = 1, zoomMul = 1, zoomGoal = 1;
  try { const z = +localStorage.getItem('zoomMul'); if (z >= 0.55 && z <= 1.8) zoomMul = zoomGoal = z; } catch (e) { /* storage blocked */ }
  function zoomBy(f) {
    zoomGoal = Math.max(Math.max(0.55, 0.42 / baseZoom), Math.min(1.8, zoomGoal * f));
    try { localStorage.setItem('zoomMul', zoomGoal.toFixed(3)); } catch (e) { /* storage blocked */ }
  }
  function easeZoom(dt) {
    if (Math.abs(zoomGoal - zoomMul) < 0.001) zoomMul = zoomGoal;
    else zoomMul += (zoomGoal - zoomMul) * (1 - Math.exp(-dt * 14));
    zooming = zoomMul !== zoomGoal;
    zoom = baseZoom * zoomMul;
  }
  addEventListener('resize', resize);

  // terrain chunks are painted at the screen's resolution (1x / 1.5x / 2x world px), so the ground stays sharp
  // on high-DPI screens and when zoomed in; while a sharper copy is being painted the old one is shown
  const chunkCache = new Map();
  const chunkRes = () => (zoom * DPR > 1.6 ? 2 : zoom * DPR > 1.15 ? 1.5 : 1);
  function getChunk(cx, cy, budget) {
    const R = chunkRes(), key = `${R}|${cy * 1000 + cx}`;
    let c = chunkCache.get(key);
    if (c) { chunkCache.delete(key); chunkCache.set(key, c); return c; }
    if (budget.n <= 0 || zooming) {
      for (const r of [2, 1.5, 1]) { const o = chunkCache.get(`${r}|${cy * 1000 + cx}`); if (o) return o; }
      if (budget.n <= 0) return null;
    }
    budget.n--;
    c = Art.renderChunk(G.map, cx, cy, R);
    chunkCache.set(key, c);
    const max = R >= 2 ? 24 : R > 1 ? 32 : 48;
    while (chunkCache.size > max) chunkCache.delete(chunkCache.keys().next().value);
    return c;
  }

  function drawGround(view, t) {
    const CS = Art.CHUNK * TILE, TH = Art.theme();
    const budget = { n: 3 };
    const x0 = Math.max(0, Math.floor(view.x / CS)), x1 = Math.min(Math.ceil(G.map.w / Art.CHUNK) - 1, Math.floor((view.x + view.w) / CS));
    const y0 = Math.max(0, Math.floor(view.y / CS)), y1 = Math.min(Math.ceil(G.map.h / Art.CHUNK) - 1, Math.floor((view.y + view.h) / CS));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = getChunk(cx, cy, budget);
      if (c) ctx.drawImage(c, cx * CS, cy * CS, CS + 0.75, CS + 0.75);   // a hair of overlap: no seams between chunks
      else { ctx.fillStyle = (TH.grass && TH.grass[0]) || '#5a8f42'; ctx.fillRect(cx * CS, cy * CS, CS, CS); }
    }
    // water sparkles (glowing bubbles on lava)
    const tx0 = Math.max(0, Math.floor(view.x / TILE)), tx1 = Math.min(G.map.w - 1, Math.floor((view.x + view.w) / TILE));
    const ty0 = Math.max(0, Math.floor(view.y / TILE)), ty1 = Math.min(G.map.h - 1, Math.floor((view.y + view.h) / TILE));
    ctx.fillStyle = TH.spark || '#ffffff';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (G.map.tiles[ty * G.map.w + tx] !== C.T.WATER) continue;
      const h = Art.hash(tx, ty, 77);
      const a = Math.pow(Math.max(0, Math.sin(t * 1.6 + h * 40)), 10);
      if (a < 0.05) continue;
      ctx.globalAlpha = a * 0.8;
      ctx.beginPath(); ctx.ellipse(tx * TILE + 8 + h * 32, ty * TILE + 10 + Art.hash(tx, ty, 78) * 28, 5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // battlefield sigil
    if (sigil) {
      const img = Art.sigil();
      ctx.save(); ctx.translate(sigil.x, sigil.y); ctx.scale(1, 0.62); ctx.rotate(t * 0.08);
      ctx.globalAlpha = 0.55 + Math.sin(t * 1.5) * 0.15;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
    }
    // gate portals: a swirling oval between the arch pillars
    for (const g of G.mapDef.gates || []) {
      if (Math.abs(g.x - cam.x) > view.w / 2 + 120 || Math.abs(g.y - cam.y) > view.h / 2 + 200) continue;
      const col = g.back ? '122,255,170' : '122,200,255';
      ctx.save(); ctx.translate(g.x, g.y + TILE / 2 - 60); ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
      grd.addColorStop(0, `rgba(255,255,255,0.75)`); grd.addColorStop(0.45, `rgba(${col},0.4)`); grd.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0, 0, 40, 56, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = t * (2 + i * 0.6) + i * 2.1;
        ctx.strokeStyle = `rgba(${col},${0.75 - i * 0.18})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 34 - i * 9, 50 - i * 12, 0, a, a + Math.PI * 1.2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // red ring under the locked attack target, faint ring under the hovered enemy
  function drawTargetRings(t) {
    const o = G.order;
    const locked = targetEnt() || (o && o.type === 'attack' ? G.ents.get(o.id) : null);
    const ring = (e, col, alpha, spin) => {
      const r = Math.max(24, radiusOf(e) * (e.kind === 'm' ? MON_SCALE : 1) + 8);
      ctx.save();
      ctx.translate(e.x, e.y); ctx.scale(1, 0.38);
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 4;
      if (spin) { ctx.rotate(t * 2.5); ctx.setLineDash([14, 9]); }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };
    if (isFoe(locked)) ring(locked, '#ff3a2a', 0.9, true);
    if (G.hoverFoe && G.hoverFoe !== locked) ring(G.hoverFoe, '#ffd0a0', 0.5, false);
  }
  // นักพรต cast sheet: 0 = hand seal, 1 = fly-whisk raised, 2 = palm pushed forward
  const TAO_POSE = {
    jade: [[0.3, 0], [1, 2]], skybolt: [[0.45, 1], [1, 2]], mercy: [[0.5, 0], [1, 1]], aegis: [[0.55, 0], [1, 1]],
    heavens: [[0.35, 0], [0.7, 1], [1, 2]], spiritsword: [[0.3, 1], [1, 2]], might: [[0.4, 0], [1, 1]], meteor: [[0.5, 1], [1, 2]],
    nirvana: [[0.3, 0], [0.65, 1], [1, 1]],
  };
  // นักธนู attack sheet: 0 = arrow nocked, 1 = full draw, 2 = release
  const ARC_POSE = {
    hawkshot: [[0.35, 1], [1, 2]], scatter: [[0.3, 1], [1, 2]], hawkeye: [[0.6, 0], [1, 1]], gale: [[0.5, 1], [1, 0]],
    skyrain: [[0.3, 1], [1, 2]], deadeye: [[0.2, 0], [0.65, 1], [1, 2]], rollshot: [[0.5, 1], [1, 2]], blast: [[0.35, 1], [1, 2]],
    stormphoenix: [[0.25, 0], [0.55, 1], [1, 2]],
  };
  function playerFrame(e, now) {
    return SkillPerformance.frame(e,now,basePlayerFrame(e,now));
  }
  G.skillFrame=playerFrame;
  function basePlayerFrame(e, now) {
    if (e.cls === 'arbiter') return ArbiterLook.frame(e, now);
    const ritual = AscendedSkills.frame(e, now);
    if (ritual) return ritual;
    if (e.cls === 'warrior') return WarriorLook.frame(e, now);
    if (e.cls === 'spearman') return SpearmanLook.frame(e, now);
    const OM = e.cls !== 'taoist' && C.CLASSES[e.cls] && C.CLASSES[e.cls].sheet && ownMeta(e.cls);
    if (OM) {
      const A = e.atk;
      if (A && OM.attack[e.faction]) {
        const el = now - A.t0, dur = A.dur || ATK_DUR[A.kind] || 400;
        const steps = ARC_POSE[A.kind];
        if (el < dur && steps) { const p = el / dur; return { atk: true, dir: A.dir, frame: steps.find((q) => p <= q[0])[1] }; }
      }
      return { atk: false, dir: e.dir, frame: Motion.walkFrame(e, e.cls === 'archer' ? 3 : 1) };
    }
    if (e.cls === 'taoist') {
      const A = e.atk;
      if (A && TAO && TAO.attack[e.faction]) {
        const el = now - A.t0, dur = A.dur || ATK_DUR[A.kind] || 400, steps = TAO_POSE[A.kind];
        if (el < dur && steps) { const p = el / dur; return { atk: true, dir: A.dir, frame: steps.find((q) => p <= q[0])[1] }; }
      }
      // The turnaround was drawn with different proportions. Use the neutral
      // walking pose so stopping never switches faces, clothes or body scale.
      return { atk: false, dir: e.dir, frame: Motion.walkFrame(e, 1) };
    }
    if (e.atk && SPR.attack) {
      const el = now - e.atk.t0, k = e.atk.kind, dur = e.atk.dur || ATK_DUR[k];
      if (el < dur) {
        if (k === 'lotus' || k === 'spin') { const spin = Math.floor(el / (k === 'spin' ? 45 : 55)); return { atk: true, dir: (e.atk.dir + spin) % 8, frame: 1 + (spin % 2) }; }
        // พายุพันคม: the blades do the work; the body keeps walking, or turns slowly while standing
        if (k === 'tempest') return e.moving ? { atk: false, dir: e.dir, frame: Motion.walkFrame(e) } : { atk: true, dir: (e.atk.dir + Math.floor(el / 160)) % 8, frame: 1 };
        if (k === 'shadowstep' || k === 'crescent') return { atk: true, dir: e.atk.dir, frame: 2 };
        if (k === 'skyfall') return { atk: true, dir: e.atk.dir, frame: el < 230 ? 1 : 2 };
        if (k === 'thousand') return { atk: true, dir: e.atk.dir, frame: Math.floor(el / 45) % 3 };
        if (k === 'twindragon') return { atk: true, dir: e.atk.dir, frame: el < 140 ? 0 : 2 };
        return { atk: true, dir: e.atk.dir, frame: el < dur * 0.22 ? 0 : el < dur * 0.55 ? 1 : 2 };
      }
    }
    return { atk: false, dir: e.dir, frame: Motion.walkFrame(e) };
  }
  // Reuse the nearest detailed atlas while zoom is in motion.
  let zooming = false;
  // frame meta of the sheet an entity is drawn from
  // the entity's own class sheets (นักพรต, นักธนู), or null for the twin blades' shared sheets
  const ownOf = (e) => ownMeta(e.cls);
  function metaOf(e, F) {
    const O = ownOf(e);
    if (O) return (F.atk ? O.attack[e.faction] : O.walk[e.faction]) || O.walk[e.faction];
    return F.atk ? SPR.attack : SPR;
  }
  // draws one character frame: body (armour colours) + the equipped weapon in the hands
  function drawSprite(e, F, x, y, opts = {}) {
    const g = opts.ctx || ctx, s = opts.scale || PLAYER_SCALE;
    if (e.cls === 'arbiter') return ArbiterLook.draw(g, e, F, x, y, s, performance.now());
    if (e.cls === 'warrior') return WarriorLook.draw(g, e, F, x, y, s,performance.now(),opts);
    const costumeTier = DualbladeLook.is(e) ? DualbladeLook.stageOf(e.lvl || 1) : ModelTiers.tierOf(e.lvl || 1);
    const meta = metaOf(e, F);
    const O = ownOf(e);
    if (O && F.atk && !O.attack[e.faction]) F = { ...F, atk: false };
    // Equipment tiers drive the cached outfit and whisk design, separately from level auras.
    const look = O ? ArmorLook.sheet(e.faction, F.atk, e.ar, ModelTiers.tierOf(e.lvl || 1), e.gg, e.cls, e.wt || 0)
      : WeaponLook.sheet(e.faction, e.wt || 0, F.atk, e.ar, costumeTier, e.gg);
    if (!look.sheet) return;
    const fw = meta.frameWidth, fh = meta.frameHeight;
    const sx = C.DIR_COL[F.dir] * fw, sy = F.frame * fh;
    const dx = x - meta.anchorX * s, dy = y - meta.anchorY * s;
    const T = g.getTransform(), dev = Math.hypot(T.a, T.b) * s;           // device pixels per sheet pixel
    const blit = (img) => {
      if (!img) return;
      const S = SpriteDetail.sheet(img, dev, fw, fh, zooming, C.DIR_COL[F.dir], F.frame);
      const cx = C.DIR_COL[F.dir] * S.pitchX + S.pad, cy = F.frame * S.pitchY + S.pad;
      // Preserve subpixel movement. Supersampling and padded atlases keep fine edges
      // clean without the one-pixel jumps caused by snapping each body independently.
      g.drawImage(S.img, cx, cy, S.cw, S.ch, dx, dy, fw * s, fh * s);
    };
    g.imageSmoothingQuality = 'high';
    if (!opts.noGlow) EquipmentAura.draw(g, e, F, meta, x, y, s, performance.now()/1000, opts.auraBounds);
    // equipment grade light: an outline of light around the character, nothing over it
    if (look.rim && !opts.noGlow) {
      g.save();
      g.globalAlpha *= .95 + .05 * Math.sin(performance.now() / 1100 + (e.x || 0));
      const R = look.rimMeta;
      if (R) {
        const S = SpriteDetail.sheet(look.rim, dev, R.fw, R.fh, zooming, C.DIR_COL[F.dir], F.frame);
        g.drawImage(S.img,C.DIR_COL[F.dir]*S.pitchX+S.pad,F.frame*S.pitchY+S.pad,S.cw,S.ch,
          dx-R.pad*s,dy-R.pad*s,R.fw*s,R.fh*s);
      } else blit(look.rim);
      g.restore();
    }
    blit(look.sheet);
    blit(look.blades);
    if (look.glow && !opts.noGlow) {
      const lk = WeaponLook.lookOf(e);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha *= Math.min(1, lk.glowA * (F.atk ? 1.35 : 1)) * (0.75 + 0.25 * Math.sin(performance.now() / 260 + (e.x || 0)));
      g.drawImage(look.glow, sx, sy, fw, fh, dx, dy, fw * s, fh * s);
      g.restore();
    }
    // the equipped weapon's own art in both hands (the นักพรต fly-whisk and the นักธนู bow are part of the drawing)
    if (!O && WeaponLook.hasArt()) WeaponLook.drawBlades(g, e, F, x, y, s, opts);
    else if (O) WeaponLook.drawOwnPlus(g, e, F, x, y, s, opts);
    if (!opts.noGlow) EquipmentGlints.draw(g, e, F, meta, x, y, s);
  }
  const TAU = Math.PI * 2;
  window.drawGhost = function (e, x, y, alpha, _tint, target = ctx, blend = 'lighter') {
    target.save();
    target.globalAlpha *= alpha;
    target.globalCompositeOperation = blend;
    drawSprite(e, e.cls==='spearman'?{atk:true,dir:e.atk?.dir??e.dir,frame:1}:{ atk: !!SPR.attack, dir: e.dir, frame: SPR.attack ? 2 : 1 }, x, y, { noGlow: true, ctx: target });
    target.restore();
  };
  // inventory preview: the player turning through 8 directions with the current weapon
  G.drawPreview = function (g, w, h, t, poseFrame, bodyPose) {
    const me = G.me;
    if (!me || !SPR) return;
    const dir = Math.floor(t / 0.9) % 8;
    const attacking = (ownOf(me) ? !!ownOf(me).attack[me.faction] : !!SPR.attack) && Math.floor(t / 0.9) % 4 === 3;
    const F = poseFrame ? {...poseFrame} : attacking ? { atk: true, dir, frame: Math.floor((t % 0.9) / 0.3) } : { atk: false, dir, frame: me.cls === 'archer' && t % .9 < .4 ? 3 : [0, 1, 2, 1][Math.floor(t * 8) % 4] };
    F.faction = me.faction;
    if (me.cls === 'arbiter') { ArbiterLook.draw(g, me, F, w / 2, h - 16, Math.min(.9, (h - 28) / 210), t * 1000); return; }
    if (me.cls === 'warrior') {
      const px=w/2+(bodyPose?.dx||0),py=h-16+(bodyPose?.dy||0)-(bodyPose?.lift||0);
      g.save();g.translate(px,py);g.rotate(bodyPose?.roll||0);g.scale(bodyPose?.sx||1,bodyPose?.sy||1);
      WarriorLook.draw(g,me,F,0,0,Math.min(.86,(h-25)/215),t*1000,{auraBounds:{width:w-16,height:h-24}});g.restore();return;
    }
    const K = sizeK(me);
    g.save(); g.translate(w / 2, h - 16); g.scale(K, K); g.translate(-w / 2, -(h - 16));   // class size (ทวน = 1)
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(w / 2, h - 16, 40, 10, 0, 0, Math.PI * 2); g.fill();
    const pe = { ...me, x: w / 2, y: h - 16, dead: false };
    const px=w/2+(bodyPose?.dx||0),py=h-16+(bodyPose?.dy||0)-(bodyPose?.lift||0);
    const AS = 1.3; // aura scale in the preview (sprite is drawn larger than in the world)
    g.save(); g.translate(w / 2, h - 16); g.scale(AS, AS); g.translate(-w / 2, -(h - 16));
    WeaponLook.ground(g, pe, t);
    WeaponLook.plusRings(g, pe, t, (w-16)/(2*AS), 12/AS);
    ClassAura.ground(g, pe, t, 1);                         // Lv.100-130 class aura, in the same order as drawPlayer
    g.restore();
    ClassAura.back(g, pe, px, py, t, PH * 1.05 * 0.86 / PLAYER_SCALE);
    WeaponLook.back(g, pe, w / 2, h - 16, t, AS);
    const meta = metaOf(me, F);
    ModelTiers.drawAura(g, pe, F, px, py, t, 0.86, meta);
    Wings.draw(g, pe, F, w / 2, h - 16, t, 0.86, 'back', meta, 0.6);
    ModelTiers.drawHorns(g, pe, F, w / 2, h - 16, 0.86, meta, 'back');
    g.save();if(bodyPose?.roll){g.translate(px,py);g.rotate(bodyPose.roll);g.translate(-px,-py);}
    if(bodyPose?.sx&&(bodyPose.sx!==1||bodyPose.sy!==1)){g.translate(px,py);g.scale(bodyPose.sx,bodyPose.sy||1);g.translate(-px,-py);}
    drawSprite(me, F, px, py, { ctx: g, scale: 0.86, auraBounds: { width: (w-16)/K, height: (h-24)/K } });g.restore();
    Wings.draw(g, pe, F, w / 2, h - 16, t, 0.86, 'front', meta, 0.6);
    ModelTiers.drawHorns(g, pe, F, w / 2, h - 16, 0.86, meta, 'front');
    ModelTiers.drawHalo(g, pe, F, w / 2, h - 16, t, 0.86, meta);
    WeaponLook.front(g, pe, w / 2, h - 16, t, AS);
    g.restore();
  };

  // body pose offsets while casting: lift (px above the ground) and a lunge along the swing
  function poseOf(e, now) {
    return SkillPerformance.pose(e,now,basePoseOf(e,now));
  }
  G.skillPose=poseOf;
  function basePoseOf(e, now) {
    const o = { lift: Motion.bodyLift(e, now), dx: e.correctX || 0, dy: e.correctY || 0 };
    if (AscendedSkills.active(e, now)) return AscendedSkills.pose(e, now, o);
    if (e.cls === 'spearman') return SpearmanLook.pose(e,now,o);
    if (e.leap) { const p = Math.min(1, (now - e.leap.t0) / e.leap.dur); o.lift = Math.sin(p * Math.PI) * FX.LEAP_H; }
    const A = e.atk;
    if (!A) return o;
    const el = now - A.t0, dur = A.dur || ATK_DUR[A.kind], p = Math.min(1, el / dur);
    const lunge = (px) => {
      const phase = Math.min(1, p * 1.6), pulse = Math.sin(phase * Math.PI) ** 2;
      o.dx += Math.cos(A.a) * pulse * px; o.dy += Math.sin(A.a) * pulse * px * .6;
    };
    if (A.kind === 'thousand') { o.dx += Math.cos(A.a) * Math.sin(el / 30) * 3; o.dy += Math.sin(A.a) * Math.sin(el / 30) * 2; }
    else if (A.kind === 'nirvana') o.lift = Math.sin(p * Math.PI) * 14;    // rises while the blessing falls
    else if (A.kind === 'fang') lunge(4);
    else if (A.kind === 'jade' || A.kind === 'spiritsword') lunge(3);
    else if (A.kind === 'twindragon') lunge(18);
    else if (A.kind === 'crescent' || A.kind === 'rend') lunge(10);
    else if (A.kind === 'spin') o.lift = Math.sin(p * Math.PI) * 10;
    return o;
  }

  // ------------------------------------------------------------ stance aura (ท่าประจำขั้น): grows every 10 levels
  // 1 qi wisps · 2 ring at the feet · 6 rune circle · 8 qi flame at the feet · 9 second rune circle
  // nothing circles the body; wings (wings.js) and the ธรรมะ halo / อธรรม horns (model-tiers.js) come with the level look
  // นักพรต stance colours: เทพรักษา jade / white / gold, มารทำลาย blood / ember / abyss
  const TAO_STANCE = { dharma: { c: ['#f4fff8', '#8affc8', '#2ab884'], glow: '#7cffc4' }, adharma: { c: ['#ffd6c8', '#ff3b2a', '#3a0006'], glow: '#ff4a1a' } };
  function drawStance(g, e, x, y, t, back) {
    if (e.cls === 'spearman') return; // one authored divine crest, no stacked rings across the face
    if (DualbladeLook.is(e)) return;
    const st = C.stageOf(e.lvl || 1);
    if (!st || e.dead) return;
    const tao = e.cls === 'taoist' && TAO_STANCE[e.faction];
    const c = tao ? tao.c : window.WeaponLook ? WeaponLook.fx(e.faction, e.wt || 0) : C.FACTIONS[e.faction].fx;
    const glow = tao ? tao.glow : (window.WeaponLook && WeaponLook.look(e.faction, e.wt || 0).glow) || c[1];
    const heal = tao && e.faction !== 'adharma', ruin = tao && e.faction === 'adharma';
    const K = LOOK_K, seed = (e.x || 0) * 0.01;
    g.save(); g.globalCompositeOperation = 'lighter';
    if (back) {
      if (st >= 6) { // rune circles under the feet
        for (let k = 0; k < (st >= 9 ? 2 : 1); k++) {
          g.save(); g.translate(x, y); g.scale(1, 0.36); g.rotate(k ? 0.4 : 0);
          g.globalAlpha = 0.35 + (st >= 13 ? 0.2 : 0); g.strokeStyle = k ? c[0] : glow; g.lineWidth = 1.6;
          const R = (k ? 34 : 46) * K;
          g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
          if (heal) {          // a ring of lotus petals, turning slowly
            g.rotate(t * 0.3 * (k ? -1 : 1));
            for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.fillStyle = k ? c[0] : glow; g.beginPath(); g.ellipse(R, 0, 6 * K, 2.6 * K, 0, 0, TAU); g.fill(); }
          } else if (ruin) {   // a cracked ring with spikes pointing out
            g.rotate(-t * 0.4 * (k ? -1 : 1));
            for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.fillStyle = k ? c[1] : glow; g.beginPath(); g.moveTo(R - 2, -3); g.lineTo(R + 7 * K, 0); g.lineTo(R - 2, 3); g.fill(); }
          } else for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.fillStyle = k ? c[0] : glow; g.fillRect(R - 3, -2, 5, 4); }
          g.restore();
        }
      } else if (st >= 2) {
        g.save(); g.translate(x, y); g.scale(1, 0.36);
        g.globalAlpha = 0.4; g.strokeStyle = glow; g.lineWidth = 2; g.setLineDash([10, 9]);
        g.beginPath(); g.arc(0, 0, 32 * K, 0, TAU); g.stroke(); g.restore();
      }
      if ((e.lvl || 1) >= 130) { // Lv.130: เทพเซียน golden lotus / เทพมาร cracked demon seal on the ground (static, pulsing)
        const pulse = 0.75 + 0.25 * Math.sin(t * 2.2 + seed);
        g.save(); g.translate(x, y); g.scale(1, 0.36);
        if (e.faction !== 'adharma') {
          g.globalAlpha = 0.5 * pulse;
          for (const [n, R, off, col] of [[12, 58, 0, '#ffd76a'], [8, 40, 0.39, '#fff3c0']]) for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + off;
            g.save(); g.rotate(a);
            const p = new Path2D(); p.moveTo(R * 0.25 * K, 0); p.quadraticCurveTo(R * 0.6 * K, -R * 0.2 * K, R * K, 0); p.quadraticCurveTo(R * 0.6 * K, R * 0.2 * K, R * 0.25 * K, 0);
            g.fillStyle = col; g.fill(p); g.restore();
          }
          const lg = g.createRadialGradient(0, 0, 0, 0, 0, 30 * K); lg.addColorStop(0, 'rgba(255,250,220,0.9)'); lg.addColorStop(1, 'rgba(255,220,120,0)');
          g.globalAlpha = 0.6 * pulse; g.fillStyle = lg; g.beginPath(); g.arc(0, 0, 30 * K, 0, TAU); g.fill();
        } else {
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.45;
          g.fillStyle = '#0a0204'; g.beginPath(); g.arc(0, 0, 56 * K, 0, TAU); g.fill();
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7 * pulse; g.strokeStyle = '#ff2a1a'; g.lineWidth = 2;
          g.beginPath(); g.arc(0, 0, 54 * K, 0, TAU); g.stroke();
          g.beginPath();                                  // five-point seal
          for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 * TAU) / 5; const px2 = Math.cos(a) * 50 * K, py2 = Math.sin(a) * 50 * K; i ? g.lineTo(px2, py2) : g.moveTo(px2, py2); }
          g.stroke();
          g.lineWidth = 1.4; g.strokeStyle = '#ff7a2a';    // lava cracks running out
          for (let i = 0; i < 7; i++) {
            const a = i * 0.9 + 0.3; g.beginPath(); g.moveTo(Math.cos(a) * 56 * K, Math.sin(a) * 56 * K);
            g.lineTo(Math.cos(a + 0.12) * 66 * K, Math.sin(a + 0.12) * 66 * K); g.lineTo(Math.cos(a - 0.05) * 76 * K, Math.sin(a - 0.05) * 76 * K); g.stroke();
          }
        }
        g.restore();
      }
      if (st >= 8) { // qi flame licking up from the ground ring (kept below the waist, behind the body)
        const grd = g.createLinearGradient(0, y - 34 * K, 0, y);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, glow);
        g.globalAlpha = (ruin ? 0.2 : 0.12) + Math.sin(t * (ruin ? 9 : 4) + seed) * 0.04;
        g.fillStyle = grd; g.beginPath(); g.ellipse(x, y - 12 * K, 30 * K, (ruin ? 28 : 22) * K, 0, 0, TAU); g.fill();
        if (heal) {     // เทพรักษา: a soft pillar of jade light
          const pg = g.createLinearGradient(0, y - 120 * K, 0, y);
          pg.addColorStop(0, 'rgba(120,255,190,0)'); pg.addColorStop(1, 'rgba(160,255,210,0.5)');
          g.globalAlpha = 0.18 + Math.sin(t * 2 + seed) * 0.05; g.fillStyle = pg; g.fillRect(x - 22 * K, y - 120 * K, 44 * K, 120 * K);
        }
      }
    }
    if (!back) {
      if (st >= 1) for (let i = 0; i < 3 + st; i++) { // qi wisps rising from the feet
        const q = (t * (ruin ? 0.65 : 0.5) + i / (3 + st) + seed) % 1;
        const a = i * 2.39996 + seed;
        g.globalAlpha = Math.sin(q * Math.PI) * 0.7;
        g.fillStyle = i % 2 ? glow : c[0];
        const side = Math.cos(a) < 0 ? -1 : 1;     // beside the body, not through it
        const wx = x + side * (26 + Math.abs(Math.cos(a)) * 8) * K + (ruin ? Math.sin(t * 6 + i) * 4 * K : 0), wy = y - q * 70 * K, r = (1.4 + st * 0.08) * K * 1.4;
        if (heal && i % 3 === 0) {         // เทพรักษา: little crosses of healing light and leaves
          g.fillRect(wx - r * 0.35, wy - r * 1.3, r * 0.7, r * 2.6); g.fillRect(wx - r * 1.3, wy - r * 0.35, r * 2.6, r * 0.7);
        } else if (heal && i % 3 === 1) {
          g.save(); g.translate(wx, wy); g.rotate(q * 6 + i); g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.6, 0, 0, TAU); g.fill(); g.restore();
        } else if (ruin) {                 // มารทำลาย: flickering embers, a few streaking up
          g.fillStyle = i % 3 ? glow : '#ffb070';
          g.beginPath(); g.arc(wx, wy, r * (0.7 + 0.4 * Math.sin(t * 20 + i)), 0, TAU); g.fill();
          if (i % 2) { g.strokeStyle = c[1]; g.lineWidth = r * 0.6; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx, wy + r * 4); g.stroke(); }
        } else { g.beginPath(); g.arc(wx, wy, r, 0, TAU); g.fill(); }
      }
    }
    g.restore();
  }

  function drawPlayer(e, now) {
    const fcol = C.FACTIONS[e.faction].color;
    const pose = poseOf(e, now), t = now / 1000;
    const F = playerFrame(e, now);
    F.faction = e.faction;
    // Keep the feet at the sheet's common anchor. Per-pose centre corrections
    // shift abruptly at frame boundaries and made the character shake sideways.
    const px = e.x + pose.dx, py = e.y + pose.dy - pose.lift;
    e.liftY = pose.lift - pose.dy;
    // shadow + faction ring (stay on the ground, shrink while airborne)
    const sh = 1 - Math.min(0.5, pose.lift / 200), K = sizeK(e);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x + pose.dx, e.y + pose.dy, 22 * LOOK_K * sh * K, 7 * LOOK_K * sh * K, 0, 0, Math.PI * 2); ctx.fill();
    if (e.cls === 'arbiter') { ArbiterLook.draw(ctx, e, F, px, py, PLAYER_SCALE, now); return; }
    if (e.cls === 'warrior') {
      ctx.save(); ctx.strokeStyle=fcol; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(e.x,e.y,24,8,0,0,Math.PI*2); ctx.stroke();
      if(e.dead){ctx.globalAlpha=.35;ctx.filter='grayscale(1)';}
      else if(e.flash>0)ctx.filter=`brightness(${1+e.flash*1.4})`;
      ctx.translate(px,py);ctx.rotate(pose.roll||0);ctx.scale(pose.sx||1,pose.sy||1);
      WarriorLook.draw(ctx,e,F,0,0,PLAYER_SCALE,now);ctx.restore();
      if(!e.dead)WeaponLook.emitPlus(e,F,px,py,PLAYER_SCALE,G.dt||.016);
      return;
    }
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(K, K); ctx.translate(-e.x, -e.y);   // ground layers: class size
    if (!e.dead) {
      ctx.strokeStyle = fcol; ctx.globalAlpha = e === G.me ? 0.9 : 0.55; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 24 * LOOK_K, 8 * LOOK_K, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // ground rings / magic circles scale with the character
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(LOOK_K, LOOK_K); ctx.translate(-e.x, -e.y);
    WeaponLook.ground(ctx, e, now / 1000);
    WeaponLook.plusRings(ctx, e, now / 1000);                           // rune rings of +8..+10 gear
    ctx.restore();
    ClassAura.ground(ctx, e, t, LOOK_K);                                 // Lv.100-130 class aura: the ground part
    ctx.restore();
    // body layers scale round the drawn feet, so a move's route (pose.dx / lift) still ends where it should
    ctx.save(); ctx.translate(px, py); ctx.scale(K, K); ctx.translate(-px, -py);
    drawStance(ctx, e, px, py, t, true);
    const meta = metaOf(e, F);
    ClassAura.back(ctx, e, px, py, t, PH * 1.05);                        // ... and the part behind the body (never over it)
    ModelTiers.drawAura(ctx, e, F, px, py, t, PLAYER_SCALE, meta);        // Lv.130 เทพเซียน sun disc / เทพมาร hellfire
    Wings.draw(ctx, e, F, px, py, t, PLAYER_SCALE, 'back', meta);        // level wings: the parts behind the body
    ModelTiers.drawHorns(ctx, e, F, px, py, PLAYER_SCALE, meta, 'back');  // อธรรม far horn (side views)
    WeaponLook.back(ctx, e, px, py, t, LOOK_K);
    ctx.save();
    if (e.dead) { ctx.globalAlpha = 0.35; ctx.filter = 'grayscale(1)'; }
    else if (e.flash > 0) ctx.filter = `brightness(${1 + e.flash * 1.4})`;
    ctx.save();
    if(pose.roll){ctx.translate(px,py);ctx.rotate(pose.roll);ctx.translate(-px,-py);}
    if(pose.sx&&(pose.sx!==1||pose.sy!==1)){ctx.translate(px,py);ctx.scale(pose.sx,pose.sy||1);ctx.translate(-px,-py);}   // squash & stretch round the feet
    drawSprite(e, F, px, py);
    ctx.restore();
    ctx.restore();
    WeaponLook.front(ctx, e, px, py, t, LOOK_K);
    Wings.draw(ctx, e, F, px, py, t, PLAYER_SCALE, 'front', meta);       // ... and the parts over the back
    ModelTiers.drawHorns(ctx, e, F, px, py, PLAYER_SCALE, meta, 'front'); // อธรรม demon-god horns
    ModelTiers.drawHalo(ctx, e, F, px, py, t, PLAYER_SCALE, meta);       // ธรรมะ halo ring above the head
    drawStance(ctx, e, px, py, t, false);
    ctx.restore();
    // weapon sparks / enhancement effects from the twin blades' points or the นักพรต whisk (world particles: real scale)
    if (!e.dead && e.cls !== 'spearman') { WeaponLook.emit(e, F, px, py, PLAYER_SCALE * K, G.dt || 0.016); WeaponLook.emitPlus(e, F, px, py, PLAYER_SCALE * K, G.dt || 0.016); }
    else if (!e.dead) WeaponLook.emitPlus(e,F,px,py,PLAYER_SCALE*K,G.dt||0.016);
  }

  function drawMonster(e, now, t) {
    const atk = e.atkT ? Math.max(0, 1 - Math.abs((now - e.atkT) / 200 - 1)) : 0;
    let alpha;
    if (e.dying) alpha = Math.max(0, 1 - (now - e.dying) / 700);
    const mx = e.x + atk * e.face * 8;
    ctx.save(); ctx.translate(mx, e.y); ctx.scale(MON_SCALE, MON_SCALE); ctx.translate(-mx, -e.y);
    MonsterArt.draw(ctx, e.type, mx, e.y, e.face || 1, t, { moving: e.moving, casting:now<(e.castUntil||0), flash: e.flash, seed: e.seed, x: e.x, atk, alpha, dir: e.dir8 });
    ctx.restore();
  }

  function drawTags(e) {
    if (e.dying && e.kind === 'm') return;
    const isMe = e === G.me;
    const h = e.kind === 'm' ? monH(e.type) : PH * sizeK(e) + (e.liftY || 0);
    const y = e.y - h - 8;
    const x = e.x + (e.correctX || 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (e.kind === 'p') {
      const col = C.FACTIONS[e.faction].color;
      ctx.font = '600 13px Kanit, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      // ⚔ = PvP switched on · evil players: red name with their evil points after it
      const label = `${e.pk ? '⚔ ' : ''}Lv.${e.lvl} ${e.name}${e.ev < 0 ? ` (${e.ev})` : ''}`;
      ctx.strokeText(label, x, y - 6);
      ctx.fillStyle = e.ev < 0 ? '#ff3b3b' : isMe ? '#ffffff' : col; ctx.fillText(label, x, y - 6);
      if (!isMe && !e.dead) hpBar(x, y - 2, 54, e.hp / e.mhp, isFoe(e) ? '#e8403a' : '#4ad06a');
    } else {
      const showBar = e.hp < e.mhp || e.aggro || e.boss;
      ctx.font = e.boss ? '800 16px Kanit, sans-serif' : '400 12px Kanit, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const label = `Lv.${e.lvl} ${e.name}`;
      ctx.strokeText(label, e.x, y - (showBar ? 6 : 0));
      ctx.fillStyle = e.boss ? '#ff7a5a' : e.aggro ? '#ffb070' : '#f3efe6';
      ctx.fillText(label, e.x, y - (showBar ? 6 : 0));
      if (showBar) hpBar(e.x, y - 2, e.boss ? 140 : 46, e.hp / e.mhp, '#e8403a');
    }
  }
  function hpBar(x, y, w, p, col) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
    ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), 5);
  }

  function render(now, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = Art.theme().bg || '#16301a';
    ctx.fillRect(0, 0, VW, VH);
    if (!G.map) return;
    const me = G.me;
    if (me) {
      const k = Motion.ease(12, G.dt || 1 / 60);
      cam.x += (me.x + (me.correctX || 0) - cam.x) * k;
      cam.y += (me.y + (me.correctY || 0) - 40 - cam.y) * k;
    } else {
      // login backdrop: slow pan over the starting village
      cam.x = (G.map.w * TILE) / 2 + Math.sin(t * 0.07) * 1600;
      cam.y = (G.map.h * TILE) / 2 + Math.sin(t * 0.05) * 500;
    }
    const sx = (Math.random() - 0.5) * FX.shake, sy = (Math.random() - 0.5) * FX.shake;
    const view = { w: VW / zoom, h: VH / zoom };
    view.x = cam.x - view.w / 2; view.y = cam.y - view.h / 2;

    ctx.save();
    ctx.translate(VW / 2 + sx, VH / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGround(view, t);
    FX.draw(ctx, 'ground');
    drawTargetRings(t);
    BOT.drawWorld(ctx, t);

    // y-sorted drawables
    const list = [];
    const cx0 = Math.max(0, Math.floor((view.x - 280) / PCH)), cx1 = Math.min(PCW - 1, Math.floor((view.x + view.w + 280) / PCH));
    const cy0 = Math.max(0, Math.floor((view.y - 60) / PCH)), cy1 = Math.min(Math.ceil(G.map.h / Art.CHUNK) - 1, Math.floor((view.y + view.h + 470) / PCH));
    const lights = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++)
      for (const p of propChunks[cy * PCW + cx]) {
        const { img, ax, ay } = p.sp;
        const left = p.x - ax, top = p.y - ay;
        if (left > view.x + view.w || left + img.width < view.x || top > view.y + view.h || top + img.height < view.y) continue;
        list.push(p);
        if (p.sp.light) lights.push(p);
      }
    for (const e of G.ents.values()) {
      if (Math.abs(e.x - cam.x) < view.w / 2 + 200 && Math.abs(e.y - cam.y) < view.h / 2 + 260) list.push(e);
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) {
      if (d.kind === 'prop') {
        if(d.sp.paintedVillage)VillageArt.drawProp(ctx,d,G.me);
        else ctx.drawImage(d.sp.img, d.x - d.sp.ax, d.y - d.sp.ay);
      }
      else if (d.kind === 'p') drawPlayer(d, now);
      else drawMonster(d, now, t);
    }
    // additive light glows
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of lights) {
      const r = p.sp.ly < -60 ? 90 : 46;
      const ly = p.y + p.sp.ly;
      const grd = ctx.createRadialGradient(p.x, ly, 2, p.x, ly, r);
      grd.addColorStop(0, p.sp.light); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (p.sp.light === '#bfe9ff' || p.sp.light === '#9edcff' ? 0.16 : 0.3) + Math.sin(t * 3 + p.x) * 0.05;
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, ly, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    FX.draw(ctx, 'top');
    for (const d of list) if (d.kind === 'p' || d.kind === 'm') drawTags(d);
    // labels on interactive props (blacksmith, teleport stone, gates)
    ctx.textAlign = 'center';
    for (const d of list) {
      if (d.kind !== 'prop' || !d.sp.label) continue;
      const y = d.y + d.sp.labelY, text = `${d.sp.icon || '⚒'} ${d.sp.label}`;
      ctx.font = '600 14px Kanit, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(text, d.x, y); ctx.fillStyle = d.sp.gate ? '#9fe8ff' : d.sp.icon ? '#bff0ff' : '#ffd98a'; ctx.fillText(text, d.x, y);
    }
    FX.drawTexts(ctx);

    // ground-aimed skills: where they land (max range, area radius) while their key is held
    const heldKey = me && !me.dead && G.skl && C.BAR_KEYS.find((k) => keys.has(k) && AIM_HINT[G.skl.bar[C.BAR_KEYS.indexOf(k)]]);
    if (heldKey) {
      const id = G.skl.bar[C.BAR_KEYS.indexOf(heldKey)], [max, R] = AIM_HINT[id](C.skillRankOf(G.skl, id));
      const w = mouseWorld();
      let tx = w.x, ty = w.y;
      const L = Math.hypot(tx - me.x, ty - me.y);
      if (L > max) { tx = me.x + ((tx - me.x) / L) * max; ty = me.y + ((ty - me.y) / L) * max; }
      ctx.strokeStyle = C.FACTIONS[me.faction].color; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(tx, ty, R, SKILL[id].ritual ? R : R * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.restore();

    FX.drawFlash(ctx, VW, VH);
    if (me) {
      HUD.drawMinimap(G.minimapBase, G.map, me, G.ents, view, !!G.mapDef.pvp);
    }
  }

  function updateTarget(now) {
    const me = G.me;
    if (!me) return;
    const w = mouseWorld();
    const sel = targetEnt();
    if (sel) { HUD.target(sel); G.hoverFoe = enemyUnderMouse(); const cur0 = G.hoverFoe ? CURSOR_ATTACK : CURSOR_MOVE; if (canvas.style.cursor !== cur0) canvas.style.cursor = cur0; return; }
    let best = null, bd = 60;
    for (const e of G.ents.values()) {
      if (e === me || e.dying || e.dead) continue;
      const h = e.kind === 'm' ? monH(e.type) : PH_HIT * sizeK(e);
      const d = Math.hypot(e.x - w.x, e.y - h * 0.5 - w.y);
      if (d < bd + (e.boss ? 60 : 0)) { bd = d; best = e; }
    }
    const o = G.order;
    const locked = o && o.type === 'attack' ? G.ents.get(o.id) : null;
    if (!best && isFoe(locked)) best = locked;
    if (!best && G.lastTarget && now - G.lastTarget.t < 4000) {
      const e = G.ents.get(G.lastTarget.id);
      if (e && !e.dying && !e.dead) best = e;
    }
    HUD.target(best);
    // cursor: sword over enemies, hand over the blacksmith
    G.hoverFoe = enemyUnderMouse();
    const cur = G.hoverFoe ? CURSOR_ATTACK : smithUnderMouse(w) || apothecaryUnderMouse(w) || enhancerUnderMouse(w) || stoneUnderMouse(w) ? 'pointer' : CURSOR_MOVE;
    if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  }
  const svgCursor = (svg, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
  const CURSOR_ATTACK = svgCursor('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M3 3 L17 17" stroke="#000" stroke-width="6" stroke-linecap="round"/><path d="M3 3 L17 17" stroke="#ffdede" stroke-width="3" stroke-linecap="round"/><path d="M14 20 L20 14 M17 17 L24 24" stroke="#000" stroke-width="5" stroke-linecap="round"/><path d="M14 20 L20 14 M17 17 L24 24" stroke="#e8403a" stroke-width="2.5" stroke-linecap="round"/></svg>', 2, 2, 'crosshair');
  const CURSOR_MOVE = svgCursor('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M2 2 L2 19 L7 14 L11 22 L14 21 L10 13 L17 13 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>', 2, 2, 'default');

  let last = performance.now();
  // movement, bot, click orders, other entities and effects: everything but drawing
  function simulate(now, maxDt) {
    const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000));
    last = now;
    G.dt = dt;
    updateMe(dt, now);
    BOT.tick(now);
    FOLLOW.tick(now);
    if (G.me) updateInteract();
    updateEnts(dt, now);
    FX.update(dt);
    checkArea(now);
    return dt;
  }
  function frame(now) {
    const dt = simulate(now, 0.05), t = now / 1000;
    easeZoom(dt);
    render(now, t);
    if (G.me && G.stats) {
      HUD.update(G.stats); updateTarget(now);
      if (G.stats.lvl !== G.lastLvl) { G.lastLvl = G.stats.lvl; INV.render(); }
      const sk = `${G.stats.atk}|${G.stats.crit}|${G.stats.mhp}|${G.stats.def}|${G.stats.spd}|${G.stats.aspd}`;
      if (sk !== G.lastStatKey) { G.lastStatKey = sk; INV.renderStats(); }
    }
    requestAnimationFrame(frame);
  }
  // A hidden or minimised tab gets no animation frames, so the bot and click orders would freeze. While hidden,
  // a worker timer (workers are not throttled like page timers) runs the simulation ~10x a second without drawing.
  let bgWorker = null;
  function setBackground(on) {
    if (on && !bgWorker) {
      try {
        const src = 'let t=null;onmessage=(e)=>{clearInterval(t);t=e.data?setInterval(()=>postMessage(0),e.data):null;};';
        bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        bgWorker.onmessage = () => { if (document.hidden) simulate(performance.now(), 0.25); };
      } catch (e) { return; }                                 // no workers: the game just pauses while hidden
    }
    if (bgWorker) bgWorker.postMessage(on ? 100 : 0);
  }
  document.addEventListener('visibilitychange', () => setBackground(document.hidden));

  boot().catch((err) => {
    console.error(err);
    document.querySelector('#loading div:last-child').textContent = 'โหลดเกมไม่สำเร็จ: ' + err.message;
  });
})();
