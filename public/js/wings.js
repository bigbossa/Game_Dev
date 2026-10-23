// Wings by player level (they replace the old capes of the level looks): Lv.60 feathered wings, Lv.80 great wings
// with gold leading edges, Lv.100 divine wings (two pairs, glowing). ธรรมะ white-blue feathers, อธรรม black with
// red tips. Lv.130: เทพเซียน three pairs of radiant white-gold wings, เทพมาร great membrane (bat / dragon) wings with
// glowing crimson veins and claws, two pairs. Drawn live outside the sprite frame (never clipped), placed per view:
//   front views  both wings spread behind the body, the one nearer the camera foreshortened on diagonals
//   back views   both wings sprout from the shoulder blades over the back
//   side views   the far wing raised behind the body, the near wing over the back, both sweeping backward
// and they flap: slowly when standing, faster when walking.
(function () {
  const WG = {};
  window.Wings = WG;
  const TAU = Math.PI * 2;
  const RES = 3;                       // wing images are rendered at 3x, then pre-shrunk copies are used (mip chain)

  // per level-look tier (ModelTiers.tierOf): len = wing length in world px at the 0.5 sprite scale
  const DESIGN = {
    4: { len: 30, rows: 2, dharma: { base: '#ffffff', tip: '#a8d8ff', edge: '#7aa8d8' }, adharma: { base: '#2e2428', tip: '#b0202c', edge: '#14090c' } },
    5: { len: 40, rows: 3, gold: '#e8c060', dharma: { base: '#ffffff', tip: '#5aa8ff', edge: '#3a6ab0' }, adharma: { base: '#1c1418', tip: '#e02a34', edge: '#0a0406' } },
    6: { len: 50, rows: 3, gold: '#ffe08a', lower: true, dharma: { base: '#ffffff', tip: '#8ad8ff', edge: '#4a8ad8', glow: '#bfe6ff' },
      adharma: { base: '#140a0e', tip: '#c81e2a', edge: '#050203', glow: '#8a0a18' } },
    7: { len: 62, rows: 3, gold: '#fff2b0', lower: true, upper: true, dharma: { scale: 0.72, base: '#ffffff', tip: '#ffe7a0', edge: '#c9a040', glow: '#fff0b0' },
      adharma: { membrane: true, scale: 0.68, bone: '#14080c', boneHi: '#5a3a40', skin: ['#2a0810', '#9a0c1c'], vein: '#ff3a2a', claw: '#efe0d0', glow: '#ff1a2a' } },
  };
  // นักพรต colours (same shapes and sizes as the twin blades)
  const TAO = {
    4: { dharma: { base: '#ffffff', tip: '#9fffd0', edge: '#3ab884' }, adharma: { base: '#1a1214', tip: '#ff5a1a', edge: '#0a0406' } },
    5: { dharma: { base: '#ffffff', tip: '#5affb0', edge: '#2a8a64' }, adharma: { base: '#140c0e', tip: '#ff3a1a', edge: '#050203' } },
    6: { dharma: { base: '#ffffff', tip: '#8affc8', edge: '#2ab884', glow: '#c8ffe4' }, adharma: { base: '#0c0608', tip: '#ff4a1a', edge: '#030102', glow: '#ff2a0a' } },
    7: { dharma: { scale: 0.72, base: '#ffffff', tip: '#c8ffd8', edge: '#c9a040', glow: '#d8fff0' },
      adharma: { membrane: true, scale: 0.68, bone: '#0a0406', boneHi: '#4a2a20', skin: ['#1a0604', '#a0200a'], vein: '#ff7a1a', claw: '#efe0d0', glow: '#ff3a0a' } },
  };
  const paletteOf = (tier, faction, cls) => (cls === 'taoist' && TAO[tier] ? TAO[tier][faction] : DESIGN[tier][faction]);
  WG.NAMES = { 4: 'ปีกขนนก', 5: 'ปีกมหาปักษา (ขอบทอง)', 6: 'ปีกเทพสวรรค์ (สองคู่ เรืองแสง)', 7: 'ปีกเทพเซียนสามคู่ / ปีกพังผืดเทพมาร' };
  WG.has = (lvl) => !!DESIGN[ModelTiers.tierOf(lvl || 1)];
  // เทพมาร membrane wing: bone arm root -> elbow -> wrist, four finger bones fanning out, scalloped skin between them
  function membraneWing(g, P, L) {
    const elbow = [L * 0.36, -L * 0.52], wrist = [L * 0.78, -L * 0.86];
    const tips = [[L * 1.32, -L * 0.78], [L * 1.28, -L * 0.3], [L * 1.02, L * 0.14], [L * 0.6, L * 0.38]];
    const attach = [L * 0.06, L * 0.3];
    // skin: wrist -> each tip, scalloped edge curving in between the tips, back to the body
    const skin = new Path2D();
    skin.moveTo(0, 0); skin.quadraticCurveTo(elbow[0] * 0.9, elbow[1] * 1.1, wrist[0], wrist[1]);
    skin.lineTo(tips[0][0], tips[0][1]);
    const edgeTo = (a, b, k) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      skin.quadraticCurveTo(mx + (wrist[0] - mx) * k, my + (wrist[1] - my) * k, b[0], b[1]);
    };
    for (let i = 0; i < tips.length - 1; i++) edgeTo(tips[i], tips[i + 1], 0.32);
    edgeTo(tips[tips.length - 1], attach, 0.25);
    skin.closePath();
    const sg = g.createLinearGradient(wrist[0], wrist[1], L * 0.9, L * 0.3);
    sg.addColorStop(0, P.skin[0]); sg.addColorStop(1, P.skin[1]);
    g.save(); g.shadowColor = P.glow; g.shadowBlur = RES * 4; g.fillStyle = sg; g.fill(skin); g.restore();
    g.fillStyle = sg; g.globalAlpha = 0.9; g.fill(skin); g.globalAlpha = 1;
    // glowing veins from the wrist into the skin
    g.save(); g.clip(skin);
    g.strokeStyle = P.vein; g.lineWidth = RES * 0.55; g.shadowColor = P.glow; g.shadowBlur = RES * 3;
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i], b = tips[i + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      g.beginPath(); g.moveTo(wrist[0], wrist[1]);
      g.quadraticCurveTo(m[0] * 0.85 + wrist[0] * 0.15 + L * 0.05, m[1] * 0.85 + wrist[1] * 0.15, m[0] + (wrist[0] - m[0]) * 0.32, m[1] + (wrist[1] - m[1]) * 0.32);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = '#050203'; g.lineWidth = RES * 0.6; g.stroke(skin);
    // bones (arm + fingers), with a highlight
    const bone = (pts, w) => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, lw] of [['#050203', w + RES * 0.8], [P.bone, w], [P.boneHi, w * 0.3]]) {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
    };
    for (const t of tips) bone([wrist, t], L * 0.028);
    bone([[0, 0], elbow, wrist], L * 0.06);
    // claws at the wrist and the top finger
    for (const [x, y, a] of [[wrist[0], wrist[1], -1.9], [tips[0][0], tips[0][1], -0.6]]) {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = P.claw; g.strokeStyle = '#050203'; g.lineWidth = RES * 0.4;
      g.beginPath(); g.moveTo(-L * 0.03, 0); g.quadraticCurveTo(L * 0.05, -L * 0.04, L * 0.12, -L * 0.1); g.quadraticCurveTo(L * 0.04, L * 0.01, L * 0.03, L * 0.03); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  // one right wing (pointing +x, raised). Drawn on a roomy canvas, then cropped to the feathers so nothing is cut.
  function renderWing(tier, faction, cls) {
    const D = DESIGN[tier], P = paletteOf(tier, faction, cls), L = D.len * RES * (P.scale || 1);   // scale: a design drawn smaller than the tier length
    const W0 = Math.ceil(L * 2.8), H0 = Math.ceil(L * 2.6), ox = L * 0.4, oy = L * 1.3;
    const c = document.createElement('canvas'); c.width = W0; c.height = H0;
    const g = c.getContext('2d');
    g.translate(ox, oy); g.lineJoin = 'round';
    if (P.membrane) {
      // a smaller second pair below, then the great wing
      g.save(); g.translate(L * 0.04, L * 0.26); g.rotate(0.5); g.scale(0.5, 0.5); membraneWing(g, P, L); g.restore();
      membraneWing(g, P, L);
      return finish(c, W0, H0, ox, oy);
    }
    // leading edge (the "arm"): root -> wrist -> tip
    const edge = (u) => {
      const a = [0, 0], b = [L * 0.42, -L * 0.78], d = [L * 1.08, -L * 0.42], k = 1 - u;
      return [k * k * a[0] + 2 * k * u * b[0] + u * u * d[0], k * k * a[1] + 2 * k * u * b[1] + u * u * d[1]];
    };
    const feather = (x, y, ang, len, w, row) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      const p = new Path2D();
      p.moveTo(0, -w * 0.5); p.quadraticCurveTo(len * 0.55, -w * 0.75, len, 0); p.quadraticCurveTo(len * 0.55, w * 0.75, 0, w * 0.5); p.closePath();
      const gr = g.createLinearGradient(0, 0, len, 0);
      gr.addColorStop(0, P.base); gr.addColorStop(row === 0 ? 0.62 : 0.8, P.base); gr.addColorStop(1, P.tip);
      g.fillStyle = gr; g.fill(p);
      g.strokeStyle = P.edge; g.lineWidth = RES * 0.45; g.stroke(p);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = RES * 0.3;                  // the quill
      g.beginPath(); g.moveTo(w * 0.2, 0); g.lineTo(len * 0.85, 0); g.stroke();
      g.restore();
    };
    const wingBody = (scale, drop, rot = 0) => {
      g.save(); g.translate(0, drop); g.rotate(rot); g.scale(scale, scale);
      // rows: 0 primaries (longest, hanging down-out), then secondaries, then coverts along the arm
      for (let r = 0; r < D.rows; r++) {
        const n = 11 - r * 3, lenK = [0.78, 0.5, 0.28][r], wd = L * [0.13, 0.12, 0.1][r];
        for (let i = n - 1; i >= 0; i--) {
          const u = 0.12 + (i / (n - 1)) * 0.86;
          const [x, y] = edge(u);
          const ang = Math.PI * 0.5 - u * 1.25 - r * 0.08;                          // down at the root, outward at the tip
          const len = L * lenK * (0.55 + 0.6 * u) * (r === 0 && u > 0.85 ? 1.08 : 1);
          feather(x, y, ang, len, wd, r);
        }
      }
      // the arm itself (gold on Lv.80+)
      g.beginPath();
      for (let i = 0; i <= 16; i++) { const [x, y] = edge(i / 16 * 0.98); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = D.gold || P.base; g.lineWidth = L * 0.07; g.lineCap = 'round'; g.stroke();
      g.strokeStyle = P.edge; g.lineWidth = RES * 0.5; g.stroke();
      g.restore();
    };
    if (P.glow) { g.save(); g.shadowColor = P.glow; g.shadowBlur = RES * 6; }
    if (D.lower) wingBody(0.62, L * 0.32);          // Lv.100: a second, smaller pair below
    if (D.upper) wingBody(0.42, -L * 0.06, -0.45);  // Lv.130: a third pair raised above (seraph)
    wingBody(1, 0);
    if (P.glow) {
      g.restore();
      g.fillStyle = '#ffffff';                        // a few glints on the feathers
      for (let i = 0; i < 7; i++) {
        const [x, y] = edge(0.25 + i * 0.1);
        g.globalAlpha = 0.85; g.beginPath(); g.arc(x + L * 0.1, y + L * 0.18 + (i % 3) * L * 0.06, RES * 0.9, 0, TAU); g.fill();
      }
    }
    return finish(c, W0, H0, ox, oy);
  }
  // crop to the drawn pixels (+ a small margin for the glow) and build the mip chain
  function finish(c, W0, H0, ox, oy) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = g.getImageData(0, 0, W0, H0).data;
    let x0 = W0, y0 = H0, x1 = -1, y1 = -1;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (d[(y * W0 + x) * 4 + 3] > 4) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const m = 2; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W0 - 1, x1 + m); y1 = Math.min(H0 - 1, y1 + m);
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(c, -x0, -y0);
    // mip chain: halved copies (high quality) so the wing stays smooth when drawn small
    const mips = [out];
    while (mips[mips.length - 1].width > 24) {
      const p = mips[mips.length - 1], n = document.createElement('canvas');
      n.width = Math.max(1, Math.round(p.width / 2)); n.height = Math.max(1, Math.round(p.height / 2));
      const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(p, 0, 0, n.width, n.height);
      mips.push(n);
    }
    return { img: out, mips, rx: ox - x0, ry: oy - y0 };
  }
  const cache = {};
  const wingImg = (tier, faction, cls) => { const k = tier + faction + (cls || 'dualblade'); return cache[k] || (cache[k] = Object.assign(renderWing(tier, faction, cls), { membrane: cls !== 'archer' && !!paletteOf(tier, faction, cls).membrane })); };

  // The archer wears an open spirit-bow constellation, not a pair of wings.
  // One rear pass owns the frame, arrows and crest; its centre stays transparent.
  WG.archerLayout=function(tier,faction,s,size,B){
    // The inventory's legacy wing shrink must not collapse this frame into the hair.
    const spread=1+Math.max(0,tier-4)*.035,fit=Math.max(1,size);
    return {rx:B*.63*spread*fit,ry:B*.59*fit,clearX:B*.46,clearY:B*.53};
  };
  function archerConstellation(g,e,F,x,y,t,s,meta,size){
    const tier=ModelTiers.tierOf(e.lvl||1);
    if(tier<4||!window.ArcherModel?.ready)return;
    const col=C.DIR_COL[F.dir],a=ArcherModel.anchor(F.atk,F.frame,col,tier,e.faction);
    // The aura has a fixed physical size even while the painted archer crouches to fire.
    const rest=ArcherModel.anchor(false,3,col,tier,e.faction);
    const B=rest.bodyHeight*s,P=ArcherRoyal.palette(e.faction,tier),dark=e.faction==='adharma';
    const {rx,ry,clearX,clearY}=WG.archerLayout(tier,e.faction,s,size,B);
    const cx=x+(rest.headX-meta.anchorX)*s,cy=y+(a.feetY-meta.anchorY)*s-B*.53;
    const unit=B/140,step=e.lvl>=130?3:e.lvl>=120?2:1;
    g.save();g.translate(cx,cy);g.lineCap='round';g.lineJoin='round';
    // An explicit empty centre also protects the silhouette at small preview scales.
    g.beginPath();g.rect(-rx*2,-ry*2,rx*4,ry*4);g.ellipse(0,0,clearX,clearY,0,0,TAU);g.clip('evenodd');
    const diamond=(xx,yy,r)=>{
      g.beginPath();g.moveTo(xx,yy-r);g.lineTo(xx+r*.55,yy);g.lineTo(xx,yy+r);g.lineTo(xx-r*.55,yy);g.closePath();g.fill();g.stroke();
    };
    for(const side of [-1,1]){
      g.save();g.scale(side,1);
      // Recurved bow limbs: jade/gold celestial lacquer or obsidian/crimson metal.
      g.beginPath();g.moveTo(rx*.48,-ry*.88);
      g.bezierCurveTo(rx*.59,-ry*.63,rx*1.12,-ry*.39,rx,0);
      g.bezierCurveTo(rx*1.12,ry*.39,rx*.59,ry*.63,rx*.48,ry*.88);
      g.strokeStyle=dark?'#33131e':'#346358';g.lineWidth=5.5*unit;g.stroke();
      g.strokeStyle=P.metal;g.lineWidth=2.6*unit;g.stroke();
      g.strokeStyle=dark?'#d24958':'#c8e8be';g.lineWidth=.85*unit;g.stroke();
      g.globalAlpha=.45;g.strokeStyle=P.gem;g.lineWidth=.8*unit;
      g.beginPath();g.moveTo(rx*.50,-ry*.85);g.quadraticCurveTo(rx*.84,0,rx*.50,ry*.85);g.stroke();
      g.globalAlpha=.9;g.fillStyle=P.gem;g.strokeStyle=P.metal;g.lineWidth=.8*unit;diamond(rx,0,4.5*unit);
      if(tier>=5){
        // Floating arrows follow the outside of the bow, never a fan across the face.
        const count=tier>=6?step+1:1;
        for(let n=0;n<count;n++){
          const angle=-.40+n*.38,xx=(rx+9*unit)*Math.cos(angle),yy=ry*Math.sin(angle);
          g.save();g.translate(xx,yy);g.rotate(angle+.12);
          const len=(17+n*2)*unit;
          g.strokeStyle=P.metal;g.lineWidth=1.4*unit;g.beginPath();g.moveTo(0,len*.5);g.lineTo(0,-len*.5);g.stroke();
          g.fillStyle=P.gem;g.beginPath();g.moveTo(0,-len*.7);g.lineTo(3*unit,-len*.32);g.lineTo(0,-len*.40);g.lineTo(-3*unit,-len*.32);g.closePath();g.fill();
          for(const sign of [-1,1]){g.beginPath();g.moveTo(0,len*.25);g.lineTo(sign*3*unit,len*.43);g.stroke();}
          g.restore();
        }
      }
      if(tier>=6){
        g.globalAlpha=.30;g.strokeStyle=P.metal;g.lineWidth=.75*unit;
        g.beginPath();g.ellipse(0,0,rx+17*unit,ry+7*unit,0,-.78,.78);g.stroke();
        for(let n=0;n<step;n++){
          const ang=-.65+n*.6+Math.sin(t*.7+n)*.035;
          g.globalAlpha=.58+.13*Math.sin(t*1.3+n);g.fillStyle=P.gem;
          diamond((rx+17*unit)*Math.cos(ang),(ry+7*unit)*Math.sin(ang),2.2*unit);
        }
      }
      g.restore();
    }
    if(tier>=6){
      // Small arrowhead crest above the hair; no filled disc behind the head.
      g.translate(0,-ry-3*unit);g.globalAlpha=.88;g.strokeStyle=P.metal;g.fillStyle=P.gem;g.lineWidth=1.2*unit;
      diamond(0,0,7*unit);
      for(const side of [-1,1]){g.beginPath();g.moveTo(side*5*unit,3*unit);g.quadraticCurveTo(side*13*unit,5*unit,side*18*unit,0);g.stroke();}
    }
    g.restore();
  }

  // draws the wings of one character frame. pass: 'back' = before the sprite, 'front' = after it;
  // s = sprite scale, meta = sprite sheet meta (anchor), F = { atk, dir, frame }, size = extra wing scale (preview)
  WG.draw = function (g, e, F, x, y, t, s, pass, meta, size = 1) {
    if (e.cls === 'spearman') return; // the spear crest is drawn once, behind the body
    if (window.DualbladeLook && DualbladeLook.is(e)) return DualbladeLook.drawWings(g,e,F,x,y,t,s,pass,meta,size);
    if (e.dead) return;
    if(e.cls==='archer'){
      if(pass==='back')archerConstellation(g,e,F,x,y,t,s,meta,size);
      return;
    }
    const tier = ModelTiers.tierOf(e.lvl || 1), D = DESIGN[tier];
    const info = D && ModelTiers.info(ModelTiers.key(e.faction, F.atk, e.cls));
    let fr = info && info.frames[F.frame * 8 + C.DIR_COL[F.dir]];
    if (!fr) return;
    const faction = e.faction === 'adharma' ? 'adharma' : 'dharma';
    const W = wingImg(tier, faction, e.cls);
    const k = (s / 0.5) / RES * size;                             // image px -> world px
    // pick the mip closest above the on-screen size (smooth, no shimmer)
    const T = g.getTransform(), dev = Math.hypot(T.a, T.b) * k;
    let mi = 0;
    while (mi + 1 < W.mips.length && dev * Math.pow(2, mi + 1) <= 1) mi++;
    const img = W.mips[mi];
    const B = fr.BH * s, tr = fr.trail;                           // body height on screen, where the back points
    const rx = x + (fr.neck[0] - meta.anchorX) * s, ry = y + (fr.neck[1] + fr.BH * 0.06 - meta.anchorY) * s;
    const flap = Math.sin(t * (e.moving ? 7 : 2.2) + (e.x || 0) * 0.01) * (e.moving ? 0.16 : 0.07);
    const wing = (ax, ay, side, sx, rot, alpha) => {
      g.save(); g.translate(ax, ay); g.scale(side * sx, 1); g.rotate(rot - flap); g.globalAlpha *= alpha;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, -W.rx * k, -W.ry * k, W.img.width * k, W.img.height * k);
      g.restore();
    };
    if (fr.view === 'side') {
      // seen from the side: root on the shoulder blade, both wings sweep toward the back
      const side = tr > 0 ? 1 : -1, bx = rx + tr * B * 0.07;
      if (pass === 'back') wing(bx + side * B * 0.02, ry - B * 0.04, side, 0.62, -0.28, 0.8);   // far wing, raised
      else wing(bx, ry + B * 0.01, side, 0.72, 0.04, 1);                                       // near wing
      return;
    }
    const front = fr.view === 'front';
    if ((pass === 'back') !== front) return;              // front views: behind the body · back views: over the back
    // diagonal views: the wing on the side the back faces is seen broadside, the other one foreshortened
    const persp = (side) => 1 - 0.5 * Math.max(0, -side * tr);
    // membrane wings are solid skin: on the back they sit further apart so the back stays visible
    const mem = !!W.membrane;
    const spread = front ? 0 : B * (mem ? 0.075 : 0.035), lift = front ? 0 : -B * 0.015;
    for (const side of [-1, 1]) wing(rx + tr * B * 0.03 + side * spread, ry + lift, side, persp(side), front ? 0 : mem ? -0.16 : -0.05, 1);
  };
})();
