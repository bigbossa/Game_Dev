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
  A.icon = (id,faction) => {
    const c=document.createElement('canvas');c.width=c.height=112;const g=c.getContext('2d'),p=palette(faction);g.scale(1.75,1.75);
    const bg=g.createRadialGradient(32,28,3,32,32,45);bg.addColorStop(0,p.cloth);bg.addColorStop(1,'#0c101c');
    g.fillStyle=bg;g.fillRect(0,0,64,64);g.strokeStyle=p.edge;g.lineWidth=2;g.strokeRect(2,2,60,60);
    const i=C.CLASSES.arbiter.skills.findIndex(s=>s.id===id);
    if(i===2 || i===4 || i===6 || i===8){g.strokeStyle=p.glow;g.beginPath();g.arc(32,32,24,0,TAU);g.stroke();}
    if(i===5)poly(g,[[13,12],[51,12],[47,42],[32,55],[17,42]],p.plate,p.edge);
    const n=i===4?3:i===6?4:1;
    for(let j=0;j<n;j++)blade(g,32+(j-(n-1)/2)*12,i===8?16:43,i===8?Math.PI:i===3?.7:i===1?-.6:0,.56,p);
    if(i===2)for(let j=0;j<5;j++){const a=j*TAU/5-Math.PI/2;poly(g,[[0,-4],[3,0],[0,4],[-3,0]].map(([x,y])=>[32+Math.cos(a)*23+x,32+Math.sin(a)*23+y]),p.light,p.edge,1);}
    if(i===7){g.strokeStyle=p.glow;g.beginPath();g.arc(32,15,12,0,TAU);g.stroke();}
    return c;
  };
  A.weaponIcon = (g,it,faction,size) => {
    const p=palette(faction);g.save();g.scale(size/64,size/64);
    blade(g,23,47,.6,.68+Math.min(it.tier||0,10)*.014,p);g.restore();
  };
  A.play = d => {
    const key=d.id+':'+d.token;
    if(d.phase==='cancel' || d.phase==='release')FX.list=FX.list.filter(f=>f.arbiterToken!==key);
    if(d.phase==='cancel')return;
    const p=palette(d.f), spec=C.ALL_SKILLS[d.skill]?.arbiter;
    const warning=d.phase==='windup'&&spec?.kind==='verdict';
    const dur=d.dur||400;
    FX.list.push({t0:performance.now(),dur,layer:warning?'ground':'top',arbiterEffect:true,arbiterToken:warning?key:null,
      draw(g,progress){
        g.save();g.translate(d.x,d.y);g.strokeStyle=p.glow;g.fillStyle=p.cloth;g.lineWidth=3;
        g.globalAlpha=warning?.35+progress*.4:Math.max(0,1-progress);
        if(warning){
          // World-space radius matches the server; targets whose collision radius overlaps can be hit.
          g.beginPath();g.arc(0,0,d.radius,0,TAU);g.fill();g.stroke();
          g.strokeStyle=p.edge;g.beginPath();g.arc(0,0,d.radius-7,-Math.PI/2,-Math.PI/2+TAU*progress);g.stroke();
          g.fillStyle=p.light;g.font='bold 16px sans-serif';g.textAlign='center';g.fillText('มหาพิพากษา',0,-10);
        } else if(d.phase==='astral')blade(g,0,-20+progress*30,Math.PI*.2,.8,p);
        else if(d.phase==='form'||d.phase==='ward'){
          const e=window.G?.ents.get(d.id);if(e){g.translate(e.x-d.x,e.y-d.y);}
          g.beginPath();g.ellipse(0,-55,45,70,0,0,TAU);g.stroke();
        } else if(d.phase==='release'){
          if(spec?.kind==='line'||d.wave){g.rotate(d.a);g.fillStyle=p.glow;g.fillRect(d.radius*progress,-d.width,18,d.width*2);}
          else if(spec?.kind==='verdict'||spec?.kind==='circle'){
            g.beginPath();g.arc(0,0,d.radius*(.75+progress*.25),0,TAU);g.stroke();
            for(let i=0;i<8;i++)blade(g,Math.cos(i*TAU/8)*d.radius*.6,Math.sin(i*TAU/8)*d.radius*.6,Math.PI,1,p);
          }else{g.rotate(d.a);g.beginPath();g.arc(0,-25,75,-.9+progress,1.1+progress);g.stroke();}
        }
        g.restore();
      }});
  };
})();
