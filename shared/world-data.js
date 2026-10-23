// Hunting maps Lv.1-130 + the faction PvP battlefield (used by the Node server and the browser, extends C).
// Hunting maps are shared by both factions (no PvP there); ธรรมะ / อธรรม only fight on the PvP map.
// Progression modelled on Yulgang: starter village → mountain pass → demon forest → haunted manor
// → temple gate → north-sea ice palace → southern fire valley, levels rising from west (camp) to east.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const C = node ? require('./common') : root.C;
  factory(C, node ? require('./village-map') : root.VillageMap);
  if (node) module.exports = C;
})(typeof self !== 'undefined' ? self : this, function (C, Village) {
  const { TILE, T } = C;

  // ---------------- terrain themes (colours used by the client renderer) ----------------
  //   grass   ground colour (west → east)  water  [light, deep] (lava on the fire map)  trees  tree variants
  //   deco    scattered props [type, variant (-1 = random 0..2), weight]  lake  noise threshold for ponds
  const THEMES = {
    pvp: { bg: '#16301a' }, // painted by the original battlefield rules
    village: { bg: '#16301a', grass: ['#5f9c45', '#6aa44c'], path: '#a8895c', sand: '#d8c38f', field: '#86664a', plaza: '#c9b48c',
      water: ['#2f78b4', '#25639a'], spark: '#ffffff', blades: ['rgba(20,60,10,0.35)', 'rgba(200,255,150,0.22)'],
      flowers: ['#ffffff', '#9fd0ff', '#ffe27a'], trees: [0, 0, 1, 2], deco: [['bush', 0, 3], ['rock', -1, 1], ['mush', 0, 1]],
      lake: 0.7, house: 0, fence: 0 },
    canyon: { bg: '#2a2214', grass: ['#9c9058', '#a8925a'], path: '#c4a678', sand: '#dcc08a', field: '#8a6a4a', plaza: '#cdb38a',
      water: ['#3a86b0', '#2a6890'], spark: '#ffffff', blades: ['rgba(70,60,20,0.35)', 'rgba(255,240,170,0.25)'],
      flowers: ['#ffd27a', '#ff9a5a', '#ffffff'], trees: [1, 1, 0], deco: [['rock', -1, 5], ['bush', 1, 2]],
      lake: 0.76, house: 1, fence: 0, rocky: true, cliff: ['#b08c5e', '#6a4c30'] },
    forest: { bg: '#0e1a10', grass: ['#3f5c30', '#35502c'], path: '#7a6448', sand: '#a89a70', field: '#5a4a3a', plaza: '#9a8a6a',
      water: ['#2a5a6a', '#1c4250'], spark: '#c8ffda', blades: ['rgba(10,30,10,0.4)', 'rgba(150,220,120,0.18)'],
      flowers: ['#b07aff', '#7affb0', '#e0a0ff'], trees: [1, 4, 0, 1, 4], deco: [['mush', 1, 3], ['bush', 0, 2], ['rock', -1, 1]],
      lake: 0.72, house: 1, fence: 1, dense: 1.35 },
    haunted: { bg: '#121216', grass: ['#5a5c4e', '#4c4e46'], path: '#857a68', sand: '#9a9280', field: '#5a4c44', plaza: '#8a8478',
      water: ['#33465a', '#222f40'], spark: '#a8c8ff', blades: ['rgba(20,20,20,0.4)', 'rgba(200,210,190,0.15)'],
      flowers: ['#d12f2f', '#8a1a3a', '#c8c8d8'], trees: [4, 6, 4, 6, 1], deco: [['grave', -1, 4], ['pillar', -1, 2], ['rock', -1, 1]],
      lake: 0.74, house: 3, fence: 1 },
    temple: { bg: '#14261a', grass: ['#6aa24c', '#78aa56'], path: '#b8a07a', sand: '#e0cc98', field: '#8a6e50', plaza: '#e0d6c0',
      water: ['#3a90c8', '#2a70a8'], spark: '#ffffff', blades: ['rgba(20,60,10,0.3)', 'rgba(220,255,170,0.25)'],
      flowers: ['#ffb6cc', '#ffffff', '#ffe27a'], trees: [2, 1, 0, 2, 7], deco: [['pillar', -1, 2], ['bush', 0, 2], ['rock', -1, 1]],
      lake: 0.7, house: 0, fence: 0, cliff: ['#9a968a', '#58554c'] },
    ice: { bg: '#1a2430', grass: ['#e4edf6', '#d8e4f0'], path: '#aebfd2', sand: '#c8d6e6', field: '#9aaabb', plaza: '#cad8e8',
      water: ['#6aa8d8', '#3a78b8'], spark: '#ffffff', blades: ['rgba(120,150,190,0.35)', 'rgba(255,255,255,0.6)'],
      flowers: ['#9fd8ff', '#ffffff', '#c8e8ff'], trees: [5, 5, 5, 1], deco: [['crystal', -1, 4], ['rock', -1, 2]],
      lake: 0.7, house: 2, fence: 1, snow: true },
    fire: { bg: '#1a0c08', grass: ['#4c3a30', '#3e2e28'], path: '#6e4c38', sand: '#5a3a2a', field: '#3a2420', plaza: '#7a5a48',
      water: ['#ff8a2a', '#c8300a'], spark: '#ffe08a', blades: ['rgba(0,0,0,0.35)', 'rgba(255,140,60,0.18)'],
      flowers: ['#ff5a1a', '#ffb02a', '#ff2a2a'], trees: [6, 6, 3], deco: [['rock', -1, 4], ['crystal', 3, 2]],
      lake: 0.68, house: 1, fence: 1, lava: true, cliff: ['#3e2c26', '#1a0e0a'] },
  };

  // ---------------- monster art archetypes ----------------
  // base hit radius, speed, attack range/cooldown, aggro radius and visual height (×size) for each drawing
  const MON_ART = {
    wisp: { r: 20, speed: 70, range: 46, cd: 1500, aggro: 0, h: 58 },
    boar: { r: 24, speed: 110, range: 50, cd: 1400, aggro: 150, h: 52 },
    wolf: { r: 24, speed: 150, range: 52, cd: 1100, aggro: 220, h: 58 },
    golem: { r: 34, speed: 72, range: 66, cd: 1800, aggro: 200, h: 92 },
    serpent: { r: 22, speed: 95, range: 56, cd: 1300, aggro: 180, h: 52 },
    insect: { r: 24, speed: 120, range: 52, cd: 1200, aggro: 200, h: 44 },
    bird: { r: 22, speed: 160, range: 54, cd: 1150, aggro: 230, h: 72 },
    human: { r: 20, speed: 120, range: 56, cd: 1250, aggro: 220, h: 80 },
    plant: { r: 26, speed: 50, range: 60, cd: 1600, aggro: 140, h: 74 },
    dragon: { r: 40, speed: 110, range: 80, cd: 1500, aggro: 260, h: 110 },
    demon: { r: 58, speed: 88, range: 92, cd: 1600, aggro: 300, h: 196 },
  };

  // Stats follow the level so every map stays balanced against the player curve (C.statsFor + gear).
  // o: hp/atk/def/exp multipliers, size (art + radius), boss, speed, aggro, cd
  // Toughness is tuned for party play (Yulgang style): a normal monster takes a solo player ~5 s of basic attacks
  // (a party clears it much faster), a boss is a party fight (~2 min solo). EXP rises with the HP so solo levelling
  // stays close to before; the party EXP bonus (C.PARTY_BONUS) is what makes grouping pay.
  const MON_TOUGH = { hp: 2.6, atk: 1, def: 1.4, exp: 2.4 };
  // bosses: HP ×2 and DEF +25% over the first tuning (a guaranteed Unique+ is worth a longer fight)
  const BOSS_TOUGH = { hp: 120, atk: 1.5, def: 2.25, exp: 75 };
  // ---- gear gate (Lv.60+): monsters are tuned against a reference player of their level wearing GATE.grade +0 gear
  // of that level (C.WEAPONS / C.ARMORS, rolled affixes averaged over a few seeds, the class guide's stat points,
  // all four classes averaged). Their armour soaks `def` × that player's attack (damage = ATK − 0.6 × DEF) and one
  // hit takes `hit` × his max HP after his armour, so Normal / Rare +0 gear falls far behind while Epic+ or
  // enhanced (+) gear stays comfortable. The share ramps from GATE.from to MAX_LVL; it never makes a monster weaker.
  // plus: the reference outfit's enhancement (+n on all 5 pieces) at GATE.from → MAX_LVL, so high maps expect enhanced gear
  const GATE = { from: 60, grade: 2, plus: [1, 6], def: [0.12, 0.3], hit: [0.045, 0.06], boss: { def: 1.2, atk: 1.25 } };
  const gateT = (lvl) => Math.max(0, Math.min(1, (lvl - GATE.from) / (C.MAX_LVL - GATE.from)));
  const GATE_SEEDS = [101, 2027, 3301, 4409, 5521, 6637, 7741, 8853];
  const gateRefs = {};
  function gateRef(lvl) {
    if (gateRefs[lvl]) return gateRefs[lvl];
    const best = (list) => list.filter((it) => it.lvl <= lvl).at(-1);
    const bases = [best(C.WEAPONS), ...C.ARMOR_SLOTS.map((s) => best(C.ARMORS.filter((a) => a.slot === s)))];
    const plus = Math.round(GATE.plus[0] + (GATE.plus[1] - GATE.plus[0]) * gateT(lvl));
    // atk = the weakest class's (armour must not wall off the support class), def / hp = all classes averaged
    // Keep the established monster budget stable when a tank class is added.
    const referenceClasses = ['dualblade', 'taoist', 'archer', 'spearman'];
    const r = { atk: Infinity, def: 0, hp: 0 }, n = referenceClasses.length * GATE_SEEDS.length;
    for (const cls of referenceClasses) {
      const alloc = C.guidePoints(cls, {}, lvl, Infinity);
      let atk = 0;
      for (const seed of GATE_SEEDS) {
        const eq = {};
        for (const b of bases) eq[b.slot] = C.plusId(C.gradeId(b.id, GATE.grade, seed), plus);
        const s = C.playerStats(cls, lvl, eq, alloc);
        atk += s.atk * (1 + (s.fx.pve || 0)) * s.pveMult; r.def += s.def / n; r.hp += s.maxHp / n;
      }
      r.atk = Math.min(r.atk, atk / GATE_SEEDS.length);
    }
    return (gateRefs[lvl] = r);
  }
  // the gated atk / def of a monster at a level before its own multipliers (null below GATE.from)
  function gateStats(lvl, boss) {
    if (lvl < GATE.from) return null;
    const t = gateT(lvl), R = gateRef(Math.min(lvl, C.MAX_LVL));
    const lerp = ([a, b]) => a + (b - a) * t, B = boss ? GATE.boss : { def: 1, atk: 1 };
    return { def: (lerp(GATE.def) * R.atk / 0.6) * B.def, atk: (R.def * 0.6 + lerp(GATE.hit) * R.hp) * B.atk };
  }
  // ---- early levels: Lv.1-EASE.to monsters have less HP / attack so the first maps go quickly (hp / atk factor
  // [at Lv.1, at Lv.EASE.to]); they reach full strength again at Lv.EASE.full (no cliff).
  const EASE = { to: 80, full: 90, hp: [0.55, 0.85], atk: [0.65, 0.9] };
  const easeOf = (lvl, [a, b]) => (lvl >= EASE.full ? 1 : lvl <= EASE.to ? a + ((b - a) * (lvl - 1)) / (EASE.to - 1)
    : b + ((1 - b) * (lvl - EASE.to)) / (EASE.full - EASE.to));
  // ---- late game: normal monsters from Lv.LATE.from get up to LATE.hp × HP by MAX_LVL (they must take an enhanced
  // outfit to clear quickly) and LATE.exp × EXP, so an unenhanced outfit levels slower and an enhanced one faster.
  // Bosses keep their own tuning.
  const LATE = { from: 80, hp: 1.8, exp: 1.4 };
  const lateOf = (lvl, top) => 1 + (top - 1) * Math.max(0, Math.min(1, (lvl - LATE.from) / (C.MAX_LVL - LATE.from)));
  // a monster's hp / atk / def at a level before its own multipliers: base curve × toughness, the gear gate, the ease
  function monStats(lvl, boss) {
    const B = boss ? BOSS_TOUGH : MON_TOUGH, gate = gateStats(lvl, boss);
    return {
      hp: (40 + 40 * lvl + 0.7 * lvl * lvl) * B.hp * easeOf(lvl, EASE.hp) * (boss ? 1 : lateOf(lvl, LATE.hp)),
      atk: Math.max((6 + 3.6 * lvl + 0.012 * lvl * lvl) * B.atk, gate ? gate.atk : 0) * easeOf(lvl, EASE.atk),
      def: Math.max((1 + 1.05 * lvl) * B.def, gate ? gate.def : 0),
    };
  }
  function mon(id, name, lvl, art, look, o = {}) {
    const A = MON_ART[art], size = o.size || 1, boss = !!o.boss;
    const B = boss ? BOSS_TOUGH : MON_TOUGH, S = monStats(lvl, boss);
    const m = {
      name, lvl, art, look, size,
      hp: Math.round(S.hp * (o.hp || 1)),
      atk: Math.round(S.atk * (o.atk || 1)),
      def: Math.round(S.def * (o.def || 1)),
      exp: Math.max(1, Math.round((20 + 2.6 * Math.pow(lvl, 1.65)) * C.monsterExpMul(lvl) * B.exp * (boss ? 1 : lateOf(lvl, LATE.exp)) * (o.exp || 1))),
      speed: o.speed || Math.round(A.speed * (boss ? 0.85 : 1)),
      radius: Math.round(A.r * size),
      aggro: o.aggro ?? (boss ? 300 : A.aggro),
      atkRange: Math.round(A.range * (0.6 + 0.4 * size)),
      atkCd: o.cd || A.cd,
      respawn: boss ? C.BOSS_RESPAWN : 9000 + lvl * 40,
    };
    if (boss) m.boss = true;
    C.MONSTERS[id] = m;
    return id;
  }
  // the PvP boss keeps its hand-tuned stats, it just gets drawn by the demon archetype
  Object.assign(C.MONSTERS.boss, { art: 'demon', size: 1, look: null });
  C.MONSTERS.boss.hp *= 2; C.MONSTERS.boss.def = Math.round(C.MONSTERS.boss.def * 1.25);   // as tough as the map bosses' raise
  C.MONSTERS.boss.exp = Math.round(C.MONSTERS.boss.exp * C.monsterExpMul(C.MONSTERS.boss.lvl));

  // ---------------- maps ----------------
  // m: [normal monster ids in level order, the last one at the map's top level], boss: boss id (top level + 5).
  // Layout is generated by layoutField().
  const MAPS = {};
  const ORDER = [];
  function field(id, name, lv, req, theme, campName, mons, boss) {
    MAPS[id] = { id, name, lv, req, theme, campName, mons, boss };
    ORDER.push(id);
  }

  // 1 · starter village (Yulgang: หมู่บ้านเริ่มต้น)
  field('village', 'หมู่บ้านเซียนน้อย', [1, 20], 1, 'village', 'ลานหมู่บ้านเซียนน้อย', [
    mon('spirit', 'ภูตน้ำค้าง', 1, 'wisp', { c1: 'rgba(200,240,255,0.92)', c2: 'rgba(110,190,240,0.9)' }, { hp: 0.85 }),
    mon('mushroom', 'เห็ดพิษปีศาจน้อย', 3, 'plant', { kind: 'mush', cap: '#d8402a', spot: '#fff0e0', bark: '#f0e0c0', eye: '#2a1a10' }, { size: 0.7, aggro: 0 }),
    mon('boar', 'หมูป่าเขี้ยวเลื่อย', 5, 'boar', { body: '#7a4a2a', back: '#5a321c', mane: '#2f1a10', head: '#8a5632', snout: '#d9928a', eye: '#ff3b2a' }),
    mon('greensnake', 'อสรพิษหญ้าเขียว', 8, 'serpent', { body: '#4aa83a', belly: '#d8e88a', mark: '#2a6a20', eye: '#ffde3a' }),
    mon('wolf', 'หมาป่าเงาจันทร์', 12, 'wolf', { top: '#4a4060', bottom: '#2a2336', dark: '#16121c', eye: '#ff2a40', wisp: 'rgba(120,80,200,0.25)' }),
    mon('bandit', 'โจรหมวกฟาง', 16, 'human', { robe: '#6a5a3a', robe2: '#4a3a24', trim: '#a0302a', skin: '#e0b48a', hair: '#1a1410', hat: 'straw', weapon: 'sabre', wcol: '#d8dde4' }),
    mon('mountaintiger', 'เสือภูเขาลายดำ', 20, 'wolf', { top: '#d88a2a', bottom: '#a85a14', dark: '#1a0e06', eye: '#ffe07a', wisp: 'rgba(255,170,60,0.22)', stripes: '#1a0e06', cat: true }, { size: 1.1 }),
  ], mon('kingboar', 'จ้าวหมูป่าเกราะเหล็ก', 25, 'boar', { body: '#4a2a1a', back: '#2a160c', mane: '#c8c0b0', leg: '#2a160c', head: '#5a3420', snout: '#c87a70', eye: '#ffde3a', armor: '#8a8a94' }, { boss: true, size: 1.9 }));

  // 2 · mountain pass (Yulgang: ด่านหลิวเจิ้ง)
  field('pass', 'ด่านผาหลิว', [20, 40], 18, 'canyon', 'ค่ายพักด่านผาหลิว', [
    mon('scorpion', 'แมงป่องผาทราย', 22, 'insect', { kind: 'scorpion', shell: '#c89a4a', dark: '#7a5424', leg: '#6a4a20', eye: '#1a0a00', sting: '#ff6a3a' }),
    mon('passbandit', 'โจรคลุมหน้าด่านผา', 25, 'human', { robe: '#3a3a4a', robe2: '#24242e', trim: '#c8a040', skin: '#d8a882', hair: '#0e0c0a', hat: 'hood', weapon: 'spear', wcol: '#c8ccd4' }),
    mon('golem', 'ยักษ์หินผาหลิว', 28, 'golem', { rock: '#7b746a', limb: '#6b645a', head: '#857d72', leg: '#5f594f', moss: '#4f7a3a', eye: '#7ff0ff' }, { hp: 1.25, def: 1.3, exp: 1.2 }),
    mon('ironeagle', 'อินทรีปีกเหล็ก', 32, 'bird', { body: '#5a5a62', wing: '#3a3a44', wingTip: '#c8ccd4', crest: '#e8e8f0', beak: '#e8b030', tail: '#2a2a32', eye: '#ffde3a' }),
    mon('fireleopard', 'เสือดาวลายเพลิง', 36, 'wolf', { top: '#e08a2a', bottom: '#b05a14', dark: '#3a1a08', eye: '#fff07a', wisp: 'rgba(255,120,40,0.28)', spots: '#3a1a08', cat: true }),
    mon('sandnaga', 'นาคาผาทรายทอง', 40, 'serpent', { body: '#c8a050', belly: '#f0dca0', mark: '#7a5424', eye: '#ff3a2a', hood: true, horn: '#f0dca0' }, { size: 1.3 }),
  ], mon('banditlord', 'ขุนโจรดาบโลหิต', 45, 'human', { robe: '#5a1a1a', robe2: '#3a0e0e', trim: '#e8c060', skin: '#c89a78', hair: '#0e0c0a', hat: 'helm', weapon: 'sabre', wcol: '#e8eef6', cape: '#2a0808' }, { boss: true, size: 1.7 }));

  // 3 · demon forest (Yulgang: ด่านซัมซา / ป่าสามมาร)
  field('forest', 'ป่ามารสามเศียร', [40, 60], 38, 'forest', 'ค่ายพรานป่า', [
    mon('treant', 'ต้นไม้อสูรพันราก', 42, 'plant', { kind: 'tree', bark: '#4a3424', leaf: '#2a5a2a', leaf2: '#4a8a3a', eye: '#ffde3a' }),
    mon('spider', 'แมงมุมม่วงพิษร้าย', 45, 'insect', { kind: 'spider', shell: '#4a2a5a', dark: '#24122e', leg: '#2a1a34', eye: '#ff3a6a', sting: '#b07aff' }),
    mon('foxfire', 'ภูตจิ้งจอกไฟผี', 48, 'wisp', { c1: 'rgba(200,255,210,0.9)', c2: 'rgba(60,190,120,0.88)', eye: '#0a2a10', horn: '#d8ffe0', tail: true }),
    mon('demonmonk', 'นักพรตมารเงา', 52, 'human', { robe: '#3a1a4a', robe2: '#24102e', trim: '#b07aff', skin: '#c8a8b8', hair: '#e8e0f0', hat: 'none', weapon: 'staff', wcol: '#b07aff' }),
    mon('blackbear', 'หมีดำบ้าคลั่ง', 56, 'boar', { body: '#2a2224', back: '#1a1416', mane: '#0e0a0c', head: '#3a2e30', snout: '#a08070', eye: '#ff3a2a', tusk: false, ear: 'round', spikes: false }, { size: 1.25, hp: 1.3 }),
    mon('mossgiant', 'ยักษ์ตะไคร่ป่ามาร', 60, 'golem', { rock: '#4a5a3a', limb: '#3a4a2c', head: '#5a6a46', leg: '#2e3a22', moss: '#7aaa4a', eye: '#ff3a6a' }, { hp: 1.25, def: 1.3 }),
  ], mon('elderwood', 'พฤกษามารพันปี', 65, 'plant', { kind: 'tree', bark: '#3a2418', leaf: '#5a1a3a', leaf2: '#a03a6a', eye: '#ff3a3a' }, { boss: true, size: 2.1 }));

  // 4 · haunted manor (Yulgang: จวนเจ้าเมืองหลิวซาน)
  field('manor', 'จวนแม่ทัพร้าง', [60, 80], 58, 'haunted', 'ศาลเจ้าหน้าจวน', [
    mon('ghostsoldier', 'ทหารวิญญาณเฝ้าจวน', 62, 'human', { robe: '#4a5a6a', robe2: '#2a3a4a', trim: '#8aa8c8', skin: '#a8c0d0', hair: '#2a3440', hat: 'helm', weapon: 'spear', wcol: '#a8c8e8', ghost: true, eye: '#7ad8ff' }),
    mon('stonepython', 'งูหลามหินผา', 65, 'serpent', { body: '#7a7468', belly: '#b8b0a0', mark: '#4a463e', eye: '#ff6a2a', horn: '#c8c0b0' }, { size: 1.2 }),
    mon('guardstatue', 'รูปปั้นทวารบาล', 68, 'golem', { rock: '#8a8478', limb: '#6a6458', head: '#9a9488', leg: '#5a5448', moss: '#3a5a3a', eye: '#ff5a3a' }, { hp: 1.2, def: 1.3 }),
    mon('dancer', 'วิญญาณนางรำคืนจันทร์', 72, 'wisp', { c1: 'rgba(255,220,240,0.9)', c2: 'rgba(200,90,150,0.85)', eye: '#3a0a20', tail: true, veil: true }, { aggro: 160 }),
    mon('headless', 'องครักษ์ไร้เศียร', 76, 'human', { robe: '#2a2a30', robe2: '#16161a', trim: '#8a1a1a', skin: '#8a8a90', hair: '#000', hat: 'none', weapon: 'sabre', wcol: '#c8c8d0', headless: true, cape: '#5a0a0a' }, { hp: 1.15 }),
    mon('deathcrow', 'อีกาวิญญาณมรณะ', 80, 'bird', { body: '#2a2a34', wing: '#16161e', wingTip: '#7ad8ff', crest: '#7ad8ff', beak: '#c8c8d0', tail: '#16161e', eye: '#7ad8ff' }, { size: 1.2 }),
  ], mon('ghostgeneral', 'แม่ทัพผีพันศพ', 85, 'demon', { aura: '90,160,255', leg: '#1a2230', cape: '#0e1a2a', t1: '#3a5a7a', t2: '#1a2a3a', belt: '#0e141c', gem: '#7ad8ff',
    plate: '#2a3440', spike: '#c8d8e8', horn: '#c8d8e8', skin: '#4a6a8a', eye: '#bff0ff', eyeGlow: '#3aa8ff', blade: '#c8d8e8', bladeGlow: 'rgba(90,180,255,0.6)', ember: '120,190,255' }, { boss: true, size: 0.85 }));

  // 5 · temple gate (Yulgang: ประตูชินมู)
  field('temple', 'ประตูเทพยุทธ์', [80, 100], 78, 'temple', 'ลานวัดเทพยุทธ์', [
    mon('whitetiger', 'พยัคฆ์ขาวพิทักษ์', 82, 'wolf', { top: '#f0f0f4', bottom: '#c8c8d4', dark: '#1a1a22', eye: '#5ad8ff', wisp: 'rgba(160,220,255,0.25)', stripes: '#1a1a22', cat: true }, { size: 1.15 }),
    mon('firecrane', 'กระเรียนเพลิงสวรรค์', 85, 'bird', { body: '#f4f0ea', wing: '#e8e0d8', wingTip: '#1a1a1a', crest: '#e8302a', beak: '#5a4a3a', tail: '#1a1a1a', eye: '#1a0a00', fire: true }),
    mon('gatemonk', 'ภิกษุพิทักษ์ทวาร', 88, 'human', { robe: '#e8a030', robe2: '#c87a1a', trim: '#8a1a1a', skin: '#e0b48a', hair: '#000', hat: 'bald', weapon: 'staff', wcol: '#c89a4a' }),
    mon('bronzegolem', 'ยักษ์สำริดเทวาลัย', 92, 'golem', { rock: '#b07a3a', limb: '#8a5a28', head: '#c88a48', leg: '#7a4a20', moss: '#3a8a6a', eye: '#ffe07a' }, { hp: 1.25, def: 1.35 }),
    mon('jadenaga', 'พญานาคหยกมรกต', 96, 'serpent', { body: '#2ab07a', belly: '#d8f0c8', mark: '#e8c04a', eye: '#ff3a2a', hood: true, horn: '#e8c04a', glow: '#7affc8' }, { size: 1.4, hp: 1.2 }),
    mon('goldlion', 'สิงโตทองเทวาลัย', 100, 'wolf', { top: '#e8b84a', bottom: '#c8902a', dark: '#5a3a10', eye: '#ffffff', wisp: 'rgba(255,215,106,0.3)', cat: true }, { size: 1.3, hp: 1.15 }),
  ], mon('wardemon', 'ราชันอสูรสงคราม', 105, 'demon', { aura: '255,190,60', leg: '#2a1a0a', cape: '#3a1a06', t1: '#c88a2a', t2: '#5a3a0a', belt: '#2a1a08', gem: '#ff3a2a',
    plate: '#3a2a10', spike: '#ffe8a8', horn: '#ffe8a8', skin: '#8a5a1a', eye: '#ffffff', eyeGlow: '#ffb020', blade: '#ffe08a', bladeGlow: 'rgba(255,200,60,0.6)', ember: '255,200,80' }, { boss: true, size: 0.95 }));

  // 6 · north-sea ice palace (Yulgang: พระราชวังน้ำแข็งทะเลเหนือ)
  field('ice', 'วังน้ำแข็งทะเลเหนือ', [100, 115], 98, 'ice', 'ค่ายพักทะเลเหนือ', [
    mon('snowwolf', 'หมาป่าพายุหิมะ', 101, 'wolf', { top: '#e8f0f8', bottom: '#b8c8d8', dark: '#5a6a7a', eye: '#3ab0ff', wisp: 'rgba(200,230,255,0.35)' }),
    mon('icewisp', 'วิญญาณเกล็ดน้ำแข็ง', 104, 'wisp', { c1: 'rgba(230,250,255,0.95)', c2: 'rgba(90,170,240,0.9)', eye: '#0a2a4a', horn: '#ffffff' }, { aggro: 160 }),
    mon('icegolem', 'ยักษ์ธารน้ำแข็ง', 107, 'golem', { rock: '#9ac8e8', limb: '#7aa8d0', head: '#b8dcf4', leg: '#6a98c0', moss: '#ffffff', eye: '#ffffff', crack: '#ffffff' }, { hp: 1.25, def: 1.3 }),
    mon('frostserpent', 'มังกรงูน้ำแข็ง', 110, 'serpent', { body: '#8ac0e8', belly: '#e8f4ff', mark: '#3a78b8', eye: '#ffffff', horn: '#ffffff', glow: '#bfe8ff' }, { size: 1.3 }),
    mon('snowguard', 'องครักษ์วังหิมะเงิน', 113, 'human', { robe: '#d8e4f0', robe2: '#a8bcd0', trim: '#3a78b8', skin: '#e8d8d0', hair: '#c8d8e8', hat: 'helm', weapon: 'spear', wcol: '#bfe8ff', cape: '#3a5a8a' }, { hp: 1.15 }),
    mon('frostdrake', 'มังกรน้ำแข็งเยาว์', 115, 'dragon', { body: '#9ac8e8', belly: '#e8f4ff', wing: '#5a88b8', horn: '#ffffff', eye: '#3ab0ff', fire: '#bfe8ff' }),
  ], mon('icequeen', 'จักรพรรดินีหิมะนิรันดร์', 120, 'human', { robe: '#e8f4ff', robe2: '#9ac8f0', trim: '#5ab0ff', skin: '#f0e4e8', hair: '#ffffff', hat: 'crown', weapon: 'staff', wcol: '#bfe8ff', cape: '#7ab8f0', eye: '#5ad8ff' }, { boss: true, size: 1.8 }));

  // 7 · southern fire valley (Yulgang: ป่าใต้ / หุบเขาพยัคฆ์)
  field('fire', 'หุบเขาเพลิงทักษิณ', [115, 130], 112, 'fire', 'ค่ายพักหุบเขาเพลิง', [
    mon('lavascorpion', 'แมงป่องลาวาเดือด', 116, 'insect', { kind: 'scorpion', shell: '#3a2420', dark: '#1a0e0a', leg: '#2a1814', eye: '#ffde3a', sting: '#ff6a1a', lava: true }),
    mon('firetiger', 'พยัคฆ์อัคคี', 119, 'wolf', { top: '#ff7a1a', bottom: '#c8400a', dark: '#2a0a04', eye: '#ffffff', wisp: 'rgba(255,120,30,0.35)', stripes: '#2a0a04', cat: true, fire: true }, { size: 1.2 }),
    mon('lavagolem', 'ยักษ์หินหลอมเหลว', 122, 'golem', { rock: '#3a2a26', limb: '#2e201c', head: '#4a3430', leg: '#24180e', moss: '#ff6a1a', eye: '#ffde3a', crack: '#ff7a1a', lava: true }, { hp: 1.25, def: 1.3 }),
    mon('phoenix', 'หงส์ไฟฟีนิกซ์', 125, 'bird', { body: '#ff5a1a', wing: '#ff8a2a', wingTip: '#ffe07a', crest: '#ffe07a', beak: '#ffd23a', tail: '#ff3a1a', eye: '#ffffff', fire: true }, { size: 1.2 }),
    mon('firedrake', 'มังกรเพลิงเยาว์', 128, 'dragon', { body: '#c8301a', belly: '#ffb05a', wing: '#8a1a10', horn: '#3a1a10', eye: '#ffde3a', fire: '#ff8a2a' }),
    mon('flamegeneral', 'ขุนพลอัคคีนรก', 130, 'human', { robe: '#5a1a0a', robe2: '#3a0e06', trim: '#ffb02a', skin: '#c87a5a', hair: '#ff5a1a', hat: 'helm', weapon: 'spear', wcol: '#ffb02a', cape: '#8a1a0a', eye: '#ffde3a' }, { hp: 1.15 }),
  ], mon('elderdragon', 'มังกรอัคคีบรรพกาล', 135, 'dragon', { body: '#5a0a10', belly: '#e8a040', wing: '#2a0408', horn: '#e8d8b0', eye: '#fff07a', fire: '#ffb02a' }, { boss: true, size: 2 }));

  // the faction battlefield (the original two-base map), entered from any camp's teleport stone
  MAPS.pvp = { id: 'pvp', name: 'สนามรบธรรมะ-อธรรม', lv: [10, 130], req: 10, theme: 'pvp', pvp: true, w: C.MAP_W, h: C.MAP_H,
    zones: C.ZONES, stones: C.STONES, mons: [], boss: 'boss' };
  ORDER.push('pvp');

  // ---------------- layout of the hunting maps ----------------
  // Every map has its own structure (TEMPLATES): size, where the camp sits and which sides it opens to, the
  // monster grounds in level order (two per monster type; the last pair, by the lair, is the map's top level), roads, the boss lair, the exit gate and a paint()
  // for the terrain (rivers, canyon cliffs, terraces, frozen lake, lava ...). The camp is always a 19x21 fenced
  // safe zone with houses, the smith, the teleport stone and the gate back to the previous map.
  const ctr = (o) => { o.x = o.tx * TILE + TILE / 2; o.y = o.ty * TILE + TILE / 2; return o; };
  const segD = (px, py, x0, y0, x1, y1) => {
    const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy;
    const t = L ? Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / L)) : 0;
    return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
  };
  const polyD = (px, py, pts) => { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(px, py, ...pts[i - 1], ...pts[i])); return d; };

  const TEMPLATES = {
    // หมู่บ้านกลางทุ่ง: the village in the middle, a river to the west, grounds spreading out in a ring
    village: {
      w: 128, h: 96, camp: [55, 38, 'EW'], next: [124, 48], lair: [62, 10, 6.5], trees: 1, ponds: 0.74,
      slots: [[46, 30], [46, 66], [26, 28], [26, 68], [12, 14], [12, 82], [86, 26], [86, 70], [102, 16], [102, 80], [114, 32], [114, 64], [77, 14], [68, 25]],
      roads: [[3, [54, 48], [36, 48], [18, 48]], [2, [18, 48], [18, 30], [12, 14]], [2, [18, 48], [18, 66], [12, 82]],
        [2, [46, 48], [46, 30]], [2, [46, 48], [46, 66]], [2, [26, 48], [26, 28]], [2, [26, 48], [26, 68]],
        [3, [74, 48], [124, 48]], [2, [90, 48], [90, 26], [102, 16], [114, 32]], [2, [90, 48], [90, 70], [102, 80], [114, 64]],
        [2, [90, 26], [76, 16], [62, 10]]],
      paint(P) { P.river((y) => 36 + Math.sin(y * 0.09) * 3 + Math.sin(y * 0.21 + 1) * 1.3, 2.2); },
    },
    // หุบผาคดเคี้ยว: a winding canyon between cliff walls, monster basins in its bends
    pass: {
      w: 150, h: 72, camp: [2, 26, 'E'], next: [147, 30], lair: [128, 21, 7], trees: 0.45,
      line: [[21, 36], [34, 36], [46, 24], [62, 18], [78, 26], [90, 42], [104, 52], [120, 44], [134, 30], [147, 30]],
      slots: [[32, 27], [40, 43], [50, 14], [57, 29], [70, 13], [75, 34], [92, 32], [85, 48], [104, 61], [112, 40], [128, 37], [101, 47]],
      roads: [[3, [21, 36], [34, 36], [46, 24], [62, 18], [78, 26], [90, 42], [104, 52], [120, 44], [134, 30], [147, 30]], [2, [128, 34], [128, 21]]],
      paint(P, D) {
        P.fill(T.CLIFF);
        P.each((x, y) => { if (polyD(x + 0.5, y + 0.5, D.line) <= 7.5 + P.fbm(x / 7, y / 7) * 4) P.set(x, y, T.GRASS); });
        P.rect(0, 22, 24, 50, T.GRASS);
      },
    },
    // ป่าวงกต: dense forest, clearings joined by branching trails, the camp in the south
    forest: {
      w: 112, h: 112, camp: [46, 89, 'N'], next: [108, 26], lair: [56, 12, 7], forest: 0.62,
      slots: [[38, 78], [72, 78], [24, 60], [88, 60], [18, 40], [94, 40], [34, 22], [78, 22], [44, 46], [66, 46], [56, 28], [33, 35]],
      roads: [[3, [55, 88], [55, 64]], [2, [55, 78], [38, 78]], [2, [55, 78], [72, 78]], [2, [55, 64], [24, 60], [18, 40], [34, 22]],
        [2, [55, 64], [88, 60], [94, 40], [78, 22]], [2, [55, 64], [44, 46], [56, 28], [56, 12]], [2, [55, 64], [66, 46], [56, 28]],
        [2, [34, 22], [56, 12], [78, 22]], [2, [78, 22], [96, 24], [108, 26]]],
      paint(P) { P.disc(88, 92, 6, T.WATER); P.disc(18, 94, 5, T.WATER); P.disc(30, 6, 4, T.WATER); },
    },
    // จวนร้าง: a walled compound (north hall + two south courtyards), a graveyard outside
    manor: {
      w: 120, h: 96, camp: [4, 70, 'E'], next: [115, 6], lair: [65, 24, 6], trees: 0.8,
      slots: [[38, 82], [58, 86], [96, 84], [112, 62], [47, 54], [83, 54], [14, 40], [110, 36], [40, 22], [90, 22], [65, 9], [53, 15]],
      roads: [[3, [23, 80], [65, 80], [65, 67], [65, 30]], [2, [65, 80], [96, 84], [112, 62], [110, 36], [112, 26]],
        [2, [100, 26], [112, 26], [115, 6]], [2, [30, 52], [14, 52], [14, 40]], [2, [65, 54], [47, 54]], [2, [65, 54], [83, 54]],
        [2, [65, 34], [40, 22]], [2, [65, 34], [90, 22]]],
      walls: { x0: 30, y0: 12, x1: 100, y1: 66, mid: 40, divider: 65,
        gaps: [['S', 63, 67], ['E', 24, 28], ['W', 50, 54], ['H', 45, 48], ['H', 63, 67], ['H', 82, 85], ['V', 51, 55]] },
      graveyard: [78, 72, 116, 92],
      paint(P, D) {
        const w = D.walls;
        P.rect(w.x0, w.y0, w.x1, w.y1, T.FIELD);
      },
    },
    // ขั้นบันไดภูเขา: three terraces split by cliffs, a grand stair to the temple on the summit
    temple: {
      w: 128, h: 96, camp: [55, 74, 'N'], next: [122, 14], lair: [64, 18, 6], trees: 1, hall: [64, 8],
      slots: [[30, 82], [98, 82], [24, 58], [104, 58], [46, 58], [82, 58], [26, 38], [102, 38], [46, 38], [82, 38], [52, 9], [76, 9]],
      roads: [[4, [64, 73], [64, 14]], [2, [30, 72], [98, 72]], [2, [30, 72], [30, 82]], [2, [98, 72], [98, 82]],
        [2, [30, 72], [30, 38]], [2, [98, 72], [98, 38]], [2, [24, 58], [104, 58]], [2, [26, 38], [102, 38]], [2, [64, 14], [122, 14]]],
      paint(P) {
        for (const [y, stairs] of [[68, [[62, 66], [28, 31], [96, 99]]], [48, [[62, 66], [28, 31], [96, 99]]], [28, [[62, 66]]]])
          for (let x = 4; x < 124; x++) if (!stairs.some(([a, b]) => x >= a && x <= b)) { P.set(x, y, T.CLIFF); P.set(x, y + 1, T.CLIFF); }
        P.rect(50, 6, 78, 26, T.PLAZA);
        P.disc(10, 88, 6, T.WATER); P.disc(118, 88, 6, T.WATER);
      },
    },
    // ทะเลสาบน้ำแข็ง: a frozen lake you can walk on, islands, holes of open water, the palace island in the middle
    ice: {
      w: 128, h: 100, camp: [2, 40, 'E'], next: [124, 50], lair: [66, 50, 6.5], trees: 0.9,
      slots: [[26, 14], [26, 86], [40, 34], [40, 66], [60, 22], [60, 80], [88, 30], [88, 72], [110, 18], [110, 84], [62, 35], [51, 46]],
      roads: [[3, [21, 50], [124, 50]], [2, [26, 14], [26, 86]], [2, [110, 18], [110, 84]]],
      paint(P, D) {
        P.each((x, y) => { if (((x + 0.5 - 66) / 48) ** 2 + ((y + 0.5 - 50) / 36) ** 2 <= 1 + P.fbm(x / 6, y / 6) * 0.25 - 0.1) P.set(x, y, T.ICE); });
        for (const [cx, cy] of [[60, 22], [60, 80]]) P.disc(cx, cy, 6.5, T.GRASS);
        P.disc(66, 50, 9.5, T.GRASS);
        for (let i = 0; i < 16; i++) {                       // holes in the ice, away from grounds and the road
          const x = 24 + P.rand() * 84, y = 18 + P.rand() * 64;
          if (Math.abs(y - 50) < 5 || D.slots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 10) || Math.hypot(x - 66, y - 50) < 14) continue;
          P.disc(x, y, 1.5 + P.rand() * 2, T.WATER, (t) => t === T.ICE);
        }
      },
    },
    // ปล่องภูเขาไฟ: the boss in the crater, lava rivers flowing out to the four corners
    fire: {
      w: 128, h: 96, camp: [4, 72, 'E'], lair: [70, 38, 6.5], trees: 0.5,
      slots: [[38, 84], [58, 88], [30, 66], [88, 80], [16, 34], [110, 64], [30, 22], [108, 32], [54, 14], [88, 12], [70, 56], [83, 54]],
      roads: [[3, [23, 82], [70, 82], [70, 44]], [2, [70, 82], [88, 80], [110, 64], [108, 32], [88, 12]],
        [2, [38, 84], [30, 66], [16, 34], [30, 22], [54, 14]], [2, [54, 14], [88, 12]]],
      paint(P) {
        for (const pts of [[[62, 30], [44, 20], [30, 8], [22, 0]], [[80, 29], [96, 18], [110, 6], [118, 0]], [[58, 44], [40, 50], [22, 56], [0, 60]], [[83, 44], [100, 50], [116, 48], [128, 54]]])
          P.lava(pts, 1.6);
        P.each((x, y) => {
          const d = Math.hypot(x + 0.5 - 70, y + 0.5 - 38), a = Math.atan2(y + 0.5 - 38, x + 0.5 - 70);
          if (d < 11) P.set(x, y, T.FIELD);
          else if (d < 14.5 && Math.abs(a - Math.PI / 2) > 0.33) P.set(x, y, T.CLIFF);
        });
      },
    },
  };

  TEMPLATES.village = Village.template;
  C.VILLAGE = Village;
  // camp interior (shared so the client knows where the smith / stone / gate are). open = sides with a gap.
  function campLayout(x0, y0, open) {
    const x1 = x0 + 18, y1 = y0 + 20, mx = x0 + 9, my = y0 + 10, main = open[0];
    const L = { camp: { x0, y0, x1, y1, open }, mx, my };
    L.spawn = ctr({ tx: mx, ty: my + 1 });
    L.smith = open.includes('N') ? { tx: x0 + 3, ty: my } : { tx: mx - 1, ty: y0 + 2 };
    L.smith.x = (L.smith.tx + 1) * TILE; L.smith.y = (L.smith.ty + 1) * TILE - 4;
    // second shop building (ร้านขายยา), same look as the smith's — a few tiles over so it never overlaps
    L.apothecary = open.includes('N') ? { tx: x0 + 3, ty: my + 4 } : { tx: mx + 1, ty: y0 + 2 };
    L.apothecary.x = (L.apothecary.tx + 1) * TILE; L.apothecary.y = (L.apothecary.ty + 1) * TILE - 4;
    L.stone = ctr(open.includes('N') ? { tx: x1 - 5, ty: my } : { tx: x0 + 5, ty: y1 - 5 });
    L.backGate = main === 'E' ? { tx: x0 + 2, ty: my } : main === 'W' ? { tx: x1 - 2, ty: my } : { tx: mx, ty: y1 - 2 };
    L.lanterns = [];
    for (const s of open) {
      if (s === 'E') L.lanterns.push([x1 - 1, my - 3], [x1 - 1, my + 3]);
      if (s === 'W') L.lanterns.push([x0 + 1, my - 3], [x0 + 1, my + 3]);
      if (s === 'N') L.lanterns.push([mx - 3, y0 + 1], [mx + 3, y0 + 1]);
    }
    return L;
  }
  const inGap = (c, x, y) => (c.open.includes('E') && x === c.x1 && Math.abs(y - (c.y0 + 10)) <= 2) ||
    (c.open.includes('W') && x === c.x0 && Math.abs(y - (c.y0 + 10)) <= 2) ||
    (c.open.includes('N') && y === c.y0 && Math.abs(x - (c.x0 + 9)) <= 2);

  ORDER.forEach((id, i) => {
    const d = MAPS[id];
    d.idx = i;
    if (d.pvp) return;
    const tp = TEMPLATES[id];
    d.tpl = tp;
    d.w = tp.w; d.h = tp.h;
    const L = id === 'village' ? Village.layout() : campLayout(...tp.camp);
    Object.assign(d, { camp: L.camp, spawn: L.spawn, smith: L.smith, apothecary: L.apothecary, stone: L.stone, lanterns: L.lanterns });
    const prev = ORDER[i - 1], next = ORDER[i + 1];
    d.gates = [];
    if (i > 0) d.gates.push(ctr({ ...L.backGate, to: prev, back: true }));
    if (next && !MAPS[next].pvp && tp.next) d.gates.push(ctr({ tx: tp.next[0], ty: tp.next[1], to: next }));
    d.zones = [];
    d.mons.forEach((type, k) => {
      const name = `ถิ่น${C.MONSTERS[type].name}`;
      for (const [sx, sy] of tp.slots.slice(k * 2, k * 2 + 2))
        // 10 monsters per area, living in 3 packs (server: packs pick their spot, members stay close and help each other)
        d.zones.push({ type, x0: sx - 6, y0: sy - 6, x1: sx + 6, y1: sy + 6, cx: sx, cy: sy, count: 10, packs: 3, name });
    });
    d.lair = { tx: tp.lair[0], ty: tp.lair[1], r: tp.lair[2] };
    d.zones.push({ type: d.boss, x0: d.lair.tx - 1, y0: d.lair.ty - 1, x1: d.lair.tx + 1, y1: d.lair.ty + 1, count: 1,
      name: `รังของ${C.MONSTERS[d.boss].name}`, fixed: true });
  });
  // arrival point for a gate: 3 tiles in front of the matching gate on the other map (toward the camp for the
  // gate back, toward the middle of the map for the exit gate), or the camp
  function arrival(to, from) {
    const d = MAPS[to];
    if (d.pvp) return null;
    const g = d.gates.find((q) => q.to === from);
    if (!g) return { x: d.spawn.x, y: d.spawn.y };
    const tx = g.back ? d.spawn.x : (d.w * TILE) / 2, ty = g.back ? d.spawn.y : (d.h * TILE) / 2;
    const L = Math.hypot(tx - g.x, ty - g.y) || 1;
    return { x: g.x + ((tx - g.x) / L) * 3 * TILE, y: g.y + ((ty - g.y) / L) * 3 * TILE };
  }

  // ---------------- loot by level ----------------
  // weapon / armour set nearest to the monster level (+4), plus the tier below
  const WEAP = C.WEAPONS.slice(1);
  const SETS = C.ARMOR_SETS.map((s, i) => ({ ...s, tier: i + 1 })).sort((a, b) => a.lvl - b.lvl);
  const nearIdx = (list, lvl) => { let i = 0; while (i + 1 < list.length && list[i + 1].lvl <= lvl + 4) i++; return i; };
  const setIds = (i) => ['sh', 'pa', 'br', 'sd'].map((p) => p + SETS[i].tier);
  function lootFor(id) {
    const m = C.MONSTERS[id], L = m.lvl;
    const wi = nearIdx(WEAP, L), si = nearIdx(SETS, L);
    if (m.boss) {
      const items = [];
      for (let k = 0; k <= 2; k++) if (WEAP[wi - k]) items.push([WEAP[wi - k].id, [30, 40, 30][k]]);
      if (WEAP[wi + 1]) items.push([WEAP[wi + 1].id, 4]);
      for (let k = 0; k <= 1; k++) if (si - k >= 0) for (const a of setIds(si - k)) items.push([a, [12, 16][k]]);
      if (si + 1 < SETS.length) for (const a of setIds(si + 1)) items.push([a, 2]);
      return { gold: [L * 20, L * 32], pickOne: true, items };
    }
    const items = [[WEAP[wi].id, 0.012]];
    if (wi > 0) items.push([WEAP[wi - 1].id, 0.016]);
    for (const a of setIds(si)) items.push([a, 0.01]);
    if (si > 0) for (const a of setIds(si - 1)) items.push([a, 0.013]);
    return { gold: [Math.round(2 + L * 0.8), Math.round(5 + L * 1.5)], items };
  }
  for (const id of Object.keys(C.MONSTERS)) if (id !== 'boss') C.DROPS[id] = lootFor(id);
  // Drop guide (world map 📖): what one monster type drops. Weapons one row each, the 4 armour pieces of a set as one row.
  //   chance  monsters: chance per kill (items roll in order and the first hit wins, as in World.rollLoot)
  //           bosses:   share of the one guaranteed item (it goes to the top damage dealer)
  //   high    Epic+ grades can roll (C.canDropHigh) · any = chance of some item per kill
  C.dropGuide = function (type) {
    const m = C.MONSTERS[type], D = C.DROPS[type];
    if (!m || !D) return null;
    const boss = !!m.boss, total = D.pickOne ? D.items.reduce((a, [, w]) => a + w, 0) : 1;
    const rows = new Map();
    let miss = 1;
    for (const [id, w] of D.items) {
      const it = C.ITEMS[id];
      if (!it) continue;
      const armor = it.slot !== 'weapon', key = armor ? `set${it.tier}` : id;
      const chance = D.pickOne ? w / total : miss * w;
      if (!D.pickOne) miss *= 1 - w;
      if (!rows.has(key)) rows.set(key, { kind: armor ? 'armor' : 'weapon', lvl: it.lvl, tier: it.tier, ids: [], chance: 0, high: boss || C.canDropHigh(m.lvl, it.lvl) });
      const r = rows.get(key);
      r.ids.push(id); r.chance += chance;
    }
    const items = [...rows.values()].sort((a, b) => (a.kind === 'weapon' ? 0 : 1) - (b.kind === 'weapon' ? 0 : 1) || b.lvl - a.lvl);
    const g = C.gradeChances(m.lvl, m.lvl, boss);                 // Unique+ odds of an item at the monster's level
    return { type, name: m.name, lvl: m.lvl, boss, gold: D.gold, any: D.pickOne ? 1 : 1 - miss, items, high: g.slice(3) };
  };
  // English appearance of every monster (tools/build-monsters.js writes the AI sprite prompts from it)
  const LOOKS_EN = {
    spirit: 'a small round floating dew spirit, translucent pale-blue jelly body, big cute dark eyes, wispy tail, no legs',
    mushroom: 'a small walking toadstool, red cap with white spots, cream stem body with a grumpy face and tiny feet',
    boar: 'a wild boar with brown bristly fur, spiky dark mane along the back, curved ivory tusks, glowing red eyes',
    greensnake: 'a coiled green grass snake with a pale yellow belly, darker green diamond markings, yellow eyes, forked tongue',
    wolf: 'a lean shadow wolf with dark violet-grey fur, wisps of purple shadow smoke, glowing red eyes, bushy tail',
    bandit: 'a human mountain bandit in a patched brown robe, wide straw hat, red sash, holding a curved sabre',
    kingboar: 'a huge boss boar, dark brown fur, silver-white mane, iron armour plates riveted on its back, golden eyes, giant tusks',
    scorpion: 'a giant sand scorpion with a tan segmented shell, big pincers, tail curled high with an orange stinger',
    passbandit: 'a hooded canyon bandit in dark grey clothes with gold trim, face hidden by a hood, holding a long spear',
    golem: 'a hulking rock golem made of grey boulders, moss on the shoulders, glowing cyan eyes and a cyan crack on the chest',
    ironeagle: 'a large steel-grey eagle with metallic feathers, white crest, yellow beak and talons, wings spread while hovering',
    fireleopard: 'an orange fire leopard with dark spots, flames flickering along its back, bright yellow eyes',
    banditlord: 'a big boss bandit lord in a blood-red robe with gold trim, iron helmet, dark cape, wielding a huge sabre',
    treant: 'a walking demon tree, dark bark trunk with an angry face, root legs, branch arms, green leafy crown, yellow glowing eyes',
    spider: 'a giant purple venom spider with a dark abdomen marked with a glowing violet diamond, eight long legs, red eyes',
    foxfire: 'a floating fox-fire spirit, pale green ghostly flame body with small fox ears and a flame tail',
    demonmonk: 'a demonic monk in dark purple robes, white hair, pale skin, holding a staff topped with a glowing violet orb',
    blackbear: 'a massive black bear with thick dark fur, round ears, open roaring mouth, glowing red eyes',
    elderwood: 'a giant ancient demon tree boss, gnarled dark trunk, crimson-pink corrupted leaves, glowing red eyes and a gaping mouth',
    ghostsoldier: 'a translucent ghost soldier in blue-grey armour and helmet, faded legs, glowing cyan eyes, holding a spear',
    stonepython: 'a large python with stone-grey rocky scales, bone horns on the head, orange eyes',
    guardstatue: 'an animated temple guardian statue of grey carved stone, moss in the cracks, glowing red eyes',
    dancer: 'a floating ghost dancer, pale pink translucent body, long flowing ribbon sleeves, sad dark eyes',
    headless: 'a headless armoured bodyguard in black lacquered armour with a dark red cape, blue ghost flame where the head should be, holding a sabre',
    ghostgeneral: 'a towering ghost general boss in dark steel-blue armour, horned helmet, pale blue skin, glowing white eyes, giant cleaver blade',
    whitetiger: 'a white tiger with black stripes and icy blue eyes, noble guardian pose',
    firecrane: 'an elegant red-crowned crane with white feathers and black wing tips, trailing small flames',
    gatemonk: 'a bald warrior monk in saffron-orange robes with a red sash, holding a wooden staff',
    bronzegolem: 'a temple golem of polished bronze plates, green patina, glowing golden eyes',
    jadenaga: 'a jade-green naga serpent with a hooded head, golden horns and golden markings, glowing aura',
    wardemon: 'a colossal war demon king boss in golden-bronze armour, ivory horns, spiked shoulder plates, giant cleaver, burning eyes',
    snowwolf: 'a white snow wolf with frosty blue-grey shading, icy blue eyes, breath of cold mist',
    icewisp: 'a floating ice wisp spirit, crystal-blue translucent body with small white ice horns',
    icegolem: 'a golem made of pale blue ice blocks, white frost cracks, glowing white eyes',
    frostserpent: 'a frost serpent with pale ice-blue scales, white horns, frozen glowing aura',
    snowguard: 'an ice palace guard in white-silver armour and helmet, blue trim and cape, holding an ice spear',
    icequeen: 'a tall ice empress boss in white and ice-blue robes, crystal crown, long white hair, staff with a frozen orb',
    lavascorpion: 'a black obsidian scorpion with glowing lava cracks, orange molten stinger',
    firetiger: 'a blazing orange tiger with black stripes, its back wreathed in flames, white glowing eyes',
    lavagolem: 'a golem of dark volcanic rock with glowing orange lava seams and flames on the shoulders',
    phoenix: 'a phoenix of orange and gold flames, long burning tail feathers, wings spread',
    firedrake: 'a young red fire drake with bat-like wings, orange belly, dark horns, breathing small flames',
    mountaintiger: 'a mountain tiger with orange fur and thick black stripes, golden eyes, muscular build',
    sandnaga: 'a large golden sand naga serpent with a cobra hood, cream belly, brown markings, red eyes',
    mossgiant: 'a hulking stone giant overgrown with green moss and vines, dark mossy rock body, glowing pink eyes',
    deathcrow: 'a large ghostly black crow with icy blue wing tips and crest, glowing pale blue eyes',
    goldlion: 'a majestic golden temple lion guardian with a thick mane, white glowing eyes, golden aura',
    frostdrake: 'a young ice dragon with pale blue scales, white belly and horns, frosty breath, blue eyes',
    flamegeneral: 'an infernal flame general in dark red armour and helmet, fiery orange hair, burning cape, flaming spear',
    elderdragon: 'an ancient elder fire dragon boss, dark crimson scales, golden belly, huge wings, ivory horns, fire breath',
    boss: 'a colossal blood demon king boss in crimson armour, ivory curved horns, spiked pauldrons, black cape, giant cleaver, burning yellow eyes',
  };
  for (const id of Object.keys(LOOKS_EN)) if (C.MONSTERS[id]) C.MONSTERS[id].en = LOOKS_EN[id];
  C.MONSTER_TYPES = Object.keys(C.MONSTERS);
  // One signature attack per high-level species. Geometry is shared with the warning renderer.
  C.MONSTER_SKILLS = {
    wolf: { name: 'เขี้ยวฉีกวิญญาณ', shape: 'cone', range: 180, angle: 1.15, cast: 1100, cd: 9000, power: 1.6, color: '#ed795d' },
    boar: { name: 'เขี้ยวทะลวง', shape: 'cone', range: 180, angle: 1.1, cast: 1200, cd: 10000, power: 1.7, color: '#d99e64' },
    bird: { name: 'ฝนขนนกพิฆาต', shape: 'circle', range: 330, radius: 86, cast: 1300, cd: 10000, power: 1.6, color: '#cba5e8' },
    human: { name: 'คลื่นอาวุธสังหาร', shape: 'cone', range: 220, angle: .9, cast: 1200, cd: 10000, power: 1.7, color: '#e8bd69' },
    golem: { name: 'ปฐพีแตกสลาย', shape: 'circle', range: 170, radius: 150, self: true, cast: 1500, cd: 11000, power: 1.8, color: '#d4a775' },
    serpent: { name: 'ลมหายใจอสรพิษ', shape: 'cone', range: 235, angle: 1.0, cast: 1300, cd: 10000, power: 1.6, color: '#9aca73' },
    wisp: { name: 'ผนึกวิญญาณระเบิด', shape: 'circle', range: 300, radius: 92, cast: 1400, cd: 11000, power: 1.7, color: '#8cd9ee' },
    insect: { name: 'พิษเข็มมรณะ', shape: 'circle', range: 270, radius: 82, cast: 1200, cd: 9500, power: 1.6, color: '#b2ca63' },
    plant: { name: 'หนามกลืนชีพ', shape: 'circle', range: 250, radius: 95, cast: 1400, cd: 10500, power: 1.6, color: '#9fc079' },
    dragon: { name: 'ลมหายใจมังกร', shape: 'cone', range: 290, angle: 1.25, cast: 1600, cd: 12000, power: 1.9, color: '#f38b50' },
    demon: { name: 'อาณาเขตอสูร', shape: 'circle', range: 240, radius: 200, self: true, cast: 1600, cd: 12000, power: 1.9, color: '#de5d72' },
  };
  for(const m of Object.values(C.MONSTERS))if(m.lvl>=80)m.skill={...C.MONSTER_SKILLS[m.art],id:m.art};
  C.monsterSkillContains=(cast,x,y)=>{
    const dx=x-cast.x,dy=y-cast.y,r=Math.hypot(dx,dy);
    if(cast.shape==='circle')return r<=cast.radius;
    return r<=cast.range&&(r<1||Math.cos(Math.atan2(dy,dx)-cast.a)>=Math.cos(cast.angle/2));
  };

  // ---------------- generator ----------------
  function generateField(def, seed) {
    if (def.id === 'village') return Village.generate(def, seed);
    const W = def.w, H = def.h, th = THEMES[def.theme], tp = def.tpl;
    const rand = C.mulberry32(seed);
    const noise = C.makeNoise(rand);
    const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + noise(x * 4.3 + 3, y * 4.3 + 31) * 0.1;
    const tiles = new Uint8Array(W * H), solid = new Uint8Array(W * H), used = new Uint8Array(W * H);
    const objects = [];
    const id = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const get = (x, y) => (inb(x, y) ? tiles[id(x, y)] : -1);
    const set = (x, y, t) => { if (inb(x, y)) tiles[id(x, y)] = t; };
    const px = (tx) => tx * TILE + TILE / 2;
    const addObj = (t, v, tx, ty, isSolid, ox = 0, oy = 0) => {
      objects.push([t, v, Math.round(px(tx) + ox), Math.round(ty * TILE + TILE - 6 + oy)]);
      if (inb(tx, ty)) { used[id(tx, ty)] = 1; if (isSolid) solid[id(tx, ty)] = 1; }
    };
    const block = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { solid[id(x, y)] = 1; used[id(x, y)] = 1; }
    };
    // painter handed to the template's terrain
    const P = {
      W, H, rand, fbm, set, get,
      each(fn) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fn(x, y); },
      fill(t) { tiles.fill(t); },
      rect(x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); },
      disc(cx, cy, r, t, only) {
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && (!only || only(get(x, y)))) set(x, y, t);
      },
      // north-south river whose centre is cx(y)
      river(cx, half) { for (let y = 0; y < H; y++) { const c = cx(y); for (let x = Math.floor(c - half - 1); x <= c + half + 1; x++) if (Math.abs(x + 0.5 - c) <= half) set(x, y, T.WATER); } },
      // lava / water along a polyline, wobbling with noise
      lava(pts, half) { P.each((x, y) => { if (polyD(x + 0.5, y + 0.5, pts) <= half + fbm(x / 5, y / 5) * 1.6) set(x, y, T.WATER); }); },
    };
    const cp = def.camp, lair = def.lair;
    const nearCamp = (x, y, m) => x >= cp.x0 - m && x <= cp.x1 + m && y >= cp.y0 - m && y <= cp.y1 + m;
    const nearLair = (x, y, m) => Math.hypot(x - lair.tx, y - lair.ty) <= lair.r + m;
    const onRoad = (x, y, extra = 0) => tp.roads.some(([w, ...pts]) => polyD(x + 0.5, y + 0.5, pts) <= w / 2 + extra);

    // 1. terrain of this map
    if (tp.paint) tp.paint(P, tp);
    if (tp.ponds) for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      if (nearCamp(x, y, 4) || nearLair(x, y, 3) || onRoad(x, y, 2) || get(x, y) !== T.GRASS) continue;
      if (fbm(x / 10 + 40, y / 10 + 20) > tp.ponds) set(x, y, T.WATER);
    }
    // 2. the monster grounds are always open ground (no cliff, no water)
    for (const [sx, sy] of tp.slots) P.disc(sx, sy, 6.5, T.GRASS, (t) => t === T.CLIFF || t === T.WATER);
    // 3. shore sand round water (not on ice)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (get(x, y) !== T.GRASS) continue;
      let wet = false;
      for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) === T.WATER) { wet = true; break; }
      if (wet) set(x, y, T.SAND);
    }
    // 4. camp plaza + boss lair arena
    for (let y = cp.y0; y <= cp.y1; y++) for (let x = cp.x0; x <= cp.x1; x++) set(x, y, T.PLAZA);
    P.disc(lair.tx + 0.5, lair.ty + 0.5, lair.r, T.FIELD);
    // 5. roads: bridges over water, cut through cliffs, ice stays ice
    for (const [w, ...pts] of tp.roads) P.each((x, y) => {
      if (polyD(x + 0.5, y + 0.5, pts) > w / 2) return;
      const t = get(x, y);
      if (t === T.WATER) set(x, y, T.BRIDGE);
      else if (t === T.GRASS || t === T.SAND || t === T.CLIFF) set(x, y, T.PATH);
    });

    // 6. camp: fence with gaps on its open sides, houses, smith, teleport stone, lanterns
    for (let x = cp.x0; x <= cp.x1; x++) for (const y of [cp.y0, cp.y1]) if (!inGap(cp, x, y)) addObj('fence', th.fence, x, y, true);
    for (let y = cp.y0 + 1; y < cp.y1; y++) for (const x of [cp.x0, cp.x1]) if (!inGap(cp, x, y)) addObj('fence', th.fence, x, y, true);
    for (const [hx, hy] of [[cp.x0 + 3, cp.y0 + 3], [cp.x1 - 3, cp.y0 + 3], [cp.x0 + 3, cp.y1 - 2], [cp.x1 - 3, cp.y1 - 2]]) {
      block(hx - 1, hy - 1, hx + 1, hy);
      objects.push(['house', th.house, px(hx), (hy + 1) * TILE - 2]);
    }
    const sm = def.smith;
    block(sm.tx, sm.ty, sm.tx + 1, sm.ty);
    objects.push(['smith', 0, sm.x, sm.y]);
    const ap = def.apothecary;
    block(ap.tx, ap.ty, ap.tx + 1, ap.ty);
    objects.push(['apothecary', 0, ap.x, ap.y]);   // ร้านขายยา: a second building, same look as the blacksmith
    block(def.stone.tx, def.stone.ty, def.stone.tx, def.stone.ty);
    objects.push(['stone', 0, def.stone.x, (def.stone.ty + 1) * TILE - 6]);
    for (const [lx, ly] of def.lanterns) addObj('lantern', 0, lx, ly, true);
    for (const g of def.gates) objects.push(['gate', ORDER.indexOf(g.to), g.x, g.y + TILE / 2 - 6]);
    // lair: broken pillars around the boss arena
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const tx = Math.round(lair.tx + Math.cos(a) * (lair.r + 0.8)), ty = Math.round(lair.ty + Math.sin(a) * (lair.r + 0.8));
      const t = get(tx, ty);
      if (t === T.PATH || t === T.BRIDGE || t === T.WATER || t === T.CLIFF) continue;
      addObj(def.theme === 'ice' ? 'crystal' : 'pillar', def.theme === 'ice' ? i % 3 : i % 3, tx, ty, true);
    }

    // 7. map-specific buildings
    if (tp.walls) {                        // manor compound: outer walls, a divider in the south half, gates
      const w = tp.walls, gap = (side, v) => w.gaps.some(([s, a, b]) => s === side && v >= a && v <= b);
      const wall = (x, y, tower) => { if (get(x, y) === T.PATH) return; addObj(tower ? 'tower' : 'wall', 1, x, y, true, 0, 6); };
      for (let x = w.x0; x <= w.x1; x++) {
        if (!gap('N', x)) wall(x, w.y0, x === w.x0 || x === w.x1);
        if (!gap('S', x)) wall(x, w.y1, x === w.x0 || x === w.x1);
        if (!gap('H', x) && x > w.x0 && x < w.x1) wall(x, w.mid, false);
      }
      for (let y = w.y0 + 1; y < w.y1; y++) {
        if (!gap('W', y)) wall(w.x0, y, false);
        if (!gap('E', y)) wall(w.x1, y, false);
        if (y > w.mid && !gap('V', y)) wall(w.divider, y, false);
      }
    }
    if (tp.graveyard) {
      const [x0, y0, x1, y1] = tp.graveyard;
      for (let y = y0; y <= y1; y += 3) for (let x = x0 + ((y / 3) % 2) * 2; x <= x1; x += 4) {
        const gx = x + Math.round(rand() - 0.5), gy = y;
        if (get(gx, gy) !== T.GRASS || used[id(gx, gy)] || tp.slots.some(([sx, sy]) => Math.hypot(sx - gx, sy - gy) < 5)) continue;
        addObj('grave', Math.floor(rand() * 3), gx, gy, true);
      }
    }
    if (tp.hall) {                         // temple on the summit
      const [hx, hy] = tp.hall;
      block(hx - 4, hy - 4, hx + 4, hy);
      objects.push(['temple', 0, px(hx), (hy + 1) * TILE]);
      for (let y = 30; y <= 70; y += 8) for (const lx of [61, 67]) if (get(lx, y) !== T.CLIFF) addObj('lantern', 0, lx, y, true);
    }

    // 8. trees and props, kept off roads, water, cliffs' feet, camp, lair and gates
    const clear = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = tiles[id(x, y)];
      if (t === T.GRASS || t === T.CLIFF) continue;
      const r = t === T.SAND || t === T.ICE ? 1 : t === T.FIELD && !nearLair(x, y, 1) ? 0 : 2;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy)) clear[id(x + dx, y + dy)] = 1;
    }
    for (const g of def.gates) for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (inb(g.tx + dx, g.ty + dy)) clear[id(g.tx + dx, g.ty + dy)] = 1;
    const inSlot = (x, y, r) => tp.slots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) <= r);
    const decoW = th.deco.reduce((a, d) => a + d[2], 0);
    const pickDeco = () => {
      let r = rand() * decoW;
      for (const d of th.deco) { r -= d[2]; if (r <= 0) return d; }
      return th.deco[0];
    };
    const dense = (th.dense || 1) * (tp.trees ?? 1);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = id(x, y);
      if (tiles[k] !== T.GRASS || used[k]) continue;
      const border = x < 3 || y < 3 || x > W - 4 || y > H - 4;
      const variant = th.trees[(rand() * th.trees.length) | 0];
      if (border && !clear[k]) { addObj('tree', variant, x, y, true, (rand() - 0.5) * 14, 0); continue; }
      if (clear[k]) continue;
      const n = fbm(x / 9, y / 9);
      const zf = inSlot(x, y, 7) ? (tp.forest ? 0 : 0.35) : 1;
      const r2 = rand();
      const treeHit = tp.forest ? r2 < tp.forest * zf : (n > 0.6 && r2 < 0.65 * zf * dense) || r2 < 0.02 * zf * dense;
      if (treeHit) addObj('tree', variant, x, y, true, (rand() - 0.5) * 16, (rand() - 0.5) * 6);
      else if (r2 > 1 - 0.035 * (th.rocky ? 1.6 : 1)) {
        const [t, v] = pickDeco();
        const vv = v < 0 ? Math.floor(rand() * 3) : v;
        const isSolid = t === 'rock' || t === 'pillar' || t === 'crystal' || t === 'grave';
        addObj(t, vv, x, y, isSolid, isSolid ? 0 : (rand() - 0.5) * 20, isSolid ? 0 : (rand() - 0.5) * 10);
      }
    }
    for (let k = 0; k < W * H; k++) if (tiles[k] === T.WATER || tiles[k] === T.CLIFF) solid[k] = 1;
    return { w: W, h: H, seed, tiles, solid, objects };
  }

  // ---------------- queries ----------------
  const inRect = (r, tx, ty) => tx >= r.x0 && tx < r.x1 + 1 && ty >= r.y0 && ty < r.y1 + 1;
  // safe zone for this faction: own base (PvP map) or the camp (hunting maps, both factions)
  function safeAt(def, x, y, faction) {
    if (def.pvp) { const b = C.baseAt(x, y); return faction ? b === faction : !!b; }
    return inRect(def.camp, x / TILE, y / TILE);
  }
  // monsters never enter camps or bases
  const noMonster = (def, x, y) => (def.pvp ? !!C.baseAt(x, y) : inRect(def.camp, x / TILE, y / TILE));
  function areaName(def, x, y) {
    if (def.pvp) return C.areaName(x, y);
    const tx = x / TILE, ty = y / TILE;
    if (inRect(def.camp, tx, ty)) return def.campName;
    if (Math.hypot(tx - def.lair.tx - 0.5, ty - def.lair.ty - 0.5) <= def.lair.r + 1) return def.zones[def.zones.length - 1].name;
    for (const z of def.zones) if (!z.fixed && inRect(z, tx, ty)) return z.name;
    return def.name;
  }
  const spawnOf = (def, faction) => (def.pvp ? C.spawnPoint(faction) : { x: def.spawn.x, y: def.spawn.y });
  const smithOf = (def, faction) => (def.pvp ? C.SMITH[faction] : def.smith);
  const apothecaryOf = (def, faction) => (def.pvp ? C.APOTHECARY[faction] : def.apothecary);
  const stoneOf = (def, faction) => (def.pvp ? C.STONES[faction] : def.stone);
  const levelText = (def) => `Lv.${def.lv[0]}-${def.lv[1]}`;
  // teleport stone fare: maps crossed (through the gates) × (base + perLvl × the higher starting level of the two maps);
  // the same both ways · the PvP battlefield is a flat fare · walking through the gates stays free
  const WARP_COST = { base: 100, perLvl: 8, pvp: 800 };
  function warpHops(from, to) {
    const seen = new Set([from]);
    let ring = [from];
    for (let n = 1; ring.length; n++) {
      const next = [];
      for (const id of ring) for (const g of MAPS[id].gates || []) {
        if (g.to === to) return n;
        if (!seen.has(g.to)) { seen.add(g.to); next.push(g.to); }
      }
      ring = next;
    }
    return ORDER.length;
  }
  function warpCost(from, to) {
    if (from === to || !MAPS[from] || !MAPS[to]) return 0;
    if (MAPS[from].pvp || MAPS[to].pvp) return WARP_COST.pvp;
    return warpHops(from, to) * (WARP_COST.base + WARP_COST.perLvl * Math.max(MAPS[from].lv[0], MAPS[to].lv[0]));
  }

  Object.assign(C, {
    THEMES, MON_ART, MAPS, MAP_ORDER: ORDER, START_MAP: 'village', generateField, arrival,
    safeAt, noMonster, mapAreaName: areaName, spawnOf, smithOf, apothecaryOf, stoneOf, levelText, WARP_COST, warpHops, warpCost, MON_GATE: GATE, gateRef, gateStats, MON_EASE: EASE, monEase: easeOf, monStats, MON_LATE: LATE, monLate: lateOf,
  });
  return C;
});
