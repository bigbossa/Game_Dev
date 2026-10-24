// Vector item art: twin-blade weapons (11 tiers) and armour pieces (shirt, trousers, bracers, pauldrons),
// drawn with canvas paths so icons and the blades held in the hands stay sharp at any size.
(function () {
  const IA = {};
  window.ItemArt = IA;
  const TAU = Math.PI * 2;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ------------------------------------------------------------ colour helpers
  const h2r = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const r2h = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = h2r(a), y = h2r(b); return r2h(x.map((v, i) => v + (y[i] - v) * t)); };
  const lite = (h, t) => mix(h, '#ffffff', t);
  const dark = (h, t) => mix(h, '#000000', t);
  const rgba = (h, a) => { const [r, g, b] = h2r(h); return `rgba(${r},${g},${b},${a})`; };

  // faction accents
  const ACC = {
    dharma: { main: '#3a8dff', light: '#a8dcff', deep: '#163c96', gem: '#46c2ff', mystic: '#2a64ff', mysticL: '#cfe4ff', cloth: '#f3f6fb', clothD: '#c3cfdf', line: '#7d93b3' },
    adharma: { main: '#ff3446', light: '#ffb3b3', deep: '#74081a', gem: '#ff2e4e', mystic: '#ff3a8c', mysticL: '#ffc6de', cloth: '#2e262b', clothD: '#151114', line: '#4d3d45' },
  };
  // metals: [dark, light, mid]
  const METAL = {
    iron: ['#34363a', '#a3a7ad', '#5d6168'],
    steel: ['#4f5965', '#ffffff', '#a9b5c3'],
    silver: ['#626e80', '#ffffff', '#c5d0de'],
    gold: ['#7a4c0c', '#fff0a8', '#d39a2a'],
    rose: ['#6a2a1a', '#ffd2a8', '#c0703a'],
    dark: ['#14141e', '#6a7a9a', '#2c3042'],
  };
  const metalGrad = (g, m, x0, y0, x1, y1) => {
    const M = METAL[m] || m, gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, M[0]); gr.addColorStop(0.42, M[1]); gr.addColorStop(0.6, M[2]); gr.addColorStop(1, M[0]);
    return gr;
  };
  const OUT = 'rgba(10,8,16,0.85)';

  // ------------------------------------------------------------ weapon designs (tier 0..10)
  // units: guard centre at (0,0), blade runs down to the tip at (curve, L); grip and pommel above (negative y)
  const designs = new Map();
  function design(tier, faction) {
    tier = Math.max(0, Math.min(13, tier || 0));
    faction = faction === 'adharma' ? 'adharma' : 'dharma';
    const key = `${faction}|${tier}`;
    if (designs.has(key)) return designs.get(key);
    const A = ACC[faction];
    const D = [
      { name: 'training', L: 76, w0: 3.6, w1: 3.4, curve: 0, tipLen: 10, belly: 0, edge: 'plain',
        steel: ['#4a4a4a', '#c9c9c9', '#7c7c7c'], guard: 'bar', guardMetal: 'iron', grip: '#6a4426', wrap: '#9a6a3e', pommel: 'cap', pommelMetal: 'iron' },
      { name: 'steel', L: 82, w0: 4.0, w1: 3.6, curve: 0, tipLen: 20, belly: 0, edge: 'plain',
        steel: ['#55606c', '#ffffff', '#a4b0bd'], guard: 'bar2', guardMetal: 'steel', grip: A.deep, wrap: A.main, pommel: 'ring', pommelMetal: 'steel', deco: ['fuller'] },
      { name: 'crescent', L: 88, w0: 3.6, w1: 6.0, curve: 14, tipLen: 30, belly: 0.3, edge: 'plain',
        steel: ['#5f6b7d', '#ffffff', '#b8c4d4'], guard: 'moon', guardMetal: 'silver', grip: A.deep, wrap: A.light, pommel: 'ring', pommelMetal: 'silver', gem: A.gem, deco: ['fuller'] },
      { name: 'azure-wind', L: 94, w0: 3.8, w1: 4.2, curve: 0, tipLen: 30, belly: 0.75, edge: 'leaf',
        steel: ['#4f6a8a', '#f4fbff', '#9fb8d6'], guard: 'swept', guardMetal: 'silver', grip: A.deep, wrap: A.main, pommel: 'gem', pommelMetal: 'silver', gem: A.gem,
        deco: ['wind', 'fuller'], accent: A.main, tassel: A.main },
      { name: 'sky-radiance', L: 100, w0: 4.8, w1: 4.6, curve: 2, tipLen: 22, belly: 0.1, edge: 'hook',
        steel: [A.deep, '#ffffff', A.light], guard: 'wings', guardMetal: 'silver', grip: A.deep, wrap: A.light, pommel: 'gem', pommelMetal: 'silver', gem: A.gem,
        deco: ['edgeGlow', 'fuller', 'stars'], accent: A.main, glow: A.main, tassel: A.main },
      { name: 'jade-gold', L: 104, w0: 6.2, w1: 7.4, curve: 3, tipLen: 16, belly: 0.05, edge: 'broad',
        steel: ['#58616e', '#ffffff', '#c3ccd8'], guard: 'jade', guardMetal: 'gold', grip: '#2a1a10', wrap: '#d9a640', pommel: 'gem', pommelMetal: 'gold', gem: '#2bd68f',
        deco: ['goldSpine', 'gemRow', 'goldRim'], accent: '#ffd25a', glow: '#ffd25a', tassel: A.main },
      { name: 'thunder', L: 110, w0: 5.6, w1: 5.4, curve: 2, tipLen: 22, belly: 0.1, edge: 'zigzag',
        steel: [dark(A.deep, 0.35), A.light, A.main], guard: 'spikes', guardMetal: 'dark', grip: '#16161e', wrap: A.main, pommel: 'spike', pommelMetal: 'dark', gem: A.light,
        deco: ['lightning', 'runes', 'edgeGlow'], accent: A.light, glow: A.main, tassel: A.deep, barbs: 2 },
      { name: 'golden-dragon', L: 116, w0: 5.8, w1: 5.6, curve: 0, tipLen: 24, belly: 0.1, edge: 'kris',
        steel: ['#5c6676', '#ffffff', '#c9d3e0'], guard: 'dragon', guardMetal: 'gold', grip: '#3a1a0a', wrap: '#e8b440', pommel: 'dragon', pommelMetal: 'gold', gem: A.gem,
        deco: ['goldRim', 'scales', 'runes', 'gemRow'], accent: '#ffcf4a', glow: '#ffcf4a', tassel: '#e8b440', barbs: 2 },
      { name: 'water-spirit', L: 120, w0: 5.4, w1: 6.4, curve: 6, tipLen: 28, belly: 0.25, edge: 'wave',
        steel: [rgba(A.deep, 0.9), rgba('#ffffff', 0.95), rgba(A.light, 0.85)], guard: 'wave', guardMetal: 'silver', grip: A.deep, wrap: A.light, pommel: 'pearl', pommelMetal: 'silver', gem: '#f4fbff',
        deco: ['waves', 'edgeGlow', 'window', 'runes'], accent: A.light, glow: A.light, tassel: A.light, barbs: 3 },
      { name: 'violet-flame', L: 126, w0: 6.2, w1: 6.6, curve: 5, tipLen: 28, belly: 0.2, edge: 'flame',
        steel: [dark(A.mystic, 0.45), A.mysticL, A.mystic], guard: 'crown', guardMetal: 'gold', grip: '#1e1030', wrap: A.mystic, pommel: 'gem', pommelMetal: 'gold', gem: A.mystic,
        deco: ['flame', 'goldSpine', 'window', 'runes', 'gemRow'], accent: A.mysticL, glow: A.mystic, tassel: A.mystic, barbs: 3 },
      { name: 'heaven-dragon', L: 134, w0: 7.0, w1: 7.2, curve: 4, tipLen: 30, belly: 0.25, edge: 'divine',
        steel: ['#8a7a5a', '#ffffff', '#fff3c8'], guard: 'heaven', guardMetal: 'gold', grip: '#2a1630', wrap: '#ffd96a', pommel: 'dragon', pommelMetal: 'gold', gem: A.mystic,
        deco: ['filigree', 'goldRim', 'beam', 'window', 'runes', 'gemRow', 'stars'], accent: '#ffe27a', glow: A.mystic, tassel: A.mystic, barbs: 4 },
    ];
    // Readable materials as well as silhouettes: jade, gold, tide, amethyst,
    // then celestial ivory / demonic obsidian. The icons use these same designs.
    const darkSide = faction === 'adharma';
    const materials = darkSide ? {
      5: [['#481625','#fac1c9','#b94d67'],'#ed7595'],
      7: [['#4b261f','#edc384','#9d5d36'],'#e6a44e'],
      8: [['#482241','#edc8e3','#a0568a'],'#d28cbb'],
      9: [['#4b1644','#ffc7e6','#b64786'],'#ea6cac'],
      10: [['#241826','#c68da2','#613447'],'#ec567b'],
    } : {
      5: [['#174e48','#b8ecd8','#398c77'],'#58d4a4'],
      7: [['#6c491e','#ffe6a7','#b7833d'],'#edbd5c'],
      8: [['#18566a','#c1f0f4','#428fa8'],'#60d7d6'],
      9: [['#412769','#d8c3ff','#9167bf'],'#af83ec'],
      10: [['#826531','#fff1bf','#c7a66e'],'#88d5ec'],
    };
    for (const [n, [steel, accent]] of Object.entries(materials)) {
      Object.assign(D[n], { steel, accent, glow: accent, gem: accent });
    }
    D.push({ ...D[10], name:'imperial-eclipse', L:138, w0:6, w1:8, curve:12, edge:'crescentImperial', guard:'moon',
      steel:darkSide?['#25172e','#ddbbeb','#664778']:['#386873','#ecffff','#8ddadf'],
      accent:darkSide?'#ca96eb':'#83edee',glow:darkSide?'#ca96eb':'#83edee',gem:darkSide?'#e6b2ff':'#b5fff1',
      deco:['filigree','runes','gemRow','goldRim'],barbs:3 });
    D.push({ ...D[10], name:'primordial-sovereign', L:142, w0:8, w1:5, curve:0, edge:'sovereign', guard:'crown',
      steel:darkSide?['#200f1d','#efafbd','#6f2942']:['#796130','#fff9df','#d9b96e'],
      accent:darkSide?'#ff496c':'#ffe7a4',glow:darkSide?'#ff496c':'#ffe7a4',gem:darkSide?'#ff496c':'#fff0a8',
      deco:['filigree','goldSpine','runes','gemRow','stars'],barbs:5 });
    D.push({ ...D[10], name:'solar-lunar', L:136, w0:4.8, w1:8.5, curve:0, tipLen:34, belly:.15,
      edge:'solarLunar', guard:'wave', guardMetal:'silver', pommel:'ring', pommelMetal:'gold',
      steel:darkSide?['#3d1d39','#ffe4f2','#a95080']:['#20534f','#effff6','#5ebda0'],
      accent:darkSide?'#efa2d0':'#79f2c4', glow:darkSide?'#e77db4':'#55e6b4', gem:darkSide?'#ffb9de':'#b0ffe0',
      deco:['window','runes','edgeGlow','goldRim'],barbs:0 });
    D.forEach((d,t) => {
      d.tier=t;
      d.fx=[lite(d.accent || A.main,.6),d.glow || d.accent || A.main,dark(d.accent || A.main,.6)];
      designs.set(`${faction}|${t}`,d);
    });
    return designs.get(key);
  }
  IA.design = design;

  const WS = 1.8;   // bevels and inlays must remain visible on the actual held blades
  // centre line and half widths of the blade at t in [0,1]
  function bladeAt(d, t) {
    const y = 2 + (d.L - 2) * t;
    const cx = d.curve * t * t;
    let w = (d.w0 + (d.w1 - d.w0) * t) * WS * (1 + d.belly * Math.sin(Math.PI * t));
    const tt = (d.L - y) / d.tipLen;
    if (tt < 1) w *= Math.pow(Math.max(0, tt), 0.7);
    let wl = w, wr = w;
    if (d.edge === 'wave' && t < 0.85) wr += Math.sin(t * TAU * 3.5) * 0.9 * (1 - t);
    if (d.edge === 'flame' && t < 0.88) {
      wl += Math.max(0, Math.sin(t * TAU * 4.5)) * 1.8 * (1 - t * 0.7);
      wr += Math.max(0, Math.sin(t * TAU * 4.5 + 1.6)) * 1.8 * (1 - t * 0.7);
    }
    if (d.edge === 'serrate' && t > 0.06 && t < 0.4) wr += (Math.floor(t * 40) % 2) * 1.5;
    if (d.edge === 'hook' && t > 0.6 && t < 0.86) wl += Math.max(0, 1 - Math.abs(t - 0.74) / 0.1) * 5.5;     // barbed hook near the tip
    if (d.edge === 'broad' && t > 0.78) { const k = (t - 0.78) / 0.22; wl *= 1 - k * 0.15; wr *= 1 - k * 0.85; } // chisel point
    if (d.edge === 'zigzag' && t < 0.84) {                                                     // lightning-bolt edges
      const saw = (u) => { const f = u - Math.floor(u); return f < 0.5 ? f * 2 : 2 - f * 2; };
      wl += saw(t * 7) * 3.2 * (1 - t * 0.6); wr += saw(t * 7 + 0.5) * 3.2 * (1 - t * 0.6);
    }
    if (d.edge === 'wave' && t < 0.85) wl += Math.sin(t * TAU * 3.5 + Math.PI) * 1.4 * (1 - t);
    if (d.edge === 'divine') {                                                                  // flared base, rippled body
      if (t < 0.2) { const k = 1 - t / 0.2; wl += k * 6; wr += k * 6; }
      if (t > 0.2 && t < 0.85) { const r = Math.sin((t - 0.2) * TAU * 3) * 1.6 * (1 - t); wl += r; wr += r; }
    }
    if (d.edge === 'crescentImperial') { wl += Math.sin(t*Math.PI)*4; wr += Math.max(0,Math.sin(t*TAU*3))*3*(1-t); }
    if (d.edge === 'sovereign' && t < .76) { const k=Math.max(0,1-Math.abs(t-.25)*9)*5; wl+=k;wr+=k; }
    if (d.edge === 'solarLunar') { const k=Math.max(0,1-Math.abs(t-.38)/.17)*7; wl+=k;wr+=k; }
    let x = cx;
    if (d.edge === 'kris') x += Math.sin(t * TAU * 2.5) * 3.2 * (1 - t * 0.9);                // snake-like wavy blade
    return { x, y, wl, wr };
  }
  function bladePath(d) {
    const N = 40, p = new Path2D(), L = [], R = [];
    for (let i = 0; i <= N; i++) { const b = bladeAt(d, i / N); L.push([b.x - b.wl, b.y]); R.push([b.x + b.wr, b.y]); }
    p.moveTo(L[0][0], L[0][1]);
    for (const q of L) p.lineTo(q[0], q[1]);
    for (let i = R.length - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
    p.closePath();
    return { p, L, R };
  }
  const centre = (d, t) => { const b = bladeAt(d, t); return [b.x, b.y]; };
  // side spikes along the lower blade (high tiers), drawn behind the blade
  function drawBarbs(g, d) {
    if (!d.barbs) return;
    for (let k = 0; k < d.barbs; k++) {
      const t = 0.08 + k * 0.1, b = bladeAt(d, t);
      for (const side of [-1, 1]) {
        const w = side < 0 ? b.wl : b.wr, x0 = b.x + side * w, len = 6 + (d.barbs - k) * 1.6;
        const p = new Path2D();
        p.moveTo(x0, b.y - 3); p.quadraticCurveTo(x0 + side * len * 0.6, b.y - 2, x0 + side * len, b.y - len * 0.7);
        p.quadraticCurveTo(x0 + side * len * 0.5, b.y + 1, x0, b.y + 4); p.closePath();
        g.fillStyle = metalGrad(g, d.guardMetal === 'dark' ? 'dark' : 'gold', x0, b.y - len, x0 + side * len, b.y + 4); g.fill(p);
        g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke(p);
      }
    }
  }
  function strokeCentre(g, d, t0, t1, off = 0) {
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const [x, y] = centre(d, t0 + ((t1 - t0) * i) / 24); i ? g.lineTo(x + off, y) : g.moveTo(x + off, y); }
    g.stroke();
  }

  function drawBlade(g, d, glow) {
    drawBarbs(g, d);
    const { p, L, R } = bladePath(d);
    if (glow && d.glow) {
      g.save(); g.shadowColor = d.glow; g.shadowBlur = 7; g.fillStyle = rgba(d.glow, 0.9); g.fill(p); g.restore();
    }
    // bevelled steel: dark -> bright ridge -> mid
    const W = Math.max(d.w0, d.w1) * WS * 1.3;
    const gr = g.createLinearGradient(-W, 0, W + d.curve, 0);
    gr.addColorStop(0, d.steel[0]); gr.addColorStop(0.46, d.steel[1]); gr.addColorStop(0.54, d.steel[2]); gr.addColorStop(1, d.steel[0]);
    g.fillStyle = gr; g.fill(p);
    // lengthwise sheen
    const gl = g.createLinearGradient(0, 0, 0, d.L);
    gl.addColorStop(0, 'rgba(255,255,255,0.25)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(0.85, 'rgba(255,255,255,0.18)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fill(p);
    g.save(); g.clip(p);
    for (const k of d.deco || []) DECO[k] && DECO[k](g, d);
    if (d.tier >= 4) {
      // One large, dark-backed crest survives reduction to a 25–45px weapon.
      const [cx,cy]=centre(d,.46),r=3.1+(d.tier-4)*.25;
      g.fillStyle=dark(d.accent || d.wrap,.68);g.strokeStyle=d.guardMetal==='gold'?'#e8c16e':lite(d.accent,.6);g.lineWidth=1;
      g.beginPath();g.moveTo(cx,cy-r*3);g.lineTo(cx+r,cy);g.lineTo(cx,cy+r*3);g.lineTo(cx-r,cy);g.closePath();g.fill();g.stroke();
      g.strokeStyle=lite(d.accent,.6);g.lineWidth=1.4;
      g.beginPath();
      if(d.tier===6) {g.moveTo(cx+1,cy-r*2);g.lineTo(cx-1.5,cy);g.lineTo(cx+1.5,cy);g.lineTo(cx-1,cy+r*2);}
      else if(d.tier===8) {g.moveTo(cx,cy-r*2);g.bezierCurveTo(cx-r,cy-r,cx+r,cy+r,cx,cy+r*2);}
      else {g.moveTo(cx,cy-r*1.5);g.lineTo(cx,cy+r*1.5);g.moveTo(cx-r*.6,cy);g.lineTo(cx+r*.6,cy);}
      g.stroke();
    }
    g.restore();
    // cutting edge highlight + outline
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.7;
    g.beginPath(); R.forEach((q, i) => (i ? g.lineTo(q[0] - 0.5, q[1]) : g.moveTo(q[0] - 0.5, q[1]))); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke(p);
  }
  const DECO = {
    runes(g, d) {
      // glowing glyphs down the centre line
      g.save(); g.shadowColor = d.glow || d.accent; g.shadowBlur = 4;
      g.strokeStyle = lite(d.accent || '#ffffff', 0.35); g.lineWidth = 0.8; g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const t = 0.3 + k * 0.1; if (t > 0.78) break;
        const [x, y] = centre(d, t), r = 1.9;
        g.beginPath();
        switch (k % 4) {
          case 0: g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); break;
          case 1: g.arc(x, y, r, 0, TAU); g.moveTo(x, y - r * 1.6); g.lineTo(x, y + r * 1.6); break;
          case 2: g.moveTo(x - r, y + r); g.lineTo(x, y - r); g.lineTo(x + r, y + r); g.moveTo(x - r * 0.6, y + r * 0.2); g.lineTo(x + r * 0.6, y + r * 0.2); break;
          default: g.moveTo(x, y - r * 1.5); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.5); g.lineTo(x - r, y); g.closePath();
        }
        g.stroke();
      }
      g.restore();
    },
    gemRow(g, d) {
      for (const t of [0.14, 0.24]) { const [x, y] = centre(d, t); gemAt(g, x, y, 1.6, d.gem || d.accent); }
    },
    window(g, d) {
      // hollow soul-window near the guard with a floating core
      const [x0, y0] = centre(d, 0.06), [x1, y1] = centre(d, 0.2);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, h = (y1 - y0) / 2, w = Math.min(bladeAt(d, 0.13).wl, bladeAt(d, 0.13).wr) * 0.55;
      g.save();
      g.fillStyle = 'rgba(8,6,20,0.9)'; g.beginPath(); g.ellipse(cx, cy, w, h, 0, 0, TAU); g.fill();
      g.shadowColor = d.glow || d.accent; g.shadowBlur = 5;
      g.strokeStyle = '#ffd76a'; g.lineWidth = 0.9; g.stroke();
      g.restore();
      gemAt(g, cx, cy, Math.min(w, h) * 0.6, d.gem || d.glow);
    },
    scales(g, d) {
      // dragon scales along the spine
      g.strokeStyle = 'rgba(160,110,20,0.75)'; g.lineWidth = 0.6;
      for (let k = 0; k < 9; k++) {
        const [x, y] = centre(d, 0.08 + k * 0.07);
        for (const o of [-1.6, 1.6]) { g.beginPath(); g.arc(x + o, y, 1.7, 0, Math.PI); g.stroke(); }
      }
    },
    stars(g, d) {
      g.fillStyle = '#ffffff';
      for (const [t, off, r] of [[0.32, -1.6, 1.4], [0.5, 1.4, 1.1], [0.66, -1.0, 1.2], [0.8, 0.6, 0.9]]) {
        const [x, y] = centre(d, t), cx = x + off;
        g.beginPath(); g.moveTo(cx, y - r * 2); g.lineTo(cx + r * 0.45, y); g.lineTo(cx, y + r * 2); g.lineTo(cx - r * 0.45, y); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(cx - r * 2, y); g.lineTo(cx, y + r * 0.45); g.lineTo(cx + r * 2, y); g.lineTo(cx, y - r * 0.45); g.closePath(); g.fill();
      }
    },
    fuller(g, d) {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(30,40,60,0.45)'; g.lineWidth = 1.3; strokeCentre(g, d, 0.03, 0.62, -0.3);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.5; strokeCentre(g, d, 0.03, 0.62, 0.6);
    },
    goldSpine(g, d) {
      g.strokeStyle = metalGrad(g, 'gold', -2, 0, 2, 0); g.lineWidth = 1.8; strokeCentre(g, d, 0.0, 0.72);
      g.strokeStyle = 'rgba(255,250,200,0.9)'; g.lineWidth = 0.5; strokeCentre(g, d, 0.02, 0.7, -0.3);
    },
    goldRim(g, d) {
      const { L, R } = bladePath(d);
      g.strokeStyle = '#f2c452'; g.lineWidth = 1.6;
      for (const E of [L, R]) { g.beginPath(); E.slice(0, -3).forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); }
    },
    edgeGlow(g, d) {
      const { R } = bladePath(d);
      g.save(); g.shadowColor = d.accent; g.shadowBlur = 4;
      g.strokeStyle = lite(d.accent, 0.4); g.lineWidth = 1.6;
      g.beginPath(); R.forEach((q, i) => (i ? g.lineTo(q[0] - 0.6, q[1]) : g.moveTo(q[0] - 0.6, q[1]))); g.stroke();
      g.restore();
    },
    wind(g, d) {
      // sweeping wind streaks etched across the blade
      g.lineCap = 'round';
      for (const t of [0.1, 0.27, 0.44, 0.6]) {
        const [x, y] = centre(d, t), w = 7;
        g.strokeStyle = d.accent; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(x - w, y); g.bezierCurveTo(x - 2, y + 1, x + 2, y + 7, x + w, y + 9); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.45;
        g.beginPath(); g.moveTo(x - w + 1, y - 0.6); g.bezierCurveTo(x - 1, y + 0.4, x + 3, y + 6, x + w, y + 8); g.stroke();
      }
    },
    lightning(g, d) {
      g.save(); g.shadowColor = d.accent; g.shadowBlur = 4;
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.9; g.lineJoin = 'miter';
      g.beginPath();
      for (let i = 0; i <= 12; i++) { const [x, y] = centre(d, 0.03 + i * 0.065); const zz = (i % 2 ? 1 : -1) * 1.8; i ? g.lineTo(x + zz, y) : g.moveTo(x, y); }
      g.stroke();
      g.strokeStyle = d.accent; g.lineWidth = 0.5; g.stroke();
      g.restore();
    },
    waves(g, d) {
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.7;
      for (let k = 0; k < 6; k++) {
        const t = 0.06 + k * 0.12, [x, y] = centre(d, t);
        g.beginPath(); g.moveTo(x - 5, y); g.bezierCurveTo(x - 2, y - 3, x + 1, y + 3, x + 5, y - 1); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (const t of [0.2, 0.45, 0.7]) { const [x, y] = centre(d, t); g.beginPath(); g.arc(x + 1.5, y + 3, 0.8, 0, TAU); g.fill(); }
    },
    flame(g, d) {
      g.save(); g.shadowColor = d.accent; g.shadowBlur = 3;
      g.fillStyle = rgba(d.accent, 0.85);
      for (const t of [0.1, 0.28, 0.46, 0.64]) {
        const [x, y] = centre(d, t);
        g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(x + 3.2, y + 4, x, y + 9); g.quadraticCurveTo(x - 1.2, y + 5, x - 2.6, y + 3); g.quadraticCurveTo(x - 1, y + 2, x, y - 1); g.fill();
      }
      g.restore();
    },
    filigree(g, d) {
      // golden vine winding down the blade with small leaves
      g.strokeStyle = '#d9a640'; g.lineWidth = 0.9; g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i <= 60; i++) { const t = 0.02 + i * 0.012, [x, y] = centre(d, t); const ox = Math.sin(t * Math.PI * 7) * 3.2; i ? g.lineTo(x + ox, y) : g.moveTo(x + ox, y); }
      g.stroke();
      g.fillStyle = '#ffe58a';
      for (let k = 0; k < 7; k++) {
        const t = 0.02 + (k + 0.25) / 7 * 0.72, [x, y] = centre(d, t), ox = Math.sin(t * Math.PI * 7) * 3.2, sd = k % 2 ? 1 : -1;
        g.beginPath(); g.ellipse(x + ox + sd * 1.8, y + 1, 1.6, 0.7, sd * 0.7, 0, TAU); g.fill();
      }
    },
    beam(g, d) {
      g.save(); g.shadowColor = d.glow; g.shadowBlur = 5;
      g.strokeStyle = lite(d.glow, 0.55); g.lineWidth = 1.2; strokeCentre(g, d, 0.05, 0.86);
      g.restore();
    },
  };

  // ---------------------------------------------------------------- guard / grip / pommel
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  function gemAt(g, x, y, r, col) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, lite(col, 0.3)); gr.addColorStop(1, dark(col, 0.45));
    g.save(); g.shadowColor = col; g.shadowBlur = r * 1.6;
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke();
  }
  function fillOut(g, path, fill, lw = 0.8) { g.fillStyle = fill; g.fill(path); g.strokeStyle = OUT; g.lineWidth = lw; g.stroke(path); }
  function sym(build) { const p = new Path2D(); build(p, 1); build(p, -1); return p; }

  const GUARD = {
    bar(g, d) { rr(g, -8, -2, 16, 4, 1.5); g.fillStyle = metalGrad(g, d.guardMetal, 0, -2, 0, 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.8; g.stroke(); },
    bar2(g, d) {
      const p = sym((p, s) => { p.moveTo(0, -2.6); p.lineTo(s * 9, -2); p.quadraticCurveTo(s * 11.5, 0, s * 9, 2.4); p.lineTo(0, 2.8); });
      fillOut(g, p, metalGrad(g, d.guardMetal, 0, -3, 0, 3));
      gemAt(g, 0, 0, 1.6, d.gem || d.wrap);
    },
    moon(g, d) {
      const p = new Path2D(); p.arc(0, 0, 8.5, Math.PI * 0.08, Math.PI * 0.92, false); p.arc(0, -3.2, 7.2, Math.PI * 0.9, Math.PI * 0.1, true); p.closePath();
      fillOut(g, p, metalGrad(g, d.guardMetal, -8, 0, 8, 0));
      gemAt(g, 0, 2.6, 1.9, d.gem);
    },
    swept(g, d) {
      const p = sym((p, s) => { p.moveTo(0, -3); p.quadraticCurveTo(s * 7, -4, s * 11, 1); p.quadraticCurveTo(s * 12, 6, s * 8.5, 8); p.quadraticCurveTo(s * 8.5, 3, s * 3, 3); p.lineTo(0, 3); });
      fillOut(g, p, metalGrad(g, d.guardMetal, 0, -4, 0, 8));
      gemAt(g, 0, 0, 2.1, d.gem);
    },
    wings(g, d) {
      const p = sym((p, s) => {
        p.moveTo(0, 2.5); p.lineTo(s * 4, 2.5); p.quadraticCurveTo(s * 10, 2, s * 14, -7);
        p.lineTo(s * 11.5, -5.5); p.lineTo(s * 12, -9.5); p.lineTo(s * 8.5, -4.5); p.lineTo(s * 8, -7.5); p.quadraticCurveTo(s * 5, -2.5, 0, -3);
      });
      fillOut(g, p, metalGrad(g, d.guardMetal, 0, -9, 0, 3));
      g.strokeStyle = d.accent; g.lineWidth = 0.7;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3, 0); g.quadraticCurveTo(s * 9, 0, s * 12, -6); g.stroke(); }
      gemAt(g, 0, -0.2, 2.4, d.gem);
    },
    jade(g, d) {
      const p = sym((p, s) => {
        p.moveTo(0, -5); p.bezierCurveTo(s * 5, -6, s * 6, -2, s * 9, -3.5); p.bezierCurveTo(s * 12.5, -4, s * 12.5, 2, s * 9.5, 2.5);
        p.bezierCurveTo(s * 8, 5.5, s * 4, 4, s * 3, 7); p.lineTo(0, 6);
      });
      fillOut(g, p, metalGrad(g, 'gold', 0, -6, 0, 7));
      for (const s of [-1, 1]) gemAt(g, s * 9.6, -0.6, 1.3, d.gem);
      gemAt(g, 0, 0.4, 3.2, d.gem);
    },
    spikes(g, d) {
      const p = sym((p, s) => {
        p.moveTo(0, -3); p.lineTo(s * 4, -3.5); p.lineTo(s * 8, -9); p.lineTo(s * 7.5, -3.5); p.lineTo(s * 13, -2.5); p.lineTo(s * 8, 0.5);
        p.lineTo(s * 12, 5); p.lineTo(s * 5.5, 3); p.lineTo(s * 4, 7.5); p.lineTo(0, 3.5);
      });
      fillOut(g, p, metalGrad(g, 'dark', -12, -9, 12, 7));
      g.save(); g.shadowColor = d.glow; g.shadowBlur = 3; g.strokeStyle = d.accent; g.lineWidth = 0.6;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2, -1); g.lineTo(s * 7.5, -6.5); g.moveTo(s * 2, 1); g.lineTo(s * 10, 3.2); g.stroke(); }
      g.restore();
      gemAt(g, 0, 0, 2.2, d.gem);
    },
    dragon(g, d) {
      // horns curling outward, dragon face in the middle
      const horns = sym((p, s) => { p.moveTo(s * 2, -2); p.bezierCurveTo(s * 8, -4, s * 12, -1, s * 13.5, -8); p.bezierCurveTo(s * 14.5, -2, s * 11, 3, s * 5, 3); p.lineTo(s * 2, 3); });
      fillOut(g, horns, metalGrad(g, 'gold', 0, -8, 0, 4));
      const wings = sym((p, s) => { p.moveTo(s * 4, 3); p.quadraticCurveTo(s * 10, 4, s * 11, 8.5); p.quadraticCurveTo(s * 7, 6.5, s * 3, 7.5); });
      fillOut(g, wings, metalGrad(g, 'gold', 0, 3, 0, 9), 0.6);
      const face = new Path2D(); face.moveTo(-4.2, -3.5); face.quadraticCurveTo(0, -6.5, 4.2, -3.5); face.lineTo(3.4, 4); face.quadraticCurveTo(0, 8.5, -3.4, 4); face.closePath();
      fillOut(g, face, metalGrad(g, 'gold', -4, -6, 4, 8));
      g.fillStyle = '#7a1a0a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 1.9, -1.2, 0.9, 0.55, s * 0.4, 0, TAU); g.fill(); }
      gemAt(g, 0, 3, 1.6, d.gem);
    },
    wave(g, d) {
      const p = sym((p, s) => { p.moveTo(0, -3.5); p.bezierCurveTo(s * 6, -6, s * 9, -1, s * 12, -4); p.bezierCurveTo(s * 13, 1, s * 9, 4, s * 5, 2.5); p.quadraticCurveTo(s * 3, 5, 0, 4); });
      fillOut(g, p, metalGrad(g, 'silver', 0, -6, 0, 5));
      g.strokeStyle = d.accent; g.lineWidth = 0.6;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.5, -1); g.bezierCurveTo(s * 6, -3, s * 8, 1, s * 11, -2); g.stroke(); }
      gemAt(g, 0, 0, 2.6, d.gem);
    },
    crown(g, d) {
      const p = sym((p, s) => {
        p.moveTo(0, -9); p.lineTo(s * 2.2, -4.5); p.lineTo(s * 5.5, -8); p.lineTo(s * 6.5, -3.5); p.lineTo(s * 11, -6); p.lineTo(s * 10, 0.5);
        p.quadraticCurveTo(s * 7, 4.5, s * 3, 5); p.lineTo(0, 6.5);
      });
      fillOut(g, p, metalGrad(g, 'gold', 0, -9, 0, 6));
      for (const [x, y] of [[0, -8], [5.5, -7], [-5.5, -7], [10.8, -5.2], [-10.8, -5.2]]) { g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(x, y, 0.8, 0, TAU); g.fill(); }
      gemAt(g, 0, 0.5, 3, d.gem);
    },
    heaven(g, d) {
      // halo ring, layered feather wings, dragon crest and a large gem
      g.save(); g.shadowColor = d.glow; g.shadowBlur = 6; g.strokeStyle = lite(d.glow, 0.5); g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(0, -1, 9, 9, 0, 0, TAU); g.stroke(); g.restore();
      for (const [len, lift, col] of [[18, -12, '#d39a2a'], [14.5, -9, '#ffe58a'], [11, -5.5, '#fff3c8']]) {
        const p = sym((p, s) => {
          p.moveTo(s * 2, 1); p.quadraticCurveTo(s * (len * 0.55), 2.5, s * len, lift); p.lineTo(s * (len - 2.5), lift + 3.2);
          p.lineTo(s * (len - 1.8), lift + 0.4); p.lineTo(s * (len - 5), lift + 4.4); p.quadraticCurveTo(s * (len * 0.45), 1.2, s * 2, 4);
        });
        fillOut(g, p, metalGrad(g, [dark(col, 0.45), lite(col, 0.6), col], 0, lift, 0, 4), 0.6);
      }
      const crest = new Path2D(); crest.moveTo(0, -11); crest.lineTo(3, -4); crest.lineTo(4.4, 4); crest.quadraticCurveTo(0, 8.5, -4.4, 4); crest.lineTo(-3, -4); crest.closePath();
      fillOut(g, crest, metalGrad(g, 'gold', -4, -11, 4, 8));
      gemAt(g, 0, -1, 3.3, d.gem);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, -8.5, 0.9, 0, TAU); g.fill();
    },
  };

  function drawGrip(g, d, full) {
    const top = full ? -24 : -8;
    rr(g, -3, top, 6, -top - 1.5, 1.6);
    const gr = g.createLinearGradient(-3, 0, 3, 0);
    gr.addColorStop(0, dark(d.grip, 0.3)); gr.addColorStop(0.5, lite(d.grip, 0.25)); gr.addColorStop(1, dark(d.grip, 0.4));
    g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.7; g.stroke();
    g.save(); g.clip();
    g.strokeStyle = d.wrap; g.lineWidth = 1;
    for (let y = top - 2; y < 2; y += 3.2) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y + 2.4); g.stroke(); }
    g.restore();
    if (!full) return;
    // pommel
    const y = -25.5, pm = d.pommelMetal;
    if (d.pommel === 'cap') { rr(g, -3.2, y - 1, 6.4, 3, 1.2); g.fillStyle = metalGrad(g, pm, -3, 0, 3, 0); g.fill(); g.strokeStyle = OUT; g.stroke(); }
    else if (d.pommel === 'ring') { g.strokeStyle = metalGrad(g, pm, -3, 0, 3, 0); g.lineWidth = 1.6; g.beginPath(); g.arc(0, y - 1.2, 2.6, 0, TAU); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 0.5; g.stroke(); }
    else if (d.pommel === 'spike') {
      const p = new Path2D(); p.moveTo(-3, y + 1.5); p.lineTo(0, y - 6); p.lineTo(3, y + 1.5); p.closePath(); fillOut(g, p, metalGrad(g, pm, -3, 0, 3, 0), 0.6);
    } else if (d.pommel === 'dragon') {
      const p = new Path2D(); p.moveTo(-3.6, y + 1.5); p.quadraticCurveTo(-4.5, y - 3, -1.5, y - 4.5); p.lineTo(0, y - 7); p.lineTo(1.5, y - 4.5); p.quadraticCurveTo(4.5, y - 3, 3.6, y + 1.5); p.closePath();
      fillOut(g, p, metalGrad(g, pm, -4, 0, 4, 0), 0.6); gemAt(g, 0, y - 1.5, 1.4, d.gem);
    } else if (d.pommel === 'pearl') { gemAt(g, 0, y - 1, 2.6, '#e8f4ff'); }
    else { rr(g, -3, y - 0.5, 6, 2.6, 1); g.fillStyle = metalGrad(g, pm, -3, 0, 3, 0); g.fill(); g.strokeStyle = OUT; g.stroke(); gemAt(g, 0, y - 2.2, 2, d.gem || '#ffffff'); }
  }
  function drawTassel(g, d) {
    if (!d.tassel) return;
    g.strokeStyle = d.tassel; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, -27); g.bezierCurveTo(-6, -24, -9, -14, -8, -6); g.stroke();
    gemAt(g, -8, -6, 1.2, '#ffffff');
    const p = new Path2D(); p.moveTo(-9, -5); p.lineTo(-7, -5); p.lineTo(-5.6, 8); p.quadraticCurveTo(-8, 10, -10.4, 8); p.closePath();
    const gr = g.createLinearGradient(0, -5, 0, 10); gr.addColorStop(0, lite(d.tassel, 0.2)); gr.addColorStop(1, dark(d.tassel, 0.4));
    g.fillStyle = gr; g.fill(p); g.strokeStyle = OUT; g.lineWidth = 0.5; g.stroke(p);
    g.strokeStyle = rgba('#ffffff', 0.4); g.lineWidth = 0.35;
    for (const x of [-9, -8, -7]) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x + (x + 8) * 0.4, 8); g.stroke(); }
  }

  // one complete weapon in its own units; opts.full = grip + pommel + tassel (icons), else hand-held
  function drawWeapon(g, tier, faction, opts = {}) {
    const d = design(tier, faction);
    if (opts.full) drawTassel(g, d);
    drawGrip(g, d, opts.full);
    drawBlade(g, d, opts.glow !== false);
    g.save(); g.scale(1.3, 1.3);
    (GUARD[d.guard] || GUARD.bar)(g, d);
    g.restore();
  }
  IA.drawWeapon = drawWeapon;

  // ---------------------------------------------------------------- in-hand blade cache
  // vertical blade, guard at (gx, gy) and tip straight below; size buckets keep it crisp at every zoom
  const bladeCache = new Map();
  IA.blade = function (tier, faction, side, px) {
    const bucket = px <= 48 ? 48 : px <= 96 ? 96 : 192;
    const key = `${tier}|${faction}|${side}|${bucket}`;
    let v = bladeCache.get(key);
    if (v) return v;
    const d = design(tier, faction);
    const s = bucket / d.L, pad = 10;
    // Include the full winged guard and grip. The old 30x(L+14) bounds cut off
    // the Lv.90/100 crown and feather tips, particularly in the largest bucket.
    const w = Math.ceil((64 + d.curve) * s + pad * 2), h = Math.ceil((d.L + 32) * s + pad * 2);
    const gx = Math.round(32 * s + pad), gy = Math.round(25 * s + pad);
    const c = mk(w, h), g = c.getContext('2d');
    g.translate(side ? gx : w - gx, gy);
    g.scale(side ? s : -s, s);           // left blade = mirrored (curves outward to the left)
    drawWeapon(g, tier, faction, { full: false, glow: false });
    // tip of the design (curve applies to the right blade; mirrored for the left)
    v = { img: c, gx: side ? gx : w - gx, gy, tipX: (side ? gx : w - gx) + (side ? 1 : -1) * d.curve * s, tipY: gy + d.L * s, len: bucket };
    bladeCache.set(key, v);
    return v;
  };
  // glow silhouette for the in-hand blade
  const haloCache = new Map();
  IA.halo = function (tier, faction, side, px, color, blur = 1) {
    const b = IA.blade(tier, faction, side, px);
    const key = `${tier}|${faction}|${side}|${b.len}|${color}|${blur}`;
    let v = haloCache.get(key);
    if (v) return v;
    const radius = Math.max(3,b.len/24)*Math.min(1.6,blur);
    const P = Math.ceil(radius*2+3), c = mk(b.img.width + P * 2, b.img.height + P * 2), g = c.getContext('2d');
    g.shadowColor = color; g.shadowBlur = radius; g.shadowOffsetX = c.width;
    g.drawImage(b.img, P - c.width, P);
    // Light stays outside the blade; its metal, edge and engraving remain opaque.
    g.shadowBlur=0;g.shadowOffsetX=0;g.globalCompositeOperation='destination-out';
    g.drawImage(b.img,P,P);
    v = { img: c, pad: P };
    haloCache.set(key, v);
    return v;
  };

  // ---------------------------------------------------------------- icons
  const ICON = 128;
  const iconCache = {};
  function sparkle(g, x, y, r, col) {
    g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = r * 2;
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
    g.restore();
  }
  function weaponIcon(g, it, faction) {
    const d = design(it.tier, faction), S = ICON;
    const glowCol = d.glow || (it.tier >= 2 ? ACC[faction].main : null);
    if (glowCol && it.tier >= 3) {
      const gr = g.createRadialGradient(S / 2, S * 0.55, 4, S / 2, S * 0.55, S * 0.55);
      gr.addColorStop(0, rgba(glowCol, 0.32)); gr.addColorStop(1, rgba(glowCol, 0));
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    // crossed twin blades: grips in the lower corners, tips in the upper corners
    const sx = (S * 1.1) / (134 + 34) * (0.9 + (it.tier / 10) * 0.1), mid = (d.L - 28) / 2;
    for (const side of [0, 1]) {
      g.save();
      g.translate(S / 2, S / 2);
      g.rotate(Math.PI + (side ? 0.66 : -0.66));
      g.scale(side ? sx : -sx, sx);
      g.translate(0, -mid);
      drawWeapon(g, it.tier, faction, { full: true });
      g.restore();
    }
    if (it.tier >= 8) for (const [x, y, r] of [[0.2, 0.2, 5], [0.82, 0.32, 4], [0.7, 0.86, 3.5]]) sparkle(g, S * x, S * y, r, '#ffffff');
  }

  // armour palettes: cloth base by faction, trim colour from the set
  function armorPal(it, faction) {
    const A = ACC[faction], lk = it.look[faction], t = it.tier;
    return {
      t, A, col: lk.color, glow: lk.glow || null,
      cloth: A.cloth, clothD: A.clothD, line: A.line,
      metal: t >= 6 ? 'gold' : t >= 5 ? 'gold' : t >= 3 ? 'steel' : t === 2 ? 'rose' : 'iron',
      leather: t === 2,
    };
  }
  const clothGrad = (g, a, b, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  function glowPass(g, P, path, k = 1) {
    if (!P.glow) return;
    g.save(); g.shadowColor = P.glow; g.shadowBlur = (8 + P.t * 2) * k; g.fillStyle = rgba(P.glow, 0.5); g.fill(path); g.restore();
  }
  function cloudMotif(g, x, y, r, col) {
    g.strokeStyle = col; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1); g.arc(x + r * 1.6, y + r * 0.2, r * 0.7, Math.PI * 1.1, Math.PI * 2.3); g.stroke();
    g.beginPath(); g.arc(x - r * 0.1, y + r * 0.1, r * 0.45, Math.PI * 1.2, Math.PI * 2.6); g.stroke();
  }
  function scales(g, x0, y0, x1, y1, r, col, colD) {
    for (let y = y0, row = 0; y < y1; y += r * 1.1, row++)
      for (let x = x0 + (row % 2) * r; x < x1; x += r * 2) {
        g.fillStyle = clothGrad(g, col, colD, y - r, y + r);
        g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.7; g.stroke();
      }
  }

  function shirtIcon(g, it, faction) {
    const P = armorPal(it, faction), col = P.col, colD = dark(col, 0.35);
    g.scale(ICON / 100, ICON / 100);
    const body = new Path2D();
    body.moveTo(36, 10); body.lineTo(64, 10); body.quadraticCurveTo(80, 13, 88, 26); body.lineTo(97, 52); body.lineTo(82, 57);
    body.lineTo(74, 40); body.lineTo(76, 93); body.quadraticCurveTo(50, 97, 24, 93); body.lineTo(26, 40); body.lineTo(18, 57); body.lineTo(3, 52);
    body.lineTo(12, 26); body.quadraticCurveTo(20, 13, 36, 10); body.closePath();
    glowPass(g, P, body);
    g.fillStyle = clothGrad(g, P.leather ? '#b0784a' : P.cloth, P.leather ? '#6a4024' : P.clothD, 8, 96); g.fill(body);
    g.save(); g.clip(body);
    // folds & sleeve shading
    g.strokeStyle = rgba(P.line, 0.55); g.lineWidth = 1.1;
    for (const [x0, y0, x1, y1] of [[20, 30, 14, 50], [80, 30, 86, 50], [34, 64, 32, 92], [66, 64, 68, 92], [50, 66, 50, 94]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // sleeve cuffs
    g.fillStyle = col; g.fillRect(0, 48, 22, 10); g.fillRect(78, 48, 22, 10);
    if (P.t >= 3) scales(g, 30, 44, 72, 58, 3.4, lite(col, 0.25), dark(col, 0.25));        // scale armour on the chest
    if (P.t >= 4) { cloudMotif(g, 30, 78, 4, rgba(col, 0.9)); cloudMotif(g, 58, 82, 4, rgba(col, 0.9)); }
    if (P.t === 1) { g.setLineDash([2, 2]); g.strokeStyle = rgba(P.line, 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(25, 88); g.lineTo(75, 88); g.stroke(); g.setLineDash([]); }
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(body);
    // crossed collar
    const collar = new Path2D(); collar.moveTo(36, 10); collar.lineTo(58, 52); collar.lineTo(64, 46); collar.lineTo(64, 10); collar.lineTo(57, 10); collar.lineTo(56, 34); collar.lineTo(43, 10); collar.closePath();
    fillOut(g, collar, clothGrad(g, lite(col, 0.15), colD, 10, 52), 1.2);
    if (P.t >= 5) { g.strokeStyle = '#ffd76a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(38, 11); g.lineTo(58.5, 50); g.stroke(); }
    // sash + buckle
    const sash = new Path2D(); sash.rect(25, 58, 50, 9);
    fillOut(g, sash, clothGrad(g, lite(col, 0.1), colD, 58, 67), 1.1);
    const bw = P.t >= 5 ? 14 : 10;
    rr(g, 50 - bw / 2, 56.5, bw, 12, 2); g.fillStyle = metalGrad(g, P.metal, 0, 56, 0, 68); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    if (P.t >= 5) gemAt(g, 50, 62.5, 3.4, P.glow || col);
    // sash tails
    const tails = new Path2D(); tails.moveTo(44, 67); tails.lineTo(40, 86); tails.lineTo(45, 84); tails.lineTo(48, 67); tails.moveTo(52, 67); tails.lineTo(56, 88); tails.lineTo(60, 85); tails.lineTo(56, 67);
    fillOut(g, tails, colD, 0.9);
    // hem trim
    g.strokeStyle = P.t >= 6 ? '#ffd76a' : col; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(25, 91.5); g.quadraticCurveTo(50, 95.5, 75, 91.5); g.stroke();
    if (P.t >= 6) {                                       // dragon roundel on the chest
      g.save(); g.translate(36, 38);
      g.fillStyle = metalGrad(g, 'gold', -6, -6, 6, 6); g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = dark(col, 0.5); g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, 3.5, 0.3, Math.PI * 1.7); g.stroke();
      g.fillStyle = dark(col, 0.5); g.beginPath(); g.arc(3.3, -1.4, 1.1, 0, TAU); g.fill();
      g.restore();
    }
    if (P.t >= 7) for (const [x, y, r] of [[14, 14, 4], [88, 18, 3.4], [84, 84, 3]]) sparkle(g, x, y, r, '#ffffff');
  }

  function pantsIcon(g, it, faction) {
    const P = armorPal(it, faction), col = P.col;
    g.scale(ICON / 100, ICON / 100);
    const fab = P.leather ? ['#9a6a40', '#5a3a20'] : faction === 'adharma' ? ['#3a2a30', '#120c10'] : [dark(col, 0.45), dark(col, 0.72)];
    const legs = new Path2D();
    legs.moveTo(22, 12); legs.lineTo(78, 12); legs.quadraticCurveTo(86, 40, 84, 70); legs.lineTo(56, 70); legs.lineTo(51, 34); legs.lineTo(46, 70);
    legs.lineTo(16, 70); legs.quadraticCurveTo(14, 40, 22, 12); legs.closePath();
    glowPass(g, P, legs, 0.8);
    g.fillStyle = clothGrad(g, fab[0], fab[1], 10, 72); g.fill(legs);
    g.save(); g.clip(legs);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.2;
    for (const [x0, x1] of [[30, 26], [38, 36], [64, 66], [72, 76]]) { g.beginPath(); g.moveTo(x0, 22); g.quadraticCurveTo(x0 - 2, 45, x1, 68); g.stroke(); }
    // side stripes
    g.strokeStyle = col; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(21, 20); g.quadraticCurveTo(17, 45, 18, 68); g.moveTo(79, 20); g.quadraticCurveTo(83, 45, 82, 68); g.stroke();
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(legs);
    // waistband
    rr(g, 20, 9, 60, 10, 2); g.fillStyle = clothGrad(g, lite(col, 0.15), dark(col, 0.3), 9, 19); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke();
    rr(g, 45, 8, 10, 12, 2); g.fillStyle = metalGrad(g, P.metal, 0, 8, 0, 20); g.fill(); g.strokeStyle = OUT; g.stroke();
    if (P.t >= 5) gemAt(g, 50, 14, 2.6, P.glow || col);
    // knee guards
    if (P.t >= 3) for (const x of [31, 69]) {
      const k = new Path2D(); k.moveTo(x - 7, 46); k.quadraticCurveTo(x, 38, x + 7, 46); k.lineTo(x + 6, 55); k.quadraticCurveTo(x, 59, x - 6, 55); k.closePath();
      fillOut(g, k, metalGrad(g, P.metal, x - 7, 40, x + 7, 58), 1);
      if (P.t >= 5) gemAt(g, x, 48.5, 1.8, P.glow || col);
    }
    // boots
    const bootTop = P.t >= 6 ? metalGrad(g, 'gold', 0, 66, 0, 94) : clothGrad(g, '#7a5636', '#3a2616', 66, 94);
    for (const s of [-1, 1]) {
      const b = new Path2D(), x = 50 + s * 19;
      b.moveTo(x - 12, 66); b.lineTo(x + 12, 66); b.lineTo(x + 11, 82); b.lineTo(x + s * 17, 86); b.quadraticCurveTo(x + s * 18, 94, x + s * 10, 94);
      b.lineTo(x - s * 13, 94); b.lineTo(x - s * 12, 82); b.closePath();
      fillOut(g, b, bootTop, 1.3);
      g.strokeStyle = col; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - 11.5, 69); g.lineTo(x + 11.5, 69); g.stroke();
      if (P.t >= 3) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 9, 76); g.lineTo(x + 9, 76); g.stroke(); }
    }
    if (P.t >= 7) for (const [x, y, r] of [[12, 22, 3.6], [90, 40, 3], [50, 86, 3]]) sparkle(g, x, y, r, '#ffffff');
  }

  function bracerIcon(g, it, faction) {
    const P = armorPal(it, faction), col = P.col;
    g.scale(ICON / 100, ICON / 100);
    const base = P.leather ? ['#a4703e', '#5a3a1e'] : [dark(col, 0.35), dark(col, 0.7)];
    for (const [x, rot, mir] of [[30, -0.22, -1], [70, 0.22, 1]]) {
      g.save(); g.translate(x, 52); g.rotate(rot);
      const arm = new Path2D(); arm.moveTo(-13, -36); arm.lineTo(13, -36); arm.quadraticCurveTo(18, 0, 16, 34); arm.lineTo(-16, 34); arm.quadraticCurveTo(-18, 0, -13, -36); arm.closePath();
      glowPass(g, P, arm, 0.8);
      const gr = g.createLinearGradient(-16, 0, 16, 0);
      gr.addColorStop(0, base[1]); gr.addColorStop(0.45, lite(base[0], 0.25)); gr.addColorStop(1, base[1]);
      g.fillStyle = gr; g.fill(arm); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke(arm);
      // straps / bands
      for (const y of [-34, 30]) { rr(g, -16, y - 3, 32, 7, 2); g.fillStyle = metalGrad(g, P.metal, 0, y - 3, 0, y + 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke(); }
      if (P.t <= 2) { g.strokeStyle = rgba('#000000', 0.4); g.lineWidth = 1.2; for (const y of [-14, 0, 14]) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y + 2); g.stroke(); } }
      // centre plate
      if (P.t >= 2) {
        const pl = new Path2D(); pl.moveTo(0, -27); pl.lineTo(10 * mir * mir, -14); pl.lineTo(9, 18); pl.lineTo(0, 26); pl.lineTo(-9, 18); pl.lineTo(-10, -14); pl.closePath();
        fillOut(g, pl, clothGrad(g, lite(col, 0.25), dark(col, 0.3), -27, 26), 1);
        g.strokeStyle = P.t >= 5 ? '#ffd76a' : 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.stroke(pl);
      }
      if (P.t >= 4) { g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 0.9; cloudMotif(g, -3, -2, 3, rgba('#ffffff', 0.55)); }
      if (P.t >= 5) gemAt(g, 0, 4, 4, P.glow || col);
      if (P.t >= 6) {                                      // flared spikes along the outer edge
        const sp = new Path2D();
        for (const y of [-22, -8, 6]) { sp.moveTo(mir * 15, y); sp.lineTo(mir * 24, y - 6); sp.lineTo(mir * 16, y + 5); }
        fillOut(g, sp, metalGrad(g, 'gold', 0, -30, 0, 10), 0.8);
      }
      g.restore();
    }
    if (P.t >= 7) for (const [x, y, r] of [[50, 14, 4], [12, 86, 3], [90, 88, 3]]) sparkle(g, x, y, r, '#ffffff');
  }

  function shoulderIcon(g, it, faction) {
    const P = armorPal(it, faction), col = P.col;
    g.scale(ICON / 100, ICON / 100);
    // drawn larger than the others: pauldrons are wide and flat
    g.translate(50, 52); g.scale(0.94, 1.12); g.translate(-50, -50);
    for (const s of [-1, 1]) {
      g.save(); g.translate(50 + s * 23, 46); g.scale(s, 1);
      // layered plates from the bottom up
      const layers = P.t >= 3 ? 3 : 2;
      for (let k = layers - 1; k >= 0; k--) {
        const y = k * 11, w = 23 - k * 1.5;
        const plate = new Path2D();
        plate.moveTo(-w + 4, y - 10); plate.quadraticCurveTo(-2, y - 22, w, y - 6); plate.quadraticCurveTo(w + 3, y + 6, w - 2, y + 10);
        plate.quadraticCurveTo(0, y + 5, -w + 2, y + 9); plate.quadraticCurveTo(-w - 2, y, -w + 4, y - 10); plate.closePath();
        if (k === 0) glowPass(g, P, plate, 0.8);
        const isMetal = P.t >= 3 || k === 0;
        fillOut(g, plate, isMetal && P.t >= 3 ? metalGrad(g, P.t >= 6 ? 'gold' : 'steel', -w, y - 18, w, y + 10) : clothGrad(g, P.leather ? '#b0784a' : lite(col, 0.15), P.leather ? '#5a3a1e' : dark(col, 0.45), y - 18, y + 10), 1.3);
        // coloured inlay on each plate
        g.strokeStyle = col; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(-w + 5, y + 4); g.quadraticCurveTo(0, y - 1, w - 3, y + 5); g.stroke();
        // rivets
        g.fillStyle = P.t >= 5 ? '#fff0a8' : '#d8dde4';
        for (const x of [-w + 8, 0, w - 7]) { g.beginPath(); g.arc(x, y - 4, 1.3, 0, TAU); g.fill(); }
      }
      if (P.t >= 5) gemAt(g, 2, -6, 3.6, P.glow || col);
      if (P.t >= 6) {                                       // swept horn / feather crest
        const h = new Path2D(); h.moveTo(8, -12); h.bezierCurveTo(16, -22, 22, -28, 30, -30); h.bezierCurveTo(24, -22, 20, -14, 18, -6); h.closePath();
        fillOut(g, h, metalGrad(g, 'gold', 8, -30, 30, -6), 1);
      }
      g.restore();
    }
    // linking chain / strap across
    g.strokeStyle = P.t >= 5 ? '#d9a640' : '#6a5a48'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(36, 34); g.quadraticCurveTo(50, 42, 64, 34); g.stroke();
    if (P.t >= 7) for (const [x, y, r] of [[50, 22, 3.4], [16, 74, 2.4], [84, 72, 2.4]]) sparkle(g, x, y, r, '#ffffff');
  }

  const ARMOR_ICON = { body: shirtIcon, legs: pantsIcon, arms: bracerIcon, shoulder: shoulderIcon };
  // ---------------------------------------------------------------- นักพรต outfit icons
  // Taoist robe, loose trousers with leg wraps, wide sleeve cuffs and a cloud shawl: cloth with talisman / bagua /
  // jade / lotus details by set instead of the twin blades' scale armour, plates and horns
  function taoPaper(g, x, y, w, h, faction) {
    const p = new Path2D(); p.rect(x - w / 2, y, w, h);
    fillOut(g, p, faction === 'adharma' ? '#4a2058' : '#f2d36a', 0.7);
    g.strokeStyle = faction === 'adharma' ? '#ff4a5a' : '#c3262c'; g.lineWidth = Math.max(0.8, w * 0.14);
    g.beginPath(); g.moveTo(x, y + h * 0.12); g.lineTo(x, y + h * 0.85); g.moveTo(x - w * 0.28, y + h * 0.3); g.lineTo(x + w * 0.28, y + h * 0.4); g.moveTo(x - w * 0.28, y + h * 0.58); g.lineTo(x + w * 0.28, y + h * 0.66); g.stroke();
  }
  function taoTaiji(g, x, y, r) {
    g.fillStyle = '#f6f6f0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = '#16161e'; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2); g.arc(x, y + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(x, y - r / 2, r / 2, Math.PI / 2, -Math.PI / 2); g.fill();
    g.fillStyle = '#f6f6f0'; g.beginPath(); g.arc(x, y + r / 2, r / 6, 0, TAU); g.fill();
    g.fillStyle = '#16161e'; g.beginPath(); g.arc(x, y - r / 2, r / 6, 0, TAU); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }
  function taoLotus(g, x, y, r, col) {
    for (const a of [-0.75, -0.25, 0.25, 0.75]) {
      g.save(); g.translate(x, y); g.rotate(a);
      const p = new Path2D(); p.moveTo(0, 0); p.quadraticCurveTo(r * 0.5, -r * 0.6, 0, -r * 1.2); p.quadraticCurveTo(-r * 0.5, -r * 0.6, 0, 0);
      fillOut(g, p, metalGrad(g, 'gold', 0, -r, 0, 0), 0.6); g.restore();
    }
    gemAt(g, x, y - r * 0.2, r * 0.32, col);
  }
  const taoCloth = (P, faction) => (faction === 'adharma' ? ['#3a2e34', '#120c10'] : ['#ffffff', '#d4deec']);
  function taoRobe(g, it, faction) {
    const P = armorPal(it, faction), col = P.col, [c0, c1] = taoCloth(P, faction);
    g.scale(ICON / 100, ICON / 100);
    // long robe with wide hanging sleeves
    const body = new Path2D();
    body.moveTo(38, 8); body.lineTo(62, 8); body.quadraticCurveTo(78, 12, 86, 24); body.lineTo(97, 62); body.lineTo(78, 66);
    body.lineTo(72, 44); body.lineTo(76, 96); body.quadraticCurveTo(50, 99, 24, 96); body.lineTo(28, 44); body.lineTo(22, 66); body.lineTo(3, 62);
    body.lineTo(14, 24); body.quadraticCurveTo(22, 12, 38, 8); body.closePath();
    glowPass(g, P, body);
    g.fillStyle = clothGrad(g, c0, c1, 8, 98); g.fill(body);
    g.save(); g.clip(body);
    g.strokeStyle = rgba(P.line, 0.5); g.lineWidth = 1.1;
    for (const [x0, y0, x1, y1] of [[18, 30, 10, 60], [82, 30, 90, 60], [34, 66, 32, 95], [66, 66, 68, 95]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // wide sleeve hems in the set colour
    g.fillStyle = col; g.beginPath(); g.moveTo(3, 62); g.lineTo(22, 66); g.lineTo(23, 60); g.lineTo(5, 55); g.fill();
    g.beginPath(); g.moveTo(97, 62); g.lineTo(78, 66); g.lineTo(77, 60); g.lineTo(95, 55); g.fill();
    // robe front trim
    g.fillStyle = col; g.fillRect(47, 60, 6, 38);
    if (P.t === 2 || P.t === 4) { cloudMotif(g, 30, 80, 4, rgba(col, 0.9)); cloudMotif(g, 60, 84, 4, rgba(col, 0.9)); }
    if (P.t === 3) { g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.4; for (const [x, y, b] of [[32, 82, 5], [66, 82, 2]]) for (let k = 0; k < 3; k++) { g.beginPath(); if ((b >> k) & 1) { g.moveTo(x - 6, y + k * 4); g.lineTo(x + 6, y + k * 4); } else { g.moveTo(x - 6, y + k * 4); g.lineTo(x - 1.5, y + k * 4); g.moveTo(x + 1.5, y + k * 4); g.lineTo(x + 6, y + k * 4); } g.stroke(); } }
    if (P.t >= 6) { g.strokeStyle = '#ffd76a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(24, 94.5); g.quadraticCurveTo(50, 98, 76, 94.5); g.stroke(); }
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(body);
    // crossed collar
    const collar = new Path2D(); collar.moveTo(38, 8); collar.lineTo(58, 50); collar.lineTo(63, 45); collar.lineTo(62, 8); collar.lineTo(56, 8); collar.lineTo(55, 32); collar.lineTo(44, 8); collar.closePath();
    fillOut(g, collar, clothGrad(g, lite(col, 0.15), dark(col, 0.35), 8, 50), 1.2);
    if (P.t >= 5) { g.strokeStyle = '#ffd76a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(40, 9); g.lineTo(58.5, 48); g.stroke(); }
    // cloth sash, a hanging talisman / gourd
    const sash = new Path2D(); sash.rect(27, 56, 46, 8);
    fillOut(g, sash, clothGrad(g, faction === 'adharma' ? '#8a1a2a' : '#2a4a8a', faction === 'adharma' ? '#3a0610' : '#10224a', 56, 64), 1.1);
    if (P.t === 3 || P.t === 1) taoPaper(g, 66, 63, 7, 18, faction);
    if (P.t >= 2) { const gd = new Path2D(); gd.arc(34, 70, 4, 0, TAU); gd.arc(34, 63.5, 2.6, 0, TAU); fillOut(g, gd, faction === 'adharma' ? '#2a2026' : '#e0b860', 0.8); }
    // chest emblem by set: taiji (3+), jade disc (5), gold lotus (6+)
    if (P.t >= 6) taoLotus(g, 50, 40, 7, P.glow || col);
    else if (P.t === 5) { gemAt(g, 50, 60, 3.6, P.glow || col); taoTaiji(g, 38, 34, 5); }
    else if (P.t >= 3) taoTaiji(g, 38, 34, 5);
    if (P.t >= 7) for (const [x, y, r] of [[12, 14, 4], [88, 18, 3.4], [84, 86, 3]]) sparkle(g, x, y, r, '#ffffff');
  }
  function taoPants(g, it, faction) {
    const P = armorPal(it, faction), col = P.col;
    g.scale(ICON / 100, ICON / 100);
    const fab = faction === 'adharma' ? ['#2e2428', '#0e0a0c'] : ['#2a3a6a', '#121a3a'];
    // loose trousers gathered at the shins
    const legs = new Path2D();
    legs.moveTo(22, 10); legs.lineTo(78, 10); legs.quadraticCurveTo(90, 38, 82, 62); legs.lineTo(58, 62); legs.lineTo(51, 32); legs.lineTo(44, 62);
    legs.lineTo(18, 62); legs.quadraticCurveTo(10, 38, 22, 10); legs.closePath();
    glowPass(g, P, legs, 0.8);
    g.fillStyle = clothGrad(g, fab[0], fab[1], 10, 64); g.fill(legs);
    g.save(); g.clip(legs);
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1.2;
    for (const [x0, x1] of [[28, 24], [38, 36], [64, 66], [74, 78]]) { g.beginPath(); g.moveTo(x0, 18); g.quadraticCurveTo(x0 - 3, 40, x1, 60); g.stroke(); }
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(legs);
    // cloth waistband with a tie
    rr(g, 20, 7, 60, 9, 2); g.fillStyle = clothGrad(g, lite(col, 0.15), dark(col, 0.3), 7, 16); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(50, 15); g.lineTo(46, 26); g.moveTo(50, 15); g.lineTo(55, 25); g.stroke();
    // leg wraps + cloth shoes
    const wrap = faction === 'adharma' ? ['#4a3a40', '#1a1216'] : ['#ffffff', '#cfd8e6'];
    for (const s of [-1, 1]) {
      const x = 50 + s * 19, w = new Path2D();
      w.moveTo(x - 11, 60); w.lineTo(x + 11, 60); w.lineTo(x + 9, 84); w.lineTo(x - 9, 84); w.closePath();
      fillOut(g, w, clothGrad(g, wrap[0], wrap[1], 60, 84), 1.1);
      g.save(); g.clip(w); g.strokeStyle = rgba(P.line, 0.7); g.lineWidth = 1; for (let y = 58; y < 90; y += 4.5) { g.beginPath(); g.moveTo(x - 12, y + 3); g.lineTo(x + 12, y - 2); g.stroke(); } g.restore();
      // band per set: cord, talisman, gold trim, jade, gold cloud
      if (P.t === 2) { g.strokeStyle = '#c8a46a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 10, 64); g.lineTo(x + 10, 65); g.stroke(); }
      if (P.t === 3) taoPaper(g, x, 61, 6, 14, faction);
      if (P.t === 4 || P.t >= 6) { g.fillStyle = metalGrad(g, P.t === 7 ? 'silver' : 'gold', 0, 60, 0, 64); g.fillRect(x - 11, 60, 22, 3); }
      if (P.t === 5) { g.fillStyle = faction === 'adharma' ? '#c02a3a' : '#2bd68f'; g.fillRect(x - 10.5, 63, 21, 3.5); g.fillStyle = '#e8c86a'; g.fillRect(x - 10.5, 62, 21, 1); g.fillRect(x - 10.5, 66.5, 21, 1); }
      const shoe = new Path2D(); shoe.moveTo(x - 10, 84); shoe.lineTo(x + 10, 84); shoe.quadraticCurveTo(x + s * 18, 87, x + s * 14, 94); shoe.lineTo(x - s * 11, 94); shoe.closePath();
      fillOut(g, shoe, clothGrad(g, faction === 'adharma' ? '#2a1a1e' : '#3a3a48', '#0e0a0c', 84, 94), 1.2);
      if (P.t >= 6) { g.strokeStyle = '#ffd76a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 9, 86); g.lineTo(x + 9, 86); g.stroke(); }
    }
    if (P.t >= 7) for (const [x, y, r] of [[12, 22, 3.6], [90, 40, 3], [50, 86, 3]]) sparkle(g, x, y, r, '#ffffff');
  }
  function taoCuffs(g, it, faction) {
    const P = armorPal(it, faction), col = P.col, [c0, c1] = taoCloth(P, faction);
    g.scale(ICON / 100, ICON / 100);
    for (const [x, rot] of [[30, -0.2], [70, 0.2]]) {
      g.save(); g.translate(x, 50); g.rotate(rot);
      // a wide sleeve end flaring at the wrist
      const sl = new Path2D(); sl.moveTo(-11, -38); sl.lineTo(11, -38); sl.quadraticCurveTo(16, 0, 22, 34); sl.lineTo(-22, 34); sl.quadraticCurveTo(-16, 0, -11, -38); sl.closePath();
      glowPass(g, P, sl, 0.8);
      g.fillStyle = clothGrad(g, c0, c1, -38, 34); g.fill(sl);
      g.save(); g.clip(sl);
      g.strokeStyle = rgba(P.line, 0.5); g.lineWidth = 1; for (const xx of [-6, 0, 6]) { g.beginPath(); g.moveTo(xx * 0.6, -36); g.lineTo(xx * 1.6, 34); g.stroke(); }
      // hem band in the set colour (gold edge from the lotus set)
      g.fillStyle = col; g.fillRect(-24, 22, 48, 12);
      if (P.t >= 6) { g.fillStyle = metalGrad(g, P.t === 7 ? 'silver' : 'gold', 0, 21, 0, 24); g.fillRect(-24, 20.5, 48, 2.4); }
      if (P.t === 2 || P.t === 4) cloudMotif(g, -4, -2, 3.4, rgba(col, 0.9));
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke(sl);
      if (P.t === 3) taoPaper(g, 0, -20, 8, 22, faction);                                   // talisman stuck on the sleeve
      if (P.t === 5) for (let i = 0; i < 6; i++) { gemAt(g, -12 + i * 4.8, -30 + Math.sin(i) * 1.2, 2.1, faction === 'adharma' ? '#c02a3a' : '#2bd68f'); }   // jade bead bracelet
      if (P.t >= 6) taoLotus(g, 0, -6, 6, P.glow || col);
      g.restore();
    }
    if (P.t >= 7) for (const [x, y, r] of [[50, 14, 4], [12, 86, 3], [90, 88, 3]]) sparkle(g, x, y, r, '#ffffff');
  }
  function taoShawl(g, it, faction) {
    const P = armorPal(it, faction), col = P.col, [c0, c1] = taoCloth(P, faction);
    g.scale(ICON / 100, ICON / 100);
    // a short capelet over both shoulders with cloud-shaped ends
    const cape = new Path2D();
    cape.moveTo(38, 24); cape.quadraticCurveTo(50, 32, 62, 24);
    cape.bezierCurveTo(78, 22, 94, 34, 92, 52); cape.quadraticCurveTo(86, 62, 76, 56); cape.quadraticCurveTo(68, 66, 58, 58);
    cape.quadraticCurveTo(50, 66, 42, 58); cape.quadraticCurveTo(32, 66, 24, 56); cape.quadraticCurveTo(14, 62, 8, 52);
    cape.bezierCurveTo(6, 34, 22, 22, 38, 24); cape.closePath();
    glowPass(g, P, cape, 0.9);
    g.fillStyle = clothGrad(g, c0, c1, 22, 64); g.fill(cape);
    g.save(); g.clip(cape);
    g.strokeStyle = col; g.lineWidth = 3.2; g.stroke(cape);                                   // coloured edge
    if (P.t === 2 || P.t === 4) { cloudMotif(g, 22, 42, 4, rgba(col, 0.9)); cloudMotif(g, 70, 42, 4, rgba(col, 0.9)); }
    g.restore();
    g.strokeStyle = P.t >= 6 ? '#ffd76a' : OUT; g.lineWidth = P.t >= 6 ? 1.8 : 1.4; g.stroke(cape);
    // collar ring
    g.strokeStyle = dark(col, 0.2); g.lineWidth = 3; g.beginPath(); g.moveTo(38, 24); g.quadraticCurveTo(50, 33, 62, 24); g.stroke();
    // clasp: cord knot / talisman / jade disc / gold lotus
    if (P.t <= 2) { g.strokeStyle = '#c8a46a'; g.lineWidth = 2; g.beginPath(); g.arc(46, 34, 3, 0, TAU); g.arc(54, 34, 3, 0, TAU); g.stroke(); }
    else if (P.t === 3) { taoTaiji(g, 50, 34, 5); taoPaper(g, 24, 54, 7, 20, faction); taoPaper(g, 76, 54, 7, 20, faction); }
    else if (P.t === 4) { gemAt(g, 50, 34, 3.6, '#e8c86a'); }
    else if (P.t === 5) { const j = new Path2D(); j.arc(50, 34, 6, 0, TAU); j.arc(50, 34, 2.2, 0, TAU, true); g.fillStyle = faction === 'adharma' ? '#c02a3a' : '#2bd68f'; g.fill(j, 'evenodd'); g.strokeStyle = '#e8c86a'; g.lineWidth = 1.2; g.stroke(j); }
    else taoLotus(g, 50, 38, 7, P.glow || col);
    // tassels from the silk set up
    if (P.t >= 4) for (const x of [16, 84]) {
      g.strokeStyle = '#e8c86a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 54); g.lineTo(x, 70); g.stroke();
      g.fillStyle = P.t >= 6 ? '#e8c86a' : faction === 'adharma' ? '#c3262c' : '#3a7ad8'; g.beginPath(); g.ellipse(x, 74, 3, 6, 0, 0, TAU); g.fill();
    }
    if (P.t >= 7) for (const [x, y, r] of [[50, 12, 3.6], [12, 80, 2.6], [88, 80, 2.6]]) sparkle(g, x, y, r, '#ffffff');
  }
  const TAO_ICON = { body: taoRobe, legs: taoPants, arms: taoCuffs, shoulder: taoShawl };

  // นักพรต: the same weapon items are fly-whisks, cut from modelนักพรต/taoist-weapons*.png (tools/build-taoist.js)
  const classIcons = {};
  IA.loadClassIcons = async function (cls) {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const set = (classIcons[cls] = {});
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((t) => [
      load(`assets/items/${cls}-w${t}.png`).then((i) => { set[`dharma${t}`] = i; }),
      load(`assets/items/${cls}-w${t}-a.png`).then((i) => { set[`adharma${t}`] = i; }),
    ]));
  };
  const viewCls = () => (window.G && G.cls) || 'dualblade';
  function whiskIcon(g, it, faction) {
    const set = classIcons[viewCls()], img = set && set[`${faction === 'adharma' ? 'adharma' : 'dharma'}${Math.max(1, it.tier)}`];
    if (!img) return false;
    const S = ICON, k = (S * 1.22) / Math.hypot(img.width, img.height);
    g.save(); g.translate(S / 2, S / 2); g.rotate(0.62);
    g.drawImage(img, (-img.width * k) / 2, (-img.height * k) / 2, img.width * k, img.height * k);
    g.restore();
    if (it.tier >= 8) for (const [x, y, r] of [[0.2, 0.2, 5], [0.82, 0.32, 4], [0.7, 0.86, 3.5]]) sparkle(g, S * x, S * y, r, '#ffffff');
    return true;
  }
  // นักธนู: the same weapon items are bows, drawn here: wood limbs (iron / gold / the set's metal as the tier
  // rises), the faction accent from tier 4, a gem on the grip from tier 5, and an arrow on the string
  function bowIcon(g, it, faction) {
    if (window.ArcherGear) { ArcherGear.icon(g, it.tier, faction, ICON); return; }
    const d = design(it.tier, faction), S = ICON, A = ACC[faction === 'adharma' ? 'adharma' : 'dharma'];
    const glowCol = d.glow || (it.tier >= 2 ? A.main : null);
    if (glowCol && it.tier >= 3) {
      const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.55);
      gr.addColorStop(0, rgba(glowCol, 0.32)); gr.addColorStop(1, rgba(glowCol, 0));
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    g.save(); g.translate(S / 2 + 6, S / 2); g.rotate(0.62);
    const H = 52, bow = new Path2D();
    bow.moveTo(4, -H); bow.quadraticCurveTo(-30, -H * 0.55, -22, 0); bow.quadraticCurveTo(-30, H * 0.55, 4, H);
    // limbs: dark outline, then wood / metal
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 9; g.stroke(bow);
    g.strokeStyle = it.tier <= 1 ? '#8a5a32' : metalGrad(g, d.guardMetal || 'iron', -30, -H, 4, H); g.lineWidth = 6; g.stroke(bow);
    if (it.tier >= 4) { g.strokeStyle = A.main; g.lineWidth = 2; g.stroke(bow); }
    // string and the arrow on it
    g.strokeStyle = '#f2ead8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(4, -H); g.lineTo(4, H); g.stroke();
    if (it.tier >= 1) {
      g.strokeStyle = '#e8d8b0'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(8, 0); g.lineTo(-44, 0); g.stroke();
      g.fillStyle = glowCol || '#cfd6de'; g.beginPath(); g.moveTo(-52, 0); g.lineTo(-40, -5); g.lineTo(-40, 5); g.closePath(); g.fill();
      g.fillStyle = A.main; g.beginPath(); g.moveTo(8, 0); g.lineTo(14, -5); g.lineTo(11, 0); g.lineTo(14, 5); g.closePath(); g.fill();
    }
    // grip wrap and tips
    g.fillStyle = '#4a2c18'; g.fillRect(-27, -8, 10, 16);
    g.strokeStyle = '#c8a46a'; g.lineWidth = 1; for (let y = -6; y <= 6; y += 4) { g.beginPath(); g.moveTo(-27, y); g.lineTo(-17, y + 2); g.stroke(); }
    if (it.tier >= 5) gemAt(g, -22, 0, 3.6, glowCol || A.main);
    for (const y of [-H, H]) { g.fillStyle = it.tier >= 6 ? '#e8c86a' : '#c8c8c8'; g.beginPath(); g.arc(4, y, 3, 0, TAU); g.fill(); }
    g.restore();
    if (it.tier >= 8) for (const [x, y, r] of [[0.2, 0.2, 5], [0.82, 0.32, 4], [0.7, 0.86, 3.5]]) sparkle(g, S * x, S * y, r, '#ffffff');
  }
  // Lv.50 silk-and-jade outfit: split panels, diagonal binding and faceted jade.
  // Draw complete slot silhouettes rather than reusing the Lv.40 cloud-silk icon.
  function windJadeIcon(g,slot,faction,cls) {
    const darkSide=faction==='adharma',cloth=darkSide?'#783652':'#298a78',edge=darkSide?'#ecbed6':'#e8d7a5',gem=darkSide?'#f48ac3':'#91ffe0';
    const poly=(pts,fill=cloth)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=edge;g.lineWidth=2;g.stroke();};
    const jade=(x,y,r)=>poly([[x,y-r],[x+r*.65,y],[x,y+r],[x-r*.65,y]],gem);
    g.save();g.translate(64,64);g.rotate(-.12);
    if(slot==='body'){
      const hem=cls==='taoist'?51:cls==='archer'?38:44;
      poly([[-13,-45],[-30,-38],[-50,-15],[-34,-4],[-26,-18],[-25,hem],[-5,hem-9],[0,20],[6,hem-5],[27,hem], [25,-18],[36,-5],[49,-17],[30,-38],[13,-45],[0,-31]]);
      poly([[-13,-43],[4,-23],[20,11],[9,16],[-23,-26]],edge);
      poly([[-25,9],[25,9],[25,18],[-25,18]],darkSide?'#321c30':'#164d46');jade(0,14,9);
      for(const s of [-1,1]){poly([[s*12,23],[s*23,27],[s*21,hem-5],[s*10,hem-10]],darkSide?'#a25079':'#57b49b');jade(s*17,33,5);}
    }else if(slot==='legs'){
      poly([[-27,-43],[27,-43],[30,-13],[22,47],[3,47],[0,-5],[-5,47],[-24,47],[-30,-13]]);
      poly([[-28,-43],[28,-43],[27,-32],[-28,-32]],edge);
      for(const s of [-1,1]){poly([[s*7,-19],[s*25,-23],[s*22,16],[s*9,23]],darkSide?'#a25079':'#57b49b');jade(s*16,-1,10);poly([[s*5,32],[s*23,30],[s*22,43],[s*4,43]],edge);}
    }else if(slot==='arms'){
      for(const s of [-1,1]){g.save();g.translate(s*25,0);g.rotate(s*.2);poly([[-16,-36],[13,-42],[18,25],[6,43],[-15,27]]);poly([[-16,-29],[14,-34],[15,-22],[-15,-17]],edge);poly([[-15,20],[16,17],[7,34],[-13,29]],edge);jade(0,-1,17);g.restore();}
    }else{
      for(const s of [-1,1]){poly([[s*4,-27],[s*25,-42],[s*49,-24],[s*42,-6],[s*24,6],[s*6,-8]]);poly([[s*8,-8],[s*24,6],[s*42,-6],[s*36,17],[s*20,26],[s*9,11]],darkSide?'#a25079':'#57b49b');jade(s*25,-21,10);for(let i=0;i<3;i++)jade(s*(16+i*8),25+i%2*8,5);}
    }
    g.restore();
  }
  // consumables (potions, the town scroll): no slot/tier, drawn as a bottle or a paper scroll
  function potionIcon(g, it) {
    const hp = it.kind !== 'mp';
    const tier = it.id.endsWith('L') ? 2 : it.id.endsWith('M') ? 1 : 0;
    const col = hp ? ['#ff9a8a', '#ff5a3a', '#c3262c'] : ['#9adcff', '#5aa8ff', '#2a6fd0'];
    g.save(); g.translate(64, 64);
    g.fillStyle = '#d8d0c0'; g.fillRect(-10, -46, 20, 14);
    g.fillStyle = '#7a5a3a'; g.fillRect(-12, -52, 24, 8);
    const r = 26 + tier * 5;
    const lg = g.createLinearGradient(0, -r, 0, r + 14); lg.addColorStop(0, col[0]); lg.addColorStop(0.5, col[1]); lg.addColorStop(1, col[2]);
    g.fillStyle = lg; g.beginPath(); g.arc(0, 14, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-r * 0.35, 2, r * 0.22, r * 0.4, 0.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 14, r, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < tier; i++) { g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.5 + i * 10, r + 6, 3, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function scrollIcon(g) {
    g.save(); g.translate(64, 64);
    g.fillStyle = '#e8dcae'; g.fillRect(-28, -20, 56, 40);
    g.fillStyle = '#c9a85c'; g.beginPath(); g.ellipse(0, -20, 28, 7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, 20, 28, 7, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6a2a'; g.lineWidth = 2; g.strokeRect(-28, -20, 56, 40);
    g.fillStyle = '#6a8fd8';
    g.beginPath(); g.moveTo(-10, -4); g.lineTo(10, -4); g.lineTo(10, 10); g.lineTo(0, 18); g.lineTo(-10, 10); g.closePath(); g.fill();
    g.restore();
  }
  IA.iconCanvas = function (id, faction, size = ICON) {
    const base = C.ITEMS[id];
    const c = mk(size, size), g = c.getContext('2d');
    g.scale(size / ICON, size / ICON);
    if (base.kind) { (base.kind === 'warp' ? scrollIcon : potionIcon)(g, base); return c; }
    const it = base.slot === 'weapon' ? base : { ...base, tier: C.armorLookTier(base.tier) };
    if (it.slot === 'weapon' && viewCls() === 'warrior' && window.WarriorWeapons) {
      WarriorWeapons.icon(g,it.tier,faction,ICON);return c;
    }
    if(base.slot!=='weapon' && base.tier===10){windJadeIcon(g,base.slot,faction,viewCls());return c;}
    if (it.slot !== 'weapon' && it.tier >= 8) { AscendedGear.icon(g, it.slot, viewCls(), it.tier, faction, ICON); return c; }
    if (it.slot === 'weapon' && viewCls() === 'taoist' && it.tier >= 11) { AscendedGear.whiskIcon(g, it.tier, faction, ICON); return c; }
    if (it.slot === 'weapon' && viewCls() === 'spearman') SpearmanLook.icon(g, faction, ICON, it.tier);
    else if (it.slot === 'weapon' && viewCls() === 'archer') bowIcon(g, it, faction);
    else if (it.slot === 'weapon' && viewCls() !== 'dualblade' && whiskIcon(g, it, faction)) { /* class weapon art */ }
    else if (it.slot === 'weapon' && viewCls() === 'arbiter') ArbiterLook.weaponIcon(g,it,faction,ICON);
    else if (it.slot === 'weapon') weaponIcon(g, it, faction);
    else if (viewCls() === 'archer' && ARMOR_ICON[it.slot] && window.ArcherGear) ArcherGear.armourIcon(g, it.slot, it.tier, faction, ICON);
    else if (viewCls() === 'taoist' && TAO_ICON[it.slot]) TAO_ICON[it.slot](g, it, faction);
    else (ARMOR_ICON[it.slot] || shirtIcon)(g, it, faction);
    return c;
  };
  IA.iconSrc = function (id, faction) {
    const k = id + '|' + faction + '|' + viewCls();
    if (!iconCache[k]) iconCache[k] = IA.iconCanvas(id, faction).toDataURL();
    return iconCache[k];
  };
})();
