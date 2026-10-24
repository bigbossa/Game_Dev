// Original painted directional atlases with Canvas motion and level evolution layers.
(function () {
  const A = window.ArbiterLook = {}, TAU = Math.PI * 2;
  let model, images = {};
  A.load = async loadImg => {
    model = await fetch('assets/arbiter/model.json').then(r => { if(!r.ok)throw Error('Missing arbiter model');return r.json(); });
    await Promise.all(['dharma','adharma'].flatMap(f => ['walk','attack'].map(async pose => {
      images[f+'-'+pose] = await loadImg('assets/arbiter/'+f+'-'+pose+'.png');
      ModelTiers.analyse(ModelTiers.key(f,pose==='attack','arbiter'),images[f+'-'+pose],
        {frameWidth:model.frameWidth,frameHeight:model.frameHeight,framesPerDir:pose==='attack'?model.attackFrames:model.walkFrames});
    })));
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
  A.draw = function(g,e,F,x,y,scale,now) {
    const p=palette(e.faction), stage=Math.max(0,C.arbiterStage(e.lvl||1)), form=e.arbiterForm && !e.dead;
    e={...e,cls:'arbiter'};
    F={...F,dir:(F.dir??e.dir??2)&7,frame:Math.max(0,Math.min(F.atk?2:3,F.frame??1))};
    const t=now/1000, facing=F.dir*Math.PI/4;
    const side=Math.cos(facing), attack=!!e.atk || F.atk;
    const swing=attack?Math.sin(Math.min(1,(now-(e.atk?.t0??now))/(e.atk?.dur||400))*Math.PI):0;
    g.save();g.translate(x,y);g.scale(scale,scale);
    if(e.dead){g.globalAlpha=.35;g.rotate(-1.2);} else if(e.flash>0)g.filter=`brightness(${1+e.flash})`;
    // Reuse the game's feather/membrane wings and aura with this class's evolution milestones.
    const evolved={...e,lvl:form?130:stage>=3?100:stage>=2?60:30};
    const geometry=ModelTiers.info(ModelTiers.key(e.faction,F.atk,'arbiter'))?.frames[F.frame*8+C.DIR_COL[F.dir]];
    if(A.ready&&!e.dead){
      EquipmentAura.draw(g,e,F,model,0,0,1,t);
      if(form)ModelTiers.drawAura(g,evolved,F,0,0,t,1,model);
      if(stage>=2||form)Wings.draw(g,evolved,F,0,0,t,1,'back',model);
      if(stage>=1&&geometry){
        const hx=geometry.headC[0]-model.anchorX,hy=geometry.y0-model.anchorY-8;
        g.save();g.strokeStyle=p.edge;g.shadowColor=p.glow;g.shadowBlur=6;g.lineWidth=2;
        g.beginPath();g.ellipse(hx,hy,stage>=3?25:20,6,0,0,TAU);g.stroke();g.restore();
      }
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
      if((e.wt||0)>=3){g.strokeStyle=p.edge;g.lineWidth=1.2;g.beginPath();g.ellipse(0,2,26,8,0,0,TAU);g.stroke();}
    }
    if(A.ready&&!e.dead&&(stage>=2||form))Wings.draw(g,evolved,F,0,0,t,1,'front',model);
    const blades=e.astralBlades;
    if(blades && !e.dead)for(let i=0;i<(stage>=3?4:2);i++){
      const a=t*.8+i*TAU/(stage>=3?4:2);
      blade(g,Math.cos(a)*76,-30+Math.sin(a)*16,Math.cos(a)*.3,.5,p);
    }
    if(e.oathStacks)for(let i=0;i<e.oathStacks;i++){
      g.fillStyle=p.glow;g.beginPath();g.arc((i-2)*9,9,2.7,0,TAU);g.fill();
    }
    if(e.wp){g.strokeStyle=p.glow;g.lineWidth=1+e.wp/6;g.beginPath();g.ellipse(0,0,27,8,0,0,TAU);g.stroke();}
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
