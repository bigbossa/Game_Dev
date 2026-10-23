// Weapon appearance: the equipped weapon's art drawn in the hands, glow halos, aura particles and tiered auras
// (ground sigils, body flame, orbiting spirits, Lv.100 spirit dragon) per weapon tier.
(function () {
  const WL = { cache: new Map() };
  window.WeaponLook = WL;
  const TAU = Math.PI * 2;
  let IMG = null, SPR = null;

  WL.init = function (images, sprites) { IMG = images; SPR = sprites; };
  // นักพรต: the same tiers in its own colours — เทพรักษา jade and white (gold from tier 7), มารทำลาย ember and blood
  // (abyss black from tier 7)
  const TAO_WL = {
    dharma: (t) => ({ glow: t >= 7 ? '#ffe9a0' : '#7cffc4', fx: t >= 7 ? ['#fffbe6', '#9fffd0', '#d8a84a'] : ['#f4fff8', '#8affc8', '#2ab884'] }),
    adharma: (t) => ({ glow: t >= 7 ? '#ff2a0a' : '#ff5a2a', fx: t >= 7 ? ['#ffe0c8', '#ff3a1a', '#1a0002'] : ['#ffd6c8', '#ff3b2a', '#3a0006'] }),
  };
  const taoPal = (faction, tier) => TAO_WL[faction === 'adharma' ? 'adharma' : 'dharma'](tier || 0);
  WL.look = function (faction, tier, cls) {
    const w = C.WEAPON_BY_TIER[tier] || C.WEAPONS[0];
    const lk = { ...w.look[faction], glowA: w.look.glowA, aura: w.look.aura, tier: w.tier };
    if (cls === 'taoist' && lk.glow) lk.glow = taoPal(faction, w.tier).glow;
    else if (cls === 'archer' && lk.glow && window.ArcherGear) lk.glow = ArcherGear.design(w.tier,faction).edge;
    else if (lk.glow && window.ItemArt) lk.glow = ItemArt.design(w.tier,faction).glow || lk.glow;
    return lk;
  };
  WL.fx = function (faction, tier, cls) {
    if (cls === 'taoist') return taoPal(faction, tier).fx;
    if (cls === 'archer' && window.ArcherGear) {
      const d = ArcherGear.design(tier,faction); return [d.edge,d.main,d.gem];
    }
    const w = C.WEAPON_BY_TIER[tier];
    if (w && tier >= 3 && window.ItemArt) return ItemArt.design(tier,faction).fx;
    return (w && w.look[faction].fx) || C.FACTIONS[faction].fx;
  };
  // how grand the effects are for a weapon tier (0..10)
  WL.power = function (tier) {
    tier = tier || 0;
    return {
      tier,
      scale: 1 + tier * 0.05,          // size of slash arcs / rings
      sparks: Math.round(tier * 1.6),  // extra spark particles per hit
      echo: tier >= 5,                 // after-image arc
      bolts: tier >= 6,                // lightning
      wisps: tier >= 8,                // rising spirit wisps
      dragon: tier >= 10,              // dragon flourish
    };
  };

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------------------------------------------------------------- weapon art held in the hands
  // weapons.json (tools/weapon-sprites.js) tells where the blades sit (hilt -> tip, relative to the feet)
  // in every walk / attack frame; the blades themselves are vector art from ItemArt.
  let WEAP = null;
  WL.initArt = function (meta) { if (window.ItemArt && meta && meta.walk) WEAP = meta; };
  WL.hasArt = () => !!WEAP;
  // longer weapons for higher tiers (the art itself also gets grander with the tier)
  const growth = (tier) => { const L = window.ItemArt ? ItemArt.design(tier || 0, 'dharma').L : 100; return 0.95 + (L - 76) / 58 * 0.62; };
  const MIN_LEN = 30;   // foreshortened blades still read as weapons

  // blades of the frame being drawn: [[hx, hy, tx, ty], ...] relative to the feet, unscaled
  // (F.faction: the อธรรม walk is its own drawing with its own blade positions)
  WL.blades = function (F) {
    if (!WEAP) return [];
    const list = F.atk ? WEAP.attack : (F.faction === 'adharma' && WEAP.walkAdharma) || WEAP.walk;
    return (list && list[F.frame * 8 + C.DIR_COL[F.dir]]) || [];
  };
  // final hilt -> tip segment of a blade (length grown by tier, short ones extended)
  function seg(b, tier) {
    const [hx, hy, tx, ty] = b;
    const L0 = Math.hypot(tx - hx, ty - hy) || 1;
    const L = Math.max(MIN_LEN, L0) * growth(tier);
    return [hx, hy, hx + ((tx - hx) / L0) * L, hy + ((ty - hy) / L0) * L];
  }

  // ---------------------------------------------------------------- enhancement (+1..+10) looks
  // glow: extra halo colour / strength · bolts: lightning arcs per second along the blade · motes: sparkles/sec
  const PLUS = [
    null,
    { glow: '#ffffff', a: 0.6, blur: 1, bolts: 0, motes: 0 },                                   // +1 white sheen
    { glow: '#bfe8ff', a: 0.7, blur: 1.15, bolts: 0, motes: 0 },                                      // +2 pale blue
    { glow: '#46d4ff', a: 0.8, blur: 1.3, bolts: 0, motes: 2 },                                    // +3 cyan
    { glow: '#46ff9a', a: 0.85, blur: 1.4, bolts: 0, motes: 4, pulse: 2.5 },                      // +4 jade pulse
    { glow: '#ffd84a', a: 0.9, blur: 1.5, bolts: 0.6, bolt: '#fff3b0', motes: 5, pulse: 3 },      // +5 gold, first sparks
    { glow: '#ff9a3a', a: 0.95, blur: 1.6, bolts: 1.5, bolt: '#ffe0b0', motes: 6, pulse: 3.5 },   // +6 ember
    { glow: '#3a8dff', a: 1, blur: 1.7, bolts: 3, bolt: '#cfe8ff', motes: 6, pulse: 4, arcs: 1 },            // +7 blue lightning
    { glow: '#a05aff', a: 1, blur: 1.85, bolts: 5, bolt: '#ead8ff', motes: 8, pulse: 4.5, arcs: 2 },         // +8 violet lightning
    { glow: '#ff2a3a', a: 1, blur: 2, bolts: 7, bolt: '#ffd0d0', motes: 9, pulse: 5, arcs: 2, ground: 1 }, // +9 crimson storm
    { glow: 'rainbow', a: 1, blur: 2.2, bolts: 10, bolt: '#fff6c8', motes: 12, pulse: 6, arcs: 3, ground: 2 }, // +10 heavenly
  ];
  WL.plusLook = (n) => PLUS[Math.max(0, Math.min(10, n || 0))];
  // +10 cycles through the spectrum
  const RAINBOW = ['#ff4a4a', '#ffb03a', '#fff05a', '#4aff8a', '#3ac8ff', '#8a6aff', '#ff5ad0'];
  WL.plusColor = (n, t = performance.now() / 1000) => {
    const P = WL.plusLook(n);
    if (!P) return null;
    return P.glow === 'rainbow' ? RAINBOW[Math.floor(t * 4) % RAINBOW.length] : P.glow;
  };
  // jagged lightning crawling along a segment (screen coordinates)
  function arc(g, x0, y0, x1, y1, col, core, w, jag, seed = 0) {
    const n = 7, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, j = i && i < n ? Math.sin(seed+i*12.9898) * jag * 0.5 : 0;
      const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
      pts.push([x0 + (x1 - x0) * t + (nx / L) * j, y0 + (y1 - y0) * t + (ny / L) * j]);
    }
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
    for (const [c, lw] of [[col, w * 2.4], [core, w]]) {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    g.restore();
  }

  // draws the equipped weapon in both hands; s = sprite scale
  WL.drawBlades = function (g, e, F, x, y, s, opts = {}) {
    const list = WL.blades(F);
    if (!list.length) return;
    const tier = e.wt || 0, faction = e.faction === 'adharma' ? 'adharma' : 'dharma';
    const lk = WL.look(faction, tier);
    const time = (opts.time ?? performance.now()/1000);
    const pulse = 0.85 + 0.15 * Math.sin(time*2.4);
    const dpr = (g.getTransform ? Math.hypot(g.getTransform().a, g.getTransform().b) : 1) || 1;
    for (const b of list) {
      const [hx, hy, tx, ty] = seg(b, tier);
      const side = tx < hx ? 0 : 1;                      // the art curves outward: left blade when pointing left
      const len = Math.hypot(tx - hx, ty - hy) * s;
      const B = ItemArt.blade(tier, faction, side, len * dpr);
      // guard -> tip of the cached image onto hilt -> tip of the frame
      const ax = B.tipX - B.gx, ay = B.tipY - B.gy;
      const k = len / Math.hypot(ax, ay);
      const rot = Math.atan2(ty - hy, tx - hx) - Math.atan2(ay, ax);
      g.save();
      g.translate(x + hx * s, y + hy * s);
      g.rotate(rot);
      g.scale(k, k);
      if (lk.glow && !opts.noGlow) {
        const H = ItemArt.halo(tier, faction, side, len * dpr, lk.glow);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha *= Math.min(0.42, lk.glowA * 0.5) * pulse;
        g.drawImage(H.img, -B.gx - H.pad, -B.gy - H.pad);
        g.restore();
      }
      // enhancement halo (behind the blade art, colour by +level)
      const P = !opts.noGlow && WL.plusLook(e.wp);
      if (P) {
        const col = WL.plusColor(e.wp,time), H = ItemArt.halo(tier, faction, side, len * dpr, col, P.blur);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha *= P.a * 0.38 * pulse;
        g.drawImage(H.img, -B.gx - H.pad, -B.gy - H.pad);
        g.restore();
      }
      g.drawImage(B.img, -B.gx, -B.gy);
      g.restore();
      // A brief, stable arc at the outer half of each blade. Time controls the
      // rhythm, so frame rate and walking speed cannot turn it into white noise.
      const cycle = time*Math.min(2.5,(P?.bolts || 0)*0.28) + side*0.5;
      const phase = cycle-Math.floor(cycle);
      if (P && P.bolts && phase < 0.24) {
        const x0 = x + hx * s, y0 = y + hy * s, x1 = x + tx * s, y1 = y + ty * s;
        g.save();g.globalAlpha*=0.5*Math.sin(phase/0.24*Math.PI);
        arc(g, x0+(x1-x0)*.48,y0+(y1-y0)*.48,x1,y1,
          WL.plusColor(e.wp,time),P.bolt,Math.max(.45,s*.9),len*.08,Math.floor(cycle)+side*7);
        g.restore();
      }
    }
    // Cross-blade arcs belong to attacks; at rest they covered the chest/face.
    const P = !opts.noGlow && WL.plusLook(e.wp);
    const crossPhase = (time*2)%1;
    if (F.atk && P && P.arcs && list.length > 1 && crossPhase < .2) {
      const [a, b] = list.map((q) => seg(q, tier));
      const ta = .88, tb = .88;
      g.save();g.globalAlpha*=.35*Math.sin(crossPhase/.2*Math.PI);
      arc(g, x + (a[0] + (a[2] - a[0]) * ta) * s, y + (a[1] + (a[3] - a[1]) * ta) * s,
        x + (b[0] + (b[2] - b[0]) * tb) * s, y + (b[1] + (b[3] - b[1]) * tb) * s, WL.plusColor(e.wp,time), P.bolt, Math.max(0.45, s), 12 * s,Math.floor(time*2));
      g.restore();
    }
  };

  // ---- classes whose weapon is part of their drawing (นักพรต fly-whisk, นักธนู bow): the twin blades' enhancement
  // light and lightning along weapon polylines (relative to the feet, unscaled): the whisk handle -> tip, or each
  // visible bow limb hand -> tip (ArcherGear's authored anchors, same curve as its bow; none while the body hides it)
  WL.ownLines = function (e, F) {
    if(e.cls==='warrior'){const line=WarriorGear.weaponLine(e,F);return line.length?[line]:[];}
    if (e.cls === 'spearman') { const line = SpearmanLook.weaponLine(e,F); return line.length ? [line] : []; }
    const f = e.faction === 'adharma' ? 'adharma' : 'dharma', cm = classPts[e.cls];
    const m = cm && (F.atk ? cm.attack : cm.walk)[f];
    if (!m) return [];
    const key = ModelTiers.key(e.faction, F.atk, e.cls), col = C.DIR_COL[F.dir];
    if (e.cls === 'taoist') {
      const s = window.TaoistGear && TaoistGear.segment(key, F, m);
      return s ? [[[s[0], s[1]], [s[2], s[3]]]] : [];
    }
    if (e.cls !== 'archer' || !window.ArcherGear) return [];
    const rig=window.ArcherModel?.ready?ArcherModel.anchor(F.atk,F.frame,col,ModelTiers.tierOf(e.lvl||1),f):null;
    // These enhancement strokes are a foreground pass; never draw through a back-facing torso.
    if(rig?.bowBehind)return [];
    const b = rig?rig.bow:ArcherGear.anchor(f, F.atk, F.frame, col).bow;
    if (!b) return [];
    const limb = (k) => {
      const hx = b[2], hy = b[3], tx = b[k], ty = b[k + 1], side = b[6] ?? (tx >= hx ? 1 : -1), pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        let p = [hx + (tx - hx) * t + Math.sin(t * Math.PI) * side * 7, hy + (ty - hy) * t];
        if (window.ArcherPose) p = ArcherPose.point(key, F.frame, col, p[0], p[1]);
        pts.push([p[0] - m.anchorX, p[1] - m.anchorY]);
      }
      return pts;
    };
    return (b[7] === 1 ? [0] : [0, 4]).map(limb);
  };
  // drawn over the character: lightning only (no light over the drawn equipment) — crawling along the weapon (+5),
  // and while attacking with +7..+10 an arc between the bow tips / off the whisk tip (the twin blades' cross arc)
  WL.drawOwnPlus = function (g, e, F, x, y, s, opts = {}) {
    const P = !opts.noGlow && WL.plusLook(e.wp);
    const lines = P ? WL.ownLines(e, F) : [];
    if (!lines.length) return;
    const time = opts.time ?? performance.now() / 1000;
    const col = WL.plusColor(e.wp, time);
    const scr = lines.map((pts) => pts.map(([px, py]) => [x + px * s, y + py * s]));
    // the blades' rhythm: a short arc on the outer part of each weapon line, a few times a second
    scr.forEach((pts, side) => {
      const cycle = time * Math.min(2.5, (P.bolts || 0) * 0.28) + side * 0.5, phase = cycle - Math.floor(cycle);
      if (!P.bolts || phase >= 0.24) return;
      const a = pts[Math.floor((pts.length - 1) * (pts.length > 2 ? 0.25 : 0))], b = pts[pts.length - 1];
      const from = pts.length > 2 ? a : [a[0] + (b[0] - a[0]) * 0.48, a[1] + (b[1] - a[1]) * 0.48];
      g.save(); g.globalAlpha *= 0.5 * Math.sin((phase / 0.24) * Math.PI);
      arc(g, from[0], from[1], b[0], b[1], col, P.bolt, Math.max(0.45, s * 0.9), Math.hypot(b[0] - from[0], b[1] - from[1]) * 0.12, Math.floor(cycle) + side * 7);
      g.restore();
    });
    const cp = (time * 2) % 1;
    if (F.atk && P.arcs && cp < 0.2) {
      const t0 = scr[0][scr[0].length - 1], ref = scr[0][0];
      // two limbs: tip to tip (along the string); a whisk: a branch off its tip
      const t1 = scr[1] ? scr[1][scr[1].length - 1] : [t0[0] + (t0[0] - ref[0]) * 0.3 - (t0[1] - ref[1]) * 0.35, t0[1] + (t0[1] - ref[1]) * 0.3 + (t0[0] - ref[0]) * 0.35];
      g.save(); g.globalAlpha *= 0.35 * Math.sin((cp / 0.2) * Math.PI);
      arc(g, t0[0], t0[1], t1[0], t1[1], col, P.bolt, Math.max(0.45, s), 12 * s, Math.floor(time * 2));
      g.restore();
    }
  };

  // sparkles / ground lightning from enhanced weapons (called once per frame per character)
  WL.emitPlus = function (e, F, x, y, scale, dt) {
    const P = WL.plusLook(e.wp);
    if (!P || e.dead) return;
    const tao = e.cls === 'taoist';
    dt *= tao ? 0.3 : 0.38;
    const pts = WL.points(F, e.wt, e);
    if (P.motes && pts && pts.length) {
      e.plusAcc = (e.plusAcc || 0) + dt * P.motes;
      while (e.plusAcc >= 1) {
        e.plusAcc -= 1;
        const p = pts[(Math.random() * pts.length) | 0];
        FX.parts.push({ x: x + p[0] * scale, y: y + p[1] * scale, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, life: 0, max: tao ? 500 + e.wp * 40 : 420,
          size: tao ? 1.6 + e.wp * 0.15 : 1.2, color: Math.random() < 0.5 ? WL.plusColor(e.wp) : '#ffffff', grav: 0, drag: 1.5, spark: e.wp >= 6 });
      }
    }
    // +9/+10: small bolts striking the ground around the feet
    if (P.ground && (tao || e.atk) && Math.random() < dt * P.ground * 1.2) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 18;
      const gx = x + Math.cos(a) * r, gy = y + Math.sin(a) * r * 0.4;
      FX.bolt(gx + (Math.random() - 0.5) * 10, gy - 60 - Math.random() * 30, gx, gy, P.bolt, WL.plusColor(e.wp));
      FX.burst(gx, gy, 5, [WL.plusColor(e.wp), '#ffffff'], { speed: 90, life: 300, size: 2, spark: true });
    }
  };

  // ---------------------------------------------------------------- fallback: recoloured original blades
  // (only used when the weapon art assets are missing)
  function tintBlades(mask, tint) {
    const w = mask.width, h = mask.height, c = mk(w, h), g = c.getContext('2d');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.22; g.drawImage(mask, 0, 0); g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    return c;
  }
  function glowLayer(mask, color) {
    const w = mask.width, h = mask.height, c = mk(w, h), g = c.getContext('2d');
    g.shadowColor = color; g.shadowBlur = 9; g.shadowOffsetX = w;
    g.drawImage(mask, -w, 0);
    g.drawImage(mask, -w, 0);
    g.shadowBlur = 3;
    g.drawImage(mask, -w, 0);
    return c;
  }
  function build(faction, tier, atk) {
    const key = `${faction}|${tier}|${atk ? 1 : 0}`;
    let v = WL.cache.get(key);
    if (v) return v;
    const mask = IMG[atk ? 'blade-attack' : 'blade-walk'];
    const lk = WL.look(faction, tier);
    v = { blades: null, glow: null };
    if (mask && lk.tint) v.blades = tintBlades(mask, lk.tint);
    if (mask && lk.glow) v.glow = glowLayer(mask, lk.glow);
    WL.cache.set(key, v);
    return v;
  }
  // body sheet (armour recoloured; without blades when the weapon art is used) + fallback blade layers
  // gg = grades per equipment slot; the highest one gives the outline of light (ArmorLook)
  WL.sheet = function (faction, tier, atk, ar, lvTier, gg) {
    const body = window.ArmorLook ? ArmorLook.sheet(faction, atk, ar, lvTier, gg) : { sheet: IMG[atk ? `${faction}-attack` : faction] };
    const out = { sheet: body.sheet, rim: body.rim, rimMeta: body.rimMeta, lightTop: body.lightTop || 0, blades: null, glow: null };
    if (WEAP) return out;
    const w = build(faction, tier || 0, atk);
    out.blades = w.blades; out.glow = w.glow;
    return out;
  };

  // other classes' weapon points per pose / faction (นักพรต: assets/taoist.json weaponPts, round the whisk)
  const classPts = {};
  WL.setClassPoints = (cls, meta) => { classPts[cls] = meta; };
  // points along the blades (relative to the feet, unscaled) for aura particles
  WL.points = function (F, tier, e) {
    if(e?.cls==='warrior'){const line=WarriorGear.weaponLine(e,F);return line.length?[.65,.85].map(q=>line[0].map((v,i)=>v+(line[1][i]-v)*q)):[];}
    if (e?.cls === 'spearman') {
      const line=SpearmanLook.weaponLine({...e,wt:tier},F);
      return line.length ? [.65,.85].map(q=>line[0].map((v,i)=>v+(line[1][i]-v)*q)) : [];
    }
    const cm = e && classPts[e.cls];
    if (cm) {
      const m = (F.atk ? cm.attack : cm.walk)[e.faction === 'adharma' ? 'adharma' : 'dharma'];
      if (e.cls === 'taoist' && m && window.TaoistGear)
        return TaoistGear.points(ModelTiers.key(e.faction,F.atk,'taoist'),F,m);
      if(e.cls==='archer'&&m&&window.ArcherModel?.ready)return ArcherModel.points(e,F,m);
      if (e.cls === 'archer' && m && window.ArcherGear)
        return ArcherGear.points(ModelTiers.key(e.faction,F.atk,'archer'),F,m);
      return m && m.weaponPts ? m.weaponPts[F.frame * 8 + C.DIR_COL[F.dir]] : null;
    }
    if (WEAP) {
      const out = [];
      for (const b of WL.blades(F)) {
        const [hx, hy, tx, ty] = seg(b, tier);
        for (let i = 1; i <= 4; i++) { const t = i / 4; out.push([hx + (tx - hx) * t, hy + (ty - hy) * t]); }
      }
      return out;
    }
    if (!SPR) return null;
    const col = C.DIR_COL[F.dir];
    const list = F.atk ? SPR.attack && SPR.attack.bladePts : SPR.bladePts;
    return list ? list[F.frame * 8 + col] : null;
  };

  // aura particles emitted from the blades; rate per second scales with tier
  WL.emit = function (e, F, x, y, scale, dt) {
    const lk = WL.look(e.faction, e.wt || 0, e.cls);
    if (!lk.glow) return;
    const fx = WL.fx(e.faction, e.wt, e.cls);
    // The whisk is small: dense opaque sparks hid both its design and the robe.
    const tao = e.cls === 'taoist';
    dt *= tao ? 0.32 : 0.4;
    // motes rising around the body (tier 5+)
    if (lk.tier >= 5) {
      e.moteAcc = (e.moteAcc || 0) + dt * (lk.tier - 3) * 2.2;
      while (e.moteAcc >= 1) {
        e.moteAcc -= 1;
        const a = Math.random() * TAU, r = 14 + Math.random() * 20;
        const offset = (Math.cos(a) < 0 ? -1 : 1) * (32 + Math.random() * 10);
        FX.parts.push({ x: x + offset, y: y - 4 + Math.sin(a) * r * 0.35, vx: 0, vy: -30 - Math.random() * 40 - lk.tier * 4, life: 0, max: tao ? 700 + lk.tier * 60 : 550, size: 1.2, color: Math.random() < 0.5 ? lk.glow : fx[0], grav: 0, drag: 0.6, spark: false });
      }
    }
    if (!lk.aura) return;
    const pts = WL.points(F, e.wt, e);
    if (!pts || !pts.length) return;
    e.auraAcc = (e.auraAcc || 0) + dt * (4 + lk.tier * 2.6);
    while (e.auraAcc >= 1) {
      e.auraAcc -= 1;
      const p = pts[(Math.random() * pts.length) | 0];
      const px = x + p[0] * scale, py = y + p[1] * scale;
      if (lk.aura === 1) {          // glints
        FX.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0, max: 420, size: 2.2, color: Math.random() < 0.5 ? lk.glow : fx[0], grav: 0, drag: 2, spark: false });
      } else if (lk.aura === 2) {   // crackling sparks
        FX.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0, max: 220, size: 2, color: Math.random() < 0.6 ? fx[0] : lk.glow, grav: 0, drag: 6, spark: true });
      } else {                      // rising spirit wisps (3) / dragon flames (4)
        const big = lk.aura === 4;
        FX.parts.push({ x: px + (Math.random() - 0.5) * 6, y: py, vx: (Math.random() - 0.5) * 24, vy: -40 - Math.random() * (big ? 70 : 40), life: 0, max: 420, size: tao ? 1.3 : 1.4, color: Math.random() < 0.5 ? lk.glow : fx[1], grav: big ? -40 : 0, drag: 1.2, spark: false });
      }
    }
    // lightning arcs between blade points (tier 6+, more often on stronger blades)
    if (lk.tier >= 6 && (tao || e.atk) && Math.random() < dt * (lk.aura === 2 ? 3 : 1.2) && pts.length > 1) {
      const a = pts[(Math.random() * pts.length) | 0], b = pts[(Math.random() * pts.length) | 0];
      FX.bolt(x + a[0] * scale, y + a[1] * scale, x + b[0] * scale, y + b[1] * scale - 10, fx[0], lk.glow);
    }
  };

  // ---------------------------------------------------------------- magic circle (cached per colour)
  const circles = new Map();
  // นักพรต ground circle: เทพรักษา = lotus mandala with the eight trigrams round a taiji; มารทำลาย = a cracked demon
  // seal (pentagram) with spikes pointing out
  function taoSigil(faction, color, core, rich) {
    const key = 'tao' + faction + color + core + rich;
    if (circles.has(key)) return circles.get(key);
    const R = 64, c = mk(R * 2 + 24, R * 2 + 24), g = c.getContext('2d');
    g.translate(R + 12, R + 12);
    g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 6; g.lineWidth = 2.2;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    if (faction !== 'adharma') {
      // lotus petals round the rim
      for (let i = 0; i < 16; i++) {
        g.save(); g.rotate((i / 16) * TAU); g.globalAlpha = i % 2 ? 0.6 : 0.9;
        g.beginPath(); g.ellipse(R - 2, 0, 9, 3.6, 0, 0, TAU); g.fill(); g.restore();
      }
      g.globalAlpha = 1; g.lineWidth = 1.4;
      g.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU + TAU / 16; const px = Math.cos(a) * (R - 14), py = Math.sin(a) * (R - 14); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      for (let i = 0; i < 8; i++) {                       // trigrams
        g.save(); g.rotate((i / 8) * TAU + TAU / 16); g.translate(0, -(R - 26));
        for (let k = 0; k < 3; k++) { const yy = (k - 1) * 4; g.beginPath(); if ((i >> k) & 1) { g.moveTo(-6, yy); g.lineTo(6, yy); } else { g.moveTo(-6, yy); g.lineTo(-1.5, yy); g.moveTo(1.5, yy); g.lineTo(6, yy); } g.stroke(); }
        g.restore();
      }
      const r = R * 0.3;                                   // taiji outline in the middle
      g.strokeStyle = core; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2); g.arc(0, r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true); g.stroke();
      if (rich) { g.beginPath(); g.arc(0, 0, R * 0.52, 0, TAU); g.stroke(); }
    } else {
      // spikes out of the rim
      for (let i = 0; i < 12; i++) {
        g.save(); g.rotate((i / 12) * TAU);
        g.beginPath(); g.moveTo(R - 2, -4); g.lineTo(R + (i % 2 ? 7 : 11), 0); g.lineTo(R - 2, 4); g.fill(); g.restore();
      }
      g.lineWidth = 1.6;
      g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 * TAU) / 5; const px = Math.cos(a) * (R - 6), py = Math.sin(a) * (R - 6); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      g.strokeStyle = core; g.lineWidth = 1.1;              // cracks running inward
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25); g.lineTo(Math.cos(a + 0.15) * R * 0.55, Math.sin(a + 0.15) * R * 0.55); g.lineTo(Math.cos(a - 0.05) * R * 0.85, Math.sin(a - 0.05) * R * 0.85); g.stroke(); }
      g.strokeStyle = color; g.beginPath(); g.arc(0, 0, R * 0.22, 0, TAU); g.stroke();
      if (rich) { g.beginPath(); g.arc(0, 0, R * 0.62, 0, TAU); g.stroke(); }
    }
    circles.set(key, c);
    return c;
  }
  function sigil(color, core, rich) {
    const key = color + core + rich;
    if (circles.has(key)) return circles.get(key);
    const R = 64, c = mk(R * 2 + 8, R * 2 + 8), g = c.getContext('2d');
    g.translate(R + 4, R + 4);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.4;
    g.shadowColor = color; g.shadowBlur = 6;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, R - 9, 0, TAU); g.stroke();
    // rune ticks between the rings
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.save(); g.rotate(a); g.translate(R - 4.5, 0);
      g.fillRect(-1, -2.5, 2, 5);
      if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.fill(); }
      g.restore();
    }
    // star polygon
    const n = rich ? 8 : 6, step = rich ? 3 : 2;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ((i * step) / n) * TAU - Math.PI / 2;
      const px = Math.cos(a) * (R - 10), py = Math.sin(a) * (R - 10);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.36, 0, TAU); g.stroke();
    g.strokeStyle = core; g.lineWidth = 1;
    g.beginPath(); g.arc(0, 0, R * 0.22, 0, TAU); g.stroke();
    circles.set(key, c);
    return c;
  }

  // ground effects under the wielder (tier 3+)
  // ---- rune rings under the feet: one ring per equipped piece at +8 or higher (weapon + 4 armour pieces, up to 5);
  // the highest +level is the outermost ring, neighbouring rings turn in opposite directions.
  //   colour  = the piece's +level:  +8 violet · +9 crimson · +10 black-red
  //   pattern = the piece's item level (RING_LV):  Lv.1-29 rune seal · 30-49 water wave · 50-69 flame blades ·
  //             70-89 chains · 90-100 thorn crown
  const RING_STYLE = {
    8: { band: '#3a1470', bandA: 0.42, edge: '#5a2a9a', glow: '#a05aff', rune: '#efe0ff' },
    9: { band: '#5a0a16', bandA: 0.5, edge: '#8a1020', glow: '#ff2a3a', rune: '#ffe0d8' },
    10: { band: '#0a0205', bandA: 0.85, edge: '#000000', glow: '#ff1a2a', rune: '#ff3a3a' },
  };
  const RING_LV = [30, 50, 70, 90];                 // item level where the next pattern starts
  const ringPattern = (lvl) => RING_LV.filter((l) => lvl >= l).length;
  // little runes (stroke sets in a 6 x 8 box), picked in a fixed order round the ring
  const RUNES = [
    [[0, -4, 0, 4], [0, -4, 3, -1]], [[-3, -4, 3, 4], [3, -4, -3, 4]], [[0, -4, 0, 4], [-3, 0, 3, 0]],
    [[-3, 4, 0, -4], [0, -4, 3, 4], [-2, 1, 2, 1]], [[-3, -4, -3, 4], [-3, 0, 3, -4], [-3, 0, 3, 4]], [[0, -4, 0, 4], [0, -1, 3, -4], [0, -1, -3, -4]],
  ];
  const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  // pieces shared by the patterns. b = base layer (normal blend: band in the band colour, borders / beads / thorns
  // in the edge colour), g = glow layer (added light in the rune colour)
  const band = (b, R, W, S) => { b.globalAlpha = S.bandA; b.fillStyle = S.band; b.beginPath(); b.arc(0, 0, R, 0, TAU); b.arc(0, 0, R - W, 0, TAU, true); b.fill(); b.globalAlpha = 1; b.fillStyle = S.edge; };
  const borders = (b, R, W, outer, inner, dash) => {
    b.lineWidth = outer; b.beginPath(); b.arc(0, 0, R, 0, TAU); b.stroke();
    if (dash) b.setLineDash(dash);
    b.lineWidth = inner; b.beginPath(); b.arc(0, 0, R - W, 0, TAU); b.stroke(); b.setLineDash([]);
  };
  const waveLine = (g, mid, W, waves, dots) => {
    g.lineWidth = 1.8; g.beginPath();
    for (let i = 0; i <= 180; i++) { const a = (i / 180) * TAU, [x, y] = at(mid + Math.sin(a * waves) * (W * 0.32), a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    if (dots) for (let i = 0; i < waves; i++) { const [x, y] = at(mid + W * 0.32, ((i + 0.25) / waves) * TAU); g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
  };
  const chains = (b, g, R, W, S, links) => {
    const gap = 0.07, mid = R - W / 2;
    for (let i = 0; i < links; i++) {
      const a0 = (i / links) * TAU + gap, a1 = ((i + 1) / links) * TAU - gap;
      b.globalAlpha = Math.max(0.6, S.bandA); b.fillStyle = S.band; b.beginPath(); b.arc(0, 0, R, a0, a1); b.arc(0, 0, R - W, a1, a0, true); b.closePath(); b.fill();
      b.globalAlpha = 1; b.lineWidth = 2.6; b.stroke();
    }
    b.fillStyle = S.edge;
    g.lineWidth = 1.4; g.beginPath();                // a crack through the links
    for (let i = 0; i <= 120; i++) { const j = ((i * 37) % 7) / 7 - 0.5, [x, y] = at(mid + j * W * 0.45, (i / 120) * TAU); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < links; i++) {                // an eye in every gap
      const a = (i / links) * TAU, [x, y] = at(mid, a);
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, W * 0.36, 2.4, Math.PI / 2, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 1.2, 0, TAU); g.fill(); g.restore();
    }
  };
  const RING_ART = [
    // Lv.1-29 rune seal: runes between a beaded outer border and a ticked inner border
    (b, g, R, W, S) => {
      band(b, R, W, S); borders(b, R, W, 2.4, 1.6);
      for (let i = 0; i < 24; i++) { const [x, y] = at(R + 5, (i / 24) * TAU); b.beginPath(); b.arc(x, y, i % 3 ? 1.3 : 2.4, 0, TAU); b.fill(); }
      g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
      const mid = R - W / 2, count = Math.round((TAU * mid) / 13);
      g.lineWidth = 1.5;
      for (let i = 0; i < count; i++) {
        g.save(); g.rotate((i / count) * TAU); g.translate(mid, 0); g.rotate(Math.PI / 2); g.scale(0.66, 0.66);
        g.beginPath(); for (const [x0, y0, x1, y1] of RUNES[(i * 7) % RUNES.length]) { g.moveTo(x0, y0); g.lineTo(x1, y1); }
        g.stroke(); g.restore();
      }
      g.lineWidth = 1.2;
      for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU, [x0, y0] = at(R - W - 1, a), [x1, y1] = at(R - W - (i % 2 ? 3 : 6), a); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    },
    // Lv.30-49 water wave: a wave through the band with drops on its crests, a dashed inner border, small outer ticks
    (b, g, R, W, S) => {
      band(b, R, W, S); borders(b, R, W, 2.6, 1.6, [5, 4]);
      b.lineWidth = 1.6;
      for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, [x0, y0] = at(R + 1, a), [x1, y1] = at(R + (i % 4 ? 4 : 8), a); b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke(); }
      waveLine(g, R - W / 2, W, 18, true);
      g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
    },
    // Lv.50-69 flame blades: the wave plus curved blades sweeping out past the outer border
    (b, g, R, W, S) => {
      band(b, R, W, S); borders(b, R, W, 2.8, 1.6, [5, 4]);
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, w = (TAU / n) * 0.42, L = i % 2 ? 9 : 14;
        const [x0, y0] = at(R, a - w), [x1, y1] = at(R, a + w), [tx, ty] = at(R + L, a + w * 0.9), [cx, cy] = at(R + L * 0.7, a - w * 0.4);
        b.beginPath(); b.moveTo(x0, y0); b.quadraticCurveTo(cx, cy, tx, ty); b.quadraticCurveTo(...at(R + 2, a + w * 0.4), x1, y1); b.closePath(); b.fill();
        g.lineWidth = 1.2; g.beginPath(); g.moveTo(...at(R + 1, a - w * 0.6)); g.quadraticCurveTo(...at(R + L * 0.6, a - w * 0.1), tx, ty); g.stroke();
      }
      waveLine(g, R - W / 2, W, 18, true);
      g.lineWidth = 1; g.beginPath(); g.arc(0, 0, R - 1.5, 0, TAU); g.stroke();
    },
    // Lv.70-89 chains: the band broken into chain links with an eye in every gap and a crack through them, studs outside
    (b, g, R, W, S) => {
      chains(b, g, R, W, S, 12);
      for (let i = 0; i < 24; i++) { const [x, y] = at(R + 4, ((i + 0.5) / 24) * TAU); b.beginPath(); b.arc(x, y, 2, 0, TAU); b.fill(); }
    },
    // Lv.90-100 thorn crown: chains with long / short thorns outward and hooked barbs inward
    (b, g, R, W, S) => {
      chains(b, g, R, W, S, 10);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU, L = i % 2 ? 8 : 16, w = i % 2 ? 0.05 : 0.07;
        b.beginPath(); b.moveTo(...at(R, a - w)); b.lineTo(...at(R + L, a + 0.02)); b.lineTo(...at(R, a + w)); b.closePath(); b.fill();
      }
      for (let i = 0; i < 10; i++) {
        const a = ((i + 0.5) / 10) * TAU;
        b.beginPath(); b.moveTo(...at(R - W, a - 0.06)); b.quadraticCurveTo(...at(R - W - 6, a - 0.02), ...at(R - W - 9, a + 0.06)); b.lineTo(...at(R - W, a + 0.05)); b.closePath(); b.fill();
      }
      for (let i = 0; i < 20; i += 2) { const [x, y] = at(R + 15, (i / 20) * TAU + 0.02); g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
    },
  ];
  const ringCache = new Map();
  // the ring of one pattern / +level / radius, drawn once: { base, glow }
  function ringImg(pattern, plus, R) {
    const key = pattern + '|' + plus + '|' + R;
    if (ringCache.has(key)) return ringCache.get(key);
    const S = RING_STYLE[plus], size = R * 2 + 96, W = 12; // room for spikes AND their blur; no square crop
    const layer = () => { const c = mk(size, size), g = c.getContext('2d'); g.translate(size / 2, size / 2); g.lineCap = 'round'; g.lineJoin = 'round'; return [c, g]; };
    const [base, b] = layer(), [glow, g] = layer();
    b.fillStyle = S.edge; b.strokeStyle = S.edge; b.shadowColor = S.glow; b.shadowBlur = plus >= 10 ? 9 : 4;
    g.strokeStyle = S.rune; g.fillStyle = S.rune; g.shadowColor = S.glow; g.shadowBlur = 7;
    RING_ART[pattern](b, g, R, W, S);
    const out = { base, glow };
    ringCache.set(key, out);
    return out;
  }
  // item level of each slot [weapon, body, legs, arms, shoulder], from what every client knows (tiers)
  const slotLvl = (e, j) => {
    if (!j) return (C.WEAPON_BY_TIER[e.wt || 0] || C.WEAPONS[0]).lvl;
    const t = e.ar && e.ar[j - 1];
    return t ? C.ARMOR_SETS[t - 1].lvl : 1;
  };
  WL.plusRings = function (ctx, e, t, maxRadius = Infinity, maxHalfHeight = Infinity) {
    if (!e.gp || e.dead) return;
    const rings = [];
    e.gp.forEach((n, j) => { if (n >= 8) rings.push({ plus: Math.min(10, n), pattern: ringPattern(slotLvl(e, j)) }); });
    rings.sort((a, b) => a.plus - b.plus || a.pattern - b.pattern);
    // Keep all worn-item rings, but fit their full effect bounds inside a small preview.
    const outer = 50 + Math.max(0, rings.length - 1) * 15 + 48;
    const fit = Math.min(1, maxRadius / outer);
    const fitY = Math.min(fit, maxHalfHeight / (outer * .36));
    rings.forEach((r, i) => {
      const R = 50 + i * 15, img = ringImg(r.pattern, r.plus, R), spin = (i % 2 ? -1 : 1) * (0.3 + i * 0.06);
      const pulse = 0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.3 + (e.x || 0) * 0.01), h = img.base.width / 2;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(fit, fitY * 0.36); ctx.rotate(t * spin);
      ctx.globalAlpha = 0.88; ctx.drawImage(img.base, -h, -h);                 // full strength, however many rings
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 * pulse; ctx.drawImage(img.glow, -h, -h);
      ctx.restore();
    });
  };

  WL.ground = function (ctx, e, t) {
    if (e.cls === 'spearman') return SpearmanLook.ground(ctx,e,t);
    if (window.DualbladeLook && DualbladeLook.is(e)) return DualbladeLook.ground(ctx,e,t);
    if (e.cls === 'archer' && window.ArcherRoyal) return ArcherRoyal.ground(ctx,e,t);
    const lk = WL.look(e.faction, e.wt || 0, e.cls);
    if (lk.tier < 3 || !lk.glow || e.dead) return;
    const fx = WL.fx(e.faction, e.wt, e.cls);
    const intensity = e.cls === 'taoist' ? 0.48 : 0.55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + Math.sin(t * 3 + (e.x || 0)) * 0.5;
    // soft light pool
    if (lk.tier >= 5) {
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, 0.34);
      const r = 40 + lk.tier * 3;
      const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
      grd.addColorStop(0, lk.glow); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (0.18 + pulse * 0.1 + (lk.tier - 5) * 0.03) * intensity;
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (lk.tier < 7) {
      ctx.globalAlpha = (0.22 + pulse * 0.12 + (lk.tier - 3) * 0.04) * intensity;
      ctx.strokeStyle = lk.glow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 28 + lk.tier, 9.5, 0, 0, TAU); ctx.stroke();
      if (lk.tier >= 5) {
        ctx.translate(e.x, e.y); ctx.scale(1, 0.34); ctx.rotate(0.3);
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath(); ctx.arc(34, 0, 2.6, 0, TAU); ctx.fillStyle = lk.glow; ctx.fill();
        }
      }
    } else {
      // rotating rune circle; tier 9+ adds a counter-rotating inner circle, tier 10 is larger
      const big = lk.tier >= 10 ? 1.25 : lk.tier >= 9 ? 1.1 : 0.9;
      const img = e.cls === 'taoist' ? taoSigil(e.faction, lk.glow, fx[0], lk.tier >= 9) : sigil(lk.glow, fx[0], lk.tier >= 9);
      ctx.translate(e.x, e.y); ctx.scale(big, big * 0.36);
      ctx.save();
      ctx.globalAlpha = (0.45 + pulse * 0.2) * intensity;
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      if (lk.tier >= 9) {
        ctx.save(); ctx.scale(0.55, 0.55);
        ctx.globalAlpha = (0.5 + pulse * 0.25) * intensity;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- body aura (nothing orbits the character)
  WL.back = function (ctx, e, x, y, t, s = 1) {
    if (e.cls === 'spearman') return;
    if (window.DualbladeLook && DualbladeLook.is(e)) return;
    if (e.cls === 'archer') return;
    const lk = WL.look(e.faction, e.wt || 0, e.cls);
    if (lk.tier < 6 || !lk.glow || e.dead) return;
    const fx = WL.fx(e.faction, e.wt, e.cls);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // flame-like aura behind the body
    const flick = 0.75 + Math.sin(t * 7 + x) * 0.1 + Math.sin(t * 11.3) * 0.08;
    const h = (50 + lk.tier * 3) * s * flick, w = (18 + lk.tier * 0.8) * s;
    const grd = ctx.createRadialGradient(x, y - 36 * s, 2, x, y - 36 * s, h);
    grd.addColorStop(0, lk.glow); grd.addColorStop(0.45, fx[2]); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.08 + (lk.tier - 6) * 0.02;
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(x, y - 40 * s, w, h * 0.8, 0, 0, TAU); ctx.fill();
    // light column (tier 8+)
    if (lk.tier >= 8) {
      const cg = ctx.createLinearGradient(0, y - 170 * s, 0, y);
      cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, lk.glow);
      ctx.globalAlpha = 0.05 + Math.sin(t * 2) * 0.02;
      ctx.fillStyle = cg; ctx.fillRect(x - 16 * s, y - 170 * s, 32 * s, 170 * s);
    }
    ctx.restore();
  };
  WL.front = function () {};   // nothing is drawn over the character any more

  // item icon src for any item (vector art from ItemArt)
  const icons = {};
  WL.iconSrc = (id, faction) => ItemArt.iconSrc(id, faction);
  WL.icon = function (id, faction) {
    const k = id + faction;
    if (!icons[k]) { const im = new Image(); im.src = WL.iconSrc(id, faction); icons[k] = im; }
    return icons[k];
  };
})();
