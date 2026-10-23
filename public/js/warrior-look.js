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
  // V4: open-faced wuxia topknot, independent equipment slots and shared level thresholds.
  const images={},masks={};let model;
  const VIEW=['front','fq','side','bq','back','bq','side','fq'],FACE=[0,1,1,1,0,-1,-1,-1];
  const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  W.tierOf=e=>ModelTiers.tierOf(e.lvl||1);
  W.hairColor=(f,t)=>WarriorGear.hairColor(f,t);
  W.body=(e,F)=>WarriorGear.frame(e,F);
  W.ready = false;
  W.load = async loadImg => {
    const r=await fetch('assets/warrior-v4/model.json?v=wuxia-1');if(!r.ok)throw Error('Warrior atlas metadata missing');model=await r.json();
    await Promise.all(['dharma','adharma'].flatMap(f=>['walk','attack'].map(async pose=>{
      images[f+'-'+pose]=await loadImg('assets/warrior-v4/'+f+'-'+pose+'.png?v=wuxia-1');
      masks[f+'-'+pose]=await loadImg('assets/warrior-v4/'+f+'-'+pose+'-gear.png?v=wuxia-1');
      // frame geometry for the shared level looks (wings, halo, horns, Lv.130 aura)
      ModelTiers.analyse(ModelTiers.key(f,pose==='attack','warrior'),images[f+'-'+pose],
        {frameWidth:model.frameWidth,frameHeight:model.frameHeight,framesPerDir:pose==='attack'?model.attackFrames:model.walkFrames});
    })));
    await Promise.all(['dharma','adharma'].map(async f=>{await loadImg('assets/warrior-v4/'+f+'-portrait.png');}));
    WarriorGear.init(model,images,masks);
    W.ready=true;
    // Front idle portraits use the exact same painted model as the world renderer.
    for(const f of ['dharma','adharma']){
      const c=document.createElement('canvas');c.width=190;c.height=230;
      W.draw(c.getContext('2d'),{cls:'warrior',faction:f,lvl:1,ar:[0,0,0,0],wt:0,wp:0},{atk:false,dir:2,frame:1},95,222,.78,0);
      portraits[f]=c.toDataURL('image/png');
    }
  };

  // Authored hair bounds keep the extra level locks at the nape, away from the eyes.
  function headOf(faction,pose,row,col){
    const h=model.landmarks[faction][pose][row*8+col]?.head;if(!h)return null;
    return {...h,cx:(h.x0+h.x1)/2,hw:(h.x1-h.x0)/2,view:VIEW[col],face:FACE[col]};
  }
  const shadeRgb = (col,k,add=0) => 'rgb('+hex(col).map(v=>Math.min(255,v*k+add)|0).join(',')+')';

  // Long tied hair (Lv.30+) follows the same nape and silhouette as the spear class.
  // Front/side locks go behind the character; rear locks lie over the back of the robe.
  function drawTail(g,H,col,pass,tier){
    const {cx,hw,bottom,view,face}=H,front=view==='front'||view==='fq'||view==='side';
    if(front!==(pass==='back'))return;
    const roots=view==='front'?[[cx-hw*.72,-1],[cx+hw*.72,1]]:view==='back'?[[cx,0]]:[[cx-face*hw*(view==='side'?.66:.52),-face]];
    const lit=shadeRgb(col,1.25,35),dark=shadeRgb(col,.5),edge='#141b24';
    for(const [rx,side] of roots){
      const y0=bottom-hw*.42,L=hw*(view==='front'?1.35:1.8)*(tier<4?.68:tier<6?.88:1.05),w=hw*(view==='front'?.16:.23),sw=side*(view==='back'?0:6);
      const lock=(ox,len,ww,bend)=>{
        const x=rx+ox,tip=[x+sw*2.4+bend,y0+len];
        const gr=g.createLinearGradient(0,y0,0,y0+len);gr.addColorStop(0,lit);gr.addColorStop(.4,col);gr.addColorStop(1,dark);
        g.beginPath();g.moveTo(x-ww,y0);
        g.bezierCurveTo(x-ww*1.15+sw,y0+len*.4,x-ww*.55+sw*2+bend,y0+len*.78,tip[0],tip[1]);
        g.bezierCurveTo(x+ww*.4+sw*2+bend,y0+len*.75,x+ww*1.1+sw,y0+len*.4,x+ww,y0);
        g.closePath();g.fillStyle=gr;g.fill();g.strokeStyle=edge;g.lineWidth=1.3;g.stroke();
        g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1;
        g.beginPath();g.moveTo(x-ww*.2,y0+6);g.quadraticCurveTo(x-ww*.3+sw*1.4,y0+len*.5,x+sw*2+bend*.8,y0+len*.88);g.stroke();
      };
      lock(-w*.42,L*.9,w*.55,-4);lock(w*.42,L*.86,w*.55,4);lock(0,L,w*.62,0);
      if(view!=='front'){                                  // gold hair tie at the root
        g.fillStyle='#e7c179';g.strokeStyle='#3a2a10';g.lineWidth=1.2;
        g.beginPath();g.ellipse(rx+sw*.2,y0+8,w*.78,4,0,0,Math.PI*2);g.fill();g.stroke();
        g.strokeStyle='#fff3c8';g.lineWidth=1;g.beginPath();g.ellipse(rx+sw*.2,y0+7,w*.5,1.6,0,Math.PI,Math.PI*2);g.stroke();
      }
    }
  }

  W.frame = (e,now=performance.now()) => {
    const a=e.atk,active=!!a&&now-a.t0<a.dur,progress=active?(now-a.t0)/a.dur:0;
    return {atk:active,dir:active?a.dir:e.dir,frame:active?(progress<.28?0:progress<.84?1:2):CharacterMotion.walkFrame(e,1)};
  };
  W.draw = (g,e,F,x,y,scale=.46,now=performance.now(),opts={}) => {
    if(!W.ready)return;
    e={...e,cls:'warrior',faction:e.faction==='adharma'?'adharma':'dharma'};
    F={...F,dir:F.dir&7,frame:Math.max(0,Math.min(F.atk?2:3,F.frame||0))};
    const faction=e.faction,pose=F.atk?'attack':'walk',col=C.DIR_COL[F.dir],row=F.frame;
    const {frameWidth:fw,frameHeight:fh,anchorX:ax,anchorY:ay}=model;
    const tier=W.tierOf(e),t=now/1000,H=headOf(faction,pose,row,col),hair=W.hairColor(faction,tier),body=WarriorGear.frame(e,F);
    const inFrame=fn=>{g.save();g.translate(x-ax*scale,y-ay*scale);g.scale(scale,scale);fn();g.restore();};
    const effects=!e.dead&&!opts.noGlow,ground={...e,x,y};
    if(effects){
      WeaponLook.plusRings(g,ground,t,opts.auraBounds?.width/2||Infinity,opts.auraBounds?12:Infinity);
      ClassAura.ground(g,ground,t,scale/.46);
      ClassAura.back(g,e,x,y,t,(ay-model.landmarks[faction][pose][row*8+col].headTop)*scale);
      EquipmentAura.draw(g,e,F,model,x,y,scale,t,opts.auraBounds);
      ModelTiers.drawAura(g,e,F,x,y,t,scale,model);
      Wings.draw(g,e,F,x,y,t,scale,'back',model);
      if(tier>=6)ModelTiers.drawHorns(g,e,F,x,y,scale,model,'back');
      const rim=WarriorGear.rim(body,e);
      if(rim){g.save();g.globalAlpha*=rim.alpha;g.drawImage(rim.img,x-(ax+rim.pad)*scale,y-(ay+rim.pad)*scale,rim.img.width*scale,rim.img.height*scale);g.restore();}
    }
    if(H&&tier>=2)inFrame(()=>drawTail(g,H,hair,'back',tier));
    g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(body,x-ax*scale,y-ay*scale,fw*scale,fh*scale);g.restore();
    if(H&&tier>=2)inFrame(()=>drawTail(g,H,hair,'front',tier));
    if(effects){
      const plus=WeaponLook.plusLook(e.wp),line=WarriorGear.weaponLine(e,F);
      if(plus&&line.length){
        const [a,b]=line;g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=plus.a*.24;
        g.strokeStyle=WeaponLook.plusColor(e.wp,t);g.shadowColor=g.strokeStyle;g.shadowBlur=plus.blur*scale*2;g.lineWidth=1.5*scale;
        g.beginPath();g.moveTo(x+(a[0]+(b[0]-a[0])*.18)*scale,y+(a[1]+(b[1]-a[1])*.18)*scale);g.lineTo(x+b[0]*scale,y+b[1]*scale);g.stroke();g.restore();
      }
      WeaponLook.drawOwnPlus(g,e,F,x,y,scale,{time:t});
      EquipmentGlints.draw(g,e,F,model,x,y,scale,t);
      Wings.draw(g,e,F,x,y,t,scale,'front',model);
      if(tier>=6){ModelTiers.drawHorns(g,e,F,x,y,scale,model,'front');ModelTiers.drawHalo(g,e,F,x,y,t,scale,model);}
    }
  };
  const portraits = {};
  W.portrait = faction => { const f=faction==='adharma'?'adharma':'dharma'; return portraits[f]||'assets/warrior-v4/'+f+'-portrait.png'; };
  W.icon = (g,sk,faction) => WarriorIcons.draw(g,sk,faction,112);
  W.play = d => {
    const p=W.palette(d.f),sk=C.ALL_SKILLS[d.t],front=sk.frontline,t0=performance.now(),wind=front.windup||0;
    const A=SkillPerformance.profile(sk,d),high=sk.lvl>=120,slam=sk.id==='earthShatter',ward=!!front.ward;
    const caster=G.ents.get(d.id),motion=caster?.skillMotion,map=G.mapId,dur=Math.max(d.dur||500,wind+(high?850:500));
    const stroke=(g,pts,col,w)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=col;g.lineWidth=w;g.stroke();};
    for(const layer of ['ground','top']){
      if(FX.list.filter(n=>n.warriorArt).length>=64){const i=FX.list.findIndex(n=>n.warriorArt);FX.list.splice(i,1);}
      FX.list.push({warriorArt:true,owner:d.id,t0,dur,layer,draw(g,q){
        const e=G.ents.get(d.id);if(!e||e.dead||e.dying||map!==G.mapId||(motion&&e.skillMotion!==motion))return;
        const x=e.x,y=e.y,t=q*dur,charge=Math.min(1,t/Math.max(1,wind)),hit=Math.max(0,Math.min(1,(t-wind)/Math.max(1,dur-wind)));
        const R=Math.min(d.radius||100,high?210:175),alpha=Math.min(1,q*12,(1-q)*5),N=4+A.grade*2;
        g.save();g.globalAlpha*=alpha;g.lineCap='round';g.lineJoin='round';
        if(layer==='ground'){
          g.translate(x,y);g.scale(1,.55);
          if(t>=wind){
            const rr=R*Math.min(1,hit*3);g.globalAlpha*=1-hit;g.strokeStyle=p.gold;g.lineWidth=high?3:2;
            g.beginPath();g.arc(0,0,Math.max(1,rr),0,Math.PI*2);g.stroke();
            if(slam||front.taunt)for(let i=0;i<N;i++){
              const a=i*Math.PI*2/N,rr2=rr*(.72+(i%3)*.12);
              stroke(g,[[0,0],[Math.cos(a+.1)*rr2*.4,Math.sin(a+.1)*rr2*.4],[Math.cos(a-.08)*rr2*.7,Math.sin(a-.08)*rr2*.7],[Math.cos(a)*rr2,Math.sin(a)*rr2]],i%2?p.glow:p.gold,high?3:1.5);
            }
          }
          if(ward){
            g.strokeStyle=p.glow;g.lineWidth=2;
            g.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI/3,xx=Math.cos(a)*(55+A.grade*10),yy=Math.sin(a)*(55+A.grade*10);i?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.stroke();
          }
        }else if(ward){
          // Guardian Oath: a rising bastion of five shields and linked golden gates.
          const count=high?5:A.grade>=2?3:1,R2=high?95:55;
          for(let i=0;i<count;i++){
            const a=(i-(count-1)/2)*.65,xx=x+Math.sin(a)*R2,yy=y-30-Math.cos(a)*25-Math.sin(q*Math.PI)*(high?25:10);
            g.save();g.globalAlpha*=.7;W.shield(g,xx,yy,high?.62:.45,p,5);g.restore();
            if(high){stroke(g,[[xx-14,y],[xx-14,yy-34],[xx,yy-48],[xx+14,yy-34],[xx+14,y]],p.gold,1.5);stroke(g,[[xx,yy-53],[xx,yy-67]],p.glow,2);}
          }
        }else if(slam){
          // Sword rises with the caster, plunges at the authoritative impact time.
          const xx=x+Math.cos(d.a||0)*65,yy=y+Math.sin(d.a||0)*38;
          const L=high?185:95,drop=t<wind?(1-charge)*45:-Math.min(1,hit*5)*25;
          g.save();g.translate(xx,yy-35-drop);g.globalAlpha*=1-hit;
          const blade=g.createLinearGradient(-13,0,13,0);blade.addColorStop(0,p.steel);blade.addColorStop(.45,p.glow);blade.addColorStop(.5,'#ffffff');blade.addColorStop(1,p.steel);
          poly(g,[[0,27],[-13,0],[-9,-L],[0,-L-20],[9,-L],[13,0]],blade,p.gold,1.5);
          stroke(g,[[-30,-L+14],[30,-L+14]],p.gold,4);stroke(g,[[0,-L-20],[0,-L-43]],p.gold,6);
          if(high)for(const side of [-1,1])stroke(g,[[side*20,-15],[side*36,-55],[side*28,-110],[side*40,-150]],p.glow,2);
          g.restore();
          if(t>=wind)for(let i=0;i<N;i++){
            const a=i*Math.PI*2/N,rr=R*hit,xx2=xx+Math.cos(a)*rr,yy2=yy+Math.sin(a)*rr*.45-Math.sin(hit*Math.PI)*40;
            g.globalAlpha=alpha*(1-hit);poly(g,[[xx2,yy2-7],[xx2+4,yy2],[xx2,yy2+6],[xx2-4,yy2]],i%2?p.gold:p.glow);
          }
        }else if(front.taunt){
          g.save();g.globalAlpha*=1-q;W.shield(g,x,y-68,1.0+q*.25,p,5);g.restore();
          for(let i=0;i<N;i++){const a=i*Math.PI*2/N;stroke(g,[[x+Math.cos(a)*45,y-35+Math.sin(a)*25],[x+Math.cos(a)*(60+q*50),y-35+Math.sin(a)*(35+q*25)]],p.gold,2);}
        }else{
          const phase=t<wind?charge*.3:.3+hit*.7,a=(d.a||0)-1.3+phase*2.6;
          g.save();g.translate(x,y-30);g.scale(1,.7);g.strokeStyle=p.glow;g.lineWidth=3+A.grade;
          g.beginPath();g.arc(0,0,45+A.grade*8,a-.8,a+.1);g.stroke();g.strokeStyle=p.gold;g.lineWidth=1.5;
          g.beginPath();g.arc(0,0,55+A.grade*8,a-.6,a+.12);g.stroke();g.restore();
          if(sk.id==='shieldBash')W.shield(g,x+Math.cos(d.a||0)*charge*30,y-35+Math.sin(d.a||0)*charge*20,.6,p,5);
        }
        g.restore();
      }});
    }
  };
})();
