// Class-specific skill art. FX owns lifetime/layers; these drawings are pure:
// no timers, random emission, pixel reads, or new effects inside a draw callback.
// Visual progression adds detail, never changes server reach/damage/timing.
(function () {
  const S=window.SkillFX={}, TAU=Math.PI*2;
  const ent=id=>window.G?.ents.get(id);
  const clamp=v=>Math.max(0,Math.min(1,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  S.palette=(cls,f)=>{
    const dark=f==='adharma';
    return cls==='taoist'
      ? (dark?{core:'#ffe4b0',main:'#ea693a',deep:'#702339',accent:'#ceaa64',paper:'#3c2029'}
        :{core:'#f2ffdf',main:'#54c9a6',deep:'#246c72',accent:'#d8b75d',paper:'#fff0bd'})
      :cls==='spearman'
      ? (dark?{core:'#fff0d8',main:'#f04c55',deep:'#46182c',accent:'#d6a150',paper:'#351b29'}
        :{core:'#f5fcff',main:'#68b9ef',deep:'#204a78',accent:'#e9bf62',paper:'#193954'})
      :cls==='archer'
      ? (dark?{core:'#ffd8c9',main:'#d94b61',deep:'#492033',accent:'#ad6477',paper:'#331b2d'}
        :{core:'#f3f9bd',main:'#84bd64',deep:'#315c45',accent:'#d0ac62',paper:'#cfebbb'})
      :(dark?{core:'#ffe5e1',main:'#e15458',deep:'#522232',accent:'#cfa0a2',paper:'#241b2b'}
        :{core:'#e9f9ff',main:'#60b7e7',deep:'#244e83',accent:'#b6d2eb',paper:'#172c48'});
  };
  S.profile=(id,cls,f,r=0)=>{
    const e=ent(id),lvl=Math.max(1,Math.min(130,e?.lvl||1));
    const tier=lvl>=130?4:lvl>=100?3:lvl>=60?2:lvl>=30?1:0;
    return {id,cls,lvl,tier,rank:Math.max(0,Math.min(2,r||0)),
      detail:2+tier*2,scale:1+(lvl-1)/129*.28,P:S.palette(cls,f||e?.faction)};
  };
  function add(A,skill,dur,layer,draw,delay=0){
    // Bound simultaneous skill effects in crowded fights, including delayed art.
    if(FX.list.filter(e=>e.skillArt).length>=180){
      const i=FX.list.findIndex(e=>e.skillArt);if(i>=0)FX.list.splice(i,1);
    }
    FX.list.push({skillArt:true,skill,cls:A.cls,tier:A.tier,t0:performance.now()+delay,dur,layer,
      draw(g,p,fx){
        g.save();g.lineCap='round';g.lineJoin='round';
        g.globalAlpha*=Math.min(1,p*15,(1-p)*7);
        draw(g,p,p*dur,fx);g.restore();
      }});
  }
  function line(g,pts,col,w=1.5){
    g.strokeStyle=col;g.lineWidth=w;g.beginPath();
    pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
  }
  function poly(g,pts,fill,edge){
    g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();}if(edge){g.strokeStyle=edge;g.lineWidth=1;g.stroke();}
  }
  function leaf(g,x,y,a,len,P){
    g.save();g.translate(x,y);g.rotate(a);
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(-len*.55,-len*.6,0,-len);
    g.quadraticCurveTo(len*.5,-len*.4,0,0);g.fillStyle=P.main;g.fill();
    line(g,[[0,0],[0,-len]],P.core,.7);g.restore();
  }
  function sword(g,x,y,a,len,P){
    g.save();g.translate(x,y);g.rotate(a);
    const metal=g.createLinearGradient(0,-5,0,5);
    metal.addColorStop(0,P.deep);metal.addColorStop(.42,P.main);metal.addColorStop(.5,P.core);metal.addColorStop(1,P.deep);
    poly(g,[[len,0],[len-13,-5],[0,-3],[0,3],[len-13,5]],metal,P.accent);
    line(g,[[2,0],[len-3,0]],P.core,1.4);
    line(g,[[0,-9],[0,9]],P.accent,3);line(g,[[-14,0],[-2,0]],P.deep,4);g.restore();
  }
  function cut(g,x,y,a,R,P,progress=1){
    g.save();g.translate(x,y);g.rotate(a);
    const q=clamp(progress)*2-1;
    g.beginPath();g.moveTo(-R*.3,-R*.65);
    g.quadraticCurveTo(R*1.4,-R*.3,R*.55,R*q*.65);
    g.quadraticCurveTo(R*.93,-R*.25,-R*.3,-R*.65);
    const glow=g.createLinearGradient(-R*.3,0,R,0);
    glow.addColorStop(0,P.main+'00');glow.addColorStop(.55,P.main+'99');glow.addColorStop(.9,P.core);
    g.fillStyle=glow;g.fill();g.strokeStyle=P.main;g.lineWidth=1.2;g.stroke();g.restore();
  }
  function shards(A,x,y,n=6,size=60,delay=0){
    add(A,'shards',360,'top',(g,p)=>{
      for(let i=0;i<n;i++){
        const a=seed(i+7)*TAU,d=(.15+p)*size*(.5+seed(i));
        const xx=x+Math.cos(a)*d,yy=y+Math.sin(a)*d*.6;
        line(g,[[xx,yy],[xx+Math.cos(a)*9,yy+Math.sin(a)*6]],i%2?A.P.main:A.P.core,1.5);
      }
    },delay);
  }
  function fractures(A,x,y,R,delay=0){
    add(A,'fractures',520,'ground',(g,p)=>{
      for(let i=0;i<4+A.tier;i++){
        const a=i*TAU/(4+A.tier),d=R*clamp(p*4);
        line(g,[[x,y],[x+Math.cos(a+.13)*d*.4,y+Math.sin(a+.13)*d*.23],
          [x+Math.cos(a-.09)*d*.72,y+Math.sin(a-.09)*d*.42],[x+Math.cos(a)*d,y+Math.sin(a)*d*.6]],A.P.main,1.4);
      }
    },delay);
  }
  function paper(g,x,y,a,k,P){
    g.save();g.translate(x,y);g.rotate(a);g.scale(k,k);
    poly(g,[[-7,-17],[7,-17],[7,16],[0,13],[-7,17]],P.paper,P.accent);
    line(g,[[-4,-9],[4,-9],[0,-9],[0,8],[-4,4],[4,4],[2,11]],P.main,1.5);
    line(g,[[-3,-13],[3,-13]],P.deep,1);g.restore();
  }
  function yin(g,R,P){
    g.beginPath();g.arc(0,0,R,0,TAU);g.fillStyle=P.deep;g.fill();
    g.beginPath();g.arc(0,0,R,-Math.PI/2,Math.PI/2);g.arc(0,R/2,R/2,Math.PI/2,-Math.PI/2,true);
    g.arc(0,-R/2,R/2,Math.PI/2,-Math.PI/2);g.fillStyle=P.paper;g.fill();
    for(const side of [-1,1]){g.fillStyle=side<0?P.deep:P.paper;g.beginPath();g.arc(0,side*R/2,R*.13,0,TAU);g.fill();}
  }
  function array(g,x,y,R,A,rot=0){
    g.save();g.translate(x,y);g.scale(1,.52);g.rotate(rot);
    for(let ring=0;ring<1+Math.min(2,A.tier);ring++){
      const rad=R*(1-ring*.16),pts=[];
      for(let i=0;i<=8;i++)pts.push([Math.cos(i*TAU/8)*rad,Math.sin(i*TAU/8)*rad]);
      line(g,pts,ring?A.P.accent:A.P.main,ring?1:2);
    }
    for(let i=0;i<8;i++){
      g.save();g.rotate(i*TAU/8);g.translate(0,-R*.8);
      for(let k=0;k<3;k++){
        const yy=(k-1)*5;
        line(g,(i>>k)&1?[[-7,yy],[7,yy]]:[[-7,yy],[-2,yy]],A.P.accent,1.4);
        if(!((i>>k)&1))line(g,[[2,yy],[7,yy]],A.P.accent,1.4);
      }g.restore();
    }
    if(A.tier>=2){
      for(let i=0;i<16+A.tier*4;i++){
        const a=i*TAU/(16+A.tier*4),r0=R*.58,r1=R*(i%4?.6:.65);
        line(g,[[Math.cos(a)*r0,Math.sin(a)*r0],[Math.cos(a)*r1,Math.sin(a)*r1]],A.P.main,1);
      }
    }
    if(A.tier>=3){
      g.save();g.rotate(-rot*2);
      for(let i=0;i<8;i++){
        const a=i*TAU/8;
        line(g,[[Math.cos(a)*R*.3,Math.sin(a)*R*.3],[Math.cos(a+.12)*R*.43,Math.sin(a+.12)*R*.43],
          [Math.cos(a)*R*.56,Math.sin(a)*R*.56]],A.P.accent,1.2);
      }g.restore();
    }
    g.globalAlpha*=.55;yin(g,R*.23,A.P);g.restore();
  }
  function runeField(A,skill,x,y,R,dur,delay=0){
    add(A,skill,dur,'ground',(g,p,ms)=>array(g,x,y,R*clamp(ms/220),A,p*.22),delay);
  }
  function arrow(g,x,y,a,k,P,tail=45,detail=0){
    g.save();g.translate(x,y);g.rotate(a);g.scale(k,k);
    g.globalAlpha*=.9;
    line(g,[[-tail,0],[18,0]],P.main,2);
    poly(g,[[24,0],[10,-5],[13,0],[10,5]],P.core,P.deep);
    for(const side of [-1,1]){
      poly(g,[[-17,0],[-27,side*6],[-33,side*6],[-25,0]],P.main,P.accent);
      if(detail>=2)line(g,[[-tail,side*4],[-12,side*2]],P.accent,.8);
    }g.restore();
  }
  function bird(g,x,y,a,k,A,flap=0){
    g.save();g.translate(x,y);g.rotate(a);g.scale(k,k);
    const P=A.P;
    const wing=g.createLinearGradient(0,0,-50,50);
    wing.addColorStop(0,P.deep);wing.addColorStop(.48,P.main);wing.addColorStop(.85,P.accent);wing.addColorStop(1,P.core);
    for(const side of [-1,1]){
      g.save();g.scale(1,side);
      g.beginPath();g.moveTo(12,0);g.bezierCurveTo(15,25,0,40+flap*8,-28,46+flap*8);
      g.quadraticCurveTo(-10,18,-25,3);g.closePath();g.fillStyle=wing;g.fill();
      for(let i=0;i<5+A.tier;i++){
        const t=i/(4+A.tier),sx=9-t*28,sy=10+t*16;
        const ex=-4-t*54,ey=48+flap*9-t*15;
        g.beginPath();g.moveTo(sx,sy);
        g.quadraticCurveTo(ex+18,ey+3,ex,ey);
        g.quadraticCurveTo(ex+5,ey-8,sx-6,sy-5);g.closePath();
        g.fillStyle=wing;g.fill();g.strokeStyle=P.accent;g.lineWidth=.8;g.stroke();
        line(g,[[sx-2,sy],[ex+5,ey-2]],P.core,.55);
      }
      g.restore();
    }
    for(let i=-1;i<=1;i++){
      g.beginPath();g.moveTo(-13,i*3);g.bezierCurveTo(-36,i*10,-52,i*20,-70-A.tier*6,i*22+flap*5);
      g.strokeStyle=P.main;g.lineWidth=5-Math.abs(i);g.stroke();
      g.strokeStyle=P.accent;g.lineWidth=1;g.stroke();
    }
    const body=g.createLinearGradient(0,-8,0,8);body.addColorStop(0,P.core);body.addColorStop(.4,P.main);body.addColorStop(1,P.deep);
    g.fillStyle=body;g.beginPath();g.ellipse(-2,0,24,7,0,0,TAU);g.fill();
    g.beginPath();g.ellipse(20,-1,9,6,-.2,0,TAU);g.fill();
    poly(g,[[36,-1],[26,-5],[27,3]],P.accent,P.core);
    g.fillStyle=P.deep;g.beginPath();g.arc(23,-3,1.6,0,TAU);g.fill();
    if(A.tier>=3)for(const side of [-1,1])leaf(g,15,side*5,side*1.5,15,P);
    g.restore();
  }
  function grove(g,x,y,R,A,progress=1){
    // Leaf/ thorn boundaries, never the Taoist's concentric spell circles.
    const count=8+A.tier*2;
    for(let i=0;i<count;i++){
      const a=i*TAU/count,d=R*clamp(progress);
      leaf(g,x+Math.cos(a)*d,y+Math.sin(a)*d*.56,a+Math.PI/2,9+A.tier,A.P);
    }
    if(A.tier>=1){
      g.save();g.translate(x,y);g.scale(1,.56);
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,span=(.35+A.tier*.19)*clamp(progress);
        g.beginPath();g.arc(0,0,R,a,a+span);g.strokeStyle=A.P.deep;g.lineWidth=2.5;g.stroke();
        g.strokeStyle=A.P.accent;g.lineWidth=.8;g.stroke();
        if(A.tier>=3)for(let j=1;j<=3;j++){
          const b=a+span*j/4;leaf(g,Math.cos(b)*R,Math.sin(b)*R,b+Math.PI/2,10,A.P);
        }
      }g.restore();
    }
  }
  function petals(A,x,y,R,delay=0){
    add(A,'feathers',650,'top',(g,p)=>{
      for(let i=0;i<6+A.tier*3;i++){
        const a=seed(i)*TAU,d=R*(.2+p*.8);
        leaf(g,x+Math.cos(a)*d,y+Math.sin(a)*d*.4-p*24,a+p*2,7+A.tier,A.P);
      }
    },delay);
  }
  function origin(id,a=0){
    const e=ent(id);return e?{x:e.x+Math.cos(a)*22,y:e.y-32+Math.sin(a)*8}:null;
  }
  function missile(A,skill,o,x,y,draw,dur=440,delay=0,tid=null){
    add(A,skill,dur,'top',(g,p)=>{
      const t=ent(tid),tx=t?t.x:x,ty=t?t.y-24:y;
      const px=mix(o.x,tx,p),py=mix(o.y,ty,p),a=Math.atan2(ty-o.y,tx-o.x);
      draw(g,px,py,a,p);
    },delay);
  }
  // ---- shared drawing for the redesigned skills ----
  function glow(g,x,y,r,col,a=1){
    const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,col+'00');
    g.save();g.globalAlpha*=a;g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.restore();
  }
  function ring(g,x,y,R,col,w=2,from=0,to=TAU){
    g.save();g.translate(x,y);g.scale(1,.55);g.beginPath();g.arc(0,0,Math.max(0,R),from,to);
    g.strokeStyle=col;g.lineWidth=w;g.stroke();g.restore();
  }
  // jagged bolt from (x0,y0) to (x1,y1); n = seed so it does not flicker between frames
  function bolt(g,x0,y0,x1,y1,n,P,w=3){
    const pts=[];for(let j=0;j<=7;j++){const t=j/7,off=j%7?(seed(n*31+j)-.5)*26:0;
      pts.push([mix(x0,x1,t)+off,mix(y0,y1,t)]);}
    line(g,pts,P.main,w);line(g,pts,P.core,Math.max(1,w/3));
  }
  // an effect that rides on an entity for ms (buff auras, blade storms); it stops when the entity is gone
  function onEnt(A,skill,tid,ms,layer,draw,delay=0){
    add(A,skill,ms,layer,(g,p,t)=>{const e=ent(tid);if(!e||e.dead)return;draw(g,e,p,t);},delay);
  }
  function petalBlade(g,x,y,a,len,A){
    g.save();g.translate(x,y);g.rotate(a);
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(len*.5,-len*.28,len,0);g.quadraticCurveTo(len*.5,len*.12,0,0);
    const gr=g.createLinearGradient(0,0,len,0);gr.addColorStop(0,A.P.deep);gr.addColorStop(.6,A.P.main);gr.addColorStop(1,A.P.core);
    g.fillStyle=gr;g.fill();g.strokeStyle=A.P.accent;g.lineWidth=.8;g.stroke();g.restore();
  }
  function hexShell(g,x,y,R,P,turtle){
    const pts=[];for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2;pts.push([x+Math.cos(a)*R,y+Math.sin(a)*R*1.15]);}
    poly(g,pts,null,P.accent);line(g,[...pts,pts[0]],P.main,1.6);
    if(turtle)for(let i=0;i<6;i++){const [px,py]=pts[i];line(g,[[mix(x,px,.45),mix(y,py,.45)],[px,py]],P.accent,1);}
  }
  function rock(g,x,y,r,A,spin){
    g.save();g.translate(x,y);g.rotate(spin);
    const pts=[];for(let i=0;i<7;i++){const a=i*TAU/7;pts.push([Math.cos(a)*r*(.75+seed(i+3)*.3),Math.sin(a)*r*(.75+seed(i+9)*.3)]);}
    poly(g,pts,A.P.deep,A.P.accent);
    for(let i=0;i<3;i++)line(g,[[pts[i*2][0]*.6,pts[i*2][1]*.6],[0,0]],A.P.main,1.2);
    g.restore();
  }
  function flame(g,x,y,h,w,P,t){
    g.beginPath();g.moveTo(x-w,y);
    g.quadraticCurveTo(x-w*.8,y-h*.55,x+Math.sin(t)*w*.4,y-h);
    g.quadraticCurveTo(x+w*.8,y-h*.55,x+w,y);g.closePath();
    const gr=g.createLinearGradient(x,y,x,y-h);gr.addColorStop(0,P.deep);gr.addColorStop(.5,P.main);gr.addColorStop(1,P.core+'00');
    g.fillStyle=gr;g.fill();
  }
  function crosshair(g,x,y,R,rot,P){
    ring(g,x,y,R,P.main,1.5);
    for(let i=0;i<4;i++){const a=rot+i*Math.PI/2;
      line(g,[[x+Math.cos(a)*R*.55,y+Math.sin(a)*R*.3],[x+Math.cos(a)*R*1.15,y+Math.sin(a)*R*.63]],P.core,1.4);}
  }
  function eye(g,x,y,s,P){
    g.save();g.translate(x,y);g.scale(s,s);
    g.beginPath();g.moveTo(-14,0);g.quadraticCurveTo(0,-11,14,0);g.quadraticCurveTo(0,11,-14,0);g.closePath();
    g.fillStyle=P.paper;g.fill();g.strokeStyle=P.accent;g.lineWidth=1.4;g.stroke();
    g.fillStyle=P.main;g.beginPath();g.arc(0,0,5,0,TAU);g.fill();g.fillStyle=P.deep;g.beginPath();g.arc(0,0,2.2,0,TAU);g.fill();
    g.restore();
  }
  function swirl(g,x,y,R,phase,P,n=3){
    for(let i=0;i<n;i++){const a=phase+i*TAU/n;
      g.save();g.translate(x,y);g.scale(1,.5);g.beginPath();g.arc(0,0,R,a,a+1.6);
      g.strokeStyle=P.main;g.lineWidth=3;g.stroke();g.strokeStyle=P.core;g.lineWidth=1;g.stroke();g.restore();}
  }
  function drop(g,x,y,s,P){
    g.beginPath();g.moveTo(x,y-s*1.6);g.quadraticCurveTo(x+s,y-s*.2,x,y+s*.6);g.quadraticCurveTo(x-s,y-s*.2,x,y-s*1.6);
    g.fillStyle=P.core;g.fill();g.strokeStyle=P.main;g.lineWidth=1;g.stroke();
  }
  function lotusAt(g,x,y,R,P,open=1){
    g.save();g.translate(x,y);g.scale(1,.5);
    for(let i=0;i<8;i++){g.save();g.rotate(i*TAU/8);g.globalAlpha*=.55;leaf(g,0,-R*.2,0,R*open,P);g.restore();}
    g.restore();
  }

  // ======================= ดาบคู่ — everything at arm's length: cuts, spins and blinks =======================
  const R_=S.render={};
  R_.fang=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),e=ent(d.id);if(!e)return;const a=d.a,heavy=d.c===2;
    add(A,'fang',heavy?440:290,'top',(g,p)=>{
      const q=ent(d.id)||e,x=q.x+Math.cos(a)*30,y=q.y-24+Math.sin(a)*18;
      if(heavy){for(const s of [-1,1]){g.save();g.translate(x,y);g.rotate(a+s*.78);
        const L=(62+A.tier*5)*clamp(p*4);poly(g,[[-L,0],[0,-4],[L,0],[0,4]],A.P.main,A.P.core);g.restore();}
        glow(g,x,y,40*clamp(p*3),A.P.core,.6*(1-p));return;}
      for(let i=0;i<2+Math.min(2,A.tier);i++){g.save();g.globalAlpha*=i<2?.85:.25;
        cut(g,q.x,q.y-24,a+(d.c?-.38:.38)*(i%2?-1:1)+i*.12,46+i*6,A.P,clamp(p*3-i*.1));g.restore();}
    });
    shards(A,e.x+Math.cos(a)*52,e.y-24+Math.sin(a)*32,heavy?A.detail*2:A.detail,heavy?80:60);
  };
  R_.lotus=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),n=d.n||3,dur=n*200+300,R=d.r?155:135;
    onEnt(A,'lotus',d.id,dur,'ground',(g,e,p)=>{ring(g,e.x,e.y,R*clamp(p*5),A.P.deep,3);ring(g,e.x,e.y,R*clamp(p*5)*.92,A.P.accent,1);});
    onEnt(A,'lotus',d.id,dur,'top',(g,e,p,t)=>{
      const k=6+A.tier*2,spin=t/200*TAU;
      for(let i=0;i<k;i++){const a=spin+i*TAU/k,rr=R*(.3+.25*Math.sin(Math.min(1,p*3)*Math.PI/2));
        petalBlade(g,e.x+Math.cos(a)*20,e.y-22+Math.sin(a)*10,a,rr,A);}
      g.save();g.globalAlpha*=.7;cut(g,e.x,e.y-22,spin,R*.62,A.P);cut(g,e.x,e.y-22,spin+Math.PI,R*.62,A.P);g.restore();
    });
  };
  R_.shadowstep=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),{x0,y0,x1,y1}=d,a=d.a;
    // smoke where the blade-dancer vanished, a shadow streak, the stab from behind
    add(A,'shadowstep',520,'ground',(g,p)=>{for(let i=0;i<5+A.tier;i++){const b=seed(i)*TAU,r=(10+p*30)*(.6+seed(i+4));
      glow(g,x0+Math.cos(b)*r,y0-10+Math.sin(b)*r*.5,18+p*10,A.P.deep,.8*(1-p));}});
    add(A,'shadowstep',260,'top',(g,p)=>{
      g.save();g.globalAlpha*=1-p;line(g,[[x0,y0-30],[x1,y1-30]],A.P.deep,10);line(g,[[x0,y0-30],[x1,y1-30]],A.P.main,2);g.restore();
      for(let i=0;i<3;i++){const t=clamp(p*2-i*.15);g.save();g.globalAlpha*=.4/(i+1);
        sword(g,mix(x0,x1,t),mix(y0,y1,t)-30,Math.atan2(y1-y0,x1-x0),40,A.P);g.restore();}
    });
    add(A,'shadowstep',320,'top',(g,p)=>{
      const x=x1+Math.cos(a)*26,y=y1-26+Math.sin(a)*14;
      g.save();g.translate(x,y);g.rotate(a);const L=60*clamp(p*4);
      poly(g,[[-10,0],[L,-3],[L+12,0],[L,3]],A.P.core,A.P.main);g.restore();glow(g,x+Math.cos(a)*40,y,26,A.P.main,1-p);
    },100);
    if(d.r){for(let i=1;i<=2;i++)add(A,'shadowstep',220,'top',(g,p)=>{const q=ent(d.id);if(!q)return;
        cut(g,q.x,q.y-24,a+(i%2?.5:-.5),50,A.P,clamp(p*3));},120+i*140);
      add(A,'shadowstep',360,'ground',(g,p)=>{const q=ent(d.id);if(!q)return;
        ring(g,q.x,q.y,110*clamp(p*2),A.P.deep,6*(1-p));ring(g,q.x,q.y,110*clamp(p*2),A.P.main,1.5);},520);}
    shards(A,x1+Math.cos(a)*30,y1-26,A.detail,50,120);
  };
  R_.rend=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),o=origin(d.id,d.a);if(!o)return;const a=d.a;
    for(let layer=0;layer<(d.r?2:1);layer++)add(A,'rend',460,'top',(g,p)=>{
      const x=o.x+Math.cos(a)*48,y=o.y+Math.sin(a)*28;
      for(let k=0;k<(layer?4:2);k++){g.save();g.translate(x,y);g.rotate(a+Math.PI/4+k*Math.PI/2+(layer?Math.PI/4:0));
        const L=(64+A.tier*4+layer*12)*clamp(p*4);poly(g,[[-L,0],[0,-(3+A.tier)],[L,0],[0,3+A.tier]],A.P.main,A.P.core);g.restore();}
      // broken armour plates thrown outward
      for(let i=0;i<5+A.tier;i++){const b=seed(i+layer*9)*TAU,r=10+p*55;
        g.save();g.translate(x+Math.cos(b)*r,y+Math.sin(b)*r*.6);g.rotate(b+p*4);
        poly(g,[[-5,-3],[5,-4],[4,4],[-4,3]],A.P.accent,A.P.deep);g.restore();}
      for(let i=0;i<4;i++){g.fillStyle='#b3202a';g.beginPath();g.arc(x+(seed(i+20)-.5)*40,y+p*30+seed(i)*10,2.2,0,TAU);g.fill();}
    },layer*290+80);
  };
  R_.tempest=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),n=d.n||8,gap=d.g||325,R=d.R||170,end=250+n*gap;
    onEnt(A,'tempest',d.id,end+200,'ground',(g,e,p,t)=>{
      ring(g,e.x,e.y,R,A.P.deep,4);ring(g,e.x,e.y,R*.96,A.P.main,1.2,t/300,t/300+TAU*.8);
      for(let i=0;i<8+A.tier*2;i++){const a=i*TAU/(8+A.tier*2)-t/500;line(g,[[e.x+Math.cos(a)*R*.88,e.y+Math.sin(a)*R*.48],[e.x+Math.cos(a)*R,e.y+Math.sin(a)*R*.55]],A.P.accent,1.5);}
    });
    onEnt(A,'tempest',d.id,end+200,'top',(g,e,p,t)=>{
      const k=8+A.tier*2+(A.rank*2),spin=t/260;
      for(let ringN=0;ringN<(A.rank?2:1);ringN++)for(let i=0;i<k;i++){
        const a=spin*(ringN?-1.3:1)+i*TAU/k,rr=R*(ringN?.55:.82);
        const x=e.x+Math.cos(a)*rr,y=e.y-26+Math.sin(a)*rr*.52;
        sword(g,x,y,a+Math.PI/2*(ringN?-1:1),26+A.tier*3,A.P);
      }
      if(t>=250&&t<end){const q=((t-250)%gap)/gap;g.save();g.globalAlpha*=1-q;cut(g,e.x,e.y-22,spin*3,R*.7,A.P,q*1.4);g.restore();}
    });
    if(A.rank)onEnt(A,'tempest',d.id,520,'top',(g,e,p)=>{
      const k=12+A.tier*3;for(let i=0;i<k;i++){const a=i*TAU/k,rr=(R+30)*(.3+p*.9);
        sword(g,e.x+Math.cos(a)*rr,e.y-24+Math.sin(a)*rr*.55,a,34+A.tier*4,A.P);}
      glow(g,e.x,e.y-24,(R+30)*p,A.P.core,.5*(1-p));
    },end+150);
  };
  R_.crescent=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),o=origin(d.id,d.a);if(!o)return;const a=d.a,R=d.R||190,half=65*Math.PI/180;
    for(let k=0;k<(d.r?2:1);k++)add(A,'crescent',360,'top',(g,p)=>{
      const sweep=clamp(p*2.6),dir=k?-1:1,from=a-half*dir,to=from+2*half*dir*sweep;
      g.save();g.translate(o.x,o.y+8);g.scale(1,.62);
      for(let i=0;i<2+Math.min(2,A.tier);i++){const rr=R*(.6+i*.13);
        g.beginPath();g.arc(0,0,rr,Math.min(from,to),Math.max(from,to));
        g.strokeStyle=i?A.P.main:A.P.core;g.globalAlpha=(i?.5:.95)*(1-p*.7);g.lineWidth=(i?3:7)+A.tier;g.stroke();}
      g.restore();
      const tip=to;sword(g,o.x+Math.cos(tip)*R*.85,o.y+8+Math.sin(tip)*R*.53,tip+Math.PI/2*dir,34,A.P);
    },k?220:0);
    shards(A,o.x+Math.cos(a)*R*.7,o.y+Math.sin(a)*R*.4,A.detail*2,R*.6,120);
  };
  R_.skyfall=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),{x0,y0,x1,y1}=d;
    add(A,'skyfall',460,'top',(g,p)=>{
      const x=mix(x0,x1,p),y=mix(y0,y1,p)-Math.sin(p*Math.PI)*110;
      for(const side of [-1,1])sword(g,x+side*17,y-18,Math.PI/2+side*(.3+p*.5),42+A.tier*4,A.P);
      g.save();g.globalAlpha*=.4;line(g,[[x0,y0-30],[x,y-18]],A.P.main,2);g.restore();
    });
    add(A,'skyfall',460,'ground',(g,p)=>{ring(g,x1,y1,(d.r?175:150)*(1-p*.3),A.P.main,1.5);});
    fractures(A,x1,y1,d.r?175:150,460);shards(A,x1,y1-8,8+A.tier*3,110,460);
    add(A,'skyfall',380,'top',(g,p)=>glow(g,x1,y1-10,120*p,A.P.core,.6*(1-p)),460);
    if(d.r){fractures(A,x1,y1,240,780);
      add(A,'skyfall',4000,'ground',(g,p,t)=>{for(let i=0;i<10+A.tier*2;i++){const a=i*TAU/(10+A.tier*2);
        flame(g,x1+Math.cos(a)*150,y1+Math.sin(a)*82,22+Math.sin(t/120+i)*6,8,{core:'#fff3c0',main:'#ff8a3a',deep:A.P.deep},t/150+i);}},460);}
  };
  R_.thousand=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),n=d.n||8,a=d.a,dur=80+n*90;
    const at=()=>{const t=ent(d.tid),q=ent(d.id);return t?{x:t.x,y:t.y-24}:q?{x:q.x+Math.cos(a)*70,y:q.y-24+Math.sin(a)*40}:null;};
    add(A,'thousand',dur+200,'top',(g,p,t)=>{
      const c=at();if(!c)return;
      for(let i=0;i<n;i++){const t0=80+i*90,q=(t-t0)/180;if(q<0||q>1)continue;
        const b=seed(i*5+1)*TAU,L=44+A.tier*4;g.save();g.globalAlpha*=1-q;
        line(g,[[c.x-Math.cos(b)*L,c.y-Math.sin(b)*L*.7],[c.x+Math.cos(b)*L,c.y+Math.sin(b)*L*.7]],A.P.main,4);
        line(g,[[c.x-Math.cos(b)*L,c.y-Math.sin(b)*L*.7],[c.x+Math.cos(b)*L,c.y+Math.sin(b)*L*.7]],A.P.core,1.2);g.restore();}
      // after-images of the blades round the target
      const q=ent(d.id);if(q)for(let i=0;i<3;i++){const b=t/60+i*TAU/3;g.save();g.globalAlpha*=.35;
        sword(g,c.x+Math.cos(b)*36,c.y+Math.sin(b)*20,b+Math.PI,30,A.P);g.restore();}
    });
    if(d.r)add(A,'thousand',480,'top',(g,p)=>{const c=at();if(!c)return;
      glow(g,c.x,c.y,160*p,A.P.core,.55*(1-p));
      for(let i=0;i<10+A.tier*2;i++){const b=i*TAU/(10+A.tier*2);cut(g,c.x,c.y,b,40+p*90,A.P,clamp(p*2));}
    },dur+120);
  };
  R_.twindragon=d=>{
    const A=S.profile(d.id,'dualblade',d.f,d.r),{x0,y0,x1,y1}=d,a=d.a;
    const body=(g,x,y,b,p,side)=>{g.save();g.translate(x,y);g.rotate(b);
      const off=side*18*Math.sin(p*TAU*2);
      for(let i=0;i<9+A.tier*2;i++){const yy=off+Math.sin(i*.55-p*12)*12*side;sword(g,-i*9,yy,Math.sin(i*.5-p*12)*.3,22,A.P);}
      poly(g,[[30,off],[8,off-14],[-6,off-8],[0,off+12]],A.P.main,A.P.core);
      line(g,[[9,off-10],[-1,off-26],[-10,off-20]],A.P.accent,2);g.restore();};
    add(A,'twindragon',300,'top',(g,p)=>{const x=mix(x0,x1,clamp(p*1.4)),y=mix(y0,y1,clamp(p*1.4))-30;
      for(const s of [-1,1])body(g,x,y,a,p,s);});
    const bursts=d.r?[[190,260],[230,520],[270,780]]:[[190,260]];
    for(const [R,at] of bursts){
      fractures(A,x1,y1,R,at);
      add(A,'twindragon',560,'top',(g,p)=>{
        for(let i=0;i<6+A.tier;i++){const b=i*TAU/(6+A.tier)+R,rr=R*.75,h=110*Math.sin(clamp(p*1.6)*Math.PI);
          const x=x1+Math.cos(b)*rr,y=y1+Math.sin(b)*rr*.55;
          glow(g,x,y-h*.5,22,A.P.main,.5);if(h>4)sword(g,x,y,-Math.PI/2+Math.cos(b)*.15,h,A.P);}
        glow(g,x1,y1-20,R*.8*p,A.P.core,.45*(1-p));
      },at);
    }
  };

  // ======================= นักพรต — talismans, arrays, heals and blessings =======================
  R_.jade=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),o=origin(d.id,d.a),e=ent(d.id);if(!o||!e)return;
    const ids=d.ids||[];
    for(let i=0;i<Math.max(1,Math.min(3,ids.length||1));i++){
      const t=ent(ids[i]),dd=Math.hypot((t?.x??d.tx)-e.x,(t?.y??d.ty)-e.y);
      missile(A,'jade',o,d.tx,d.ty,(g,x,y,b,p)=>{
        glow(g,x,y,16,A.P.main,.6);paper(g,x,y+Math.sin(p*Math.PI)*(i-1)*24,b+Math.PI/2+p*6,A.scale*.9,A.P);
        for(let k=0;k<A.tier;k++)glow(g,x-Math.cos(b)*(k+1)*14,y-Math.sin(b)*(k+1)*14,6,A.P.core,.5/(k+1));
      },90+Math.min(320,dd*.55),i*40,ids[i]);
    }
  };
  R_.skybolt=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),x=d.x,y=d.y,R=d.r?170:120,w=d.r?3:1;
    runeField(A,'skybolt',x,y,R,300+w*260+300);
    add(A,'skybolt',300+w*260+200,'top',(g,p,t)=>{  // the storm cloud
      for(let i=0;i<5+A.tier;i++){const cx=x+(i-2.5)*22,cy=y-250-Math.sin(i*1.7)*8;glow(g,cx,cy,34,A.P.deep,.85);}
      glow(g,x,y-250,60,A.P.main,.25+.15*Math.sin(t/60));
    });
    for(let k=0;k<w;k++)add(A,'skybolt',300,'top',(g,p)=>{
      for(let j=0;j<1+A.tier+(d.r?2:0);j++){const off=j?(seed(j+k*7)-.5)*R*1.4:0;
        g.save();g.globalAlpha*=1-p;bolt(g,x+off*.3,y-245,x+off,y+(seed(j)-.5)*R*.4,j+k*11,A.P,j?2:4);g.restore();}
      glow(g,x,y,R*.8,A.P.core,.5*(1-p));
    },300+k*260);
  };
  R_.mercy=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),ids=(d.ids?.length?d.ids:[d.id]).slice(0,32);
    add(A,'mercy',700,'ground',(g,p)=>{ring(g,d.x,d.y,480*p,A.P.main,3*(1-p));});
    for(const tid of ids){
      onEnt(A,'mercy',tid,900,'top',(g,e,p)=>{for(let i=0;i<6+A.tier*2;i++){
        const fx=e.x+(seed(i+String(tid).length)-.5)*60,fy=e.y-130+p*110+seed(i)*30;g.save();g.globalAlpha*=1-p;drop(g,fx,fy,4,A.P);g.restore();}});
      onEnt(A,'mercy',tid,d.r?1400:1100,'ground',(g,e,p,t)=>{lotusAt(g,e.x,e.y,30+Math.sin(t/260)*4,A.P,clamp(t/300));});
      onEnt(A,'mercy',tid,d.r?1400:1100,'top',(g,e,p,t)=>{for(let i=0;i<2+A.tier;i++){const ph=(t/1400+i/(2+A.tier))%1;
        g.save();g.globalAlpha*=1-ph;leaf(g,e.x+(i%2?1:-1)*(22+ph*8),e.y-10-ph*70,Math.sin(ph*TAU)*.3,10,A.P);g.restore();}});
    }
  };
  R_.aegis=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r);
    for(const tid of (d.ids||[]).slice(0,32)){
      onEnt(A,'aegis',tid,600,'top',(g,e,p)=>{g.save();g.globalAlpha*=1-p;hexShell(g,e.x,e.y-38,30+p*30,A.P,!!d.r);g.restore();});
      onEnt(A,'aegis',tid,d.d||8000,'top',(g,e,p,t)=>{
        // five element talismans circling, a faint shell (turtle plates when evolved)
        for(let i=0;i<5;i++){const a=i*TAU/5+t/1300;paper(g,e.x+Math.cos(a)*40,e.y-34+Math.sin(a)*20,Math.sin(a)*.25,.5,A.P);}
        g.save();g.globalAlpha*=.28+.08*Math.sin(t/300);hexShell(g,e.x,e.y-38,32,A.P,!!d.r);g.restore();
      },300);
    }
  };
  R_.heavens=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),{x,y,R,n}=d,dur=350+n*420+(d.r?500:100);
    runeField(A,'heavens',x,y,R,dur);
    add(A,'heavens',dur,'ground',(g,p,t)=>{if(A.rank>1){g.save();g.translate(x,y);g.scale(1,.52);g.rotate(t/900);g.globalAlpha*=.16;yin(g,R*.5,A.P);g.restore();}});
    add(A,'heavens',dur,'top',(g,p,t)=>{
      if(t<350)return;const k=Math.floor((t-350)/420),q=((t-350)%420)/420;if(k>=n)return;
      // a pillar of light per tick and healing leaves rising from the array
      const a=k*2.4,xx=x+Math.cos(a)*R*.55,yy=y+Math.sin(a)*R*.3;
      g.save();g.globalAlpha*=1-q;line(g,[[xx,yy-140],[xx,yy]],A.P.main,6);line(g,[[xx,yy-140],[xx,yy]],A.P.core,2);g.restore();
      for(let i=0;i<4+A.tier;i++){const b=seed(i+k*3)*TAU,r=Math.sqrt(seed(i+k*5))*R*.8;
        g.save();g.globalAlpha*=1-q;leaf(g,x+Math.cos(b)*r,y+Math.sin(b)*r*.55-q*50,b,8,A.P);g.restore();}
    });
    if(d.r)add(A,'heavens',500,'top',(g,p)=>{glow(g,x,y-20,R*p,A.P.core,.6*(1-p));
      if(A.rank>1){g.save();g.translate(x,y-30);g.rotate(p*4);yin(g,40+p*50,A.P);g.restore();}},350+n*420+150);
  };
  R_.spiritsword=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),o=origin(d.id,d.a);if(!o)return;
    for(const da of d.r?[-.36,-.18,0,.18,.36]:[0]){
      const b=d.a+da,L=d.r?600:520;
      missile(A,'spiritsword',o,o.x+Math.cos(b)*L,o.y+Math.sin(b)*L,(g,x,y,ang)=>{
        glow(g,x,y,20,A.P.main,.5);sword(g,x,y,ang,44,A.P);
        for(let k=0;k<A.tier+1;k++)paper(g,x-Math.cos(ang)*(46+k*20),y-Math.sin(ang)*(46+k*20),ang+Math.PI/2,.3,A.P);
      },440);
    }
  };
  R_.might=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),war={...A.P,main:'#ff7a3a',core:'#ffe9a8',deep:'#7a1d12'};
    for(const tid of (d.ids||[]).slice(0,32)){
      onEnt(A,'might',tid,500,'top',(g,e,p)=>{glow(g,e.x,e.y-40,60,war.core,.7*(1-p));
        g.save();g.globalAlpha*=1-p;line(g,[[e.x,e.y-200*(1-p)],[e.x,e.y]],war.main,8);g.restore();});
      onEnt(A,'might',tid,d.d||12000,'ground',(g,e,p,t)=>{for(let i=0;i<6+A.tier;i++){const a=i*TAU/(6+A.tier)+t/700;
        flame(g,e.x+Math.cos(a)*24,e.y+Math.sin(a)*12,18+Math.sin(t/140+i)*5,6,war,t/170+i);}});
      onEnt(A,'might',tid,d.d||12000,'top',(g,e,p,t)=>{
        const y=e.y-104+Math.sin(t/400)*3;g.save();g.globalAlpha*=.85;
        g.font='700 18px serif';g.textAlign='center';g.lineWidth=3;g.strokeStyle=war.deep;g.strokeText('武',e.x,y);g.fillStyle=war.core;g.fillText('武',e.x,y);
        g.restore();
      },200);
    }
  };
  R_.meteor=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),pts=C.meteorPoints(d.x,d.y,d.n||5),R=d.r?150:130;
    const fire={...A.P,main:'#ff8a3a',core:'#fff1c0'},stone={...A,P:{...A.P,deep:'#4a2a24',main:'#ff8a3a',accent:'#ffcf6a'}};
    add(A,'meteor',500+pts.length*220+400,'ground',(g,p,t)=>{pts.forEach(([x,y],i)=>{const hit=500+i*220;
      if(t<hit)ring(g,x,y,R*clamp(t/hit),fire.main,1.2);});});
    pts.forEach(([x,y],i)=>{
      const hit=500+i*220;
      add(A,'meteor',360,'top',(g,p)=>{const sx=x-170*(1-p),sy=y-300*(1-p);
        g.save();g.globalAlpha*=.6;line(g,[[sx-60,sy-100],[sx,sy]],fire.main,10*p);g.restore();
        glow(g,sx,sy,22,fire.core,.9);rock(g,sx,sy,12+A.tier*2,stone,p*6);},hit-360);
      fractures(A,x,y,R*.8,hit);
      add(A,'meteor',420,'top',(g,p)=>{glow(g,x,y-10,R*p,fire.core,.7*(1-p));ring(g,x,y,R*p,fire.main,4*(1-p));},hit);
    });
    if(d.r){const hit=500+pts.length*220+300;
      add(A,'meteor',600,'top',(g,p)=>{const sx=d.x-200*(1-p),sy=d.y-380*(1-p);glow(g,sx,sy,50,fire.core,.9);rock(g,sx,sy,34,stone,p*4);},hit-600);
      fractures(A,d.x,d.y,220,hit);add(A,'meteor',600,'top',(g,p)=>glow(g,d.x,d.y-20,240*p,fire.core,.75*(1-p)),hit);}
  };
  R_.nirvana=d=>{
    const A=S.profile(d.id,'taoist',d.f,d.r),ids=(d.ids?.length?d.ids:[d.id]).slice(0,32),sun={...A.P,core:'#fffbe0',main:'#ffd36a'};
    add(A,'nirvana',1200,'ground',(g,p)=>{for(let k=0;k<3;k++){const q=clamp(p*1.5-k*.15);ring(g,d.x,d.y,520*q,sun.main,3*(1-q));}
      lotusAt(g,d.x,d.y,70*clamp(p*3),sun,1);});
    add(A,'nirvana',1000,'top',(g,p)=>{g.save();g.globalAlpha*=Math.sin(p*Math.PI);
      const gr=g.createLinearGradient(d.x-40,0,d.x+40,0);gr.addColorStop(0,sun.main+'00');gr.addColorStop(.5,sun.core);gr.addColorStop(1,sun.main+'00');
      g.fillStyle=gr;g.fillRect(d.x-40,d.y-420,80,420);glow(g,d.x,d.y-20,90,sun.core,.8);g.restore();});
    for(const tid of ids){
      onEnt(A,'nirvana',tid,1300,'top',(g,e,p)=>{g.save();g.globalAlpha*=Math.sin(p*Math.PI)*.8;
        line(g,[[e.x,e.y-300],[e.x,e.y]],sun.core,14);g.restore();
        for(let i=0;i<5+A.tier;i++){const ph=(p+i/(5+A.tier))%1;leaf(g,e.x+Math.sin(i*2.1)*26,e.y-ph*90,ph*3,9,sun);}});
      if(d.r)onEnt(A,'nirvana',tid,4000,'top',(g,e,p,t)=>{g.save();g.translate(e.x,e.y-110);g.rotate(t/500);g.globalAlpha*=.75;yin(g,11,A.P);g.restore();
        g.save();g.globalAlpha*=.25;hexShell(g,e.x,e.y-38,34,sun,true);g.restore();},300);
    }
  };

  // ======================= นักธนู — fletched arrows, keen eyes and wind =======================
  R_.hawkshot=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),o=origin(d.id,d.a),e=ent(d.id);if(!o||!e)return;
    const t=ent(d.ids?.[0]),fly=70+Math.min(260,Math.hypot((t?.x??d.tx)-e.x,(t?.y??d.ty)-e.y)*.45);
    const shot=(tid,delay,P=A.P)=>missile(A,'hawkshot',o,d.tx,d.ty,(g,x,y,b)=>arrow(g,x,y,b,A.scale,P,35+A.tier*7,A.tier),fly,delay,tid);
    for(let i=0;i<Math.min(d.n||1,2);i++)shot(d.ids?.[0],i*110);
    if(d.b)shot(d.b,90);
    if(d.e)shot(d.e,60,{...A.P,main:A.P.deep,core:A.P.accent});   // พายุเร่งพันศร: a shadow arrow
  };
  R_.scatter=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),o=origin(d.id,d.a);if(!o)return;
    for(let w=0;w<Math.min(d.v||1,2);w++)for(let i=0;i<Math.min(d.n||5,12);i++){
      const b=d.a+(i/Math.max(1,(d.n||5)-1)-.5)*(d.r?.95:.65);
      missile(A,'scatter',o,o.x+Math.cos(b)*d.L,o.y+Math.sin(b)*d.L,(g,x,y,ang,p)=>{
        arrow(g,x,y,ang,A.scale,A.P,48,A.tier);
        if(A.tier>=1)drop(g,x-Math.cos(ang)*58,y-Math.sin(ang)*58+p*6,2.5,A.P);
      },300,w*260);
    }
  };
  R_.hawkeye=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r);
    for(const tid of (d.ids||[]).slice(0,32)){
      const own=tid===d.id;
      onEnt(A,'hawkeye',tid,600,'top',(g,e,p)=>{for(let i=0;i<8+A.tier*2;i++){const a=i*TAU/(8+A.tier*2);
        leaf(g,e.x+Math.cos(a)*(16+p*50),e.y-50+Math.sin(a)*(10+p*26),a+Math.PI/2,10,A.P);}
        glow(g,e.x,e.y-90,30,A.P.core,1-p);});
      onEnt(A,'hawkeye',tid,d.d||10000,'ground',(g,e,p,t)=>crosshair(g,e.x,e.y,own?34:26,t/700,A.P));
      onEnt(A,'hawkeye',tid,d.d||10000,'top',(g,e,p,t)=>{g.save();g.globalAlpha*=own?.95:.6;eye(g,e.x,e.y-104+Math.sin(t/350)*2,own?1:.75,A.P);g.restore();},200);
    }
  };
  R_.gale=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),wind={...A.P,main:'#a9f0e4',core:'#ffffff'};
    for(const tid of (d.ids||[]).slice(0,4)){
      onEnt(A,'gale',tid,500,'top',(g,e,p)=>{swirl(g,e.x,e.y-20,30+p*70,p*8,wind,4);});
      onEnt(A,'gale',tid,d.d||8000,'ground',(g,e,p,t)=>swirl(g,e.x,e.y,34,t/160,wind,3));
      onEnt(A,'gale',tid,d.d||8000,'top',(g,e,p,t)=>{
        swirl(g,e.x,e.y-40,24,-t/120,wind,2);
        for(let i=0;i<3+A.tier;i++){const a=t/240+i*TAU/(3+A.tier);leaf(g,e.x+Math.cos(a)*30,e.y-34+Math.sin(a)*16,a,8,A.P);}
        if(d.r)for(let i=0;i<2;i++){const a=t/200+i*Math.PI;arrow(g,e.x+Math.cos(a)*44,e.y-46+Math.sin(a)*14,a+Math.PI/2,.5,{...A.P,main:A.P.deep},14,0);}
      },150);
    }
  };
  R_.skyrain=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),{x,y,R}=d,n=d.n||7,end=420+n*220,dur=end+650;
    add(A,'skyrain',dur,'ground',(g,p,ms)=>grove(g,x,y,R,A,ms/300));
    add(A,'skyrain',dur,'top',(g,p,ms)=>{
      for(let w=0;w<Math.min(n,11);w++){
        const q=(ms-(420+w*220-280))/350;if(q<0||q>1)continue;
        for(let j=0;j<4+A.tier*2;j++){
          const a=seed(w*17+j)*TAU,dd=Math.sqrt(seed(w*19+j+60))*R*.9,fall=clamp(q/.8);
          arrow(g,x+Math.cos(a)*dd-(1-fall)*55,y+Math.sin(a)*dd*.56-(1-fall)*180,1.27,.8+A.tier*.05,A.P,28,A.tier);
        }
      }
      if(d.r&&ms>end){const q=clamp((ms-end)/200);arrow(g,x,y-230*(1-q),Math.PI/2,2+A.tier*.2,A.P,90,A.tier);}
    });
    if(d.r)petals(A,x,y,R*.65,end+200);
  };
  R_.deadeye=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),o=origin(d.id,d.a);if(!o)return;
    const target=ent(d.ids?.[0]),x=target?.x??d.tx,y=target?target.y-24:d.ty-24,sure=!!d.s;
    const P=sure?{...A.P,main:'#ff4a5a',core:'#ffe0e4'}:A.P;
    add(A,'deadeye',260,'top',(g,p)=>{crosshair(g,x,y+10,(30+(sure?10:0))*(1.4-p*.5),p*2,P);
      g.save();g.globalAlpha*=.3;line(g,[[o.x,o.y],[x,y]],P.main,1);g.restore();});
    const fly=Math.min(160,Math.hypot(x-o.x,y-o.y)*.25);
    missile(A,'deadeye',o,x,y,(g,xx,yy,b)=>{arrow(g,xx,yy,b,1.5+A.tier*.1,P,100,A.tier);if(sure)glow(g,xx,yy,20,P.main,.6);},Math.max(60,fly),180,d.ids?.[0]);
    if(sure)add(A,'deadeye',380,'top',(g,p)=>{glow(g,x,y,50*p+10,P.core,1-p);},180+fly);
    if(d.r)for(let i=1;i<Math.min(d.ids?.length||0,3);i++){
      const t=ent(d.ids[i]);if(t)missile(A,'deadeye',{x,y},t.x,t.y-24,(g,xx,yy,b)=>arrow(g,xx,yy,b,A.scale,A.P,40,A.tier),120,180+fly+i*60,d.ids[i]);
    }
  };
  R_.rollshot=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),{x0,y0,x1,y1}=d,a=d.a,n=d.n||3;
    add(A,'rollshot',520,'top',(g,p)=>{for(let i=0;i<5+A.tier*2;i++){const q=clamp(p*2-i*.05);
      leaf(g,mix(x0,x1,q),mix(y0,y1,q)-24-Math.sin(q*Math.PI)*30,i*.9+p*5,10,A.P);}
      swirl(g,mix(x0,x1,clamp(p*2)),mix(y0,y1,clamp(p*2))-24,22,p*10,A.P,2);});
    const o={x:x1+Math.cos(a)*22,y:y1-32};
    for(let i=0;i<n;i++){const b=a+(i-(n-1)/2)*.06;
      missile(A,'rollshot',o,o.x+Math.cos(b)*440,o.y+Math.sin(b)*440,(g,x,y,ang)=>arrow(g,x,y,ang,A.scale,A.P,55,A.tier),300,200+i*90);}
    if(d.r)add(A,'rollshot',600,'top',(g,p)=>{swirl(g,x0,y0-20,40+p*90,p*9,A.P,4);glow(g,x0,y0-20,130*p,A.P.core,.4*(1-p));},320);
  };
  R_.blast=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),o=origin(d.id,d.a);if(!o)return;
    const pts=C.blastPoints(d.x,d.y,d.a,d.r),R=d.r?150:170,fire={...A.P,main:'#ff7a2a',core:'#fff0b0'};
    add(A,'blast',420,'top',(g,p)=>{   // the fire arrow arcs onto the aim
      const x=mix(o.x,d.x,p),y=mix(o.y,d.y,p)-Math.sin(p*Math.PI)*120,b=Math.atan2((d.y-o.y)-Math.cos(p*Math.PI)*120*Math.PI,d.x-o.x);
      arrow(g,x,y,b,1.2,fire,50,A.tier);glow(g,x,y,18,fire.main,.7);
    });
    pts.forEach(([x,y],i)=>{const at=420+i*120;
      fractures(A,x,y,R*.8,at);
      add(A,'blast',520,'top',(g,p)=>{glow(g,x,y-14,R*p,fire.core,.8*(1-p));ring(g,x,y,R*p,fire.main,5*(1-p));
        for(let k=0;k<8+A.tier*2;k++){const b=k*TAU/(8+A.tier*2);leaf(g,x+Math.cos(b)*R*p*.8,y-14+Math.sin(b)*R*p*.45,b+Math.PI/2,10,fire);}},at);
      add(A,'blast',3600,'ground',(g,p,t)=>{if(p>.9)g.globalAlpha*=(1-p)*10;
        for(let k=0;k<5;k++){const b=k*TAU/5+i;flame(g,x+Math.cos(b)*R*.5,y+Math.sin(b)*R*.28,16+Math.sin(t/110+k)*5,6,fire,t/140+k);}},at);
    });
  };
  R_.stormphoenix=d=>{
    const A=S.profile(d.id,'archer',d.f,d.r),o=origin(d.id,d.a);if(!o)return;const a=d.a,L=680;
    const storm={...A.P,main:'#8fd8ff',core:'#ffffff'};
    missile(A,'stormphoenix',o,o.x+Math.cos(a)*L,o.y+Math.sin(a)*L,(g,x,y,b,p)=>{
      for(const side of d.r?[-1,1]:[0]){
        const off=side*Math.sin(p*TAU)*26,px=x-Math.sin(b)*off,py=y+Math.cos(b)*off;
        bird(g,px,py,b,1.15+A.tier*.13,A,Math.sin(p*22));
        for(let k=0;k<2+A.tier;k++){const bx=px-Math.cos(b)*(30+k*26),by=py-Math.sin(b)*(30+k*26);
          bolt(g,bx,by-14,bx-Math.cos(b)*22,by+14,k+Math.floor(p*20),storm,1.5);}
      }
    },720,160);
    if(d.r){const ex=o.x+Math.cos(a)*L,ey=o.y+Math.sin(a)*L+20;
      add(A,'stormphoenix',520,'top',(g,p)=>{glow(g,ex,ey,230*p,storm.core,.7*(1-p));
        for(let k=0;k<6+A.tier;k++){const b=k*TAU/(6+A.tier);bolt(g,ex,ey,ex+Math.cos(b)*200*p,ey+Math.sin(b)*110*p,k,storm,2);}},1030);}
  };
  S.play=d=>{if(C.ALL_SKILLS[d.t]?.spear&&window.SpearmanFX)return SpearmanFX.play(d);const fn=R_[d.t];if(fn)fn(d);};
  // Hits also retain the attacker's identity instead of every class making sparks.
  const legacyHit=FX.hit;
  FX.hit=(x,y,f,crit,id)=>{
    const e=ent(id);if(!e||!C.CLASSES[e.cls])return legacyHit(x,y,f,crit,id);
    const A=S.profile(id,e.cls,f);
    if(e.cls==='dualblade'||e.cls==='spearman')shards(A,x,y,crit?10:5,crit?45:26);
    else if(e.cls==='archer')petals(A,x,y,crit?38:22);
    else add(A,'hit',340,'top',(g,p)=>{
      for(let i=0;i<(crit?4:2);i++){const a=i*TAU/(crit?4:2);
        paper(g,x+Math.cos(a)*(12+p*20),y+Math.sin(a)*(12+p*20),a+p,.4,A.P);}
    });
  };
})();
