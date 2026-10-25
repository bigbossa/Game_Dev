// Endgame arts (keys 0 / -): the travelling move, then the server-confirmed finishing blow.
// No client timer can deal damage or release a cancelled art.
(function () {
  const S = window.AscendedSkills = {}, TAU = Math.PI * 2;
  const line = (g, p, c, w=1) => { g.beginPath(); p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.strokeStyle=c;g.lineWidth=w;g.stroke(); };
  const poly = (g,p,c,edge) => { g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=c;g.fill();if(edge){g.strokeStyle=edge;g.lineWidth=1;g.stroke();} };
  const ring = (g,x,y,r,c,w=1) => { g.beginPath();g.arc(x,y,Math.max(.1,r),0,TAU);g.strokeStyle=c;g.lineWidth=w;g.stroke(); };
  const colors = (f,cls) => f==='adharma'
    ? ({dualblade:['#ff557a','#ffe4c1','#391329'],archer:['#da77ef','#ffc4de','#301733'],taoist:['#fa7252','#f7d097','#361526'],spearman:['#f35263','#ffdfac','#301c28'],warrior:['#ff7a4a','#ffd9b0','#3a1414'],arbiter:['#ce8aff','#fff1fc','#40203e']}[cls]||['#ff6385','#e5a7ff','#391329'])
    : ({dualblade:['#9ad9ff','#fff1c6','#294b61'],archer:['#a5f4bc','#fff2b5','#294b43'],taoist:['#8ff1db','#fff0c1','#294b52'],spearman:['#f5d48b','#fffbe0','#5a4226'],warrior:['#ffcf6a','#fff6dc','#5a3a1a'],arbiter:['#75dcff','#f5fdff','#154e73']}[cls]||['#9ef5ed','#ffe6a1','#294b61']);
  function glow(g,x,y,r,P,alpha=.4){
    const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,P[1]+'a0');gr.addColorStop(.3,P[0]+'55');gr.addColorStop(1,P[0]+'00');
    g.save();g.globalAlpha*=alpha;g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);g.restore();
  }
  function lance(g,x,y,L,P,tier,f){
    g.save();g.translate(x,y);g.rotate(Math.PI/2);
    line(g,[[-L,0],[-L*.22,0]],P[2],5);line(g,[[-L,0],[-L*.22,0]],P[1],2);
    g.translate(-L*.22,0);SpearWeapon.head(g,tier,f,L*.36,L*.085);g.restore();
  }
  function blade(g,x,y,a,L,P) {
    g.save();g.translate(x,y);g.rotate(a);
    poly(g,[[0,-L],[-L*.10,-L*.25],[-3,0],[3,0],[L*.10,-L*.25]],P[0],P[1]);
    line(g,[[-L*.16,0],[L*.16,0]],P[1],2);line(g,[[0,0],[0,L*.2]],P[2],3);g.restore();
  }
  // a heater shield of light, its point along `a` + PI/2 (upright when a = 0), L = its height
  function shield(g,x,y,a,L,P) {
    const w=L*.4,h=L*.5;g.save();g.translate(x,y);g.rotate(a);
    poly(g,[[-w,-h],[w,-h],[w,h*.15],[w*.55,h*.7],[0,h],[-w*.55,h*.7],[-w,h*.15]],P[0]+'cc',P[1]);
    line(g,[[0,-h*.82],[0,h*.78]],P[1],2);line(g,[[-w*.7,-h*.25],[w*.7,-h*.25]],P[1],2);
    poly(g,[[0,-h*.42],[w*.14,-h*.25],[0,-h*.08],[-w*.14,-h*.25]],P[1]);g.restore();
  }
  function arrow(g,x,y,a,L,P) {
    g.save();g.translate(x,y);g.rotate(a);line(g,[[0,0],[0,L]],P[1],2);
    poly(g,[[0,-12],[-5,4],[0,0],[5,4]],P[0]);
    for(const k of [-1,1])poly(g,[[0,L*.7],[k*7,L*.55],[k*5,L*.95],[0,L]],P[0]);g.restore();
  }
  function seal(g,x,y,r,P,turn) {
    g.save();g.translate(x,y);g.rotate(turn);
    const pts=Array.from({length:9},(_,i)=>[Math.cos(i*TAU/8)*r,Math.sin(i*TAU/8)*r]);line(g,pts,P[1],2);
    ring(g,0,0,r*.73,P[0]);
    for(let i=0;i<8;i++){g.save();g.rotate(i*TAU/8);for(let j=0;j<3;j++)line(g,[[r*.82+j*3,-5],[r*.82+j*3,5]],P[j%2],1);g.restore();}
    g.restore();
  }
  // phase: 'move' = the travelling move (cleared on cancel), 'impact' = the finishing blow (kept after release)
  function add(d,phase,delay,dur,layer,draw,extra) {
    // Bound the work for crowded fights.
    const nodes=FX.list.filter(n=>n.ascended);
    if(nodes.length>=72)FX.list.splice(FX.list.indexOf(nodes[0]),1);
    FX.list.push({ascended:true,owner:d.id,phase,t0:performance.now()+delay,dur,layer,draw,...extra});
  }
  // one-shot particles / shake at a moment of the move, run by FX.update (never timers, never inside a draw)
  const cue=(d,at,fn)=>add(d,'move',at,60,'cue',()=>{},{cue:fn});
  const shakeMine=(d,v)=>{if(window.G&&d.id===G.myId)FX.shake=Math.max(FX.shake,v);};
  const clearMove = (id,all) => { FX.list=FX.list.filter(n=>!(n.ascended&&n.owner===id&&(all||n.phase==='move'))); };

  // ------------------------------------------------------------ the two moves (no long channel)
  //   star   (key 0, Lv.120): dash to the aimed spot and trace a five-pointed star through it, a hit per line,
  //                           then leap and land in its heart for the finishing blow
  //   ascend (key -, Lv.130): crouch, soar into the sky above the spot, eight afterimages strike in from a ring,
  //                           then a meteor dive into the centre
  // After the finishing blow the body blinks home: the server never moves the caster.
  const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-Math.pow(1-clamp(v),3),easeIn=v=>Math.pow(clamp(v),3);
  const easeIO=n=>(n=clamp(n),n<.5?2*n*n:1-Math.pow(-2*n+2,2)/2);
  const STAR=[0,2,4,1,3,0],SKY=230;
  const starR=r=>Math.min(r.R*.62,150);
  const vtx=(r,i)=>{const th=-Math.PI/2+(i%5)*TAU/5,R=starR(r);return [r.zx+Math.cos(th)*R,r.zy+Math.sin(th)*R*.62];};
  const lerp=(a,b,q)=>[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q],ang=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
  // home -> spot direction; when the spot is under the caster's feet, the way the caster faces
  const fwd=r=>{const dx=r.zx-r.hx,dy=r.zy-r.hy,L=Math.hypot(dx,dy);return L>1?[dx/L,dy/L]:[Math.cos(r.a||0),Math.sin(r.a||0)];};
  const at=(p,lift,face,phase,extra)=>({x:p[0],y:p[1],lift,face,phase,...extra});
  // corners of the นักพรต triangle (the first on the caster's side), the ธนู arc round the foes, the ทวน spiral
  const triPt=(r,k)=>{const a=Math.atan2(r.hy-r.zy,r.hx-r.zx)+k*TAU/3,R=Math.min(r.R*.75,165);return [r.zx+Math.cos(a)*R,r.zy+Math.sin(a)*R*.62];};
  const arcPt=(r,u)=>{const a=Math.atan2(r.hy-r.zy,r.hx-r.zx)+u*Math.PI*1.1,R=r.R+40;return [r.zx+Math.cos(a)*R,r.zy+Math.sin(a)*R*.6];};
  const orbitPt=(r,u)=>{const a=Math.atan2(r.hy-r.zy,r.hx-r.zx)+u*TAU*1.15,R=Math.min(r.R*.7,150)-30*u;return [r.zx+Math.cos(a)*R,r.zy+Math.sin(a)*R*.55];};
  const lastHit=r=>(r.first??r.windup)+(r.hits-1)*r.gap;
  // Each move: where the caster's feet are (x, y), how high (lift), the way it faces, the part of the move (phase)
  // and, for flips / vaults, a body roll (spin). r: hx/hy = home, zx/zy = the aimed spot, R, the move timing.
  const ROUTES={
    // ดาบคู่ 120: dash in, five star lines through the spot (a hit mid-line), leap and land in its heart
    star(r,el,H,Z){
      const n=Math.min(5,r.hits),s0=Math.max(40,r.windup-r.gap/2),end=s0+n*r.gap;
      if(el<s0){const v=vtx(r,0),q=easeIO(el/s0);return at(lerp(H,v,q),Math.sin(q*Math.PI)*18,ang(H,v),'dash');}
      if(el<end){const i=Math.floor((el-s0)/r.gap),q=(el-s0-i*r.gap)/r.gap,a=vtx(r,STAR[i]),b=vtx(r,STAR[i+1]);return at(lerp(a,b,easeIO(q)),6+Math.sin(q*Math.PI)*12,ang(a,b),'strike');}
      const q=clamp((el-end)/Math.max(1,r.cast-end));return at(lerp(vtx(r,STAR[n]),Z,easeIO(q)),Math.sin(q*Math.PI)*72,Math.PI/2,'dive',{q});
    },
    // ดาบคู่ 130: crouch, soar over the spot, hover spinning while the afterimages strike, meteor dive
    ascend(r,el,H,Z){
      const up=r.windup,top=r.first-60,dive=lastHit(r)+40;
      if(el<up)return at(H,-6*Math.sin(el/up*Math.PI/2),ang(H,Z),'crouch');
      if(el<top){const q=(el-up)/(top-up);return at(lerp(H,Z,easeIO(q)),SKY*ease(q),ang(H,Z),'soar');}
      if(el<dive)return at(Z,SKY+Math.sin(el/90)*6,el/55,'hover');
      const q=clamp((el-dive)/Math.max(1,r.cast-dive));return at(Z,SKY*(1-easeIn(q)),Math.PI/2,'dive',{q});
    },
    // ธนู 120: a back-flip up and away from the foes, hang in the air loosing the volleys, land
    volley(r,el,H,Z){
      const f=fwd(r),u=[-f[0],-f[1]],B=[H[0]+u[0]*45,H[1]+u[1]*30],last=lastHit(r)+60,HIGH=95;
      if(el<r.windup)return at(H,-5*Math.sin(el/r.windup*Math.PI/2),ang(H,Z),'crouch');
      if(el<r.first){const q=(el-r.windup)/(r.first-r.windup);return at(lerp(H,B,easeIO(q)),HIGH*ease(q),ang(H,Z),'flip',{spin:-TAU*easeIO(q)*Math.sign(Math.cos(ang(H,Z))||1)});}
      if(el<last)return at(B,HIGH+Math.sin(el/70)*4,ang(B,Z),'shoot');
      const q=clamp((el-last)/Math.max(1,r.cast-last));return at(B,HIGH*(1-q*q),ang(B,Z),'land',{q});
    },
    // ธนู 130: dash to the edge of the foes, run an arc round them shooting in, leap up and aim straight down
    phoenix(r,el,H,Z){
      const a0=r.windup+100,a1=lastHit(r)+40,E=arcPt(r,1),leap=Math.min(r.cast-120,a1+130),HIGH=150;
      if(el<r.windup)return at(H,-4,ang(H,Z),'crouch');
      if(el<a0){const v=arcPt(r,0),q=easeIO((el-r.windup)/(a0-r.windup));return at(lerp(H,v,q),Math.sin(q*Math.PI)*16,ang(H,v),'dash');}
      if(el<a1){const u=(el-a0)/(a1-a0),q=arcPt(r,u);return at(q,4+Math.abs(Math.sin(u*TAU*2))*8,ang(q,Z),'run');}
      if(el<leap){const q=(el-a1)/(leap-a1);return at(E,HIGH*ease(q),ang(E,Z),'leap',{spin:TAU*easeIO(q)*Math.sign(Math.cos(ang(E,Z))||1)});}
      return at(E,HIGH,ang(E,Z),'aim');
    },
    // นักพรต 120: float, blink to the 3 corners planting a talisman at each, rise over the heart, slam the seal
    array(r,el,H,Z){
      const hop=k=>r.first-80+k*r.gap,rise=hop(3),drop=r.cast-70,FLOAT=22,HIGH=80;
      if(el<hop(0))return at(H,FLOAT*ease(el/hop(0)),ang(H,Z),'float');
      if(el<rise){const k=Math.min(2,Math.floor((el-hop(0))/r.gap)),q=(el-hop(k))/r.gap,T=triPt(r,k);return at(T,FLOAT+Math.sin(q*Math.PI)*8,ang(T,Z),'seal');}
      if(el<drop){const q=easeIO((el-rise)/(drop-rise));return at(lerp(triPt(r,2),Z,q),FLOAT+(HIGH-FLOAT)*q,el/120,'rise');}
      const q=clamp((el-drop)/70);return at(Z,HIGH*(1-q*q),Math.PI/2,'slam',{q});
    },
    // นักพรต 130: step forward and levitate in place (the giant spirit does the fighting), then drop with the palm
    mandala(r,el,H,Z){
      const u=fwd(r),F=[H[0]+u[0]*30,H[1]+u[1]*20],drop=r.cast-90,HIGH=75;
      if(el<r.windup)return at(lerp(H,F,el/r.windup),12*el/r.windup,ang(H,Z),'float');
      if(el<drop){const q=(el-r.windup)/(drop-r.windup);return at(F,12+(HIGH-12)*ease(q)+Math.sin(el/120)*3,ang(F,Z)+Math.sin(el/260)*.6,'levitate');}
      const q=clamp((el-drop)/90);return at(F,HIGH*(1-q*q),ang(F,Z),'slam',{q});
    },
    // ทวน 120: lean back, charge in, pole-vault high over the spot spinning, crash down in its heart
    vault(r,el,H,Z){
      const u=fwd(r),P1=[Z[0]-u[0]*55,Z[1]-u[1]*40],land=r.cast-40,HIGH=150,dir=Math.sign(u[0])||1;   // (spot underfoot: a run-up back first)
      if(el<r.windup)return at(lerp(H,[H[0]-u[0]*10,H[1]-u[1]*6],el/r.windup),0,ang(H,Z),'crouch');
      if(el<r.first)return at(lerp(H,P1,easeIn((el-r.windup)/(r.first-r.windup))),0,ang(H,Z),'rush');
      if(el<land){const q=(el-r.first)/(land-r.first);return at(lerp(P1,Z,easeIO(q)),Math.sin(q*Math.PI)*HIGH,ang(H,Z),'vault',{spin:TAU*easeIO(q)*dir,q});}
      return at(Z,0,ang(H,Z),'crash',{q:1});
    },
    // ทวน 130: a rising dragon spiral round the spot with a thrust inward at each hit, then the javelin throw
    spiral(r,el,H,Z){
      const o0=r.windup+90,o1=lastHit(r)+40,thr=o1+90,E=orbitPt(r,1);
      if(el<r.windup)return at(H,-4,ang(H,Z),'crouch');
      if(el<o0){const v=orbitPt(r,0),q=easeIO((el-r.windup)/(o0-r.windup));return at(lerp(H,v,q),Math.sin(q*Math.PI)*10,ang(H,v),'dash');}
      if(el<o1){const u=(el-o0)/(o1-o0),q=orbitPt(r,u);return at(q,u*70,ang(q,Z),'orbit',{u});}
      if(el<thr)return at(E,70+(el-o1)/90*20,ang(E,Z),'throw');
      const q=clamp((el-thr)/Math.max(1,r.cast-thr));return at(E,90*(1-q*q),ang(E,Z),'land',{q});
    },
  };
  // แนวหน้า 120: raise the shield, charge straight through the foes (a bash on the way), leap back and slam the middle
  ROUTES.charge=(r,el,H,Z)=>{
    const u=fwd(r),F=[Z[0]+u[0]*r.R*.7,Z[1]+u[1]*r.R*.45],rush=lastHit(r)+60,land=r.cast-30,HIGH=110;
    if(el<r.windup)return at(lerp(H,[H[0]-u[0]*8,H[1]-u[1]*5],el/r.windup),0,ang(H,Z),'crouch');
    if(el<rush){const q=(el-r.windup)/(rush-r.windup);return at(lerp(H,F,easeIO(q)),Math.abs(Math.sin(q*Math.PI*4))*5,ang(H,F),'rush');}
    if(el<land){const q=(el-rush)/(land-rush);return at(lerp(F,Z,easeIO(q)),Math.sin(q*Math.PI)*HIGH,ang(F,Z),'leap',{q});}
    return at(Z,0,ang(F,Z),'crash',{q:1});
  };
  // แนวหน้า 130: crouch, soar over the spot, hold still in the sky while the shields fall, dive shield-first
  ROUTES.bastion=(r,el,H,Z)=>{
    const up=r.windup,top=r.first-80,dive=lastHit(r)+60,HIGH=200;
    if(el<up)return at(H,-6*Math.sin(el/up*Math.PI/2),ang(H,Z),'crouch');
    if(el<top){const q=(el-up)/(top-up);return at(lerp(H,Z,easeIO(q)),HIGH*ease(q),ang(H,Z),'soar');}
    if(el<dive)return at(Z,HIGH+Math.sin(el/110)*4,ang(H,Z),'hover');
    const q=clamp((el-dive)/Math.max(1,r.cast-dive));return at(Z,HIGH*(1-easeIn(q)),Math.PI/2,'dive',{q});
  };
  // เทวทัณฑ์ 120: dash in, six cuts along a six-pointed star round the spot (three of them through its heart),
  // then leap and plant the sword in the middle
  const HEX=[0,3,1,4,2,5,0];
  const hexPt=(r,i)=>{const th=-Math.PI/2+i*TAU/6,R=Math.min(r.R*.62,140);return [r.zx+Math.cos(th)*R,r.zy+Math.sin(th)*R*.62];};
  ROUTES.judgment=(r,el,H,Z)=>{
    const n=Math.min(6,r.hits),s0=Math.max(40,(r.first??r.windup)-r.gap/2),end=s0+n*r.gap;
    if(el<s0){const v=hexPt(r,HEX[0]),q=easeIO(el/s0);return at(lerp(H,v,q),Math.sin(q*Math.PI)*14,ang(H,v),'dash');}
    if(el<end){const i=Math.floor((el-s0)/r.gap),q=(el-s0-i*r.gap)/r.gap,a=hexPt(r,HEX[i]),b=hexPt(r,HEX[i+1]);return at(lerp(a,b,easeIO(q)),4+Math.sin(q*Math.PI)*10,ang(a,b),'strike');}
    const q=clamp((el-end)/Math.max(1,r.cast-end));return at(lerp(hexPt(r,HEX[n]),Z,easeIO(q)),Math.sin(q*Math.PI)*90,Math.PI/2,'dive',{q});
  };
  // เทวทัณฑ์ 130: the same flight as the fortress (soar, hold in the sky, dive), swords fall instead of shields
  ROUTES.tribunal=ROUTES.bastion;
  S.route=(r,el)=>window.SkillArts?.ritualRoute(r,el)||(ROUTES[r.move]||ROUTES.star)(r,el,[r.hx,r.hy],[r.zx,r.zy]);
  const BLINK=140;                                             // landing spot -> home after the finishing blow
  function spot(r,el){
    if(el<r.cast)return S.route(r,el);
    const q=easeIO((el-r.cast)/BLINK),E=S.route(r,r.cast-1);
    return {x:E.x+(r.hx-E.x)*q,y:E.y+(r.hy-E.y)*q,lift:E.lift*(1-q),face:Math.atan2(r.zy-r.hy,r.zx-r.hx),phase:q<1?'blink':'done'};
  }
  S.active = (e,t=performance.now()) => !!(e?.ritual && t<e.ritual.until && !e.dead);
  // ready drawing (0), drawn / raised (1, the spear keeps 0) and the strike drawing for everything else
  const READY=new Set(['crouch','float','levitate']),AIM=new Set(['soar','hover','leap','aim','flip','throw','rise','seal']);
  const FAST=new Set(['dash','strike','soar','rush','run','orbit']),LAND=new Set(['dive','land','slam','crash']);
  S.frame = (e,t) => {
    if(!S.active(e,t))return null;
    const r=e.ritual,pt=spot(r,t-r.t0),strike=e.cls==='spearman'?1:2;
    if(pt.phase==='done')return {atk:true,dir:r.dir,frame:strike};
    const frame=READY.has(pt.phase)?0:AIM.has(pt.phase)?(e.cls==='spearman'?0:1):strike;
    return {atk:true,dir:C.dirFromAngle(pt.face),frame};
  };
  S.pose = (e,t,o) => {
    const r=e.ritual,pt=spot(r,t-r.t0);
    o.dx+=pt.x-e.x;o.dy+=pt.y-e.y;o.lift+=pt.lift;
    const fast=FAST.has(pt.phase);
    o.roll=pt.spin!==undefined?pt.spin:(fast?.08:pt.phase==='dive'?.14:0)*Math.cos(pt.face);   // flips / vaults turn over
    if(fast){o.sx=1.07;o.sy=.95;}
    else if(pt.phase==='crouch'){o.sx=1.08;o.sy=.9;}
    else if(LAND.has(pt.phase)&&pt.q>.85||pt.phase==='blink'){o.sx=1.12;o.sy=.88;}
    return o;
  };
  // the class weapon pointing along `ang` (blades / arrows / talismans / the spear's blade)
  function weapon(g,cls,x,y,ang,L,P){
    if(cls==='archer')return arrow(g,x,y,ang+Math.PI/2,L,P);
    if(cls==='taoist'){g.save();g.translate(x,y);g.rotate(ang);poly(g,[[-L*.28,-L*.17],[L*.28,-L*.17],[L*.28,L*.17],[-L*.28,L*.17]],'#f6e7b8',P[0]);
      line(g,[[-L*.14,0],[L*.14,0]],P[2],2);line(g,[[0,-L*.1],[0,L*.1]],P[2],1.5);g.restore();return;}
    if(cls==='warrior')return shield(g,x,y,ang+Math.PI/2,L,P);
    blade(g,x,y,ang+Math.PI/2,L,P);
  }
  function sparkle(g,x,y,R,P,rot){
    g.save();g.translate(x,y);g.rotate(rot);g.globalCompositeOperation='lighter';
    for(const [r,c] of [[R,P[0]],[R*.55,P[1]]]){const k=r*.18;poly(g,[[r,0],[k,k],[0,r],[-k,k],[-r,0],[-k,-k],[0,-r],[k,-k]],c);}
    g.restore();
  }
  function cut(g,x,y,ang,L,P){                                 // a tapered line of light through (x, y)
    g.save();g.translate(x,y);g.rotate(ang);
    const gr=g.createLinearGradient(-L,0,L,0);gr.addColorStop(0,P[0]+'00');gr.addColorStop(.5,P[1]);gr.addColorStop(1,P[0]+'00');
    poly(g,[[-L,0],[0,-6],[L,0],[0,6]],gr);g.restore();
  }
  // the body's own streak: the last stretch of the route as a ribbon of light, the weapon held out in front
  function trail(d,r,P,from,cls){
    add(d,'move',from,r.cast-from,'top',(g,p)=>{
      const el=from+p*(r.cast-from),pts=[];
      for(let i=0;i<10;i++){const q=S.route(r,Math.max(0,el-i*10));pts.push([q.x,q.y-28-q.lift]);}
      const q=S.route(r,el);g.save();g.globalCompositeOperation='lighter';
      line(g,pts,P[0]+'aa',12);line(g,pts,P[1],3.5);weapon(g,cls,pts[0][0]+Math.cos(q.face)*18,pts[0][1]+Math.sin(q.face)*18,q.face,44,P);g.restore();
    });
  }
  function starMove(d,r,P,e){
    const n=Math.min(5,r.hits),s0=Math.max(40,r.windup-r.gap/2),R=r.R;
    // the danger edge: the full server damage radius
    add(d,'move',0,r.cast,'ground',(g)=>{g.save();g.globalAlpha*=.5;g.setLineDash([9,7]);ring(g,d.x,d.y,R,P[0],1.6);g.setLineDash([]);g.restore();});
    // the star burns into the ground line by line, then a circle closes round it and the star fills with light
    add(d,'move',0,r.cast+900,'ground',(g,p)=>{
      const el=p*(r.cast+900);g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/900;
      for(let i=0;i<n;i++){
        const q=clamp((el-s0-i*r.gap)/r.gap);if(!q)break;
        const a=vtx(r,STAR[i]),b=vtx(r,STAR[i+1]),m=[a[0]+(b[0]-a[0])*ease(q),a[1]+(b[1]-a[1])*ease(q)];
        line(g,[a,m],P[0],9);line(g,[a,m],P[1],2.5);
      }
      const done=clamp((el-s0-n*r.gap)/160);
      if(done){
        g.globalAlpha*=done;g.save();g.translate(d.x,d.y);g.scale(1,.62);ring(g,0,0,starR(r)*1.12,P[1],2.5);ring(g,0,0,starR(r)*1.24,P[0],1.2);g.restore();
        g.beginPath();[0,2,4,1,3].forEach((k,i)=>{const v=vtx(r,k);i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1]);});g.closePath();g.fillStyle=P[0]+'40';g.fill();
      }g.restore();
    });
    trail(d,r,P,0,d.cls);
    // afterimages hold every point of the star
    for(let i=0;i<=n;i++){
      const v=vtx(r,STAR[i]);
      add(d,'move',s0+i*r.gap,560,'top',(g,p)=>{if(window.drawGhost&&e)drawGhost(e,v[0],v[1],.45*(1-p),P[0],g,'lighter');sparkle(g,v[0],v[1]-34,13*(1-p*.5),P,p*3);});
    }
    // every line crosses the centre: a cut of light and sparks there
    for(let i=0;i<n;i++){
      const at=r.windup+i*r.gap,a=vtx(r,STAR[i]),b=vtx(r,STAR[i+1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
      add(d,'move',at,320,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;cut(g,d.x,d.y-18,ang,R*.6*ease(p*4),P);glow(g,d.x,d.y-18,60,P,.6);g.restore();});
      cue(d,at,()=>{FX.burst(d.x,d.y-18,14,[P[0],P[1],'#ffffff'],{angle:ang,spread:1.6,speed:230,life:380,size:2,spark:true});shakeMine(d,3);});
    }
  }
  function ascendMove(d,r,P,e){
    const R=r.R,first=r.first??r.windup,dive=first+(r.hits-1)*r.gap+40;
    // the danger edge, and a sigil that tightens towards the centre as the dive comes
    add(d,'move',0,r.cast,'ground',(g,p)=>{
      g.save();g.globalAlpha*=.45+.45*p;g.setLineDash([9,7]);ring(g,d.x,d.y,R,P[0],1.8);g.setLineDash([]);
      g.translate(d.x,d.y);g.scale(1,.55);g.rotate(p*3);const k=.92-.55*p;ring(g,0,0,R*k,P[1],2);
      for(let i=0;i<8;i++){const a=i*TAU/8;line(g,[[Math.cos(a)*R*.92,Math.sin(a)*R*.92],[Math.cos(a)*R*k,Math.sin(a)*R*k]],P[0],1.5);}g.restore();
    });
    // the crouch gathers light, the soar leaves a column of it behind
    add(d,'move',0,r.windup+80,'top',(g,p)=>{glow(g,r.hx,r.hy-30,40+p*30,P,.7*p);});
    add(d,'move',r.windup,first+60-r.windup,'top',(g,p)=>{
      const q=S.route(r,r.windup+p*(first+60-r.windup)),y=q.y-28-q.lift;g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p*.6;
      const gr=g.createLinearGradient(0,r.hy,0,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'cc');poly(g,[[r.hx-14,r.hy],[r.hx+14,r.hy],[q.x+8,y],[q.x-8,y]],gr);g.restore();
    });
    trail(d,r,P,r.windup,d.cls);
    // in the sky: a halo and eight weapons wheeling round the body, each one leaves as an afterimage
    add(d,'move',first-80,dive-first+80,'top',(g,p)=>{
      const x=d.x,y=d.y-28-SKY;glow(g,x,y,110,P,.75);g.save();g.translate(x,y);g.scale(1,.6);ring(g,0,0,70,P[1],2);g.restore();
      for(let i=0;i<r.hits;i++){
        const gone=(first-80+p*(dive-first+80))>first+i*r.gap-130;if(gone)continue;
        const a=i*TAU/r.hits+p*4;weapon(g,d.cls,x+Math.cos(a)*70,y+Math.sin(a)*42,a+Math.PI/2,30,P);
      }
    });
    // eight afterimages: each appears on a ring round the spot and strikes into the centre on its hit
    for(let i=0;i<r.hits;i++){
      const at=first+i*r.gap,a=-Math.PI/2+i*TAU/r.hits,Q=[d.x+Math.cos(a)*R*.88,d.y+Math.sin(a)*R*.88*.55],ang=Math.atan2(d.y-Q[1],d.x-Q[0]);
      add(d,'move',at-130,360,'top',(g,p)=>{
        const el=p*360,q=easeIn(clamp(el/130)),x=Q[0]+(d.x-Q[0])*q,y=Q[1]+(d.y-Q[1])*q;
        if(window.drawGhost&&e&&el<220)drawGhost(e,x,y,.55*(1-el/360),P[0],g,'lighter');
        g.save();g.globalCompositeOperation='lighter';
        if(el<200){line(g,[[Q[0],Q[1]-28],[x,y-28]],P[1],4*(1-el/200)+.5);weapon(g,d.cls,x,y-28,ang,40,P);}
        if(el>130){const k=(el-130)/230;glow(g,d.x,d.y-22,48,P,(1-k)*.9);cut(g,d.x,d.y-22,ang+Math.PI/2,R*.4*ease(k*3),P);}
        g.restore();
      });
      cue(d,at,()=>{FX.burst(d.x,d.y-22,10,[P[0],P[1],'#ffffff'],{angle:ang,spread:1.2,speed:210,life:340,size:2,spark:true});shakeMine(d,2);});
    }
    // the meteor dive: a blazing tail from the sky to the centre
    add(d,'move',dive,r.cast-dive+60,'top',(g,p)=>{
      const q=S.route(r,Math.min(r.cast-1,dive+p*(r.cast-dive+60))),y=q.y-28-q.lift;
      g.save();g.globalCompositeOperation='lighter';const gr=g.createLinearGradient(q.x,y-180,q.x,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');
      poly(g,[[q.x-7,y-190],[q.x+7,y-190],[q.x+26,y],[q.x-26,y]],gr);glow(g,q.x,y,70,P,.95);g.restore();
    });
  }
  const chestAt=(r,el)=>{const q=S.route(r,el);return [q.x,q.y-28-q.lift];};
  const danger=(d,r,P)=>add(d,'move',0,r.cast,'ground',(g)=>{g.save();g.globalAlpha*=.5;g.setLineDash([9,7]);ring(g,d.x,d.y,r.R,P[0],1.6);g.setLineDash([]);g.restore();});
  // the route scorched into the ground between two moments
  const groundPath=(d,r,P,from,to,w=6)=>add(d,'move',from,r.cast+600-from,'ground',(g,p)=>{
    const el=from+p*(r.cast+600-from),pts=[];for(let t=from;t<=Math.min(el,to);t+=12){const q=S.route(r,t);pts.push([q.x,q.y]);}
    if(pts.length<2)return;g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/600;
    line(g,pts,P[0]+'aa',w);line(g,pts,P[1],w*.3);g.restore();
  });
  const flare=(d,x,y,at,P,size=40,ms=300)=>add(d,'move',at,ms,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;glow(g,x,y,size,P,.8);sparkle(g,x,y,size*.4*(1-p*.4),P,p*2);g.restore();});
  const spark=(d,x,y,at,P,n,o={})=>cue(d,at,()=>{FX.burst(x,y,n,[P[0],P[1],'#ffffff'],{speed:220,life:380,size:2,spark:true,...o});shakeMine(d,o.shake||2);});
  function featherWing(g,x,y,side,span,P,open){
    for(let k=5;k>=0;k--){const xx=x+side*span*(.45+k*.11)*open,yy=y-span*.35+k*span*.08;
      g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+side*span*.3,y-span*.5,xx*.6+x*.4,yy-span*.15,xx,yy);g.quadraticCurveTo(xx*.6+x*.4,yy+span*.25,x+side*6,y+8);g.closePath();
      g.fillStyle=k%2?P[1]+'99':P[0]+'aa';g.fill();}
  }
  const MOVES={
    star:starMove,ascend:ascendMove,
    // เทวทัณฑ์ 120: each cut burns into the ground, a sword flash at every hit, the star closes on the dive
    judgment(d,r,P,e){
      const n=Math.min(6,r.hits),s0=Math.max(40,(r.first??r.windup)-r.gap/2),end=s0+n*r.gap;
      danger(d,r,P);groundPath(d,r,P,s0,end,7);trail(d,r,P,0,'arbiter');
      for(let i=0;i<n;i++){
        const hit=(r.first??r.windup)+i*r.gap,a=hexPt(r,HEX[i]),b=hexPt(r,HEX[i+1]),m=lerp(a,b,.5),face=ang(a,b);
        add(d,'move',hit-30,320,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;
          cut(g,m[0],m[1]-24,face,70*ease(p*3),P);blade(g,m[0],m[1]-26,face+Math.PI/2,34,P);g.restore();});
        flare(d,b[0],b[1]-10,hit+r.gap/2,P,26,260);spark(d,m[0],m[1]-22,hit,P,10,{angle:face,spread:1.1,shake:2});
      }
      add(d,'move',end,r.cast-end+600,'ground',(g,p)=>{   // the six points light up into one sigil before the sword lands
        g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=Math.min(1,p*4)*(1-p*.6);
        const pts=Array.from({length:6},(_,i)=>hexPt(r,i));
        for(const k of [0,1])line(g,[pts[k],pts[k+2],pts[k+4],pts[k]],P[k],2.5);
        for(const [x,y] of pts)sparkle(g,x,y,8,P,p*3);g.restore();
      });
    },
    // เทวทัณฑ์ 130: wings open in the sky, seven swords of light fall round the spot one per hit, the dive with a giant sword
    tribunal(d,r,P,e){
      const first=r.first??r.windup,dive=lastHit(r)+60,HIGH=200,Q=i=>{const a=-Math.PI/2+i*TAU/r.hits;return [d.x+Math.cos(a)*r.R*.82,d.y+Math.sin(a)*r.R*.82*.55];};
      danger(d,r,P);trail(d,r,P,r.windup,'arbiter');
      add(d,'move',0,r.windup+80,'top',(g,p)=>{glow(g,r.hx,r.hy-30,40+p*30,P,.7*p);});
      add(d,'move',first-120,dive-first+120,'top',(g,p)=>{        // the wings and a halo over the spot while the swords fall
        const x=d.x,y=d.y-28-HIGH,open=ease(p*3);g.save();g.globalCompositeOperation='lighter';glow(g,x,y,100,P,.7);
        for(const side of [-1,1])featherWing(g,x,y,side,110,P,open);g.translate(x,y-40);g.scale(1,.35);ring(g,0,0,26,P[1],2);g.restore();
      });
      add(d,'move',0,r.cast,'ground',(g,p)=>{g.save();g.globalAlpha*=.4+.5*p;g.translate(d.x,d.y);g.scale(1,.55);ring(g,0,0,r.R*.82,P[1],2);
        for(let i=0;i<r.hits;i++){const a=-Math.PI/2+i*TAU/r.hits;line(g,[[0,0],[Math.cos(a)*r.R*.82*p,Math.sin(a)*r.R*.82*p]],P[0]+'88',1.5);}g.restore();});
      for(let i=0;i<r.hits;i++){
        const hit=first+i*r.gap,[x,y]=Q(i);
        add(d,'move',hit-140,r.cast+600-(hit-140),'top',(g,p)=>{   // it drops from the sky, then stands until the finale fades
          const elapsed=p*(r.cast+600-(hit-140)),el=hit-140+elapsed,fall=easeIn(clamp(elapsed/140)),yy=y-30-(1-fall)*260;
          g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/600;
          if(fall<1){const gr=g.createLinearGradient(x,yy-120,x,yy);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'aa');line(g,[[x,yy-120],[x,yy]],gr,8);}
          glow(g,x,yy,34,P,.45);ArbiterLook.drawJudgmentBlade(g,x,yy+30,94,d.f);g.restore();
        },{arbiterSword:true,hitAt:hit,fallDuration:140});
        spark(d,x,y,hit,P,10,{up:60,grav:300,shake:3});
        add(d,'move',hit,500,'ground',(g,p)=>{g.save();g.globalAlpha*=1-p;g.translate(x,y);g.scale(1,.5);ring(g,0,0,10+p*40,P[1],3*(1-p)+.5);g.restore();});
      }
      add(d,'move',dive,r.cast-dive+60,'top',(g,p)=>{                 // the dive: a blazing tail, the giant sword first
        const q=S.route(r,Math.min(r.cast-1,dive+p*(r.cast-dive+60))),y=q.y-28-q.lift;
        g.save();g.globalCompositeOperation='lighter';const gr=g.createLinearGradient(q.x,y-180,q.x,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');
        poly(g,[[q.x-8,y-190],[q.x+8,y-190],[q.x+28,y],[q.x-28,y]],gr);glow(g,q.x,y+20,70,P,.95);blade(g,q.x,y+70,Math.PI,96,P);g.restore();
      });
    },
    // ธนู 120: the flip, then each volley falls on its own star of a constellation drawn on the ground
    volley(d,r,P,e){
      const n=r.hits,S0=i=>{const a=i*2.399+.4,k=r.R*.62*Math.sqrt((i+.5)/n);return [d.x+Math.cos(a)*k,d.y+Math.sin(a)*k*.55];};
      danger(d,r,P);trail(d,r,P,r.windup,d.cls);
      add(d,'move',0,r.cast+800,'ground',(g,p)=>{
        const el=p*(r.cast+800);g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/800;
        const lit=[];for(let i=0;i<n;i++)if(el>=r.first+i*r.gap+70)lit.push(S0(i));
        if(lit.length>1){line(g,lit,P[0],5);line(g,lit,P[1],1.5);}
        for(const [x,y] of lit){glow(g,x,y,22,P,.8);sparkle(g,x,y,9,P,el/200);}g.restore();
      });
      for(let i=0;i<n;i++){
        const shot=r.first+i*r.gap,[x0,y0]=chestAt(r,shot),[x1,y1]=S0(i);
        add(d,'move',shot,180,'top',(g,p)=>{
          const q=easeIn(clamp(p*1.6));g.save();g.globalCompositeOperation='lighter';
          for(const k of [-1,0,1]){const tx=x1+k*16,ty=y1+k*6,x=x0+(tx-x0)*q,y=y0+(ty-y0)*q-Math.sin(q*Math.PI)*40,a=Math.atan2(ty-y0,tx-x0);
            line(g,[[x0+(tx-x0)*Math.max(0,q-.3),y0+(ty-y0)*Math.max(0,q-.3)],[x,y]],P[0]+'88',2.5);arrow(g,x,y,a+Math.PI/2,30,P);}
          g.restore();
        });
        flare(d,x1,y1,shot+70,P,36);spark(d,x1,y1,shot+70,P,10);
      }
    },
    // ธนู 130: the arc round the foes loosing arrows inward, then the leap, wings and a phoenix arrow straight down
    phoenix(d,r,P,e){
      danger(d,r,P);groundPath(d,r,P,r.windup+100,lastHit(r)+40,5);trail(d,r,P,r.windup,d.cls);
      for(let i=0;i<r.hits;i++){
        const shot=(r.first??r.windup)+i*r.gap,[x0,y0]=chestAt(r,shot-40),a=Math.atan2(d.y-20-y0,d.x-x0);
        add(d,'move',shot-40,120,'top',(g,p)=>{const q=easeIn(clamp(p*1.5)),x=x0+(d.x-x0)*q,y=y0+(d.y-20-y0)*q;g.save();g.globalCompositeOperation='lighter';
          line(g,[[x0,y0],[x,y]],P[0]+'99',3);arrow(g,x,y,a+Math.PI/2,34,P);g.restore();});
        flare(d,d.x,d.y-20,shot,P,30,220);spark(d,d.x,d.y-20,shot,P,8,{angle:a,spread:1.4});
      }
      const leap=lastHit(r)+40,fly=r.cast-120,[ex,ey]=chestAt(r,r.cast-1);
      add(d,'move',leap,r.cast-leap,'top',(g,p)=>{                 // phoenix wings open on the archer's back
        const el=leap+p*(r.cast-leap),[x,y]=chestAt(r,el),open=ease((el-leap)/150);g.save();g.globalCompositeOperation='lighter';
        glow(g,x,y,60*open,P,.7);for(const side of [-1,1])featherWing(g,x,y-6,side,70,P,open);g.restore();
      });
      add(d,'move',fly,140,'top',(g,p)=>{                          // the phoenix arrow dives into the heart of the foes
        const q=easeIn(clamp(p*1.15)),x=ex+(d.x-ex)*q,y=ey+(d.y-ey)*q,a=Math.atan2(d.y-ey,d.x-ex);g.save();g.globalCompositeOperation='lighter';
        const gr=g.createLinearGradient(ex,ey,x,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');line(g,[[ex,ey],[x,y]],gr,14);
        g.translate(x,y);g.rotate(a);glow(g,0,0,40,P,.9);for(const side of [-1,1])featherWing(g,-10,0,side,40,P,1);g.rotate(Math.PI/2);arrow(g,0,0,0,60,P);g.restore();
      });
    },
    // นักพรต 120: blinks in puffs of talisman paper, a talisman planted at each corner, the triangle closes,
    // its lines feed the caster rising over the heart
    array(d,r,P,e){
      danger(d,r,P);
      const hop=k=>r.first-80+k*r.gap,T=k=>triPt(r,k),plant=k=>hop(k)+80,rise=hop(3);
      for(let k=0;k<3;k++){
        const [x,y]=T(k),from=k?T(k-1):[r.hx,r.hy];
        add(d,'move',hop(k),260,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;   // vanish here, appear there
          for(const [px,py] of [from,[x,y]]){ring(g,px,py-30,10+p*34,P[1],2);for(let i=0;i<6;i++){const a=i*TAU/6+p*3;weapon(g,'taoist',px+Math.cos(a)*(14+p*26),py-30+Math.sin(a)*(14+p*26),a,16,P);}}
          g.restore();});
        add(d,'move',plant(k),r.cast+500-plant(k),'top',(g,p)=>{   // the talisman stands at its corner, a beam rising from it
          const el=plant(k)+p*(r.cast+500-plant(k));g.save();g.globalAlpha*=el>r.cast?1-(el-r.cast)/500:Math.min(1,p*8);
          const gr=g.createLinearGradient(0,y-150,0,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'aa');poly(g,[[x-6,y-150],[x+6,y-150],[x+12,y],[x-12,y]],gr);
          g.save();g.translate(x,y-38);g.rotate(Math.sin(el/150)*.15);poly(g,[[-11,-26],[11,-26],[11,26],[-11,26]],'#f6e7b8',P[0]);
          for(let i=0;i<3;i++)line(g,[[-6,-16+i*12],[6,-12+i*12]],P[2],2);g.restore();
          if(el>=rise&&el<r.cast){const [cx,cy]=chestAt(r,el);g.globalCompositeOperation='lighter';line(g,[[x,y-60],[cx,cy]],P[1],2.5);}
          g.restore();});
        flare(d,x,y-38,plant(k),P,40);spark(d,x,y-38,plant(k),P,12);
      }
      add(d,'move',plant(1),r.cast+500-plant(1),'ground',(g,p)=>{  // the triangle, then the seal in its heart
        const el=plant(1)+p*(r.cast+500-plant(1)),pts=[T(0),T(1)];if(el>=plant(2))pts.push(T(2),T(0));
        g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/500;line(g,pts,P[0],6);line(g,pts,P[1],2);
        if(el>=rise){const q=ease((el-rise)/(r.cast-rise));g.translate(d.x,d.y);g.scale(1,.6);seal(g,0,0,r.R*.55*q,P,el/400);}g.restore();
      });
    },
    // นักพรต 130: a giant translucent spirit of the caster rises over the spot, the 8 bagua gates light one per hit
    mandala(d,r,P,e){
      danger(d,r,P);
      const gate=i=>{const a=-Math.PI/2+i*TAU/8;return [d.x+Math.cos(a)*r.R*.8,d.y+Math.sin(a)*r.R*.8*.55];},first=r.first??r.windup;
      add(d,'move',0,r.cast+700,'ground',(g,p)=>{
        const el=p*(r.cast+700);g.save();if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/700;g.globalCompositeOperation='lighter';
        g.save();g.translate(d.x,d.y);g.scale(1,.55);g.rotate(el/900);ring(g,0,0,r.R*.8,P[1],2);ring(g,0,0,r.R*.55,P[0],1.5);seal(g,0,0,r.R*.4,P,-el/500);g.restore();
        for(let i=0;i<8;i++){const [x,y]=gate(i),lit=el>=first+i*r.gap;g.save();g.translate(x,y);
          poly(g,[[-9,-6],[9,-6],[9,6],[-9,6]],lit?P[1]+'cc':P[2]+'88',P[0]);for(let k=0;k<3;k++)line(g,[[-6,-3+k*3],[(i>>k)&1?6:-1,-3+k*3]],P[2],1.5);g.restore();
          if(lit&&el<r.cast)line(g,[[x,y],[d.x,d.y]],P[0]+'66',2);}
        g.restore();
      });
      add(d,'move',r.windup,r.cast-r.windup,'top',(g,p)=>{      // the spirit avatar: three times the caster's size
        const el=r.windup+p*(r.cast-r.windup),rise=ease((el-r.windup)/300),[cx,cy]=chestAt(r,el);
        g.save();g.globalCompositeOperation='lighter';line(g,[[cx,cy],[d.x,d.y-150*rise]],P[1]+'88',3);
        glow(g,d.x,d.y-170*rise,130,P,.55*rise);
        g.save();g.translate(d.x,d.y-215*rise);g.rotate(el/700);ring(g,0,0,56,P[1],2.5);ring(g,0,0,44,P[0],1.5);g.restore();   // halo behind its head
        if(window.drawGhost&&e){g.translate(d.x,d.y+30-40*rise);g.scale(2.8,2.8);drawGhost(e,0,0,.5*rise,P[0],g,'lighter');}
        g.restore();
      });
      for(let i=0;i<r.hits;i++){const at=first+i*r.gap,[x,y]=gate(i);flare(d,x,y-6,at,P,28,260);spark(d,d.x,d.y-20,at,P,8);}
      add(d,'move',r.cast-140,140,'top',(g,p)=>{                 // the palm comes down
        const q=easeIn(p),y=d.y-260+(240)*q;g.save();g.globalCompositeOperation='lighter';glow(g,d.x,y,90,P,.8);
        g.translate(d.x,y);g.scale(1.6,1.6);poly(g,[[-26,10],[-30,-20],[-18,-30],[-8,-44],[4,-46],[14,-40],[24,-30],[30,-12],[26,12]],P[1]+'aa',P[0]);g.restore();
      });
    },
    // ทวน 120: the charge leaves a furrow, the vault spins the spear round the body twice, the crash
    vault(d,r,P,e){
      danger(d,r,P);groundPath(d,r,P,r.windup,r.first,9);trail(d,r,P,r.first,d.cls);
      const [rx,ry]=(()=>{const q=S.route(r,r.first);return [q.x,q.y];})();
      add(d,'move',r.first,700,'ground',(g,p)=>{g.save();g.globalAlpha*=1-p;g.translate(rx,ry);g.scale(1,.5);ring(g,0,0,20+p*90,P[1],4*(1-p)+.5);ring(g,0,0,12+p*60,P[0],3*(1-p)+.5);g.restore();});
      spark(d,rx,ry-10,r.first,P,16,{up:80,grav:300,shake:4});
      for(let i=1;i<r.hits;i++){
        const hit=r.first+i*r.gap;
        add(d,'move',hit-60,240,'top',(g,p)=>{                      // a full spear wheel round the airborne body
          const [x,y]=chestAt(r,hit-60+p*240),a0=p*TAU*1.5;g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p*.6;
          g.save();g.translate(x,y);g.beginPath();g.arc(0,0,58,a0,a0+2.4);g.arc(0,0,40,a0+2.4,a0,true);g.closePath();g.fillStyle=P[0]+'77';g.fill();g.restore();
          weapon(g,'spearman',x+Math.cos(a0+2.4)*50,y+Math.sin(a0+2.4)*50,a0+2.4+Math.PI/2,60,P);g.restore();
        });
        flare(d,d.x,d.y-20,hit,P,36,260);spark(d,d.x,d.y-20,hit,P,10);
      }
      add(d,'move',r.cast-140,180,'top',(g,p)=>{                   // the spear comes down first
        const [x,y]=chestAt(r,Math.min(r.cast-1,r.cast-140+p*180));g.save();g.globalCompositeOperation='lighter';
        const gr=g.createLinearGradient(x,y-120,x,y+30);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');line(g,[[x,y-120],[x,y+30]],gr,10);g.restore();
        lance(g,x,y+60,110,P,12,d.f);
      });
    },
    // ทวน 130: a dragon rides the rising spiral, four thrusts inward, the spear hurled down from the top
    spiral(d,r,P,e){
      danger(d,r,P);groundPath(d,r,P,r.windup+90,lastHit(r)+40,6);
      add(d,'move',r.windup,r.cast-r.windup,'top',(g,p)=>{          // the dragon: its body is the route just run
        const el=r.windup+p*(r.cast-r.windup),pts=[];for(let i=0;i<20;i++)pts.push(chestAt(r,Math.max(r.windup,el-i*16)));
        g.save();g.globalCompositeOperation='lighter';line(g,pts,P[2],16);line(g,pts,P[0],10);line(g,pts,P[1],2.5);
        for(let i=3;i<pts.length-1;i+=3){const [x,y]=pts[i];poly(g,[[x-5,y],[x,y-10],[x+5,y]],P[1]+'aa');}
        const [hx,hy]=pts[0],[nx,ny]=pts[1];g.translate(hx,hy);g.rotate(Math.atan2(hy-ny,hx-nx));
        poly(g,[[20,0],[4,-10],[-14,-10],[-8,0],[-14,10],[4,10]],P[0],P[1]);for(const k of [-1,1])line(g,[[-4,k*7],[-18,k*20],[-6,k*11]],P[1],2.5);glow(g,6,-3,9,P,.9);
        g.restore();
      });
      for(let i=0;i<r.hits;i++){
        const hit=(r.first??r.windup)+i*r.gap,[x0,y0]=chestAt(r,hit-30),a=Math.atan2(d.y-20-y0,d.x-x0);
        add(d,'move',hit-30,160,'top',(g,p)=>{const q=ease(clamp(p*2)),x=x0+(d.x-x0)*q*.8,y=y0+(d.y-20-y0)*q*.8;g.save();g.globalCompositeOperation='lighter';
          line(g,[[x0,y0],[x,y]],P[1],5*(1-p)+1);weapon(g,'spearman',x,y,a,58,P);g.restore();});
        flare(d,d.x,d.y-20,hit,P,34,260);spark(d,d.x,d.y-20,hit,P,10,{angle:a,spread:1.2});
      }
      const thr=lastHit(r)+130,[ex,ey]=chestAt(r,thr);
      add(d,'move',thr,r.cast-thr+40,'top',(g,p)=>{                 // the javelin
        const q=easeIn(clamp(p*1.1)),x=ex+(d.x-ex)*q,y=ey+(d.y-ey)*q,a=Math.atan2(d.y-ey,d.x-ex);g.save();g.globalCompositeOperation='lighter';
        const gr=g.createLinearGradient(ex,ey,x,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');line(g,[[ex,ey],[x,y]],gr,12);glow(g,x,y,40,P,.9);
        weapon(g,'spearman',x,y,a,90,P);g.restore();
      });
    },
    // แนวหน้า 120: a furrow behind the charge, the raised shield in front of the body, a bash flash at every hit
    charge(d,r,P,e){
      const rush=lastHit(r)+60;
      danger(d,r,P);groundPath(d,r,P,r.windup,rush,10);trail(d,r,P,r.windup,'warrior');
      add(d,'move',r.windup,rush-r.windup,'top',(g,p)=>{
        const q=S.route(r,r.windup+p*(rush-r.windup)),x=q.x+Math.cos(q.face)*30,y=q.y-32-q.lift+Math.sin(q.face)*16;
        g.save();g.globalCompositeOperation='lighter';glow(g,x,y,46,P,.8);shield(g,x,y,0,58,P);g.restore();
      });
      for(let i=0;i<r.hits;i++){
        const hit=(r.first??r.windup)+i*r.gap,[x,y]=chestAt(r,hit),q=S.route(r,hit);
        flare(d,x+Math.cos(q.face)*30,y,hit,P,40,260);spark(d,x,y,hit,P,12,{angle:q.face,spread:1.4,shake:3});
        add(d,'move',hit,520,'ground',(g,p)=>{g.save();g.globalAlpha*=1-p;g.translate(q.x,q.y);g.scale(1,.5);ring(g,0,0,14+p*70,P[1],4*(1-p)+.5);g.restore();});
      }
    },
    // แนวหน้า 130: six giant spirit shields fall round the spot one per hit, then stand as a fortress wall
    bastion(d,r,P,e){
      const first=r.first??r.windup,dive=lastHit(r)+60,Q=i=>{const a=-Math.PI/2+i*TAU/r.hits;return [d.x+Math.cos(a)*r.R*.85,d.y+Math.sin(a)*r.R*.85*.55];};
      danger(d,r,P);trail(d,r,P,r.windup,'warrior');
      add(d,'move',0,r.cast,'ground',(g,p)=>{g.save();g.globalAlpha*=.4+.5*p;g.translate(d.x,d.y);g.scale(1,.55);ring(g,0,0,r.R*.85,P[1],2);ring(g,0,0,r.R*.6*p,P[0],1.5);g.restore();});
      add(d,'move',first,r.cast+600-first,'ground',(g,p)=>{          // the wall between the fallen shields
        const el=first+p*(r.cast+600-first),pts=[];for(let i=0;i<r.hits;i++)if(el>=first+i*r.gap)pts.push(Q(i));
        if(pts.length===r.hits)pts.push(pts[0]);if(pts.length<2)return;
        g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/600;line(g,pts,P[0],7);line(g,pts,P[1],2);g.restore();
      });
      for(let i=0;i<r.hits;i++){
        const hit=first+i*r.gap,[x,y]=Q(i);
        add(d,'move',hit-140,r.cast+600-(hit-140),'top',(g,p)=>{   // it drops from the sky, then stands until the finale fades
          const el=hit-140+p*(r.cast+600-(hit-140)),fall=easeIn(clamp(el/140)),yy=y-40-(1-fall)*260;
          g.save();g.globalCompositeOperation='lighter';if(el>r.cast)g.globalAlpha*=1-(el-r.cast)/600;
          if(fall<1){const gr=g.createLinearGradient(x,yy-120,x,yy);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'aa');line(g,[[x,yy-120],[x,yy]],gr,10);}
          glow(g,x,yy,40,P,.6);shield(g,x,yy,0,86,P);g.restore();
        });
        spark(d,x,y,hit,P,10,{up:60,grav:300,shake:3});
        add(d,'move',hit,500,'ground',(g,p)=>{g.save();g.globalAlpha*=1-p;g.translate(x,y);g.scale(1,.5);ring(g,0,0,10+p*46,P[1],3*(1-p)+.5);g.restore();});
      }
      add(d,'move',dive,r.cast-dive+60,'top',(g,p)=>{                 // the dive: a blazing tail, the shield first
        const q=S.route(r,Math.min(r.cast-1,dive+p*(r.cast-dive+60))),y=q.y-28-q.lift;
        g.save();g.globalCompositeOperation='lighter';const gr=g.createLinearGradient(q.x,y-180,q.x,y);gr.addColorStop(0,P[0]+'00');gr.addColorStop(1,P[1]+'ee');
        poly(g,[[q.x-8,y-190],[q.x+8,y-190],[q.x+30,y],[q.x-30,y]],gr);glow(g,q.x,y+20,70,P,.95);shield(g,q.x,y+26,Math.PI,64,P);g.restore();
      });
    },
  };
  // the finishing blow on top of the class impact art: the star bursts / a pillar of light and a crater
  function finale(d,r,P){
    if(FINALE[r.move])return FINALE[r.move](d,r,P);
    if(r.move==='star'){
      add(d,'impact',0,1000,'top',(g,p)=>{
        const R=(40+ease(p)*r.R*.9);g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;g.translate(d.x,d.y-20);g.rotate(p*.9);
        g.beginPath();for(let i=0;i<10;i++){const rr=i%2?R*.42:R,a=-Math.PI/2+i*Math.PI/5;i?g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):g.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
        g.closePath();g.fillStyle=P[0]+'55';g.fill();g.strokeStyle=P[1];g.lineWidth=3;g.stroke();g.restore();
        sparkle(g,d.x,d.y-20,(36)*(1-p*.4),P,p);
      });
      return;
    }
    add(d,'impact',0,1100,'top',(g,p)=>{
      g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;const W=(42+20*(1-p));
      const gr=g.createLinearGradient(d.x-W,0,d.x+W,0);gr.addColorStop(0,P[0]+'00');gr.addColorStop(.5,P[1]);gr.addColorStop(1,P[0]+'00');
      g.fillStyle=gr;g.fillRect(d.x-W,d.y-420,W*2,420);g.restore();
    });
    add(d,'impact',0,1100,'ground',(g,p)=>{
      g.save();g.globalAlpha*=Math.min(1,(1-p)*2);g.translate(d.x,d.y);g.scale(1,.55);
      for(const [k,c,w] of [[1,P[1],5],[.7,P[0],3]]){ring(g,0,0,(30+ease(p)*r.R*1.3)*k,c,w*(1-p)+.5);}
      for(let i=0;i<10;i++){const a=i*TAU/10+.3,L=r.R*.8*ease(p*4);line(g,[[0,0],[Math.cos(a+.15)*L*.45,Math.sin(a+.15)*L*.45],[Math.cos(a)*L,Math.sin(a)*L]],P[2],3);}
      g.restore();
    });
  }
  const shock=(d,r,P,ms=900)=>add(d,'impact',0,ms,'ground',(g,p)=>{g.save();g.globalAlpha*=Math.min(1,(1-p)*2);g.translate(d.x,d.y);g.scale(1,.55);
    ring(g,0,0,20+ease(p)*r.R*1.2,P[1],5*(1-p)+.5);ring(g,0,0,12+ease(p)*r.R*.8,P[0],3*(1-p)+.5);g.restore();});
  const FINALE={
    volley(d,r,P){shock(d,r,P);add(d,'impact',0,900,'top',(g,p)=>{   // the constellation collapses into one bright star
      g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;for(let i=0;i<r.hits;i++){const a=i*2.399+.4,k=r.R*.62*Math.sqrt((i+.5)/r.hits)*(1-ease(p*2));
        line(g,[[d.x+Math.cos(a)*k,d.y+Math.sin(a)*k*.55-20],[d.x,d.y-20]],P[1],2);}sparkle(g,d.x,d.y-20,50*(1-p*.5),P,p*2);g.restore();});},
    phoenix(d,r,P){shock(d,r,P,1100);add(d,'impact',0,1000,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;
      glow(g,d.x,d.y-30,r.R*.7,P,.8);for(const side of [-1,1])featherWing(g,d.x,d.y-40,side,120+80*ease(p),P,1);g.restore();});},
    array(d,r,P){shock(d,r,P);add(d,'impact',0,900,'ground',(g,p)=>{g.save();g.globalAlpha*=1-p;g.translate(d.x,d.y);g.scale(1,.6);seal(g,0,0,r.R*(.55+.4*ease(p)),P,p*2);g.restore();});},
    mandala(d,r,P){shock(d,r,P,1200);add(d,'impact',0,1100,'top',(g,p)=>{   // a giant yin-yang turns and spreads
      const R=40+ease(p)*r.R*.9;g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;g.translate(d.x,d.y-20);g.rotate(p*3);g.scale(1,.6);
      g.beginPath();g.arc(0,0,R,0,TAU);g.fillStyle=P[0]+'33';g.fill();g.beginPath();g.arc(0,0,R,-Math.PI/2,Math.PI/2);g.arc(0,R/2,R/2,Math.PI/2,-Math.PI/2,true);g.arc(0,-R/2,R/2,Math.PI/2,-Math.PI/2);
      g.fillStyle=P[1]+'77';g.fill();ring(g,0,0,R,P[1],3);g.restore();});},
    vault(d,r,P){shock(d,r,P);},
    spiral(d,r,P){shock(d,r,P,1200);},
    charge(d,r,P){shock(d,r,P);add(d,'impact',0,900,'top',(g,p)=>{g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;
      glow(g,d.x,d.y-30,r.R*.5,P,.8);shield(g,d.x,d.y-40-ease(p)*30,0,90+40*ease(p),P);g.restore();});},
    judgment(d,r,P){shock(d,r,P);add(d,'impact',0,1000,'top',(g,p)=>{   // the oath sword stands planted in the heart
      g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p*p;glow(g,d.x,d.y-40,r.R*.5,P,.8);
      ArbiterLook.drawJudgmentBlade(g,d.x,d.y,180,d.f);sparkle(g,d.x,d.y-20,28*(1-p*.5),P,p*2);g.restore();});},
    tribunal(d,r,P){shock(d,r,P,1300);add(d,'impact',0,1200,'top',(g,p)=>{   // a pillar of judgement and the wings spread wide
      g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;const W=36+18*(1-p);
      const gr=g.createLinearGradient(d.x-W,0,d.x+W,0);gr.addColorStop(0,P[0]+'00');gr.addColorStop(.5,P[1]+'70');gr.addColorStop(1,P[0]+'00');
      g.fillStyle=gr;g.fillRect(d.x-W,d.y-360,W*2,360);
      ArbiterLook.drawJudgmentBlade(g,d.x,d.y,300,d.f);
      for(const side of [-1,1]){g.save();g.globalAlpha*=.45;featherWing(g,d.x+side*26,d.y-100,side,90+45*ease(p),P,1);g.restore();}g.restore();});},
    bastion(d,r,P){shock(d,r,P,1300);add(d,'impact',0,1200,'top',(g,p)=>{   // a dome of light closes over the fortress
      const R=r.R*(.6+.4*ease(p));g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;g.translate(d.x,d.y);
      g.beginPath();g.ellipse(0,0,R,R*.8,0,Math.PI,TAU);g.fillStyle=P[0]+'30';g.fill();g.strokeStyle=P[1];g.lineWidth=3;g.stroke();
      for(let i=1;i<6;i++){const a=Math.PI+i*Math.PI/6;line(g,[[0,0],[Math.cos(a)*R,Math.sin(a)*R*.8]],P[0]+'88',1.5);}g.restore();});},
  };
  S.play = d => {
    const e=G.ents.get(d.id), me=d.id===G.myId?G.me:null;
    if(d.t==='ritualCancel'){clearMove(d.id,true);window.SkillArts?.cancel(d.id,d.skill,true);if(e)e.ritual=null;if(me)me.ritual=null;return;}
    const sk=C.ALL_SKILLS[d.skill];
    if(!sk?.ritual)return;
    const spec=sk.ritual,released=d.t==='ritualRelease',t=performance.now(),P=colors(d.f,d.cls),high=sk.lvl===130;
    const casters=[...new Set([e,me].filter(Boolean))],home=e||me;
    if(released){
      clearMove(d.id,false);
      for(const c of casters){
        // a late viewer never saw the start: start the move as if it had run its full time
        if(!c.ritual||c.ritual.skill!==d.skill){const r=makeRoute(d,spec,c,t-spec.cast);c.ritual=r;}
        c.ritual.released=true;c.ritual.until=t+BLINK+(d.recovery||650);
      }
    }else{
      clearMove(d.id,true);
      for(const c of casters){c.ritual=makeRoute(d,spec,home,t);c.atk=null;c.moving=false;}
      if(me){G.order=null;me.dash=null;}
      const r=(home&&home.ritual)||makeRoute(d,spec,null,t);
      if(window.SkillArts?.handles(d.skill)){SkillArts.ritual(d,r,home);return;}
      (MOVES[spec.move]||starMove)(d,r,P,e);
      return;
    }
    const r=(home&&home.ritual)||makeRoute(d,spec,null,t-spec.cast);
    if(window.SkillArts?.handles(d.skill)){SkillArts.ritual(d,r,home);return;}
    finale(d,r,P);
    const R=r.R;                                               // the class impact art below works in the damage radius
    shakeMine(d,high?15:10);
    if(high&&window.G&&d.id===G.myId)FX.flash(P[1],320,.22);
    FX.shake=Math.max(FX.shake,high?9:5);
    FX.burst(d.x,d.y-12,high?38:24,[P[0],P[1]],{speed:high?200:150,up:90,life:900,size:2,spark:true});
    add(d,'impact',0,high?1650:1250,'top',(g,p)=>{
      g.save();g.globalAlpha*=Math.min(1,(1-p)*3);const burst=Math.min(1,p*4),N=high?20:12;
      glow(g,d.x,d.y,R*.8,P,(1-p)*.5);
      if(d.cls==='dualblade'){
        // A radial blade prison collapses into a paired crosscut.
        for(let i=0;i<N;i++){const a=i*TAU/N,rr=R*(.9-burst*.6);blade(g,d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr,a-Math.PI/2,55+high*30,P);}
        for(let j=0;j<(high?4:2);j++){
          g.save();g.translate(d.x,d.y);g.rotate(j*1.7+p*3);g.scale(1,.55);
          const rr=R*(.45+j*.12)*burst;g.beginPath();g.arc(0,0,rr,.2,Math.PI*1.4);g.arc(0,-7,rr,Math.PI*1.4,.2,true);g.closePath();g.fillStyle=P[0]+'75';g.fill();g.strokeStyle=P[1];g.lineWidth=1;g.stroke();g.restore();
        }
        for(const side of [-1,1]){g.save();g.translate(d.x,d.y-16);g.rotate(side*.65);
          const gr=g.createLinearGradient(-R,0,R,0);gr.addColorStop(0,P[0]+'00');gr.addColorStop(.5,P[1]);gr.addColorStop(1,P[0]+'00');
          poly(g,[[-R*burst,-5],[R*burst,0],[-R*burst,9]],gr);g.restore();}
      }else if(d.cls==='archer'){
        // Arrow rain followed by a feathered phoenix silhouette above the target.
        for(let i=0;i<N*2;i++){const q=Math.min(1,Math.max(0,(p-(i%5)*.025)*3)),a=i*2.399,rr=R*Math.sqrt((i+.5)/(N*2))*.92;
          const xx=d.x+Math.cos(a)*rr,yy=d.y+Math.sin(a)*rr-(1-q)*220;
          const trail=g.createLinearGradient(xx,yy-90,xx,yy);trail.addColorStop(0,P[0]+'00');trail.addColorStop(1,P[0]+'aa');line(g,[[xx,yy-90],[xx,yy]],trail,3);
          arrow(g,xx,yy,Math.PI,35+high*12,P);if(q===1)glow(g,xx,yy,13,P,.7);}
        if(high){g.save();g.translate(d.x,d.y-105);glow(g,0,0,80,P,.5);
          for(const side of [-1,1])for(let k=6;k>=0;k--){
            const xx=side*(90+k*14),yy=-85+Math.sin(p*8)*16+k*9;
            g.beginPath();g.moveTo(0,10);g.bezierCurveTo(side*40,-60,xx*.7,yy-25,xx,yy);g.quadraticCurveTo(xx*.65,yy+45,side*15,25);g.closePath();g.fillStyle=k%2?P[1]+'aa':P[0]+'bb';g.fill();g.strokeStyle=P[1];g.lineWidth=.8;g.stroke();
          }
          poly(g,[[0,22],[-9,-12],[-3,-35],[5,-38],[11,-27],[3,-20],[9,12]],P[1],P[0]);
          for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(k*4,18);g.bezierCurveTo(k*70,65,k*40,110,k*28,140);g.strokeStyle=P[k===0?1:0];g.lineWidth=3;g.stroke();}g.restore();}
      }else if(d.cls==='taoist'){
        // Lotus petals, eight trigram gates and a descending axis of light.
        seal(g,d.x,d.y,R*(.7+burst*.2),P,p*.5);
        for(let i=0;i<(high?12:8);i++){const a=i*TAU/(high?12:8);g.save();g.translate(d.x,d.y);g.rotate(a);
          const gr=g.createLinearGradient(0,0,R,0);gr.addColorStop(0,P[1]+'99');gr.addColorStop(1,P[0]+'10');
          g.beginPath();g.moveTo(0,0);g.bezierCurveTo(R*.25,-R*.26,R*.6,-R*.15,R*.82*burst,0);g.bezierCurveTo(R*.6,R*.15,R*.25,R*.26,0,0);g.fillStyle=gr;g.fill();g.strokeStyle=P[1];g.lineWidth=1;g.stroke();
          if(high){g.fillStyle=P[2]+'cc';g.fillRect(R*.57,-11,17,22);g.strokeRect(R*.57,-11,17,22);line(g,[[R*.59,-7],[R*.59+7,0],[R*.59,7]],P[1],2);}g.restore();}
        const beam=g.createLinearGradient(0,d.y-300,0,d.y);beam.addColorStop(0,P[0]+'00');beam.addColorStop(1,P[1]+'aa');poly(g,[[d.x-18,d.y-300],[d.x+18,d.y-300],[d.x+45,d.y],[d.x-45,d.y]],beam);
      }else if(d.cls==='arbiter'){
        // A ring of oath swords turns inward and closes on the target, crossed by two blades of judgement.
        for(let k=0;k<(high?2:1);k++){const n=high?12:8,rr=R*(.9-burst*.45-k*.2);
          for(let i=0;i<n;i++){const a=i*TAU/n+k*.26+p*.6;blade(g,d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr*.6-24,a-Math.PI/2,48+high*18,P);}}
        for(const side of [-1,1]){g.save();g.translate(d.x,d.y-18);g.rotate(side*.78);cut(g,0,0,0,R*burst,P);g.restore();}
        if(high){g.save();g.translate(d.x,d.y-24);g.scale(1,.5);ring(g,0,0,R*.55*burst,P[1],3);ring(g,0,0,R*.4*burst,P[0],1.5);g.restore();}
      }else if(d.cls==='warrior'){
        // A ring of tower shields slams outward round a cracked crater, the high art with a second ring.
        for(let k=0;k<(high?2:1);k++){const n=high?10:8,rr=R*(.35+k*.35+burst*.25);
          for(let i=0;i<n;i++){const a=i*TAU/n+k*.3;shield(g,d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr*.55-26,0,46+high*16,P);}}
        for(let i=0;i<12;i++){const a=i*TAU/12+.2;line(g,[[d.x,d.y],[d.x+Math.cos(a+.15)*R*.35*burst,d.y+Math.sin(a+.15)*R*.2*burst],[d.x+Math.cos(a)*R*.9*burst,d.y+Math.sin(a)*R*.5*burst]],P[i%2?2:0],3);}
      }else{
        // Giant imperial lances impale the ground, with branching fissures and a dragon coil.
        for(let i=0;i<(high?9:5);i++){const a=i*2.399,rr=i?R*.7*Math.sqrt(i/(high?9:5)):0;lance(g,d.x+Math.cos(a)*rr,d.y+Math.sin(a)*rr-(1-burst)*200,100+high*60,P,high?12:11,d.f);}
        for(let i=0;i<12;i++){const a=i*TAU/12;line(g,[[d.x,d.y],[d.x+Math.cos(a+.12)*R*.4*burst,d.y+Math.sin(a+.12)*R*.4*burst],[d.x+Math.cos(a)*R*burst,d.y+Math.sin(a)*R*burst]],P[i%2],2);}
        if(high){const pts=Array.from({length:65},(_,i)=>{const a=i/64*TAU*1.4+p*2;return[d.x+Math.cos(a)*R*.75,d.y+Math.sin(a)*R*.36-i*2];});
          line(g,pts,P[2],16);line(g,pts,P[0],11);line(g,pts,P[1],2);
          for(let i=3;i<60;i+=3){const [xx,yy]=pts[i];poly(g,[[xx-5,yy],[xx,yy-9],[xx+5,yy]],P[1]+'aa');}
          const [hx,hy]=pts.at(-1);g.save();g.translate(hx,hy);g.rotate(p*2);poly(g,[[-16,-4],[-9,-15],[8,-13],[22,-3],[12,8],[-8,9]],P[0],P[1]);
          for(const s of [-1,1])line(g,[[s*7,-8],[s*17,-24],[s*12,-28]],P[1],3);glow(g,8,-5,8,P,.8);g.restore();}
      }g.restore();
    });
  };
  function makeRoute(d,spec,c,t0){
    return {skill:d.skill,t0,cast:spec.cast,until:t0+spec.cast+BLINK+(spec.recovery||650),dir:C.dirFromAngle(d.a),a:d.a,
      hx:c?c.x:d.x,hy:c?c.y:d.y,zx:d.x,zy:d.y,R:d.radius||spec.radius,move:spec.move,windup:spec.windup,first:spec.first,hits:spec.hits,gap:spec.gap};
  }
  S.icon = (g,cls,high,f,size) => {
    const P=colors(f,cls);g.save();g.translate(size/2,size/2);g.scale(size/64,size/64);
    if(high)ring(g,0,0,28,P[1],1.4);
    if(cls==='dualblade'){blade(g,-5,13,-.6,34,P);blade(g,5,13,.6,34,P);}
    else if(cls==='archer')for(let i=-1;i<=1;i++)arrow(g,i*11,-15-Math.abs(i)*5,0,40,P);
    else if(cls==='taoist')seal(g,0,0,22,P,.2);
    else if(cls==='arbiter'){blade(g,0,22,0,46,P);for(const s of [-1,1])blade(g,s*15,16,s*.5,30,P);if(high)featherWing(g,0,-4,1,26,P,1),featherWing(g,0,-4,-1,26,P,1);}
    else if(cls==='warrior'){blade(g,9,16,.5,40,P);shield(g,-3,-1,0,high?46:40,P);if(high)for(let i=0;i<6;i++){const a=i*TAU/6;shield(g,Math.cos(a)*24,Math.sin(a)*24,a+Math.PI/2,12,P);}}
    else{blade(g,0,17,.45,44,P);line(g,[[-19,18],[-8,12],[0,22],[16,10]],P[0],2);}
    g.restore();
  };
})();
