// Rounded, hand-painted monster shapes. Coordinates keep the existing feet / hit-box anchors.
(function () {
  const M = window.MonsterArt, TAU = Math.PI * 2;
  const cream = '#fff1d2', ink = '#293441';
  function oval(g, x, y, rx, ry, color, rotation = 0) {
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y, rx, ry, rotation, 0, TAU); g.fill();
  }
  function puff(g, x, y, rx, ry, color, light = 'rgba(255,249,223,.58)') {
    oval(g, x, y, rx, ry, color || '#91b7b0');
    const glow = g.createRadialGradient(x - rx * .35, y - ry * .4, 0, x, y, Math.max(rx, ry) * 1.2);
    glow.addColorStop(0, light); glow.addColorStop(.5, 'rgba(255,255,255,0)');
    glow.addColorStop(1, 'rgba(24,39,55,.32)');
    oval(g, x, y, rx, ry, glow);
  }
  function line(g, points, color, width) {
    g.strokeStyle = color || ink; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(...points[0]);
    if (points.length === 3) g.quadraticCurveTo(...points[1], ...points[2]);
    else for (const point of points.slice(1)) g.lineTo(...point);
    g.stroke();
  }
  function leaf(g, x, y, size, color, flip = 1) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x - size * flip, y - size, x + size * flip, y - size * 1.5);
    g.quadraticCurveTo(x + size * 1.3 * flip, y - size * .2, x, y); g.fill();
    line(g, [[x, y], [x + size * .6 * flip, y - size]], 'rgba(255,255,230,.4)', 1.3);
  }
  function face(g, x, y, size, t, seed, color) {
    const blink = Math.sin(t * 1.15 + seed * 2.7) > .995;
    for (const side of [-1, 1]) {
      const ex = x + side * size * .48;
      oval(g, ex, y, size * .26, size * .34, cream);
      if (blink) line(g, [[ex - size * .19, y], [ex + size * .19, y]], ink, 2);
      else {
        oval(g, ex + size * .035, y, size * .2, size * .29, ink);
        oval(g, ex + size * .07, y + size * .13, size * .12, size * .08, color || '#7797a0');
        oval(g, ex - size * .06, y - size * .12, size * .085, size * .1, '#fff');
      }
      oval(g, x + side * size * .81, y + size * .4, size * .24, size * .12, 'rgba(246,138,151,.65)');
    }
    line(g, [[x - size * .17, y + size * .48], [x, y + size * .67], [x + size * .17, y + size * .48]], ink, 1.3);
  }
  function motion(g, t, s, amount = 2) {
    const step = Math.sin(t * 10 + s.seed);
    const hop = s.moving ? Math.abs(step) * amount : Math.sin(t * 2.8 + s.seed) * .7;
    g.translate((s.atk || 0) * 5, -hop);
    return s.moving ? step : 0;
  }
  function crown(g, x, y, color) {
    g.fillStyle = color || '#edc76e';
    g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x - 15, y - 13); g.lineTo(x - 5, y - 7);
    g.lineTo(x, y - 18); g.lineTo(x + 5, y - 7); g.lineTo(x + 15, y - 13); g.lineTo(x + 12, y); g.closePath(); g.fill();
    puff(g, x, y - 5, 3, 3, '#92d8d3');
  }
  M.wisp = (g, t, s, L) => {
    g.save(); g.translate(0, -26 + Math.sin(t * 3 + s.seed) * 3);
    if (L.veil) for (const k of [-1, 1])
      line(g, [[k * 10, -5], [k * 34, -8], [k * 38, 12 + Math.sin(t * 3 + k) * 6]], L.c2, 5);
    if (L.tail) line(g, [[-8, 8], [-30, 15], [-29, -7]], L.c2, 10);
    puff(g, 0, -2, 21, 22, L.c1);
    for (const k of [-1, 0, 1]) puff(g, k * 12, 14 + Math.sin(t * 4 + k) * 2, 9, 9, L.c1);
    puff(g, -20, 2, 6, 9, L.c1); puff(g, 20, 2, 6, 9, L.c1);
    if (L.horn) for (const k of [-1, 1]) leaf(g, k * 12, -17, 10, L.horn, k);
    else { leaf(g, 0, -22, 9, '#96cda1'); leaf(g, 0, -22, 6, '#b9e3a6', -1); }
    face(g, 1, -4, 13, t, s.seed, L.eye);
    oval(g, -9, -15, 5, 2.5, 'rgba(255,255,255,.7)', -.4);
    g.restore();
  };
  M.boar = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s, 3);
    line(g, [[-21, -19], [-36, -32], [-30, -16]], L.snout, 3);
    for (const [x, k] of [[-16, 1], [-5, -1], [12, -1], [23, 1]])
      puff(g, x, -5 - step * k * 2, 6, 7, L.leg || L.mane);
    puff(g, -3, -23, 28, 21, L.body);
    if (L.armor) for (let i = 0; i < 3; i++) puff(g, -18 + i * 10, -36, 9, 7, L.armor);
    else for (let i = 0; i < 3; i++) puff(g, -13 + i * 7, -40, 5, 5, L.back);
    puff(g, 18, -25, 21, 20, L.head);
    for (const x of [6, 29]) {
      puff(g, x, -43, 7, L.ear === 'round' ? 7 : 10, L.back);
      oval(g, x, -43, 3.5, 5, '#e9adad');
    }
    face(g, 20, -29, 12, t, s.seed, '#b88d60');
    puff(g, 25, -17, 12, 8, L.snout);
    for (const x of [21, 29]) oval(g, x, -17, 1.7, 2.3, '#704b54');
    if (L.tusk !== false) for (const x of [14, 35]) puff(g, x, -13, 2.5, 5, cream);
    g.restore();
  };
  M.wolf = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s, 3);
    line(g, [[-18, -19], [-43, -21], [-34, -40 + Math.sin(t * 3) * 4]], L.top, 13);
    puff(g, -35, -38 + Math.sin(t * 3) * 4, 6, 7, cream);
    for (const [x, k] of [[-17, 1], [-7, -1], [12, -1], [23, 1]])
      puff(g, x, -6 - step * k * 2, 6, 7, L.bottom);
    puff(g, -3, -23, 26, 17, L.top);
    puff(g, 13, -23, 12, 16, L.bottom);
    for (const x of [5, 29]) {
      leaf(g, x, -37, 12, L.top, x < 10 ? -1 : 1);
      leaf(g, x, -39, 7, '#e6b0b7', x < 10 ? -1 : 1);
    }
    puff(g, 18, -34, 22, 19, L.top);
    puff(g, 21, -23, 14, 9, cream);
    face(g, 20, -34, 13, t, s.seed, L.eye);
    oval(g, 22, -24, 3, 2, L.dark);
    if (L.stripes || L.spots) for (const x of [-17, -7, 3])
      oval(g, x, -30, 2, L.stripes ? 7 : 2.5, L.stripes || L.spots, -.3);
    g.restore();
  };
  M.golem = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s);
    for (const k of [-1, 1]) {
      puff(g, k * 13, -8 - step * k * 2, 12, 10, L.leg);
      puff(g, k * 28, -32 + step * k * 3, 12, 17, L.limb);
    }
    puff(g, 0, -35, 27, 25, L.rock);
    puff(g, 0, -60, 25, 22, L.head);
    face(g, 1, -59, 15, t, s.seed, L.eye);
    puff(g, -10, -79, 12, 5, L.moss);
    leaf(g, -8, -80, 9, '#a7cf89');
    puff(g, 0, -28, 7, 7, L.eye);
    line(g, [[-17, -37], [-12, -33], [-16, -27]], 'rgba(41,52,65,.3)', 2);
    g.restore();
  };
  M.serpent = (g, t, s, L) => {
    g.save(); motion(g, t, s, 1);
    line(g, [[-4, -8], [-40, 1], [-33, -13 + Math.sin(t * 4) * 4]], L.body, 11);
    puff(g, 0, -9, 26, 10, L.body);
    puff(g, 1, -17, 19, 9, L.belly);
    if (L.hood) puff(g, 6, -31, 26, 21, L.mark);
    puff(g, 8, -29, 16, 20, L.body);
    puff(g, 10, -38, 23, 16, L.body);
    puff(g, 13, -30, 16, 6, L.belly);
    face(g, 13, -40, 12, t, s.seed, L.eye);
    if (L.horn) crown(g, 7, -52, L.horn);
    else for (const x of [-4, 3, 10]) oval(g, x, -50, 2, 2, L.mark);
    g.restore();
  };
  M.insect = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s);
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++)
      line(g, [[k * 10, -20], [k * (26 + i * 2), -23 + i * 6], [k * (27 + i * 2), -2 - Math.abs(step + i) * 2]], L.leg, 4);
    if (L.kind === 'scorpion') {
      line(g, [[-14, -23], [-36, -57], [-12, -48]], L.dark, 7);
      puff(g, -11, -47, 6, 5, L.sting);
      for (const k of [-1, 1]) puff(g, k * 26, -26, 8, 6, L.shell);
    } else for (const k of [-1, 1])
      line(g, [[k * 7, -30], [k * 10, -42], [k * 17, -40]], L.leg, 2.5);
    puff(g, -3, -22, 23, 18, L.shell);
    for (const x of [-13, 0, 13]) puff(g, x, -29, 3.5, 3, L.sting || '#d6b4eb');
    puff(g, 3, -14, 18, 13, L.dark);
    face(g, 4, -17, 11, t, s.seed, '#b9a0de');
    g.restore();
  };
  M.bird = (g, t, s, L) => {
    g.save(); motion(g, t, s, 4);
    for (const k of [-1, 1]) {
      line(g, [[k * 8, -14], [k * 9, -3], [k * 15, -2]], L.beak, 4);
      puff(g, k * 20, -29 + Math.sin(t * 5 + s.seed) * 4, 10, 18, L.wing);
    }
    puff(g, 0, -29, 21, 24, L.body);
    puff(g, 1, -24, 14, 15, cream);
    puff(g, 1, -48, 21, 19, L.body);
    for (const k of [-1, 0, 1]) leaf(g, k * 5, -61, 8, L.crest, k || 1);
    face(g, 2, -49, 13, t, s.seed, L.eye);
    puff(g, 3, -39, 6, 4, L.beak);
    g.restore();
  };
  M.human = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s);
    if (L.ghost) g.globalAlpha *= .85;
    if (L.cape) puff(g, -8, -28, 22, 26, L.cape);
    for (const k of [-1, 1]) puff(g, k * 9, -5 - step * k * 2, 7, 6, L.robe2);
    puff(g, 0, -27, 19, 25, L.robe);
    puff(g, -20, -30 + step * 2, 7, 12, L.robe2);
    line(g, [[-14, -20], [14, -20]], L.trim, 5);
    line(g, [[-8, -44], [1, -31], [9, -44]], L.trim, 3);
    puff(g, 0, -57, 23, 21, L.headless ? '#a7dce5' : L.hair);
    puff(g, 2, -53, 20, 17, L.headless ? '#d5f2ec' : L.skin);
    face(g, 3, -54, 13, t, s.seed, L.eye);
    if (L.headless) leaf(g, 0, -71, 13, '#8edee6');
    else if (L.hat === 'straw') {
      puff(g, 0, -70, 30, 6, '#d9b979'); puff(g, 0, -75, 18, 9, '#efd69a');
      line(g, [[-15, -73], [15, -73]], '#b39363', 2);
    } else if (L.hat === 'helm' || L.hat === 'hood') {
      puff(g, -1, -70, 23, 10, L.hat === 'helm' ? L.trim : L.robe2);
      if (L.hat === 'helm') leaf(g, 0, -78, 10, L.wcol);
    } else if (L.hat === 'crown') crown(g, 0, -72, L.trim);
    else if (L.hat === 'bald') {
      puff(g, 0, -69, 18, 9, L.skin);
      for (const x of [-5, 0, 5]) oval(g, x, -72, 1, 1, '#bd9173');
    }
    g.save(); g.translate(23, -29); g.rotate(-.15 - (s.atk || 0) * 1.5);
    line(g, [[0, 18], [0, -27]], '#96785d', 4);
    if (L.weapon === 'staff') { puff(g, 0, -30, 7, 7, L.wcol); puff(g, -2, -32, 2, 2, '#fff'); }
    else if (L.weapon === 'spear') leaf(g, 0, -24, 10, L.wcol);
    else { puff(g, 0, -20, 5, 18, L.wcol); line(g, [[-7, -6], [7, -6]], L.trim, 4); }
    puff(g, 0, 0, 5, 5, L.skin);
    g.restore(); g.restore();
  };
  M.plant = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s, 4);
    for (const k of [-1, 1]) puff(g, k * 10, -5 - step * k * 2, 8, 6, L.bark);
    puff(g, 0, -27, 20, 26, L.bark);
    for (const k of [-1, 1]) puff(g, k * 22, -25 + Math.sin(t * 3 + k) * 3, 7, 11, L.bark);
    if (L.kind === 'mush') {
      puff(g, 0, -43, 32, 9, '#d4b1ac');
      puff(g, 0, -51, 32, 21, L.cap);
      puff(g, 0, -41, 32, 6, L.cap);
      for (const [x, y, rx, ry] of [[-17, -53, 6, 4], [0, -62, 7, 4], [18, -51, 5, 4], [2, -47, 4, 3]])
        puff(g, x, y, rx, ry, L.spot);
    } else {
      for (const [x, y, r] of [[-19, -53, 16], [18, -55, 17], [0, -64, 21]])
        puff(g, x, y, r, r * .8, x ? L.leaf : L.leaf2);
      leaf(g, 0, -78, 11, '#b4d99a');
      puff(g, 17, -65, 4, 4, '#efb5bc');
    }
    face(g, 1, -28, 13, t, s.seed, L.eye);
    g.restore();
  };
  M.dragon = (g, t, s, L) => {
    g.save(); const step = motion(g, t, s, 3);
    line(g, [[-15, -22], [-58, -4], [-54, -35 + Math.sin(t * 3) * 5]], L.body, 15);
    leaf(g, -54, -31 + Math.sin(t * 3) * 5, 11, L.horn, -1);
    for (const k of [-1, 1]) {
      g.save(); g.translate(k * 17, -47); g.scale(k, 1); g.rotate(Math.sin(t * 4) * .2);
      g.fillStyle = L.wing; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(15, -40, 31, -34);
      g.lineTo(30, -6); g.quadraticCurveTo(16, -17, 10, 7); g.closePath(); g.fill();
      line(g, [[0, 0], [15, -20], [31, -34]], L.horn, 2); g.restore();
      puff(g, k * 16, -7 - step * k * 2, 12, 9, L.body);
    }
    puff(g, 0, -32, 29, 29, L.body); puff(g, 4, -29, 18, 22, L.belly);
    for (const k of [-1, 1]) leaf(g, k * 17, -74, 14, L.horn, k);
    puff(g, 3, -65, 30, 25, L.body);
    puff(g, 9, -50, 21, 10, L.belly);
    face(g, 7, -65, 18, t, s.seed, L.eye);
    for (const x of [3, 15]) oval(g, x, -52, 1.8, 1.5, '#63817f');
    puff(g, -24, -31, 8, 12, L.body); puff(g, 26, -30, 8, 12, L.body);
    g.restore();
  };
  M.demon = (g, t, s, look) => {
    const L = look || { leg: '#766080', cape: '#855e83', t1: '#b77e9b', t2: '#795879', belt: '#5e536a',
      gem: '#96e3d5', plate: '#9e83ac', horn: '#f6dba3', skin: '#d3a4ad', eye: '#8edccf', blade: '#c9dce6' };
    g.save(); const step = motion(g, t, s, 2); g.scale(1.5, 1.5);
    puff(g, -4, -42, 36, 42, L.cape);
    for (const k of [-1, 1]) {
      puff(g, k * 16, -7 - step * k, 13, 9, L.leg);
      puff(g, k * 32, -42, 13, 19, L.plate);
      leaf(g, k * 22, -94, 17, L.horn, k);
    }
    puff(g, 0, -43, 29, 32, L.t1);
    puff(g, 0, -43, 19, 22, L.t2);
    line(g, [[-23, -23], [23, -23]], L.belt, 7);
    puff(g, 0, -25, 6, 6, L.gem);
    puff(g, 0, -80, 32, 27, L.skin);
    puff(g, -24, -85, 7, 11, L.plate); puff(g, 24, -85, 7, 11, L.plate);
    face(g, 1, -80, 19, t, s.seed, L.eye);
    crown(g, 0, -103, L.horn);
    for (const k of [-1, 1]) puff(g, k * 11, -65, 2.5, 4, cream);
    g.save(); g.translate(40, -39); g.rotate(-(s.atk || 0) * 1.3);
    line(g, [[0, 25], [0, -34]], L.belt, 5);
    puff(g, 0, -39, 8, 23, L.blade);
    line(g, [[-12, -17], [12, -17]], L.horn, 5);
    puff(g, 0, 0, 7, 7, L.skin); g.restore();
    g.restore();
  };
})();
