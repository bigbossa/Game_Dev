// Original painted directional atlases with Canvas motion and level evolution layers.
(function () {
  const A = window.ArbiterLook = {}, TAU = Math.PI * 2;
  let model, images = {}, wings = {};
  A.load = async loadImg => {
    model = await fetch('assets/arbiter/model.json').then(r => { if(!r.ok)throw Error('Missing arbiter model');return r.json(); });
    await Promise.all(['dharma','adharma'].flatMap(f => ['walk','attack'].map(async pose => {
      images[f+'-'+pose] = await loadImg('assets/arbiter/'+f+'-'+pose+'.png');
      ModelTiers.analyse(ModelTiers.key(f,pose==='attack','arbiter'),images[f+'-'+pose],
        {frameWidth:model.frameWidth,frameHeight:model.frameHeight,framesPerDir:pose==='attack'?model.attackFrames:model.walkFrames});
    })));
    const response=await fetch('assets/arbiter/evolution-v3/wings.json');if(!response.ok)throw Error('Missing arbiter evolution wings');
    const meta=await response.json();
    await Promise.all(Object.entries(meta.wings).map(async([key,p])=>{wings[key]={...p,img:await loadImg('assets/arbiter/evolution-v3/'+p.file)};}));
    A.ready = true;
  };
  A.frame = (e,now=performance.now()) => {
    const a=e.atk,active=!!a&&now-a.t0<a.dur,progress=active?(now-a.t0)/a.dur:0;
    return {atk:active,dir:active?a.dir:e.dir,frame:active?(progress<.28?0:progress<.84?1:2):CharacterMotion.walkFrame(e,1)};
  };
  const palette = faction => faction === 'adharma'
    ? { plate: '#252039', light: '#645178', edge: '#ec647b', glow: '#bd79ff', cloth: '#380f2b', skin: '#d9acb1', hair: '#201c32' }
    : { plate: '#e6eff6', light: '#ffffff', edge: '#d8b765', glow: '#86dfff', cloth: '#28516e', skin: '#f2d3b6', hair: '#f1e5cd' };
  function poly(g, points, fill, stroke, width = 1.5) {
    g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.closePath();
    if (fill) { g.fillStyle=fill; g.fill(); } if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
  }
  function blade(g, x, y, angle, size, p) {
    g.save(); g.translate(x,y); g.rotate(angle); g.scale(size,size);
    poly(g,[[-4,0],[-5,-40],[0,-65],[5,-40],[4,0]],p.light,p.edge);
    poly(g,[[0,-60],[3,-39],[1,-3]],p.glow);
    poly(g,[[-12,0],[-9,-5],[0,-2],[9,-5],[12,0],[2,3],[2,16],[-2,16],[-2,3]],p.edge,p.cloth);
    g.restore();
  }
  function paintedWings(g,e,F,fr,stage,form,t,pass){
    if(!fr||stage<2&&!form)return;
    const f=e.faction==='adharma'?'adharma':'dharma',w=wings[f+'-'+(form||stage>=3?3:2)];if(!w)return;
    const width=form?350:stage>=3?310:225,k=width/w.width;
    const x=fr.neck[0]-model.anchorX,y=fr.neck[1]-model.anchorY+fr.BH*.09;
    const flap=Math.sin(t*(e.moving?4.2:1.7))*(e.moving?.065:.025);
    const wing=(side,sx,rotation,alpha)=>{
      const left=side<0,sx0=left?0:w.rootX,sw=left?w.rootX:w.width-w.rootX;
      g.save();g.translate(x,y);g.scale(sx,1);g.rotate(side*flap+rotation);g.globalAlpha*=alpha;
      g.imageSmoothingQuality='high';g.drawImage(w.img,sx0,0,sw,w.height,left?-w.rootX*k:0,-w.rootY*k,sw*k,w.height*k);g.restore();
    };
    if(fr.view==='side'){
      const side=fr.trail>0?1:-1;
      if(pass==='back')wing(side,.55,-side*.13,.72);else wing(side,.72,side*.07,1);
    }else if((pass==='back')===(fr.view==='front')){
      for(const side of [-1,1])wing(side,1-.42*Math.max(0,-side*fr.trail),0,1);
    }
  }
  function crest(g,p,x,y,stage,form,t){
    g.save();g.translate(x,y);const r=form?35:stage>=3?28:21;
    g.lineCap='round';g.lineWidth=1.5;
    // Open arcs and a small faceted centre leave the painted face unobscured.
    for(const side of [-1,1]){
      g.strokeStyle=p.edge;g.beginPath();g.moveTo(side*5,-4);g.bezierCurveTo(side*r*.5,-10,side*r,-7,side*r,-18);g.stroke();
      g.strokeStyle=p.glow;g.globalAlpha=.55;g.beginPath();g.moveTo(side*9,-1);g.quadraticCurveTo(side*r*.8,3,side*(r+4),-9);g.stroke();
    }
    g.globalAlpha=1;poly(g,[[0,-18],[4,-11],[0,-3],[-4,-11]],p.light,p.edge,1);
    if(stage>=3||form)for(let i=0;i<3;i++){const a=t*.24+i*TAU/3;g.fillStyle=p.glow;g.beginPath();g.arc(Math.cos(a)*(r+8),-10+Math.sin(a)*5,1.4,0,TAU);g.fill();}
    g.restore();
  }
  A.draw = function(g,e,F,x,y,scale,now) {
    const p=palette(e.faction), stage=Math.max(0,C.arbiterStage(e.lvl||1)), form=e.arbiterForm && !e.dead;
    e={...e,cls:'arbiter'};
    F={...F,dir:(F.dir??e.dir??2)&7,frame:Math.max(0,Math.min(F.atk?2:3,F.frame??1))};
    const t=now/1000, facing=F.dir*Math.PI/4;
    const side=Math.cos(facing), attack=!!e.atk || F.atk;
    const swing=attack?Math.sin(Math.min(1,(now-(e.atk?.t0??now))/(e.atk?.dur||400))*Math.PI):0;
    g.save();g.translate(x,y);g.scale(scale,scale);
    if(e.dead){g.globalAlpha=.35;g.rotate(-1.2);} else if(e.flash>0)g.filter=`brightness(${1+e.flash})`;
    const geometry=ModelTiers.info(ModelTiers.key(e.faction,F.atk,'arbiter'))?.frames[F.frame*8+C.DIR_COL[F.dir]];
    const orbit=pass=>{
      if(!e.astralBlades||e.dead)return;
      const n=stage>=3?4:2;
      for(let i=0;i<n;i++){const a=t*.65+i*TAU/n,depth=Math.sin(a);if((pass==='back')!==(depth<0))continue;
        g.save();g.globalAlpha*=depth<0?.5:.85;blade(g,Math.cos(a)*(stage>=3?91:76),-39+depth*20,Math.cos(a)*.18,.42,p);g.restore();}
    };
    if(A.ready&&!e.dead){
      EquipmentAura.draw(g,e,F,model,0,0,1,t);
      if(form){
        const q=g.createRadialGradient(0,-65,10,0,-65,120);q.addColorStop(0,p.glow+'20');q.addColorStop(1,p.glow+'00');g.fillStyle=q;g.fillRect(-120,-185,240,240);
      }
      paintedWings(g,e,F,geometry,stage,form,t,'back');orbit('back');
    }
    // Same 320x280 frames, eight-direction mapping and sole anchor as the existing warrior.
    if(A.ready){
      const pose=F.atk?'attack':'walk', faction=e.faction==='adharma'?'adharma':'dharma';
      const row=Math.max(0,Math.min(F.atk?2:3,F.frame??1)),col=C.DIR_COL[(F.dir??e.dir??2)&7];
      const {frameWidth:fw,frameHeight:fh,anchorX:ax,anchorY:ay}=model;
      const image=images[faction+'-'+pose];
      g.save();
      g.translate(attack?side*swing*5:0,0);
      g.rotate(attack?side*swing*.035:0);
      g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
      g.drawImage(image,col*fw,row*fh,fw,fh,-ax,-ay,fw,fh);
      g.restore();
      // Equipment is an overlay; no additional physical sword is drawn over the painted weapon.
    }
    if(A.ready&&!e.dead){
      paintedWings(g,e,F,geometry,stage,form,t,'front');orbit('front');
      if((stage>=1||form)&&geometry)crest(g,p,geometry.headC[0]-model.anchorX,geometry.y0-model.anchorY-6,stage,form,t);
    }
    if(e.oathStacks&&!e.dead)for(let i=0;i<Math.min(5,e.oathStacks);i++){
      g.fillStyle=p.glow;g.beginPath();g.arc((i-2)*9,9,2.7,0,TAU);g.fill();
    }
    g.restore();
  };
  const portraits={};
  A.portrait = faction => {
    if(!portraits[faction]){
      const c=document.createElement('canvas');c.width=280;c.height=320;const g=c.getContext('2d'),p=palette(faction);
      const grad=g.createRadialGradient(140,140,5,140,140,210);grad.addColorStop(0,p.cloth);grad.addColorStop(1,'#0c101c');g.fillStyle=grad;g.fillRect(0,0,280,320);
      A.draw(g,{faction,lvl:1},{dir:2,frame:1},155,300,1.1,0);
      portraits[faction]=c.toDataURL();
    }return portraits[faction];
  };
  A.weaponIcon = (g,it,faction,size) => {
    const p=palette(faction);g.save();g.scale(size/64,size/64);
    blade(g,23,47,.6,.68+Math.min(it.tier||0,10)*.014,p);g.restore();
  };
})();
