// Authored attachment points in sprite-cell pixels, independent of hair, crowns
// and raised weapons. Decoration is baked once into ArmorLook's cached sheets.
(function () {
  const TG = window.TaoistGear = {};
  const painted = new Map();
  TG.register = function(meta) {
    painted.clear(); pointCache.clear();
    for(const pose of ['walk','attack'])for(const faction of ['dharma','adharma']) {
      const frames=meta[pose]?.[faction]?.poseFrames;
      if(frames)painted.set(`tao-${pose}-${faction}`,frames);
    }
  };
  // [collar x, collar y, half shoulder span, shoulder slope].
  // Columns: S, SE, E, NE, N, NW, W, SW. Rows follow the source walk cycle.
  const shoulders = {
    dharma: [
      [[108,99,23,0],[116,96,20,-.23],[116,98,17,-.28],[101,99,23,.24],[91,99,25,0],[84,98,22,-.24],[75,98,17,.28],[104,98,23,.12]],
      [[104,99,22,0],[113,99,20,-.23],[114,99,17,-.28],[94,101,23,.24],[91,100,24,0],[85,101,22,-.24],[70,99,17,.28],[104,99,22,.12]],
      [[104,93,21,0],[111,96,20,-.23],[113,97,17,-.28],[96,98,23,.24],[91,98,24,0],[86,98,22,-.24],[73,97,17,.28],[103,95,22,.12]],
    ],
    adharma: [
      [[90,99,21,0],[111,99,18,-.23],[111,100,16,-.3],[103,102,20,.23],[91,103,25,0],[80,101,20,-.23],[70,99,16,.3],[100,99,21,.12]],
      [[80,102,21,0],[99,104,18,-.23],[99,103,16,-.3],[101,104,20,.23],[91,104,25,0],[78,104,20,-.23],[69,104,16,.3],[98,104,21,.12]],
      [[87,100,21,0],[101,102,18,-.23],[100,102,16,-.3],[99,103,20,.23],[90,104,25,0],[79,103,20,-.23],[70,102,16,.3],[97,102,21,.12]],
    ],
  };
  const castShoulders = {
    dharma: [
      [[74,90,20,0],[82,91,17,-.2],[81,91,15,-.25],[75,94,19,.2],[74,91,23,0],[71,94,19,-.2],[66,91,15,.25],[67,91,19,.15]],
      [[72,99,21,.18],[83,99,19,.2],[83,100,18,.28],[73,107,22,.2],[73,103,24,0],[72,107,22,-.2],[65,100,18,-.28],[65,100,21,-.18]],
      [[72,93,21,-.12],[80,95,17,-.25],[81,95,17,-.3],[74,101,21,.2],[74,100,23,0],[70,101,21,-.2],[65,95,17,.3],[68,94,21,.12]],
    ],
    adharma: [
      [[74,85,20,0],[65,86,18,.15],[82,85,15,-.2],[75,90,20,.25],[74,88,23,0],[70,90,20,-.25],[64,85,15,.2],[71,85,20,0]],
      [[72,101,22,.15],[68,103,21,-.15],[83,104,19,-.2],[72,108,22,.2],[73,106,24,0],[74,108,22,-.2],[64,104,19,.2],[70,102,22,.15]],
      [[73,95,21,0],[66,95,19,.15],[82,97,17,-.2],[74,100,21,.25],[74,99,24,0],[72,100,21,-.25],[65,97,17,.2],[71,95,21,0]],
    ],
  };
  TG.attachment = function (key, F) {
    const authored=painted.get(key)?.[F.row*8+F.col];
    if(authored)return authored.shoulder;
    const faction = key.endsWith('adharma') ? 'adharma' : 'dharma';
    const rows = key.includes('attack') ? castShoulders[faction] : shoulders[faction];
    const a = rows[F.row]?.[F.col];
    const base = a || [F.cx, F.y0 + F.BH * .52, F.BH * .12, 0];
    return window.TaoistPose ? TaoistPose.attachment(key,F,base) : base;
  };
  // Whisk ferrule -> end of its flowing hair; null means hidden by the body.
  // Preserve the original hand/handle and fibre silhouette, then add tier-specific
  // inlays, silk, ferrules and crowns. No extra weapon is floated beside the hand.
  const whisks = {
    dharma: [
      [[65,96,43,167],[72,113,47,164],[72,116,48,166],[129,119,148,169],null,[54,118,39,167],[112,119,147,164],[53,99,37,161]],
      [[64,96,43,169],[73,114,49,169],[72,115,47,170],[124,119,148,173],null,[53,118,37,170],[108,117,145,170],[52,99,37,168]],
      [[66,91,46,157],[71,113,50,164],[72,113,49,166],[128,117,148,167],null,[55,117,39,167],[110,116,145,164],[54,98,39,160]],
    ],
    adharma: [
      [[45,85,45,160],null,null,null,null,null,null,[32,87,35,158]],
      [[32,82,31,151],null,null,null,null,null,null,[27,89,27,155]],
      [[43,83,43,153],null,null,null,null,null,null,[30,89,31,155]],
    ],
  };
  const castWhisks = {
    dharma: [
      [[51,115,30,163],[51,112,27,170],[62,113,39,172],[98,118,112,162],null,[93,111,111,169],[90,113,112,171],[103,112,121,170]],
      [[60,15,22,57],[59,15,23,58],[58,16,22,58],[64,16,110,56],[65,16,33,60],[59,16,23,60],[91,16,124,57],[83,16,124,57]],
      [[42,111,27,162],[51,112,28,166],[58,115,34,165],[101,120,123,168],null,[50,119,27,168],[99,117,123,166],[41,114,25,161]],
    ],
    adharma: [
      [null,null,null,null,null,null,null,null],
      [[54,17,24,69],[80,15,125,69],[73,16,118,67],[81,16,108,66],[61,16,109,68],[79,16,43,69],[52,16,21,69],[61,16,30,69]],
      [[41,95,25,156],[46,98,33,155],null,null,null,null,null,[43,97,27,157]],
    ],
  };
  const materials = [
    null, ['#b58b60','#e9d6ac'], ['#d7e6e5','#6ba3b6'],
    ['#b88745','#e1b353'], ['#6fb8c9','#3173a4'], ['#41b997','#c6f7d8'],
    ['#d9ac4b','#257f69'], ['#d6b5f3','#8156a5'], ['#ead8a2','#219dbe'],
    ['#eeb650','#e78133'], ['#ffe4a3','#41bed7'], ['#c3f1eb','#7fddde'], ['#f4d891','#fff3d5'],
  ];
  const whiskAt = (key,F) => {
    const authored=painted.get(key)?.[F.row*8+F.col];
    if(authored)return authored.whisk;
    const faction = key.endsWith('adharma') ? 'adharma' : 'dharma';
    const p = (key.includes('attack') ? castWhisks : whisks)[faction][F.row]?.[F.col];
    if(!p || !window.TaoistPose)return p;
    return [...TaoistPose.point(key,F.row,F.col,p[0],p[1]),...TaoistPose.point(key,F.row,F.col,p[2],p[3])];
  };
  // The old colour-based armour masks also classified the pale whisk as robe.
  // Remove the brush region once at load time, before any equipment is composed.
  TG.excludeWeapons = function (key, mask, width, height) {
    const I = ModelTiers.info(key);
    if (!I) return;
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const g=c.getContext('2d');
    I.frames.forEach(F=>{
      const p=whiskAt(key,F);
      if(!p) return;
      const [x,y,tx,ty]=p, L=Math.hypot(tx-x,ty-y);
      g.save();g.beginPath();g.rect(F.X,F.Y,I.fw,I.fh);g.clip();
      g.translate(F.X+x,F.Y+y);g.rotate(Math.atan2(ty-y,tx-x)-Math.PI/2);
      g.beginPath();g.moveTo(-4,-5);
      g.bezierCurveTo(-29,L*.15,-28,L*.65,1,L+6);
      g.lineTo(7,L+3);g.bezierCurveTo(-4,L*.55,12,L*.2,5,-5);g.closePath();g.fill();
      g.restore();
    });
    const d=g.getImageData(0,0,width,height).data;
    for(let i=0;i<d.length;i+=4)if(d[i+3]) {mask[i]=mask[i+1]=mask[i+2]=mask[i+3]=0;}
  };
  const pointCache = new Map();
  TG.points = function (key,F,meta) {
    const col=C.DIR_COL[F.dir], id=key+'|'+F.frame+'|'+col;
    if(pointCache.has(id))return pointCache.get(id);
    const p=whiskAt(key,{row:F.frame,col});
    const points=p ? [.25,.65,1].map(q=>[
      p[0]+(p[2]-p[0])*q-meta.anchorX,
      p[1]+(p[3]-p[1])*q-meta.anchorY,
    ]) : [];
    pointCache.set(id,points);
    return points;
  };
  // the whisk as a line [x0, y0, x1, y1] (handle -> tip) relative to the feet, for the enhancement light / lightning
  TG.segment = function (key,F,meta) {
    const p=whiskAt(key,{row:F.frame,col:C.DIR_COL[F.dir]});
    return p ? [p[0]-meta.anchorX,p[1]-meta.anchorY,p[2]-meta.anchorX,p[3]-meta.anchorY] : null;
  };
  // Lv.110 orbital whisk: this exact geometry is also used by the inventory icon.
  TG.solarWhisk = function(g,L,r,faction) {
    const dark=faction==='adharma',metal=dark?'#e5b5ce':'#e4d4a0',silk=dark?'#ef9acb':'#9ef5d0',ink=dark?'#49223d':'#255b52';
    g.lineCap='round';g.lineJoin='round';
    g.strokeStyle=ink;g.lineWidth=5;g.beginPath();g.moveTo(0,-r*3.6);g.lineTo(0,4);g.stroke();
    g.strokeStyle=metal;g.lineWidth=2;g.stroke();
    for(const side of [-1,1]){
      g.beginPath();g.ellipse(side*r*.65,-r*.45,r*.95,r*1.6,side*.45,0,Math.PI*2);g.stroke();
      g.fillStyle=ink;g.beginPath();g.moveTo(side*r*.4,r);g.lineTo(side*r*1.4,r*1.6);g.lineTo(side*r*1.1,L*.63);g.lineTo(side*r*.45,L*.48);g.closePath();g.fill();g.stroke();
    }
    g.fillStyle=silk;g.beginPath();g.moveTo(0,-r*1.5);g.lineTo(r*.65,0);g.lineTo(0,r);g.lineTo(-r*.65,0);g.closePath();g.fill();g.stroke();
    for(let n=-4;n<=4;n++){
      g.strokeStyle=n%2?silk:metal;g.lineWidth=n%2?1.2:1.6;
      g.beginPath();g.moveTo(n*r*.15,r*.7);g.bezierCurveTo(n*r*.7,L*.3,n*r*.65,L*.7,n*r*.22+r*.8,L*.9-Math.abs(n));g.stroke();
    }
  };
  TG.decorate = function (src, key, tier) {
    if (!tier) return src;
    const I = ModelTiers.info(key);
    if (!I) return src;
    const faction = key.endsWith('adharma') ? 'adharma' : 'dharma', dark = faction === 'adharma';
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const [metal, silk] = tier>=11 && dark ? (tier===12?['#ddb28a','#df607d']:['#d7b8f3','#9d6cbd']) : materials[Math.min(12, tier)];
    I.frames.forEach(F => {
      const p = whiskAt(key,F);
      if (!p) return;
      const [x,y,tx,ty] = p, dx = tx-x, dy = ty-y, L = Math.hypot(dx,dy);
      const r = 2.4 + tier * .45;
      g.save(); g.beginPath(); g.rect(F.X,F.Y,I.fw,I.fh); g.clip(); g.translate(F.X+x,F.Y+y);
      g.rotate(Math.atan2(dy,dx)-Math.PI/2);
      if(tier===13){TG.solarWhisk(g,L,6.5,faction);g.restore();return;}
      g.lineJoin = 'round'; g.lineCap = 'round';
      // Contrasting woven filaments follow the existing curved brush.
      g.strokeStyle = dark ? (tier >= 7 ? '#e46f72' : '#b64f79') : silk;
      g.lineWidth = tier >= 5 ? 1.6 : 1;
      for (let n=-1; n<=1; n++) {
        g.beginPath(); g.moveTo(n*1.8,3);
        g.bezierCurveTo(-12+n*3,L*.3,-10+n*3,L*.7,n*2,L*.9); g.stroke();
      }
      if (tier >= 4) { // silk streamers: more substantial silhouettes at higher levels
        for (const side of [-1,1]) {
          g.beginPath(); g.moveTo(side*r,2);
          g.bezierCurveTo(side*(r+8),L*.18,side*(r+2),L*.48,side*(r+6),L*.65);
          g.lineTo(side*(r+2),L*.59);
          g.bezierCurveTo(side*r,L*.4,side*(r+4),L*.2,side*(r-2),2);
          g.closePath(); g.fillStyle = dark ? '#973652' : silk; g.fill();
          g.strokeStyle = metal; g.lineWidth = .8; g.stroke();
        }
      }
      if (tier >= 6) { // lotus (6), crystal (7), double crown (8+), phoenix rays (10)
        const petals = tier >= 10 ? 7 : tier >= 8 ? 5 : 3;
        for (let n=0;n<petals;n++) {
          g.save(); g.rotate((n-(petals-1)/2)*.42);
          g.beginPath(); g.moveTo(-r*.5,1);
          g.quadraticCurveTo(-r*1.15,-r,0,-r*(tier>=8?2.3:1.7));
          g.quadraticCurveTo(r*1.15,-r,r*.5,1);
          g.closePath(); g.fillStyle = dark ? '#66344c' : silk; g.fill();
          g.strokeStyle = metal; g.lineWidth = 1; g.stroke(); g.restore();
        }
      }
      if(tier>=11){
        g.strokeStyle=metal;g.lineWidth=1.2;
        g.beginPath();g.ellipse(0,-r*.6,r*1.5,r*1.8,0,0,Math.PI*2);g.stroke();
        if(tier===12)for(const side of [-1,1]){
          g.fillStyle=dark?'#40162b':'#fff5d6';g.strokeStyle=metal;
          g.beginPath();g.moveTo(side*r,5);g.lineTo(side*(r+7),10);g.lineTo(side*(r+6),L*.6);g.lineTo(side*(r+1),L*.54);g.closePath();g.fill();g.stroke();
          g.strokeStyle=dark?'#ff5973':'#b08745';
          for(let j=0;j<4;j++){const yy=14+j*L*.08;g.beginPath();g.moveTo(side*(r+2),yy);g.lineTo(side*(r+5),yy+2);g.stroke();}
        }
      }
      const grad = g.createLinearGradient(-r,0,r,0);
      grad.addColorStop(0,'#65462f'); grad.addColorStop(.4,metal); grad.addColorStop(.6,'#fff2c9'); grad.addColorStop(1,metal);
      g.fillStyle=grad; g.strokeStyle='#503e38'; g.lineWidth=1;
      g.beginPath(); g.roundRect(-r,-3,r*2,6+(tier>=3?2:0),2); g.fill(); g.stroke();
      if (tier >= 3) {
        g.fillStyle=dark?'#ef5478':silk;
        g.beginPath(); g.moveTo(0,-r); g.lineTo(r*.7,0); g.lineTo(0,r); g.lineTo(-r*.7,0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle='#fff6dc'; g.fillRect(-1,-r*.4,1.5,2);
      }
      if (tier === 2 || tier === 5 || tier === 9) {
        g.strokeStyle=metal; g.lineWidth=1.6;
        for(const side of [-1,1]) { g.beginPath(); g.arc(side*(r+2),3,r*.65,0,Math.PI*2); g.stroke(); }
      }
      g.restore();
    });
    return c;
  };
})();
