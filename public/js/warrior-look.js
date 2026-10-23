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
  // ---------------------------------------------------------------- V2: knight helmet, hair length / colour by level
  // tier (ModelTiers.LEVELS), cloth + shield field in the worn armour set's colour, the blade's steel in the weapon tier's
  // colour (WarriorWeapons.design). The V1 paint is kept; tools/build-warrior-v2.cjs supplies paint masks
  // (R hair, G 255 cloth / 128 blade, B topknot under the helmet) and head boxes.
  const images = {}, masks = {}; let model;
  // hair colour per level tier (null = as painted): Lv.15 brighter, Lv.50+ silver-white / blood crimson, Lv.130 gold / hellfire
  const HAIR = {
    dharma:  [null,'#2a8a8c','#2a8a8c','#d8e6f0','#e8f4ff','#bfe6ff','#f4fbff','#ffe7a8'],
    adharma: [null,'#5a1f3a','#5a1f3a','#b0202c','#c01a24','#8a0f1c','#e02030','#ff4a3a'],
  };
  const PAINTED_HAIR = { dharma:'#24445c', adharma:'#3a1c3e' };
  const HELM = {
    dharma:  { steel:'#d4dde6', dark:'#7d8fa3', edge:'#1d2a38', plume:['#ffffff','#c9dcf0'], plume7:['#fff6d0','#e8c060'] },
    adharma: { steel:'#4a4250', dark:'#211b26', edge:'#0c080e', plume:['#e02236','#6a0a16'], plume7:['#ff8a3a','#b0101c'] },
  };
  const VIEW = ['front','fq','side','bq','back','bq','side','fq'];
  const FACE = [0,1,1,1,0,-1,-1,-1];                  // which way the face points in each atlas column (+1 = right)
  const hex = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const clamp = v => Math.max(0,Math.min(1,v));
  function rgb2hsl(r,g,b){
    r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;if(mx===mn)return [0,0,l];
    const d=mx-mn,s=l>.5?d/(2-mx-mn):d/(mx+mn),h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;
    return [h*60,s,l];
  }
  function hsl2rgb(h,s,l){
    h=((h%360)+360)%360/360;if(!s)return [l*255,l*255,l*255];
    const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=t=>{if(t<0)t+=1;if(t>1)t-=1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
    return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255];
  }
  W.tierOf = e => ModelTiers.tierOf(e.lvl||1);
  // armour colour: the body piece's set, else the highest worn piece
  W.armorOf = e => { const ar=e.ar||[],t=ar[0]||Math.max(0,...ar); return t&&C.ARMOR_SETS[t-1]?t:0; };
  W.hairColor = (faction,tier) => HAIR[faction][tier]||PAINTED_HAIR[faction];

  // recoloured atlas per (faction, pose, hair tier, armour set, weapon tier); a few kept, the oldest dropped
  const variants = new Map();
  function variant(faction,pose,tier,armor,wt){
    const key=faction+pose+tier+'-'+armor+'-'+wt;let v=variants.get(key);if(v)return v;
    const img=images[faction+'-'+pose],m=masks[faction+'-'+pose];
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
    if(m){
      const mc=document.createElement('canvas');mc.width=m.width;mc.height=m.height;
      const mg=mc.getContext('2d',{willReadFrequently:true});mg.drawImage(m,0,0);
      const M=mg.getImageData(0,0,m.width,m.height).data,id=g.getImageData(0,0,c.width,c.height),D=id.data;
      const hc=HAIR[faction][tier]&&rgb2hsl(...hex(HAIR[faction][tier]));
      const set=armor&&C.ARMOR_SETS[armor-1],ac=set&&rgb2hsl(...hex(set.look[faction].color));
      const wc=wt>0&&window.WarriorWeapons&&rgb2hsl(...hex(WarriorWeapons.design(wt,faction).main));
      for(let i=0;i<D.length;i+=4){
        if(!M[i+3]||!D[i+3])continue;
        if(M[i+2]){D[i+3]=0;continue;}                    // topknot: the helmet bowl covers it
        const blade=!M[i]&&M[i+1]>60&&M[i+1]<200,tgt=M[i]?hc:blade?wc:M[i+1]?ac:null;if(!tgt)continue;
        const l=rgb2hsl(D[i],D[i+1],D[i+2])[2];
        // blade: keep its bright steel, tinted with the weapon tier's hue (stronger from tier 6)
        if(blade){const [r,gg,b]=hsl2rgb(tgt[0],Math.min(.75,tgt[1]*(wt>=6?.8:.55)),clamp(l*.96));D[i]=r;D[i+1]=gg;D[i+2]=b;continue;}
        // keep the painted shading: lightness offset from the paint's mid tone, hue / saturation of the target
        const L=M[i]?clamp(tgt[2]+(l-.27)*1.15):clamp(tgt[2]*.78+(l-.3)*1.05);
        const [r,gg,b]=hsl2rgb(tgt[0],Math.min(1,tgt[1]*.92),L);D[i]=r;D[i+1]=gg;D[i+2]=b;
      }
      g.putImageData(id,0,0);
    }
    variants.set(key,c);if(variants.size>16)variants.delete(variants.keys().next().value);
    return c;
  }

  W.ready = false;
  W.load = async loadImg => {
    const r=await fetch('assets/warrior-v2/model.json');if(!r.ok)throw Error('Warrior atlas metadata missing');model=await r.json();
    await Promise.all(['dharma','adharma'].flatMap(f=>['walk','attack'].map(async pose=>{
      images[f+'-'+pose]=await loadImg('assets/warrior-v1/'+f+'-'+pose+'.png');
      masks[f+'-'+pose]=await loadImg('assets/warrior-v2/'+f+'-'+pose+'-mask.png').catch(()=>null);
      // frame geometry for the shared level looks (wings, halo, horns, Lv.130 aura)
      ModelTiers.analyse(ModelTiers.key(f,pose==='attack','warrior'),images[f+'-'+pose],
        {frameWidth:model.frameWidth,frameHeight:model.frameHeight,framesPerDir:pose==='attack'?model.attackFrames:model.walkFrames});
    })));
    await Promise.all(['dharma','adharma'].map(async f=>{await loadImg('assets/warrior-v1/'+f+'-portrait.png');}));
    W.ready=true;
    // helmeted Lv.1 portraits (front idle frame drawn with the V2 look), the V1 paintings until then
    for(const f of ['dharma','adharma'])try{
      const c=document.createElement('canvas');c.width=190;c.height=230;
      W.draw(c.getContext('2d'),{cls:'warrior',faction:f,lvl:1,ar:[0,0,0,0],wt:0,wp:0},{atk:false,dir:2,frame:1},95,222,.78,0);
      portraits[f]=c.toDataURL('image/png');
    }catch(err){}
  };

  // head box of a frame (frame px): x0..x1 hair width, dome = bowl top, brim (kept above the eyes), bottom of the hair
  function headOf(faction,pose,row,col){
    const h=model.landmarks[faction][pose][row*8+col]?.head;if(!h)return null;
    const view=VIEW[col],back=view==='back'||view==='bq',hw=(h.x1-h.x0)/2;
    // brim from the head's size; the face top only lowers it (a raised hand can read as skin at the hair line)
    let brim=h.dome+hw*.62;if(!back&&h.face!=null&&h.face>h.dome+hw*.45)brim=Math.min(brim,h.face-3);
    return {...h,cx:(h.x0+h.x1)/2,hw,brim:Math.round(brim),top:Math.round(Math.min(h.dome-8,brim-hw*.9)),view,face:FACE[col]};
  }
  const path = (g,pts) => { g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); };
  const shadeRgb = (col,k,add=0) => 'rgb('+hex(col).map(v=>Math.min(255,v*k+add)|0).join(',')+')';

  // long hair (Lv.30+): a thick tied tail (three locks) from under the back of the helmet. pass 'back' = behind the body
  function drawTail(g,H,col,pass){
    const {cx,hw,brim,bottom,view,face}=H,front=view==='front'||view==='fq';
    if(front!==(pass==='back'))return;
    const roots=view==='front'?[[cx-hw*.8,-1],[cx+hw*.8,1]]:view==='back'?[[cx,0]]:[[cx-face*hw*(view==='side'?.6:.42),-face]];
    const lit=shadeRgb(col,1.25,35),dark=shadeRgb(col,.5),edge='#141b24';
    for(const [rx,side] of roots){
      const y0=brim+(view==='front'?8:3),L=((bottom-brim)+72)*(view==='front'?.78:1),w=hw*(view==='front'?.3:.42),sw=side*(view==='back'?0:9);
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

  // knight helmet (doumou): rounded bowl with plate seams and a gold finial, gold brim band with an armour-set inlay,
  // cheek guards, a layered neck guard; Lv.50+ a horsehair plume from the finial (longer each tier)
  function drawHelmet(g,H,faction,tier,armor,t){
    const P=HELM[faction],{cx,hw,top,brim,bottom,view,face}=H,back=view==='back'||view==='bq',side=view==='side';
    const bx=cx+face*hw*(side?.1:view==='front'||view==='back'?0:.05),R=hw,Hh=brim-top;
    const set=armor&&C.ARMOR_SETS[armor-1],inlay=set?set.look[faction].color:P.dark,gold='#e7c179',dip=back?-5:6;
    const brimAt=u=>brim+2-(1-u*u)*dip;                   // brim curve, u = -1 .. 1 across the head
    // neck guard: three curved lames under the back of the bowl
    const neck=(x0,x1)=>{
      for(let k=2;k>=0;k--){
        const y=brim-1+k*7,m=(x0+x1)/2,ww=(x1-x0)/2+k*2.5;
        g.beginPath();g.moveTo(m-ww,y);g.quadraticCurveTo(m,y+6,m+ww,y);g.lineTo(m+ww+1.5,y+10);g.quadraticCurveTo(m,y+17,m-ww-1.5,y+10);g.closePath();
        const lg=g.createLinearGradient(0,y,0,y+14);lg.addColorStop(0,P.steel);lg.addColorStop(1,P.dark);
        g.fillStyle=lg;g.fill();g.strokeStyle=P.edge;g.lineWidth=1.4;g.stroke();
        g.strokeStyle=inlay;g.lineWidth=1.3;g.beginPath();g.moveTo(m-ww+2,y+8);g.quadraticCurveTo(m,y+14,m+ww-2,y+8);g.stroke();
      }
    };
    if(back)neck(bx-R*.92,bx+R*.92);
    else if(side)neck(face>0?bx-R*1.02:bx+R*.05,face>0?bx-R*.05:bx+R*1.02);
    else if(view==='fq')neck(face>0?bx-R*.98:bx+R*.4,face>0?bx-R*.4:bx+R*.98);
    // bowl
    g.beginPath();g.moveTo(bx-R,brimAt(-1));
    g.bezierCurveTo(bx-R*1.03,brim-Hh*.82,bx-R*.6,top,bx,top);
    g.bezierCurveTo(bx+R*.6,top,bx+R*1.03,brim-Hh*.82,bx+R,brimAt(1));
    for(let u=1;u>=-1;u-=.25)g.lineTo(bx+u*R,brimAt(u));
    g.closePath();
    const hx=bx-R*.35+face*R*.25,gr=g.createRadialGradient(hx,top+Hh*.3,1,hx,top+Hh*.35,R*1.55);
    gr.addColorStop(0,'#ffffff');gr.addColorStop(.3,P.steel);gr.addColorStop(.8,P.dark);gr.addColorStop(1,P.edge);
    g.fillStyle=gr;g.fill();g.strokeStyle=P.edge;g.lineWidth=2;g.stroke();
    // plate seams with rivets (shifted toward the face on turned views)
    const turn=side?.45:view==='front'||view==='back'?0:.22;
    g.save();g.clip();
    for(const s of [-.5,0,.5]){
      const u=Math.max(-.95,Math.min(.95,s+face*turn)),x=bx+u*R;
      g.strokeStyle=s?'rgba(20,30,45,.45)':'rgba(255,255,255,.65)';g.lineWidth=s?1.2:2.2;
      g.beginPath();g.moveTo(bx+u*R*.3,top+3);g.quadraticCurveTo(x,top+Hh*.35,x,brim-6);g.stroke();
      if(s){g.fillStyle=gold;for(const k of [.45,.72]){g.beginPath();g.arc(bx+u*R*(.3+k*.7),top+Hh*k,1.4,0,Math.PI*2);g.fill();}}
    }
    g.restore();
    // gold brim band + armour-set inlay
    const band=(off,col,w)=>{g.strokeStyle=col;g.lineWidth=w;g.beginPath();for(let u=-1;u<=1.001;u+=.125){const y=brimAt(u)-off;u===-1?g.moveTo(bx+u*R,y):g.lineTo(bx+u*R*.995,y);}g.stroke();};
    band(3.5,P.edge,8.5);band(3.5,gold,6.5);band(3.5,inlay,2.2);
    g.fillStyle='#fff3c8';for(let u=-.8;u<=.81;u+=.4){g.beginPath();g.arc(bx+u*R,brimAt(u)-6,1.1,0,Math.PI*2);g.fill();}
    if(view==='front'||view==='fq'){                       // small gold peak over the brow
      const px=bx+face*R*.25,py=brimAt(face*.25);
      path(g,[[px-7,py-6],[px+7,py-6],[px,py+3]]);g.closePath();g.fillStyle=gold;g.fill();g.strokeStyle=P.edge;g.lineWidth=1.2;g.stroke();
    }
    if(!back){                                             // cheek guards
      const guard=(x,w)=>{
        const y0=brimAt(0)-1,y1=brim+(bottom-brim)*.62;
        g.beginPath();g.moveTo(x-w/2,y0);g.lineTo(x+w/2,y0);g.quadraticCurveTo(x+w*.55,y1-6,x,y1+4);g.quadraticCurveTo(x-w*.55,y1-6,x-w/2,y0);g.closePath();
        const cg=g.createLinearGradient(x-w/2,0,x+w/2,0);cg.addColorStop(0,P.dark);cg.addColorStop(.45,P.steel);cg.addColorStop(1,P.dark);
        g.fillStyle=cg;g.fill();g.strokeStyle=gold;g.lineWidth=2.2;g.stroke();g.strokeStyle=P.edge;g.lineWidth=.9;g.stroke();
        g.fillStyle=gold;g.beginPath();g.arc(x,y0+7,1.7,0,Math.PI*2);g.fill();
      };
      if(view==='front'){guard(bx-R*.9,R*.3);guard(bx+R*.9,R*.3);}
      else if(view==='fq'){guard(bx+face*R*.84,R*.25);guard(bx-face*R*.84,R*.3);}
      else guard(bx+face*R*.36,R*.36);
    }
    // gold finial on top; Lv.50+ a horsehair plume flowing back from it
    if(tier>=3){
      const [c0,c1]=tier>=7?P.plume7:P.plume,dir=view==='front'||view==='back'?1:-face;
      const L=hw*(1.05+Math.min(tier-3,4)*.14),sway=Math.sin((t||0)*2.4)*2.5;
      for(let i=0;i<11;i++){
        const k=i/10,spread=(k-.5),len=L*(.75+.25*Math.sin(k*Math.PI));
        const ex=bx+dir*(len*.85+spread*6)+sway,ey=top-4+len*(.35+spread*.3);
        const pg=g.createLinearGradient(bx,top-8,ex,ey);pg.addColorStop(0,c0);pg.addColorStop(1,c1);
        g.strokeStyle=P.edge;g.lineWidth=5.2;g.lineCap='round';
        const curve=()=>{g.beginPath();g.moveTo(bx,top-9);g.bezierCurveTo(bx+dir*len*.25,top-9-len*(.42-spread*.2),bx+dir*len*.7,top-8-len*(.3-spread*.25),ex,ey);};
        curve();g.stroke();curve();g.strokeStyle=pg;g.lineWidth=3.6;g.stroke();
      }
    }
    g.fillStyle=gold;g.strokeStyle=P.edge;g.lineWidth=1.3;
    path(g,[[bx-3,top+1],[bx-1.6,top-10],[bx,top-14],[bx+1.6,top-10],[bx+3,top+1]]);g.closePath();g.fill();g.stroke();
    g.beginPath();g.ellipse(bx,top+1,5.5,3.4,0,0,Math.PI*2);g.fill();g.stroke();
    g.beginPath();g.arc(bx,top-8,2.8,0,Math.PI*2);g.fillStyle=tier>=3?(faction==='adharma'?'#ff4a5a':'#8bdcff'):gold;g.fill();g.stroke();
  }
  W.frame = (e,now=performance.now()) => {
    const a=e.atk,active=!!a&&now-a.t0<a.dur,progress=active?(now-a.t0)/a.dur:0;
    return {atk:active,dir:active?a.dir:e.dir,frame:active?(progress<.28?0:progress<.84?1:2):CharacterMotion.walkFrame(e,1)};
  };
  W.draw = (g,e,F,x,y,scale=.46,now=performance.now()) => {
    if(!W.ready)return;
    const faction=e.faction==='adharma'?'adharma':'dharma',pose=F.atk?'attack':'walk';
    const col=C.DIR_COL[F.dir&7],row=Math.max(0,Math.min(F.atk?2:3,F.frame||0));
    const {frameWidth:fw,frameHeight:fh,anchorX:ax,anchorY:ay}=model;
    const tier=W.tierOf(e),armor=W.armorOf(e),t=now/1000,H=headOf(faction,pose,row,col),hair=W.hairColor(faction,tier);
    const head=tier>=6?e:{...e,lvl:1};                    // under the helmet: halo / horns only from Lv.100
    const inFrame=fn=>{g.save();g.translate(x-ax*scale,y-ay*scale);g.scale(scale,scale);fn();g.restore();};
    if(!e.dead){
      ModelTiers.drawAura(g,e,F,x,y,t,scale,model);        // Lv.130 sun disc / hellfire
      Wings.draw(g,e,F,x,y,t,scale,'back',model);          // Lv.60+ wings
      if(tier>=6)ModelTiers.drawHorns(g,head,F,x,y,scale,model,'back');
    }
    if(H&&tier>=2)inFrame(()=>drawTail(g,H,hair,'back'));
    g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    if((e.wp||0)>0){g.shadowColor=W.palette(faction).glow;g.shadowBlur=Math.min(10,e.wp);}
    g.drawImage(variant(faction,pose,tier,armor,e.wt||0),col*fw,row*fh,fw,fh,x-ax*scale,y-ay*scale,fw*scale,fh*scale);
    g.restore();
    if(H)inFrame(()=>{if(tier>=2)drawTail(g,H,hair,'front');drawHelmet(g,H,faction,tier,armor,t);});
    if(!e.dead){
      Wings.draw(g,e,F,x,y,t,scale,'front',model);
      if(tier>=6){ModelTiers.drawHorns(g,head,F,x,y,scale,model,'front');ModelTiers.drawHalo(g,head,F,x,y,t,scale,model);}
    }
  };
  const portraits = {};
  W.portrait = faction => { const f=faction==='adharma'?'adharma':'dharma'; return portraits[f]||'assets/warrior-v1/'+f+'-portrait.png'; };
  W.icon = (g,sk,faction) => WarriorIcons.draw(g,sk,faction,112);
  W.play = d => {
    const p=W.palette(d.f),sk=C.ALL_SKILLS[d.t],front=sk.frontline,t0=performance.now(),wind=front.windup||0;
    const A=SkillPerformance.profile(sk,d),high=sk.lvl>=120,slam=['earthShatter','citadelStrike'].includes(sk.id),ward=!!front.ward;
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
