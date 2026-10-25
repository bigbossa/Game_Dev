// Visual effects: skill effects, particles, floating numbers, screen shake.
(function () {
  const FX = { list: [], parts: [], texts: [], shake: 0 };
  window.FX = FX;
  const TAU = Math.PI * 2;
  const pal = (f) => (C.FACTIONS[f] || C.FACTIONS.dharma).fx;
  // slash colours follow the wielder's weapon (faction colours for plain blades)
  const palOf = (id, f) => {
    const e = id && window.G && G.ents.get(id);
    if (e && e.cls === 'taoist' && window.WeaponLook) return WeaponLook.fx(f, e.wt || 0, 'taoist');   // healer / destroyer colours
    return e && e.wt && window.WeaponLook ? WeaponLook.fx(f, e.wt) : pal(f);
  };
  const now = () => performance.now();
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  // follow a live entity if it still exists
  const posOf = (fx) => {
    const e = fx.id && window.G && G.ents.get(fx.id);
    if (e) { fx.x = e.x; fx.y = e.y; }
    return fx;
  };

  function add(dur, layer, draw, extra = {}) {
    FX.list.push({ t0: now(), dur, layer, draw, ...extra });
  }

  function crescent(g, cx, cy, R, a0, a1, thick) {
    const mid = (a0 + a1) / 2;
    g.beginPath();
    g.arc(cx, cy, R, a0, a1);
    g.arc(cx - Math.cos(mid) * thick, cy - Math.sin(mid) * thick, R, a1, a0, true);
    g.closePath();
  }

  // ---------------------------------------------------------------- particles
  FX.burst = function (x, y, n, colors, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * TAU;
      const sp = (o.speed || 160) * (0.4 + Math.random() * 0.8);
      FX.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
        life: 0, max: (o.life || 500) * (0.6 + Math.random() * 0.6),
        size: (o.size || 3) * (0.6 + Math.random() * 0.8), color: colors[(Math.random() * colors.length) | 0],
        grav: o.grav || 0, drag: o.drag || 2.5, spark: !!o.spark,
      });
    }
  };
  FX.text = function (x, y, text, color, size = 20, o = {}) {
    FX.texts.push({ x: x + (Math.random() - 0.5) * 18, y, text, color, size, life: 0, max: o.max || 950, vy: o.vy || -60, stroke: o.stroke || 'rgba(0,0,0,0.85)' });
  };

  // ---------------------------------------------------------------- skills
  // Every skill grows with the wielder's effect tier: the weapon tier, or the martial stage (C.stageOf: one per
  // 10 levels) when that is higher, so a Lv.130 character always fights with full tier-10 effects. The stage also
  // enlarges everything (+3% per stage) and adds sparks. Tiers unlock bigger arcs, after-images, spark showers,
  // lightning (6+), spirit wisps (8+) and a dragon flourish (10+). Evolved skills (rank r) add their own layers.
  const entOf = (id) => id && window.G && G.ents.get(id);
  const tierOf = (id) => { const e = entOf(id); return (e && e.wt) || 0; };
  function powerFor(e) {
    const wt = (e && e.wt) || 0, st = C.stageOf((e && e.lvl) || 1);
    const P = window.WeaponLook ? WeaponLook.power(Math.max(wt, Math.floor(st * 0.8))) : { tier: 0, scale: 1, sparks: 0 };
    P.wt = wt; P.stage = st;
    P.scale *= 1 + st * 0.03;
    P.sparks += Math.round(st * 1.2);
    return P;
  }
  const powerOf = (id) => powerFor(entOf(id));
  FX.powerOf = powerOf;
  const glowOf = (id, f, c) => { const e = entOf(id); return (e && window.WeaponLook && WeaponLook.look(f, e.wt || 0, e.cls).glow) || c[1]; };
  const isMine = (id) => window.G && id === G.myId;
  const shakeMine = (id, v) => { if (isMine(id)) FX.shake = Math.max(FX.shake, v); };
  // +5 and up: lightning in the +level colour bursts from the weapon as the basic attack goes off (every class)
  const plusBolts = (e, x, y, a, S = 1) => {
    if (!e || (e.wp || 0) < 5 || !window.WeaponLook) return;
    const pc = WeaponLook.plusColor(e.wp);
    setTimeout(() => boltsFrom(x, y, e.wp >= 9 ? 3 : e.wp >= 7 ? 2 : 1, (50 + e.wp * 6) * S, ['#ffffff', pc, pc], pc, a, 1.6), 40);
  };
  // a few lightning bolts radiating from (x, y)
  const boltsFrom = (x, y, n, len, c, glow, a0 = null, spread = TAU) => {
    for (let i = 0; i < n; i++) {
      const a = a0 === null ? Math.random() * TAU : a0 + (Math.random() - 0.5) * spread;
      const L = len * (0.6 + Math.random() * 0.5);
      FX.bolt(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.7, c[0], glow);
    }
  };
  // expanding ellipse shockwave on the ground
  const shockwave = (x, y, r, col, dur = 500, w = 6) => add(dur, 'ground', (g, p) => {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.9;
    g.strokeStyle = col; g.lineWidth = w * (1 - p) + 1;
    g.beginPath(); g.ellipse(x, y, r * ease(p), r * ease(p) * 0.45, 0, 0, TAU); g.stroke(); g.restore();
  });

  // a crescent of sword-qi flying from (x0, y0) along angle a for len px (wave skill, slash qi)
  function flyingCrescent(x0, y0, a, len, dur, c, glow, S, o = {}) {
    const R = (o.R || 46) * S, th = (o.th || 16) * S, echo = o.echo ?? 3;
    add(dur, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = echo; k >= 0; k--) {
        const q = Math.max(0, p - k * 0.05);
        const d = len * q, x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d;
        const cx = x - Math.cos(a) * R, cy = y - Math.sin(a) * R;
        g.globalAlpha = (p > 0.8 ? (1 - p) / 0.2 : 1) * (k ? 0.3 / k : 1);
        g.fillStyle = glow; crescent(g, cx, cy, R * 1.12, a - 1.05, a + 1.05, th * 1.5); g.fill();
        g.fillStyle = c[1]; crescent(g, cx, cy, R, a - 0.9, a + 0.9, th); g.fill();
        g.fillStyle = c[0]; crescent(g, cx, cy, R, a - 0.7, a + 0.7, th * 0.4); g.fill();
      }
      g.restore();
    }, { t0: now() + (o.delay || 0) });
  }
  // full-screen flash for the biggest finishers (drawn by main.js over the world)
  FX.flashes = [];
  FX.flash = function (col, dur = 400, a = 0.5) { FX.flashes.push({ col, t0: now(), dur, a }); };
  FX.drawFlash = function (g, w, h) {
    const n = now();
    FX.flashes = FX.flashes.filter((f) => n - f.t0 < f.dur);
    if (!FX.flashes.length) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const f of FX.flashes) { g.globalAlpha = f.a * (1 - (n - f.t0) / f.dur); g.fillStyle = f.col; g.fillRect(0, 0, w, h); }
    g.restore();
  };
  FX.LEAP_H = 100; // apex of the พยัคฆ์ทะยานฟ้า jump (px above the ground)

  function drawSlashArcs(g, cx, cy, a, flip, reveal, c, S, glow, tier) {
    const sw = 1.15;
    const layers = [[74 * S, 0, c[1], 16 * S], [60 * S, 0.25, c[2], 12 * S]];
    if (tier >= 3) layers.unshift([88 * S, -0.12, glow, 6 * S]);
    if (tier >= 10) layers.unshift([104 * S, -0.2, c[0], 4 * S]);
    for (const [R, off, col, th] of layers) {
      const start = a - sw * flip + off * flip;
      const end = start + 2 * sw * flip * reveal;
      const a0 = Math.min(start, end), a1 = Math.max(start, end);
      g.fillStyle = col; crescent(g, cx, cy, R, a0, a1, th); g.fill();
      g.fillStyle = c[0]; crescent(g, cx, cy, R, a0 + 0.05, a1 - 0.05, th * 0.35); g.fill();
    }
  }

  FX.slash = function (id, a, f, combo, r) {
    const c = palOf(id, f), P = powerOf(id), S = P.scale, glow = glowOf(id, f, c);
    if (combo === 2) return spinSlash(id, f, c, P, glow);
    const flip = combo ? -1 : 1;
    const me0 = entOf(id);
    if (r && me0) // ฟันคู่ลมปราณ: a short qi crescent flies on from the swing
      flyingCrescent(me0.x + Math.cos(a) * 40, me0.y - 30 + Math.sin(a) * 24, a, 80 * S, 260, c, glow, S * 0.7, { R: 34, th: 12, echo: 2, delay: 60 });
    const arc = (delay, alphaK, grow) => add(260 + P.tier * 8, 'top', (g, p, fx) => {
      posOf(fx);
      const cx = fx.x + Math.cos(a) * 14, cy = fx.y - 30 + Math.sin(a) * 8;
      const reveal = Math.min(1, p * 2.2);
      const alpha = (p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45) * alphaK;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
      drawSlashArcs(g, cx, cy, a, flip, reveal, c, S * grow, glow, P.tier);
      g.restore();
    }, { id, x: 0, y: 0, t0: now() + delay });
    arc(0, 1, 1);
    if (P.echo) arc(70, 0.45, 1.14);                      // after-image
    const e = G.ents.get(id);
    if (!e) return;
    const tipX = e.x + Math.cos(a) * 70 * S, tipY = e.y - 30 + Math.sin(a) * 44 * S;
    if (P.sparks) FX.burst(tipX, tipY, P.sparks, [c[0], c[1], glow], { angle: a, spread: 1.8, speed: 200 + P.tier * 14, life: 360, size: 2.4, spark: true });
    if (P.bolts) setTimeout(() => boltsFrom(tipX, tipY, P.tier >= 9 ? 2 : 1, 60 * S, c, glow, a, 1.4), 60);
    plusBolts(e, tipX, tipY, a, S);                                 // enhanced: lightning in the +level colour
    if (P.wisps) FX.burst(tipX, tipY, 6, [glow, c[0]], { speed: 40, up: 90, life: 800, size: 3, drag: 1 });
    if (P.dragon) {
      FX.burst(tipX, tipY, 12, ['#fff3c0', glow, c[1]], { angle: a, spread: 2.4, speed: 320, life: 520, size: 3, spark: true });
      shakeMine(id, 3);
    }
  };

  // ฟันคู่ลมปราณ: every third slash is a full spin
  function spinSlash(id, f, c, P, glow) {
    const S = P.scale;
    add(420, 'top', (g, p, fx) => {
      posOf(fx);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
      g.translate(fx.x, fx.y - 26); g.scale(1, 0.6);
      const rot = p * TAU * 1.4;
      for (let k = 0; k < 2; k++) {
        const a0 = rot + k * Math.PI;
        g.fillStyle = glow; crescent(g, 0, 0, 128 * S, a0, a0 + 2.2, 22 * S); g.fill();
        g.fillStyle = c[1]; crescent(g, 0, 0, 118 * S, a0 + 0.1, a0 + 2.0, 15 * S); g.fill();
        g.fillStyle = c[0]; crescent(g, 0, 0, 118 * S, a0 + 0.3, a0 + 1.8, 5 * S); g.fill();
      }
      g.restore();
    }, { id, x: 0, y: 0 });
    const e = entOf(id);
    if (e) { FX.burst(e.x, e.y - 24, 16 + P.sparks, [...c, glow], { speed: 280, life: 380, spark: true }); shockwave(e.x, e.y, 125 * S, glow, 380, 5); }
    shakeMine(id, 3);
  }

  FX.whirl = function (id, f, r) {
    const c = palOf(id, f), P = powerOf(id), S = P.scale, glow = glowOf(id, f, c);
    const spins = r ? 4 : 3;
    add(r ? 900 : 700, 'top', (g, p, fx) => {
      posOf(fx);
      const cx = fx.x, cy = fx.y - 24;
      const rot = p * TAU * (r ? 4.3 : 3.2);
      const alpha = p < 0.8 ? 1 : (1 - p) / 0.2;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * 0.9;
      g.translate(cx, cy); g.scale(1, 0.62);
      const blades = P.tier >= 7 ? 4 : 3;
      for (let k = 0; k < blades; k++) {
        const a0 = rot + (k * TAU) / blades, R = (118 - (k % 3) * 12) * S;
        g.fillStyle = k % 2 ? c[2] : c[1];
        crescent(g, 0, 0, R, a0, a0 + 1.6, 18 * S); g.fill();
        g.fillStyle = c[0];
        crescent(g, 0, 0, R, a0 + 0.2, a0 + 1.4, 6 * S); g.fill();
      }
      g.strokeStyle = P.tier >= 3 ? glow : c[1]; g.globalAlpha = alpha * (0.35 + P.tier * 0.03); g.lineWidth = 3 + P.tier * 0.3;
      g.beginPath(); g.arc(0, 0, 130 * S, 0, TAU); g.stroke();
      g.restore();
    }, { id, x: 0, y: 0 });
    // vortex on the ground (tier 4+)
    if (P.tier >= 4) add(760, 'ground', (g, p, fx) => {
      posOf(fx);
      g.save(); g.translate(fx.x, fx.y); g.scale(1, 0.42); g.rotate(-p * 9);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = (p < 0.8 ? 0.7 : (1 - p) / 0.2 * 0.7);
      g.strokeStyle = glow; g.lineWidth = 3; g.setLineDash([22, 14]);
      g.beginPath(); g.arc(0, 0, 120 * S, 0, TAU); g.stroke();
      g.lineWidth = 2; g.setLineDash([8, 10]);
      g.beginPath(); g.arc(0, 0, 80 * S, 0, TAU); g.stroke();
      g.restore();
    }, { id, x: 0, y: 0 });
    // light pillar (tier 8+)
    if (P.tier >= 8) add(700, 'top', (g, p, fx) => {
      posOf(fx);
      const w = 40 * (1 - p) * S;
      const grd = g.createLinearGradient(0, fx.y - 260, 0, fx.y);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, glow);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.55;
      g.fillStyle = grd; g.fillRect(fx.x - w / 2, fx.y - 260, w, 260); g.restore();
    }, { id, x: 0, y: 0 });
    for (let i = 0; i < spins; i++) setTimeout(() => {
      const e = G.ents.get(id); if (!e) return;
      FX.burst(e.x, e.y - 20, 14 + P.sparks, [...c, glow], { speed: 260 + P.tier * 12, life: 380, size: 3, spark: true });
      if (P.bolts) boltsFrom(e.x, e.y - 24, 2 + (P.tier >= 9 ? 2 : 0), 120 * S, c, glow);
      if (P.tier >= 6 || r) shockwave(e.x, e.y, (r ? 150 : 135) * S, glow, 420, 5);
      if (r) {
        // พายุดาบอสนี: a ring of lightning strikes and qi sucked inward
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + i;
          const bx = e.x + Math.cos(a) * 140 * S, by = e.y + Math.sin(a) * 60 * S;
          FX.bolt(bx + (Math.random() - 0.5) * 20, by - 170, bx, by - 6, '#ffffff', glow);
        }
        for (let k = 0; k < 18; k++) {
          const a = Math.random() * TAU, d = 150 + Math.random() * 40;
          FX.parts.push({ x: e.x + Math.cos(a) * d, y: e.y - 20 + Math.sin(a) * d * 0.5, vx: -Math.cos(a) * d * 2.6, vy: -Math.sin(a) * d * 1.3,
            life: 0, max: 380, size: 2.4, color: k % 2 ? glow : c[0], grav: 0, drag: 1, spark: true });
        }
        shakeMine(id, 4);
      }
      if (P.dragon) shakeMine(id, 4);
    }, i * 200);
  };

  FX.dash = function (id, x0, y0, x1, y1, f, r) {
    const c = palOf(id, f), P = powerOf(id), S = P.scale, glow = glowOf(id, f, c);
    const e = G.ents.get(id);
    const ghosts = [];
    const nG = 7 + Math.floor(P.tier / 2);
    for (let i = 0; i < nG; i++) { const t = i / (nG - 1); ghosts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); }
    add(520 + P.tier * 20, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter';
      const grd = g.createLinearGradient(x0, y0, x1, y1);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, c[1]);
      g.strokeStyle = grd; g.globalAlpha = (1 - p) * 0.9; g.lineCap = 'round';
      g.lineWidth = 26 * S * (1 - p); g.beginPath(); g.moveTo(x0, y0 - 30); g.lineTo(x1, y1 - 30); g.stroke();
      if (P.tier >= 3) { g.strokeStyle = glow; g.globalAlpha = (1 - p) * 0.45; g.lineWidth = 44 * S * (1 - p); g.beginPath(); g.moveTo(x0, y0 - 30); g.lineTo(x1, y1 - 30); g.stroke(); }
      g.globalAlpha = (1 - p) * 0.9;
      g.lineWidth = 6 * (1 - p); g.strokeStyle = c[0]; g.beginPath(); g.moveTo(x0, y0 - 30); g.lineTo(x1, y1 - 30); g.stroke();
      g.restore();
      if (e && window.drawGhost) ghosts.forEach(([gx, gy], i) => {
        const al = (1 - p) * (0.15 + (i / ghosts.length) * 0.45);
        if (al > 0.02) drawGhost(e, gx, gy, al, c[1]);
      });
    });
    FX.burst(x0, y0 - 20, 16, c, { speed: 180, life: 400 });
    FX.burst(x1, y1 - 20, 22 + P.sparks, [...c, glow], { speed: 240 + P.tier * 10, life: 450, spark: true });
    const L = Math.hypot(x1 - x0, y1 - y0);
    // embers left along the path (tier 4+)
    if (P.tier >= 4) for (let i = 0; i < 6 + P.tier * 2; i++) {
      const t = Math.random();
      FX.burst(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 20 - Math.random() * 20, 1, [glow, c[0]], { speed: 20, up: 40 + Math.random() * 40, life: 700 + P.tier * 40, size: 2.6, drag: 1 });
    }
    // lightning chain along the path (tier 6+)
    if (P.bolts && L > 20) {
      const n = Math.max(2, Math.round(L / 70));
      for (let i = 0; i < n; i++) {
        const ta = i / n, tb = (i + 1) / n;
        setTimeout(() => FX.bolt(x0 + (x1 - x0) * ta, y0 + (y1 - y0) * ta - 30, x0 + (x1 - x0) * tb, y0 + (y1 - y0) * tb - 30, c[0], glow), i * 25);
      }
    }
    // burning scar on the ground (tier 8+)
    if (P.tier >= 8) add(1300, 'ground', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.6; g.lineCap = 'round';
      g.strokeStyle = glow; g.lineWidth = 10; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = c[0]; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    });
    if (P.dragon) { shockwave(x1, y1, 110, glow, 500, 8); shakeMine(id, 5); }
    // เงาพริบตาสามชั้น: three shadow bombs burst behind the dash
    if (r) [0.2, 0.55, 0.9].forEach((t, k) => {
      const bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
      add(260 + k * 90, 'ground', (g, p) => { // fuse: a dark seal pulsing on the ground
        g.save(); g.translate(bx, by); g.scale(1, 0.45); g.rotate(p * 6);
        g.globalAlpha = 0.5 + p * 0.5; g.strokeStyle = glow; g.lineWidth = 3; g.setLineDash([10, 8]);
        g.beginPath(); g.arc(0, 0, 40 + p * 30, 0, TAU); g.stroke(); g.restore();
      });
      setTimeout(() => {
        shockwave(bx, by, 95 * S, glow, 420, 8);
        add(380, 'top', (g, p) => {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
          const grd = g.createRadialGradient(bx, by - 26, 2, bx, by - 26, 70 * S);
          grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, glow); grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd; g.beginPath(); g.arc(bx, by - 26, 70 * S * (0.5 + p), 0, TAU); g.fill(); g.restore();
        });
        FX.burst(bx, by - 24, 22 + P.sparks, ['#1a1024', '#4a2a6a', glow, c[0]], { speed: 260, up: 60, life: 520, size: 3.4, spark: true });
        shakeMine(id, 5);
      }, 260 + k * 90);
    });
  };

  FX.cross = function (id, a, f, r) {
    const c = palOf(id, f), P = powerOf(id), glow = glowOf(id, f, c);
    crossAt(id, a, c, P, glow, 0, 1, 0, P.tier >= 9 || r > 0, r ? 100 : 78);
    // กากบาทดาราพิฆาต: a second, larger star cross rotated half a point
    if (r) setTimeout(() => { crossAt(id, a, c, P, glow, 0, 1.35, Math.PI / 8, true, 112); FX.flash(glow, 180, 0.12); }, 290);
  };
  function crossAt(id, a, c, P, glow, delay, k, rot0, star, off) {
    const S = P.scale * k;
    add(460 + P.tier * 15, 'top', (g, p, fx) => {
      posOf(fx);
      const cx = fx.x + Math.cos(a) * off, cy = fx.y - 28 + Math.sin(a) * off * 0.66;
      const grow = ease(Math.min(1, p * 2.5));
      const alpha = p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5;
      g.save(); g.translate(cx, cy); g.rotate(a + rot0);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
      const rots = star ? [0.78, -0.78, 0, Math.PI / 2] : [0.78, -0.78];
      rots.forEach((r, k) => {
        g.save(); g.rotate(r);
        const L = (k < 2 ? 92 : 64) * S * grow, W = (k < 2 ? 13 : 8) * S * (1 - p * 0.5);
        if (P.tier >= 3) { g.fillStyle = glow; g.globalAlpha = alpha * 0.4; g.fillRect(-L * 1.05, -W * 0.9, L * 2.1, W * 1.8); g.globalAlpha = alpha; }
        g.fillStyle = c[2];
        g.beginPath(); g.moveTo(-L, 0); g.quadraticCurveTo(0, -W * 2, L, 0); g.quadraticCurveTo(0, W * 0.6, -L, 0); g.fill();
        g.fillStyle = c[1];
        g.beginPath(); g.moveTo(-L * 0.9, 0); g.quadraticCurveTo(0, -W * 1.2, L * 0.9, 0); g.quadraticCurveTo(0, W * 0.3, -L * 0.9, 0); g.fill();
        g.fillStyle = c[0]; g.fillRect(-L * 0.7, -1.5, L * 1.4, 3);
        g.restore();
      });
      g.restore();
    }, { id, x: 0, y: 0 });
    setTimeout(() => {
      const e = G.ents.get(id);
      if (!e) return;
      const ix = e.x + Math.cos(a) * off, iy = e.y - 28 + Math.sin(a) * off * 0.66;
      FX.burst(ix, iy, 26 + P.sparks * 2, [...c, glow], { speed: 300 + P.tier * 15, life: 420, spark: true });
      FX.shake = Math.max(FX.shake, isMine(id) ? 5 + P.tier * 0.5 : 5);
      // X scar burnt into the ground (tier 5+)
      if (P.tier >= 5) {
        const gx = e.x + Math.cos(a) * off, gy = e.y + Math.sin(a) * off * 0.66;
        add(1000 + P.tier * 60, 'ground', (g, p) => {
          g.save(); g.translate(gx, gy); g.scale(1, 0.5); g.rotate(a);
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.7; g.lineCap = 'round';
          for (const r of star ? [0.78, -0.78, 0, Math.PI / 2] : [0.78, -0.78]) {
            g.save(); g.rotate(r);
            g.strokeStyle = glow; g.lineWidth = 9; g.beginPath(); g.moveTo(-70 * S, 0); g.lineTo(70 * S, 0); g.stroke();
            g.strokeStyle = c[0]; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-60 * S, 0); g.lineTo(60 * S, 0); g.stroke();
            g.restore();
          }
          g.restore();
        });
      }
      if (P.tier >= 7) { shockwave(ix, iy + 28, 120 * S, glow, 520, 7); boltsFrom(ix, iy, 2 + (star ? 2 : 0), 90 * S, c, glow); }
      if (P.dragon) FX.burst(ix, iy, 20, ['#fff3c0', glow], { speed: 120, up: 120, life: 1000, size: 3.4, drag: 1 });
    }, 130);
  }

  FX.ult = function (x, y, f, id, r) {
    r = r || 0;
    const c = palOf(id, f), P = powerOf(id), glow = glowOf(id, f, c);
    const tint = (P.wt && window.WeaponLook && WeaponLook.look(f, P.wt).tint) || '#e8eef6';
    const R = [180, 220, 260][r], waves = [7, 9, 11][r];
    const span = 400 + waves * 180;                    // matches the server's hit waves
    const impact = r ? span + 250 : 1820;              // giant sword lands
    add(impact + 500, 'ground', (g, p) => {
      const alpha = p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1;
      g.save(); g.translate(x, y); g.scale(1, 0.55); g.globalAlpha = alpha;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = c[1]; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 20, 0, TAU); g.stroke();
      // rune ring (tier 5+ or evolved)
      if (P.tier >= 5 || r) {
        g.save(); g.rotate(-p * 2); g.strokeStyle = glow; g.fillStyle = glow;
        for (let i = 0; i < 18; i++) {
          g.rotate(TAU / 18);
          g.fillRect(R - 15, -3, 6, 6);
          if (i % 2) { g.beginPath(); g.arc(R + 12, 0, 3, 0, TAU); g.fill(); }
        }
        g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R + 18, 0, TAU); g.stroke();
        g.restore();
      }
      g.rotate(p * 4);
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i * 2 * TAU) / 6; i ? g.lineTo(Math.cos(a) * (R - 20), Math.sin(a) * (R - 20)) : g.moveTo(R - 20, 0); }
      g.stroke();
      if (P.tier >= 8 || r) {
        g.strokeStyle = glow; g.rotate(-p * 8);
        g.beginPath();
        for (let i = 0; i <= 8; i++) { const a = (i * 3 * TAU) / 8; i ? g.lineTo(Math.cos(a) * (R - 50), Math.sin(a) * (R - 50)) : g.moveTo(R - 50, 0); }
        g.stroke();
      }
      g.fillStyle = c[2]; g.globalAlpha = alpha * (0.18 + P.tier * 0.015); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
      if (r > 1) { // เทพดาบพิฆาตจักรวาล: a cosmic ring of stars outside the circle
        g.globalAlpha = alpha; g.rotate(p * 3);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU, rr = R + 34 + Math.sin(p * 20 + i) * 6;
          g.fillStyle = i % 3 ? glow : '#fff6c8';
          g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, i % 3 ? 3 : 5, 0, TAU); g.fill();
        }
        g.strokeStyle = '#fff6c8'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R + 52, 0, TAU); g.stroke();
      }
      g.restore();
    });
    // falling swords: more and brighter with higher tiers
    const N = 20 + P.tier * 2 + r * 14;
    for (let i = 0; i < N; i++) {
      const delay = 300 + Math.random() * (span - 300);
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * R * 0.95;
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.55;
      setTimeout(() => {
        add(420, 'top', (g, p) => {
          const fall = Math.min(1, p / 0.38);
          const hy = sy - 280 * (1 - fall * fall);
          const alpha = p < 0.7 ? 1 : (1 - p) / 0.3;
          g.save(); g.translate(sx, hy); g.globalAlpha = alpha;
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = c[1]; g.fillRect(-1.5, -90, 3, 70);
          if (P.tier >= 3) { g.fillStyle = glow; g.globalAlpha = alpha * 0.4; g.fillRect(-5, -100, 10, 96); g.globalAlpha = alpha; }
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = tint;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-5, -12); g.lineTo(-4, -56); g.lineTo(4, -56); g.lineTo(5, -12); g.closePath(); g.fill();
          g.fillStyle = c[2]; g.fillRect(-11, -60, 22, 5);
          g.fillStyle = '#4a3020'; g.fillRect(-2.5, -76, 5, 16);
          g.fillStyle = c[1]; g.beginPath(); g.arc(0, -78, 3.5, 0, TAU); g.fill();
          g.restore();
        });
        setTimeout(() => {
          FX.burst(sx, sy, 10 + Math.round(P.sparks / 2), [...c, glow], { speed: 200, life: 380, spark: true });
          FX.shake = Math.max(FX.shake, 3);
          if (P.bolts && Math.random() < 0.35) boltsFrom(sx, sy - 10, 1, 50, c, glow);
          add(700, 'ground', (g, p) => {
            g.save(); g.globalAlpha = (1 - p) * 0.7; g.strokeStyle = c[2]; g.lineWidth = 2;
            g.beginPath(); g.ellipse(sx, sy, 10 + p * 26, (10 + p * 26) * 0.5, 0, 0, TAU); g.stroke(); g.restore();
          });
        }, 160);
      }, delay);
    }
    // tier 10 or evolved: a colossal heavenly sword (three at rank 2) crashes into the centre at the end
    if (P.dragon || r) {
      const swords = r > 1 ? [[0, 0, 1.25], [-R * 0.5, -10, 0.85], [R * 0.5, -10, 0.85]] : [[0, 0, 1]];
      swords.forEach(([ox, oy, k], si) => setTimeout(() => {
        add(700, 'top', (g, p) => {
          const fall = Math.min(1, p / 0.45);
          const hy = y + oy - 520 * (1 - fall * fall * fall);
          const alpha = p < 0.75 ? 1 : (1 - p) / 0.25;
          g.save(); g.translate(x + ox, hy); g.scale(k, k); g.globalAlpha = alpha;
          g.globalCompositeOperation = 'lighter';
          const grd = g.createLinearGradient(0, -420, 0, 0);
          grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, glow);
          g.fillStyle = grd; g.fillRect(-26, -420, 52, 420);
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = tint;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, -40); g.lineTo(-13, -190); g.lineTo(13, -190); g.lineTo(16, -40); g.closePath(); g.fill();
          g.fillStyle = c[0]; g.fillRect(-2, -185, 4, 170);
          g.fillStyle = c[2]; g.fillRect(-38, -204, 76, 14);
          g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(0, -197, 9, 0, TAU); g.fill();
          g.fillStyle = '#4a3020'; g.fillRect(-7, -250, 14, 46);
          g.fillStyle = glow; g.beginPath(); g.arc(0, -256, 9, 0, TAU); g.fill();
          g.restore();
        });
        setTimeout(() => {
          FX.shake = Math.max(FX.shake, 16 + r * 4);
          shockwave(x + ox, y + oy, (260 + r * 40) * k, glow, 700, 12);
          shockwave(x + ox, y + oy, 190 * k, c[0], 500, 6);
          FX.burst(x + ox, y + oy - 10, 60, ['#ffffff', glow, c[1], '#ffe08a'], { speed: 420, up: 120, life: 800, size: 4, spark: true });
          boltsFrom(x + ox, y + oy - 20, 6, 170 * k, c, glow);
          if (si === 0 && r) FX.flash(r > 1 ? '#fff0b0' : glow, r > 1 ? 600 : 350, r > 1 ? 0.28 : 0.15);
        }, 320);
      }, impact - 320 + si * 140));
    }
  };

  FX.hit = function (x, y, f, crit, srcId) {
    const t = tierOf(srcId);
    const src = entOf(srcId);
    const c = src && window.WeaponLook ? WeaponLook.fx(src.faction, t, src.cls) : f ? pal(f) : ['#ffffff', '#ffe08a', '#ff9a3a'];
    const P = src ? powerFor(src) : { tier: 0, sparks: 0 };
    const glow = src ? glowOf(srcId, src.faction, c) : c[1];
    FX.burst(x, y, (crit ? 16 : 8) + Math.round(P.sparks / 2), [...c, glow], { speed: (crit ? 260 : 180) + P.tier * 8, life: 300, size: crit ? 4 : 3, spark: true });
    const R = (crit ? 26 : 16) * (1 + P.tier * 0.06);
    add(160 + P.tier * 10, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
      g.fillStyle = c[0]; g.beginPath(); g.arc(x, y, 8 + p * R, 0, TAU); g.fill();
      if (P.tier >= 4) { g.strokeStyle = glow; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 10 + p * R * 1.7, 0, TAU); g.stroke(); }
      g.restore();
    });
    if (P.bolts && (crit || Math.random() < 0.3)) boltsFrom(x, y, crit ? 2 : 1, 34 + P.tier * 2, c, glow);
  };
  // ---------------------------------------------------------------- Lv.10 ดาบวายุพิฆาต (Lv.100 วายุสามจันทรา)
  FX.wave = function (id, a, f, r) {
    const e = entOf(id); if (!e) return;
    const c = palOf(id, f), P = powerOf(id), S = P.scale, glow = glowOf(id, f, c);
    const L = r ? 520 : 440, x0 = e.x + Math.cos(a) * 20, y0 = e.y - 18 + Math.sin(a) * 12;
    for (const da of r ? [-0.32, 0, 0.32] : [0]) {
      const b = a + da;
      const SW = Math.min(S, 1.4) * (r ? 1.1 : 1);
      flyingCrescent(x0, y0, b, L, 470, c, glow, SW, { R: 44, th: 16, echo: 2 + Math.min(4, P.stage >> 2) });
      if (P.tier >= 5) flyingCrescent(x0, y0, b, L * 0.9, 470, c, glow, SW * 0.72, { R: 40, th: 10, echo: 1, delay: 70 });
      for (let k = 1; k <= 8; k++) setTimeout(() => {
        const d = (L * k) / 8, x = x0 + Math.cos(b) * d, y = y0 + Math.sin(b) * d;
        FX.burst(x, y, 3 + (P.sparks >> 2), [c[0], c[1], glow], { angle: b + Math.PI, spread: 1.2, speed: 140, life: 320, size: 2.2, spark: true });
        if (P.bolts && k % 3 === 0) boltsFrom(x, y, 1, 44 * S, c, glow, b, 1.2);
      }, k * 55);
      setTimeout(() => FX.burst(x0 + Math.cos(b) * L, y0 + Math.sin(b) * L, 14 + P.sparks, [...c, glow], { speed: 230, life: 380, spark: true }), 460);
      // wind scar along the ground
      add(560, 'ground', (g, p) => {
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.5; g.strokeStyle = glow; g.lineWidth = 3; g.setLineDash([18, 12]);
        g.lineDashOffset = -p * 120;
        g.beginPath(); g.moveTo(x0, y0 + 18); g.lineTo(x0 + Math.cos(b) * L * Math.min(1, p * 1.3), y0 + 18 + Math.sin(b) * L * Math.min(1, p * 1.3)); g.stroke();
        g.restore();
      });
    }
    shakeMine(id, r ? 4 : 2);
  };

  // ---------------------------------------------------------------- Lv.30 พยัคฆ์ทะยานฟ้า (Lv.110 อุกกาบาตพยัคฆ์)
  FX.leap = function (id, x0, y0, x1, y1, f, r) {
    const c = palOf(id, f), P = powerOf(id), glow = glowOf(id, f, c), S = Math.min(P.scale, 1.15);
    const fire = ['#fff3c0', '#ffb040', '#ff4a1a'];
    const trail = r ? fire : [c[0], c[1], glow];
    shockwave(x0, y0, 70, c[1], 360, 4);
    FX.burst(x0, y0 - 4, 16, ['#c8b8a0', '#8a7a68', c[1]], { speed: 140, up: 40, life: 500, size: 3, drag: 2 });
    // glowing arc of the jump (falls as a meteor when evolved)
    add(820, 'top', (g, p) => {
      const q = Math.min(1, (p * 820) / 460);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [col, w, al] of [[trail[2], 18 * S, 0.35], [trail[1], 8 * S, 0.8], [trail[0], 3, 1]]) {
        g.strokeStyle = col; g.lineWidth = w; g.globalAlpha = al * (p < 0.56 ? 1 : (1 - p) / 0.44);
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = Math.max(0, q - 0.45) + (i / 24) * Math.min(q, 0.45);
          const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * FX.LEAP_H - 34;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      g.restore();
      if (r && q < 1 && q > 0.45 && Math.random() < 0.7) { // meteor embers on the way down
        const x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * FX.LEAP_H - 34;
        FX.burst(x, y, 2, fire, { speed: 60, up: -40, life: 400, size: 3.2, drag: 1 });
      }
    });
    setTimeout(() => {
      shockwave(x1, y1, 150 * S, glow, 520, 10);
      shockwave(x1, y1, 100 * S, c[0], 380, 6);
      FX.burst(x1, y1 - 6, 34 + P.sparks, ['#8a7a68', '#5a4a3a', c[1], glow], { speed: 320, up: 240, grav: 900, life: 800, size: 3.6, drag: 1 });
      if (P.bolts) boltsFrom(x1, y1 - 20, 4, 110 * S, c, glow);
      // crater cracks
      const cracks = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * TAU + Math.random() * 0.4, L = (60 + Math.random() * 60) * S, pts = [[0, 0]];
        for (let k = 1; k <= 4; k++) pts.push([Math.cos(a) * (L * k) / 4 + (Math.random() - 0.5) * 12, Math.sin(a) * (L * k) / 4 + (Math.random() - 0.5) * 12]);
        return pts;
      });
      add(1700, 'ground', (g, p) => {
        g.save(); g.translate(x1, y1); g.scale(1, 0.5); g.globalAlpha = (1 - p) * 0.9;
        g.fillStyle = 'rgba(20,10,5,0.35)'; g.beginPath(); g.arc(0, 0, 50 * S, 0, TAU); g.fill();
        g.lineCap = 'round';
        for (const [col, w] of [['rgba(10,5,0,0.6)', 5], [r ? '#ff7a2a' : glow, 2]]) {
          g.strokeStyle = col; g.lineWidth = w;
          for (const pts of cracks) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
        }
        g.restore();
      });
      if (P.stage >= 8) add(600, 'top', (g, p) => { // pillar of light from the impact
        const w = 60 * S * (1 - p);
        const grd = g.createLinearGradient(0, y1 - 300, 0, y1);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, r ? '#ff9a3a' : glow);
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.7; g.fillStyle = grd; g.fillRect(x1 - w / 2, y1 - 300, w, 300); g.restore();
      });
      shakeMine(id, r ? 12 : 8);
      if (r) {
        // อุกกาบาตพยัคฆ์: ring of fire left burning + a second shockwave
        add(4000, 'ground', (g, p) => {
          g.save(); g.translate(x1, y1); g.scale(1, 0.5); g.globalCompositeOperation = 'lighter';
          g.globalAlpha = p < 0.85 ? 0.8 : (1 - p) / 0.15 * 0.8;
          const grd = g.createRadialGradient(0, 0, 60, 0, 0, 170);
          grd.addColorStop(0, 'rgba(255,90,20,0)'); grd.addColorStop(0.8, 'rgba(255,110,30,0.45)'); grd.addColorStop(1, 'rgba(255,60,10,0)');
          g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 170, 0, TAU); g.fill();
          g.restore();
          if (p < 0.85 && Math.random() < 0.8) {
            const a = Math.random() * TAU, d = 120 + Math.random() * 45;
            FX.burst(x1 + Math.cos(a) * d, y1 + Math.sin(a) * d * 0.5, 1, fire, { speed: 10, up: 70, life: 700, size: 3.5, drag: 1 });
          }
        });
        setTimeout(() => {
          shockwave(x1, y1, 240, '#ff8a3a', 620, 12);
          FX.burst(x1, y1 - 10, 40, fire, { speed: 380, up: 120, life: 700, size: 3.5, spark: true });
          FX.flash('#ff8a3a', 260, 0.18);
          shakeMine(id, 10);
        }, 320);
      }
    }, 460);
  };

  // ---------------------------------------------------------------- Lv.50 เงาพันร่าง (Lv.120 พันร่างพิฆาตเทพ)
  FX.clones = function (id, x, y, n, f, r) {
    const c = palOf(id, f), P = powerOf(id), S = P.scale, glow = glowOf(id, f, c);
    const caster = entOf(id);
    const hits = r ? 12 : 8, finale = 250 + hits * 130 + 200, end = finale + (r ? 450 : 0) + 150;
    // summoning seal under the target point
    add(end, 'ground', (g, p) => {
      const al = p < 0.08 ? p / 0.08 : p > 0.9 ? (1 - p) / 0.1 : 1;
      g.save(); g.translate(x, y); g.scale(1, 0.5); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * 0.85;
      g.strokeStyle = glow; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 125, 0, TAU); g.stroke();
      g.rotate(p * 5); g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i * 2 * TAU) / n + 0.3; i ? g.lineTo(Math.cos(a) * 110, Math.sin(a) * 110) : g.moveTo(Math.cos(0.3) * 110, Math.sin(0.3) * 110); }
      g.stroke();
      g.fillStyle = c[2]; g.globalAlpha = al * 0.18; g.beginPath(); g.arc(0, 0, 125, 0, TAU); g.fill();
      g.restore();
    });
    const R = 96;
    const spots = Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + 0.3; return [x + Math.cos(a) * R, y + Math.sin(a) * R * 0.55]; });
    const t0 = now();
    add(end, 'top', (g) => {
      const src = entOf(id) || caster;
      if (!src || !window.drawGhost) return;
      const el = now() - t0;
      spots.forEach(([cx, cy], i) => {
        let k = 0; // how far this clone has darted toward the centre
        for (let j = i; j < hits; j += n) { const d = el - (250 + j * 130); if (d > -90 && d < 160) k = Math.max(k, d < 0 ? (d + 90) / 90 : 1 - d / 160); }
        if (r && el > finale - 200) k = Math.max(k, Math.min(1, (el - finale + 200) / 200));
        const fade = Math.min(1, el / 160, (end - el) / 160);
        if (fade <= 0) return;
        const gx = cx + (x - cx) * k * 0.78, gy = cy + (y - cy) * k * 0.78;
        drawGhost({ ...src, dir: C.dirFromVec(x - cx, y - cy) }, gx, gy, 0.6 * fade);
      });
    });
    for (const [cx, cy] of spots) setTimeout(() => FX.burst(cx, cy - 30, 10, ['#1a1024', glow, c[0]], { speed: 120, up: 30, life: 420, size: 3 }), 40);
    // each strike: a slash at the centre
    for (let j = 0; j < hits; j++) setTimeout(() => {
      const a = (j / hits) * TAU * 1.7;
      add(200, 'top', (g, p) => {
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
        drawSlashArcs(g, x, y - 26, a, j % 2 ? -1 : 1, Math.min(1, p * 3), c, S * 0.8, glow, P.tier);
        g.restore();
      });
      FX.burst(x, y - 26, 6 + (P.sparks >> 1), [...c, glow], { speed: 220, life: 300, spark: true });
      shakeMine(id, 2);
    }, 250 + j * 130);
    if (r) setTimeout(() => { // พันร่างพิฆาตเทพ: every clone strikes the centre at once
      shockwave(x, y, 170, glow, 600, 12);
      shockwave(x, y, 110, c[0], 420, 6);
      FX.burst(x, y - 26, 50 + P.sparks, ['#ffffff', glow, c[1], '#1a1024'], { speed: 420, up: 80, life: 700, size: 4, spark: true });
      boltsFrom(x, y - 26, 6, 140 * S, c, glow);
      FX.flash(glow, 260, 0.22);
      shakeMine(id, 12);
    }, finale);
  };

  // ---------------------------------------------------------------- Lv.70 มังกรดาบผงาด (Lv.130 คู่มังกรเทพสวรรค์)
  FX.dragon = function (id, a, f, r) {
    const e = entOf(id); if (!e) return;
    const c = palOf(id, f), P = powerOf(id), glow = glowOf(id, f, c), S = Math.min(P.scale, 1.3);
    const x0 = e.x + Math.cos(a) * 20, y0 = e.y - 24 + Math.sin(a) * 12, L = 640, T0 = 120, TR = 600, OUT = 450;
    const dragons = r ? [[1, '#ffc83a', '#fff3c0'], [-1, glow, c[0]]] : [[1, glow, c[0]]];
    const dur = T0 + TR + OUT, t0 = now();
    const nx = -Math.sin(a), ny = Math.cos(a);
    const bodyAt = (head, el, side, di) => {
      const pts = [], BODY = 300 * S, N = 28;
      for (let i = 0; i <= N; i++) {
        const d = head - (i / N) * BODY;
        if (d < 0) break;
        const wav = Math.sin(d * 0.022 - el * 0.012 + di * Math.PI) * 28 * S * side;
        const rise = el > TR ? (el - TR) * 0.22 * (1 - i / N) : 0;
        pts.push([x0 + Math.cos(a) * d + nx * wav, y0 + Math.sin(a) * d + ny * wav * 0.7 - rise]);
      }
      return pts;
    };
    add(dur, 'top', (g) => {
      const el = now() - t0 - T0;
      if (el < 0) return;
      const head = Math.min(1, el / TR) * L;
      const fade = el > TR ? Math.max(0, 1 - (el - TR) / OUT) : 1;
      dragons.forEach(([side, col, core], di) => {
        const pts = bodyAt(head, el, side, di);
        if (pts.length < 2) return;
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
        const seg = (i, w, colr, al) => { g.strokeStyle = colr; g.lineWidth = w; g.globalAlpha = al * fade; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke(); };
        for (let i = 0; i < pts.length - 1; i++) {
          const w = (1 - i / 28) * 13 * S + 3;
          seg(i, w * 1.9, col, 0.16); seg(i, w, col, 0.55); seg(i, w * 0.3, core, 0.9);
          if (i % 3 === 1) { // dorsal spikes
            const [px, py] = pts[i], [qx, qy] = pts[i + 1], ang = Math.atan2(qy - py, qx - px) - Math.PI / 2;
            g.fillStyle = core; g.globalAlpha = 0.8 * fade;
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * w * 0.9, py + Math.sin(ang) * w * 0.9); g.lineTo(qx, qy); g.fill();
          }
        }
        // head
        const [hx, hy] = pts[0], [bx, by] = pts[1], ha = Math.atan2(hy - by, hx - bx);
        g.translate(hx, hy); g.rotate(ha); g.scale(S, S); g.globalAlpha = fade;
        g.globalAlpha = 0.85 * fade;
        g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 24, 13, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(10, -8); g.lineTo(38, -3); g.lineTo(34, 2); g.lineTo(10, 2); g.fill();          // upper jaw
        g.beginPath(); g.moveTo(8, 4); g.lineTo(32, 10 + Math.sin(el * 0.03) * 4); g.lineTo(8, 10); g.fill(); // lower jaw
        g.strokeStyle = core; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-8, -10); g.quadraticCurveTo(-24, -26, -40, -24); g.moveTo(0, -11); g.quadraticCurveTo(-12, -30, -26, -34); g.stroke(); // horns
        g.lineWidth = 1.5; g.globalAlpha = 0.7 * fade;
        g.beginPath(); g.moveTo(26, 0); g.quadraticCurveTo(10, 22, -20, 26 + Math.sin(el * 0.02) * 6); g.stroke();                       // whisker
        g.globalAlpha = fade; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(8, -5, 3.2, 0, TAU); g.fill();
        g.restore();
      });
    });
    // sparks shed from the head(s) as they fly
    for (let k = 1; k <= 10; k++) setTimeout(() => {
      const d = (L * k) / 10, x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d;
      FX.burst(x, y, 6 + (P.sparks >> 1), r ? ['#fff3c0', '#ffc83a', glow] : [c[0], c[1], glow], { speed: 160, up: 40, life: 520, size: 3, spark: true });
      if (P.bolts && k % 2 === 0) boltsFrom(x, y, 1, 60 * S, c, glow);
      shakeMine(id, 2);
    }, T0 + k * 60);
    shakeMine(id, 4);
    if (r) setTimeout(() => { // คู่มังกรเทพสวรรค์: the dragons burst at the end of the flight
      const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L + 24;
      shockwave(ex, ey, 200, '#ffc83a', 650, 12);
      shockwave(ex, ey, 140, glow, 480, 8);
      FX.burst(ex, ey - 24, 60 + P.sparks, ['#ffffff', '#fff3c0', '#ffc83a', '#ff6a1a', glow], { speed: 440, up: 140, life: 800, size: 4, spark: true });
      boltsFrom(ex, ey - 24, 6, 160 * S, c, glow);
      FX.flash('#ffd870', 380, 0.18);
      shakeMine(id, 14);
    }, T0 + TR + 150);
  };

  // jagged lightning arc (weapon aura)
  FX.bolt = function (x0, y0, x1, y1, core, glow) {
    const pts = [[x0, y0]];
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * 14, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 14]);
    }
    pts.push([x1, y1]);
    add(120, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p; g.lineJoin = 'round';
      for (const [col, w] of [[glow, 4], [core, 1.5]]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      g.restore();
    });
  };
  // equipping a weapon: burst + rising ring, grander for high-tier weapons (armour changes the outfit itself, no flash)
  // enhancement attempt at the blacksmith: hammer sparks, then success burst / failure smoke
  FX.enhance = function (id, f, ok, plus, broke) {
    const e = G.ents.get(id); if (!e) return;
    const col = (window.WeaponLook && WeaponLook.plusColor(plus)) || '#ffffff';
    for (let i = 0; i < 3; i++) setTimeout(() => {
      const q = G.ents.get(id); if (!q) return;
      FX.burst(q.x + 18, q.y - 40, 10, ['#ffe08a', '#ffffff', '#ff9a3a'], { speed: 220, up: 60, life: 350, size: 2.2, spark: true });
    }, i * 160);
    setTimeout(() => {
      const q = G.ents.get(id); if (!q) return;
      if (ok) {
        FX.burst(q.x, q.y - 40, 30 + plus * 4, [col, '#ffffff', '#ffe08a'], { speed: 200 + plus * 15, up: 60, life: 800, size: 3, spark: true });
        add(700, 'top', (g, p, fx) => {
          posOf(fx);
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
          const w = 30 + plus * 4;
          const grd = g.createLinearGradient(0, fx.y - 260, 0, fx.y); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, col);
          g.fillStyle = grd; g.fillRect(fx.x - w * (1 - p) / 2, fx.y - 260, w * (1 - p), 260);
          g.restore();
        }, { id, x: 0, y: 0 });
        if (plus >= 5) for (let k = 0; k < Math.min(6, plus - 3); k++) setTimeout(() => {
          const z = G.ents.get(id); if (!z) return;
          const a = Math.random() * TAU;
          FX.bolt(z.x + Math.cos(a) * 50, z.y - 150, z.x + Math.cos(a) * 20, z.y - 30, '#ffffff', col);
        }, k * 70);
        FX.text(q.x, q.y - 120, `+${plus} สำเร็จ!`, col === '#ffffff' ? '#ffe36a' : col, 26, { max: 1600, vy: -40 });
        if (plus >= 7 && id === G.myId) FX.shake = Math.max(FX.shake, 4 + plus);
      } else if (broke) {
        // the item shatters: dark shards flying out + red flash
        FX.burst(q.x, q.y - 40, 34, ['#ff4a3a', '#7a7a7a', '#2a2a2a', '#ffb08a'], { speed: 260, up: 40, life: 900, size: 3.2, spark: true });
        FX.burst(q.x, q.y - 40, 16, ['#333333', '#555555'], { speed: 50, up: 80, life: 1200, size: 5, drag: 1 });
        FX.text(q.x, q.y - 120, 'ไอเทมแตกสลาย!', '#ff6a5a', 24, { max: 1800, vy: -30 });
        if (id === G.myId) FX.shake = Math.max(FX.shake, 6);
      } else {
        FX.burst(q.x, q.y - 40, 18, ['#555555', '#888888', '#333333'], { speed: 60, up: 70, life: 900, size: 4, drag: 1 });
        FX.text(q.x, q.y - 120, `ล้มเหลว (+${plus})`, '#a0a0a0', 22, { max: 1400, vy: -30 });
      }
    }, 520);
  };

  FX.equip = function (id, f, slot) {
    const e = G.ents.get(id); if (!e) return;
    if (slot && slot !== 'weapon') return;
    const c = palOf(id, f), P = powerOf(id), glow = glowOf(id, f, c);
    FX.burst(e.x, e.y - 30, 26 + P.sparks * 2, [...c, glow], { speed: 150 + P.tier * 10, life: 600, spark: true });
    add(600 + P.tier * 40, 'top', (g, p, fx) => {
      posOf(fx);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
      g.strokeStyle = c[1]; g.lineWidth = 3;
      g.beginPath(); g.ellipse(fx.x, fx.y - p * 70, 30 + p * 10, 10 + p * 3, 0, 0, TAU); g.stroke();
      if (P.tier >= 7) {                          // pillar of light
        const w = 50 * (1 - p);
        const grd = g.createLinearGradient(0, fx.y - 320, 0, fx.y);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, glow);
        g.globalAlpha = (1 - p) * 0.7; g.fillStyle = grd; g.fillRect(fx.x - w / 2, fx.y - 320, w, 320);
      }
      g.restore();
    }, { id, x: 0, y: 0 });
    if (P.tier >= 7) shockwave(e.x, e.y, 90 + P.tier * 6, glow, 600, 6);
    if (P.dragon) {
      // a spiral of light climbing into the sky
      for (let i = 0; i < 40; i++) setTimeout(() => {
        const q = G.ents.get(id); if (!q) return;
        const a = i * 0.5;
        FX.parts.push({ x: q.x + Math.cos(a) * 34, y: q.y - i * 4, vx: 0, vy: -60, life: 0, max: 700, size: 3.4, color: i % 2 ? glow : c[0], grav: 0, drag: 0.5, spark: false });
      }, i * 18);
      boltsFrom(e.x, e.y - 40, 4, 90, c, glow);
      shakeMine(id, 8);
    }
  };
  // ground marker where the player clicked
  FX.clickMark = function (x, y, col) {
    add(450, 'ground', (g, p) => {
      g.save(); g.translate(x, y); g.scale(1, 0.45);
      g.globalAlpha = 1 - p; g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 20 * (1 - p * 0.6), 0, TAU); g.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4, r = 30 - p * 14;
        g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8)); g.stroke();
      }
      g.restore();
    });
  };
  FX.claw = function (x, y) {
    add(260, 'top', (g, p) => {
      g.save(); g.globalAlpha = 1 - p; g.strokeStyle = '#ff5a4a'; g.lineWidth = 3 * (1 - p) + 1; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x - 14 + i * 8, y - 22); g.lineTo(x + 10 + i * 8, y + 4); g.stroke(); }
      g.restore();
    });
  };
  FX.levelUp = function (id, f) {
    const c = pal(f);
    add(1500, 'top', (g, p, fx) => {
      posOf(fx);
      const alpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * 0.8;
      const grd = g.createLinearGradient(0, fx.y - 220, 0, fx.y);
      grd.addColorStop(0, 'rgba(255,230,120,0)'); grd.addColorStop(1, 'rgba(255,220,110,0.9)');
      g.fillStyle = grd; g.fillRect(fx.x - 34, fx.y - 220, 68, 220);
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 3; g.beginPath(); g.ellipse(fx.x, fx.y, 46 + p * 30, (46 + p * 30) * 0.4, 0, 0, TAU); g.stroke();
      g.restore();
    }, { id, x: 0, y: 0 });
    const e = G.ents.get(id);
    if (e) {
      FX.burst(e.x, e.y - 10, 40, ['#fff6c0', '#ffd860', c[1]], { speed: 120, up: 160, life: 1100, size: 3, drag: 1 });
      FX.text(e.x, e.y - 120, 'LEVEL UP!', '#ffe36a', 30, { max: 1600, vy: -40 });
    }
  };
  FX.heal = function (id, kind) {
    const e = G.ents.get(id); if (!e) return;
    const col = kind === 'mp' ? ['#9fd8ff', '#4aa8ff', '#ffffff'] : ['#a8ffb0', '#3ee070', '#ffffff'];
    FX.burst(e.x, e.y - 30, 22, col, { speed: 60, up: 90, life: 900, size: 3, drag: 1 });
  };
  // นักรบแนวหน้า โล่รับแทน: a gold thread from the covered ally to the warrior and a shield flash on the warrior
  // (at most one per warrior every 350 ms, so a crowd of blows doesn't pile them up)
  const coverAt = new Map();
  FX.cover = function (id, to) {
    const now = performance.now();
    if (now - (coverAt.get(id) || 0) < 350) return;
    coverAt.set(id, now);
    add(420, 'top', (g, p) => {
      const w = G.ents.get(id), a = G.ents.get(to);
      if (!w) return;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
      if (a) {
        g.strokeStyle = '#ffd76a'; g.lineWidth = 3 * (1 - p) + 1;
        g.beginPath(); g.moveTo(a.x, a.y - 34); g.quadraticCurveTo((a.x + w.x) / 2, Math.min(a.y, w.y) - 80, w.x, w.y - 40); g.stroke();
      }
      const r = 14 + p * 10;
      g.fillStyle = 'rgba(255,215,106,0.35)'; g.strokeStyle = '#fff2c0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(w.x - r, w.y - 58); g.lineTo(w.x + r, w.y - 58); g.lineTo(w.x + r, w.y - 58 + r * 0.9);
      g.quadraticCurveTo(w.x + r * 0.6, w.y - 58 + r * 1.6, w.x, w.y - 58 + r * 1.9); g.quadraticCurveTo(w.x - r * 0.6, w.y - 58 + r * 1.6, w.x - r, w.y - 58 + r * 0.9);
      g.closePath(); g.fill(); g.stroke(); g.restore();
    }, { id, x: 0, y: 0 });
  };
  FX.spawn = function (id, f) {
    const c = pal(f);
    add(900, 'top', (g, p, fx) => {
      posOf(fx);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - p;
      g.fillStyle = c[1]; g.fillRect(fx.x - 26 * (1 - p), fx.y - 260, 52 * (1 - p), 260); g.restore();
    }, { id, x: 0, y: 0 });
  };
  FX.monsterSkill=function(d){
    if(d.t==='monsterWindup'&&FX.list.some(f=>f.monsterToken===d.token))return;
    if(d.t!=='monsterWindup')FX.list=FX.list.filter(f=>f.monsterToken!==d.token);
    if(d.t==='monsterCancel')return;
    const warning=d.t==='monsterWindup',radius=d.radius||d.range,col=d.color||'#e58265';
    const shape=(g,k=1)=>{g.beginPath();if(d.shape==='circle')g.arc(d.x,d.y,radius*k,0,TAU);else{g.moveTo(d.x,d.y);g.arc(d.x,d.y,radius*k,d.a-d.angle/2,d.a+d.angle/2);g.closePath();}};
    add(warning?d.d:650,'ground',(g,p)=>{
      g.save();shape(g);g.fillStyle=warning?'rgba(125,25,18,.16)':col+'33';g.fill();
      g.strokeStyle=warning?'#ffb460':col;g.lineWidth=warning?2:3;g.globalAlpha=warning?.85:1-p;g.stroke();
      if(warning){shape(g,Math.min(1,((d.cast||d.d)-d.d+p*d.d)/(d.cast||d.d)));g.fillStyle=col+'35';g.fill();g.setLineDash([7,5]);shape(g);g.stroke();g.setLineDash([]);
        g.font='bold 12px sans-serif';g.textAlign='center';g.lineWidth=3;g.strokeStyle='#241b1c';g.fillStyle='#ffe1ae';g.strokeText(d.name,d.x,d.y-radius-10);g.fillText(d.name,d.x,d.y-radius-10);
      }else{shape(g,.2+p*.8);g.strokeStyle=col;g.stroke();}
      g.restore();
    },{monsterToken:warning?d.token:null,monsterEffect:true});
    if(!warning)add(650,'top',(g,p)=>{
      g.save();g.globalAlpha=(1-p)*.85;g.strokeStyle=col;g.fillStyle=col;g.lineWidth=2;
      const n=d.art==='golem'?12:16;
      for(let i=0;i<n;i++){
        const a=d.shape==='circle'?i*TAU/n:d.a-d.angle/2+(i+.5)/n*d.angle,r=radius*(.25+.65*((i*7%17)/17));
        const x=d.x+Math.cos(a)*r,y=d.y+Math.sin(a)*r,h=Math.sin(p*Math.PI)*(18+(i%3)*13);
        if(d.art==='wolf'||d.art==='boar'||d.art==='human'){
          g.save();g.translate(x,y);g.rotate(d.a+.6);g.lineWidth=d.art==='human'?2.5:1.5;
          for(let k=0;k<(d.art==='human'?1:3);k++){g.beginPath();g.moveTo(-h*.4,k*5);g.quadraticCurveTo(0,k*5-7,h*.5,k*5);g.stroke();}g.restore();
        }else if(d.art==='bird'){
          g.save();g.translate(x,y-(1-p)*48);g.rotate(.5+i*.37);
          g.beginPath();g.moveTo(0,-12);g.quadraticCurveTo(9,-1,0,13);g.quadraticCurveTo(-4,3,0,-12);g.fill();
          g.strokeStyle='#efdfc3';g.lineWidth=.8;g.beginPath();g.moveTo(0,-9);g.lineTo(0,16);g.stroke();g.strokeStyle=col;g.restore();
        }else if(d.art==='serpent'||d.art==='wisp'||d.art==='insect'){
          g.globalAlpha=(1-p)*.45;g.beginPath();g.ellipse(x,y-h*.45,5+p*10,8+p*12,0,0,TAU);g.fill();
          g.globalAlpha=1-p;g.beginPath();g.arc(x,y-h,2,0,TAU);g.fill();
        }else if(d.art==='dragon'||d.art==='demon'){
          g.beginPath();g.moveTo(x-7,y);g.quadraticCurveTo(x-11,y-h*.4,x+2,y-h);g.quadraticCurveTo(x,y-h*.4,x+7,y);g.closePath();g.fill();
          g.fillStyle='#ffe2a0';g.beginPath();g.moveTo(x-2,y);g.lineTo(x+1,y-h*.52);g.lineTo(x+3,y);g.fill();g.fillStyle=col;
        }else{
          g.beginPath();g.moveTo(x-6,y);g.lineTo(x-3,y-h*.8);g.lineTo(x+3,y-h);g.lineTo(x+8,y-3);g.closePath();g.fill();
          g.strokeStyle='#493e37';g.lineWidth=1;g.stroke();g.strokeStyle=col;
        }
      }g.restore();
    },{monsterEffect:true});
  };
  FX.tele = function (x, y, r, dur) {
    add(dur, 'ground', (g, p) => {
      g.save(); g.translate(x, y); g.scale(1, 0.55);
      g.fillStyle = 'rgba(255,30,20,0.18)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,40,20,0.35)'; g.beginPath(); g.arc(0, 0, r * p, 0, TAU); g.fill();
      g.strokeStyle = `rgba(255,60,40,${0.6 + Math.sin(p * 30) * 0.3})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      g.restore();
    });
  };
  FX.slam = function (x, y, r) {
    FX.shake = Math.max(FX.shake, 14);
    add(600, 'ground', (g, p) => {
      g.save(); g.translate(x, y); g.scale(1, 0.55); g.globalAlpha = 1 - p;
      g.strokeStyle = '#ff6a3a'; g.lineWidth = 12 * (1 - p); g.beginPath(); g.arc(0, 0, r * ease(p), 0, TAU); g.stroke(); g.restore();
    });
    FX.burst(x, y, 50, ['#7b5a3a', '#ff6a3a', '#3a2a1a'], { speed: 360, life: 700, size: 4, grav: 600 });
  };
  FX.death = function (x, y, color) {
    FX.burst(x, y - 30, 24, [color || '#ffffff', '#cccccc', '#888888'], { speed: 90, up: 70, life: 900, size: 3, drag: 1 });
  };

  // ---------------------------------------------------------------- นักพรต (Taoist) spells
  // timings follow server/world.js castSkill (talisman flight, thunder waves, bagua ticks ...)
  // spell colours follow the caster's weapon like the twin blades' slashes (plain weapons: the faction colours)
  const TAO_RUNE = (f, id) => palOf(id, f);
  const paperCol = (f) => (f === 'adharma' ? ['#5a2a6a', '#ff4a5a'] : ['#f5d76a', '#c3262c']);
  // one paper talisman (w x h, centred), its rune and a glow
  function drawPaper(g, x, y, rot, s, f, glow) {
    const [pc, ink] = paperCol(f);
    s *= 0.6; // talismans read too big at full size
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    if (glow) { g.shadowColor = glow; g.shadowBlur = 14; }
    g.fillStyle = pc; g.fillRect(-7, -15, 14, 30); g.shadowBlur = 0;
    g.strokeStyle = ink; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(0, 11); g.moveTo(-4, -6); g.lineTo(4, -4); g.moveTo(-4, 2); g.lineTo(4, 4); g.stroke();
    g.restore();
  }
  // ground ellipse ring
  const groundRing = (g, x, y, r, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, TAU); g.stroke(); };

  // 1 ยันต์อัคนี: talismans fly to their targets and burst into flame
  FX.talisman = function (id, a, tx, ty, ids, f, r) {
    const e = entOf(id); if (!e) return;
    const c = TAO_RUNE(f, id), fire = f === 'adharma' ? ['#ffd0d8', '#ff3b5a', '#7a0010'] : ['#fff2c0', '#ff9a3a', '#c3262c'];
    const x0 = e.x + Math.cos(a) * 18, y0 = e.y - 40;
    plusBolts(e, x0, y0, a);
    const list = ids && ids.length ? ids : [null];
    list.forEach((tid, i) => {
      const t0 = entOf(tid);
      const gx = t0 ? t0.x : tx, gy = t0 ? t0.y - 30 : ty;
      const dur = 90 + Math.min(320, Math.hypot(gx - e.x, gy - e.y) * 0.55) + i * 40;
      const bend = (i === 1 ? -1 : i === 2 ? 1 : 0) * 60;
      add(dur, 'top', (g, p, fx) => {
        const t = entOf(tid), ex = t ? t.x : gx, ey = t ? t.y - 30 : gy;
        const q = ease(p), mx = (x0 + ex) / 2 - Math.sin(a) * bend, my = (y0 + ey) / 2 + Math.cos(a) * bend - 30;
        const x = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * ex, y = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * ey;
        if (Math.random() < 0.7) FX.parts.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0, max: 320, size: 3.2, color: fire[(Math.random() * 3) | 0], grav: 0, drag: 2, spark: false });
        g.save(); g.globalCompositeOperation = 'source-over';
        drawPaper(g, x, y, p * 14 + i, 1.05, f, fire[1]);
        g.restore();
        fx.ex = ex; fx.ey = ey;
      }, { id });
      setTimeout(() => {
        const t = entOf(tid), ex = t ? t.x : gx, ey = t ? t.y - 30 : gy;
        FX.burst(ex, ey, r ? 16 : 12, fire, { speed: 150, up: 40, life: 450, size: 3.5 });
        shockwave(ex, ey + 24, 40, fire[1], 320, 4);
      }, dur);
    });
  };

  // 2 อสนีเรียกฟ้า: bolt(s) out of the sky at 260 ms (rank: three waves of three)
  FX.thunder = function (x, y, f, r, id) {
    const c = TAO_RUNE(f, id);
    add(260, 'ground', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p * 0.8;
      groundRing(g, x, y, (r ? 170 : 115) * (0.6 + p * 0.4), c[1], 3); g.restore();
    });
    const strike = (bx, by, big) => {
      FX.bolt(bx + (Math.random() - 0.5) * 30, by - 420, bx, by - 10, c[0], c[1]);
      FX.bolt(bx + (Math.random() - 0.5) * 40, by - 380, bx, by - 10, c[0], c[2]);
      FX.burst(bx, by - 10, big ? 26 : 14, [c[0], c[1], '#ffffff'], { speed: 220, up: 60, life: 420, size: 3, spark: true });
      shockwave(bx, by, big ? 120 : 70, c[1], 420, 6);
    };
    const waves = r ? 3 : 1;
    for (let w = 0; w < waves; w++)
      setTimeout(() => {
        if (!r) strike(x, y, true);
        else for (let k = 0; k < 3; k++) { const a = Math.random() * TAU, d = 30 + Math.random() * 120; strike(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, k === 0); }
        FX.flash(c[1], 160, 0.12);
      }, 260 + w * 260);
  };

  // 3 คาถาฟื้นชีวา: a lotus of light under the caster, green motes rising from everyone healed
  FX.taoHeal = function (id, ids, f, r) {
    const green = ['#e8fff0', '#a8ffb0', '#3ee070'];
    add(r ? 5600 : 1100, 'ground', (g, p, fx) => {
      posOf(fx);
      const life = r ? p * 5.6 : p * 1.1, k = Math.min(1, life * 2.2), fade = r ? (p > 0.9 ? (1 - p) / 0.1 : 1) : 1 - p;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(fx.x, fx.y); g.scale(1, 0.45);
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + life * 0.6;
        g.save(); g.rotate(an); g.globalAlpha = 0.5 * fade;
        g.fillStyle = green[i % 2 ? 1 : 0]; g.beginPath(); g.ellipse(0, -46 * k, 14 * k, 40 * k, 0, 0, TAU); g.fill(); g.restore();
      }
      g.globalAlpha = 0.7 * fade; g.strokeStyle = green[2]; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 96 * k, 0, TAU); g.stroke();
      g.restore();
    }, { id, x: 0, y: 0 });
    for (const q of ids || []) {
      const t = entOf(q); if (!t) continue;
      FX.burst(t.x, t.y - 30, 26, green, { speed: 60, up: 110, life: 1000, size: 3, drag: 1 });
    }
  };

  // 4 ยันต์คุ้มกาย: a hexagon shell (turtle shell at rank 1) around each warded player for its duration
  FX.ward = function (ids, dur, f, r, id) {
    const gold = r ? ['#fff6d0', '#ffd76a', '#b08a2a'] : TAO_RUNE(f, id);
    for (const id of ids || []) {
      add(dur, 'top', (g, p, fx) => {
        const e = posOf(fx);
        if (!entOf(fx.id) || e.dead) return;
        const fade = p < 0.06 ? p / 0.06 : p > 0.92 ? (1 - p) / 0.08 : 1, t = performance.now() / 1000;
        const R = 34 * (r ? 1.15 : 1), cx = fx.x, cy = fx.y - 30;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * fade;
        g.strokeStyle = gold[1]; g.lineWidth = 2; g.fillStyle = 'rgba(255,255,255,0.04)';
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.5; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 1.15); }
        g.closePath(); g.fill(); g.stroke();
        if (r) { // turtle-shell plates
          g.globalAlpha = 0.35 * fade;
          for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t * 0.5; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.5); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 1.15); g.stroke(); }
        }
        // three small talismans orbiting
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = fade;
        for (let i = 0; i < 3; i++) { const a = t * 1.6 + (i / 3) * TAU; drawPaper(g, cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 0.5, Math.sin(a) * 0.3, 0.55, f, gold[1]); }
        g.restore();
      }, { id, x: 0, y: 0 });
      const e = entOf(id); if (e) FX.burst(e.x, e.y - 30, 20, gold, { speed: 120, up: 30, life: 500, size: 2.6 });
    }
  };

  // 5 ค่ายกลแปดทิศ: a turning bagua array with the eight trigrams; a light pillar rises on every tick
  FX.bagua = function (x, y, R, n, f, r, id) {
    const c = TAO_RUNE(f, id), total = 350 + n * 420 + (r ? 400 : 0);
    add(total, 'ground', (g, p) => {
      const el = p * total, draw = Math.min(1, el / 350), fade = p > 0.93 ? (1 - p) / 0.07 : 1, rot = el / 1000 * 0.6;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(1, 0.45); g.globalAlpha = 0.85 * fade;
      g.strokeStyle = c[1]; g.lineWidth = 4;
      g.beginPath(); for (let i = 0; i <= 8 * draw; i++) { const a = (i / 8) * TAU + rot; g.lineTo(Math.cos(a) * R, Math.sin(a) * R); } g.stroke();
      g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * 0.72, rot, rot + TAU * draw); g.stroke();
      // trigrams
      g.strokeStyle = c[0]; g.lineWidth = 3;
      for (let i = 0; i < 8 * draw; i++) {
        g.save(); g.rotate((i / 8) * TAU + rot + TAU / 16); g.translate(0, -R * 0.86);
        for (let k = 0; k < 3; k++) {
          const yy = k * 7 - 7; g.beginPath();
          if ((i >> k) & 1) { g.moveTo(-12, yy); g.lineTo(12, yy); } else { g.moveTo(-12, yy); g.lineTo(-3, yy); g.moveTo(3, yy); g.lineTo(12, yy); }
          g.stroke();
        }
        g.restore();
      }
      // yin-yang centre (rank 2: the whole field turns into one)
      const yr = r > 1 ? R * 0.6 : R * 0.22;
      g.rotate(-rot * 3); g.globalAlpha = (r > 1 ? 0.2 : 0.45) * fade * draw;
      g.fillStyle = c[0]; g.beginPath(); g.arc(0, 0, yr, -Math.PI / 2, Math.PI / 2); g.arc(0, yr / 2, yr / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -yr / 2, yr / 2, Math.PI / 2, -Math.PI / 2); g.fill();
      g.strokeStyle = c[1]; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, yr, 0, TAU); g.stroke();
      g.restore();
    });
    for (let i = 0; i < n; i++)
      setTimeout(() => {
        const a = (i / n) * TAU * 3;
        const px = x + Math.cos(a) * R * 0.86, py = y + Math.sin(a) * R * 0.86 * 0.45;
        add(380, 'top', (g, p) => {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.7;
          const gr = g.createLinearGradient(0, py - 180, 0, py); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, c[1]);
          g.fillStyle = gr; g.fillRect(px - 9 * (1 - p * 0.5), py - 180, 18 * (1 - p * 0.5), 180); g.restore();
        });
        shockwave(x, y, R * 0.8, c[1], 360, 3);
      }, 350 + i * 420);
    if (r) setTimeout(() => {
      shockwave(x, y, R * 1.2, c[0], 600, 10);
      FX.burst(x, y - 20, 60, [c[0], c[1], '#ffffff'], { speed: 320, up: 80, life: 700, size: 4, spark: true });
      FX.flash(c[1], 260, 0.2);
      FX.shake = Math.max(FX.shake, 10);
    }, 350 + n * 420 + 200);
  };

  // 6 กระบี่บินเหิน: spirit sword(s) flying out and piercing (rank: five in a fan)
  FX.flysword = function (id, a, f, r) {
    const e = entOf(id); if (!e) return;
    const c = TAO_RUNE(f, id), L = r ? 600 : 500, x0 = e.x, y0 = e.y - 24;
    for (const da of r ? [-0.36, -0.18, 0, 0.18, 0.36] : [0]) {
      const b = a + da;
      add(470, 'top', (g, p) => {
        const d = L * Math.min(1, p / 0.94), x = x0 + Math.cos(b) * d, y = y0 + Math.sin(b) * d;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        const tl = Math.min(d, 150), tx = x - Math.cos(b) * tl, ty = y - Math.sin(b) * tl;
        const gr = g.createLinearGradient(tx, ty, x, y); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, c[1]);
        g.strokeStyle = gr; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
        g.translate(x, y); g.rotate(b);
        g.fillStyle = c[0]; g.shadowColor = c[1]; g.shadowBlur = 16;
        g.beginPath(); g.moveTo(26, 0); g.lineTo(-10, -4); g.lineTo(-10, 4); g.closePath(); g.fill();
        g.fillStyle = c[1]; g.fillRect(-14, -7, 4, 14); g.fillRect(-24, -2, 10, 4);
        g.restore();
      });
    }
    shakeMine(id, 3);
  };

  // 7 โซ่ยันต์ตรึงวิญญาณ: a seal circle, talisman chains shooting up and binding what is inside
  FX.seal = function (x, y, dur, f, r, id) {
    const c = TAO_RUNE(f, id), total = 300 + dur;
    add(total, 'ground', (g, p) => {
      const el = p * total, k = Math.min(1, el / 300), fade = p > 0.9 ? (1 - p) / 0.1 : 1;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8 * fade;
      groundRing(g, x, y, 140 * k, c[1], 4); groundRing(g, x, y, 110 * k, c[0], 1.5);
      g.translate(x, y); g.scale(1, 0.45); g.rotate(el / 900);
      g.strokeStyle = c[1]; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU * 2; g.beginPath(); g.moveTo(Math.cos(a) * 130 * k, Math.sin(a) * 130 * k); g.lineTo(Math.cos(a + TAU * 0.4) * 130 * k, Math.sin(a + TAU * 0.4) * 130 * k); g.stroke(); }
      g.restore();
    });
    add(dur, 'top', (g, p) => {
      const fade = p > 0.88 ? (1 - p) / 0.12 : 1, rise = Math.min(1, (p * dur) / 260);
      g.save(); g.globalAlpha = fade;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU, bx = x + Math.cos(a) * 120, by = y + Math.sin(a) * 52;
        for (let s = 0; s < 6; s++) {
          const q = (s / 6) * rise, cx = bx + (x - bx) * q, cy = by + (y - 30 - by) * q - Math.sin(q * Math.PI) * 50;
          drawPaper(g, cx, cy, a + s * 0.5, 0.5, f, c[1]);
        }
      }
      g.restore();
    }, { t0: performance.now() + 300 });
    if (r) setTimeout(() => {
      const five = ['#7cff8a', '#ff6a3a', '#ffd76a', '#ffffff', '#5ab8ff'];
      FX.burst(x, y - 30, 60, five, { speed: 300, up: 80, life: 700, size: 4, spark: true });
      shockwave(x, y, 170, '#ffffff', 600, 10);
    }, total);
  };

  // 8 อัญเชิญเทพพิทักษ์: ghostly guardian general(s) rise from a light pillar and strike down
  FX.guardian = function (x, y, n, f, r) {
    const gold = ['#fff6d0', '#ffd76a', '#b08a2a'], strikes = r ? 6 : 3, gap = r ? 260 : 400;
    const total = 550 + strikes * gap + (r ? 450 : 150);
    const spots = n > 1 ? [0, 1, 2, 3].map((i) => [x + Math.cos(i * TAU / 4 + 0.8) * 120, y + Math.sin(i * TAU / 4 + 0.8) * 55]) : [[x, y + 40]];
    add(total, 'top', (g, p) => {
      const el = p * total, rise = Math.min(1, el / 550), fade = p > 0.9 ? (1 - p) / 0.1 : 1;
      spots.forEach(([gx, gy], i) => {
        const hit = el > 550 ? ((el - 550) % gap) / gap : 1, swing = el > 550 && el < 550 + strikes * gap ? Math.sin(Math.min(1, hit * 1.4) * Math.PI) : 0;
        const H = 150, by = gy - 10 - rise * 30;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (n > 1 ? 0.32 : 0.45) * fade * rise;
        g.translate(gx, by); g.scale(0.9 + rise * 0.1, 0.9 + rise * 0.1);
        const gr = g.createLinearGradient(0, -H, 0, 0); gr.addColorStop(0, gold[1]); gr.addColorStop(1, 'rgba(255,215,106,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, -H + 14, 14, 0, TAU); g.fill();                                     // head
        g.beginPath(); g.moveTo(-30, 0); g.lineTo(-22, -H + 34); g.lineTo(22, -H + 34); g.lineTo(30, 0); g.closePath(); g.fill();   // armoured body
        g.fillStyle = gold[1]; g.beginPath(); g.ellipse(-26, -H + 40, 14, 8, -0.4, 0, TAU); g.ellipse(26, -H + 40, 14, 8, 0.4, 0, TAU); g.fill();   // pauldrons
        // halberd sweeping down on every strike
        g.save(); g.translate(28, -H + 46); g.rotate(-1.1 + swing * 2.0 + (i % 2) * 0.1);
        g.strokeStyle = gold[0]; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -110); g.stroke();
        g.fillStyle = gold[0]; g.beginPath(); g.moveTo(0, -126); g.lineTo(14, -100); g.lineTo(0, -92); g.closePath(); g.fill();
        g.restore();
        g.restore();
      });
    });
    // light pillar
    add(600, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.45;
      g.fillStyle = gold[1]; for (const [gx, gy] of spots) g.fillRect(gx - 22 * (1 - p), gy - 300, 44 * (1 - p), 300); g.restore();
    });
    for (let i = 0; i < strikes; i++)
      setTimeout(() => {
        shockwave(x, y, 150, gold[1], 420, 8);
        FX.burst(x, y - 10, 24, gold, { speed: 260, up: 40, life: 500, size: 3.5, spark: true });
        FX.shake = Math.max(FX.shake, 5);
      }, 550 + i * gap + 120);
    if (r) setTimeout(() => { shockwave(x, y, 210, gold[0], 650, 12); FX.flash(gold[1], 260, 0.2); FX.shake = Math.max(FX.shake, 12); }, 550 + strikes * gap + 250);
  };

  // 9 หยินหยางพิฆาตฟ้า: a giant spinning yin-yang orb rolls 600 px (rank: twin orbs and a blast at the end)
  FX.taiji = function (id, a, f, r) {
    const e = entOf(id); if (!e) return;
    const c = TAO_RUNE(f, id), L = 600, x0 = e.x, y0 = e.y - 20, dur = 150 + 800;
    const orb = (g, x, y, R, spin, alpha) => {
      g.save(); g.translate(x, y); g.rotate(spin); g.globalAlpha = alpha;
      g.shadowColor = c[1]; g.shadowBlur = 24;
      g.fillStyle = '#f6f6f6'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#16161e'; g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2); g.arc(0, R / 2, R / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -R / 2, R / 2, Math.PI / 2, -Math.PI / 2); g.fill();
      g.fillStyle = '#f6f6f6'; g.beginPath(); g.arc(0, R / 2, R / 7, 0, TAU); g.fill();
      g.fillStyle = '#16161e'; g.beginPath(); g.arc(0, -R / 2, R / 7, 0, TAU); g.fill();
      g.strokeStyle = c[1]; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R + 2, 0, TAU); g.stroke();
      g.restore();
    };
    add(dur, 'top', (g, p) => {
      const el = p * dur, grow = Math.min(1, el / 150), q = Math.max(0, (el - 150) / 800);
      const d = L * q, x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d, R = 46 * grow;
      // spiral trail
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = c[1]; g.lineWidth = 6; g.globalAlpha = 0.5;
      g.beginPath();
      for (let k = 0; k <= 20; k++) { const t = Math.max(0, q - k * 0.012), dd = L * t, w = Math.sin(t * 40) * 18; g.lineTo(x0 + Math.cos(a) * dd - Math.sin(a) * w, y0 + Math.sin(a) * dd + Math.cos(a) * w); }
      g.stroke(); g.restore();
      const spin = el / 90;
      if (r) { const o = Math.sin(el / 120) * 26; orb(g, x - Math.sin(a) * o, y + Math.cos(a) * o, R * 0.8, spin, 0.95); orb(g, x + Math.sin(a) * o, y - Math.cos(a) * o, R * 0.8, -spin, 0.95); }
      else orb(g, x, y, R, spin, 1);
      if (Math.random() < 0.6) FX.parts.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0, max: 420, size: 3, color: Math.random() < 0.5 ? '#ffffff' : c[1], grav: 0, drag: 2, spark: true });
    });
    shakeMine(id, 6);
    if (r) setTimeout(() => {
      const x = x0 + Math.cos(a) * L, y = y0 + Math.sin(a) * L + 20;
      shockwave(x, y, 220, '#ffffff', 600, 12); shockwave(x, y, 160, c[1], 500, 8);
      FX.burst(x, y - 20, 70, ['#ffffff', '#16161e', c[1]], { speed: 360, up: 60, life: 800, size: 4, spark: true });
      FX.flash('#ffffff', 300, 0.22); FX.shake = Math.max(FX.shake, 14);
    }, dur + 150);
  };

  // ---------------------------------------------------------------- นักธนู (archer)
  // colours of the drawn sheets: ธรรมะ leaf-green light, อธรรม magenta; [core, glow, deep]
  const ARC = (f) => (f === 'adharma' ? ['#ffe0f4', '#ff3aa8', '#5a0a3a'] : ['#f2ffd8', '#8ce05a', '#2a7a32']);
  // one arrow drawn at (x, y) pointing along a; s = size, trail = glowing streak behind it
  function drawArrow(g, x, y, a, s, c, trail = 60) {
    g.save(); g.translate(x, y); g.rotate(a);
    if (trail) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(-trail * s, 0, 0, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, c[1]);
      g.strokeStyle = gr; g.lineWidth = 6 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(-trail * s, 0); g.lineTo(0, 0); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    g.strokeStyle = '#efe2c0'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-22 * s, 0); g.lineTo(10 * s, 0); g.stroke();
    g.fillStyle = c[0]; g.shadowColor = c[1]; g.shadowBlur = 10 * s;
    g.beginPath(); g.moveTo(18 * s, 0); g.lineTo(8 * s, -4 * s); g.lineTo(8 * s, 4 * s); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = c[1];
    g.beginPath(); g.moveTo(-22 * s, 0); g.lineTo(-30 * s, -5 * s); g.lineTo(-19 * s, 0); g.lineTo(-30 * s, 5 * s); g.closePath(); g.fill();
    g.restore();
  }
  // an arrow flying from (x0, y0) to a live target (or the point tx, ty), then a hit spark
  function shootArrow(x0, y0, tid, tx, ty, c, o = {}) {
    const t0 = entOf(tid), gx = t0 ? t0.x : tx, gy = t0 ? t0.y - 30 : ty;
    const dur = (o.fly || 70) + Math.min(o.max || 260, Math.hypot(gx - x0, gy - y0) * (o.k || 0.45));
    add(dur, 'top', (g, p) => {
      const t = entOf(tid), ex = t ? t.x : gx, ey = t ? t.y - 30 : gy;
      const x = x0 + (ex - x0) * p, y = y0 + (ey - y0) * p - Math.sin(p * Math.PI) * (o.arc || 10);
      drawArrow(g, x, y, Math.atan2(ey - y0, ex - x0), o.s || 1, c, o.trail ?? 60);
    }, { t0: now() + (o.delay || 0) });
    setTimeout(() => {
      const t = entOf(tid), ex = t ? t.x : gx, ey = t ? t.y - 30 : gy;
      FX.burst(ex, ey, o.sparks || 8, c, { speed: 150, life: 320, size: 2.6, spark: true });
    }, dur + (o.delay || 0));
  }
  const bowPoint = (e, a) => [e.x + Math.cos(a) * 22, e.y - 42 + Math.sin(a) * 8];

  // 1 ยิงศร: one arrow at the target (rank: a second arrow, every 3rd shot also hits the enemy behind)
  FX.arrow = function (id, a, tx, ty, ids, n, behind, f, r) {
    const e = entOf(id); if (!e) return;
    const c = ARC(f), [x0, y0] = bowPoint(e, a), tid = ids && ids[0];
    plusBolts(e, x0, y0, a);
    shootArrow(x0, y0, tid, tx, ty, c, {});
    if (n > 1) shootArrow(x0, y0, tid, tx, ty, c, { delay: 110, s: 0.85 });
    if (behind) shootArrow(x0, y0, behind, tx, ty, c, { delay: 90, trail: 90, sparks: 12 });
  };
  // 2 ศรกระจาย: a fan of arrows (rank: two volleys)
  FX.multishot = function (id, a, n, L, v, f, r) {
    const e = entOf(id); if (!e) return;
    const c = ARC(f), [x0, y0] = bowPoint(e, a), spread = r ? 0.95 : 0.65;
    for (let w = 0; w < (v || 1); w++)
      for (let i = 0; i < n; i++) {
        const b = a + (i / (n - 1) - 0.5) * spread;
        add(320, 'top', (g, p) => {
          const d = L * p, alpha = p > 0.8 ? (1 - p) / 0.2 : 1;
          g.save(); g.globalAlpha = alpha; drawArrow(g, x0 + Math.cos(b) * d, y0 + Math.sin(b) * d, b, 0.9, c, 50); g.restore();
        }, { t0: now() + w * 260 });
      }
    FX.burst(x0, y0, 10, c, { angle: a, spread: 0.8, speed: 220, life: 300, size: 2.4 });
    shakeMine(id, 2);
  };
  // 3 กระโดดหลบเงา: a backflip trail of leaves / petals, then a knock-back arrow (rank: three arrows + a wind burst)
  FX.vault = function (id, x0, y0, x1, y1, a, f, r) {
    const c = ARC(f);
    add(380, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - p) * 0.8; g.strokeStyle = c[1]; g.lineWidth = 4; g.setLineDash([8, 6]);
      g.beginPath(); g.moveTo(x0, y0 - 30); g.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 120, x1, y1 - 30); g.stroke(); g.restore();
    });
    for (let i = 0; i < 10; i++)
      setTimeout(() => { const q = i / 10; FX.burst(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - 40 - Math.sin(q * Math.PI) * 80, 3, c, { speed: 60, life: 600, size: 3 }); }, i * 26);
    setTimeout(() => {
      const sx = x1 + Math.cos(a) * 22, sy = y1 - 42;
      for (let k = 0; k < (r ? 3 : 1); k++)
        add(300, 'top', (g, p) => { const d = 420 * p; drawArrow(g, sx + Math.cos(a) * d, sy + Math.sin(a) * d, a, 1.15, c, 90); }, { t0: now() + k * 120 });
      if (r) { shockwave(x0, y0, 120, c[1], 450, 8); FX.burst(x0, y0 - 20, 24, c, { speed: 240, life: 500, size: 3, spark: true }); }
    }, 200);
  };
  // 4 ศรทะลวง: a long glowing line and a heavy arrow through it (rank: wider, and the line blows up again)
  FX.pierce = function (id, a, L, f, r) {
    const e = entOf(id); if (!e) return;
    const c = ARC(f), [x0, y0] = bowPoint(e, a), W = r ? 34 : 22;
    // charging glow on the bow
    add(220, 'top', (g, p) => {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p; g.fillStyle = c[1]; g.shadowColor = c[1]; g.shadowBlur = 20;
      g.beginPath(); g.arc(x0, y0, 6 + p * 10, 0, TAU); g.fill(); g.restore();
    });
    add(420, 'top', (g, p) => {
      const d = L * Math.min(1, p / 0.45), x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1;
      g.strokeStyle = c[1]; g.lineWidth = W; g.lineCap = 'round'; g.globalAlpha *= 0.35;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke();
      g.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1; g.strokeStyle = c[0]; g.lineWidth = 3; g.stroke();
      g.restore();
      drawArrow(g, x, y, a, 1.6, c, 0);
    }, { t0: now() + 200 });
    setTimeout(() => shakeMine(id, 5), 220);
    if (r) setTimeout(() => {
      for (let i = 1; i <= 6; i++) { const q = i / 6; FX.burst(x0 + Math.cos(a) * L * q, y0 + Math.sin(a) * L * q + 20, 10, c, { speed: 200, up: 40, life: 450, size: 3, spark: true }); }
      shakeMine(id, 7);
    }, 560);
  };
  // 5 ฝนศรพิฆาต: a target circle and arrows raining down in waves (rank: wider, a giant arrow lands last)
  FX.rain = function (x, y, R, n, f, r, id) {
    const c = ARC(f), span = 420 + n * 220;
    const big = r ? span + 200 : 0, total = (big || span) + 500;
    add(total, 'ground', (g, p) => {
      const alpha = p < 0.1 ? p / 0.1 : p > 0.88 ? (1 - p) / 0.12 : 1;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * 0.85;
      groundRing(g, x, y, R, c[1], 4); groundRing(g, x, y, R - 16, c[0], 1.5);
      g.translate(x, y); g.scale(1, 0.45); g.rotate(p * 3); g.strokeStyle = c[1]; g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(R - 26, 0); g.lineTo(R - 8, 0); g.stroke(); }
      g.restore();
    });
    // the volley shot into the sky from the archer
    const e = entOf(id);
    if (e) for (let i = 0; i < 5; i++)
      add(300, 'top', (g, p) => drawArrow(g, e.x + (i - 2) * 6, e.y - 50 - p * 260, -Math.PI / 2, 0.9, c, 40), { t0: now() + i * 40 });
    for (let w = 0; w < n; w++)
      for (let k = 0; k < 7; k++) {
        const ang = Math.random() * TAU, rr = Math.sqrt(Math.random()) * R, gx = x + Math.cos(ang) * rr, gy = y + Math.sin(ang) * rr * 0.45;
        const t0 = now() + 300 + w * 220 + k * 18;
        add(140, 'top', (g, p) => drawArrow(g, gx - 30 * (1 - p), gy - 260 * (1 - p), Math.atan2(260, 30), 0.85, c, 40), { t0 });
        setTimeout(() => FX.burst(gx, gy, 3, c, { speed: 90, up: 30, life: 260, size: 2 }), t0 - now() + 140);
      }
    for (let w = 0; w < n; w++) setTimeout(() => shakeMine(id, 2), 420 + w * 220);
    if (r) {
      add(260, 'top', (g, p) => drawArrow(g, x, y - 420 * (1 - p) - 10, Math.PI / 2, 4.5, c, 30), { t0: now() + big - 60 });
      setTimeout(() => {
        shockwave(x, y, R * 1.1, c[0], 650, 12); shockwave(x, y, R * 0.8, c[1], 550, 8);
        FX.burst(x, y - 20, 60, [...c, '#ffffff'], { speed: 340, up: 60, life: 750, size: 4, spark: true });
        FX.flash(c[1], 260, 0.18); FX.shake = Math.max(FX.shake, r > 1 ? 14 : 10);
      }, big + 200);
    }
  };
  // 6 ศรสังหาร: a focused aiming line, then a fast piercing shot (rank: it splits to the enemies near the target)
  FX.snipe = function (id, a, tx, ty, ids, f, r) {
    const e = entOf(id); if (!e) return;
    const c = ARC(f), [x0, y0] = bowPoint(e, a), main = ids && ids[0];
    add(200, 'top', (g, p) => {
      const t = entOf(main), ex = t ? t.x : tx, ey = t ? t.y - 30 : ty;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + p * 0.5; g.strokeStyle = c[1]; g.lineWidth = 1.5; g.setLineDash([10, 6]);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, 22 - p * 10, 0, TAU); g.stroke(); g.restore();
    });
    shootArrow(x0, y0, main, tx, ty, c, { delay: 180, fly: 0, k: 0.25, max: 160, s: 1.4, trail: 140, arc: 0, sparks: 18 });
    (ids || []).slice(1).forEach((sid, i) => setTimeout(() => {
      const t = entOf(main);
      if (t) shootArrow(t.x, t.y - 30, sid, t.x, t.y, c, { fly: 60, k: 0.4, s: 0.9, arc: 20 });
    }, 300 + i * 60));
    setTimeout(() => shakeMine(id, 4), 200);
  };
  // 7 พญาอินทรีโฉบ: a spirit eagle swoops down on the point (rank: a fire eagle dives twice and leaves a burning ring)
  FX.eagle = function (id, x, y, f, r) {
    const c = r ? (f === 'adharma' ? ['#ffe0f0', '#ff3a6a', '#5a0010'] : ['#fff2c0', '#ff9a3a', '#c3262c']) : ARC(f);
    const bird = (g, bx, by, s, flap, dir) => {
      g.save(); g.translate(bx, by); g.scale(s * dir, s); g.globalCompositeOperation = 'lighter';
      g.fillStyle = c[1]; g.shadowColor = c[1]; g.shadowBlur = 20;
      const w = 0.6 + flap * 0.4;
      g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(-30, -6 * w, -64, -26 * w); g.quadraticCurveTo(-26, -14, -8, -2); g.lineTo(0, -14);
      g.lineTo(8, -2); g.quadraticCurveTo(26, -14, 64, -26 * w); g.quadraticCurveTo(30, -6 * w, 0, 14); g.fill();
      g.shadowBlur = 0; g.fillStyle = c[0]; g.beginPath(); g.ellipse(0, -6, 6, 12, 0, 0, TAU); g.fill();
      g.restore();
    };
    const dive = (delay) => add(460, 'top', (g, p) => {
      const q = ease(p), bx = x - 260 * (1 - q), by = y - 40 - 300 * (1 - q);
      bird(g, bx, by, 0.8 + q * 0.5, Math.sin(p * 20) * 0.5 + 0.5, 1);
    }, { t0: now() + delay });
    dive(0);
    setTimeout(() => { shockwave(x, y, 150, c[1], 500, 10); FX.burst(x, y - 20, 34, c, { speed: 280, up: 60, life: 600, size: 3.5, spark: true }); shakeMine(id, 6); }, 420);
    if (r) {
      dive(480);
      setTimeout(() => { shockwave(x, y, 170, c[0], 500, 10); FX.burst(x, y - 20, 34, c, { speed: 300, up: 60, life: 600, size: 3.5, spark: true }); shakeMine(id, 6); }, 900);
      add(4200, 'ground', (g, p) => {
        const fade = p < 0.06 ? p / 0.06 : p > 0.9 ? (1 - p) / 0.1 : 1;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade * (0.55 + 0.2 * Math.sin(p * 60));
        const gr = g.createRadialGradient(x, y, 10, x, y, 160); gr.addColorStop(0, c[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.translate(x, y); g.scale(1, 0.45); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 160, 0, TAU); g.fill(); g.restore();
        if (Math.random() < 0.5) FX.parts.push({ x: x + (Math.random() - 0.5) * 260, y: y + (Math.random() - 0.5) * 100, vx: 0, vy: -40 - Math.random() * 40, life: 0, max: 600, size: 3, color: c[Math.random() < 0.5 ? 0 : 1], grav: 0, drag: 1, spark: false });
      }, { t0: now() + 1000 });
    }
  };
  // 8 ตาข่ายศรตรึง: an arrow carries a net that drops over the point (rank: lightning runs through it)
  FX.net = function (id, x, y, dur, f, r) {
    const e = entOf(id), c = ARC(f), total = 320 + dur;
    if (e) add(320, 'top', (g, p) => {
      const sx = e.x, sy = e.y - 42, px = sx + (x - sx) * p, py = sy + (y - 40 - sy) * p - Math.sin(p * Math.PI) * 90;
      drawArrow(g, px, py, Math.atan2(y - sy, x - sx), 1, c, 50);
    });
    add(total, 'ground', (g, p) => {
      const el = p * total, k = Math.min(1, Math.max(0, (el - 300) / 180)), fade = p > 0.9 ? (1 - p) / 0.1 : 1;
      if (!k) return;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.85 * fade;
      g.translate(x, y); g.scale(1, 0.45);
      const R = 150 * (0.6 + 0.4 * k);
      g.strokeStyle = c[1]; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
      g.strokeStyle = c[0]; g.lineWidth = 1.6;
      for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 26 - R, -R); g.lineTo(i * 26 + R, R); g.moveTo(i * 26 + R, -R); g.lineTo(i * 26 - R, R); g.stroke(); }
      g.restore();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.fillStyle = c[0]; g.beginPath(); g.arc(Math.cos(a) * R, Math.sin(a) * R, 4, 0, TAU); g.fill(); }
      g.restore();
      if (r && Math.random() < 0.15) { const a = Math.random() * TAU, b = a + 1 + Math.random() * 2; FX.bolt(x + Math.cos(a) * 140, y + Math.sin(a) * 60, x + Math.cos(b) * 140, y + Math.sin(b) * 60, c[0], c[1]); }
    });
    setTimeout(() => { shockwave(x, y, 150, c[1], 400, 6); shakeMine(id, 4); }, 320);
  };
  // 9 ศรหงส์เพลิง: a giant fire-phoenix arrow flies 640 px (rank: twin phoenixes and a blast at the end)
  FX.phoenix = function (id, a, f, r) {
    const e = entOf(id); if (!e) return;
    const fire = f === 'adharma' ? ['#ffe0f0', '#ff3a7a', '#5a0020'] : ['#fff2b0', '#ff8a2a', '#c3262c'];
    const L = 640, [x0, y0] = bowPoint(e, a), dur = 160 + 720;
    const phoenix = (g, x, y, b, s, flap) => {
      g.save(); g.translate(x, y); g.rotate(b); g.scale(s, s); g.globalCompositeOperation = 'lighter';
      g.shadowColor = fire[1]; g.shadowBlur = 26; g.fillStyle = fire[1];
      const w = 0.7 + flap * 0.3;
      g.beginPath(); g.moveTo(40, 0); g.quadraticCurveTo(0, -46 * w, -50, -50 * w); g.quadraticCurveTo(-20, -18, -30, 0); g.quadraticCurveTo(-20, 18, -50, 50 * w); g.quadraticCurveTo(0, 46 * w, 40, 0); g.fill();
      g.shadowBlur = 0; g.fillStyle = fire[0]; g.beginPath(); g.ellipse(18, 0, 24, 9, 0, 0, TAU); g.fill();
      g.strokeStyle = fire[1]; g.lineWidth = 4; g.globalAlpha = 0.7;
      for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(-30, 0); g.quadraticCurveTo(-70, k * 20, -110, k * 34 + Math.sin(flap * 6 + k) * 6); g.stroke(); }
      g.restore();
    };
    add(dur, 'top', (g, p) => {
      const el = p * dur, q = Math.max(0, (el - 160) / 720), d = L * q;
      const x = x0 + Math.cos(a) * d, y = y0 + Math.sin(a) * d, grow = Math.min(1, el / 160), flap = Math.sin(el / 60) * 0.5 + 0.5;
      if (r) { const o = Math.sin(el / 110) * 28; phoenix(g, x - Math.sin(a) * o, y + Math.cos(a) * o, a, 0.75 * grow, flap); phoenix(g, x + Math.sin(a) * o, y - Math.cos(a) * o, a, 0.75 * grow, 1 - flap); }
      else phoenix(g, x, y, a, grow, flap);
      if (Math.random() < 0.8) FX.parts.push({ x, y, vx: -Math.cos(a) * 60 + (Math.random() - 0.5) * 60, vy: -Math.sin(a) * 60 - 20 - Math.random() * 30, life: 0, max: 480, size: 3.4, color: fire[(Math.random() * 3) | 0], grav: 0, drag: 2, spark: false });
    });
    shakeMine(id, 6);
    if (r) setTimeout(() => {
      const x = x0 + Math.cos(a) * L, y = y0 + Math.sin(a) * L + 20;
      shockwave(x, y, 230, '#ffffff', 600, 12); shockwave(x, y, 170, fire[1], 500, 8);
      FX.burst(x, y - 20, 70, fire, { speed: 360, up: 60, life: 800, size: 4, spark: true });
      FX.flash(fire[1], 300, 0.2); FX.shake = Math.max(FX.shake, 14);
    }, dur + 150);
  };

  // ---------------------------------------------------------------- update/draw
  FX.update = function (dt) {
    let alive = 0;
    for (const p of FX.parts) {
      p.life += dt * 1000;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life < p.max) FX.parts[alive++] = p;
    }
    FX.parts.length = alive;
    alive = 0;
    const textDrag = Math.exp(-1.5 * dt);
    for (const t of FX.texts) {
      t.life += dt * 1000; t.y += t.vy * dt; t.vy *= textDrag;
      if (t.life < t.max) FX.texts[alive++] = t;
    }
    FX.texts.length = alive;
    const n = now();
    // cues: one-shot callbacks timed with an effect (particles, shake, flash), run here instead of from timers or draws
    for (const f of FX.list) if (f.cue && !f.cued && n >= f.t0) { f.cued = true; f.cue(); }
    FX.list = FX.list.filter((f) => n - f.t0 < f.dur);
    FX.shake *= Math.exp(-10 * dt);
  };
  FX.draw = function (g, layer, view) {
    const n = now();
    for (const f of FX.list) {
      if (f.layer !== layer || n < f.t0) continue; // delayed effects wait for their start
      f.draw(g, Math.min(1, (n - f.t0) / f.dur), f);
    }
    if (layer !== 'top') return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of FX.parts) {
      // Cull only bounded decoration. Skill callbacks (including warning zones
      // and delayed hits) still execute, even when the caster is off screen.
      if (view) {
        const tx = p.spark ? p.x - p.vx * .04 : p.x, ty = p.spark ? p.y - p.vy * .04 : p.y, r = p.size + 2;
        if (Math.max(p.x, tx) + r < view.x || Math.min(p.x, tx) - r > view.x + view.w ||
            Math.max(p.y, ty) + r < view.y || Math.min(p.y, ty) - r > view.y + view.h) continue;
      }
      const a = 1 - p.life / p.max;
      g.globalAlpha = a; g.fillStyle = p.color;
      if (p.spark) {
        g.strokeStyle = p.color; g.lineWidth = p.size * 0.8;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); g.stroke();
      } else { g.beginPath(); g.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); g.fill(); }
    }
    g.restore();
  };
  FX.drawTexts = function (g, view) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of FX.texts) {
      // Conservative bounds include the 1.2x pop, stroke, and wide Unicode glyphs.
      if (view) {
        const rx = String(t.text).length * t.size * 2 + 8, ry = t.size * 2 + 8;
        if (t.x + rx < view.x || t.x - rx > view.x + view.w || t.y + ry < view.y || t.y - ry > view.y + view.h) continue;
      }
      const p = t.life / t.max;
      const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.6 : p < 0.2 ? 1.2 - ((p - 0.12) / 0.08) * 0.2 : 1;
      g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      g.font = `800 ${Math.round(t.size * pop)}px Kanit, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = t.stroke; g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.text, t.x, t.y);
    }
    g.restore();
  };
})();
