// Painted sword-and-shield atlas matching the existing wuxia chibi characters.
(function () {
  const W = window.WarriorLook = {};
  const poly = (g, pts, fill, edge = '#142331', width = 2) => {
    g.beginPath(); pts.forEach(([x,y], i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.closePath();
    g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = width; g.stroke();
  };
  W.palette = faction => faction === 'adharma'
    ? { steel:'#66536c', light:'#b5a1b5', cloth:'#861f39', gold:'#d5a16d', deep:'#292233', skin:'#dab298', glow:'#ff7286' }
    : { steel:'#43677f', light:'#b9d6e2', cloth:'#204c7d', gold:'#e7c179', deep:'#1c3348', skin:'#e7bea1', glow:'#8bdcff' };
  W.shield = (g, x, y, scale, p, tier = 0) => {
    g.save(); g.translate(x,y); g.scale(scale,scale);
    poly(g,[[-25,-35],[0,-43],[25,-35],[23,10],[0,37],[-23,10]],p.gold);
    poly(g,[[-20,-31],[0,-37],[20,-31],[18,8],[0,29],[-18,8]],p.cloth,p.light,1.5);
    poly(g,[[-3,-29],[3,-29],[3,-8],[15,-8],[15,-2],[3,-2],[3,20],[-3,20],[-3,-2],[-15,-2],[-15,-8],[-3,-8]],p.gold,p.gold,1);
    poly(g,[[0,-15],[8,-6],[0,4],[-8,-6]],tier >= 5 ? p.glow : p.light,p.deep,1);
    for (const side of [-1,1]) for (const yy of [-25,-10,5]) { g.fillStyle=p.gold; g.beginPath(); g.arc(side*17,yy,1.6,0,Math.PI*2); g.fill(); }
    g.restore();
  };
  const images = {}; let model;
  W.ready = false;
  W.load = async loadImg => {
    const r=await fetch('assets/warrior-v1/model.json');if(!r.ok)throw Error('Warrior atlas metadata missing');model=await r.json();
    await Promise.all(['dharma','adharma'].flatMap(f=>['walk','attack'].map(async pose=>{images[f+'-'+pose]=await loadImg('assets/warrior-v1/'+f+'-'+pose+'.png');})));
    await Promise.all(['dharma','adharma'].map(async f=>{await loadImg('assets/warrior-v1/'+f+'-portrait.png');}));
    W.ready=true;
  };
  W.frame = (e,now=performance.now()) => {
    const a=e.atk,active=!!a&&now-a.t0<a.dur,progress=active?(now-a.t0)/a.dur:0;
    return {atk:active,dir:active?a.dir:e.dir,frame:active?(progress<.28?0:progress<.84?1:2):CharacterMotion.walkFrame(e,1)};
  };
  W.draw = (g,e,F,x,y,scale=.46,now=performance.now()) => {
    if(!W.ready)return;
    const faction=e.faction==='adharma'?'adharma':'dharma',pose=F.atk?'attack':'walk';
    const col=C.DIR_COL[F.dir&7],row=Math.max(0,Math.min(F.atk?2:3,F.frame||0));
    const {frameWidth:fw,frameHeight:fh,anchorX:ax,anchorY:ay}=model;
    g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    if((e.wp||0)>0){g.shadowColor=W.palette(faction).glow;g.shadowBlur=Math.min(10,e.wp);}
    g.drawImage(images[faction+'-'+pose],col*fw,row*fh,fw,fh,x-ax*scale,y-ay*scale,fw*scale,fh*scale);
    g.restore();
  };
  W.portrait = faction => 'assets/warrior-v1/'+(faction==='adharma'?'adharma':'dharma')+'-portrait.png';
  W.icon = (g,sk,faction) => WarriorIcons.draw(g,sk,faction,112);
  W.play = d => {
    const p=W.palette(d.f), sk=C.ALL_SKILLS[d.t], t0=performance.now(), dur=d.dur||500;
    FX.list.push({t0,dur,layer:'top',draw(g,q){
      const e=window.G?.ents.get(d.id),x=e?.x??d.x,y=e?.y??d.y;
      g.save();g.globalAlpha=(1-q)*.7;g.strokeStyle=p.glow;g.lineWidth=4;
      if(sk.frontline.ward) W.shield(g,x,y-52,1+q*.4,p,5);
      else {g.beginPath();g.ellipse(x,y-12,20+(d.radius||100)*q,10+(d.radius||100)*q*.45,0,sk.frontline.taunt?0:(d.a||0)-1,sk.frontline.taunt?Math.PI*2:(d.a||0)+1);g.stroke();}
      g.restore();
    }});
  };
})();
