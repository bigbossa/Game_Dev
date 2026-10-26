// Procedural world art: terrain chunks, props, buildings, minimap.
(function () {
  const { TILE, T } = C;
  const Art = {};
  window.Art = Art;

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const hash = (x, y, s = 0) => {
    // Independent seed channels prevent grit x/y coordinates forming diagonal stripes.
    let h = Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  // colours are hex strings or [r,g,b] arrays; mix() returns an array, shade() returns a css string
  const rgb = (c) => (Array.isArray(c) ? c : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  const mix = (c1, c2, t) => { const a = rgb(c1), b = rgb(c2); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  const shade = (c, f) => { const a = rgb(c); return `rgb(${Math.min(255, a[0] * f) | 0},${Math.min(255, a[1] * f) | 0},${Math.min(255, a[2] * f) | 0})`; };
  Art.hash = hash;
  // Shared warm upper-left lighting and cool ambient shadows.
  function volume(g, x, y, rx, ry, base) {
    g.fillStyle = base;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    const grad = g.createRadialGradient(x - rx * .35, y - ry * .4, 1, x, y, Math.max(rx, ry) * 1.15);
    grad.addColorStop(0, 'rgba(255,249,206,.55)'); grad.addColorStop(.48, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(29,54,61,.32)');
    g.fillStyle = grad; g.fill();
  }
  function softShadow(g, x, y, rx, ry) {
    g.save(); g.translate(x, y); g.scale(rx, ry);
    const grad = g.createRadialGradient(0, 0, .1, 0, 0, 1);
    grad.addColorStop(0, 'rgba(36,60,58,.30)'); grad.addColorStop(.5, 'rgba(36,60,58,.18)');
    grad.addColorStop(1, 'rgba(36,60,58,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
  }

  // ------------------------------------------------------------------ props
  const TREE_PAL = [
    ['#386b57', '#49896a', '#6ca778', '#92c58a', '#c6e4a6'],   // 0 round green
    ['#33594f', '#477968', '#639680', '#83b49a', '#bbd7ad'],   // 1 pine
    ['#8c3d5e', '#c76a8f', '#e58fb0', '#f6b6cc', '#ffe0ea'],   // 2 sakura
    ['#4a0a10', '#6e1018', '#9c1c24', '#c9343a', '#ef6a5a'],   // 3 crimson maple
    ['#1e1924', '#2b2430', '#3b3242', '#4d4157', '#6b5a7a'],   // 4 dusk tree
    ['#2a4a52', '#36606a', '#4a7a82', '#e8f2fa', '#ffffff'],   // 5 snowy pine
    ['#2a1e1a', '#3a2a24', '#4a362e', '#5a4238', '#ff7a2a'],   // 6 dead / charred tree
    ['#3a6a2a', '#4f8a36', '#6aa848', '#8ac85a', '#c8e88a'],   // 7 bamboo
  ];
  function drawTree(v, seed) {
    const [c, g] = mk(120, 160);
    const r = C.mulberry32(seed * 7919 + v * 31 + 1);
    const pal = TREE_PAL[v];
    const bx = 60, by = 150;
    softShadow(g, bx + 6, by - 1, 49, 12);
    // trunk
    const trunk = v === 2 || v === 4 ? '#806076' : v === 3 ? '#815653' : '#987653';
    const wood = g.createLinearGradient(bx - 10, 0, bx + 11, 0);
    wood.addColorStop(0, '#c5a17a'); wood.addColorStop(.4, trunk); wood.addColorStop(1, '#5e514b');
    g.fillStyle = wood;
    g.beginPath(); g.moveTo(bx - 9, by - 2); g.lineTo(bx - 5, by - 52); g.lineTo(bx + 5, by - 52); g.lineTo(bx + 10, by - 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,239,200,0.24)'; g.fillRect(bx - 4, by - 50, 3, 46);
    for (const k of [-1, 1]) {
      g.strokeStyle = trunk; g.lineCap = 'round'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(bx + k * 4, by - 10); g.quadraticCurveTo(bx + k * 9, by - 2, bx + k * 17, by - 2); g.stroke();
    }
    if (v === 6) {
      // bare branches (charred on the fire map: glowing embers in the cracks)
      g.strokeStyle = pal[2]; g.lineCap = 'round';
      const branch = (x, y, a, len, w) => {
        if (len < 8) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, a - 0.45 - r() * 0.3, len * 0.68, w * 0.65);
        branch(x2, y2, a + 0.4 + r() * 0.3, len * 0.62, w * 0.65);
      };
      branch(bx, by - 50, -Math.PI / 2 + (r() - 0.5) * 0.3, 40, 7);
      g.fillStyle = pal[4]; g.globalAlpha = 0.7;
      for (let i = 0; i < 4; i++) g.fillRect(bx - 4 + r() * 6, by - 46 + r() * 36, 2, 3 + r() * 4);
      g.globalAlpha = 1;
      return c;
    }
    if (v === 7) {
      // bamboo cluster
      for (let i = 0; i < 6; i++) {
        const x = bx - 26 + i * 10 + (r() - 0.5) * 6, top = by - 110 - r() * 36;
        g.fillStyle = pal[i % 2 ? 1 : 2]; g.fillRect(x - 3, top, 6, by - 4 - top);
        g.fillStyle = pal[0]; for (let y = top + 14; y < by - 6; y += 18) g.fillRect(x - 3.5, y, 7, 2);
        g.fillStyle = pal[3 + (i % 2)];
        for (let k = 0; k < 4; k++) {
          const ly = top + 6 + k * 22, s = k % 2 ? 1 : -1;
          g.beginPath(); g.ellipse(x + s * 10, ly, 11, 2.6, s * 0.4, 0, Math.PI * 2); g.fill();
        }
      }
      return c;
    }
    if (v === 1 || v === 5) {
      // layered pine (v5 carries snow on every layer)
      for (let i = 0; i < 4; i++) {
        const w = 46 - i * 9, y = by - 36 - i * 24;
        const tier = g.createLinearGradient(bx - w, y - 25, bx + w, y + 10);
        tier.addColorStop(0, pal[Math.min(4, i + 1)]); tier.addColorStop(1, pal[Math.min(2, i)]);
        g.fillStyle = tier;
        g.beginPath(); g.moveTo(bx - w, y);
        g.quadraticCurveTo(bx - w * .35, y - 17, bx, y - 44);
        g.quadraticCurveTo(bx + w * .35, y - 17, bx + w, y);
        g.quadraticCurveTo(bx, y + 20, bx - w, y);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(238,255,222,.22)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx - w + 5, y); g.quadraticCurveTo(bx - w * .35, y - 17, bx, y - 39); g.stroke();
        if (v === 5) {
          g.fillStyle = i % 2 ? pal[3] : pal[4];
          g.beginPath(); g.moveTo(bx - w * 0.75, y - 6); g.quadraticCurveTo(bx - w * 0.3, y - 14, bx, y - 44);
          g.quadraticCurveTo(bx + w * 0.35, y - 14, bx + w * 0.8, y - 6); g.quadraticCurveTo(bx, y - 16, bx - w * 0.75, y - 6); g.fill();
        }
      }
      return c;
    }
    // Broken leafy crowns, layered from shaded branches to sun-facing foliage.
    for(const [dx,dy,rad,col]of [[0,-73,39,0],[-26,-91,28,1],[27,-91,27,1],[8,-118,27,2],[-17,-113,30,2],[4,-91,31,3]]){
      const x=bx+dx,y=by+dy;g.beginPath();
      for(let n=0;n<22;n++){const a=n*Math.PI*2/22,rr=rad*(.8+r()*.2);const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.83;n?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.closePath();
      const light=g.createLinearGradient(x-rad,y-rad,x+rad,y+rad);light.addColorStop(0,shade(pal[col],.92));light.addColorStop(1,shade(pal[0],.65));g.fillStyle=light;g.fill();
      for(let n=0;n<70;n++){const a=r()*Math.PI*2,rr=Math.sqrt(r())*rad*.85,xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr*.78;
        g.fillStyle=shade(pal[Math.min(4,col+(yy<y?1:0))],.70+r()*.37);g.beginPath();g.ellipse(xx,yy,2+r()*3,1+r()*1.4,-.5+r(),0,Math.PI*2);g.fill();}
    }
    if (v === 2 || v === 3) { // falling petals/leaves
      g.fillStyle = pal[3];
      for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(bx - 40 + r() * 80, by - 30 + r() * 26, 2.5, 1.5, r() * 3, 0, Math.PI * 2); g.fill(); }
    }
    return c;
  }
  function drawRock(v) {
    const [c, g] = mk(70, 56);
    softShadow(g, 36, 47, 32, 8);
    const base=['#737e7c','#948376','#767987'][v],faces=[[[10,42],[12,23],[29,10],[48,16],[59,36],[44,48]],[[12,23],[29,10],[39,28],[25,39]],[[39,28],[48,16],[59,36],[44,48],[25,39]]];
    faces.forEach((pts,i)=>{g.beginPath();pts.forEach((p,n)=>n?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=shade(base,[.72,1.2,.9][i]);g.fill();});
    g.strokeStyle='#454c4b';g.lineWidth=1;g.beginPath();g.moveTo(29,13);g.lineTo(30,24);g.lineTo(23,31);g.lineTo(26,39);g.stroke();
    for(let n=0;n<50;n++){const x=14+hash(n,v,2)*37,y=27+hash(n,v,3)*14;g.fillStyle=n%3?'rgba(25,38,30,.18)':'rgba(230,224,199,.26)';g.fillRect(x,y,1.5,1);}
    g.fillStyle='#566448';for(let n=0;n<15;n++)g.fillRect(16+hash(n,v,4)*25,40+hash(n,v,5)*4,2,1.5);
    return c;
  }
  function drawBush(v) {
    const [c, g] = mk(56, 40);
    const pal = v ? ['#7e8761', '#9ba876', '#b8c58e', '#eeb5ab'] : ['#528d77', '#73aa86', '#a4cb94', '#fff1ce'];
    softShadow(g, 29, 34, 26, 6);
    for (const [x, y, r] of [[14, 25, 11], [40, 25, 11], [27, 20, 15]])
      volume(g, x, y, r, r * .85, pal[1]);
    g.fillStyle = pal[3];
    for (const [x, y] of [[20, 18], [33, 14], [38, 24], [24, 26]]) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
    return c;
  }

  const FSTYLE = [
    { stone: '#e9eef5', stoneD: '#b9c6d6', roof: '#2a5da8', roofL: '#4f86d6', trim: '#d8b45a', glow: '#bfe6ff' },
    { stone: '#3a3138', stoneD: '#211b20', roof: '#8a141c', roofL: '#c32b2f', trim: '#b8862e', glow: '#ff5040' },
  ];
  function drawWall(v, tower) {
    const s = FSTYLE[v];
    const w = tower ? 60 : 48, h = tower ? 120 : 86;
    const [c, g] = mk(w, h);
    const x0 = 0, base = h - 2;
    const frontH = tower ? 58 : 40, topH = 20;
    // front face
    g.fillStyle = s.stoneD; g.fillRect(x0, base - frontH, w, frontH);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (let y = base - frontH + 10; y < base; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let y = base - frontH, i = 0; y < base; y += 10, i++)
      for (let x = (i % 2) * 12; x < w; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 10); g.stroke(); }
    // top face
    g.fillStyle = s.stone; g.fillRect(x0, base - frontH - topH, w, topH);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, base - frontH - topH, w, 3);
    // roof tiles / battlement
    if (v === 0) {
      g.fillStyle = s.roof; g.fillRect(0, base - frontH - topH - 8, w, 10);
      g.fillStyle = s.roofL; for (let x = 2; x < w; x += 8) g.fillRect(x, base - frontH - topH - 8, 4, 8);
      g.fillStyle = s.trim; g.fillRect(0, base - frontH - 2, w, 3);
    } else {
      g.fillStyle = s.stone;
      for (let x = 0; x < w; x += 16) g.fillRect(x + 2, base - frontH - topH - 10, 10, 12);
      g.fillStyle = s.roof; g.fillRect(0, base - frontH - 3, w, 4);
    }
    if (tower) {
      // roof cap
      const top = base - frontH - topH - 8;
      g.fillStyle = s.roof;
      g.beginPath(); g.moveTo(-2, top); g.lineTo(w / 2, top - 34); g.lineTo(w + 2, top); g.closePath(); g.fill();
      g.fillStyle = s.roofL; g.beginPath(); g.moveTo(w / 2, top - 34); g.lineTo(w + 2, top); g.lineTo(w / 2 + 6, top); g.closePath(); g.fill();
      g.fillStyle = s.trim; g.beginPath(); g.arc(w / 2, top - 36, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = s.glow; g.globalAlpha = 0.9; g.fillRect(w / 2 - 5, base - frontH + 14, 10, 14); g.globalAlpha = 1;
    }
    return c;
  }
  function drawHall(v) {
    const s = FSTYLE[v];
    const W = 470, H = 400, cx = W / 2, by = H - 6;
    const [c, g] = mk(W, H);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, by, 225, 26, 0, 0, Math.PI * 2); g.fill();
    // platform
    g.fillStyle = s.stoneD; g.fillRect(cx - 216, by - 64, 432, 60);
    g.fillStyle = s.stone; g.fillRect(cx - 216, by - 84, 432, 22);
    // steps
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? s.stone : s.stoneD; g.fillRect(cx - 50 - i * 6, by - 64 + i * 15, 100 + i * 12, 15); }
    // body
    const bodyT = by - 210, bodyB = by - 84;
    g.fillStyle = v === 0 ? '#f6f8fb' : '#2a2328'; g.fillRect(cx - 170, bodyT, 340, bodyB - bodyT);
    // pillars
    for (let i = 0; i <= 6; i++) {
      const x = cx - 170 + i * (340 / 6);
      g.fillStyle = v === 0 ? '#2f6fc0' : '#7a1218'; g.fillRect(x - 7, bodyT, 14, bodyB - bodyT);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - 5, bodyT, 3, bodyB - bodyT);
    }
    // door
    g.fillStyle = v === 0 ? '#16325a' : '#120a0c'; g.fillRect(cx - 34, bodyB - 86, 68, 86);
    const dg = g.createLinearGradient(0, bodyB - 86, 0, bodyB);
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, v === 0 ? 'rgba(160,220,255,0.75)' : 'rgba(255,60,40,0.75)');
    g.fillStyle = dg; g.fillRect(cx - 34, bodyB - 86, 68, 86);
    g.fillStyle = s.trim; g.fillRect(cx - 40, bodyB - 92, 80, 6);
    // windows
    for (const wx of [-120, -75, 75, 120]) {
      g.fillStyle = v === 0 ? '#9fd4ff' : '#ff4a3a'; g.globalAlpha = 0.85;
      g.fillRect(cx + wx - 12, bodyT + 34, 24, 34); g.globalAlpha = 1;
      g.strokeStyle = s.trim; g.lineWidth = 2; g.strokeRect(cx + wx - 12, bodyT + 34, 24, 34);
    }
    // roofs (two tiers, curved eaves)
    const roof = (y, half, hgt) => {
      g.fillStyle = s.roof;
      g.beginPath();
      g.moveTo(cx - half - 22, y + 8);
      g.quadraticCurveTo(cx - half, y - 4, cx - half * 0.7, y - hgt * 0.55);
      g.lineTo(cx - half * 0.3, y - hgt);
      g.lineTo(cx + half * 0.3, y - hgt);
      g.lineTo(cx + half * 0.7, y - hgt * 0.55);
      g.quadraticCurveTo(cx + half, y - 4, cx + half + 22, y + 8);
      g.closePath(); g.fill();
      g.fillStyle = s.roofL;
      for (let x = cx - half; x < cx + half; x += 14) g.fillRect(x, y - 6, 6, 8);
      g.strokeStyle = s.trim; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - half * 0.3, y - hgt); g.lineTo(cx + half * 0.3, y - hgt); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(cx - half - 22, y + 8); g.quadraticCurveTo(cx - half, y - 4, cx - half * 0.7, y - hgt * 0.55); g.stroke();
      g.beginPath(); g.moveTo(cx + half + 22, y + 8); g.quadraticCurveTo(cx + half, y - 4, cx + half * 0.7, y - hgt * 0.55); g.stroke();
    };
    g.fillStyle = v === 0 ? '#eef3f9' : '#241e22'; g.fillRect(cx - 110, bodyT - 70, 220, 70);
    for (let i = 0; i <= 4; i++) { g.fillStyle = v === 0 ? '#2f6fc0' : '#7a1218'; g.fillRect(cx - 110 + i * 55 - 5, bodyT - 70, 10, 70); }
    roof(bodyT, 200, 56);
    roof(bodyT - 74, 135, 66);
    // emblem
    g.fillStyle = s.trim; g.beginPath(); g.arc(cx, bodyT - 110, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = v === 0 ? '#ffffff' : '#ff3b3b'; g.font = 'bold 18px Kanit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(v === 0 ? '☸' : '☠', cx, bodyT - 109);
    if (v === 1) { // spikes
      g.fillStyle = '#1a1416';
      for (const sx of [-200, -140, 140, 200]) { g.beginPath(); g.moveTo(cx + sx - 6, bodyT + 6); g.lineTo(cx + sx, bodyT - 40); g.lineTo(cx + sx + 6, bodyT + 6); g.fill(); }
    }
    return c;
  }
  function drawSpring(v) {
    const [c, g] = mk(140, 150);
    const cx = 70, cy = 112;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 6, 62, 22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = v === 0 ? '#cfd8e4' : '#2c2429'; g.beginPath(); g.ellipse(cx, cy, 60, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = v === 0 ? '#9aa9bd' : '#171215'; g.beginPath(); g.ellipse(cx, cy + 4, 60, 26, 0, 0, Math.PI); g.fill();
    const wg = g.createRadialGradient(cx, cy, 4, cx, cy, 50);
    if (v === 0) { wg.addColorStop(0, '#d8f6ff'); wg.addColorStop(1, '#2d7fcf'); } else { wg.addColorStop(0, '#ff8a6a'); wg.addColorStop(1, '#5a0610'); }
    g.fillStyle = wg; g.beginPath(); g.ellipse(cx, cy - 2, 50, 20, 0, 0, Math.PI * 2); g.fill();
    // central pillar
    g.fillStyle = v === 0 ? '#eef2f8' : '#3b3238'; g.fillRect(cx - 9, cy - 76, 18, 72);
    g.fillStyle = v === 0 ? '#b7c4d6' : '#1d171a'; g.fillRect(cx + 3, cy - 76, 6, 72);
    g.fillStyle = v === 0 ? '#d8b45a' : '#b8862e'; g.fillRect(cx - 13, cy - 80, 26, 6);
    if (v === 0) { // lotus
      g.fillStyle = '#f2b8d0';
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(cx + i * 7, cy - 88, 5, 12, i * 0.35, 0, Math.PI * 2); g.fill(); }
    } else { // horns
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - 8, cy - 80); g.quadraticCurveTo(cx - 26, cy - 92, cx - 18, cy - 112); g.stroke();
      g.beginPath(); g.moveTo(cx + 8, cy - 80); g.quadraticCurveTo(cx + 26, cy - 92, cx + 18, cy - 112); g.stroke();
    }
    return c;
  }
  function drawLantern(v) {
    const [c, g] = mk(36, 76);
    const st = v === 0 ? ['#d9e0ea', '#a7b3c3'] : ['#3b3238', '#1c1619'];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(18, 70, 14, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = st[1]; g.fillRect(13, 40, 10, 30);
    g.fillStyle = st[0]; g.fillRect(8, 64, 20, 6); g.fillRect(6, 36, 24, 6);
    g.fillStyle = v === 0 ? '#bfe9ff' : '#ff5a3a'; g.fillRect(10, 22, 16, 14);
    g.fillStyle = st[0]; g.beginPath(); g.moveTo(2, 22); g.lineTo(18, 8); g.lineTo(34, 22); g.closePath(); g.fill();
    g.fillStyle = st[1]; g.fillRect(16, 2, 4, 8);
    return c;
  }
  function drawBanner(v) {
    const [c, g] = mk(46, 130);
    g.fillStyle = '#4a3a2a'; g.fillRect(21, 8, 4, 120);
    g.fillStyle = v === 0 ? '#d8b45a' : '#b8862e'; g.beginPath(); g.arc(23, 8, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = v === 0 ? '#f4f8ff' : '#141012';
    g.beginPath(); g.moveTo(25, 14); g.lineTo(44, 14); g.lineTo(44, 78); g.lineTo(34, 70); g.lineTo(25, 78); g.closePath(); g.fill();
    g.fillStyle = v === 0 ? '#2f74d0' : '#c3262c'; g.fillRect(25, 14, 19, 6); g.fillRect(25, 60, 19, 4);
    g.font = 'bold 14px Kanit, sans-serif'; g.textAlign = 'center'; g.fillText(v === 0 ? '☸' : '☠', 35, 46);
    return c;
  }
  function drawPillar(v) {
    const [c, g] = mk(44, 110);
    const hgt = [80, 56, 96][v];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(22, 104, 18, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7d756c'; g.fillRect(10, 104 - hgt, 24, hgt);
    g.fillStyle = '#a19789'; g.fillRect(10, 104 - hgt, 8, hgt);
    g.fillStyle = '#5d564f'; g.fillRect(6, 96, 32, 8);
    g.fillStyle = '#5d564f';
    g.beginPath(); g.moveTo(10, 104 - hgt); g.lineTo(16, 98 - hgt); g.lineTo(22, 106 - hgt); g.lineTo(30, 96 - hgt); g.lineTo(34, 104 - hgt); g.closePath(); g.fill();
    g.fillStyle = '#4c7a3a'; g.globalAlpha = 0.75; g.fillRect(10, 90, 10, 10); g.globalAlpha = 1;
    return c;
  }
  function drawSigil() {
    const R = 190, [c, g] = mk(R * 2 + 20, R * 2 + 20), cx = R + 10;
    g.translate(cx, cx);
    g.strokeStyle = 'rgba(255,70,60,0.55)'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R - 18, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.45, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    for (let i = 0; i <= 5; i++) { const a = (i * 4 * Math.PI) / 5 - Math.PI / 2; const x = Math.cos(a) * (R - 18), y = Math.sin(a) * (R - 18); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = 'rgba(255,90,70,0.6)'; g.font = '16px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.save(); g.rotate(a); g.fillText(runes[i], 0, -(R - 9)); g.restore();
    }
    return c;
  }

  // blacksmith stall: awning, weapon rack with twin blades, anvil and forge
  function drawSmith(v) {
    const W = 150, H = 150, [c, g] = mk(W, H), by = H - 8, cx = W / 2;
    const st = FSTYLE[v];
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, by, 70, 14, 0, 0, Math.PI * 2); g.fill();
    // back wall + posts
    g.fillStyle = v === 0 ? '#6b4a2e' : '#2e2226'; g.fillRect(cx - 62, by - 92, 124, 70);
    g.fillStyle = v === 0 ? '#4a3220' : '#1a1214';
    g.fillRect(cx - 66, by - 100, 8, 100); g.fillRect(cx + 58, by - 100, 8, 100);
    // weapon rack with three pairs of blades
    g.fillStyle = '#3a2818'; g.fillRect(cx - 52, by - 80, 104, 5); g.fillRect(cx - 52, by - 46, 104, 4);
    for (let i = 0; i < 3; i++) {
      const x = cx - 36 + i * 36;
      for (const s of [-1, 1]) {
        g.save(); g.translate(x + s * 5, by - 40); g.rotate(s * 0.12);
        g.fillStyle = '#dfe6ef'; g.beginPath(); g.moveTo(0, -46); g.lineTo(3, -40); g.lineTo(2.5, 0); g.lineTo(-2.5, 0); g.lineTo(-3, -40); g.closePath(); g.fill();
        g.fillStyle = i === 2 ? '#e8c26a' : st.roof; g.fillRect(-6, 0, 12, 3);
        g.fillStyle = '#3a2818'; g.fillRect(-1.5, 3, 3, 9);
        g.restore();
      }
    }
    // awning
    g.fillStyle = st.roof;
    g.beginPath(); g.moveTo(cx - 74, by - 96); g.lineTo(cx + 74, by - 96); g.lineTo(cx + 64, by - 124); g.lineTo(cx - 64, by - 124); g.closePath(); g.fill();
    g.fillStyle = v === 0 ? '#ffffff' : '#1a1012';
    for (let i = 0; i < 8; i++) if (i % 2 === 0) { g.beginPath(); g.moveTo(cx - 74 + i * 18.5, by - 96); g.lineTo(cx - 74 + (i + 1) * 18.5, by - 96); g.lineTo(cx - 64 + (i + 1) * 16, by - 124); g.lineTo(cx - 64 + i * 16, by - 124); g.closePath(); g.fill(); }
    g.fillStyle = st.trim;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(cx - 72 + i * 18, by - 94, 4, 0, Math.PI); g.fill(); }
    // forge with embers
    g.fillStyle = '#3a3438'; g.fillRect(cx + 26, by - 26, 34, 24);
    const fg = g.createRadialGradient(cx + 43, by - 20, 2, cx + 43, by - 20, 16);
    fg.addColorStop(0, '#fff2a0'); fg.addColorStop(0.5, '#ff7a20'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(cx + 43, by - 20, 16, 0, Math.PI * 2); g.fill();
    // anvil
    g.fillStyle = '#4a4a52';
    g.beginPath(); g.moveTo(cx - 50, by - 30); g.lineTo(cx - 6, by - 30); g.lineTo(cx - 14, by - 22); g.lineTo(cx - 40, by - 22); g.closePath(); g.fill();
    g.fillRect(cx - 34, by - 22, 14, 14); g.fillRect(cx - 42, by - 10, 30, 8);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - 48, by - 30, 40, 2);
    return c;
  }

  // ---------------- hunting-map props
  // wooden fence segment around the camps (v1 = dark wood)
  function drawFence(v) {
    const [c, g] = mk(52, 46);
    const wood = v ? ['#3a2a20', '#2a1c14', '#4a3628'] : ['#8a6238', '#6a4626', '#a8804e'];
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(2, 40, 48, 5);
    g.fillStyle = wood[1]; g.fillRect(0, 14, 52, 6); g.fillRect(0, 28, 52, 6);
    g.fillStyle = wood[2]; g.fillRect(0, 14, 52, 2); g.fillRect(0, 28, 52, 2);
    for (const x of [6, 40]) {
      g.fillStyle = wood[0]; g.fillRect(x, 4, 7, 38);
      g.fillStyle = wood[2]; g.fillRect(x, 4, 2, 38);
      g.fillStyle = wood[1]; g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 3.5, 0); g.lineTo(x + 7, 4); g.fill();
    }
    return c;
  }
  // 0 thatched house · 1 canvas tent · 2 snow-roofed house · 3 ruined dark house
  function drawHouse(v) {
    const W = 180, H = 180, [c, g] = mk(W, H), cx = W / 2, by = H - 4;
    softShadow(g, cx + 3, by - 4, 86, 13);
    if (v === 1) {
      g.fillStyle = '#c8b48a';
      g.beginPath(); g.moveTo(cx - 78, by - 4); g.lineTo(cx, by - 120); g.lineTo(cx + 78, by - 4); g.closePath(); g.fill();
      g.fillStyle = '#a8946a';
      g.beginPath(); g.moveTo(cx, by - 120); g.lineTo(cx + 78, by - 4); g.lineTo(cx + 30, by - 4); g.closePath(); g.fill();
      g.fillStyle = '#3a2a1a';
      g.beginPath(); g.moveTo(cx - 20, by - 4); g.lineTo(cx, by - 62); g.lineTo(cx + 20, by - 4); g.closePath(); g.fill();
      g.strokeStyle = '#8a1a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 60, by - 34); g.lineTo(cx, by - 120); g.lineTo(cx + 60, by - 34); g.stroke();
      g.fillStyle = '#5a3a20'; g.fillRect(cx - 2, by - 134, 4, 16);
      g.fillStyle = '#c8302a'; g.beginPath(); g.moveTo(cx + 2, by - 134); g.lineTo(cx + 22, by - 128); g.lineTo(cx + 2, by - 122); g.fill();
      return c;
    }
    const wall = v === 3 ? '#77717f' : v === 2 ? '#d8dce4' : '#f1dfbb';
    const beam = v === 3 ? '#514b61' : '#8b6d55';
    const roof = v === 3 ? ['#5b586c', '#8a7f98'] : v === 2 ? ['#688ca7', '#a4c4d6'] : ['#ac7c65', '#e4b58d'];
    // walls
    const plaster = g.createLinearGradient(cx - 60, by - 78, cx + 64, by - 4);
    plaster.addColorStop(0, wall); plaster.addColorStop(1, shade(wall, .86));
    g.fillStyle = plaster; g.fillRect(cx - 64, by - 78, 128, 74);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + 20, by - 78, 44, 74);
    g.fillStyle = beam;
    for (const x of [-64, -22, 22, 58]) g.fillRect(cx + x, by - 80, 6, 76);
    g.fillRect(cx - 66, by - 82, 132, 6); g.fillRect(cx - 66, by - 10, 132, 6);
    // door + windows
    g.fillStyle = v === 3 ? '#0e0a0c' : '#3a2414'; g.fillRect(cx - 14, by - 54, 28, 50);
    g.fillStyle = v === 3 ? 'rgba(120,180,255,0.35)' : '#ffd88a';
    g.fillRect(cx - 50, by - 60, 20, 18); g.fillRect(cx + 30, by - 60, 20, 18);
    g.strokeStyle = beam; g.lineWidth = 2;
    for (const x of [-50, 30]) { g.strokeRect(cx + x, by - 60, 20, 18); g.beginPath(); g.moveTo(cx + x + 10, by - 60); g.lineTo(cx + x + 10, by - 42); g.stroke(); }
    // Rounded stone doorstep and flower boxes give the building a grounded silhouette.
    for (let i = 0; i < 2; i++) {
      g.fillStyle = i ? '#c9b9a1' : '#a99b8c';
      g.fillRect(cx - 20 - i * 4, by - 5 + i * 2, 40 + i * 8, 3);
    }
    for (const x of [-40, 40]) {
      volume(g, cx + x, by - 39, 14, 4, beam);
      volume(g, cx + x, by - 42, 12, 4, v === 3 ? '#8b83a4' : '#8fb88c');
      for (const k of [-1, 1]) volume(g, cx + x + k * 6, by - 45, 2.5, 2.5, '#edb3bd');
    }
    // curved roof
    const roofLight = g.createLinearGradient(cx - 40, by - 130, cx + 35, by - 70);
    roofLight.addColorStop(0, roof[1]); roofLight.addColorStop(.6, roof[0]); roofLight.addColorStop(1, shade(roof[0], .78));
    g.fillStyle = roofLight;
    g.beginPath(); g.moveTo(cx - 88, by - 72); g.quadraticCurveTo(cx - 70, by - 84, cx - 54, by - 128);
    g.lineTo(cx + 54, by - 128); g.quadraticCurveTo(cx + 70, by - 84, cx + 88, by - 72); g.closePath(); g.fill();
    g.save(); g.clip(); g.lineWidth = 1.2;
    for (let y = by - 119; y < by - 73; y += 10) {
      g.strokeStyle = 'rgba(255,239,212,.25)'; g.beginPath(); g.moveTo(cx - 85, y); g.quadraticCurveTo(cx, y + 7, cx + 85, y); g.stroke();
    }
    for (let x = cx - 65; x <= cx + 65; x += 13) {
      g.strokeStyle = 'rgba(64,46,58,.14)'; g.beginPath(); g.moveTo(cx + (x - cx) * .7, by - 128); g.lineTo(x, by - 72); g.stroke();
    }
    g.restore();
    g.fillStyle = roof[1];
    for (let x = cx - 76; x < cx + 76; x += 12) g.fillRect(x, by - 82, 6, 8);
    g.strokeStyle = beam; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 58, by - 128); g.lineTo(cx + 58, by - 128); g.stroke();
    if (v === 2) { // snow on the roof
      g.fillStyle = '#f4f8fc';
      g.beginPath(); g.moveTo(cx - 84, by - 76); g.quadraticCurveTo(cx - 68, by - 88, cx - 54, by - 130); g.lineTo(cx + 54, by - 130);
      g.quadraticCurveTo(cx + 68, by - 88, cx + 84, by - 76); g.quadraticCurveTo(cx, by - 96, cx - 84, by - 76); g.fill();
    }
    if (v === 3) { // broken roof + cobwebs
      g.fillStyle = '#16121a'; g.beginPath(); g.moveTo(cx + 10, by - 128); g.lineTo(cx + 40, by - 128); g.lineTo(cx + 24, by - 100); g.fill();
      g.strokeStyle = 'rgba(220,220,230,0.4)'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(cx - 64, by - 78, 8 + i * 6, 0, Math.PI / 2); g.stroke(); }
    }
    return c;
  }
  // teleport stone: carved monolith with glowing runes
  function drawStone() {
    const [c, g] = mk(80, 130), cx = 40, by = 124;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, by - 2, 34, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a5e6a'; g.fillRect(cx - 30, by - 16, 60, 14);
    g.fillStyle = '#7a7e8a'; g.fillRect(cx - 30, by - 16, 60, 4);
    g.fillStyle = '#6a6e7c';
    g.beginPath(); g.moveTo(cx - 18, by - 16); g.lineTo(cx - 14, by - 100); g.lineTo(cx, by - 116); g.lineTo(cx + 14, by - 100); g.lineTo(cx + 18, by - 16); g.closePath(); g.fill();
    g.fillStyle = '#868a98';
    g.beginPath(); g.moveTo(cx - 18, by - 16); g.lineTo(cx - 14, by - 100); g.lineTo(cx, by - 116); g.lineTo(cx - 2, by - 16); g.closePath(); g.fill();
    g.fillStyle = '#9ae8ff'; g.shadowColor = '#5ad8ff'; g.shadowBlur = 8;
    g.font = 'bold 13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['☯', '卍', '✦', '◈'].forEach((ch, i) => g.fillText(ch, cx, by - 92 + i * 19));
    g.shadowBlur = 0;
    return c;
  }
  // gate to the next / previous map: a torii-style arch (the swirl is drawn live)
  function drawGate() {
    const W = 150, H = 170, [c, g] = mk(W, H), cx = W / 2, by = H - 6;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, by, 66, 14, 0, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) {
      g.fillStyle = '#8a1a1a'; g.fillRect(cx + s * 52 - 7, by - 130, 14, 130);
      g.fillStyle = '#b8302a'; g.fillRect(cx + s * 52 - 7, by - 130, 4, 130);
      g.fillStyle = '#2a2a2e'; g.fillRect(cx + s * 52 - 10, by - 12, 20, 12);
    }
    g.fillStyle = '#1e1a1c';
    g.beginPath(); g.moveTo(cx - 74, by - 146); g.quadraticCurveTo(cx, by - 136, cx + 74, by - 146); g.lineTo(cx + 70, by - 134); g.quadraticCurveTo(cx, by - 126, cx - 70, by - 134); g.closePath(); g.fill();
    g.fillStyle = '#a8241e'; g.fillRect(cx - 62, by - 120, 124, 10);
    g.fillStyle = '#e8c060'; g.fillRect(cx - 12, by - 134, 24, 26);
    g.fillStyle = '#3a1a0a'; g.font = 'bold 14px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('門', cx, by - 121);
    return c;
  }
  function drawGrave(v) {
    const [c, g] = mk(50, 60), cx = 25, by = 56;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, by - 2, 20, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a6460';
    if (v === 0) { g.beginPath(); g.moveTo(cx - 12, by - 4); g.lineTo(cx - 12, by - 34); g.arc(cx, by - 34, 12, Math.PI, 0); g.lineTo(cx + 12, by - 4); g.fill(); }
    else if (v === 1) { g.fillRect(cx - 4, by - 44, 8, 40); g.fillRect(cx - 14, by - 36, 28, 7); }
    else { g.beginPath(); g.moveTo(cx - 14, by - 4); g.lineTo(cx - 10, by - 30); g.lineTo(cx + 4, by - 36); g.lineTo(cx + 13, by - 4); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx - 10, by - 30, 4, 24);
    g.fillStyle = '#4a7a3a'; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(cx - 8, by - 4, 9, 3, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    return c;
  }
  // ice crystal cluster (v3 = red fire crystal)
  function drawCrystal(v) {
    const [c, g] = mk(64, 80), cx = 32, by = 74;
    const fire = v === 3, pal = fire ? ['#8a1a0a', '#ff5a1a', '#ffd08a'] : ['#3a78b8', '#8ac8f0', '#ffffff'];
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, by - 2, 24, 6, 0, 0, Math.PI * 2); g.fill();
    const r = C.mulberry32(v * 31 + 5);
    for (let i = 0; i < 5; i++) {
      const x = cx - 16 + i * 8 + (r() - 0.5) * 4, h = 26 + r() * 34, w = 6 + r() * 4, lean = (i - 2) * 0.12;
      g.save(); g.translate(x, by - 4); g.rotate(lean);
      g.fillStyle = pal[0]; g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h); g.lineTo(0, -h - 10); g.lineTo(w, -h); g.lineTo(w, 0); g.fill();
      g.fillStyle = pal[1]; g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -h); g.lineTo(0, -h - 10); g.lineTo(0, 0); g.fill();
      g.fillStyle = pal[2]; g.globalAlpha = 0.7; g.fillRect(-w + 2, -h + 2, 2, h * 0.6); g.globalAlpha = 1;
      g.restore();
    }
    return c;
  }
  // mushroom clump (v1 = glowing purple)
  function drawMush(v) {
    const [c, g] = mk(46, 34), pal = v ? ['#9976b7', '#c9a5ec', '#f0e0ff'] : ['#c27479', '#ec9d97', '#fff0e0'];
    softShadow(g, 24, 30, 22, 4);
    for (const [x, y, s] of [[14, 30, 1], [28, 31, 0.8], [36, 28, 0.6]]) {
      volume(g, x, y - 6 * s, 3 * s, 7 * s, '#efe4cc');
      volume(g, x, y - 13 * s, 10 * s, 7 * s, pal[1]);
      g.fillStyle = pal[2]; for (const [dx, dy] of [[-4, -15], [3, -16], [6, -13]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, 1.3 * s, 0, Math.PI * 2); g.fill(); }
    }
    return c;
  }

  // anchor = point in the canvas that sits on the object's (x, y)
  const SPR = {};
  Art.buildProps = function () {
    SPR.tree = TREE_PAL.map((_, v) => [0, 1, 2].map((s) => drawTree(v, s)));
    SPR.rock = [0, 1, 2].map(drawRock);
    SPR.bush = [0, 1].map(drawBush);
    SPR.wall = [0, 1].map((v) => drawWall(v, false));
    SPR.tower = [0, 1].map((v) => drawWall(v, true));
    SPR.hall = [0, 1].map(drawHall);
    SPR.spring = [0, 1].map(drawSpring);
    SPR.lantern = [0, 1].map(drawLantern);
    SPR.banner = [0, 1].map(drawBanner);
    SPR.pillar = [0, 1, 2].map(drawPillar);
    SPR.sigil = drawSigil();
    SPR.smith = [0, 1].map(drawSmith);
    SPR.fence = [0, 1].map(drawFence);
    SPR.house = [0, 1, 2, 3].map(drawHouse);
    SPR.stone = drawStone();
    SPR.gate = drawGate();
    SPR.grave = [0, 1, 2].map(drawGrave);
    SPR.crystal = [0, 1, 2, 3].map(drawCrystal);
    SPR.mush = [0, 1].map(drawMush);
  };
  // returns {img, ax, ay, light?}
  Art.propSprite = function (o) {
    if(window.StageArt?.ready&&StageArt.supports(MAP_ID)){const p=StageArt.prop(MAP_ID,o);if(p)return p;}
    if(MAP_ID==='ice'&&window.IceArt?.ready){const p=IceArt.prop(o);if(p)return p;}
    if(MAP_ID==='pass'&&window.PassArt?.ready){const p=PassArt.prop(o);if(p)return p;}
    if(o[0]==='village')return window.VillageArt?.prop(o)||null;
    if(o[0]==='landmark')return window.HuntingArt?.prop(o)||null;
    const [t, v, x, y] = o;
    switch (t) {
      case 'tree': { const img = SPR.tree[v][(hash(x, y) * 3) | 0]; return { img, ax: 60, ay: 150 }; }
      case 'rock': return { img: SPR.rock[v], ax: 35, ay: 50 };
      case 'bush': return { img: SPR.bush[v], ax: 28, ay: 36 };
      case 'wall': return { img: SPR.wall[v], ax: 24, ay: 84 };
      case 'tower': return { img: SPR.tower[v], ax: 30, ay: 118 };
      case 'temple': case 'fortress': return { img: SPR.hall[v], ax: 235, ay: 394 };
      case 'spring': case 'altar': return { img: SPR.spring[v], ax: 70, ay: 128, light: v === 0 ? '#9edcff' : '#ff4030', ly: -96 };
      case 'lantern': return { img: SPR.lantern[v], ax: 18, ay: 72, light: v === 0 ? '#bfe9ff' : '#ff5a3a', ly: -42 };
      case 'banner': return { img: SPR.banner[v], ax: 23, ay: 126 };
      case 'pillar': return { img: SPR.pillar[v], ax: 22, ay: 106 };
      case 'smith': return { img: SPR.smith[v], ax: 75, ay: 142, light: '#ff8a30', ly: -24, label: 'ร้านช่างตีดาบ', labelY: -150 };
      // ร้านขายยา: a second shop building, same sprite as the blacksmith's — only the label tells them apart
      case 'apothecary': return { img: SPR.smith[v], ax: 75, ay: 142, light: '#ff8a30', ly: -24, label: 'ร้านขายยา', labelY: -150 };
      case 'enhancer': return { img: SPR.smith[v], ax: 75, ay: 142, light: '#ffb35a', ly: -24, label: 'ร้านตีบวก', labelY: -150 };
      case 'fence': return { img: SPR.fence[v], ax: 26, ay: 42 };
      case 'house': return { img: SPR.house[v], ax: 90, ay: 176 };
      case 'stone': return { img: SPR.stone, ax: 40, ay: 122, light: '#7ad8ff', ly: -70, label: 'ศิลาเคลื่อนย้าย', labelY: -128, icon: '✦' };
      case 'gate': { const to = C.MAPS[C.MAP_ORDER[v]]; return { img: SPR.gate, ax: 75, ay: 164, gate: true, label: to ? `${to.name} · ${C.levelText(to)}` : '', labelY: -176, icon: '➜' }; }
      case 'grave': return { img: SPR.grave[v], ax: 25, ay: 54 };
      case 'crystal': return { img: SPR.crystal[v], ax: 32, ay: 72, light: v === 3 ? '#ff6a2a' : '#9edcff', ly: -30 };
      case 'mush': return { img: SPR.mush[v], ax: 23, ay: 31, light: v ? '#c08aff' : null, ly: -10 };
      default: return null;
    }
  };
  Art.sigil = () => SPR.sigil;

  // ------------------------------------------------------------------ terrain
  const GRASS_W = '#96b980', GRASS_E = '#9fa979';
  // Visual palettes only: map generation, collision and progression remain in shared/world-data.js.
  const PALETTES = {
    village: { grass: ['#819467', '#6e8964'], path: '#d2bd92', sand: '#bdb894', plaza: '#d5c6a4', water: ['#548f89', '#3c7776'], flowers: ['#eee0bb', '#d994a8', '#b7ceb0'] },
    canyon: { grass: ['#a3966c', '#8d855c'], path: '#d3b890', sand: '#ceba8b', plaza: '#cbb491', field: '#b29a73', water: ['#4b9c9b', '#30676e'], cliff: ['#af9272', '#715446'] },
    forest: { grass: ['#426950', '#315347'], path: '#8d9271', sand: '#82896b', plaza: '#789080', field: '#657965', water: ['#438b78', '#244d58'], flowers:['#c8b0ee','#9ccfc2','#e8dfb0'] },
    haunted: { grass: ['#606770', '#505b64'], path: '#7b7779', sand: '#8d8287', plaza: '#8a8991', water: ['#4b6576', '#354556'] },
    temple: { grass: ['#87976c', '#708c65'], path: '#d4c7a4', plaza: '#e2d7bb', field:'#c4b894', water: ['#70ada1', '#467c7e'] },
    ice: { grass: ['#e5eff5', '#d9e7f0'], path: '#bdcedf', plaza: '#d1dfe9', field:'#b4cbdc', water: ['#458eb6', '#284e82'] },
    fire: { grass: ['#514644', '#403c40'], path: '#88716a', plaza: '#89766b', field:'#695153', water: ['#ef8a2e', '#b43a22'], cliff: ['#635251', '#393136'] },
  };
  Art.CHUNK = 12;
  // colours of the current map (C.THEMES); the PvP map keeps the original west/east look
  let TH = C.THEMES.pvp, MW = C.MAP_W, MAP_ID = 'pvp';
  Art.setMap = function (def) {
    TH = { ...(C.THEMES[def.theme] || C.THEMES.pvp), ...(PALETTES[def.theme] || {}) };
    MAP_ID=def.id;if(def.id==='pass'&&window.PassArt)Object.assign(TH,PassArt.palette);
    MW = def.w || C.MAP_W;
  };
  Art.theme = () => TH;
  // res = canvas pixels per world pixel (sharper ground on high-DPI screens / zoomed in)
  Art.renderChunk = function (map, cx, cy, res = 1) {
    if(window.StageArt?.ready&&StageArt.supports(map.id))return StageArt.renderChunk(map,cx,cy,res);
    if(map.id==='ice'&&window.IceArt?.ready)return IceArt.renderChunk(map,cx,cy,res);
    if(map.id==='village'&&window.VillageArt?.ready)return VillageArt.renderChunk(map,cx,cy,res);
    if(map.id==='pass'&&window.PassArt?.ready)return PassArt.renderChunk(map,cx,cy,res);
    const N = Art.CHUNK, S = N * TILE;
    const [c, g] = mk(Math.round(S * res), Math.round(S * res));
    g.scale(res, res);
    const tx0 = cx * N, ty0 = cy * N;
    const tileAt = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? T.GRASS : map.tiles[y * map.w + x]);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = tx0 + i, ty = ty0 + j;
      if (tx >= map.w || ty >= map.h) continue;
      const t = tileAt(tx, ty), px = i * TILE, py = j * TILE;
      paintTile(g, t, tx, ty, px, py, map);
    }
    // edge details on a second pass so they overlap neighbours cleanly
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = tx0 + i, ty = ty0 + j;
      if (tx >= map.w || ty >= map.h) continue;
      paintEdges(g, tileAt, tx, ty, i * TILE, j * TILE);
    }
    if(window.HuntingArt)HuntingArt.ground(g,map,tx0*TILE,ty0*TILE,S);
    return c;
  };
  function grassColor(tx, ty) {
    // Smooth world-space variation avoids visible checkerboard patches and chunk seams.
    const n = Math.sin(tx * .16 + Math.cos(ty * .12)) * .025 + Math.cos(ty * .19 + tx * .07) * .018;
    if (TH.grass) return shade(mix(TH.grass[0], TH.grass[1], tx / MW), 1 + n);
    const t = Math.min(1, Math.max(0, (tx - 40) / 80));
    return shade(mix(GRASS_W, GRASS_E, t), 1 + n);
  }
  function paintTile(g, t, tx, ty, px, py) {
    const h = (s) => hash(tx, ty, s);
    switch (t) {
      case T.GRASS: case T.SAND: case T.PATH: case T.FIELD: {
        const groundLight = 1 + Math.sin(tx * .19 + ty * .13) * .018;
        const base = t === T.GRASS ? grassColor(tx, ty) : t === T.PATH ? shade(TH.path || '#a8895c', groundLight)
          : t === T.SAND ? shade(TH.sand || '#d8c38f', groundLight) : shade(TH.field || '#86664a', groundLight);
        g.fillStyle = base; g.fillRect(px, py, TILE, TILE);
        if (t === T.GRASS) {
          const east = tx > 80;
          const bl = TH.blades || ['rgba(20,60,10,0.35)', 'rgba(200,255,150,0.22)'];
          for (let k = 0; k < 15; k++) {
            const x = px + 5 + h(10 + k) * (TILE - 10), y = py + 9 + h(30 + k) * (TILE - 14);
            g.strokeStyle = h(50 + k) > 0.5 ? bl[0] : 'rgba(255,249,215,.38)';
            g.lineWidth = .65; g.lineCap = 'butt'; g.beginPath();
            g.moveTo(x,y);g.quadraticCurveTo(x-1,y-2,x-2+h(60+k)*4,y-2-h(70+k)*4);g.stroke();
          }
          if (h(5) > 0.98) { // sparse wildflowers leave combat terrain readable
            const cols = TH.flowers || (east ? ['#d12f2f', '#ff5a4a', '#8a1a3a'] : ['#ffffff', '#9fd0ff', '#ffe27a']);
            for (let k = 0; k < 3; k++) {
              const x = px + 8 + h(90 + k) * 32, y = py + 8 + h(95 + k) * 32;
              g.fillStyle = cols[k % 3];
              for (let p = 0; p < 5; p++) {
                const a = p * Math.PI * 2 / 5;
                g.beginPath(); g.ellipse(x + Math.cos(a) * 2, y + Math.sin(a) * 2, 2.2, 1.6, a, 0, Math.PI * 2); g.fill();
              }
              g.fillStyle = '#edc778'; g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
            }
          }
        } else {
          for (let k = 0; k < 6; k++) {
            g.fillStyle = h(100 + k) > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
            g.beginPath(); g.arc(px + h(110 + k) * TILE, py + h(120 + k) * TILE, 1 + h(130 + k) * 2, 0, Math.PI * 2); g.fill();
          }
          if (t === T.FIELD && h(7) > 0.82) {
            g.strokeStyle = 'rgba(60,20,10,0.45)'; g.lineWidth = 1.5; g.beginPath();
            let x = px + h(8) * TILE, y = py + h(9) * TILE; g.moveTo(x, y);
            for (let k = 0; k < 4; k++) { x += (h(140 + k) - 0.5) * 22; y += (h(150 + k) - 0.5) * 22; g.lineTo(x, y); }
            g.stroke();
          }
        }
        break;
      }
      case T.WATER: case T.BRIDGE: {
        const wc = TH.water || ['#2f78b4', '#25639a'];
        g.fillStyle = shade(mix(wc[0], wc[1], .5 + Math.sin(tx * .14 + ty * .1) * .2), 1);
        g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = TH.lava ? 'rgba(255,187,73,0.35)' : 'rgba(178,208,203,0.14)'; g.lineWidth = .65;
        for (let k = 0; k < 9; k++) { const y = py + 3 + h(200 + k) * (TILE-6), x = px + h(210 + k) * (TILE-20);g.beginPath();g.moveTo(x,y);g.lineTo(x+5+h(230+k)*14,y-.4);g.stroke();}
        if (TH.lava && h(220) > 0.6) { // cooling crust on the lava
          g.fillStyle = 'rgba(40,10,4,0.55)';
          g.beginPath(); g.ellipse(px + h(221) * TILE, py + h(222) * TILE, 6 + h(223) * 8, 3 + h(224) * 4, h(225) * 3, 0, Math.PI * 2); g.fill();
        }
        if (t === T.BRIDGE) {
          g.fillStyle = TH.lava ? '#4a3a34' : '#7a5434'; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = TH.lava ? '#5e4c44' : '#946a42';
          for (let x = 0; x < TILE; x += 12) g.fillRect(px + x + 1, py, 10, TILE);
          g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < TILE; x += 12) g.fillRect(px + x + 10, py, 2, TILE);
        }
        break;
      }
      case T.CLIFF: {
        // rock top: uneven slabs with cracks (the face toward the south is added in paintEdges)
        const cl = TH.cliff || ['#857c70', '#4e4842'];
        g.fillStyle = shade(cl[0], 0.9 + h(1) * 0.16); g.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 4; k++) {
          g.fillStyle = h(240 + k) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
          g.beginPath(); g.ellipse(px + h(250 + k) * TILE, py + h(260 + k) * TILE, 5 + h(270 + k) * 8, 3 + h(280 + k) * 4, h(290 + k) * 3, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; g.beginPath();
        let cx = px + h(300) * TILE, cy = py + h(301) * TILE; g.moveTo(cx, cy);
        for (let k = 0; k < 3; k++) { cx += (h(302 + k) - 0.5) * 22; cy += (h(306 + k) - 0.5) * 22; g.lineTo(cx, cy); }
        g.stroke();
        break;
      }
      case T.ICE: {
        // frozen lake: pale blue, glossy streaks, a few cracks
        const ig = g.createLinearGradient(px, py, px + TILE, py + TILE);
        ig.addColorStop(0, shade('#d6eefa', 0.97 + h(1) * 0.05)); ig.addColorStop(1, shade('#a9d2ee', 0.97 + h(2) * 0.05));
        g.fillStyle = ig; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
        if (h(3) > 0.5) { const x = px + h(4) * TILE; g.beginPath(); g.moveTo(x, py + 6); g.lineTo(x + 14, py + 20); g.stroke(); }
        if (h(5) > 0.78) {
          g.strokeStyle = 'rgba(70,130,180,0.45)'; g.lineWidth = 1; g.beginPath();
          let x = px + h(6) * TILE, y = py + h(7) * TILE; g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (h(8 + k) - 0.5) * 24; y += (h(12 + k) - 0.5) * 24; g.lineTo(x, y); }
          g.stroke();
        }
        break;
      }
      case T.PLAZA: {
        // camp flagstones in the map's stone colour
        g.fillStyle = shade(TH.plaza || '#c9b48c', 0.94 + h(1) * 0.08); g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.2;
        const off = (ty % 2) * (TILE / 2);
        g.beginPath(); g.moveTo(px, py + TILE / 2); g.lineTo(px + TILE, py + TILE / 2);
        g.moveTo(px + off, py); g.lineTo(px + off, py + TILE / 2); g.moveTo(px + ((off + TILE / 2) % TILE), py + TILE / 2); g.lineTo(px + ((off + TILE / 2) % TILE), py + TILE);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(px + 2, py + 2, TILE - 4, 2);
        if (TH.snow && h(3) > 0.7) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(px + h(4) * TILE, py + h(5) * TILE, 8, 3, 0, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case T.HOLY: case T.DARK: {
        const holy = t === T.HOLY;
        g.fillStyle = holy ? shade('#e4eaf2', 0.97 + h(1) * 0.05) : shade('#2b2329', 0.9 + h(1) * 0.2);
        g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = holy ? 'rgba(90,130,190,0.35)' : 'rgba(200,30,30,0.35)'; g.lineWidth = 1.5;
        g.strokeRect(px + 0.75, py + 0.75, TILE - 1.5, TILE - 1.5);
        g.beginPath(); g.moveTo(px + TILE / 2, py); g.lineTo(px + TILE / 2, py + TILE); g.moveTo(px, py + TILE / 2); g.lineTo(px + TILE, py + TILE / 2); g.stroke();
        if (holy && (tx + ty) % 6 === 0) {
          g.fillStyle = 'rgba(70,130,220,0.25)';
          for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(px + 24, py + 24, 3.5, 11, (k * Math.PI) / 3, 0, Math.PI * 2); g.fill(); }
        }
        if (!holy && h(4) > 0.8) {
          g.strokeStyle = 'rgba(255,60,30,0.55)'; g.lineWidth = 1.2; g.beginPath();
          let x = px + h(5) * TILE, y = py + h(6) * TILE; g.moveTo(x, y);
          for (let k = 0; k < 3; k++) { x += (h(160 + k) - 0.5) * 20; y += (h(170 + k) - 0.5) * 20; g.lineTo(x, y); }
          g.stroke();
        }
        break;
      }
    }
    // Fine grit is baked once per chunk, never generated in the frame loop.
    // All randomness comes from world coordinates so reloaded chunks look identical.
    const land=t!==T.WATER&&t!==T.BRIDGE;
    if(land){
      g.save();g.beginPath();g.rect(px,py,TILE,TILE);g.clip();
      for(let k=0;k<72;k++){
        const x=px+h(600+k)*TILE,y=py+h(700+k)*TILE,n=h(800+k);
        g.fillStyle=n>.5?'rgba(225,218,186,.11)':'rgba(22,31,26,.12)';g.fillRect(x,y,.5+n*1.4,.5+n*.8);
      }
      if(t===T.PATH||t===T.SAND||t===T.FIELD){
        for(let k=0;k<8;k++){const x=px+h(900+k)*TILE,y=py+h(920+k)*TILE,r=.8+h(940+k)*1.8;
          g.fillStyle='#655f5055';g.beginPath();g.ellipse(x+.5,y+.8,r,r*.55,0,0,Math.PI*2);g.fill();g.fillStyle='#c6b89a66';g.fillRect(x-r*.5,y-.3,r,.6);}
      }
      if(t===T.GRASS){
        g.strokeStyle='rgba(54,43,26,.25)';g.lineWidth=.7;
        for(let k=0;k<3;k++){const x=px+4+h(960+k)*(TILE-8),y=py+5+h(970+k)*(TILE-10);g.beginPath();g.moveTo(x,y);g.lineTo(x+3,y-1);g.lineTo(x+7,y+1);g.stroke();}
      }
      g.restore();
    }
  }
  function paintEdges(g, tileAt, tx, ty, px, py) {
    const t = tileAt(tx, ty);
    const dirs = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
    const isWaterish = (k) => k === T.WATER;
    for (const [dx, dy, side] of dirs) {
      const n = tileAt(tx + dx, ty + dy);
      if (n === t) continue;
      // grass tufts spill over paths / sand / field
      if (n === T.GRASS && (t === T.PATH || t === T.SAND || t === T.FIELD)) {
        // Recessed walking paths: a soft contact shadow underneath the grassy lip.
        const vertical = side === 'w' || side === 'e';
        const x = side === 'e' ? px + TILE : px, y = side === 's' ? py + TILE : py;
        const inward = side === 'e' || side === 's' ? -1 : 1;
        const rim = g.createLinearGradient(x, y, x + (vertical ? inward * 8 : 0), y + (vertical ? 0 : inward * 8));
        rim.addColorStop(0, 'rgba(78,92,65,.22)'); rim.addColorStop(1, 'rgba(78,92,65,0)');
        g.fillStyle = rim;
        g.fillRect(vertical && inward < 0 ? x - 8 : x, !vertical && inward < 0 ? y - 8 : y, vertical ? 8 : TILE, vertical ? TILE : 8);
        g.fillStyle = grassColor(tx + dx, ty + dy);
        for (let k = 0; k < 7; k++) {
          const u = hash(tx, ty, 300 + k + side.charCodeAt(0)) * TILE, d = 2 + hash(tx, ty, 320 + k) * 6;
          const [x, y] = side === 'n' ? [px + u, py] : side === 's' ? [px + u, py + TILE] : side === 'w' ? [px, py + u] : [px + TILE, py + u];
          g.beginPath();g.moveTo(x-(vertical?0:2),y-(vertical?2:0));
          g.lineTo(x+(vertical?inward*d:1),y+(vertical?1:inward*d));g.lineTo(x+(vertical?0:2),y+(vertical?2:0));g.closePath();g.fill();
        }
      }
      // shoreline foam (dark crust around lava)
      if (isWaterish(t) && !isWaterish(n) && n !== T.BRIDGE) {
        const vertical = side === 'w' || side === 'e';
        const bx = side === 'e' ? px + TILE : px, by = side === 's' ? py + TILE : py;
        const inward = side === 'e' || side === 's' ? -1 : 1;
        const bank = g.createLinearGradient(bx, by, bx + (vertical ? inward * 12 : 0), by + (vertical ? 0 : inward * 12));
        bank.addColorStop(0, TH.lava ? 'rgba(42,28,30,.7)' : 'rgba(32,49,43,.6)');
        bank.addColorStop(.4, TH.lava ? 'rgba(242,128,42,.25)' : 'rgba(116,139,108,.28)');
        bank.addColorStop(1, 'rgba(116,139,108,0)');
        g.fillStyle = bank;
        g.fillRect(vertical && inward < 0 ? bx - 12 : bx, !vertical && inward < 0 ? by - 12 : by, vertical ? 12 : TILE, vertical ? TILE : 12);
        // Irregular wet sediment replaces the bright square foam border.
        g.fillStyle=TH.lava?'#302526':shade(TH.sand||TH.path||'#8e8166',.64);g.beginPath();g.moveTo(bx,by);
        for(let u=0;u<=TILE;u+=4){const d=1.8+hash(tx,ty,1100+u+side.charCodeAt(0))*3;g.lineTo(bx+(vertical?inward*d:u),by+(vertical?u:inward*d));}
        g.lineTo(bx+(vertical?0:TILE),by+(vertical?TILE:0));g.closePath();g.fill();
      }
      // cliff: a rock face hanging below its south edge, a light rim on the north edge
      if (t === T.CLIFF && n !== T.CLIFF) {
        const cl = TH.cliff || ['#857c70', '#4e4842'];
        if (side === 's') {
          const fg = g.createLinearGradient(0, py + TILE - 18, 0, py + TILE);
          fg.addColorStop(0, shade(cl[1], 1.15)); fg.addColorStop(1, shade(cl[1], 0.7));
          g.fillStyle = fg; g.fillRect(px, py + TILE - 18, TILE, 18);
          g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
          for (let k = 0; k < 4; k++) { const x = px + 6 + k * 11 + hash(tx, ty, 400 + k) * 4; g.beginPath(); g.moveTo(x, py + TILE - 16); g.lineTo(x - 2, py + TILE); g.stroke(); }
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + TILE - 2, TILE, 2);
        } else if (side === 'n') { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px, py, TILE, 3); }
        else { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(side === 'w' ? px : px + TILE - 3, py, 3, TILE); }
      }
      // ice rim
      if (t === T.ICE && n !== T.ICE && n !== T.WATER) {
        g.fillStyle = 'rgba(255,255,255,0.6)';
        const [x, y, w, hh] = side === 'n' ? [px, py, TILE, 3] : side === 's' ? [px, py + TILE - 3, TILE, 3] : side === 'w' ? [px, py, 3, TILE] : [px + TILE - 3, py, 3, TILE];
        g.fillRect(x, y, w, hh);
      }
      // bridge rails
      if (t === T.BRIDGE && n === T.WATER && (side === 'n' || side === 's')) {
        g.fillStyle = '#4a3020'; g.fillRect(px, side === 'n' ? py : py + TILE - 6, TILE, 6);
        g.fillStyle = '#6b4a2e'; g.fillRect(px + 4, side === 'n' ? py - 6 : py + TILE - 12, 6, 12);
      }
      // base floor rim
      if ((t === T.HOLY || t === T.DARK) && n !== T.HOLY && n !== T.DARK) {
        g.fillStyle = t === T.HOLY ? 'rgba(80,120,180,0.5)' : 'rgba(150,20,20,0.6)';
        const [x, y, w, h] = side === 'n' ? [px, py, TILE, 4] : side === 's' ? [px, py + TILE - 4, TILE, 4] : side === 'w' ? [px, py, 4, TILE] : [px + TILE - 4, py, 4, TILE];
        g.fillRect(x, y, w, h);
      }
    }
  }

  // ------------------------------------------------------------------ minimap
  Art.renderMinimap = function (map) {
    const [c, g] = mk(map.w, map.h);
    const img = g.createImageData(map.w, map.h);
    const col = {
      [T.GRASS]: [86, 140, 66], [T.PATH]: [176, 146, 100], [T.WATER]: [48, 110, 170], [T.HOLY]: [225, 235, 248],
      [T.DARK]: [60, 40, 48], [T.BRIDGE]: [140, 96, 56], [T.SAND]: [212, 194, 140], [T.FIELD]: [140, 104, 76], [T.PLAZA]: [200, 180, 140],
      [T.CLIFF]: rgb((TH.cliff || ['#857c70', '#4e4842'])[1]), [T.ICE]: [190, 224, 242],
    };
    if (TH.grass) {
      Object.assign(col, { [T.GRASS]: rgb(TH.grass[0]), [T.PATH]: rgb(TH.path), [T.WATER]: rgb(TH.water[1]), [T.SAND]: rgb(TH.sand),
        [T.FIELD]: rgb(TH.field), [T.PLAZA]: rgb(TH.plaza) });
    }
    const tree = col[T.GRASS].map((v) => v * 0.6);
    for (let k = 0; k < map.w * map.h; k++) {
      let cc = col[map.tiles[k]];
      if (map.solid[k] && map.tiles[k] === T.GRASS) cc = TH.grass ? tree : [44, 86, 40];
      img.data[k * 4] = cc[0]; img.data[k * 4 + 1] = cc[1]; img.data[k * 4 + 2] = cc[2]; img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  };
})();
