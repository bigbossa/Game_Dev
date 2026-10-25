// DOM HUD: player frame, skill bar, minimap, chat, kill feed, toasts, death screen.
(function () {
  const HUD = { cds: {}, slots: {}, mm: { a: [], b: null } };
  window.HUD = HUD;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------ skill icons
  function icon(id, f) {
    if (C.ALL_SKILLS[id]?.cls === 'arbiter') return ArbiterLook.icon(id, f);
    const c = document.createElement('canvas'); c.width = c.height = 112;
    const g = c.getContext('2d');
    const sk = C.ALL_SKILLS[id];
    if (sk?.frontline && window.WarriorLook) { WarriorLook.icon(g, sk, f); return c; }
    const identity = window.SkillFX && sk && SkillFX.palette(sk.cls, f);
    const P = identity ? [identity.core, identity.main, identity.deep] : C.FACTIONS[f].fx;
    const acc = identity ? identity.accent : '#ffd76a', paperCol = identity ? identity.paper : '#f5d76a';
    const bg = g.createRadialGradient(56, 50, 6, 56, 56, 80);
    bg.addColorStop(0, identity ? identity.deep : f === 'dharma' ? '#2a5c9a' : '#6a1218'); bg.addColorStop(1, '#0c0e14');
    g.fillStyle = bg; g.fillRect(0, 0, 112, 112);
    if (sk?.ritual) { AscendedSkills.icon(g, sk.cls, sk.lvl === 130, f, 112); return c; }
    g.translate(56, 56);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // ---- pieces ----
    const glow = (col, blur) => { g.shadowColor = col; g.shadowBlur = blur; };
    const noGlow = () => { g.shadowBlur = 0; };
    const blade = (len, w = 7) => {
      const m = g.createLinearGradient(-w, 0, w, 0); m.addColorStop(0, '#9aa8b8'); m.addColorStop(0.5, '#f4f8ff'); m.addColorStop(1, '#8a96a8');
      g.fillStyle = m; g.beginPath(); g.moveTo(0, -len); g.lineTo(w, -len + 14); g.lineTo(w * 0.7, 0); g.lineTo(-w * 0.7, 0); g.lineTo(-w, -len + 14); g.closePath(); g.fill();
      g.fillStyle = P[2]; g.fillRect(-12, 0, 24, 5); g.fillStyle = acc; g.fillRect(-12, 0, 24, 1.5);
      g.fillStyle = '#5a3a22'; g.fillRect(-3, 5, 6, 16);
    };
    const at = (x, y, r, s, fn) => { g.save(); g.translate(x, y); g.rotate(r); g.scale(s, s); fn(); g.restore(); };
    const arc = (r, a0, a1, w, col = P[1]) => { g.strokeStyle = col; g.lineWidth = w; glow(col, 12); g.beginPath(); g.arc(0, 0, r, a0, a1); g.stroke(); noGlow(); };
    const ln = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    const blob = (x, y, r, col, a = 1) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; };
    const paper = (x, y, r, sc = 1, col = paperCol, rune = f === 'dharma' ? '#c3262c' : '#ff4a5a') => at(x, y, r, sc, () => {
      glow(P[1], 12); g.fillStyle = col; g.fillRect(-11, -26, 22, 52); noGlow();
      g.strokeStyle = rune; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 18); g.moveTo(-6, -12); g.lineTo(6, -8); g.moveTo(-6, 0); g.lineTo(6, 4); g.moveTo(-5, 10); g.lineTo(5, 14); g.stroke();
    });
    const shaft = (x, y, a, len, glowOn, head = P[0]) => at(x, y, a, 1, () => {
      if (glowOn) { g.strokeStyle = P[1]; g.lineWidth = 9; g.globalAlpha = 0.45; glow(P[1], 16); g.beginPath(); g.moveTo(-len, 0); g.lineTo(len * 0.6, 0); g.stroke(); g.globalAlpha = 1; noGlow(); }
      g.strokeStyle = '#e8d8b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
      g.fillStyle = head; g.beginPath(); g.moveTo(len / 2 + 12, 0); g.lineTo(len / 2 - 2, -6); g.lineTo(len / 2 - 2, 6); g.closePath(); g.fill();
      g.fillStyle = P[1]; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(-len / 2 - 10, -7); g.lineTo(-len / 2 + 2, 0); g.lineTo(-len / 2 - 10, 7); g.closePath(); g.fill();
    });
    const bolt = (pts, w = 6) => { g.strokeStyle = P[0]; g.lineWidth = w; glow(P[1], 18); ln(pts, P[0], w); noGlow(); ln(pts, '#ffffff', w / 3); };
    const leaf = (x, y, a, len, col = P[1]) => at(x, y, a, 1, () => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-len * 0.5, -len * 0.55, 0, -len); g.quadraticCurveTo(len * 0.5, -len * 0.55, 0, 0); g.fill(); });
    const ellipseRing = (y, rx, ry, col, w = 2) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, TAU); g.stroke(); };
    const flame = (x, y, h, w, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w, y - h * 0.6, x, y - h); g.quadraticCurveTo(x + w, y - h * 0.6, x + w, y); g.closePath(); g.fill(); };
    const wing = (side, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * 26, -34, side * 50, -22); g.quadraticCurveTo(side * 30, -14, side * 40, 2); g.quadraticCurveTo(side * 22, -4, 0, 10); g.closePath(); g.fill(); };
    switch (id) {
      case 'spearThrust': case 'spearCrush': case 'spearChain': case 'spearBreak': case 'spearExecution':
      case 'spearHeart': case 'spearPin': case 'spearBoss': case 'spearHeaven': {
        // Each icon shows its skill's own motif (spearman-fx.js); the spear is drawn tip-up in its local frame.
        const spear = (len, w = 1, lit = true) => {
          if (lit) glow(P[1], 12 * w);
          ln([[0, len * .5], [0, -len * .2]], acc, 4 * w); noGlow();
          ln([[0, len * .5], [0, -len * .2]], '#6a4a2a', 1.4 * w);
          g.fillStyle = P[1]; g.beginPath(); g.moveTo(0, -len * .17); g.lineTo(-5 * w, -len * .05); g.lineTo(0, -len * .1); g.lineTo(5 * w, -len * .05); g.closePath(); g.fill();
          ln([[-8 * w, -len * .2], [8 * w, -len * .2]], acc, 3 * w);
          glow(P[1], 10); g.fillStyle = P[0]; g.beginPath(); g.moveTo(0, -len * .5);
          g.quadraticCurveTo(8 * w, -len * .36, 3 * w, -len * .21); g.lineTo(-3 * w, -len * .21); g.quadraticCurveTo(-8 * w, -len * .36, 0, -len * .5); g.fill(); noGlow();
          ln([[0, -len * .47], [0, -len * .24]], P[2], 1.2 * w);
        };
        // a spear with its tip at (x, y), pointing toward (tx, ty)
        const sp = (x, y, tx, ty, len, w = 1, lit = true) => {
          const L = Math.hypot(tx - x, ty - y) || 1, ux = (tx - x) / L, uy = (ty - y) / L;
          at(x - ux * len * .5, y - uy * len * .5, Math.atan2(ux, -uy), 1, () => spear(len, w, lit));
        };
        const star4 = (x, y, r, col) => { glow(col, 14); g.fillStyle = col; g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .22 : r, b = i * Math.PI / 4; g.lineTo(x + Math.sin(b) * rr, y - Math.cos(b) * rr); } g.closePath(); g.fill(); noGlow(); };
        const rock = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * .3, y - s); g.lineTo(x + s, y - s * .4); g.lineTo(x + s * .6, y + s * .7); g.lineTo(x - s * .5, y + s * .6); g.closePath(); g.fill(); };
        const hex = (x, y, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const b = i * TAU / 6 + Math.PI / 6; g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); } g.closePath(); };
        const chain = (x0, y0, x1, y1) => { const n = 6, a = Math.atan2(y1 - y0, x1 - x0); for (let i = 0; i < n; i++) at(x0 + (x1 - x0) * (i + .5) / n, y0 + (y1 - y0) * (i + .5) / n, a, 1, () => { g.strokeStyle = i % 2 ? acc : P[1]; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 4.5, i % 2 ? 1.5 : 3, 0, 0, TAU); g.stroke(); }); };
        const red = f === 'adharma' ? '#ff4a5a' : P[0];
        switch (Number(sk.key)) {
          case 1: // ทวนทะลวง: drill helix round the shaft, sonic rings, star flare on the tip
            at(0, 0, Math.PI / 4, 1, () => {
              g.strokeStyle = P[1]; g.lineWidth = 2; glow(P[1], 8); g.beginPath();
              for (let i = 0; i <= 40; i++) { const y = 42 - i * 2, x = Math.sin(i * .6) * (13 - i * .27); i ? g.lineTo(x, y) : g.moveTo(x, y); }
              g.stroke(); noGlow();
              for (const [y, r] of [[-8, 14], [10, 10]]) { g.strokeStyle = acc; g.lineWidth = 2; g.beginPath(); g.ellipse(0, y, r, r * .3, 0, 0, TAU); g.stroke(); }
            });
            sp(30, -30, 40, -40, 96, 1.05); star4(30, -30, 17, P[0]); break;
          case 2: // ทวนบดศิลา: spear driven into cracked ground, rocks thrown up
            blob(0, 30, 44, P[1], .45);
            for (let i = 0; i < 6; i++) {
              const b = i * TAU / 6 + .3, pts = [[0, 34], [Math.cos(b) * 20 + 3, 34 + Math.sin(b) * 8], [Math.cos(b + .2) * 46, 34 + Math.sin(b + .2) * 17]];
              ln(pts, '#2a1e18', 4); ln(pts, P[1], 1.5);
            }
            ellipseRing(34, 44, 12, acc, 2.5);
            sp(0, 34, 0, 50, 84, 1.15);
            rock(-30, -4, 7, '#8a7a66'); rock(28, -12, 6, '#b9a58a'); rock(-18, -24, 4, '#5b4f44'); rock(36, 8, 4, '#8a7a66'); rock(16, -34, 3, '#b9a58a');
            ln([[-22, -42], [-10, -50]], P[1], 2); ln([[22, -42], [10, -50]], P[1], 2); break;
          case 3: // ทวนสามประสาน: three phantom spears converge on one point, an X scar and three combo pips
            g.globalAlpha = .6; sp(0, -18, 40, -60, 70, .75, false); sp(0, -18, -40, -60, 70, .75, false); g.globalAlpha = 1;
            sp(0, -18, 0, -60, 74, 1);
            glow(P[0], 12); ln([[-14, -30], [14, -6]], P[0], 3.5); ln([[14, -30], [-14, -6]], P[0], 3.5); noGlow();
            star4(0, -18, 13, '#ffffff');
            for (const x of [-12, 0, 12]) { g.fillStyle = acc; g.beginPath(); g.moveTo(x, -50); g.lineTo(x + 4, -45); g.lineTo(x, -40); g.lineTo(x - 4, -45); g.closePath(); g.fill(); }
            break;
          case 4: // ทวนเจาะเกราะ: honeycomb guard cracked through by a drilling spear
            hex(6, -6, 34); g.fillStyle = P[2]; g.fill(); glow(acc, 10); g.strokeStyle = acc; g.lineWidth = 3; g.stroke(); noGlow();
            for (let i = 0; i < 6; i++) { const b = i * TAU / 6; hex(6 + Math.cos(b) * 17, -6 + Math.sin(b) * 17, 8.5); g.strokeStyle = P[1]; g.lineWidth = 1; g.stroke(); }
            for (let i = 0; i < 5; i++) { const b = i * 1.27 + .4; ln([[6, -6], [6 + Math.cos(b) * 14 + 3, -6 + Math.sin(b) * 14], [6 + Math.cos(b + .25) * 32, -6 + Math.sin(b + .25) * 32]], '#ffffff', 1.6); }
            for (const [x, y, r] of [[42, -36, .6], [46, -18, 2.2], [32, -46, 4]]) at(x, y, r, 1, () => { g.fillStyle = acc; g.beginPath(); g.moveTo(0, -6); g.lineTo(5, 3); g.lineTo(-4, 4); g.closePath(); g.fill(); });
            sp(38, -38, 48, -48, 104, 1);
            at(0, 0, Math.PI / 4, 1, () => { for (const y of [18, 32]) { g.strokeStyle = P[0]; g.lineWidth = 2; g.beginPath(); g.ellipse(0, y, 9, 3, 0, 0, TAU); g.stroke(); } });
            break;
          case 5: { // ทวนปลิดชีพ: verdict seal above, a giant spear falls into closing brackets, pillar of light
            blob(0, 4, 56, P[2], .95);
            const pg = g.createLinearGradient(-14, 0, 14, 0); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(.5, P[0]); pg.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = .55; g.fillStyle = pg; g.fillRect(-14, -56, 28, 96); g.globalAlpha = 1;
            glow(acc, 8); ellipseRing(-40, 22, 8, acc, 2.5); noGlow(); ellipseRing(-40, 14, 5, P[1], 1.5);
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ln([[sx * 26, 30 + sy * 6], [sx * 26, 30 + sy * 16], [sx * 16, 30 + sy * 16]], P[0], 3);
            sp(0, 30, 0, 50, 90, 1.3);
            glow(P[1], 12); ln([[-44, 26], [44, 34]], P[0], 3); noGlow(); ln([[-44, 26], [44, 34]], '#ffffff', 1); break;
          }
          case 6: { // ทวนสะบั้นหัวใจ: a heart split in two under crossed crescent cuts, drops falling
            sp(34, -34, 50, -50, 104, .85, false);
            const half = (s) => { g.beginPath(); g.moveTo(0, 28); g.bezierCurveTo(s * 46, 2, s * 30, -34, 0, -14); g.lineTo(s * 4, -6); g.lineTo(-s * 3, 4); g.lineTo(s * 4, 14); g.closePath(); };
            for (const s of [-1, 1]) {
              g.save(); g.translate(s * 7, s * 3); g.rotate(s * .14); half(s);
              glow(P[1], 12); g.fillStyle = s < 0 ? P[1] : f === 'adharma' ? '#e85a6a' : acc; g.fill(); noGlow();
              g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.stroke(); g.restore();
            }
            g.strokeStyle = P[0]; g.lineWidth = 4; glow(P[0], 12);
            g.beginPath(); g.moveTo(-42, -30); g.quadraticCurveTo(-4, -10, 38, 34); g.stroke();
            g.beginPath(); g.moveTo(42, -30); g.quadraticCurveTo(4, -10, -38, 34); g.stroke(); noGlow();
            for (const [x, y, r] of [[-10, 40, 3], [4, 46, 2.4], [16, 40, 2]]) { g.fillStyle = red; g.beginPath(); g.ellipse(x, y, r * .8, r * 1.3, 0, 0, TAU); g.fill(); }
            break;
          }
          case 7: // ทวนตรึงพยัคฆ์: tiger spirit above, the spear pinned in the ground, chains binding
            for (const [x, y] of [[-50, 44], [50, 44], [-50, 10], [50, 10]]) chain(x, y, 0, 32);
            ellipseRing(36, 30, 8, P[1], 2);
            g.save(); g.translate(0, -26);
            g.globalAlpha = .3; g.fillStyle = P[1]; g.beginPath(); g.ellipse(0, 0, 26, 20, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
            g.strokeStyle = acc; g.lineWidth = 2; g.stroke();
            for (const s of [-1, 1]) {
              g.fillStyle = P[1]; g.beginPath(); g.moveTo(s * 13, -14); g.lineTo(s * 22, -26); g.lineTo(s * 25, -10); g.closePath(); g.fill();
              at(s * 9, -2, s * .35, 1, () => { glow(P[0], 10); g.fillStyle = P[0]; g.beginPath(); g.ellipse(0, 0, 6, 2.6, 0, 0, TAU); g.fill(); noGlow(); });
              for (let i = 0; i < 3; i++) ln([[s * (25 - i), -4 + i * 5], [s * (15 - i), -1 + i * 4]], P[2], 2.2);
              g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(s * 3, 9); g.lineTo(s * 5, 16); g.lineTo(s * 7, 9); g.closePath(); g.fill();
            }
            for (let i = 0; i < 3; i++) ln([[-5, -15 + i * 3], [5, -15 + i * 3]], P[2], 1.6);
            g.restore();
            sp(0, 34, 0, 50, 64, 1.1); break;
          case 8: { // ทวนล่ามังกร: a dragon coiled round the spear
            const body = (t0, t1) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = t0 + (t1 - t0) * i / 24; pts.push([-38 + 70 * t + Math.sin(t * TAU * 1.5) * 14, 36 - 70 * t + Math.sin(t * TAU * 1.5 + 1) * 10]); } return pts; };
            const draw = (pts) => { glow(P[1], 12); ln(pts, P[2], 11); noGlow(); ln(pts, P[1], 7); ln(pts, P[0], 1.5); };
            draw(body(0, 1));
            sp(38, -38, 50, -50, 104, .95);
            draw(body(.42, .62));                                   // the coil passing in front of the shaft
            const [hx, hy] = body(1, 1)[0], [nx, ny] = body(.96, .96)[0];
            at(hx, hy, Math.atan2(hy - ny, hx - nx), 1, () => {
              g.fillStyle = P[1]; g.beginPath(); g.moveTo(16, 0); g.lineTo(3, -9); g.lineTo(-10, -8); g.lineTo(-6, 0); g.lineTo(-10, 8); g.lineTo(3, 9); g.closePath(); g.fill();
              ln([[-4, -6], [-14, -16]], acc, 2.4); ln([[-4, 6], [-14, 16]], acc, 2.4); dot(5, -3, 2, '#ffffff');
            });
            break;
          }
          case 9: { // ทวนทะลวงสวรรค์: heaven gate, a fan of spears and a pillar onto one point
            const pg = g.createLinearGradient(-16, 0, 16, 0); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(.5, P[0]); pg.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = .6; g.fillStyle = pg; g.fillRect(-16, -44, 32, 84); g.globalAlpha = 1;
            glow(acc, 10); ellipseRing(-44, 32, 8, acc, 2.5); noGlow(); ellipseRing(-44, 22, 5, P[1], 1.5);
            const fan = [-2, -1, 1, 2].map((i) => [i * 19, -22 + Math.abs(i) * 9]);
            g.globalAlpha = .7; ln(fan, acc, 1); g.globalAlpha = 1;
            for (const [x, y] of fan) { sp(x * .7, y + (40 - y) * .3, 0, 40, 36, .55); dot(x, y, 2, P[0]); }
            sp(0, 34, 0, 50, 70, 1.25); star4(0, 36, 14, '#ffffff'); break;
          }
        }
        break;
      }
      // ---------------- ดาบคู่: steel at arm's length
      case 'fang': // twin blades crossed over three tiger claw marks
        for (let i = -1; i <= 1; i++) { g.strokeStyle = P[1]; g.lineWidth = 5; glow(P[1], 10); g.beginPath(); g.moveTo(-30 + i * 14, -34); g.quadraticCurveTo(-6 + i * 14, 0, -22 + i * 14, 36); g.stroke(); }
        noGlow(); at(0, 8, -0.6, 0.85, () => blade(46)); at(0, 8, 0.6, 0.85, () => blade(46)); break;
      case 'lotus': // eight blade petals spinning round a bright core
        for (let i = 0; i < 8; i++) at(0, 0, i * TAU / 8 + 0.2, 1, () => {
          const gr = g.createLinearGradient(0, 0, 0, -44); gr.addColorStop(0, P[2]); gr.addColorStop(0.6, P[1]); gr.addColorStop(1, P[0]);
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(13, -26, 0, -46); g.quadraticCurveTo(-5, -26, 0, -6); g.fill();
        });
        arc(30, 0.3, 2.4, 3); arc(30, 3.4, 5.5, 3); blob(0, 0, 14, P[0]); break;
      case 'shadowstep': // a shadow silhouette left behind, a streak, the stab from behind the target
        g.globalAlpha = 0.75; g.fillStyle = P[1]; g.beginPath(); g.arc(-28, -12, 8, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-38, 30); g.lineTo(-34, -2); g.lineTo(-22, -2); g.lineTo(-18, 30); g.fill(); g.globalAlpha = 1;
        g.setLineDash([5, 5]); ln([[-22, 10], [0, -30], [26, -6]], P[1], 2.5); g.setLineDash([]);
        dot(14, 14, 12, '#3a2a3a'); glow(P[1], 14); dot(14, 14, 5, P[1]); noGlow();
        at(30, 0, -2.3, 0.6, () => blade(50, 6)); break;
      case 'rend': // a cross cut through an armour plate breaking apart, bleeding
        g.fillStyle = '#6a7484'; g.beginPath(); g.moveTo(-26, -30); g.lineTo(26, -30); g.lineTo(30, 10); g.lineTo(0, 36); g.lineTo(-30, 10); g.closePath(); g.fill();
        g.strokeStyle = '#2a2f3a'; g.lineWidth = 2; ln([[-8, -30], [-2, -6], [-14, 12]], '#2a2f3a', 2); ln([[10, -30], [4, 0], [18, 20]], '#2a2f3a', 2);
        glow(P[1], 16); g.strokeStyle = P[1]; g.lineWidth = 8; g.beginPath(); g.moveTo(-38, -38); g.lineTo(38, 38); g.moveTo(38, -38); g.lineTo(-38, 38); g.stroke();
        g.strokeStyle = P[0]; g.lineWidth = 2.5; g.stroke(); noGlow();
        for (const [x, y] of [[-34, 26], [32, 30], [26, 40]]) dot(x, y, 3.2, '#c3262c');
        for (const [x, y, r] of [[-40, -6, 0.6], [40, -10, -0.5]]) at(x, y, r, 1, () => { g.fillStyle = '#8a94a4'; g.fillRect(-5, -4, 10, 8); });
        break;
      case 'tempest': // a storm ring of swords round the body
        blob(0, 4, 30, P[1], 0.5); ellipseRing(6, 42, 16, P[1], 2);
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10, x = Math.cos(a) * 38, y = 4 + Math.sin(a) * 26; at(x, y, a + Math.PI, 0.32, () => blade(54)); }
        arc(18, 0, 4.4, 4, P[0]); break;
      case 'crescent': // one huge crescent sweep with the blade at its tip
        glow(P[1], 18); g.fillStyle = P[1];
        g.beginPath(); g.arc(-6, 6, 44, -2.4, 0.9); g.arc(-18, 10, 34, 0.9, -2.4, true); g.closePath(); g.fill(); noGlow();
        g.fillStyle = P[0]; g.beginPath(); g.arc(-6, 6, 44, -1.6, 0.3); g.arc(-10, 8, 40, 0.3, -1.6, true); g.closePath(); g.fill();
        at(30, 30, 2.4, 0.5, () => blade(54)); break;
      case 'skyfall': // twin blades diving onto a cracked impact
        g.setLineDash([6, 5]); ln([[-40, 30], [-24, -34], [8, -20]], P[1], 3); g.setLineDash([]);
        glow(P[1], 14); ellipseRing(34, 30, 9, P[0], 3); noGlow();
        for (let i = 0; i < 7; i++) { const a = Math.PI + i * 0.52; ln([[Math.cos(a) * 12 + 10, 34 + Math.sin(a) * 4], [Math.cos(a) * 34 + 10, 30 + Math.sin(a) * 16]], P[1], 2.5); }
        at(4, 4, Math.PI - 0.2, 0.62, () => blade(52)); at(20, 4, Math.PI + 0.2, 0.62, () => blade(52)); break;
      case 'thousand': // countless thin cuts crossing one target
        dot(0, 0, 16, '#2a1e2a'); blob(0, 0, 20, P[1], 0.6);
        for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.2, L = 42 - (i % 3) * 6; glow(P[1], 8); ln([[-Math.cos(a) * L, -Math.sin(a) * L], [Math.cos(a) * L, Math.sin(a) * L]], i % 2 ? P[1] : P[0], i % 3 ? 2 : 3.5); }
        noGlow(); break;
      case 'twindragon': // two blade-dragons twisting forward
        for (const side of [-1, 1]) {
          const pts = []; for (let i = 0; i <= 14; i++) pts.push([-44 + i * 6, side * Math.sin(i * 0.65) * 14 + 8 - i * 1.6]);
          glow(P[1], 12); for (let i = 0; i < pts.length - 1; i++) ln([pts[i], pts[i + 1]], side < 0 ? P[1] : P[0], 2 + i * 0.5); noGlow();
          const [hx, hy] = pts[14]; g.fillStyle = side < 0 ? P[1] : P[0];
          g.beginPath(); g.ellipse(hx + 4, hy, 10, 6, -0.3, 0, TAU); g.fill();
          g.beginPath(); g.moveTo(hx + 8, hy - 4); g.lineTo(hx + 24, hy - 10); g.lineTo(hx + 14, hy + 2); g.fill();
          dot(hx + 7, hy - 2, 1.8, '#fff');
        }
        break;
      // ---------------- นักพรต: talismans, arrays, healing and blessings
      case 'jade': // a jade talisman with a glowing trail
        for (let i = 0; i < 6; i++) blob(-22 - i * 5, 22 + i * 3, 10 - i, P[1], 0.6);
        paper(6, -4, 0.6, 1, '#bff2d4', '#1f7a52'); break;
      case 'skybolt': // a storm cloud and its bolt
        for (const [x, y, r] of [[-20, -26, 16], [2, -32, 19], [24, -24, 14]]) dot(x, y, r, '#4a5468');
        for (const [x, y, r] of [[-14, -30, 9], [6, -36, 10]]) dot(x, y, r, '#6a7488');
        bolt([[4, -16], [-10, 6], [6, 6], [-6, 40]]); break;
      case 'mercy': // nectar drops over an opening lotus
        glow('#7cff8a', 14);
        for (let i = 0; i < 6; i++) at(0, 26, -Math.PI / 2 + (i - 2.5) * 0.42, 1, () => { g.fillStyle = i % 2 ? '#a8ffb0' : '#e8fff0'; g.beginPath(); g.ellipse(0, -16, 7, 18, 0, 0, TAU); g.fill(); });
        noGlow();
        for (const [x, y] of [[-22, -30], [0, -40], [22, -28]]) { g.fillStyle = '#c8f4ff'; g.beginPath(); g.moveTo(x, y - 10); g.quadraticCurveTo(x + 7, y, x, y + 5); g.quadraticCurveTo(x - 7, y, x, y - 10); g.fill(); }
        break;
      case 'aegis': { // a hexagon shell with the five elements
        g.fillStyle = 'rgba(255,215,106,0.22)'; g.strokeStyle = acc; g.lineWidth = 4; glow(acc, 12);
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); } g.closePath(); g.fill(); g.stroke(); noGlow();
        g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); } g.closePath(); g.stroke();
        ['#5ccf6a', '#ff5a3a', '#e8c25a', '#f0f4ff', '#4aa8ff'].forEach((col, i) => { const a = i * TAU / 5 - Math.PI / 2; glow(col, 8); dot(Math.cos(a) * 30, Math.sin(a) * 30, 5, col); });
        noGlow(); break;
      }
      case 'heavens': { // a trigram array with a pillar of light and a healing leaf
        g.strokeStyle = P[1]; g.lineWidth = 3; glow(P[1], 10);
        g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44 * 0.6 + 14); } g.closePath(); g.stroke(); noGlow();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ln([[Math.cos(a) * 30 - 5, Math.sin(a) * 18 + 14], [Math.cos(a) * 30 + 5, Math.sin(a) * 18 + 14]], acc, 2.5); }
        const gr = g.createLinearGradient(0, -46, 0, 14); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, P[0]);
        g.fillStyle = gr; g.fillRect(-8, -46, 16, 60); leaf(22, -10, 0.5, 18, '#7cff8a'); break;
      }
      case 'spiritsword': // a flying spirit sword with a talisman trail
        g.strokeStyle = P[1]; g.lineWidth = 10; g.globalAlpha = 0.5; glow(P[1], 16); g.beginPath(); g.moveTo(-44, 30); g.lineTo(-4, 4); g.stroke(); g.globalAlpha = 1; noGlow();
        paper(-30, 22, 0.98, 0.45); at(8, -4, 0.98, 1, () => blade(46, 6)); break;
      case 'might': // the war glyph 武 in flames
        for (const [x, h] of [[-26, 30], [-12, 40], [4, 46], [20, 38], [32, 28]]) flame(x, 40, h, 9, 'rgba(255,122,58,0.75)');
        glow('#ffb04a', 18); g.fillStyle = '#ffe9a8'; g.font = '900 56px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('武', 0, 0); noGlow();
        g.strokeStyle = '#7a1d12'; g.lineWidth = 1.5; g.strokeText('武', 0, 0); break;
      case 'meteor': // flaming rocks falling onto a crater
        ellipseRing(34, 36, 10, '#ff8a3a', 3);
        for (const [x, y, r] of [[-26, -26, 9], [4, -8, 13], [26, -34, 7]]) {
          g.strokeStyle = 'rgba(255,138,58,0.7)'; g.lineWidth = r * 1.2; g.beginPath(); g.moveTo(x - r * 2.6, y - r * 3.4); g.lineTo(x, y); g.stroke();
          glow('#ffcf6a', 14); dot(x, y, r, '#5a3a32'); noGlow(); dot(x + r * 0.3, y - r * 0.3, r * 0.45, '#ffcf6a');
        }
        break;
      case 'nirvana': // sun rays over a lotus throne and a pillar of light
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ln([[Math.cos(a) * 22, Math.sin(a) * 22 - 14], [Math.cos(a) * 46, Math.sin(a) * 46 - 14]], 'rgba(255,211,106,0.8)', 3); }
        glow('#ffd36a', 20); dot(0, -14, 18, '#fffbe0'); noGlow();
        for (let i = 0; i < 7; i++) at(0, 34, -Math.PI / 2 + (i - 3) * 0.4, 1, () => { g.fillStyle = i % 2 ? '#ffe7a8' : '#fff7dc'; g.beginPath(); g.ellipse(0, -14, 6, 16, 0, 0, TAU); g.fill(); });
        break;
      // ---------------- นักธนู: arrows, keen eyes and wind
      case 'hawkshot': // one arrow with a hawk feather
        shaft(0, 0, -0.7, 60, false); leaf(-24, 22, -2.3, 22, P[1]); break;
      case 'scatter': // a fan of arrows
        for (let i = -2; i <= 2; i++) shaft(-6, 10, -0.5 + i * 0.22, 54, false); break;
      case 'hawkeye': // a hawk's eye in a crosshair
        g.strokeStyle = P[1]; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 38, 0, TAU); g.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ln([[Math.cos(a) * 28, Math.sin(a) * 28], [Math.cos(a) * 46, Math.sin(a) * 46]], P[0], 3); }
        g.fillStyle = '#f6efd4'; g.beginPath(); g.moveTo(-26, 0); g.quadraticCurveTo(0, -22, 26, 0); g.quadraticCurveTo(0, 22, -26, 0); g.fill();
        glow('#ffcf4a', 14); dot(0, 0, 10, '#e8a21a'); noGlow(); dot(0, 0, 4.5, '#1a1408'); dot(-3, -3, 2, '#fff'); break;
      case 'gale': // a wind spiral driving arrows faster
        for (let i = 0; i < 3; i++) arc(40 - i * 11, i * 2.2, i * 2.2 + 3.6, 5 - i, '#a9f0e4');
        for (const y of [-14, 0, 14]) ln([[-46, y], [-22, y]], 'rgba(255,255,255,0.6)', 2);
        shaft(10, 2, -0.15, 50, true); break;
      case 'skyrain': // arrows raining into a ring
        ellipseRing(30, 40, 12, P[1], 2);
        for (const [x, y] of [[-24, 10], [-6, -6], [14, 4], [28, -14], [-30, -22], [4, -30]]) {
          ln([[x - 6, y - 22], [x, y]], '#e8d8b0', 2.5);
          g.fillStyle = P[0]; g.beginPath(); g.moveTo(x + 2, y + 8); g.lineTo(x - 4, y - 2); g.lineTo(x + 5, y - 3); g.closePath(); g.fill();
        }
        break;
      case 'deadeye': // an arrow through a heart-red bullseye
        for (const [r, col] of [[34, '#ffffff'], [25, '#e8384a'], [16, '#ffffff'], [8, '#e8384a']]) dot(10, -8, r, col);
        shaft(-6, 10, -0.75, 70, true); break;
      case 'rollshot': // a back roll and a volley forward
        g.setLineDash([6, 5]); ln([[22, 32], [6, -40], [-28, 26]], P[1], 3); g.setLineDash([]);
        for (const dy of [-10, 0, 10]) shaft(4, dy - 2, -0.05, 44, false); break;
      case 'blast': // a fire arrow bursting
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10; at(22, -14, a, 1, () => flame(0, 0, 30, 7, i % 2 ? 'rgba(255,122,42,0.85)' : 'rgba(255,224,138,0.9)')); }
        glow('#ffd06a', 18); dot(22, -14, 10, '#fff0b0'); noGlow();
        shaft(-12, 14, -0.7, 52, false, '#ff7a2a'); break;
      case 'stormphoenix': { // a phoenix with lightning in its wings
        glow('#8fd8ff', 16); wing(-1, P[1]); wing(1, P[1]); noGlow();
        g.fillStyle = P[0]; g.beginPath(); g.ellipse(0, 8, 8, 18, 0, 0, TAU); g.fill(); dot(0, -14, 7, P[0]);
        bolt([[-34, -8], [-22, 4], [-30, 8], [-16, 24]], 3); bolt([[34, -8], [22, 4], [30, 8], [16, 24]], 3); break;
      }
      case 'pot_hp': case 'pot_mp': { // a potion bottle (red = HP, blue = MP) — quick-use slot, drawn from the bag stack
        const col = id === 'pot_hp' ? ['#ff7a6a', '#c3262c'] : ['#7ac8ff', '#2a6fd0'];
        g.fillStyle = '#d8d0c0'; g.fillRect(-8, -38, 16, 12);
        g.fillStyle = '#7a5a3a'; g.fillRect(-10, -44, 20, 8);
        const lg = g.createLinearGradient(0, -26, 0, 36); lg.addColorStop(0, col[0]); lg.addColorStop(1, col[1]);
        g.fillStyle = lg; g.beginPath(); g.arc(0, 10, 28, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-10, 0, 6, 10, 0.4, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 10, 28, 0, TAU); g.stroke();
        break;
      }
    }
    // corner badge: ▲ = buff, + = heal (so the role reads at a glance on the bar)
    const badge = id === 'mercy' || id === 'nirvana' ? 'heal' : C.BUFF_SKILLS.includes(id) ? 'buff' : '';
    if (badge) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.shadowBlur = 0;
      g.fillStyle = 'rgba(8,12,18,0.82)'; g.beginPath(); g.arc(94, 18, 13, 0, TAU); g.fill();
      g.strokeStyle = badge === 'buff' ? '#ffd76a' : '#7cff8a'; g.lineWidth = 2; g.stroke();
      g.fillStyle = g.strokeStyle; g.lineWidth = 4;
      if (badge === 'buff') { g.beginPath(); g.moveTo(94, 9); g.lineTo(102, 22); g.lineTo(86, 22); g.closePath(); g.fill(); }
      else { g.beginPath(); g.moveTo(94, 10); g.lineTo(94, 26); g.moveTo(86, 18); g.lineTo(102, 18); g.stroke(); }
    }
    return c;
  }

  // ------------------------------------------------------------ init
  HUD.init = function (me) {
    HUD.me = me;
    $('hud').classList.remove('hidden');
    const sheet = C.CLASSES[me.cls]?.sheet;
    $('pfImg').src = `assets/${sheet ? sheet + '-' : ''}${me.faction}-portrait.png`;
    if (!sheet && window.DualbladeModel?.ready) $('pfImg').src = DualbladeModel.portrait(me.faction);
    const cls = C.CLASSES[me.cls] || C.CLASSES.dualblade;
    if (cls.sheet) $('pfImg').src = `assets/${cls.sheet}-${me.faction}-portrait.png`;
    if(me.cls==='archer'&&window.ArcherModel?.ready)$('pfImg').src=ArcherModel.portrait(me.faction);
    if(me.cls==='spearman'&&me.faction==='adharma')$('pfImg').src='assets/adharma-hair/spearman-adharma-portrait.png';
    if(me.cls==='warrior')$('pfImg').src=WarriorLook.portrait(me.faction);
    $('pfName').innerHTML = `<span id="pfNameTxt">${esc(me.name)}</span><b id="pfEvil" class="pf-evil"></b> <small style="color:${C.FACTIONS[me.faction].color}">· ${C.FACTIONS[me.faction].name} · ${cls.name}</small>`;
    HUD.buildBar();
  };
  HUD.icon = icon;
  $('pkBtn').addEventListener('click', () => HUD.togglePk());
  // skill bar: keys 1-9 hold whatever the player placed there (G.skl.bar, set in the skill book), then the potions.
  // Skills dragged from the skill book drop onto any key.
  HUD.buildBar = function () {
    const me = HUD.me;
    if (!me) return;
    const cls = C.CLASSES[me.cls] || C.CLASSES.dualblade;
    const bar = $('skillbar');
    bar.innerHTML = '<div class="sb-grip" title="ลากเพื่อย้ายแถบสกิล · ดับเบิลคลิก = กลับตำแหน่งเดิม">⋮⋮</div>';
    HUD.slots = {};
    const dropTo = (s, i) => {
      s.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/skill')) { e.preventDefault(); s.classList.add('drop'); } });
      s.addEventListener('dragleave', () => s.classList.remove('drop'));
      s.addEventListener('drop', (e) => { e.preventDefault(); s.classList.remove('drop'); const id = e.dataTransfer.getData('text/skill'); if (id) BOOK.place(id, i); });
    };
    const mkSlot = (id, key, data, i) => {
      const s = document.createElement('div');
      s.className = 'slot';
      s.dataset.id = id;
      s.dataset.key = key;              // touch layout places the buttons by key (style.css)
      if (i !== undefined) dropTo(s, i);
      s.appendChild(icon(id, me.faction));
      s.insertAdjacentHTML('beforeend', `<div class="cd"></div><div class="cdt"></div><span class="key">${key}</span>${data.mp ? `<span class="mpc">${data.mp}</span>` : ''}<span class="rk"></span><div class="lock"></div>`);
      s.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') showTip(e, data); });
      s.addEventListener('pointermove', moveTip);
      s.addEventListener('pointerleave', hideTip);
      // pointerdown: instant on touch screens (no 300 ms click delay), several buttons can be pressed at once
      s.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (window.G) G.pressSlot(id); });
      s.addEventListener('contextmenu', (e) => e.preventDefault());
      bar.appendChild(s);
      HUD.slots[id] = { el: s, data, cd: s.querySelector('.cd'), cdt: s.querySelector('.cdt'), lock: s.querySelector('.lock'), rk: s.querySelector('.rk'), mpc: s.querySelector('.mpc') };
    };
    const layout = (window.G && G.skl && G.skl.bar) || cls.skills.map((sk) => sk.id);
    C.BAR_KEYS.forEach((key, i) => {
      const sk = layout[i] && C.ALL_SKILLS[layout[i]];
      if (sk && sk.cls === cls.id) return mkSlot(sk.id, key, sk, i);
      const s = document.createElement('div');
      s.className = 'slot empty';
      s.dataset.key = key;
      s.title = 'ช่องว่าง — ลากสกิลจากคัมภีร์วิชา (K) มาวาง';
      s.innerHTML = `<span class="key">${key}</span>`;
      dropTo(s, i);
      bar.appendChild(s);
    });
    bar.insertAdjacentHTML('beforeend', '<div class="sep"></div>');
    mkSlot('pot_hp', 'Q', { name: 'ใช้ยาฟื้นพลัง', desc: 'ใช้ยาฟื้นพลังที่ขนาดเล็กที่สุดในกระเป๋า (ไม่มีคูลดาวน์ของตัวเอง)' });
    mkSlot('pot_mp', 'E', { name: 'ใช้ยามานา', desc: 'ใช้ยามานาที่ขนาดเล็กที่สุดในกระเป๋า (ไม่มีคูลดาวน์ของตัวเอง)' });
    placeBar();
    HUD.updatePotionCounts();
  };
  // the Q/E quick-use slots show how many potions of that kind are carried (summed across every stack)
  HUD.updatePotionCounts = function () {
    if (!window.INV || !INV.state) return;
    for (const kind of ['hp', 'mp']) {
      const slot = HUD.slots['pot_' + kind];
      if (!slot) continue;
      let n = 0;
      for (const key of INV.state.inv) { const it = C.ITEMS[key]; if (it && it.kind === kind) n += C.stackCount(key); }
      if (!slot.qty) slot.qty = document.createElement('span'), slot.qty.className = 'qty', slot.el.appendChild(slot.qty);
      slot.qty.textContent = n ? `×${n}` : '';
      slot.el.classList.toggle('nomp', !n);
    }
  };
  // ------------------------------------------------------------ skill bar position (desktop): drag the grip or the frame
  // Remembered in the browser as a fraction of the screen; double-click the grip = back to the bottom centre.
  // Touch screens keep their fixed thumb layout. Slots stop their own pointerdown, so a skill press never drags.
  const SB_KEY = 'skillbarPos';
  const touch = () => document.body.classList.contains('touch');
  const putBar = (x, y) => {
    const bar = $('skillbar'), r = bar.getBoundingClientRect();
    x = Math.max(0, Math.min(innerWidth - r.width, x)); y = Math.max(0, Math.min(innerHeight - r.height, y));
    Object.assign(bar.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, bottom: 'auto', transform: 'none' });
    bar.classList.add('moved');
  };
  function placeBar() {
    const bar = $('skillbar');
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(SB_KEY) || 'null'); } catch (e) { /* storage optional */ }
    if (!pos || touch()) { Object.assign(bar.style, { left: '', top: '', bottom: '', transform: '' }); bar.classList.remove('moved'); return; }
    putBar(pos.x * innerWidth, pos.y * innerHeight);
  }
  HUD.placeBar = placeBar;
  let barDrag = null, lastGrip = 0;
  $('skillbar').addEventListener('pointerdown', (e) => {
    const bar = $('skillbar');
    if (touch() || !(e.target === bar || e.target.closest('.sb-grip'))) return;
    // a double press on the grip puts the bar back (dblclick is unreliable once the pointer is captured)
    if (e.target.closest('.sb-grip')) {
      const t = performance.now();
      if (t - lastGrip < 350) {
        lastGrip = 0; e.preventDefault();
        try { localStorage.removeItem(SB_KEY); } catch (err) { /* storage optional */ }
        return placeBar();
      }
      lastGrip = t;
    }
    const r = bar.getBoundingClientRect();
    barDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    bar.setPointerCapture(e.pointerId); bar.classList.add('dragging'); e.preventDefault(); e.stopPropagation();
  });
  $('skillbar').addEventListener('pointermove', (e) => { if (barDrag) putBar(e.clientX - barDrag.dx, e.clientY - barDrag.dy); });
  const endBarDrag = () => {
    if (!barDrag) return;
    barDrag = null;
    const bar = $('skillbar'), r = bar.getBoundingClientRect();
    bar.classList.remove('dragging');
    try { localStorage.setItem(SB_KEY, JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight })); } catch (e) { /* storage optional */ }
  };
  $('skillbar').addEventListener('pointerup', endBarDrag);
  $('skillbar').addEventListener('pointercancel', endBarDrag);
  addEventListener('resize', () => placeBar());

  let tip;
  function showTip(e, d) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'tooltip'; document.body.appendChild(tip); }
    // skills show their current evolution and the next one
    const skl = window.G && G.skl;
    const rank = d.evo ? C.skillRankOf(skl, d.id) : 0, sl = d.evo && skl ? skl.sk[d.id] || 0 : 0;
    const info = d.evo ? C.skillInfoAt(d, rank) : { name: d.name, desc: d.desc, rank: 0 };
    const next = d.evo && d.evo[rank];
    tip.innerHTML = `<b>${esc(info.name)}</b>${info.rank ? ` <small style="color:#ffd76a">${'★'.repeat(info.rank)}</small>` : ''}${d.lvl ? ` <small>(Lv.${d.lvl})</small>` : ''}` +
      (d.evo ? `<br><small style="color:#9fe89f">${sl ? `สเต็ก ${sl}/${C.SKILL_MAX} · พลัง ×${C.skillPower(sl, rank).toFixed(2)}` : 'ยังไม่ได้เรียน (กด K)'}</small>` : '') +
      `<br>${esc(info.desc)}` +
      `<br><small>คูลดาวน์ ${(d.cd / 1000).toFixed(1)} วิ${d.mp ? ` · ปราณ ${d.evo && window.G && G.stats ? C.skillMp(d, G.stats.lvl) : d.mp}` : ''}${d.evo && d.key !== '1' ? ` · คูลดาวน์ร่วม ${C.GCD_MS / 1000} วิ` : ''}</small>` +
      (next ? `<br><small style="color:#9fd0ff">อัพขั้นถัดไป (Lv.${next.lvl} · สเต็ก ${C.EVO_NEED[rank]}): «${esc(next.name)}»</small>` : '');
    tip.style.display = 'block'; moveTip(e);
  }
  // kept on screen: a long skill text near the bottom bar opens upwards (and scrolls with the wheel, panels.js)
  function moveTip(e) {
    if (!tip) return;
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + 'px';
    tip.style.top = Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, e.clientY - 90)) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  // ------------------------------------------------------------ per-frame
  HUD.setCd = function (id, ms) { HUD.cds[id] = { end: performance.now() + ms, dur: ms }; };
  HUD.cdLeft = function (id) { const c = HUD.cds[id]; return c ? Math.max(0, c.end - performance.now()) : 0; };

  const bars = new Map();
  const setBar = (sel, v, max, label) => {
    let b = bars.get(sel);
    if (!b || !b.root.isConnected) {
      const root = document.querySelector(sel);
      b = { root, fill: root.querySelector('.fill'), text: root.querySelector('span') }; bars.set(sel, b);
    }
    const width = `${max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0}%`;
    if (b.width !== width) { b.fill.style.width = width; b.width = width; }
    if (b.text.textContent !== label) b.text.textContent = label;
  };
  // running buffs (st.bf = [skill id, ms left, duration]) under the player frame: the skill icon, seconds left and
  // a dark sweep for the time already used
  const buffEls = {};
  function updateBuffs(list) {
    const box = $('buffBar');
    if (!box || !HUD.me) return;
    const seen = new Set();
    for (const [id, left, dur] of list || []) {
      seen.add(id);
      let b = buffEls[id];
      if (!b) {
        b = buffEls[id] = document.createElement('div');
        b.className = 'buff';
        b.appendChild(icon(id, HUD.me.faction));
        b.insertAdjacentHTML('beforeend', '<span></span>');
        b.title = C.ALL_SKILLS[id] ? C.ALL_SKILLS[id].name : id;
        box.appendChild(b);
      }
      const txt = String(Math.ceil(left / 1000));
      if (b.lastChild.textContent !== txt) b.lastChild.textContent = txt;
      const used = `${Math.round((1 - left / dur) * 100)}%`;
      if (b.style.getPropertyValue('--used') !== used) b.style.setProperty('--used', used);
    }
    for (const id of Object.keys(buffEls)) if (!seen.has(id)) { buffEls[id].remove(); delete buffEls[id]; }
  }
  // party EXP bonus (st.pexp %, members nearby): a chip at the front of the buff row while it is above 0
  function updatePartyExp(pct) {
    const box = $('buffBar');
    if (!box) return;
    let chip = $('pexpChip');
    if (!pct) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'pexpChip'; chip.className = 'buff-exp';
      box.prepend(chip);
    }
    const txt = `EXP +${pct}%`;
    if (chip.textContent !== txt) {
      chip.textContent = txt;
      chip.title = `บัพ EXP ปาร์ตี้: สมาชิกที่อยู่ใกล้ ${C.partyCountOf(pct)} คน · 2 คน +${C.PARTY_BONUS * 100}% แล้วเพิ่มคนละ +${C.PARTY_BONUS_STEP * 100}%`;
    }
  }
  // ⚔ field PvP switch (button / U): the server owns the state (st.pk) and refuses to switch off mid-fight
  HUD.togglePk = function () {
    const st = window.G && G.stats;
    if (st && G.socket) G.socket.emit('pk', { on: !st.pk });
  };
  const mins = (ms) => (ms >= 3600000 ? `${Math.floor(ms / 3600000)} ชม. ${Math.ceil((ms % 3600000) / 60000)} นาที` : `${Math.max(1, Math.ceil(ms / 60000))} นาที`);
  function updatePk(st) {
    const b = $('pkBtn');
    if (!b) return;
    const on = !!st.pk, ev = st.ev || 0;
    b.classList.toggle('on', on);
    b.classList.toggle('evil', ev < 0);
    const tip = (on ? 'สถานะ PvP: เปิด (คลิก/U เพื่อปิด)' : `สถานะ PvP: ปิด (คลิก/U เพื่อเปิด · ตั้งแต่ Lv.${C.PK.minLvl})`) +
      `\nเปิดแล้วโจมตีผู้เล่นฝ่ายตรงข้ามนอกเขตปลอดภัยได้ · ฆ่าผู้เล่นนอกสนามรบ แต้มชั่วร้าย -${C.PK.evilPerKill}` +
      (ev < 0 ? `\nแต้มชั่วร้าย ${ev} · ฟื้นคืน ${C.PK.evilStep} ในอีก ${mins(st.evIn || 0)}` : '') +
      (st.pkF > 0 ? `\nกำลังต่อสู้กับผู้เล่น (ปิด PvP ได้ในอีก ${Math.ceil(st.pkF / 1000)} วิ)` : '');
    if (b.title !== tip) b.title = tip;
    const ef = $('pfEvil'), txt = ev < 0 ? ` (${ev})` : '';
    if (ef && ef.textContent !== txt) { ef.textContent = txt; ef.title = ev < 0 ? `แต้มชั่วร้าย ${ev} · ฟื้นคืน ${C.PK.evilStep} ทุก 1 ชั่วโมง` : ''; }
    const nm = $('pfNameTxt');
    if (nm) nm.classList.toggle('evil', ev < 0);
  }
  HUD.update = function (st) {
    if (!st) return;
    updatePk(st);
    updateBuffs(st.bf);
    updatePartyExp(st.pexp);
    setBar('#playerFrame .hp', st.hp, st.mhp, `${st.hp} / ${st.mhp}`);
    setBar('#playerFrame .mp', st.mp, st.mmp, `${st.mp} / ${st.mmp}`);
    setBar('#playerFrame .xp', st.exp, st.need, st.lvl >= C.MAX_LVL ? 'MAX' : `${((st.exp / st.need) * 100).toFixed(2)}%`);
    const frame = $('playerFrame'), title = `EXP ${st.exp} / ${st.need} · ATK ${st.atk} · DEF ${st.def} · สังหาร ${st.k} · ตาย ${st.d}`;
    if (frame.title !== title) frame.title = title;
    const level = $('pfLvl'), levelText = String(st.lvl);
    if (level.textContent !== levelText) level.textContent = levelText;
    const now = performance.now();
    const g = HUD.cds.gcd, gLeft = g ? Math.max(0, g.end - now) : 0;
    for (const [id, s] of Object.entries(HUD.slots)) {
      // a skill is usable once learned in the skill book (not just by reaching its level)
      const learned = !s.data.evo || !!(G.skl && G.skl.sk[id]);
      const locked = !learned;
      s.el.classList.toggle('locked', locked);
      const lockTxt = !locked ? '' : st.lvl < s.data.lvl ? `Lv.${s.data.lvl}` : 'ยังไม่เรียน';
      if (s.lock.textContent !== lockTxt) s.lock.textContent = lockTxt;
      // the MP cost grows with the level (C.skillMp): keep the number on the button current
      const mp = s.data.evo ? C.skillMp(s.data, st.lvl) : 0;
      if (mp && s.mpc && s.mpc.textContent !== String(mp)) s.mpc.textContent = mp;
      s.el.classList.toggle('nomp', !locked && mp > st.mp);
      const rank = s.data.evo ? C.skillRankOf(G.skl, id) : 0;          // evolution stars
      if (s.rank !== rank) { s.rank = rank; s.rk.textContent = '★'.repeat(rank); s.el.classList.toggle('evolved', rank > 0); }
      // own cooldown, or the shared skill cooldown when that is longer (not for the basic attack / potions)
      let c = HUD.cds[id];
      let left = c ? Math.max(0, c.end - now) : 0;
      if (s.data.evo && s.data.key !== '1' && gLeft > left) { c = g; left = gLeft; }
      if (left > 0) {
        const pct = (left / c.dur) * 100;
        s.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${pct}%, transparent 0)`;
        const txt = left >= 1000 ? String(Math.ceil(left / 1000)) : c === g ? '' : (left / 1000).toFixed(1);
        if (s.cdt.textContent !== txt) s.cdt.textContent = txt;
      } else if (s.cd.style.background) { s.cd.style.background = ''; s.cdt.textContent = ''; }
    }
  };
  HUD.flashSlot = function (id) {
    const s = HUD.slots[id]; if (!s) return;
    s.el.classList.add('flash'); setTimeout(() => s.el.classList.remove('flash'), 150);
  };

  // ------------------------------------------------------------ messages
  // chat options, remembered in the browser: lowest grade of the own drops logged (-1 = none), clock, chime
  const CHAT_KEY = 'chatOpts';
  const chatOpts = { minGrade: 1, time: true, sound: true };
  try { Object.assign(chatOpts, JSON.parse(localStorage.getItem(CHAT_KEY) || '{}')); } catch (e) { /* storage optional */ }
  const saveChatOpts = () => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(chatOpts)); } catch (e) { /* storage optional */ } };
  // the tabs a line shows under besides "ทั้งหมด" (style.css hides the rest by #chatLog[data-tab])
  const chatCats = (m) => [Number.isInteger(m.g) ? 'item' : m.sys ? 'sys' : '', m.ch === 'f' || m.ch === 'p' ? m.ch : ''].filter(Boolean);
  // a shared item (m.item, checked by the server) takes the place of {i} in the text: grade colour, stats on hover / tap
  const linked = (key, cls) => { const it = C.ITEMS[key]; return it && !it.kind && window.WHO && WHO.asOf ? WHO.asOf(it, cls) : it; };
  function chatText(m) {
    const it = m.item && linked(m.item, m.cls), at = it ? m.t.indexOf('{i}') : -1;
    if (at < 0) return esc(m.t);
    const gr = C.GRADES[it.grade || 0];
    return `${esc(m.t.slice(0, at))}<span class="ilink" data-key="${esc(m.item)}" data-cls="${esc(m.cls || '')}" style="--gc:${gr.color}">[${esc(it.name)}]</span>${esc(m.t.slice(at + 3))}`;
  }
  const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  // m.g = grade of the item a system line announces (drops, enhancement): the line takes the grade colour,
  // the item name m.it is set in bold, Legendary+ glow (style.css .msg.loot) · m.own = own drop, logged from
  // chatOpts.minGrade up · m.big = also the banner in the middle of the screen (HUD.announce)
  HUD.chat = function (m) {
    if (m.own && (chatOpts.minGrade < 0 || (m.g || 0) < chatOpts.minGrade)) return;
    if (m.big) HUD.announce(m);
    const log = $('chatLog');
    const div = document.createElement('div');
    const gr = m.sys && Number.isInteger(m.g) && C.GRADES[m.g];
    div.className = 'msg' + (gr ? ` sys loot g${m.g}` : m.sys ? ' sys' : m.ch === 'f' ? ' fch' : m.ch === 'p' ? ' pch' : '')
      + chatCats(m).map((c) => ` cat-${c}`).join('');
    const ts = `<span class="ts">${clock()}</span>`;
    if (gr) {
      div.style.setProperty('--gc', gr.color);
      const at = m.it ? m.t.indexOf(m.it) : -1;
      div.innerHTML = ts + (at < 0 ? esc(m.t) : `${esc(m.t.slice(0, at))}<b class="it">${esc(m.it)}</b>${esc(m.t.slice(at + m.it.length))}`);
    } else if (m.sys) div.innerHTML = ts + esc(m.t);
    else div.innerHTML = `${ts}${m.ch === 'f' ? '[ฝ่าย] ' : m.ch === 'p' ? '[ปาร์ตี้] ' : ''}<span class="${m.f === 'dharma' ? 'fd' : 'fa'}">${esc(m.n)}</span>: ${chatText(m)}`;
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 24;     // scrolled up to read: don't jump
    log.appendChild(div);
    while (log.children.length > 200) log.firstChild.remove();
    if (atEnd) log.scrollTop = log.scrollHeight;
    const tab = log.dataset.tab;
    if (HUD.chatHidden() && (tab === 'all' || chatCats(m).includes(tab))) { HUD.unread++; showUnread(); }
  };
  // ------------------------------------------------------------ chat tabs + options (⚙)
  {
    const log = $('chatLog'), tabs = $('chatTabs'), opts = $('chatOpts');
    const setTab = (t) => {
      log.dataset.tab = t;
      for (const b of tabs.querySelectorAll('button:not(.ct-opts)')) b.classList.toggle('on', b.dataset.tab === t);
      log.scrollTop = log.scrollHeight;
      try { localStorage.setItem('chatTab', t); } catch (e) { /* storage optional */ }
    };
    let tab = 'all';
    try { const v = localStorage.getItem('chatTab'); if (v && v !== 'opts' && tabs.querySelector(`[data-tab="${v}"]`)) tab = v; } catch (e) { /* storage optional */ }
    setTab(tab);
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.tab !== 'opts') return setTab(b.dataset.tab);
      const open = !opts.classList.toggle('hidden');
      b.classList.toggle('on', open); b.setAttribute('aria-expanded', String(open));
    });
    const sel = $('chatMinGrade');
    sel.innerHTML = '<option value="-1">ไม่แสดง</option>' + C.GRADES.slice(0, 3).map((g, i) => `<option value="${i}">${g.name}</option>`).join('');
    sel.value = String(Math.max(-1, Math.min(2, Math.floor(Number(chatOpts.minGrade)) || 0)));
    sel.title = 'ของที่ได้เองระดับต่ำกว่านี้ไม่ขึ้นแชท (Unique ขึ้นไปประกาศทั้งเซิร์ฟเสมอ)';
    $('chatTime').checked = !!chatOpts.time; $('chatSound').checked = !!chatOpts.sound;
    log.classList.toggle('no-ts', !chatOpts.time);
    opts.addEventListener('change', () => {
      chatOpts.minGrade = +sel.value; chatOpts.time = $('chatTime').checked; chatOpts.sound = $('chatSound').checked;
      log.classList.toggle('no-ts', !chatOpts.time);
      saveChatOpts();
    });
    opts.addEventListener('keydown', (e) => e.stopPropagation());       // the select is not a hotkey
    // a shared item: its stats on hover, or on a tap (touch has no hover)
    const tipOf = (el) => { const it = linked(el.dataset.key, el.dataset.cls); return it && window.INV ? INV.itemTip(it) : ''; };
    log.addEventListener('mouseover', (e) => { const el = e.target.closest('.ilink'), h = el && tipOf(el); if (h) INV.tip.show(e, h); });
    log.addEventListener('mousemove', (e) => { if (e.target.closest('.ilink') && window.INV) INV.tip.move(e); });
    log.addEventListener('mouseout', (e) => { if (e.target.closest('.ilink') && window.INV) INV.tip.hide(); });
    log.addEventListener('click', (e) => {
      const el = e.target.closest('.ilink'), h = el && tipOf(el);
      if (!h) return;
      e.stopPropagation();
      INV.tip.show(e, h);
      setTimeout(() => addEventListener('pointerdown', () => INV.tip.hide(), { once: true }), 0);
    });
  }
  // แชร์ไอเทม (Shift+click in the bag / equipment, or "แชร์ในแชท" in the touch item menu): "[name]" goes into the
  // chat box; sending turns it into {i} + the item key (HUD.takeLink), the server checks the sender has the piece
  let link = null;
  HUD.linkItem = function (key) {
    const it = C.ITEMS[key];
    if (!it || it.kind) return;
    if (HUD.chatHidden()) HUD.setChat(true);
    if (window.G && G.touch) $('chat').classList.add('open');
    const input = $('chatInput'), label = `[${it.name}]`;
    if (link) input.value = input.value.replace(link.label, '').replace(/\s{2,}/g, ' ');   // one item per line
    link = { key, label };
    const v = input.value.trimEnd();
    input.value = `${v}${v ? ' ' : ''}${label} `.slice(0, 140);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };
  // what the chat sends: { text } or { text with {i}, item } while the "[name]" is still in the line
  HUD.takeLink = function (text) {
    const l = link; link = null;
    if (!l || !text.includes(l.label)) return { text };
    return { text: text.replace(l.label, '{i}'), item: l.key };
  };
  // ------------------------------------------------------------ big announcement (m.big): Mythic drops, +10
  let annTimer = 0;
  HUD.announce = function (m) {
    const el = $('announce');
    if (!el) return;
    el.style.setProperty('--gc', Number.isInteger(m.g) ? C.GRADES[m.g].color : '#ffd23a');   // no item: gold (ระดมทุน)
    el.textContent = m.t;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');      // restart the animation
    clearTimeout(annTimer);
    annTimer = setTimeout(() => el.classList.remove('show'), 5000);
    // a short rising arpeggio (sound.js), on the notification volume of ⚙ ตั้งค่า
    if (chatOpts.sound && window.SFX) SFX.play('announce', { mine: true, bus: 'ui' });
  };
  // ------------------------------------------------------------ chat box shown / hidden (button on the box, L key)
  // remembered in the browser; while hidden, new messages are counted on the button
  HUD.unread = 0;
  const showUnread = () => { const u = $('chatUnread'); if (u) u.textContent = HUD.unread ? (HUD.unread > 99 ? '99+' : HUD.unread) : ''; };
  HUD.chatHidden = () => $('chat').classList.contains('collapsed');
  HUD.setChat = function (show) {
    const c = $('chat');
    c.classList.toggle('collapsed', !show);
    $('chatToggle').title = show ? 'ซ่อนแชท (L)' : 'แสดงแชท (L)';
    if (show) { HUD.unread = 0; showUnread(); const log = $('chatLog'); log.scrollTop = log.scrollHeight; }
    else $('chatInput').blur();
    try { localStorage.setItem('chatHidden', show ? '0' : '1'); } catch (e) { /* storage optional */ }
  };
  HUD.toggleChat = () => HUD.setChat(HUD.chatHidden());
  $('chatToggle').addEventListener('click', (e) => { e.stopPropagation(); HUD.toggleChat(); });
  try { if (localStorage.getItem('chatHidden') === '1') HUD.setChat(false); } catch (e) { /* storage optional */ }
  // ------------------------------------------------------------ HUD frames: − / + on each one, remembered in the browser
  // pf = player frame small (default) or full · party = members folded to the title · map = minimap folded to its name
  const LAYOUT_KEY = 'hudLayout';
  HUD.layout = { pf: true, party: false, map: false };       // true = small / folded
  try { Object.assign(HUD.layout, JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')); } catch (e) { /* storage optional */ }
  const FOLD = {                                              // element, class, button tip when folded / when open
    pf: ['playerFrame', 'compact', 'ขยายข้อมูลตัวละคร', 'ย่อข้อมูลตัวละคร'],
    party: ['partyFrame', 'folded', 'แสดงสมาชิกปาร์ตี้', 'ย่อปาร์ตี้'],
    map: ['mmWrap', 'folded', 'แสดงแผนที่ย่อ', 'ซ่อนแผนที่ย่อ (M = แผนที่ใหญ่)'],
  };
  // the party frame sits right under the player frame, whatever its size (compact, buffs, touch scaling)
  function placeParty() {
    const pf = $('playerFrame'), pt = $('partyFrame'), r = pf.getBoundingClientRect();
    if (r.height) pt.style.top = Math.round(r.bottom - $('hud').getBoundingClientRect().top + 8) + 'px';
  }
  HUD.applyLayout = function () {
    for (const [k, [id, cls, openTip, foldTip]] of Object.entries(FOLD)) {
      const el = $(id), b = el.querySelector('.hud-fold');
      el.classList.toggle(cls, !!HUD.layout[k]);
      if (b) b.title = HUD.layout[k] ? openTip : foldTip;
    }
    placeParty();
  };
  HUD.mapFolded = () => !!HUD.layout.map;
  $('hud').addEventListener('click', (e) => {
    const b = e.target.closest('.hud-fold');
    if (!b || !FOLD[b.dataset.fold]) return;
    e.stopPropagation();
    HUD.layout[b.dataset.fold] = !HUD.layout[b.dataset.fold];
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(HUD.layout)); } catch (err) { /* storage optional */ }
    HUD.applyLayout();
  });
  if (window.ResizeObserver) new ResizeObserver(placeParty).observe($('playerFrame'));
  window.addEventListener('resize', placeParty);
  HUD.applyLayout();
  HUD.feed = function (d) {
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.innerHTML = `<span class="${d.kf === 'dharma' ? 'fd' : 'fa'}">${esc(d.k)}</span> ⚔ <span class="${d.vf === 'dharma' ? 'fd' : 'fa'}">${esc(d.v)}</span>`;
    $('feed').prepend(div);
    setTimeout(() => div.remove(), 6000);
    while ($('feed').children.length > 6) $('feed').lastChild.remove();
  };
  HUD.toast = function (text) {
    const div = document.createElement('div');
    div.className = 'toast'; div.textContent = text;
    $('toasts').appendChild(div);
    setTimeout(() => div.remove(), 3000);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  };
  HUD.score = function (s) { $('scD').textContent = s.dharma; $('scA').textContent = s.adharma; };
  // map title above the minimap; the faction scoreboard only matters on the PvP map
  HUD.setMap = function (def) {
    $('mapLabel').textContent = `${def.pvp ? '⚔ ' : ''}${def.name} · ${C.levelText(def)}`;
    $('scoreBoard').classList.toggle('hidden', !def.pvp);
  };
  HUD.online = function (on) { $('onD').textContent = `${on.dharma} ออนไลน์`; $('onA').textContent = `${on.adharma} ออนไลน์`; };

  let zoneTimer;
  HUD.zone = function (name, sub) {
    $('areaLabel').textContent = name;
    const b = $('zoneBanner');
    b.innerHTML = `${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    b.classList.add('show');
    clearTimeout(zoneTimer);
    zoneTimer = setTimeout(() => b.classList.remove('show'), 2200);
  };

  HUD.target = function (e) {
    const tf = $('targetFrame');
    if (!e) { if (!tf.classList.contains('hidden')) tf.classList.add('hidden'); return; }
    if (tf.classList.contains('hidden')) tf.classList.remove('hidden');
    const col = e.kind === 'p' ? C.FACTIONS[e.faction].color : e.boss ? '#ff6a4a' : '#f3efe6';
    const name = $('tfName'), markup = `<span style="color:${col}">${esc(e.name)}</span> <small>Lv.${e.lvl}</small>`;
    // Keep the existing DOM nodes until the displayed identity actually changes.
    if (name._targetMarkup !== markup) { name.innerHTML = markup; name._targetMarkup = markup; }
    setBar('#targetFrame .thp', e.hp, e.mhp, `${e.hp} / ${e.mhp}`);
  };

  // ------------------------------------------------------------ death
  let deathTimer;
  HUD.death = function (by, ms) {
    $('deathScreen').classList.remove('hidden');
    $('dsBy').textContent = `ถูกสังหารโดย ${by}`;
    const btn = $('respawnBtn');
    btn.disabled = true;
    const end = performance.now() + ms;
    clearInterval(deathTimer);
    deathTimer = setInterval(() => {
      const left = Math.ceil((end - performance.now()) / 1000);
      if (left > 0) btn.textContent = `เกิดใหม่ (${left})`;
      else { btn.textContent = G.mapDef && G.mapDef.pvp ? 'เกิดใหม่ที่ฐาน' : 'เกิดใหม่ที่ค่ายพัก'; btn.disabled = false; clearInterval(deathTimer); }
    }, 200);
  };
  HUD.alive = function () { $('deathScreen').classList.add('hidden'); clearInterval(deathTimer); };

  // ------------------------------------------------------------ minimap
  // pvp: enemy players show as faction dots; on hunting maps HUD.mm.a lists everyone on the map
  HUD.drawMinimap = function (base, map, me, ents, view, pvp) {
    if (HUD.layout.map) return;                              // folded: nothing to draw
    const cv = $('minimap'), g = cv.getContext('2d');
    const sx = cv.width / (map.w * C.TILE), sy = cv.height / (map.h * C.TILE);
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, cv.width, cv.height);
    // view rectangle
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.strokeRect(view.x * sx, view.y * sy, view.w * sx, view.h * sy);
    const dot = (x, y, r, col, stroke) => {
      g.fillStyle = col; g.beginPath(); g.arc(x * sx, y * sy, r, 0, TAU); g.fill();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    };
    for (const e of ents.values()) {
      if (e.kind === 'm' && !e.boss) dot(e.x, e.y, 1.3, e.aggro ? '#ffb040' : 'rgba(255,240,200,0.7)');
      else if (pvp && e.kind === 'p' && e !== me && e.faction !== me.faction) dot(e.x, e.y, 2.6, C.FACTIONS[e.faction].color, '#000');
    }
    for (const [id, x, y] of HUD.mm.a)
      if (id !== me.id) dot(x, y, 2.4, PARTY.ids.has(id) ? '#5ab8ff' : pvp ? C.FACTIONS[me.faction].color : '#7cff8a', '#fff');
    const b = HUD.mm.b;
    if (b && b[2]) {
      g.fillStyle = '#ff3a2a'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('☠', b[0] * sx, b[1] * sy);
    }
    // me (arrow)
    g.save(); g.translate(me.x * sx, me.y * sy); g.rotate((me.dir * Math.PI) / 4);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(5, 0); g.lineTo(-3.5, -3.5); g.lineTo(-2, 0); g.lineTo(-3.5, 3.5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };
})();
