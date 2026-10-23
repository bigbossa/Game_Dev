// Lv.100-130 class auras for ดาบคู่ / ธนู / ทวน (นักพรต keeps its own). Imposing, yet they never cover the character:
// everything is drawn on the ground (A.ground) or BEHIND the sprite (A.back, main.js draws the sprite over it),
// so no part of it can sit on the face or the body. Three steps: Lv.100, Lv.120 (more layers), Lv.130 (full regalia).
//   ดาบคู่  เทพกระบี่    a wheel of swords turning behind the back, a counter ring, crescent sword-qi wings and a pillar
//   ธนู    ราชินีดารา   a great crescent moon with a twinkling constellation, a fan of celestial arrows, phoenix tail
//   ทวน   จอมทัพมังกร  a spirit dragon coiled behind the body, a fan of war spears with embers, twin dragons with fire manes
(function () {
  const A = window.ClassAura = {}, TAU = Math.PI * 2;
  const stepOf = (lvl) => (lvl >= 130 ? 3 : lvl >= 120 ? 2 : lvl >= 100 ? 1 : 0);
  // faction tints within each class identity (ธรรมะ light / อธรรม dark-red)
  const PAL = {
    warrior: { dharma:{main:'#91d9ee',hi:'#fff9dc',deep:'#23465c',gold:'#eac77c'},adharma:{main:'#eb536e',hi:'#ffe0c6',deep:'#35142b',gold:'#c58f68'} },
    dualblade: { dharma: { main: '#7cc8ff', hi: '#f2fbff', deep: '#1d4f86', gold: '#ffe39a' }, adharma: { main: '#ff4a62', hi: '#ffd6dc', deep: '#4a0a18', gold: '#ffb070' } },
    archer: { dharma: { main: '#7cf0a8', hi: '#f6ffe8', deep: '#1f5a3c', gold: '#ffe08a' }, adharma: { main: '#bf304c', hi: '#e98290', deep: '#240b14', gold: '#b97375' } },
    spearman: { dharma: { main: '#ffd76a', hi: '#fffbe6', deep: '#6a4a14', gold: '#7cc8ff' }, adharma: { main: '#ff5a3a', hi: '#ffe0c8', deep: '#4a0a0a', gold: '#ffb040' } },
  };
  A.step = (e) => (e && !e.dead && PAL[e.cls] ? stepOf(e.lvl || 1) : 0);
  const palOf = (e) => PAL[e.cls][e.faction === 'adharma' ? 'adharma' : 'dharma'];
  const seedOf = (e) => ((e.x || 0) * 0.013 + (e.y || 0) * 0.007) % TAU;

  const line = (g, pts, col, w) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  const poly = (g, pts, col) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = col; g.fill(); };
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00');
    g.save(); g.globalAlpha *= a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }
  // a sword along +x from the hilt at (0, 0)
  function sword(g, L, P, w = 1) {
    poly(g, [[L * .22, -2.2 * w], [L, 0], [L * .22, 2.2 * w]], P.hi);
    line(g, [[L * .24, 0], [L * .92, 0]], P.main, .8 * w);
    line(g, [[L * .2, -4.5 * w], [L * .2, 4.5 * w]], P.gold, 1.6 * w);
    line(g, [[0, 0], [L * .2, 0]], P.deep, 2 * w);
  }
  function star(g, x, y, r, col) {
    const k = r * .22; poly(g, [[x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k], [x, y - r], [x + k, y - k]], col);
  }
  function arrow(g, L, P) {                                     // an arrow along -y from (0, 0)
    line(g, [[0, 0], [0, -L]], P.hi, 1.3);
    poly(g, [[0, -L - 7], [-3, -L + 1], [3, -L + 1]], P.gold);
    for (const s of [-1, 1]) poly(g, [[0, -4], [s * 4, 0], [s * 3, 6], [0, 2]], P.main);
  }
  function feather(g, L, W, P, a) {                            // a long tail feather along +y
    g.save(); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, P.main + 'cc'); gr.addColorStop(.7, P.gold + '99'); gr.addColorStop(1, P.hi + '00');
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(W, L * .45, 0, L); g.quadraticCurveTo(-W, L * .45, 0, 0); g.fillStyle = gr; g.fill();
    line(g, [[0, 2], [0, L * .9]], P.hi + '99', .8); g.restore();
  }

  // ---------------------------------------------------------------- behind the sprite
  // x, y = the feet (pose already applied); B = the body height in world px
  const BACK = {
    warrior(g,e,x,y,t,B,n,P){
      const count=1+n*2,R=B*(.5+n*.06),cy=y-B*.57;
      glow(g,x,cy,R*1.2,P.main,.18+n*.04);
      for(let i=0;i<count;i++){
        const a=Math.PI+(i/(count-1))*Math.PI,px=x+Math.cos(a)*R,py=cy+Math.sin(a)*R*.8;
        g.save();g.globalAlpha=.28+n*.07;g.translate(px,py);g.rotate((a-Math.PI*1.5)*.25);
        WarriorLook.shield(g,0,0,B*.0028,WarriorLook.palette(e.faction),n+3);g.restore();
      }
      if(n>=2){g.strokeStyle=P.gold;g.lineWidth=1;g.beginPath();g.ellipse(x,cy,R,R*.82,0,0,TAU);g.stroke();}
    },
    dualblade(g, e, x, y, t, B, n, P) {
      const cx = x, cy = y - B * .6, R = B * .62;
      glow(g, cx, cy, R * 1.25, P.main, .35 + .1 * n);
      if (n >= 3) {                                             // a pillar of sword light rising behind
        const gr = g.createLinearGradient(0, cy - B * 1.4, 0, y); gr.addColorStop(0, P.main + '00'); gr.addColorStop(.6, P.main + '55'); gr.addColorStop(1, P.hi + '00');
        g.fillStyle = gr; g.fillRect(cx - B * .12, cy - B * 1.4, B * .24, y - cy + B * 1.4);
        for (const s of [-1, 1]) {                              // crescent sword-qi wings
          const pulse = .85 + .15 * Math.sin(t * 2.2 + s);
          g.save(); g.translate(cx + s * B * .18, cy - B * .05); g.scale(s, 1);
          g.beginPath(); g.arc(-B * .1, 0, B * .62 * pulse, -1.15, .95); g.arc(-B * .26, -B * .02, B * .5 * pulse, .95, -1.15, true); g.closePath();
          const cg = g.createLinearGradient(0, -B * .6, B * .6, B * .4); cg.addColorStop(0, P.hi + 'dd'); cg.addColorStop(1, P.main + '22');
          g.fillStyle = cg; g.fill(); g.restore();
        }
      }
      // the sword wheel (and from Lv.120 a smaller one turning the other way)
      for (let k = 0; k < (n >= 2 ? 2 : 1); k++) {
        const count = k ? 8 : n >= 3 ? 14 : n >= 2 ? 12 : 10, r = k ? R * .7 : R, turn = t * (k ? -.4 : .25);
        g.save(); g.translate(cx, cy); g.scale(1, .92);
        g.globalAlpha = .55; g.strokeStyle = k ? P.gold : P.main; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r * .55, 0, TAU); g.stroke();
        g.globalAlpha = k ? .6 : .85;
        for (let i = 0; i < count; i++) { g.save(); g.rotate(turn + i * TAU / count); g.translate(r * .55, 0); sword(g, r * .55, P, k ? .7 : 1); g.restore(); }
        g.restore();
      }
    },
    spearman(g, e, x, y, t, B, n, P) {
      const cx = x, cy = y - B * .58;
      glow(g, cx, cy, B * .85, P.main, .3 + .1 * n);
      if (n >= 2) {                                             // a fan of war spears behind the back, embers rising
        for (let i = 0; i < 5; i++) {
          g.save(); g.translate(cx, cy + B * .25); g.rotate((i - 2) * .3);
          line(g, [[0, 0], [0, -B * .95]], P.deep, 3); line(g, [[0, 0], [0, -B * .95]], P.gold + 'cc', 1.2);
          poly(g, [[0, -B * 1.08], [-4, -B * .95], [0, -B * .9], [4, -B * .95]], P.hi);
          poly(g, [[0, -B * .88], [-6, -B * .84], [0, -B * .78], [6, -B * .84]], P.main); g.restore();
        }
        for (let i = 0; i < 8; i++) {
          const q = (t * .45 + i / 8) % 1, ex = cx + Math.sin(i * 2.1 + t) * B * .45, ey = y - q * B * 1.3;
          g.globalAlpha = (1 - q) * .8; g.fillStyle = i % 2 ? P.main : P.gold; g.fillRect(ex - 1.2, ey - 1.2, 2.4, 2.4);
        }
        g.globalAlpha = 1;
      }
      // the spirit dragon coiled behind the body (twin dragons at Lv.130), its head beside the shoulder
      for (const s of n >= 3 ? [1, -1] : [1]) {
        const pts = [];
        const RX = B * (s > 0 ? .6 : .7), RY = B * (s > 0 ? .78 : .86);   // the twin arches a little wider
        for (let i = 0; i <= 30; i++) {
          // tail low on one side, over the head, the head up at shoulder height on the other side
          const u = i / 30, a = Math.PI * (1.15 - 1.03 * u), wave = Math.sin(u * 10 + t * 2.5) * 3;
          pts.push([cx + s * Math.cos(a) * (RX + wave), cy + B * .12 - Math.sin(a) * (RY + wave)]);
        }
        line(g, pts, P.deep + 'cc', 10); line(g, pts, P.main + 'cc', 6); line(g, pts, P.hi + '99', 1.4);
        for (let i = 2; i < pts.length - 2; i += 3) { const [sx, sy] = pts[i]; poly(g, [[sx - 3, sy], [sx, sy - 6], [sx + 3, sy]], P.gold + 'aa'); }
        const [hx, hy] = pts[pts.length - 1], [px, py] = pts[pts.length - 3], a = Math.atan2(hy - py, hx - px);
        g.save(); g.translate(hx, hy); g.rotate(a);
        if (n >= 3) for (let k = 0; k < 5; k++) {               // a mane of fire
          const fa = Math.PI + (k - 2) * .35, fl = 10 + 4 * Math.sin(t * 6 + k);
          poly(g, [[-2, -2], [Math.cos(fa) * fl - 2, Math.sin(fa) * fl], [-2, 2]], k % 2 ? P.gold : P.main);
        }
        poly(g, [[12, 0], [2, -6], [-8, -6], [-5, 0], [-8, 6], [2, 6]], P.main);
        line(g, [[-2, -4], [-11, -13], [-1, -7]], P.gold, 1.6); line(g, [[-2, 4], [-11, 13], [-1, 7]], P.gold, 1.6);
        line(g, [[9, 1], [18, 6], [22, 3]], P.hi, .8); g.fillStyle = P.hi; g.beginPath(); g.arc(3, -2, 1.3, 0, TAU); g.fill();
        g.restore();
      }
    },
  };
  A.back = function (g, e, x, y, t, B) {
    const n = A.step(e);
    // Archer wings and their outer constellation are composed together in Wings.draw.
    if (!n || e.cls === 'archer') return;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.globalAlpha = .9; BACK[e.cls](g, e, x, y, t + seedOf(e), B, n, palOf(e));
    g.restore();
  };

  // ---------------------------------------------------------------- on the ground round the feet
  const GROUND = {
    warrior(g,x,y,t,K,n,P){
      g.translate(x,y);g.scale(1,.36);g.rotate(t*.12);g.globalAlpha=.4;g.strokeStyle=P.main;g.lineWidth=1.4;
      for(let ring=0;ring<n;ring++){const R=(32+ring*11)*K;g.beginPath();for(let i=0;i<=6;i++){const a=i*TAU/6;i?g.lineTo(Math.cos(a)*R,Math.sin(a)*R):g.moveTo(Math.cos(a)*R,Math.sin(a)*R);}g.stroke();}
    },
    dualblade(g, x, y, t, K, n, P) {                            // a compass of swords lying round the feet
      g.translate(x, y); g.scale(1, .36);
      const R = 50 * K;
      g.strokeStyle = P.main; g.lineWidth = 1.4; g.globalAlpha = .55; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      if (n >= 2) { g.setLineDash([10, 8]); g.beginPath(); g.arc(0, 0, R * 1.22, 0, TAU); g.stroke(); g.setLineDash([]); }
      g.globalAlpha = .75; g.rotate(t * .2);
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * TAU / 8); g.translate(R * .45, 0); sword(g, R * .6, P, .9); g.restore(); }
      if (n >= 3) for (let i = 0; i < 3; i++) {                  // crescent cuts turning round
        g.save(); g.rotate(-t * .7 + i * TAU / 3); g.globalAlpha = .6;
        g.beginPath(); g.arc(0, 0, R * 1.4, 0, 1.1); g.arc(0, -4, R * 1.32, 1.1, 0, true); g.closePath(); g.fillStyle = P.hi; g.fill(); g.restore();
      }
    },
    archer(g, x, y, t, K, n, P) {                               // an eight-pointed star compass and a ring of stars
      g.translate(x, y); g.scale(1, .36);
      const R = 50 * K;
      g.globalAlpha = .5; g.strokeStyle = P.gold; g.lineWidth = 1.2; g.rotate(-t * .15);
      g.beginPath(); for (let i = 0; i <= 16; i++) { const r = i % 2 ? R * .45 : R, a = i * TAU / 16; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke();
      g.strokeStyle = P.main; g.beginPath(); g.arc(0, 0, R * 1.12, 0, TAU); g.stroke();
      const count = n >= 2 ? 12 : 8;
      for (let i = 0; i < count; i++) { const a = i * TAU / count, tw = .5 + .5 * Math.sin(t * 2.5 + i); g.globalAlpha = .4 + .5 * tw; star(g, Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 4 + 3 * tw, P.hi); }
      if (n >= 3) { g.globalAlpha = .35; g.rotate(t * .4); for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * TAU / 6); g.translate(R * 1.3, 0); feather(g, R * .4, R * .08, P, -Math.PI / 2); g.restore(); } }
    },
    spearman(g, x, y, t, K, n, P) {                             // dragon-scale ring, cracked earth, a ring of fire
      g.translate(x, y); g.scale(1, .36);
      const R = 50 * K;
      g.globalAlpha = .55; g.strokeStyle = P.main; g.lineWidth = 1.6;
      g.beginPath(); for (let i = 0; i < 18; i++) { const a = i * TAU / 18; g.arc(Math.cos(a + TAU / 36) * R, Math.sin(a + TAU / 36) * R, R * .17, a + Math.PI * .5, a + Math.PI * 1.5, true); } g.stroke();
      if (n >= 2) {
        g.globalAlpha = .5; g.strokeStyle = P.deep; g.lineWidth = 2.2;
        for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + .4; g.beginPath(); g.moveTo(Math.cos(a) * R * .35, Math.sin(a) * R * .35); g.lineTo(Math.cos(a + .2) * R * .7, Math.sin(a + .2) * R * .7); g.lineTo(Math.cos(a - .05) * R * 1.05, Math.sin(a - .05) * R * 1.05); g.stroke(); }
      }
      if (n >= 3) {
        g.rotate(t * .5);
        for (let i = 0; i < 16; i++) { const a = i * TAU / 16, fl = R * (.22 + .08 * Math.sin(t * 7 + i * 1.7)); g.save(); g.rotate(a); g.globalAlpha = .55; poly(g, [[R * 1.18, -5], [R * 1.18 + fl, 0], [R * 1.18, 5]], i % 2 ? P.main : P.gold); g.restore(); }
      }
    },
  };
  A.ground = function (g, e, t, K) {
    const n = A.step(e);
    if (!n) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    GROUND[e.cls](g, e.x, e.y, t + seedOf(e), K, n, palOf(e));
    g.restore();
  };
})();
