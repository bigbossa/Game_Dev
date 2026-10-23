// Sword-and-shield skill art. Each silhouette describes the skill, even without a key label.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const ids = ['guardSlash', 'shieldBash', 'ironGuard', 'shieldSweep', 'battleCry',
    'sunderStrike', 'rallyGuard', 'earthShatter', 'lastBastion', 'guardianOath', 'citadelStrike'];

  function draw(g, sk, faction, size = 112) {
    const id = typeof sk === 'string' ? sk : sk?.id;
    const dark = faction === 'adharma';
    const p = dark
      ? { core: '#fff1da', light: '#ffc5bf', glow: '#ff667d', deep: '#641f36', cloth: '#8d2944', gold: '#e8ba78', edge: '#301c2d' }
      : { core: '#f0fcff', light: '#b9f0ff', glow: '#55cce9', deep: '#164a69', cloth: '#236582', gold: '#eac783', edge: '#112c41' };
    g.save();
    g.setTransform(size / 112, 0, 0, size / 112, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.shadowBlur = 0; g.setLineDash([]); g.lineCap = 'round'; g.lineJoin = 'round';
    const bg = g.createRadialGradient(52, 44, 5, 56, 56, 74);
    bg.addColorStop(0, p.deep); bg.addColorStop(.72, '#141b29'); bg.addColorStop(1, '#090d15');
    g.fillStyle = bg; g.fillRect(0, 0, 112, 112);
    g.translate(56, 56);

    const at = (x, y, rotation, scale, fn) => {
      g.save(); g.translate(x, y); g.rotate(rotation); g.scale(scale, scale); fn(); g.restore();
    };
    const path = (pts, fill, edge, width = 1.5) => {
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (edge) { g.strokeStyle = edge; g.lineWidth = width; g.stroke(); }
    };
    const line = (pts, color, width = 2) => {
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.strokeStyle = color; g.lineWidth = width; g.stroke();
    };
    const circle = (x, y, r, fill, edge, width = 1.5) => {
      g.beginPath(); g.arc(x, y, r, 0, TAU);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (edge) { g.strokeStyle = edge; g.lineWidth = width; g.stroke(); }
    };
    const ellipse = (x, y, rx, ry, color, width = 2) => {
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.strokeStyle = color; g.lineWidth = width; g.stroke();
    };
    const glow = (color, blur, fn) => { g.save(); g.shadowColor = color; g.shadowBlur = blur; fn(); g.restore(); };
    const haze = (x, y, r, color, alpha = .4) => {
      const fill = g.createRadialGradient(x, y, 1, x, y, r);
      fill.addColorStop(0, color); fill.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.globalAlpha = alpha; circle(x, y, r, fill); g.restore();
    };
    const star = (x, y, r, color = p.core, count = 4) => {
      const pts = [];
      for (let i = 0; i < count * 2; i++) {
        const a = i * Math.PI / count, radius = i % 2 ? r * .24 : r;
        pts.push([x + Math.sin(a) * radius, y - Math.cos(a) * radius]);
      }
      glow(p.glow, 9, () => path(pts, color));
    };
    const metal = (x0 = -14, x1 = 14) => {
      const fill = g.createLinearGradient(x0, 0, x1, 0);
      fill.addColorStop(0, '#68768d'); fill.addColorStop(.45, '#ecf5fa');
      fill.addColorStop(.53, '#ffffff'); fill.addColorStop(1, '#7889a3'); return fill;
    };
    const sword = (x, y, rotation, scale = 1) => at(x, y, rotation, scale, () => {
      path([[-5, 15], [-6, -30], [-1, -50], [7, -37], [6, 15]], metal(-7, 7), p.edge, 1.6);
      line([[-1, -42], [-1, 14]], '#f6fdff', 1);
      path([[-15, 14], [-10, 11], [-5, 14], [6, 14], [11, 11], [15, 14], [12, 19], [-12, 19]], p.gold, p.edge);
      path([[-4, 19], [4, 19], [3, 34], [-3, 34]], p.cloth, p.gold, 1.2);
      for (const y of [23, 28]) line([[-3, y], [3, y - 2]], p.light, 1);
      circle(0, 35, 4, p.gold, p.edge, 1);
    });
    const shield = (x, y, rotation = 0, scale = 1, crest = true) => at(x, y, rotation, scale, () => {
      const fill = g.createLinearGradient(-24, -30, 24, 28);
      fill.addColorStop(0, p.light); fill.addColorStop(.12, p.cloth); fill.addColorStop(1, p.edge);
      path([[-26, -27], [0, -37], [26, -27], [22, 12], [0, 35], [-22, 12]], p.gold, p.edge, 2.5);
      path([[-21, -23], [0, -31], [21, -23], [17, 9], [0, 28], [-17, 9]], fill, p.light, 1.3);
      path([[-18, -21], [0, -28], [0, 24], [-14, 7]], 'rgba(255,255,255,.08)');
      if (crest) {
        path([[0, -18], [9, -7], [7, 6], [0, 15], [-7, 6], [-9, -7]], p.gold, p.edge, 1);
        path([[0, -11], [4, -5], [0, 3], [-4, -5]], p.core);
        line([[0, 3], [0, 10]], p.edge, 1.5);
      }
      for (const side of [-1, 1]) for (const y of [-19, -4, 8]) circle(side * 18, y, 1.4, p.gold);
    });
    const slash = (rotation, scale = 1) => at(0, 0, rotation, scale, () => {
      glow(p.glow, 10, () => {
        g.beginPath(); g.moveTo(-42, 25); g.bezierCurveTo(-14, -37, 28, -46, 45, -18);
        g.bezierCurveTo(21, -35, -12, -13, -42, 25); g.fillStyle = p.glow; g.fill();
      });
      g.beginPath(); g.moveTo(-39, 22); g.bezierCurveTo(-9, -32, 25, -39, 42, -19);
      g.strokeStyle = p.core; g.lineWidth = 2; g.stroke();
    });
    const tower = (x, y, width, height) => {
      path([[x - width, y], [x - width, y - height], [x - width * .55, y - height],
        [x - width * .55, y - height + 7], [x, y - height + 7], [x, y - height],
        [x + width * .5, y - height], [x + width * .5, y - height + 7],
        [x + width, y - height + 7], [x + width, y]], p.cloth, p.gold, 2);
      line([[x - width + 3, y - 9], [x + width - 3, y - 9]], p.light, 1);
      line([[x - width + 3, y - 19], [x + width - 3, y - 19]], p.light, 1);
      line([[x, y - height + 15], [x, y - height + 22]], p.edge, 4);
    };
    const rock = (x, y, radius, rotation = 0) => at(x, y, rotation, 1, () => {
      path([[-radius, 0], [-radius * .3, -radius], [radius, -radius * .3], [radius * .5, radius * .7], [-radius * .6, radius * .5]], '#8c8791', '#c2b9b1', 1);
      line([[-radius * .3, -radius], [0, 0], [radius * .5, radius * .7]], '#59566b', 1);
    });

    switch (id) {
      case 'guardSlash':
        haze(5, -4, 44, p.glow); slash(.12);
        shield(-23, 15, -.15, .48);
        sword(6, 2, .66, 1.02); star(33, -35, 8);
        break;

      case 'shieldBash':
        for (const [y, width] of [[-21, 22], [-3, 29], [15, 18]]) line([[-47, y], [-47 + width, y]], p.glow, 3);
        haze(29, 1, 27, p.glow, .8);
        star(30, 0, 24, p.gold, 6);
        shield(-7, 1, -.2, .95);
        for (const [x, y] of [[34, -24], [44, -10], [40, 23]]) line([[x, y], [x + 5, y * 1.2]], p.core, 2);
        break;

      case 'ironGuard':
        glow(p.glow, 12, () => {
          path([[-37, -29], [0, -46], [37, -29], [34, 20], [0, 46], [-34, 20]], 'rgba(97,187,215,.08)', p.glow, 2);
        });
        for (const side of [-1, 1]) {
          line([[side * 43, -16], [side * 33, -4], [side * 45, 7]], p.gold, 2.5);
          star(side * 33, -4, 5);
        }
        shield(0, 1, 0, 1.04);
        line([[-9, -28], [9, -28]], p.core, 2);
        break;

      case 'shieldSweep':
        haze(0, 8, 44, p.glow);
        g.save(); g.globalAlpha = .3; slash(-.8, 1.1); g.restore();
        slash(2.3, 1.05);
        sword(1, -4, 1.12, .95);
        for (const [x, y] of [[-32, 22], [-5, 36], [28, 29]]) star(x, y, 5, p.gold);
        break;

      case 'battleCry':
        for (const side of [-1, 1]) for (const radius of [34, 44]) {
          g.beginPath(); g.arc(0, 0, radius, side < 0 ? 2.64 : -.5, side < 0 ? 3.64 : .5);
          glow(p.glow, 8, () => { g.strokeStyle = p.glow; g.lineWidth = 3; g.stroke(); });
        }
        path([[-22, -24], [-11, -37], [0, -30], [12, -37], [23, -24], [32, -10], [25, 4], [30, 19], [13, 28], [0, 40], [-14, 28], [-30, 19], [-25, 4], [-32, -10]], p.gold, p.edge, 2);
        path([[-18, -19], [-8, -24], [0, -17], [9, -24], [19, -19], [22, 4], [13, 21], [0, 29], [-13, 21], [-22, 4]], p.cloth, p.light, 1.5);
        for (const side of [-1, 1]) {
          line([[side * 4, -7], [side * 15, -12]], p.core, 3);
          path([[side * 3, 10], [side * 12, 9], [side * 8, 19]], p.core);
          line([[side * 15, 3], [side * 24, -1]], p.gold, 2);
        }
        path([[-5, -1], [5, -1], [0, 5]], p.gold);
        path([[-5, 11], [5, 11], [6, 22], [0, 26], [-6, 22]], '#121521', p.gold, 1);
        break;

      case 'sunderStrike':
        at(-7, 0, -.12, 1, () => {
          path([[-9, -31], [-25, -27], [-31, -9], [-23, -4], [-22, 22], [-5, 35], [-10, 13], [-1, 4], [-12, -9], [-4, -17]], metal(-28, 0), p.edge, 2);
          path([[9, -31], [25, -27], [31, -9], [23, -4], [22, 22], [6, 35], [2, 14], [11, 5], [0, -8], [8, -17]], metal(0, 28), p.edge, 2);
          glow(p.glow, 10, () => line([[0, -29], [-5, -17], [2, -9], [-5, 3], [5, 14], [1, 31]], p.glow, 3));
        });
        sword(11, 5, .67, .97);
        star(-3, -2, 10); rock(-36, 22, 5, .3); rock(35, 25, 4, -.5);
        break;

      case 'rallyGuard':
        glow(p.glow, 12, () => {
          g.beginPath(); g.arc(0, 9, 43, Math.PI, TAU); g.strokeStyle = p.glow; g.lineWidth = 2.5; g.stroke();
          ellipse(0, 28, 43, 12, p.glow, 2);
        });
        shield(-27, 6, -.2, .61); shield(27, 6, .2, .61);
        shield(0, 12, 0, .9); star(0, -32, 8, p.gold);
        break;

      case 'earthShatter':
        haze(0, 25, 41, p.glow, .7);
        ellipse(0, 25, 43, 15, p.glow, 2.5);
        for (const angle of [0, .8, 1.7, 2.5, 3.2, 4.1, 5.3]) {
          const x = Math.cos(angle), y = Math.sin(angle);
          const pts = [[0, 23], [x * 17, 23 + y * 9], [x * 22 - y * 5, 23 + y * 12], [x * 43, 23 + y * 22]];
          line(pts, p.edge, 4); line(pts, p.gold, 1.5);
        }
        line([[-7, -43], [-7, -26]], p.glow, 3); line([[7, -47], [7, -30]], p.light, 2);
        shield(0, -6, -.1, .82); star(0, 24, 13);
        rock(-34, 0, 7, -.2); rock(30, -7, 6, .4); rock(-22, -31, 4); rock(38, 17, 4);
        break;

      case 'lastBastion':
        haze(0, -8, 45, p.glow, .5);
        glow(p.glow, 9, () => {
          g.beginPath(); g.arc(0, 9, 44, Math.PI, TAU); g.strokeStyle = p.light; g.lineWidth = 3; g.stroke();
        });
        tower(-25, 29, 12, 48); tower(25, 29, 12, 48); tower(0, 29, 15, 66);
        path([[-18, 32], [-18, 5], [18, 5], [18, 32]], p.edge, p.gold, 2);
        shield(0, 23, 0, .48);
        line([[-43, 36], [43, 36]], p.gold, 3); star(0, -43, 7);
        break;

      case 'guardianOath':
        glow(p.gold, 12, () => circle(0, -2, 39, undefined, p.gold, 2));
        circle(0, -2, 32, undefined, p.glow, 1.5);
        for (let i = 0; i < 8; i++) at(0, -2, i * TAU / 8, 1, () => line([[0, -39], [0, -44]], p.light, 2));
        path([[-17, -31], [17, -31], [17, 20], [0, 29], [-17, 20]], '#e7cc96', p.edge, 2);
        line([[-21, -31], [21, -31]], p.gold, 6);
        line([[-20, -32], [20, -32]], p.core, 1.5);
        shield(0, -1, 0, .45);
        for (const side of [-1, 1]) {
          circle(side * 28, 24, 4, p.core);
          path([[side * 28 - 7, 40], [side * 28 - 5, 30], [side * 28 + 5, 30], [side * 28 + 7, 40]], p.cloth, p.gold, 1.5);
        }
        glow(p.glow, 8, () => line([[-25, 23], [0, 33], [25, 23]], p.glow, 2));
        star(0, -1, 7, p.core);
        break;

      case 'citadelStrike':
        haze(0, 6, 47, p.glow, .7);
        for (const side of [-1, 1]) {
          path([[side * 10, -41], [side * 19, -32], [side * 25, -43], [side * 29, -30], [side * 36, -39], [side * 31, -21], [side * 14, -17]], p.gold, p.edge, 1.3);
          line([[side * 30, -12], [side * 23, 4]], p.glow, 3);
          line([[side * 42, -5], [side * 28, 20]], p.light, 1.5);
        }
        ellipse(0, -29, 24, 8, p.gold, 2);
        tower(-27, 35, 10, 21); tower(27, 35, 10, 21);
        glow(p.glow, 13, () => sword(0, -10, Math.PI, 1.08));
        ellipse(0, 36, 44, 10, p.glow, 3);
        star(0, 38, 16, p.core, 6);
        line([[-17, 40], [-29, 47]], p.gold, 2); line([[17, 40], [29, 47]], p.gold, 2);
        break;

      default:
        shield(0, 0);
    }

    // Fine inset edge matches the game's framed skill bar, without baking in hotkey text.
    g.shadowBlur = 0; g.strokeStyle = 'rgba(231,207,155,.22)'; g.lineWidth = 1;
    g.strokeRect(-54.5, -54.5, 109, 109);
    g.restore();
    return ids.includes(id);
  }
  window.WarriorIcons = Object.freeze({ draw, ids: Object.freeze(ids) });
})();
