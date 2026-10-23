// Caster choreography and ornament, separate from authoritative damage/projectiles.
// Training (sl), unlocked evolution (r), and Lv.120/130 arts have distinct detail budgets.
(function () {
  const S=window.SkillPerformance={},TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
  const groups={
    dualblade:{slash:['fang','rend','crescent'],spin:['lotus','tempest'],dash:['shadowstep','twindragon'],dive:['skyfall'],flurry:['thousand']},
    taoist:{cast:['jade','spiritsword'],summon:['skybolt','heavens','meteor'],bless:['mercy','aegis','might','nirvana']},
    archer:{shoot:['hawkshot','scatter','deadeye','blast'],volley:['skyrain','stormphoenix'],evade:['rollshot'],focus:['hawkeye','gale']},
    warrior:{slash:['guardSlash','sunderStrike'],bash:['shieldBash'],guard:['ironGuard','rallyGuard','lastBastion','guardianOath'],spin:['shieldSweep'],cry:['battleCry'],slam:['earthShatter','citadelStrike']},
    spearman:{spear:['spearThrust','spearCrush','spearChain','spearBreak','spearExecution','spearHeart','spearPin','spearBoss','spearHeaven']}
  };
  const configs={};
  for(const [cls,types]of Object.entries(groups))for(const [type,ids]of Object.entries(types))for(const id of ids)configs[id]={cls,type};
  for(const cls of Object.values(C.CLASSES))for(const sk of cls.skills)if(sk.ritual)configs[sk.id]={cls:cls.id,type:'ritual'};
  S.configs=configs;
  const durations={fang:300,rend:430,crescent:440,lotus:660,tempest:2700,shadowstep:460,twindragon:640,skyfall:650,thousand:1060,
    jade:340,spiritsword:420,skybolt:560,heavens:800,meteor:700,mercy:620,aegis:620,might:620,nirvana:820,
    hawkshot:330,scatter:580,deadeye:520,blast:520,skyrain:880,stormphoenix:720,rollshot:420,hawkeye:520,gale:520};
  S.profile=(sk,d={})=>{
    const rank=Math.max(0,Math.min(sk.evo?.length||0,d.r||0)),sl=Math.max(1,Math.min(C.SKILL_MAX,d.sl||1));
    const grade=sk.lvl>=130?5:sk.lvl>=120?4:Math.min(3,rank+Math.floor((sl-1)/4));
    return {rank,sl,grade,detail:3+grade*2,force:1+grade*.16,echoes:grade>=2?Math.min(2,grade-1):0};
  };
  function sequence(sk,d,dur){
    if(sk.spear)return(d.beats||C.spearSequence(sk,d.r||0)).map(b=>b.at);
    if(sk.frontline)return[sk.frontline.windup||Math.min(180,dur*.35)];
    if(sk.id==='lotus')return Array.from({length:d.n||3},(_,i)=>i*200);
    if(sk.id==='tempest')return Array.from({length:d.n||8},(_,i)=>250+i*(d.g||325));
    if(sk.id==='thousand')return Array.from({length:d.n||8},(_,i)=>80+i*90).concat(d.r?[80+(d.n||12)*90+120]:[]);
    if(sk.id==='crescent')return d.r?[90,310]:[90];
    // Launch gestures, not arrival/impact times: projectile flight stays in SkillFX.
    if(sk.id==='hawkshot')return d.r?[45,155]:[45];
    if(sk.id==='scatter')return d.r?[45,305]:[45];
    if(sk.id==='shadowstep')return d.r?[120,260,400]:[120];
    return[{skyfall:460,skybolt:300,heavens:300,meteor:300,skyrain:320,stormphoenix:160,blast:150,jade:60,deadeye:100}[sk.id]??Math.round(dur*.4)];
  }
  S.cancel=(id,skill,all=true)=>{
    SkillArts.cancel(id,skill,all);
    const e=window.G?.ents.get(id);if(e?.skillMotion&&(!skill||e.skillMotion.skill===skill)){
      e.skillMotion=null;e.atk=null;
    }
    FX.list=FX.list.filter(n=>!n.performanceArt||n.owner!==id||(skill&&n.skill!==skill));
  };
  S.clear=()=>{SkillArts.clear();for(const e of G.ents.values())e.skillMotion=null;FX.list=FX.list.filter(n=>!n.performanceArt);};
  S.active=(e,now=performance.now())=>{
    const m=e?.skillMotion;
    // A graded route outlasts the server cast: walking away after the last strike ends it.
    if(m?.choreo&&(e.walkBlend||0)>.35&&now-m.t0>(m.beats.at(-1)||0)+120)return null;
    return m&&!e.dead&&!e.dying&&now>=m.t0&&now<m.t0+m.dur&&m.map===G.mapId?m:null;
  };
  S.play=d=>{
    if(d.t==='spearCancel'||d.t==='ritualCancel'){S.cancel(d.id,d.skill);return;}
    const id=d.t.startsWith('ritual')?d.skill:d.t,sk=C.ALL_SKILLS[id],cfg=configs[id],e=window.G?.ents.get(d.id);
    if(!sk||!cfg||!e||e.dead||e.dying)return;
    S.cancel(d.id,undefined,false);
    const A=S.profile(sk,d),released=d.t==='ritualRelease';
    let dur=d.dur||durations[id]||600;
    if(sk.ritual)dur=released?(d.recovery||650):(d.cast||sk.ritual.cast);
    let beats=sequence(sk,d,dur);if(sk.ritual)beats=[released?0:dur];
    dur=Math.max(dur,beats.at(-1)+160);
    const angle=Number.isFinite(d.a)?d.a:Number.isFinite(d.x)&&Number.isFinite(d.y)&&Math.hypot(d.x-e.x,d.y-e.y)>1?Math.atan2(d.y-e.y,d.x-e.x):(e.dir||0)*Math.PI/4;
    const m=e.skillMotion={...A,...cfg,skill:id,t0:performance.now(),dur,beats,a:angle,dir:C.dirFromAngle(angle),map:G.mapId,released};
    const aim=G.ents.get(d.tid??d.ids?.[0]),tx=aim?aim.x:d.tx??d.x,ty=aim?aim.y:d.ty??d.y;
    m.choreo=SkillChoreo.build(id,cfg.cls,A.grade,dur,{D:Number.isFinite(tx)&&Number.isFinite(ty)?Math.hypot(tx-e.x,ty-e.y)-30:undefined,beats});
    if(m.choreo)m.dur=m.choreo.dur;
    SkillChoreo.stage(d,e,m);
    if(SkillArts.handles(id))return;
    const P=SkillFX.palette(cfg.cls,d.f||e.faction);
    for(const layer of ['ground','top']){
      if(FX.list.filter(n=>n.performanceArt).length>=96){const i=FX.list.findIndex(n=>n.performanceArt);FX.list.splice(i,1);}
      FX.list.push({performanceArt:true,owner:e.id,skill:id,t0:m.t0,dur,layer,draw(g,p){
        if(G.ents.get(e.id)!==e||e.skillMotion!==m||e.dead||e.dying||m.map!==G.mapId)return;
        const now=m.t0+p*dur,state=S.phase(m,now),pose=G.skillPose?G.skillPose(e,now):{dx:0,dy:0,lift:0};
        const x=e.x+pose.dx,y=e.y+pose.dy-pose.lift;
        g.save();g.lineCap='round';g.lineJoin='round';g.globalAlpha*=Math.min(1,p*12,(1-p)*7);
        if(layer==='ground')ground(g,e,m,P,p,state);else ornament(g,e,m,P,p,state,x,y,now);
        g.restore();
      }});
    }
  };
  S.phase=(m,now)=>{
    const t=now-m.t0;let i=m.beats.findIndex(at=>t<at+100);if(i<0)i=m.beats.length-1;
    const at=m.beats[i],start=i?m.beats[i-1]+100:0;
    const wind=clamp((t-start)/Math.max(1,at-start)),strike=clamp((t-at)/150);
    const pulse=Math.max(0,1-Math.abs(t-at)/145),recover=clamp((t-m.beats.at(-1))/Math.max(1,m.dur-m.beats.at(-1)));
    return {t,i,at,wind,strike,pulse,recover,p:clamp(t/m.dur)};
  };
  S.frame=(e,now,base)=>{
    const m=S.active(e,now);if(!m)return base;
    if(SkillArts.handles(m.skill))return SkillArts.frame(e,m,now,base);
    if(m.type==='spear'||m.type==='ritual')return base;
    if(m.choreo)return SkillChoreo.frame(e,m,now,base);
    const q=S.phase(m,now),before=q.t<q.at;
    let frame=before?(q.wind<.45?0:1):(q.strike<.6?1:2),dir=m.dir;
    if(e.cls==='archer')frame=before?(q.wind<.25?0:1):2;
    if(e.cls==='taoist')frame=q.p<.22?0:q.p<.65?1:2;
    if(m.type==='spin'&&q.p>.12&&q.p<.8)dir=(m.dir+Math.floor(q.p*8*(m.skill==='tempest'?3:1)))&7;
    if(m.type==='flurry')frame=q.i%2?2:1;
    return {...base,atk:true,frame,dir};
  };
  S.pose=(e,now,base)=>{
    const m=S.active(e,now);if(!m)return base;
    if(SkillArts.handles(m.skill))return SkillArts.pose(e,m,now,base);
    if(m.type==='spear'||m.type==='ritual')return base;
    if(m.choreo)return SkillChoreo.pose(e,m,now,base);
    const q=S.phase(m,now),wave=Math.sin(Math.PI*q.p),f=m.force,pulse=q.pulse;
    let push=0,lift=0,roll=0,squash=0;
    switch(m.type){
      case 'slash':push=(-5*q.wind*(q.t<q.at)+15*pulse)*f;roll=Math.sin(q.p*TAU)*.065*f;squash=pulse*.025;break;
      case 'spin':lift=wave*(7+3*m.grade);push=Math.sin(q.p*TAU)*8*f;roll=Math.sin(q.p*TAU)*.09;break;
      case 'dash':push=10*pulse*f;roll=-wave*.15;break;
      case 'dive':lift=e.leap?0:wave*(24+6*m.grade);squash=pulse*.08;roll=wave*.12;break;
      case 'flurry':push=pulse*(q.i%2?9:14)*f;roll=(q.i%2?1:-1)*pulse*.07;break;
      case 'shoot':push=(-8*q.wind*(q.t<q.at)-13*pulse-4*wave)*f;roll=-pulse*.09-wave*.025;squash=pulse*.02;break;
      case 'volley':lift=wave*(12+6*m.grade);push=-pulse*11*f;roll=-wave*.10;break;
      case 'evade':lift=wave*(12+4*m.grade);roll=-Math.sin(q.p*TAU)*.3;push=-wave*7;break;
      case 'focus':lift=wave*(5+2*m.grade);roll=wave*.035;break;
      case 'cast':push=pulse*9*f;lift=wave*(3+2*m.grade);roll=wave*.06;break;
      case 'summon':lift=wave*(13+6*m.grade);push=-pulse*3;roll=-wave*.035;break;
      case 'bless':lift=wave*(10+5*m.grade);squash=-wave*.025;break;
      case 'bash':push=(-7*q.wind*(q.t<q.at)+19*pulse)*f;squash=pulse*.065;roll=pulse*.09;break;
      case 'guard':lift=wave*(m.grade>=4?10:2);squash=wave*.055;push=-wave*4;break;
      case 'cry':squash=-wave*.04;lift=wave*5;roll=Math.sin(q.p*TAU)*.03;break;
      case 'slam':lift=q.t<q.at?Math.sin(q.wind*Math.PI)*(.6+q.wind)*(18+8*m.grade):0;squash=pulse*.08;push=pulse*12*f;roll=q.t<q.at?-wave*.13:pulse*.07;break;
    }
    const fade=1-q.recover;
    return {...base,dx:base.dx+Math.cos(m.a)*push,dy:base.dy+Math.sin(m.a)*push*.65,
      lift:base.lift+lift,roll:(base.roll||0)+roll*fade,sx:1+squash,sy:1-squash};
  };
  function line(g,pts,color,w=1){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=w;g.stroke();}
  function ground(g,e,m,P,p,q){
    // Small caster ornament: never depicts a damage boundary or changes server reach.
    const r=22+m.grade*5,turn=p*.9;
    g.save();g.translate(e.x,e.y+2);g.scale(1,.38);g.globalAlpha*=.35+q.pulse*.2;
    for(let j=0;j<2+(m.grade>=3);j++){
      g.beginPath();g.arc(0,0,r+j*7,turn+j*2.1,turn+j*2.1+1.2);g.strokeStyle=j?P.accent:P.main;g.lineWidth=2;g.stroke();
    }
    for(let i=0;i<m.detail;i++){
      const a=i*TAU/m.detail-p*.6,rr=r+12-q.wind*6;
      line(g,[[Math.cos(a)*rr,Math.sin(a)*rr],[Math.cos(a)*(rr+5),Math.sin(a)*(rr+5)]],P.accent,1);
    }g.restore();
  }
  function ornament(g,e,m,P,p,q,x,y,now){
    const f=m.force,n=m.detail,flow=Math.sin(p*Math.PI),r=28+12*m.grade;
    // Echoes are character silhouettes along the gesture, not extra attacks.
    if(m.echoes&&q.pulse>.3&&m.type!=='ritual'&&m.type!=='spear'&&window.drawGhost){
      for(let j=m.echoes;j>=1;j--)drawGhost(e,x-Math.cos(m.a)*j*11,y-Math.sin(m.a)*j*7,j===1?.12:.07,P.main,g);
    }
    g.save();g.translate(x,y-30);g.globalAlpha*=.65;g.strokeStyle=P.main;g.lineWidth=1.5;
    if(m.cls==='dualblade'){
      // Paired curved weapon wakes, staggered left/right with the authored body turn.
      g.rotate(m.a);for(const side of [-1,1]){
        g.beginPath();g.moveTo(-28*f,side*18);g.bezierCurveTo(-r,side*r*1.1,35*f,side*r,48*f,side*5);
        g.strokeStyle=side>0?P.main:P.core;g.lineWidth=(1+q.pulse*3)*f;g.stroke();
        if(m.grade>=2){g.beginPath();g.arc(0,0,r+8,side>0?.1:Math.PI,side>0?1.2:4.2);g.strokeStyle=P.accent;g.lineWidth=1;g.stroke();}
      }
    }else if(m.cls==='archer'){
      // Bowstring tension and feather vanes stay beside the caster; SkillFX owns arrows.
      g.rotate(m.a);g.beginPath();g.arc(5,0,25+q.wind*6,-1.25,1.25);g.strokeStyle=P.core;g.lineWidth=2;g.stroke();
      line(g,[[14,-28],[-16*q.wind,0],[14,28]],P.accent,1.3);
      for(const side of [-1,1])for(let i=0;i<Math.ceil(n/2);i++){
        const xx=-18-i*8-flow*10,yy=side*(14+i*6);line(g,[[xx+10,yy*.6],[xx,yy],[xx+5,yy+side*8]],i%2?P.accent:P.main,1.6);
      }
    }else if(m.cls==='taoist'){
      for(let i=0;i<n;i++){
        const a=i*TAU/n+p*1.7,xx=Math.cos(a)*(r+12),yy=Math.sin(a)*r*.55-12;
        g.save();g.translate(xx,yy);g.rotate(a*.25);g.fillStyle=P.paper;g.strokeStyle=P.accent;
        g.fillRect(-4,-10,8,20);g.strokeRect(-4,-10,8,20);line(g,[[-2,-6],[2,-4],[-2,0],[2,2],[0,7]],P.main,1);g.restore();
      }
      if(m.grade>=2){g.beginPath();g.ellipse(0,10,r+15,(r+15)*.45,p*.3,0,TAU);g.strokeStyle=P.accent;g.stroke();}
    }else if(m.cls==='warrior'){
      if(['guard','cry'].includes(m.type)){
        const count=m.grade>=4?5:m.grade>=2?3:1;
        for(let i=0;i<count;i++){
          const a=(i-(count-1)/2)*.7,xx=Math.sin(a)*(50+m.grade*8),yy=25-Math.cos(a)*20;
          g.save();g.translate(xx,yy);g.scale(.34+flow*.14,.34+flow*.14);
          WarriorLook.shield(g,0,0,1,WarriorLook.palette(e.faction),m.grade);g.restore();
        }
      }else{
        g.rotate(m.type==='slam'?-Math.PI/2:m.a);const length=(35+m.grade*12)*(.65+q.wind*.35);
        const grad=g.createLinearGradient(-length,0,length,0);grad.addColorStop(0,P.main+'00');grad.addColorStop(.6,P.main+'99');grad.addColorStop(1,P.core);
        g.fillStyle=grad;g.beginPath();g.moveTo(-length,-9);g.lineTo(length,0);g.lineTo(-length,9);g.closePath();g.fill();
        for(let i=0;i<Math.ceil(n/2);i++)line(g,[[-length+i*12,-18-i*2],[-length+i*12+13,-24-i*2]],P.accent,1);
      }
    }else{
      // Spear/ritual already have their own complete weapons; add restrained rising qi.
      for(let i=0;i<n;i++){
        const a=i*TAU/n+p*2,xx=Math.cos(a)*r,yy=Math.sin(a)*r*.35;
        line(g,[[xx,yy+20],[xx+Math.sin(a)*6,yy+7-flow*20]],i%2?P.accent:P.main,1.2);
      }
    }
    // High arts have a distinct halo of short rays, away from the face.
    if(m.grade>=4)for(let i=0;i<n;i++){
      const a=i*TAU/n+p*.4,R=r+16;line(g,[[Math.cos(a)*R,Math.sin(a)*R*.65+15],[Math.cos(a)*(R+12*flow),Math.sin(a)*(R+12*flow)*.65+15]],P.accent,1.5);
    }
    g.restore();
  }
})();
