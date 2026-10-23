// Graded skill routes in the manner of the Lv.120/130 arts: the body travels (dash, cross-step, spin, leap,
// dive) and returns home, and the art follows the path instead of covering the model. Visual only: damage,
// hit timing, reach and cooldowns stay with the server events that start each motion.
(function(){
  const K=window.SkillChoreo={},TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),mix=(a,b,p)=>a+(b-a)*p;
  const smooth=p=>p*p*(3-2*p);
  // Route key: [time fraction, distance toward the aim (share of D), lateral px, height px, roll, phase].
  // Rolls of a whole turn are flips; the route ends at home with the same whole number of turns.
  const ROUTES={
    dualblade:[
      [[.2,-.06,0,-3,-.1,'crouch'],[.42,.8,-12,6,.1,'dash'],[.62,.9,10,8,-.06,'strike'],[.82,.35,0,14,0,'leap']],
      [[.15,-.06,0,-3,-.12,'crouch'],[.32,.8,-28,6,.12,'dash'],[.48,.95,24,10,-.1,'strike'],[.64,.8,-22,18,.12,'strike'],[.84,.3,0,26,0,'leap']],
      [[.12,-.07,0,-4,-.14,'crouch'],[.27,.85,-40,8,.14,'dash'],[.4,1,32,14,-.12,'strike'],[.53,.85,-36,30,0,'spin'],[.66,.95,30,22,.1,'strike'],[.85,.3,0,36,0,'leap']],
      [[.1,-.08,0,-5,-.16,'crouch'],[.22,.75,-55,10,.16,'dash'],[.33,1.05,40,16,-.14,'strike'],[.45,.9,-50,40,0,'spin'],[.57,1,0,95,-.2,'hover'],[.7,1,0,0,.16,'dive'],[.86,.35,0,40,0,'leap']]
    ],
    spearman:[
      [[.2,-.1,0,-2,-.14,'crouch'],[.45,.85,0,4,.1,'rush'],[.6,.95,0,4,0,'strike'],[.82,.3,0,8,0,'land']],
      [[.15,-.1,0,-3,-.16,'crouch'],[.35,.85,-18,6,.1,'rush'],[.5,1,0,6,0,'strike'],[.64,.9,18,20,0,'strike'],[.84,.3,0,16,0,'leap']],
      [[.12,-.1,0,-4,-.18,'crouch'],[.28,.8,-30,6,.12,'rush'],[.4,1,0,8,0,'strike'],[.53,.9,30,46,0,'spin'],[.66,1.05,0,10,.1,'strike'],[.85,.3,0,30,0,'leap']],
      [[.1,-.12,0,-5,-.2,'crouch'],[.22,.7,-35,8,.14,'rush'],[.33,1,0,10,0,'strike'],[.48,.95,25,110,TAU,'vault'],[.62,1.05,0,0,TAU,'crash'],[.74,.9,-25,20,TAU,'strike'],[.88,.3,0,30,TAU,'leap']]
    ],
    archer:[
      [[.2,0,0,-3,-.08,'crouch'],[.45,-.12,-8,8,-.06,'aim'],[.62,-.18,0,6,-.1,'shoot'],[.82,-.08,0,4,0,'land']],
      [[.15,0,0,-3,-.08,'crouch'],[.32,-.15,-24,14,-.08,'aim'],[.48,-.2,-28,10,-.1,'shoot'],[.64,-.18,20,22,0,'shoot'],[.84,-.06,0,6,0,'land']],
      [[.12,0,0,-4,-.1,'crouch'],[.26,-.2,-30,20,-.1,'aim'],[.38,-.25,-34,24,-.12,'shoot'],[.52,-.3,0,70,-TAU,'flip'],[.66,-.3,30,50,-TAU,'shoot'],[.85,-.1,0,10,-TAU,'land']],
      [[.1,0,0,-5,-.12,'crouch'],[.2,-.2,-40,20,-.1,'aim'],[.3,-.28,-44,30,-.12,'shoot'],[.44,-.4,0,110,-TAU,'flip'],[.56,-.42,10,125,-TAU,'shoot'],[.68,-.35,45,80,-TAU,'shoot'],[.86,-.1,0,12,-TAU,'land']]
    ],
    taoist:[
      [[.2,0,0,6,-.04,'float'],[.45,.06,-10,22,.06,'seal'],[.65,.1,0,18,0,'cast'],[.84,.04,0,8,0,'land']],
      [[.15,0,0,8,-.05,'float'],[.32,.05,-24,30,.08,'seal'],[.5,.1,24,36,-.08,'seal'],[.66,.12,0,30,0,'cast'],[.86,.04,0,10,0,'land']],
      [[.12,0,0,10,-.06,'float'],[.26,.05,-35,40,.08,'seal'],[.4,.08,35,48,-.08,'seal'],[.53,.1,0,70,0,'spin'],[.68,.14,0,60,0,'cast'],[.86,.04,0,14,0,'land']],
      [[.1,0,0,12,-.06,'float'],[.2,.06,-45,50,.1,'seal'],[.32,.1,45,62,-.1,'seal'],[.45,.12,0,100,0,'spin'],[.58,.15,0,120,0,'levitate'],[.7,.2,0,40,.1,'slam'],[.86,.05,0,14,0,'land']]
    ],
    warrior:[
      [[.2,-.06,0,-4,-.12,'crouch'],[.45,.6,0,4,.1,'rush'],[.62,.7,0,0,.06,'strike'],[.84,.25,0,6,0,'land']],
      [[.15,-.08,0,-5,-.14,'crouch'],[.33,.65,-16,6,.1,'rush'],[.5,.8,0,4,.08,'strike'],[.64,.7,16,14,-.06,'strike'],[.84,.25,0,10,0,'land']],
      [[.12,-.08,0,-6,-.16,'crouch'],[.27,.7,-24,8,.12,'rush'],[.4,.85,0,6,.08,'strike'],[.53,.7,0,40,-.22,'leap'],[.66,.9,0,0,.16,'slam'],[.85,.25,0,12,0,'land']],
      [[.1,-.1,0,-6,-.18,'crouch'],[.22,.65,-30,8,.12,'rush'],[.33,.85,22,6,.08,'strike'],[.45,.75,-22,10,0,'spin'],[.57,.8,0,85,-.3,'leap'],[.7,.95,0,0,.18,'slam'],[.86,.3,0,14,0,'land']],
      // Lv.120 / 130 stages (the shield warrior's keys 0 / - are ascended arts now: ascended-skills.js)
      [[.08,-.1,0,-6,-.18,'crouch'],[.18,.6,-40,8,.12,'rush'],[.28,.85,30,6,.1,'strike'],[.38,.7,-35,12,0,'spin'],[.48,.9,35,8,.1,'strike'],[.6,.85,0,130,-.3,'leap'],[.72,1,0,0,.2,'slam'],[.86,.5,0,30,0,'leap']],
      [[.07,-.12,0,-7,-.2,'crouch'],[.15,.55,-45,8,.12,'rush'],[.23,.85,35,6,.1,'strike'],[.31,.7,-40,14,0,'spin'],[.39,.95,40,8,.1,'strike'],[.5,.8,0,170,-.35,'hover'],[.6,.85,0,200,0,'hover'],[.7,1,0,0,.22,'slam'],[.8,.9,30,10,0,'strike'],[.9,.4,0,40,0,'leap']]
    ]
  };
  // Small per-skill accents layered over the route, so skills of one class still move differently.
  const WARRIOR={
    guardSlash:[[-8,-6,0,-.14,-.06,0],[18,6,6,.16,.05,1],[6,-2,0,-.04,0,2]],
    shieldBash:[[-12,0,-2,-.1,0,0],[24,0,4,.12,0,1],[8,0,0,.04,0,2]],
    ironGuard:[[-4,0,-4,-.06,0,0],[-8,0,6,.04,0,1],[-2,0,0,0,0,1]],
    shieldSweep:[[-4,10,4,-.12,.1,0],[10,-12,14,.2,.6,1],[2,6,4,-.1,1,2]],
    battleCry:[[0,0,-4,-.08,0,0],[0,0,18,.06,0,1],[0,0,4,0,0,1]],
    sunderStrike:[[-10,8,14,-.24,-.06,0],[22,-6,22,.2,.04,1],[10,0,0,.12,0,2]],
    rallyGuard:[[0,-6,4,-.06,-.12,0],[0,6,14,.06,.12,1],[0,0,4,0,0,1]],
    earthShatter:[[-8,0,10,-.2,0,0],[0,0,48,-.32,0,1],[18,0,0,.18,0,2]],
    lastBastion:[[-6,0,-6,-.1,0,0],[-10,0,10,.06,0,1],[-2,0,0,0,0,1]]
  };
  // Spear arts each have their own route; keys marked with a higher stage appear as the skill is trained.
  const SPEAR={
    spearThrust:[[.18,-.12,0,-3,-.18,'crouch',0],[.4,.9,0,4,.12,'thrust',0],[.62,.75,0,8,0,'spin',1],[.8,.3,0,4,0,'land',0]],
    spearCrush:[[.12,-.1,0,-4,-.2,'crouch',0],[.3,.8,0,6,.1,'uppercut',0],[.45,.85,0,70,-.3,'leap',0],[.56,.9,0,100,-.5,'hover',2],[.7,1,0,0,.2,'smash',0],[.86,.55,0,24,0,'leap',1]],
    spearChain:[[.08,-.1,0,-3,-.16,'crouch',0],[.2,.85,-22,4,.1,'thrust',0],[.32,.9,22,6,-.1,'thrust',0],[.44,.95,-14,10,.08,'thrust',1],[.56,.9,0,34,0,'spin',2],[.68,1.05,0,6,.1,'thrust',0],[.86,.4,0,20,0,'leap',0]],
    spearBreak:[[.1,-.15,0,-4,-.2,'crouch',0],[.28,.7,0,6,.1,'thrust',0],[.42,.5,-30,24,0,'spin',1],[.6,1.15,0,10,0,'drill',0],[.73,1.2,0,34,0,'leap',2],[.88,.4,0,10,0,'land',0]],
    spearExecution:[[.08,-.1,0,-5,-.2,'crouch',0],[.25,.6,0,120,TAU,'vault',0],[.33,.85,0,155,TAU,'hover',2],[.42,1,0,0,TAU,'smash',0],[.57,.95,-20,6,TAU,'sweep',0],[.72,1.05,0,10,TAU,'thrust',0],[.87,.5,0,40,TAU,'leap',1]],
    spearHeart:[[.08,-.1,0,-3,-.16,'crouch',0],[.22,.85,0,4,.1,'thrust',0],[.36,.8,0,18,0,'spin',0],[.5,.85,-25,10,0,'sweep',0],[.62,.8,25,44,0,'spin',2],[.74,.9,0,8,0,'sweep',0],[.88,.35,0,16,0,'land',0]],
    spearPin:[[.1,-.1,0,-6,-.2,'crouch',0],[.28,.85,0,-2,.15,'thrust',0],[.45,.7,0,90,-.4,'leap',0],[.56,.75,0,115,-.6,'hover',2],[.7,.95,0,0,.3,'smash',0],[.86,.5,0,14,0,'land',0]],
    spearBoss:[[.08,-.12,0,-4,-.18,'crouch',0],[.22,.7,-20,6,.1,'thrust',0],[.36,.8,20,8,-.1,'thrust',0],[.47,.3,0,32,0,'spin',1],[.62,1.35,0,12,.1,'drill',0],[.75,1.4,0,52,0,'leap',2],[.88,.5,0,20,0,'land',0]],
    spearHeaven:[[.06,-.1,0,-6,-.2,'crouch',0],[.2,.7,0,20,.1,'uppercut',0],[.32,.6,0,150,TAU,'vault',0],[.42,.7,0,190,TAU,'hover',1],[.55,.95,0,0,TAU,'smash',0],[.66,.85,0,70,TAU*2,'vault',0],[.76,1,0,0,TAU*2,'smash',0],[.88,.5,0,30,TAU*2,'leap',0]]
  };
  const HITS=new Set(['thrust','uppercut','smash','sweep','drill','strike','shoot','cast','slam','crash','dive']);
  // Pin each striking key onto a server beat; the moves between are re-spaced evenly round them.
  function retime(keys,beats,dur){
    if(!beats?.length)return keys;
    const anchors=[];let b=0;
    keys.forEach((k,i)=>{if(i>0&&i<keys.length-1&&HITS.has(k[5])&&b<beats.length)anchors.push([i,Math.min(.95,beats[b++]/dur)]);});
    const fixed=[[0,0],...anchors,[keys.length-1,1]];
    for(let j=1;j<fixed.length;j++)if(fixed[j][1]<=fixed[j-1][1]+.02)fixed[j][1]=Math.min(1,fixed[j-1][1]+.02*(fixed[j][0]-fixed[j-1][0]));
    const out=keys.map(k=>k.slice());
    for(let j=1;j<fixed.length;j++){const [i0,t0]=fixed[j-1],[i1,t1]=fixed[j];for(let i=i0;i<=i1;i++)out[i][0]=t0+(t1-t0)*(i-i0)/Math.max(1,i1-i0);}
    out[out.length-1][0]=1;
    return out;
  }
  const ACCENT_TIMES=[0,.18,.43,.72,1];
  // The server already carries these casters (dash/leap), so their route stays over the moving body.
  const CARRIED=new Set(['skyfall','shadowstep','twindragon','rollshot']);
  // No target to rush: wards, rallies and blessings perform in place.
  const IN_PLACE=new Set(['ironGuard','battleCry','rallyGuard','lastBastion','mercy','aegis','might','nirvana','hawkeye','gale']);
  const MIN_DUR=[420,560,700,880,1150,1450];
  const RANGED=new Set(['archer','taoist']);
  K.routes=ROUTES;
  K.authored=id=>window.SkillDesigns?.[id]?.keys.slice(1,4)||WARRIOR[id]||null;
  // Stage 0-3 from training and evolution (+1 for skills unlocked at Lv.30+), Lv.120 = 4, Lv.130 = 5.
  K.tier=(sk,grade)=>grade>=4?grade:Math.min(3,grade+(sk.lvl>=30&&grade>0?1:0));
  // Basic attacks (about a second of cooldown) keep a short lunge so spamming them never jitters.
  K.quick=sk=>(sk.cd||0)<1200;
  K.build=(id,cls,grade,dur,o={})=>{
    const sk=C.ALL_SKILLS[id],own=K.authored(id),table=ROUTES[cls];
    if(!sk||sk.ritual||!own||!table)return null;
    const tier=K.tier(sk,grade),quick=K.quick(sk),own2=SPEAR[id]?.filter(k=>k[6]<=tier);
    const route=own2||table[Math.min(table.length-1,quick?Math.min(1,tier):tier)];
    const still=CARRIED.has(id)||IN_PLACE.has(id)||o.still;
    // Melee closes most of the gap to the target; ranged classes step back by a fixed amount.
    const D=still?0:(RANGED.has(cls)?110:Math.max(50,Math.min(190,o.D??70)))*(quick?.55:1);
    const B=own[1],side=B[1]<0?-1:1,height=Math.max(.8,Math.min(1.5,.85+B[2]/70));
    const keys=[[0,0,0,0,0,'crouch'],...route.map(k=>[k[0],k[1],k[2]*side,Math.min(200,k[3]*(k[3]>0?height:1)),k[4],k[5]])];
    const turns=Math.round(keys.at(-1)[4]/TAU)*TAU;
    keys.push([1,0,0,0,turns,'land']);
    const total=quick?dur:Math.max(dur,MIN_DUR[tier]),timed=own2?retime(keys,o.beats,total):keys;
    return {tier,keys:timed,D,own,dur:total,phases:timed.map(k=>k[5])};
  };
  K.at=(c,p)=>{
    let i=1;while(i<c.keys.length-1&&p>c.keys[i][0])i++;
    const a=c.keys[i-1],b=c.keys[i],u=smooth(clamp((p-a[0])/(b[0]-a[0])));
    return {f:mix(a[1],b[1],u),lat:mix(a[2],b[2],u),h:mix(a[3],b[3],u),roll:mix(a[4],b[4],u),phase:b[5],u,i};
  };
  function accent(c,p){
    let i=1;while(i<ACCENT_TIMES.length-1&&p>ACCENT_TIMES[i])i++;
    const keys=[[0,0,0,0,0,0],...c.own,[0,0,0,0,0,2]],u=smooth(clamp((p-ACCENT_TIMES[i-1])/(ACCENT_TIMES[i]-ACCENT_TIMES[i-1])));
    return keys[i].map((v,k)=>mix(keys[i-1][k],v,u));
  }
  // The renderer rotates about the feet: past ~30° the pivot moves smoothly up to the waist.
  const WAIST=30;
  K.waist=roll=>{const w=clamp((Math.abs(roll)-.5)/.5);return {dx:-WAIST*Math.sin(roll)*w,lift:WAIST*(1-Math.cos(roll))*w};};
  const FAST=new Set(['dash','rush','strike','dive','vault','thrust','drill','sweep','uppercut']),LAND=new Set(['land','slam','crash','dive','smash']);
  K.pose=(e,m,now,base)=>{
    const c=m.choreo,p=clamp((now-m.t0)/m.dur),k=K.at(c,p),v=accent(c,p),face=Math.cos(m.a)>=0?1:-1;
    const fwd=k.f*c.D+v[0]*.6,lat=k.lat+v[1]*.6;
    const roll=k.roll*face+v[3]*.5*face,w=K.waist(roll);
    let sx=1,sy=1;
    if(FAST.has(k.phase)&&k.u<.9){sx=1.07;sy=.95;}
    else if(k.phase==='crouch'||k.phase==='float'){sx=1.06;sy=.93;}
    else if(LAND.has(k.phase)&&k.u>.85){sx=1.12;sy=.88;}
    // นักพรต casts standing on the ground: the route still steps and sways, but never leaves the floor
    const lift=e.cls==='taoist'?0:Math.max(-8,k.h+v[2]*.4)+w.lift;
    return {...base,dx:base.dx+Math.cos(m.a)*fwd-Math.sin(m.a)*lat+w.dx,dy:base.dy+Math.sin(m.a)*fwd+Math.cos(m.a)*lat*.6,
      lift:base.lift+lift,roll:(base.roll||0)+roll,sx,sy};
  };
  const READY=new Set(['crouch','float','levitate']),RAISED=new Set(['aim','leap','hover','flip','seal','spin','vault','uppercut']);
  K.frame=(e,m,now,base)=>{
    const c=m.choreo,at=now-m.t0,k=K.at(c,clamp(at/m.dur)),strike=e.cls==='spearman'?1:2;
    // Server-timed strikes always show the strike drawing facing the aim.
    if(m.beats.some(t=>at>=t-35&&at<=t+85))return {...base,atk:true,dir:m.dir,frame:strike};
    const frame=READY.has(k.phase)?0:RAISED.has(k.phase)?(e.cls==='spearman'?0:1):strike;
    const dir=k.phase==='spin'?(m.dir+Math.round(k.u*8))%8:k.phase==='drill'?(m.dir+Math.round(k.u*16))%8:m.dir;
    return {...base,atk:true,dir,frame};
  };

  // ------------------------------------------------------------ path art (never drawn over the model)
  const WARRIOR_PALETTE={dharma:{core:'#fffbe8',main:'#f2c14e',deep:'#5b3d12',accent:'#e8e2d0',paper:'#3a2a10'},
    adharma:{core:'#ffe9d6',main:'#c8452f',deep:'#3a1414',accent:'#d9a066',paper:'#2a1414'}};
  K.palette=(cls,f)=>cls==='warrior'?WARRIOR_PALETTE[f==='adharma'?'adharma':'dharma']:SkillFX.palette(cls,f);
  const CAP=48,CHEST=30;
  let ghostFrame=-1,ghosts=0;
  // Full sprite afterimages are the expensive part: a frame budget shared by every caster on screen.
  function ghost(e,x,y,alpha,P,g){
    const f=Math.floor(performance.now()/8);if(f!==ghostFrame){ghostFrame=f;ghosts=0;}
    if(ghosts>=8||!window.drawGhost)return;ghosts++;drawGhost(e,x,y,alpha,P.main,g);
  }
  const line=(g,pts,c,w)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=c;g.lineWidth=w;g.stroke();};
  function cut(g,x,y,ang,L,w,P){
    g.save();g.translate(x,y);g.rotate(ang);const gr=g.createLinearGradient(-L,0,L,0);
    gr.addColorStop(0,P.main+'00');gr.addColorStop(.5,P.core);gr.addColorStop(1,P.main+'00');
    g.beginPath();g.moveTo(-L,0);g.quadraticCurveTo(0,-w,L,0);g.quadraticCurveTo(0,w*.35,-L,0);g.fillStyle=gr;g.fill();g.restore();
  }
  function glow(g,x,y,r,P,a){
    if(r<=0||a<=0)return;g.save();g.globalAlpha*=a;const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,P.core+'cc');gr.addColorStop(.35,P.main+'66');gr.addColorStop(1,P.main+'00');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);g.restore();
  }
  function sparkle(g,x,y,R,P,rot){
    g.save();g.translate(x,y);g.rotate(rot);
    for(const [r,c] of [[R,P.main],[R*.55,P.core]]){const k=r*.18;g.beginPath();[[r,0],[k,k],[0,r],[-k,k],[-r,0],[-k,-k],[0,-r],[k,-k]].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fillStyle=c;g.fill();}
    g.restore();
  }
  function weapon(g,cls,x,y,ang,L,P){
    g.save();g.translate(x,y);g.rotate(ang);g.beginPath();
    if(cls==='archer'){g.moveTo(L,0);g.lineTo(L-9,-5);g.lineTo(L-9,5);g.closePath();g.fillStyle=P.core;g.fill();line(g,[[-L*.6,0],[L-8,0]],P.core,2);}
    else if(cls==='taoist'){g.rect(-L*.25,-L*.16,L*.5,L*.32);g.fillStyle=P.paper||P.core;g.fill();g.strokeStyle=P.main;g.lineWidth=1.2;g.stroke();}
    else{const gr=g.createLinearGradient(-L*.4,0,L,0);gr.addColorStop(0,P.main+'00');gr.addColorStop(1,P.core);
      g.moveTo(L,0);g.lineTo(L*.55,-5);g.lineTo(-L*.4,-2);g.lineTo(-L*.4,2);g.lineTo(L*.55,5);g.closePath();g.fillStyle=gr;g.fill();}
    g.restore();
  }
  const STRIKES=HITS;
  function where(e,t){const o=G.skillPose(e,t);return {x:e.x+o.dx,y:e.y+o.dy,lift:o.lift};}
  function top(g,e,m,P,now){
    const c=m.choreo,T=c.tier,p=clamp((now-m.t0)/m.dur),here=where(e,now);
    // Light streak along the last stretch of the route, starting behind the body.
    const pts=[];for(let i=2;i<12;i++){const q=where(e,Math.max(m.t0,now-i*14));pts.push([q.x,q.y-CHEST-q.lift]);}
    const run=Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1]);
    if(run>14){g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=Math.min(1,run/60);
      line(g,pts,P.main+'55',6+T*2.5);line(g,pts,P.core+'cc',1.5+T*.5);
      // As in the twin-blade Lv.120/130 arts: the class weapon of light leads the streak.
      const ang=Math.atan2(pts[0][1]-pts[3][1],pts[0][0]-pts[3][0]);
      weapon(g,e.cls,pts[0][0]+Math.cos(ang)*10,pts[0][1]+Math.sin(ang)*10,ang,30+T*6,P);
      g.restore();}
    // Afterimages hold earlier points of the route; never drawn where the body still is.
    if(T>=1)for(let j=1;j<=Math.min(3,T);j++){
      const q=where(e,Math.max(m.t0,now-j*55));if(Math.hypot(q.x-here.x,q.y-q.lift-here.y+here.lift)<22)continue;
      ghost(e,q.x,q.y-q.lift,.2/j,P,g);
    }
    // Each strike key shows the class's own signature in front of the body at that moment.
    c.keys.forEach((k,i)=>{
      if(!STRIKES.has(k[5]))return;const t=m.t0+k[0]*m.dur,el=now-t,life=SIGN_MS[e.cls]||260;if(el<0||el>life)return;
      const q=where(e,t);g.save();g.globalCompositeOperation='lighter';
      (SIGN[e.cls]||SIGN.dualblade)(g,q.x,q.y-CHEST-q.lift,m.a,T,el/life,i,P,k[5],q.y);
      g.restore();
    });
    orbit(g,e,m,P,now,here,true);
  }
  // Class signatures, one per strike: u runs 0..1 over the signature's life.
  const SIGN_MS={dualblade:260,spearman:420,archer:320,taoist:360,warrior:320};
  const SIGN={
    // twin blades: crossing crescent cuts
    dualblade(g,x,y,a,T,u,i,P){
      x+=Math.cos(a)*30;y+=Math.sin(a)*18;g.globalAlpha*=1-u;const L=(34+T*12)*(.6+u*.6),tilt=a+(i%2?.7:-.7);
      cut(g,x,y,tilt,L,10+T*3,P);if(T>=3)cut(g,x,y,tilt+1.4*(i%2?-1:1),L*.85,8+T*2,P);if(T>=2)sparkle(g,x,y,(8+T*3)*(1-u*.5),P,u*2);
    },
    // spear: one long straight piercing beam with a spearhead; a dragon head rides the tip, then rings coil round it
    spearman(g,x,y,a,T,u,i,P,phase,gy){(SPEAR_SIGN[phase]||SPEAR_SIGN.thrust)(g,x,y,a,T,u,i,P,gy);},
    // archer: bow-release flash, the string ring and a short arrow of light leaving the bow
    archer(g,x,y,a,T,u,i,P){
      g.translate(x+Math.cos(a)*16,y+Math.sin(a)*10);g.rotate(a);g.globalAlpha*=1-u;
      g.beginPath();g.arc(-6,0,22+T*3,-1.2,1.2);g.strokeStyle=P.core;g.lineWidth=2.5+T*.6;g.stroke();
      g.save();g.scale(.35,1);g.beginPath();g.arc(0,0,(12+T*5)*(.5+u*1.4),0,TAU);g.strokeStyle=P.main;g.lineWidth=2;g.stroke();g.restore();
      for(const d of T>=2?[0,-.16,.16]:[0]){g.save();g.rotate(d);const x0=20+u*(120+T*30),L=34+T*6;
        const gr=g.createLinearGradient(x0-L*1.6,0,x0,0);gr.addColorStop(0,P.main+'00');gr.addColorStop(1,P.core);
        g.beginPath();g.moveTo(x0-L*1.6,0);g.lineTo(x0,-2);g.lineTo(x0+9,0);g.lineTo(x0,2);g.closePath();g.fillStyle=gr;g.fill();
        g.beginPath();g.moveTo(x0+12,0);g.lineTo(x0+2,-5);g.lineTo(x0+2,5);g.closePath();g.fillStyle=P.core;g.fill();g.restore();}
      if(T>=3){g.save();g.scale(.3,1);g.beginPath();g.arc(-30,0,40+T*4,0,TAU);g.strokeStyle=P.accent;g.lineWidth=2;g.stroke();g.restore();}
    },
    // taoist: a bagua talisman seal opens before the hand; a flying sword of light leaves it at stage 3+
    taoist(g,x,y,a,T,u,i,P){
      g.translate(x+Math.cos(a)*34,y+Math.sin(a)*18);g.globalAlpha*=1-u*u;const R=(16+T*6)*smooth(clamp(u*3))+1;
      for(let ring=0;ring<1+Math.min(2,T);ring++){const r=R*(1+ring*.45),spin=(ring%2?-1:1)*u*2.5;
        g.beginPath();for(let k=0;k<=8;k++){const b=k*TAU/8+spin;g.lineTo(Math.cos(b)*r,Math.sin(b)*r);}g.strokeStyle=ring?P.accent:P.core;g.lineWidth=ring?1.2:2;g.stroke();
        for(let k=0;k<8;k++){const b=(k+.5)*TAU/8+spin;for(let j=0;j<3;j++){const rr=r*(.68+j*.09);line(g,[[Math.cos(b-.16)*rr,Math.sin(b-.16)*rr],[Math.cos(b+.16)*rr,Math.sin(b+.16)*rr]],P.main,1.2);}}}
      g.fillStyle=P.paper||P.core;g.fillRect(-R*.22,-R*.42,R*.44,R*.84);line(g,[[-R*.1,-R*.25],[R*.1,-R*.1],[-R*.1,R*.05],[R*.1,R*.2]],P.main,1.4);
      if(T>=3){const d=u*(140+T*20);g.save();g.rotate(a);const gr=g.createLinearGradient(d-50,0,d+30,0);gr.addColorStop(0,P.main+'00');gr.addColorStop(1,P.core);
        g.beginPath();g.moveTo(d-50,0);g.lineTo(d+20,-4);g.lineTo(d+34,0);g.lineTo(d+20,4);g.closePath();g.fillStyle=gr;g.fill();line(g,[[d+4,-8],[d+4,8]],P.accent,2);g.restore();}
    },
    // shield warrior: a golden shield-wall arc braced before the body
    warrior(g,x,y,a,T,u,i,P){
      g.translate(x+Math.cos(a)*24,y+Math.sin(a)*14+10);g.rotate(a);g.globalAlpha*=1-u;const R=(30+T*10)*(.7+u*.5);
      for(let k=0;k<1+Math.min(2,T);k++){g.beginPath();g.ellipse(0,0,R*.4+k*6,R+k*10,0,-1.35,1.35);g.strokeStyle=k?P.main:P.core;g.lineWidth=(4-k)*(1-u*.5);g.stroke();}
      const n=T>=2?5:3;for(let k=0;k<n;k++){const b=(k/(n-1)-.5)*2.2;g.save();g.translate(Math.cos(b)*R*.42,Math.sin(b)*R);g.scale(.55,1);emblem(g,'warrior',7+T,P);g.restore();}
      if(T>=2)sparkle(g,R*.45,0,(9+T*3)*(1-u),P,u*2);
    }
  };
  // Spear moves: piercing beam, rising hook, ground smash, crescent sweep and dragon drill.
  const SPEAR_SIGN={
    thrust(g,x,y,a,T,u,i,P){
      const L=(70+T*28)*smooth(clamp(u*3)),w=5+T*2;g.globalAlpha*=1-u*u;g.translate(x+Math.cos(a)*14,y+Math.sin(a)*8);g.rotate(a+(i%3-1)*.08);
      const gr=g.createLinearGradient(0,0,L+1,0);gr.addColorStop(0,P.main+'00');gr.addColorStop(.7,P.main+'cc');gr.addColorStop(1,P.core);
      g.beginPath();g.moveTo(0,-w*.5);g.lineTo(L,-w*.25);g.lineTo(L+18+T*3,0);g.lineTo(L,w*.25);g.lineTo(0,w*.5);g.closePath();g.fillStyle=gr;g.fill();
      for(const s2 of [-1,1])line(g,[[L-4,s2*w*.3],[L-14,s2*(w+6)],[L-2,s2*w*.4]],P.accent,1.5);
      g.save();g.scale(.35,1);g.beginPath();g.arc((L+16)/.35,0,(10+T*4)*(.4+u),0,TAU);g.strokeStyle=P.core;g.lineWidth=2;g.stroke();g.restore();
      if(T>=2)dragonHead(g,L+10,0,8+T*2,P);if(u>.2)sparkle(g,L+16,0,(8+T*3)*(1-u),P,u*3);
    },
    // rising hook: an arc swept up from the ground and a column of light where it ends
    uppercut(g,x,y,a,T,u,i,P,gy){
      const fx=x+Math.cos(a)*30,R=40+T*12,sweep=smooth(clamp(u*2.5));g.globalAlpha*=1-u;
      g.save();g.translate(fx,gy-10);g.scale(Math.cos(a)>=0?1:-1,1);
      g.beginPath();g.arc(0,0,R,Math.PI*.5,Math.PI*.5-Math.PI*1.1*sweep,true);g.strokeStyle=P.core;g.lineWidth=6+T*2;g.stroke();
      g.beginPath();g.arc(0,0,R+8,Math.PI*.5,Math.PI*.5-Math.PI*1.1*sweep,true);g.strokeStyle=P.main+'99';g.lineWidth=3;g.stroke();g.restore();
      const h=(90+T*35)*sweep,gr=g.createLinearGradient(0,gy,0,gy-h);gr.addColorStop(0,P.core+'cc');gr.addColorStop(1,P.main+'00');
      g.fillStyle=gr;g.fillRect(fx-6-T,gy-h,12+T*2,h);
    },
    // ground smash: shock rings, glowing cracks, pillars of light bursting up and sparks thrown high
    smash(g,x,y,a,T,u,i,P,gy){
      const fx=x+Math.cos(a)*24,fy=gy+Math.sin(a)*14,R=(50+T*20)*(.35+smooth(clamp(u*2))*.9);
      g.save();g.translate(fx,fy);g.globalAlpha*=1-u*.9;
      g.save();g.scale(1,.38);for(let k=0;k<2+Math.min(2,T);k++){g.beginPath();g.arc(0,0,R*(1-k*.18),0,TAU);g.strokeStyle=k?P.main:P.core;g.lineWidth=(5-k)*(1-u*.6);g.stroke();}g.restore();
      const cracks=6+T*2;for(let k=0;k<cracks;k++){const b=k*TAU/cracks+i,r=R*1.15;line(g,[[0,0],[Math.cos(b+.12)*r*.45,Math.sin(b+.12)*r*.18],[Math.cos(b-.08)*r*.8,Math.sin(b-.08)*r*.32],[Math.cos(b)*r,Math.sin(b)*r*.4]],P.core,2.2*(1-u));}
      const pillars=3+T*2;for(let k=0;k<pillars;k++){const b=k*TAU/pillars+.4,px=Math.cos(b)*R*.7,py=Math.sin(b)*R*.27,h=(60+T*28)*Math.sin(Math.min(1,u*1.6)*Math.PI)*(.6+((k*7)%5)/10);
        const gr=g.createLinearGradient(0,py,0,py-h);gr.addColorStop(0,P.core);gr.addColorStop(1,P.main+'00');g.fillStyle=gr;g.fillRect(px-3-T*.5,py-h,6+T,h);}
      for(let k=0;k<6+T*3;k++){const b=-Math.PI*(.15+.7*((k*37)%11)/11),sp=(70+T*25)*u;sparkle(g,Math.cos(b)*sp,Math.sin(b)*sp*1.3+u*u*60,(3+T*.8)*(1-u),P,k);}
      glow(g,0,-8,R*.7,P,.6*(1-u));
      if(T>=3){g.globalAlpha*=.8;dragonHead(g,0,-(40+80*u),12+T*2,P,-Math.PI/2);}
      g.restore();
    },
    // crescent sweep: a broad 140° arc of light with the spear at its leading edge
    sweep(g,x,y,a,T,u,i,P){
      const R=55+T*16,side=i%2?-1:1,span=2.45,sweep=smooth(clamp(u*2.2)),from=a-side*span/2,to=from+side*span*sweep;
      g.save();g.translate(x,y+6);g.scale(1,.62);g.globalAlpha*=1-u*u;
      for(let k=0;k<1+Math.min(2,T);k++){g.beginPath();g.arc(0,0,R-k*12,from,to,side<0);g.arc(0,0,R-k*12-10-T*2,to,from,side>0);g.closePath();g.fillStyle=k?P.main+'66':P.core+'aa';g.fill();}
      g.translate(Math.cos(to)*R,Math.sin(to)*R);g.rotate(to+side*Math.PI/2);g.beginPath();g.moveTo(0,0);g.lineTo(-6,-16);g.lineTo(0,-30-T*3);g.lineTo(6,-16);g.closePath();g.fillStyle=P.core;g.fill();
      g.restore();if(T>=2&&u>.3)sparkle(g,x+Math.cos(to)*R,y+6+Math.sin(to)*R*.62,(9+T*3)*(1-u),P,u*3);
    },
    // dragon drill: a spinning spiral cone ahead of the spear
    drill(g,x,y,a,T,u,i,P){
      const L=(110+T*35)*smooth(clamp(u*2.5));g.globalAlpha*=1-u*u;g.translate(x+Math.cos(a)*12,y+Math.sin(a)*7);g.rotate(a);
      const rings=5+T*2;for(let k=0;k<rings;k++){const t=k/rings,xx=L*t,r=(18+T*4)*(1-t*.75);g.beginPath();g.ellipse(xx,0,4+r*.15,r,0,0,TAU);g.strokeStyle=k%2?P.core:P.main;g.lineWidth=2;g.stroke();}
      for(const s2 of [-1,1]){const pts=[];for(let k=0;k<=24;k++){const t=k/24,b=t*TAU*3+u*14,r=(18+T*4)*(1-t*.75);pts.push([L*t,Math.sin(b)*r*s2]);}line(g,pts,P.accent,1.6);}
      g.beginPath();g.moveTo(L,-4);g.lineTo(L+22+T*4,0);g.lineTo(L,4);g.closePath();g.fillStyle=P.core;g.fill();
      if(T>=2)dragonHead(g,L*.55,0,9+T*2,P);
    }
  };
  function dragonHead(g,x,y,s,P,rot=0){
    g.save();g.translate(x,y);g.rotate(rot);g.beginPath();g.moveTo(-s,-s*.7);g.lineTo(s*1.4,-s*.2);g.lineTo(s*.6,0);g.lineTo(s*1.4,s*.3);g.lineTo(-s,s*.7);g.closePath();
    g.fillStyle=P.main+'bb';g.fill();g.strokeStyle=P.core;g.lineWidth=1;g.stroke();
    for(const s3 of [-1,1])line(g,[[-s*.4,s3*s*.5],[-s*1.4,s3*s*1.3],[-s*1.1,s3*s*.6]],P.accent,1.6);
    g.beginPath();g.arc(s*.2,-s*.25,s*.12,0,TAU);g.fillStyle=P.core;g.fill();g.restore();
  }
  // Stage 2+: class emblems circle the body. The back half is drawn with the ground layer (behind the model),
  // the front half with the top layer, so the ring passes round the body instead of over it.
  function orbit(g,e,m,P,now,here,front){
    const T=m.choreo.tier;if(T<2)return;
    const n=Math.min(6,1+T),R=40+T*5,el=now-m.t0,fade=Math.min(1,el/200,(m.dur+300-el)/300);if(fade<=0)return;
    g.save();g.globalAlpha*=fade*.85;
    for(let i=0;i<n;i++){const b=i*TAU/n+el/1000*2.4,sin=Math.sin(b);if(front!==(sin>0))continue;
      const x=here.x+Math.cos(b)*R,y=here.y-CHEST-here.lift+sin*R*.32;
      g.save();g.translate(x,y);g.rotate(e.cls==='archer'?b+Math.PI/2:Math.cos(b)*.3);emblem(g,e.cls,8+T,P);g.restore();}
    g.restore();
  }
  function emblem(g,cls,s,P){
    g.beginPath();
    if(cls==='dualblade'){g.moveTo(0,-s*1.2);g.lineTo(s*.25,0);g.lineTo(0,s*.5);g.lineTo(-s*.25,0);}
    else if(cls==='spearman'){g.moveTo(0,-s*1.2);g.lineTo(s*.42,-s*.25);g.lineTo(s*.12,-s*.12);g.lineTo(s*.12,s*.7);g.lineTo(-s*.12,s*.7);g.lineTo(-s*.12,-s*.12);g.lineTo(-s*.42,-s*.25);}
    else if(cls==='archer'){g.moveTo(0,-s);g.quadraticCurveTo(s*.6,-s*.1,0,s*.8);g.quadraticCurveTo(-s*.6,-s*.1,0,-s);}
    else if(cls==='taoist'){g.rect(-s*.32,-s*.8,s*.64,s*1.6);}
    else{g.moveTo(-s*.55,-s*.65);g.lineTo(s*.55,-s*.65);g.lineTo(s*.5,s*.1);g.lineTo(0,s*.75);g.lineTo(-s*.5,s*.1);}
    g.closePath();g.fillStyle=cls==='taoist'?(P.paper||P.core):P.main+'cc';g.fill();g.strokeStyle=P.core;g.lineWidth=1;g.stroke();
    if(cls==='taoist')line(g,[[-s*.14,-s*.5],[s*.14,-s*.25],[-s*.14,0],[s*.14,s*.25]],P.main,1);
  }
  function ground(g,e,m,P,now){
    const c=m.choreo,T=c.tier;orbit(g,e,m,P,now,where(e,now),false);
    g.save();g.globalCompositeOperation='lighter';
    // Path burned into the ground beneath the route (stage 2+).
    if(T>=2&&c.D>0){const pts=[];for(let t=m.t0;t<=now;t+=24){const q=where(e,t);pts.push([q.x,q.y]);}
      if(pts.length>1){g.save();g.globalAlpha*=.35*(1-clamp((now-m.t0)/m.dur-.7)/.3);line(g,pts,P.main+'88',4+T);g.restore();}}
    // Rings where the body lands or slams down.
    for(const k of c.keys){
      if(!LAND.has(k[5])&&k[5]!=='crash')continue;const t=m.t0+k[0]*m.dur,el=now-t;if(el<0||el>420)continue;
      const u=el/420,q=where(e,t),R=(20+T*12)*(.4+u);
      g.save();g.translate(q.x,q.y);g.scale(1,.36);g.globalAlpha*=(1-u)*.8;
      g.beginPath();g.arc(0,0,R,0,TAU);g.strokeStyle=P.core;g.lineWidth=3*(1-u)+1;g.stroke();
      if(T>=2){g.beginPath();g.arc(0,0,R*.7,0,TAU);g.strokeStyle=P.main;g.lineWidth=2;g.stroke();}
      if(T>=3)for(let i=0;i<8;i++){const a=i*TAU/8;line(g,[[Math.cos(a)*R*.4,Math.sin(a)*R*.4],[Math.cos(a)*R*1.1,Math.sin(a)*R*1.1]],P.accent,1.5);}
      g.restore();
    }
    g.restore();
  }
  K.stage=(d,e,m)=>{
    if(!m.choreo)return;
    const P=K.palette(m.cls,d.f||e.faction),dur=m.dur+420;
    for(const layer of ['ground','top']){
      // Own cap, inside the shared 96-node performance budget of SkillPerformance.
      const mine=FX.list.filter(n=>n.choreoArt);
      if(mine.length>=CAP)FX.list.splice(FX.list.indexOf(mine[0]),1);
      while(FX.list.filter(n=>n.performanceArt).length>=96)FX.list.splice(FX.list.findIndex(n=>n.performanceArt),1);
      FX.list.push({performanceArt:true,choreoArt:true,owner:e.id,skill:m.skill,phase:'cast',t0:m.t0,dur,layer,draw(g,p){
        if(G.ents.get(e.id)!==e||e.skillMotion!==m||e.dead||e.dying||m.map!==G.mapId)return;
        const now=m.t0+p*dur;g.save();g.lineCap='round';g.lineJoin='round';
        if(layer==='ground')ground(g,e,m,P,now);else top(g,e,m,P,now);
        g.restore();
      }});
    }
  };
})();
