// Authored level-dependent hair bodies; fitted equipment surfaces; flowing celestial silk.
(function(){
  const S=window.SpearmanLook={},TAU=Math.PI*2,metadata={},icons={},short={},variants={},styleMeta={};
  S.prepare=(f,image,M,shortWalk,shortAttack,hairVariants={},hairMeta={})=>{icons[f]=image;metadata[f]=M;short[f]={walk:shortWalk,attack:shortAttack};variants[f]=hairVariants;styleMeta[f]=hairMeta;};
  S.hairStage=t=>t<2?'short':t<4?'medium':t<6?'long':'royal';
  S.modelMeta=(f,atk,tier=0)=>styleMeta[f]?.styles?.[S.hairStage(tier)]?.[atk?'attack':'walk']?.[f]||metadata[f]?.[atk?'attack':'walk']?.[f];
  S.tierOf=lvl=>ModelTiers.tierOf(lvl);
  S.palette=(f,t)=>f==='adharma'
    ?{main:['#b44253','#bb445c','#c54569','#c94a7d','#b55b9c','#d65478','#ed7691','#ff8c9a'][t],core:'#ffe1c9',gold:'#caa16a',deep:'#30152c'}
    :{main:['#669ec8','#69b0d9','#79bfdc','#7fcbdc','#92cfe6','#b0dbe8','#c7e7ed','#dceff4'][t],core:'#fff7df',gold:'#dcb86f',deep:'#254d75'};
  S.anchor=(f,atk,row,col,tier=0)=>S.modelMeta(f,atk,tier)?.poseFrames?.[row*8+col];
  const clamp=n=>Math.max(0,Math.min(1,n)),pulse=n=>n>0&&n<1?Math.sin(n*Math.PI):0;
  S.choreography=(e,now)=>{
    const A=e.atk;if(!A)return null;const el=now-A.t0;if(el<0||el>=A.dur)return null;
    const sk=C.ALL_SKILLS[A.kind],k=Number(sk?.key||1),beats=A.beats||C.spearSequence(sk||{},0);
    if(!beats.length)return null;
    let hit=beats.findIndex(b=>el<b.at+100);if(hit<0)hit=beats.length-1;
    const beat=beats[hit],start=hit?beats[hit-1].at+100:0,wind=Math.max(1,beat.at-start),local=el-start;
    const last=beats.at(-1).at,charge=clamp(local/wind),strike=local-wind,q=(strike+65)/200;
    return {A,k,el:local,wind,last,hit,charge,strike,q,move:beat.move,thrust:pulse(q),recovery:clamp((el-last)/Math.max(1,A.dur-last))};
  };
  // how long before the first impact the raised-spear drawing (frame 0) gives way to the thrust
  const LEAD=[0,85,50,85,90,70,85,110,120,80];
  S.frame=(e,now)=>{
    const c=S.choreography(e,now);
    if(c){
      const {A,k,el,wind,hit,q,charge}=c;let dir=A.dir;
      // Spins turn through the real directional drawings before returning to the locked target.
      if(['spin','sweep'].includes(c.move)&&el<wind-40)dir=(A.dir+Math.floor(charge*8)+1)%8;
      if(c.move==='dive'&&el<wind-70)dir=(A.dir+Math.floor(charge*8))%8;
      if(c.move==='cross'&&q>.6)dir=(A.dir+(hit%2?1:7))%8;
      return {atk:true,dir,frame:el<wind-LEAD[k]?0:q>=0&&q<=1?1:2};
    }
    return {atk:false,dir:e.dir,frame:CharacterMotion.walkFrame(e,3)};
  };
  const ease=n=>1-Math.pow(1-clamp(n),3),easeIn=n=>Math.pow(clamp(n),3);
  // Body choreography per skill: forward lunge / side step / lift (px), lean (roll) and squash & stretch (sx, sy
  // round the feet). Server timing is untouched; every move fits inside the cast's own wind-up and recovery.
  S.pose=(e,now,o)=>{
    const c=S.choreography(e,now);if(!c)return o;
    const {A,el,wind,charge:ch,thrust,hit,recovery:rec}=c,charging=el<wind,hits=A.hits||1;
    const k=({jab:1,thrust:1,rise:2,slam:2,cross:3,drill:4,finish:5,spin:6,sweep:6,low:7,pin:7,dragon:8,dive:9})[c.move]||c.k;
    const after=Math.max(0,el-wind),land=charging?0:Math.max(0,1-after/160);
    let fw=0,side=0,lift=0,roll=0,sx=1,sy=1;
    switch(k){
      case 1: // quick feint back, explosive straight thrust
        fw=charging?-5*Math.sin(ch*Math.PI):thrust*24;sx=1+thrust*.07;sy=1-thrust*.05;roll=thrust*.07;break;
      case 2: // jump with the spear wheeling overhead, slam and squash on landing
        fw=charging?16*ease(ch):16+thrust*6;lift=charging?38*Math.sin(ch*Math.PI):0;
        roll=charging?-.14*Math.sin(ch*Math.PI):.06*thrust;
        if(charging&&ch>.85){sx=.94;sy=1.08;}else{sx=1+land*.14;sy=1-land*.16;}break;
      case 3:{ // alternating side lunges with a hop, the last one straight and deepest
        const sd=hit%2?1:-1,fin=hit===hits-1;
        fw=charging?-3:thrust*(fin?28:16);side=charging?0:fin?0:sd*thrust*14;lift=charging?0:thrust*7;roll=sd*thrust*.06;sx=1+thrust*.05;break;}
      case 4: // coil back trembling like a drill, then a spinning lunge
        fw=charging?-11*ease(ch):thrust*30;side=charging?Math.sin(el/22)*2.2*ch:0;
        sy=charging?1-.09*ch:1-thrust*.04;sx=charging?1+.06*ch:1+thrust*.09;roll=charging?-.09*ch:thrust*.12;break;
      case 5:{ // rise to deliver the verdict, dive onto the victim
        const dive=clamp((after+40)/110);
        lift=charging?28*ease(ch):28*(1-dive);fw=charging?-7*Math.sin(ch*Math.PI):34*ease(dive)*(1-rec*.5);
        sy=charging?1+.05*ch:1-land*.15;sx=charging?1:1+land*.12;roll=charging?-.06*ch:.1*thrust;break;}
      case 6: // whirl with a hop and sway, then a cutting lunge
        side=charging?Math.sin(ch*TAU)*13:0;lift=charging?11*Math.sin(ch*Math.PI):0;fw=charging?4*ch:thrust*21;
        roll=charging?Math.sin(ch*4*Math.PI)*.07:thrust*.06;sx=charging?1+Math.sin(ch*6*Math.PI)*.04:1;break;
      case 7:{ // tiger crouch, low arcing pounce
        const pounce=clamp((after+80)/220);
        lift=charging?-7*ease(ch):Math.sin(pounce*Math.PI)*15;fw=charging?-6*ch:28*ease(pounce)*(1-rec*.4);
        sy=charging?1-.13*ease(ch):1+Math.sin(pounce*Math.PI)*.04-land*.1;sx=charging?1+.09*ease(ch):1+thrust*.08;roll=charging?-.05*ch:.08*thrust;break;}
      case 8:{ // draw far back, then a long dragon dash
        const dash=clamp((after+90)/150);
        fw=charging?-17*ease(ch):38*ease(dash)*(1-rec*.6);sx=charging?1:1+(1-dash)*.12;roll=charging?-.07*ch:.09*thrust;
        lift=charging?0:4*Math.sin(dash*Math.PI);break;}
      case 9:{ // ascend spinning, dive from the sky, heavy landing
        const dive=clamp((after+70)/130);
        lift=charging?50*ease(ch):50*(1-easeIn(dive));fw=charging?-4*ch:36*ease(dive)*(1-rec*.5);
        sy=charging?1+.06*ch:1-land*.18;sx=charging?1:1+land*.14;roll=charging?Math.sin(ch*TAU*2)*.04:.08*thrust;break;}
    }
    o.dx+=Math.cos(A.a)*fw-Math.sin(A.a)*side;
    o.dy+=(Math.sin(A.a)*fw+Math.cos(A.a)*side)*.65;
    o.lift+=lift;o.roll=roll*Math.cos(A.a);o.sx=sx;o.sy=sy;
    return o;
  };
  S.weaponLine=(e,F)=>{
    const a=S.anchor(e.faction,F.atk,F.frame,C.DIR_COL[F.dir],S.tierOf(e.lvl||1));if(!a)return [];
    const tip=SpearWeapon.fit(a,e.wt||0).tip;
    return [[a.grip[0]-a.feetX,a.grip[1]-a.feetY],[tip[0]-a.feetX,tip[1]-a.feetY]];
  };
  S.glintAnchors=(key,row,col,tier=0)=>{
    const f=key.endsWith('adharma')?'adharma':'dharma',a=S.anchor(f,key.includes('-attack-'),row,col,tier);if(!a)return [[],[],[],[]];
    const B=a.bodyHeight,x=a.headX,y=a.headTop;
    return [[[x-B*.08,y+B*.7],[x+B*.08,y+B*.7]],[[x-B*.09,y+B*.93],[x+B*.09,y+B*.93]],
      [[x-B*.22,y+B*.71],[x+B*.22,y+B*.71]],[[x-B*.22,y+B*.56],[x+B*.22,y+B*.56]]];
  };
  S.compose=(src,f,key,tier,ar=[0,0,0,0],wt=0)=>{
    const pose=key.includes('-attack-')?'attack':'walk',M=S.modelMeta(f,pose==='attack',tier);if(!M)return src;
    const body=variants[f]?.[S.hairStage(tier)]?.[pose]||(tier<2?(short[f]?.[pose]||src):src);
    const c=SpearmanGear.compose(body,f,M,tier,ar||[0,0,0,0],wt);
    return c;
  };
  function silk(g,B,t,side,layer,tier,dark){
    const points=[],left=[],right=[],reach=.46+(tier-4)*.065+layer*.06,phase=t*(dark?1.65:1.25)+side*.7+layer*1.8;
    // A soft arch from the back of the collar, followed by a long waving silk tail.
    // Two edges travel around one centreline; the cloth remains a thin translucent strip.
    for(let i=0;i<=48;i++){
      const u=i/48,envelope=Math.sin(u*Math.PI*.85);
      const x=B*(.15+reach*Math.sin(u*Math.PI*.72)+.04*Math.sin(u*9-phase)*envelope);
      const y=B*(-(.32+layer*.08)*Math.sin(u*Math.PI)+( .48+layer*.04)*u*u+.045*Math.sin(u*11-phase)*u);
      points.push([side*x,y]);
    }
    for(let i=0;i<points.length;i++){
      const u=i/(points.length-1),a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
      const width=B*(.014+Math.sin(u*Math.PI)*.012)*(1-u*.85)*(layer? .66:1);
      left.push([points[i][0]-dy/L*width,points[i][1]+dx/L*width]);
      right.push([points[i][0]+dy/L*width,points[i][1]-dx/L*width]);
    }
    const grad=g.createLinearGradient(0,-B*.3,side*B*.7,B*.5);
    grad.addColorStop(0,dark?'#241522':'#d7edf3');grad.addColorStop(.35,dark?'#882b47':'#fff7dd');
    grad.addColorStop(.65,dark?'#37182e':'#a5d8e8');grad.addColorStop(1,dark?'#d15d71':'#f8f3e5');
    g.beginPath();left.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));right.reverse().forEach(([x,y])=>g.lineTo(x,y));g.closePath();
    g.globalAlpha=layer?.40:.65;g.fillStyle=grad;g.fill();
    g.globalAlpha=layer?.25:.42;g.strokeStyle=dark?'#d2919c':'#f9e8b9';g.lineWidth=.55;g.stroke();
    // A hairline fold catches light along one edge, without filling the space around the model.
    g.globalAlpha=.22;g.beginPath();left.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=dark?'#e7a3b5':'#ffffff';g.lineWidth=.6;g.stroke();
  }
  S.drawAura=(g,e,F,x,y,t,s)=>{
    if(e.dead)return;const tier=S.tierOf(e.lvl||1);if(tier<4)return;
    const a=S.anchor(e.faction,F.atk,F.frame,C.DIR_COL[F.dir],tier);if(!a)return;
    const B=a.bodyHeight*s,dark=e.faction==='adharma',cy=y-B*.55,layers=tier>=7?3:tier>=6?2:1;
    g.save();g.translate(x,cy);
    for(let layer=layers-1;layer>=0;layer--)for(const side of [-1,1])silk(g,B,t,side,layer,tier,dark);
    g.restore();
  };
  S.ground=(g,e,t)=>{
    if(e.dead)return;const tier=S.tierOf(e.lvl||1);if(tier<2)return;const p=S.palette(e.faction,tier),R=25+tier*2;
    g.save();g.translate(e.x,e.y);g.scale(1,.34);g.globalAlpha=.2;g.strokeStyle=p.main;g.lineWidth=1.2;
    g.beginPath();g.ellipse(0,0,R,R,0,0,TAU);g.stroke();g.restore();
  };
  S.icon=(g,f,size,tier=0)=>SpearWeapon.icon(g,tier,f,size);
})();
