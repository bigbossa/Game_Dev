// Honor-style rising light for Unique/Legendary/Mythic equipment, behind the body.
// Uses the existing five slot grades sent to every client; no particle allocations or pixel reads per frame.
(function () {
  const A = window.EquipmentAura = {}, TAU = Math.PI * 2, stamps = new Map();
  const PALETTES = {
    dharma: {
      3: { core: '#ffffff', light: '#ffffff', main: '#effaff', edge: '#a9c7df' },
      4: { core: '#f3fff9', light: '#c9ffe4', main: '#79efb8', edge: '#3dbb9b' },
      5: { core: '#f5fcff', light: '#ccefff', main: '#74cfff', edge: '#438ee9' },
    },
    adharma: {
      3: { core: '#ffe5f3', light: '#ffc3e1', main: '#ff91c7', edge: '#bf427f' },
      4: { core: '#f0e4ff', light: '#d5adff', main: '#b77cff', edge: '#753cc2' },
      5: { core: '#ffd1e3', light: '#ff8cb6', main: '#ff4f66', edge: '#a32755' },
    },
  };
  A.state = function (e) {
    if (!e || e.dead) return null;
    let count = 0, grade = 0;
    for (let slot = 0; slot < 5; slot++) {
      if (slot && !e.ar?.[slot - 1]) continue;
      const g = e.gg?.[slot] ?? (slot === 0 ? e.wg : 0) ?? 0;
      if (g !== 3 && g !== 4 && g !== 5) continue;
      // A higher grade starts its own count. Lower-grade pieces never enlarge it.
      if (g > grade) { grade = g; count = 1; }
      else if (g === grade) count++;
    }
    if (!count) return null;
    const faction = e.faction === 'adharma' ? 'adharma' : 'dharma';
    return { count, grade, faction, palette: PALETTES[faction][grade],
      radius: .28 + count * .055, height: .76 + count * .085, strength: .43 + count * .065 };
  };
  function stamp(state) {
    const key = state.faction + state.grade;
    if (stamps.has(key)) return stamps.get(key);
    const c = Object.assign(document.createElement('canvas'), { width: 192, height: 256 });
    const g = c.getContext('2d'), P = state.palette;
    // Diffuse flame-shaped veil; the bottom stays transparent outside the feet.
    for (const [x,y,rx,ry,color,alpha] of [
      [96,143,92,110,P.edge,.40], [96,158,65,91,P.main,.53],
      [96,177,39,64,P.light,.56], [96,199,24,29,P.core,.65],
    ]) {
      g.save();g.translate(x,y);g.scale(rx,ry);
      const gr=g.createRadialGradient(0,0,0,0,0,1);
      gr.addColorStop(0,color);gr.addColorStop(.25,color+'b0');gr.addColorStop(.65,color+'38');gr.addColorStop(1,color+'00');
      g.globalAlpha=alpha;g.fillStyle=gr;g.fillRect(-1,-1,2,2);g.restore();
    }
    stamps.set(key,c);return c;
  }
  // Exposed for deterministic visual checks. H is the visible body height in drawing coordinates.
  A.drawAt = function (g, e, x, y, H, time) {
    const S=A.state(e);if(!S)return;
    const P=S.palette,R=S.radius,L=S.height;
    const phase=time*1.5+(e.x||0)*.017+(e.y||0)*.011;
    g.save();g.translate(x,y);g.scale(H,H);g.globalCompositeOperation='lighter';
    const alpha=g.globalAlpha;
    g.globalAlpha=alpha*S.strength*(.92+.08*Math.sin(phase));
    g.drawImage(stamp(S),-R,-L,R*2,L*1.08);
    // Ground bloom, not a hard circle: light gathers under the feet and rises at the sides.
    g.save();g.scale(1,.14);
    const floor=g.createRadialGradient(0,0,0,0,0,R*1.1);
    floor.addColorStop(0,P.light+'b0');floor.addColorStop(.35,P.main+'70');floor.addColorStop(1,P.edge+'00');
    g.fillStyle=floor;g.fillRect(-R*1.1,-R*1.1,R*2.2,R*2.2);g.restore();
    for(let i=0;i<4+S.count;i++){
      const side=i%2?1:-1,offset=i*.73;
      const bx=side*R*(.32+(i%3)*.17),tip=side*R*(.55+.12*Math.sin(phase+offset));
      const rise=L*(.62+.16*Math.sin(phase*.7+offset));
      const gr=g.createLinearGradient(0,0,0,-rise);
      gr.addColorStop(0,P.main+'00');gr.addColorStop(.23,P.main+'90');gr.addColorStop(.65,P.light+'90');gr.addColorStop(1,P.core+'00');
      g.globalAlpha=alpha*S.strength*(.34+.09*Math.sin(phase+offset));
      g.beginPath();g.moveTo(bx,0);
      g.bezierCurveTo(bx+side*R*.55,-rise*.26,tip-side*R*.4,-rise*.68,tip,-rise);
      g.bezierCurveTo(tip-side*R*.12,-rise*.60,bx+side*R*.20,-rise*.30,bx+side*R*.10,0);
      g.closePath();g.fillStyle=gr;g.fill();
    }
    // Sparse ascending motes. Their phase is derived from time, so changing equipment leaves no trails behind.
    for(let i=0;i<2+S.count;i++){
      const u=(time*.19+i*.381966)%1,a=i*2.39996;
      const px=Math.sin(a)*R*(.50+u*.28),py=-L*(.12+u*.78),r=.008+(i%2)*.003;
      g.globalAlpha=alpha*S.strength*Math.sin(u*Math.PI)*.66;
      g.fillStyle=i%2?P.light:P.core;g.beginPath();g.ellipse(px,py,r*.55,r*1.7,0,0,TAU);g.fill();
    }
    g.restore();
  };
  A.draw = function (g,e,F,meta,x,y,scale,time=performance.now()/1000,bounds) {
    if(!A.state(e))return;
    const I=ModelTiers.info(ModelTiers.key(e.faction,F.atk,e.cls));
    const frame=I?.frames?.[F.frame*8+C.DIR_COL[F.dir]];
    let H=(frame?.BH || meta.frameHeight*.72)*scale;
    // Fit the maximum five-piece extent once, so all counts retain the same growth curve in small previews.
    if(bounds)H=Math.min(H,bounds.width/(2*.555*1.25),bounds.height/1.185);
    A.drawAt(g,e,x,y,H,time);
  };
})();
