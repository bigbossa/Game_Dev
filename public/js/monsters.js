// Monster compositor. Rounded archetypes are registered by monster-shapes.js.
// Species palettes, animation state, world anchors and optional sprite sheets stay data-driven.
(function () {
  const M = {};
  window.MonsterArt = M;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------ AI-drawn sprite sheets
  // public/assets/monsters/<id>.png + index.json from tools/build-monsters.js (8 directions x 3 walk frames, or one
  // side view). A monster with a sheet uses it; other species use monster-shapes.js.
  let INDEX = {};
  const SHEETS = {};
  M.setSprites = (index) => { INDEX = index || {}; for(const k of Object.keys(SHEETS))delete SHEETS[k]; };
  M.hasSheet = (type) => !!INDEX[type];
  function mipChain(img) {
    const mips = [img];
    let p = img;
    while (p.width > 96 && p.height > 96) {
      const n = document.createElement('canvas'); n.width = Math.round(p.width / 2); n.height = Math.round(p.height / 2);
      const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(p, 0, 0, n.width, n.height);
      mips.push(n); p = n;
    }
    return mips;
  }
  function sheetOf(type) {
    const meta = INDEX[type];
    if (!meta) return null;
    let sh = SHEETS[type];
    if (!sh) {
      sh = SHEETS[type] = { meta, img: new Image(), mips: null };
      sh.img.onload = () => { sh.mips = mipChain(sh.img); };
      sh.img.src = `assets/monsters/${meta.file || type+'.png'}?v=${meta.version || meta.fw+'x'+meta.fh}`;
    }
    return sh.mips ? sh : null;
  }
  const WEST = [3, 4, 5];                               // octants facing left (SW, W, NW)
  function drawSheet(g, sh, def, x, y, t, s) {
    const m = sh.meta, A = C.MON_ART[def.art] || C.MON_ART.wisp, k = def.size || 1;
    const dir = s.dir ?? (s.face < 0 ? 3 : 1);
    const col = m.cols === 8 ? C.DIR_COL[dir] : 0, flip = m.cols !== 8 && WEST.includes(dir);
    const walk=m.walkRows||[0,1,2,1];
    const row = m.attackRow!==undefined&&(s.atk||0)>.15 ? m.attackRow : m.rows >= 3 ? (s.moving ? walk[Math.floor(t*8)%walk.length] : (m.idleRow??1)) : 0;
    const sc = (m.height || A.h*k) / (m.contentHeight || m.fh-8);
    const bob = def.art === 'wisp' || def.art === 'bird' ? Math.sin(t * 3 + (s.seed || 0)) * 3 : 0;
    const T = g.getTransform(), dev = Math.hypot(T.a, T.b) * sc;
    let mi = 0;
    while (mi + 1 < sh.mips.length && dev * Math.pow(2, mi + 1) <= 1) mi++;
    const img = sh.mips[mi], km = img.width / sh.img.width;
    const shd = SHADOW[def.art] || SHADOW.wisp;
    if(!flip&&!(s.flash>0)&&(s.alpha===undefined||s.alpha===1)&&g.imageSmoothingQuality==='high'){
      const fill=g.fillStyle;
      g.fillStyle='rgba(0,0,0,0.28)';g.beginPath();g.ellipse(x,y,shd[0]*k,shd[1]*k,0,0,TAU);g.fill();g.fillStyle=fill;
      g.drawImage(img,col*m.fw*km,row*m.fh*km,m.fw*km,m.fh*km,x-m.ax*sc,y+bob-m.ay*sc,m.fw*sc,m.fh*sc);
      return;
    }
    g.save();
    if (s.alpha !== undefined) g.globalAlpha *= s.alpha;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x, y, shd[0] * k, shd[1] * k, 0, 0, TAU); g.fill();
    g.translate(x, y + bob);
    if (flip) g.scale(-1, 1);
    if (s.flash > 0) g.filter = `brightness(${1 + s.flash * 1.6})`;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, col * m.fw * km, row * m.fh * km, m.fw * km, m.fh * km, -m.ax * sc, -m.ay * sc, m.fw * sc, m.fh * sc);
    g.restore();
  }

  // Ground shadow per archetype [rx, ry], drawn separately from the body.
  const SHADOW = { wisp: [16, 5], boar: [26, 8], wolf: [26, 7], golem: [36, 10], demon: [58, 16], serpent: [30, 7], insect: [28, 7],
    bird: [18, 5], human: [18, 6], plant: [28, 8], dragon: [46, 12] };
  const INK = '#202729';
  let off = null, og = null, ink = null, ig = null;
  const fit = (c, w, h) => { if (c.width < w) c.width = w; if (c.height < h) c.height = h; };
  // draw with facing + flash, at the species' size: render -> shade -> ink outline -> composite
  M.draw = function (g, type, x, y, face, t, s) {
    const def = C.MONSTERS[type] || C.MONSTERS.spirit, art = M[def.art] ? def.art : 'wisp';
    const sheet = sheetOf(type);
    if (sheet) return drawSheet(g, sheet, def, x, y, t, { ...s, face });
    const A = C.MON_ART[art] || C.MON_ART.wisp, k = def.size || 1, f = face < 0 ? -1 : 1;
    const T = g.getTransform(), dev = Math.hypot(T.a, T.b);                // device px per world px
    if (!off) { off = document.createElement('canvas'); og = off.getContext('2d'); ink = document.createElement('canvas'); ig = ink.getContext('2d'); }
    // off-screen box in the monster's own units: x -BW..BW, y -BH..BB (feet at 0)
    const BW = A.r * 2.2 + 50, BH = A.h + 44, BB = 22;
    const sc = Math.min(dev * k, 1100 / (2 * BW));
    const cw = Math.ceil(2 * BW * sc), ch = Math.ceil((BH + BB) * sc);
    fit(off, cw, ch); fit(ink, cw, ch);
    og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; og.filter = 'none';
    // The pooled canvas can be larger than this species. Clear the full surface so
    // image smoothing cannot sample stale pixels just outside the source rectangle.
    og.clearRect(0, 0, off.width, off.height);
    og.setTransform(sc * f, 0, 0, sc, BW * sc, BH * sc);
    M[art](og, t, s, def.look);
    // Warm overhead light and a cool underside complement the per-shape volume.
    og.setTransform(1, 0, 0, 1, 0, 0);
    og.globalCompositeOperation = 'source-atop'; og.globalAlpha = 1;
    const top = (BH - A.h) * sc, feet = BH * sc;
    const vg = og.createLinearGradient(0, top, 0, feet);
    vg.addColorStop(0, 'rgba(255,246,218,0.15)'); vg.addColorStop(0.4, 'rgba(255,255,255,0)');
    vg.addColorStop(0.62, 'rgba(32,45,67,0)'); vg.addColorStop(1, 'rgba(32,45,67,0.18)');
    og.fillStyle = vg; og.fillRect(0, 0, cw, ch);
    og.globalCompositeOperation = 'source-over';
    // ink silhouette for the outline
    ig.setTransform(1, 0, 0, 1, 0, 0); ig.globalCompositeOperation = 'source-over'; ig.clearRect(0, 0, ink.width, ink.height);
    ig.drawImage(off, 0, 0, cw, ch, 0, 0, cw, ch);
    ig.globalCompositeOperation = 'source-in'; ig.fillStyle = INK; ig.fillRect(0, 0, cw, ch);
    ig.globalCompositeOperation = 'source-over';
    // ground shadow
    const sh = SHADOW[art] || SHADOW.wisp;
    g.save(); if (s.alpha !== undefined) g.globalAlpha *= s.alpha;
    g.translate(x + 3 * k, y + 1); g.scale(sh[0] * k * 1.25, sh[1] * k * 1.25);
    const ground = g.createRadialGradient(0, 0, .1, 0, 0, 1);
    ground.addColorStop(0, 'rgba(32,52,57,.32)'); ground.addColorStop(.55, 'rgba(32,52,57,.17)');
    ground.addColorStop(1, 'rgba(32,52,57,0)');
    g.fillStyle = ground; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    // composite in device pixels: 8 ink copies around, then the shaded body
    const dx = T.a * x + T.c * y + T.e - BW * sc, dy = T.b * x + T.d * y + T.f - BH * sc;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (s.alpha !== undefined) g.globalAlpha *= s.alpha;
    const o = Math.max(.65, Math.min(1.35, dev * 0.6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.drawImage(ink, 0, 0, cw, ch, dx + Math.cos(a) * o, dy + Math.sin(a) * o, cw, ch);
    }
    if (s.flash > 0) g.filter = `brightness(${1 + s.flash * 1.6})`;
    g.drawImage(off, 0, 0, cw, ch, dx, dy, cw, ch);
    g.restore();
  };
  // Bake reusable motion frames, then blit. Drawing every scale/facet/outline on
  // every monster on every frame is too expensive in crowded hunting grounds.
  const proceduralDraw=M.draw,frames=new Map();let cacheBytes=0;
  const CACHE_LIMIT=96*1024*1024,QUALITY=2;
  M.clearFrameCache=()=>{frames.clear();cacheBytes=0;};
  M.draw=function(g,type,x,y,face,t,s={}){
    if(M.hasSheet(type))return proceduralDraw(g,type,x,y,face,t,s);
    const def=C.MONSTERS[type]||C.MONSTERS.spirit,A=C.MON_ART[def.art]||C.MON_ART.wisp,k=def.size||1;
    const attack=(s.atk||0)>.05,pose=attack?'attack':s.casting?'cast':s.moving?'walk':'idle';
    const count=attack?5:pose==='walk'?8:pose==='cast'?3:['wisp','bird','dragon'].includes(def.art)?6:1;
    const phase=attack?Math.min(4,Math.round(s.atk*4)):Math.floor((((t*(pose==='walk'?9:2)+(s.seed||0))%TAU+TAU)%TAU)/TAU*count);
    const key=type+'|'+pose+'|'+phase;let frame=frames.get(key);
    if(frame){frames.delete(key);frames.set(key,frame);}
    else{
      const bw=(A.r*2.2+50)*k,bh=(A.h+44)*k,bb=22*k,c=document.createElement('canvas');
      c.width=Math.ceil(bw*2*QUALITY);c.height=Math.ceil((bh+bb)*QUALITY);
      const ctx=c.getContext('2d');ctx.scale(QUALITY,QUALITY);
      proceduralDraw(ctx,type,bw,bh,1,phase/count*TAU/(pose==='walk'?9:2),{seed:0,moving:pose==='walk',casting:pose==='cast',atk:attack?phase/4:0});
      frame={img:c,bw,bh,bytes:c.width*c.height*4};frames.set(key,frame);cacheBytes+=frame.bytes;
      while(cacheBytes>CACHE_LIMIT&&frames.size>1){const first=frames.keys().next().value;cacheBytes-=frames.get(first).bytes;frames.delete(first);}
    }
    g.save();g.translate(x,y);if(face<0)g.scale(-1,1);if(s.alpha!==undefined)g.globalAlpha*=s.alpha;
    if(s.flash>0)g.filter='brightness('+(1+s.flash*1.6)+')';g.imageSmoothingQuality='high';
    g.drawImage(frame.img,-frame.bw,-frame.bh,frame.img.width/QUALITY,frame.img.height/QUALITY);g.restore();
  };
  // visual height for name tags and hit boxes
  M.heightOf = (type) => { const d = C.MONSTERS[type]; return INDEX[type]?.height || (d ? (C.MON_ART[d.art] || C.MON_ART.wisp).h * (d.size || 1) : 58); };
})();
