// Cached, class-specific light artwork. Cast ornaments never imply a hit;
// impact blooms are created exclusively by the server's damage notification.
(function () {
  const S = window.SkillPolish = {}, TAU = Math.PI * 2, cache = new Map();
  const colors = {
    dualblade: ['#62dcff', '#d8f8ff', '#ff567b', '#ffc29b'],
    spearman: ['#5dbeff', '#f6ce77', '#f95151', '#ffc678'],
    archer: ['#80e8ab', '#fff2ac', '#df64b7', '#ffb89b'],
    taoist: ['#5ae1c0', '#ffe39a', '#d34d91', '#c8a0ff'],
    warrior: ['#edbd5b', '#c4edff', '#f46a44', '#e8b877'],
    arbiter: ['#a3e4ff', '#ffe6a2', '#ba79ff', '#ff7d9c'],
    boxer: ['#6df1c0', '#ffe6a0', '#ff654b', '#ffc07c'],
  };
  S.palette = (cls, faction) => {
    const c = colors[cls] || colors.dualblade, i = faction === 'adharma' ? 2 : 0;
    return { main: c[i], accent: c[i + 1], core: '#fff9e8' };
  };
  const mode = () => window.G?.renderQuality?.mode() || 'auto';
  const detailed = () => mode() === 'high' || mode() === 'auto' && (G.renderQuality?.ambient() ?? true);
  const cap = () => mode() === 'smooth' ? 12 : mode() === 'high' ? 48 : detailed() ? 24 : 16;
  const line = (g, points, color, width = 2) => {
    g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  };
  const polygon = (g, points, fill, edge) => {
    g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 2; g.stroke(); }
  };
  function canvas(size, paint) {
    const image = document.createElement('canvas'); image.width = image.height = size;
    const g = image.getContext('2d'); g.translate(size / 2, size / 2);
    g.lineCap = 'round'; g.lineJoin = 'round'; paint(g); return image;
  }
  function glyph(g, cls, P) {
    g.shadowColor = P.main; g.shadowBlur = 12;
    const metal = g.createLinearGradient(-50, -55, 50, 55);
    metal.addColorStop(0, P.main + '30'); metal.addColorStop(.48, P.accent + 'b0'); metal.addColorStop(.53, P.core); metal.addColorStop(1, P.main + '40');
    if (cls === 'dualblade') {
      for (const sign of [-1, 1]) {
        g.save(); g.rotate(sign * .5 + (sign < 0 ? Math.PI : 0));
        g.beginPath(); g.moveTo(-60, 24); g.bezierCurveTo(-44, -62, 51, -58, 66, 20);
        g.bezierCurveTo(36, -23, -30, -15, -60, 24); g.fillStyle = metal; g.fill();
        g.beginPath(); g.moveTo(-60, 24); g.bezierCurveTo(-44, -62, 51, -58, 66, 20);
        g.strokeStyle = P.core; g.lineWidth = 2; g.stroke(); g.restore();
      }
    } else if (cls === 'spearman') {
      polygon(g, [[84, 0], [28, -15], [38, -3], [-66, -2], [-76, 0], [-66, 2], [38, 3], [28, 15]], metal, P.core);
      for (const side of [-1, 1]) {
        line(g, [[-55, side * 21], [-5, side * 13], [32, side * 5]], P.main, 3);
        polygon(g, [[20, side * 8], [-10, side * 36], [0, side * 10]], P.accent + 'a0');
      }
    } else if (cls === 'archer') {
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(side * (.2 + i * .19));
        polygon(g, [[6, 0], [-65 + i * 9, side * (7 + i * 5)], [-30, side * (18 + i * 7)]], metal, P.accent); g.restore();
      }
      polygon(g, [[74, 0], [34, -13], [44, -3], [-50, -2], [-50, 2], [44, 3], [34, 13]], P.core, P.main);
    } else if (cls === 'taoist') {
      for (let i = 0; i < 8; i++) {
        g.save(); g.rotate(i * TAU / 8); g.beginPath(); g.moveTo(15, 0);
        g.bezierCurveTo(31, -27, 54, -22, 66, 0); g.bezierCurveTo(54, 22, 31, 27, 15, 0);
        g.fillStyle = metal; g.fill(); g.strokeStyle = P.accent; g.lineWidth = 1.5; g.stroke(); g.restore();
      }
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * TAU / 8); line(g, [[74, -6], [74, 6]], P.main); line(g, [[80, -4], [80, 4]], P.accent); g.restore(); }
      g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.strokeStyle = P.core; g.stroke();
      g.beginPath(); g.moveTo(0, -16); g.bezierCurveTo(24, -12, -24, 12, 0, 16); g.stroke();
    } else if (cls === 'warrior') {
      polygon(g, [[0, -67], [48, -43], [42, 20], [0, 67], [-42, 20], [-48, -43]], metal, P.accent);
      polygon(g, [[0, -48], [31, -31], [27, 14], [0, 46], [-27, 14], [-31, -31]], '#13263566', P.core);
      line(g, [[0, -43], [0, 43]], P.core, 3); line(g, [[-26, -10], [26, -10]], P.accent, 4);
      for (const side of [-1, 1]) line(g, [[side * 53, -24], [side * 62, -8], [side * 52, 26]], P.main, 3);
    } else if (cls === 'arbiter') {
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++)
        polygon(g, [[side * 9, -22 + i * 10], [side * (65 - i * 9), -49 + i * 18], [side * (35 - i * 4), 4 + i * 10]], metal, P.accent);
      polygon(g, [[0, 79], [-9, 43], [-5, -53], [0, -70], [5, -53], [9, 43]], P.core, P.main);
      line(g, [[-25, -30], [25, -30]], P.accent, 4);
      g.beginPath(); g.ellipse(0, -56, 23, 8, 0, 0, TAU); g.strokeStyle = P.accent; g.stroke();
    } else if (cls === 'boxer') {
      polygon(g, [[-41, -25], [-31, -45], [-15, -46], [-10, -38], [5, -46], [21, -40], [37, -28], [40, -4], [24, 8], [18, 43], [-14, 51], [-30, 24], [-44, 10]], metal, P.accent);
      for (let i = 0; i < 4; i++) line(g, [[-29 + i * 17, -30], [-25 + i * 15, -8]], P.core, 3);
      line(g, [[-38, 8], [-14, -2], [9, 4], [20, 17]], P.core, 3);
      for (const side of [-1, 1]) {
        g.beginPath(); g.moveTo(side * 15, 56); g.bezierCurveTo(side * 80, 36, side * 75, -35, side * 38, -58);
        g.strokeStyle = P.main; g.lineWidth = 3; g.stroke();
      }
    }
  }
  function textures(cls, faction) {
    const key = cls + ':' + (faction === 'adharma' ? 'adharma' : 'dharma');
    if (cache.has(key)) return cache.get(key);
    const P = S.palette(cls, faction);
    const art = {
      glyph: canvas(224, g => glyph(g, cls, P)),
      glow: canvas(192, g => {
        const glow = g.createRadialGradient(0, 0, 0, 0, 0, 90);
        glow.addColorStop(0, P.core + 'a0'); glow.addColorStop(.12, P.accent + '70');
        glow.addColorStop(.38, P.main + '35'); glow.addColorStop(1, P.main + '00');
        g.fillStyle = glow; g.fillRect(-96, -96, 192, 192);
      }),
      ray: canvas(192, g => {
        const beam = g.createLinearGradient(-80, 0, 80, 0);
        beam.addColorStop(0, P.main + '00'); beam.addColorStop(.45, P.main + '90'); beam.addColorStop(.6, P.core); beam.addColorStop(1, P.accent + '00');
        polygon(g, [[-86, 0], [12, -5], [86, 0], [12, 5]], beam);
        line(g, [[-24, 0], [44, 0]], P.core, 1);
      }),
    };
    cache.set(key, art); return art;
  }
  const stamp = (g, img, x, y, w, h = w) => g.drawImage(img, x - w / 2, y - h / 2, w, h);
  function add(e, skill, kind, x, y, angle, strength, dur, follow = false, token) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const map = G.mapId, art = textures(e.cls, e.faction), limit = cap();
    let count = 0; for (const node of FX.list) if (node.polished) count++;
    while (count >= limit) { FX.list.splice(FX.list.findIndex(node => node.polished), 1); count--; }
    const node = { polished: true, owner: e.id, skill, token, phase: kind === 'cast' ? 'cast' : 'impact',
      t0: performance.now(), dur, layer: 'top',
      draw(g, p) {
        if (G.mapId !== map || G.ents.get(e.id) !== e || e.dead || e.dying) return;
        const pose = follow && G.skillPose ? G.skillPose(e, performance.now()) : null;
        const xx = follow ? e.x + (pose?.dx || 0) + Math.cos(angle) * 23 : x;
        const yy = follow ? e.y + (pose?.dy || 0) - (pose?.lift || 0) - 42 + Math.sin(angle) * 12 : y;
        const R = 120 * strength, view = FX.view;
        if (view && (xx + R < view.x || xx - R > view.x + view.w || yy + R < view.y || yy - R > view.y + view.h)) return;
        const detail = detailed(), fade = Math.pow(1 - p, 1.35), grow = 1 - Math.pow(1 - p, 3);
        g.save(); g.translate(xx, yy); g.globalAlpha *= Math.min(1, p * 18) * fade;
        if (detail) { g.globalCompositeOperation = 'lighter'; stamp(g, art.glow, 0, 0, (kind === 'cast' ? 90 : 145) * strength); }
        g.globalCompositeOperation = 'source-over';
        const size = (kind === 'cast' ? 55 + grow * 27 : 58 + grow * 49) * strength;
        if (detail) g.save();
        if (['dualblade', 'spearman', 'archer'].includes(e.cls)) g.rotate(angle + (e.cls === 'dualblade' ? p * .55 : 0));
        if (e.cls === 'taoist') g.rotate(p * .7);
        if (e.cls === 'boxer' && kind !== 'cast') g.scale(1 + Math.sin(p * Math.PI) * .22, 1 - Math.sin(p * Math.PI) * .12);
        stamp(g, art.glyph, 0, kind === 'cast' ? -p * 14 : 0, size); if (detail) g.restore();
        if (kind !== 'cast' && detail) {
          const n = 4;
          g.globalCompositeOperation = 'lighter';
          if (detail && ['dualblade', 'taoist', 'boxer'].includes(e.cls)) {
            g.save(); g.globalAlpha *= .22;
            g.rotate(e.cls === 'dualblade' ? angle - .3 - p : e.cls === 'taoist' ? -p * .5 : 0);
            stamp(g, art.glyph, 0, 0, size * (1.2 + grow * .35)); g.restore();
          }
          for (let i = 0; i < n; i++) {
            g.save();
            if (e.cls === 'spearman' || e.cls === 'archer') {
              g.rotate(angle); g.translate((grow * 22 - 8) * strength, (i - (n - 1) / 2) * 12 * strength);
            } else if (e.cls === 'arbiter') {
              g.translate((i - (n - 1) / 2) * 19 * strength, -22 * (1 - grow)); g.rotate(Math.PI / 2);
            } else if (e.cls === 'warrior') g.rotate(Math.PI * (.15 + i * .7 / Math.max(1, n - 1)));
            else g.rotate(angle + i * TAU / n + .3 + (e.cls === 'taoist' ? p * .7 : 0));
            stamp(g, art.ray, (12 + grow * 30) * strength, 0, (48 + grow * 44) * strength, (detail ? 32 : 20) * strength); g.restore();
          }
        } else if (detail && strength > 1.1) {
          g.globalAlpha *= .45;
          for (const side of [-1, 1]) { g.save(); g.translate(side * (24 + grow * 15), 9); g.rotate(side * .55); stamp(g, art.ray, 0, 0, 75, 30); g.restore(); }
        }
        g.restore();
      },
    };
    FX.list.push(node);
  }
  S.cancel = (id, skill, token) => { FX.list = FX.list.filter(n => !n.polished || n.owner !== id || skill && n.skill !== skill || token !== undefined && n.token !== token); };
  S.clear = () => { FX.list = FX.list.filter(n => !n.polished); };
  S.play = d => {
    if (d.mapId && d.mapId !== G.mapId) return;
    if (d.phase === 'cancel' || ['spearCancel', 'frontlineCancel', 'ritualCancel'].includes(d.t)) { S.cancel(d.id, d.skill, d.token ?? d.castId); return; }
    const id = d.skill || d.t, sk = C.ALL_SKILLS[id], e = G.ents.get(d.id);
    if (!sk || !e || e.dead || e.dying || !colors[e.cls]) return;
    // Confirmation events already get their impact art through FX.hit. Avoid stacking both.
    if (['spearBeat', 'frontlineHit'].includes(d.t) || d.t === 'boxer' && d.phase === 'hit') return;
    if ((d.t === 'boxer' || d.t === 'arbiter') && !['windup', 'guard', 'ward', 'form', 'resonance', 'blades', 'step', 'breath'].includes(d.phase)) return;
    FX.list = FX.list.filter(n => !(n.polished && n.owner === e.id && n.phase === 'cast'));
    const grade = SkillPerformance.profile(sk, d).grade, release = d.t === 'ritualRelease';
    const strength = (sk.lvl === 1 ? .68 : 1) + grade * .085;
    const a = Number.isFinite(d.a) ? d.a : (e.dir || 0) * Math.PI / 4;
    add(e, id, release ? 'release' : 'cast', release ? d.x : e.x, release ? d.y - 20 : e.y - 42, a, strength, release ? 720 : sk.lvl === 1 ? 260 : 520, !release, d.token ?? d.castId);
  };
  S.hit = (x, y, crit, e) => {
    if (!e || !colors[e.cls] || e.dead || e.dying) return false;
    const a = Math.atan2(y - (e.y - 35), x - e.x), strength = (crit ? 1.12 : .75) + Math.min(130, e.lvl || 1) / 650;
    add(e, e.skillMotion?.skill || e.atk?.kind, 'hit', x, y, a, strength, crit ? 420 : 290);
    return true;
  };
})();
