// Four-class skill redesign. Authored poses and new Canvas art; no combat mutations.
(function(){
  const S=window.SkillArts={},TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),mix=(a,b,p)=>a+(b-a)*p;
  const smooth=p=>p*p*(3-2*p),ent=id=>G.ents.get(id),M={};
  S.designs=SkillDesigns;S.motifs=M;S.handles=id=>!!SkillDesigns[id];
  const fract=n=>{const v=Math.sin(n*127.1+19.7)*43758.5453;return v-Math.floor(v);};
  const line=(g,pts,c,w=1.5)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=c;g.lineWidth=w;g.stroke();};
  const poly=(g,pts,c,edge)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();if(c){g.fillStyle=c;g.fill();}if(edge){g.strokeStyle=edge;g.lineWidth=1;g.stroke();}};
  function glow(g,x,y,r,P,a=.6){if(r<=0)return;g.save();g.globalAlpha*=a;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,P.core+'aa');gr.addColorStop(.3,P.main+'55');gr.addColorStop(1,P.main+'00');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);g.restore();}
  function arc(g,x,y,r,a,b,P,w=3){g.beginPath();g.arc(x,y,Math.max(1,r),a,b);g.strokeStyle=P;g.lineWidth=w;g.stroke();}
  function blade(g,x,y,a,L,P,spear=false){g.save();g.translate(x,y);g.rotate(a);const gr=g.createLinearGradient(0,-7,0,7);gr.addColorStop(0,P.main);gr.addColorStop(.48,P.core);gr.addColorStop(1,P.deep);
    poly(g,[[L,0],[L*.7,-5],[0,-3],[-5,0],[0,3],[L*.7,5]],gr,P.accent);line(g,[[-3,-9],[-3,9]],P.accent,2.5);line(g,[[-(spear?L*.9:17),0],[-5,0]],P.accent,spear?3:4);
    if(spear)poly(g,[[-5,2],[-18,15],[-12,3],[-25,7],[-9,-2]],P.main);g.restore();}
  // A broad spear pointing down with its tip at (x, y): shaft, leaf blade, guard and tassel.
  function bigSpear(g,x,y,L,P){
    if(L<4)return;const w=Math.max(3,L*.04),H=L*.24;g.save();g.translate(x,y);
    const gr=g.createLinearGradient(-w,0,w,0);gr.addColorStop(0,P.deep);gr.addColorStop(.5,P.core);gr.addColorStop(1,P.deep);
    poly(g,[[-w*.5,-L],[w*.5,-L],[w*.5,-H],[-w*.5,-H]],gr,P.accent);
    poly(g,[[0,0],[-w*1.9,-H*.55],[-w*1.1,-H],[w*1.1,-H],[w*1.9,-H*.55]],P.core,P.main);line(g,[[0,-H*.15],[0,-H*.9]],P.main,1.2);
    poly(g,[[-w*2.6,-H-2],[w*2.6,-H-2],[w*1.6,-H-w*1.4],[-w*1.6,-H-w*1.4]],P.accent,P.deep);
    for(const s2 of [-1,1])line(g,[[s2*w*1.2,-H-w],[s2*w*3,-H+w*2.5],[s2*w*2.2,-H+w*4]],P.main,2);
    glow(g,0,-H*.4,w*5,P,.5);g.restore();
  }
  // A dragon coiling upward round (x, y): body ribbon with scales and a horned head at the top.
  function coil(g,x,y,h,r,P,p,turns){
    const pts=[],rise=smooth(clamp(p*2));for(let i=0;i<=48;i++){const t=i/48,b=t*TAU*turns+p*5;pts.push([x+Math.cos(b)*r*(1-t*.3),y-t*h*rise+Math.sin(b)*r*.3]);}
    line(g,pts,P.deep,12);line(g,pts,P.main,8);line(g,pts,P.accent,1.5);
    for(let i=3;i<46;i+=4){const [px,py]=pts[i];poly(g,[[px-4,py],[px,py-9],[px+4,py]],P.accent);}
    const [hx,hy]=pts.at(-1);poly(g,[[hx-13,hy-8],[hx+9,hy-12],[hx+24,hy-2],[hx+12,hy+7],[hx-10,hy+5]],P.main,P.core);
    for(const s2 of [-1,1])line(g,[[hx+s2*5,hy-8],[hx+s2*14,hy-24],[hx+s2*8,hy-29]],P.accent,2);
  }
  function lightArrow(g,from,x,y,a,A,P,motif,f,small){
    const L=(small?30:44)+A.grade*7,tail=Math.min(Math.hypot(x-from.x,y-from.y),(small?60:110)+A.grade*25);
    g.save();g.translate(x,y);g.rotate(a);g.globalCompositeOperation='lighter';
    const gr=g.createLinearGradient(-tail,0,0,0);gr.addColorStop(0,P.main+'00');gr.addColorStop(1,P.core+'cc');
    g.beginPath();g.moveTo(-tail,0);g.lineTo(0,-3-A.grade*.6);g.lineTo(6,0);g.lineTo(0,3+A.grade*.6);g.closePath();g.fillStyle=gr;g.fill();
    // a spirit bird follows the arrow from behind (falcon / thunder bird) at stage 2+
    if(!small&&A.grade>=2&&(motif==='falcon'||motif==='thunderBird')){g.save();g.translate(-L-18,0);g.globalAlpha*=.45;wings(g,motif==='thunderBird'?44:26,P,f,3+A.grade);g.restore();}
    glow(g,4,0,12+A.grade*4,P,.85);g.restore();
    // A bold arrow, readable at a glance: thick shaft, broad head, three-vane fletching.
    g.save();g.translate(x,y);g.rotate(a);const w=small?2:3+A.grade*.4,H=small?8:11+A.grade*1.5;
    line(g,[[-L,0],[0,0]],P.deep,w+2);line(g,[[-L,0],[0,0]],P.core,w);
    poly(g,[[H*1.4,0],[-H*.3,-H*.62],[0,0],[-H*.3,H*.62]],P.core,P.main);
    for(const side of [-1,0,1])poly(g,[[-L+2,0],[-L-H*1.1,side*H*.7-(side?0:H*.15)],[-L-H*.7,side*H*.35],[-L+H*.6,0]],side?P.main:P.accent,P.core);
    g.restore();
  }
  function feather(g,x,y,a,L,P){g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(L*.3,-L*.42,L*.8,-L*.3,L,0);g.quadraticCurveTo(L*.45,L*.21,0,0);g.fillStyle=P.main+'88';g.fill();line(g,[[0,0],[L,0]],P.core,1);for(let k=1;k<5;k++)line(g,[[k*L/6,0],[(k+1)*L/6,-L*.13]],P.accent,.8);g.restore();}
  function arrow(g,x,y,a,L,P){g.save();g.translate(x,y);g.rotate(a);line(g,[[-L,0],[0,0]],P.core,2);poly(g,[[9,0],[-9,-6],[-4,0],[-9,6]],P.core,P.main);for(const side of [-1,1])poly(g,[[-L,0],[-L-12,side*9],[-L+4,side*5],[-L+10,0]],P.main,P.accent);g.restore();}
  function paper(g,x,y,a,L,P){g.save();g.translate(x,y);g.rotate(a);poly(g,[[-L*.24,-L*.5],[L*.24,-L*.5],[L*.24,L*.5],[0,L*.4],[-L*.24,L*.5]],P.paper,P.accent);line(g,[[-L*.15,-L*.28],[L*.13,-L*.2],[-L*.08,-L*.05],[L*.1,L*.05],[-L*.13,L*.16],[0,L*.32]],P.main,1.6);g.restore();}
  function burst(g,R,n,P,p,rotate=0){for(let i=0;i<n;i++){const a=i*TAU/n+rotate,r=R*(.25+p*.85);line(g,[[Math.cos(a)*r,Math.sin(a)*r*.65],[Math.cos(a)*(r+10*(1-p)),Math.sin(a)*(r+10*(1-p))*.65]],i%2?P.main:P.accent,1.5);}}
  function lotus(g,R,n,P,p){for(let i=0;i<n;i++){g.save();g.rotate(i*TAU/n+p*.5);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(R*.2,-R*.35,R*.8,-R*.25,R,0);g.bezierCurveTo(R*.75,R*.23,R*.2,R*.3,0,0);g.fillStyle=i%2?P.main+'44':P.accent+'33';g.fill();g.strokeStyle=P.accent;g.lineWidth=1.2;g.stroke();g.restore();}}
  function seal(g,R,n,P,p){const pts=Array.from({length:n+1},(_,i)=>[Math.cos(i*TAU/n+p)*R,Math.sin(i*TAU/n+p)*R]);line(g,pts,P.accent,1.4);for(let i=0;i<n;i++){const a=i*TAU/n+p;g.save();g.translate(Math.cos(a)*R*.82,Math.sin(a)*R*.82);g.rotate(a);for(let k=0;k<3;k++)line(g,[[-4+k*4,-6],[-4+k*4,k===1?0:6]],P.main,1.6);g.restore();}}
  function gate(g,x,y,R,P,p){g.save();g.translate(x,y);const rise=Math.sin(clamp(p*1.5)*Math.PI/2);line(g,[[-R*.45,0],[-R*.45,-R*rise],[-R*.62,-R*rise],[-R*.48,-R*1.14*rise],[R*.48,-R*1.14*rise],[R*.62,-R*rise],[R*.45,-R*rise],[R*.45,0]],P.accent,3);line(g,[[-R*.3,0],[-R*.3,-R*.85*rise],[R*.3,-R*.85*rise],[R*.3,0]],P.main,2);paper(g,0,-R*.65*rise,0,R*.3,P);g.restore();}
  function dragon(g,R,P,p,turns=1){const pts=[];for(let i=0;i<=42;i++){const a=i/42*TAU*turns+p*3,r=R*(.5+i/84);pts.push([Math.cos(a)*r,Math.sin(a)*r*.48-i*.6]);}line(g,pts,P.deep,13);line(g,pts,P.main,8);line(g,pts,P.accent,1.5);for(let i=2;i<40;i+=4){const [x,y]=pts[i];poly(g,[[x-4,y],[x,y-10],[x+4,y]],P.accent);}const [x,y]=pts.at(-1);poly(g,[[x-11,y-9],[x+8,y-12],[x+22,y-3],[x+11,y+6],[x-9,y+5]],P.main,P.core);for(const side of [-1,1])line(g,[[x+side*5,y-8],[x+side*13,y-23],[x+side*8,y-27]],P.accent,2);}
  function wings(g,R,P,p,count=7){for(const side of [-1,1])for(let i=count-1;i>=0;i--)feather(g,side*5,0,side>0?-.2-i*.1:-Math.PI+.2+i*.1,R*(.6+i/count*.4)*(1+.12*Math.sin(p*TAU)),P);}
  function lightning(g,x,y,h,P,p){const pts=Array.from({length:9},(_,i)=>[x+(i===0||i===8?0:(fract(i+Math.floor(p*6)*9)-.5)*22),y-h+i*h/8]);line(g,pts,P.main,5);line(g,pts,P.core,1.6);}
  function fissure(g,R,P,p){for(let i=0;i<7;i++){const a=i*TAU/7;line(g,[[0,0],[Math.cos(a+.15)*R*.4*p,Math.sin(a+.15)*R*.25*p],[Math.cos(a-.1)*R*.75*p,Math.sin(a-.1)*R*.45*p],[Math.cos(a)*R*p,Math.sin(a)*R*.6*p]],P.accent,1.8);}}
  const palettes=(design,e)=>{const P={...SkillFX.palette(design.cls,e.faction)};if(design.accent)P.accent=design.accent;return P;};
  S.profile=(sk,d)=>{const A=SkillPerformance.profile(sk,d),step=Math.min(3,Math.floor(sk.lvl/25)),mastery=(A.sl-1)/11;return {...A,step,n:4+A.grade*2+step+Math.floor(mastery*2),R:42+step*13+A.grade*9+mastery*5,power:1+A.grade*.13+step*.06+mastery*.1};};
  function sample(design,p){let i=1;while(i<design.times.length-1&&p>design.times[i])i++;const u=smooth(clamp((p-design.times[i-1])/(design.times[i]-design.times[i-1])));return design.keys[i].map((v,k)=>mix(design.keys[i-1][k],v,u));}
  S.pose=(e,m,now,base)=>{
    const design=SkillDesigns[m.skill];if(!design)return base;
    if(m.choreo)return SkillChoreo.pose(e,m,now,base);
    const p=clamp((now-m.t0)/m.dur),v=sample(design,p),gain=1+m.grade*.13;
    if(C.ALL_SKILLS[m.skill].ritual)return {...base,roll:(base.roll||0)+v[3]*.5};
    let [forward,side,lift,roll]=v;
    const turn=roll*(1+m.grade*.045)*Math.cos(m.a),flip=SkillChoreo.waist(turn);
    const beat=m.beats.reduce((a,b)=>Math.abs(now-m.t0-b)<Math.abs(now-m.t0-a)?b:a,m.beats[0]);
    const hit=Math.max(0,1-Math.abs(now-m.t0-beat)/75);
    if(e.cls==='spearman'){forward+=hit*12;side*=1-hit*.6;lift*=1-hit*.7;}
    return {dx:(e.correctX||0)+(Math.cos(m.a)*forward-Math.sin(m.a)*side)*gain+flip.dx,
      dy:(e.correctY||0)+(Math.sin(m.a)*forward+Math.cos(m.a)*side)*gain*.65,
      lift:(e.leap?Math.max(base.lift,lift*gain):lift*gain)+flip.lift,
      roll:turn,sx:1+hit*.06,sy:1-hit*.06};
  };
  S.frame=(e,m,now,base)=>{
    if(C.ALL_SKILLS[m.skill].ritual)return base;
    if(m.choreo)return SkillChoreo.frame(e,m,now,base);
    const p=clamp((now-m.t0)/m.dur),v=sample(SkillDesigns[m.skill],p),at=now-m.t0;
    const onBeat=m.beats.some(t=>at>=t-35&&at<=t+85),turn=Math.round(v[4]*8);
    return {...base,atk:true,dir:onBeat?m.dir:(m.dir+turn+16)%8,frame:onBeat?(e.cls==='spearman'?1:2):Math.max(0,Math.min(2,Math.round(v[5])))};
  };
  // New eight endgame routes. Translation is visual, anchored to the server cast origin.
  // [time fraction, distance toward aim, lateral pixels, height, roll, phase]
  const routes={
    bladeFirmament:[[0,0,0,0,0,'crouch'],[.15,.15,-30,14,-.12,'dash'],[.36,1,75,35,.2,'strike'],[.56,.8,-65,55,-.2,'strike'],[.78,1.1,40,85,.25,'leap'],[1,1,0,0,0,'dive']],
    bladeGenesis:[[0,0,0,0,0,'crouch'],[.15,-.06,0,-5,-.15,'crouch'],[.4,.75,-35,155,-.6,'soar'],[.65,1.05,35,210,.6,'hover'],[.85,1,-20,170,.3,'hover'],[1,1,0,0,.1,'dive']],
    spearFirmament:[[0,0,0,0,0,'crouch'],[.17,-.08,0,-4,-.2,'crouch'],[.4,.55,-20,15,-.35,'rush'],[.65,.95,25,155,-3.1,'vault'],[.86,1.05,0,70,-5.8,'vault'],[1,1,0,0,-6.28,'crash']],
    spearGenesis:[[0,0,0,0,0,'crouch'],[.14,-.08,-10,0,-.12,'crouch'],[.32,.7,-75,30,.18,'dash'],[.55,1.25,60,85,-.2,'orbit'],[.78,.85,-50,130,.25,'throw'],[1,1,0,15,.1,'land']],
    arrowFirmament:[[0,0,0,0,0,'crouch'],[.16,0,0,-6,-.2,'crouch'],[.42,-.1,-25,100,-6.28,'flip'],[.62,-.06,8,115,-6.1,'shoot'],[.85,-.04,-15,80,-6.28,'shoot'],[1,0,0,0,-6.28,'land']],
    arrowGenesis:[[0,0,0,0,0,'crouch'],[.12,-.03,0,-4,-.1,'crouch'],[.35,.45,-90,40,-.3,'run'],[.58,1.05,75,80,.3,'shoot'],[.8,.65,-35,145,-6.28,'leap'],[1,.75,10,110,-6.28,'aim']],
    taoFirmament:[[0,0,0,0,0,'float'],[.2,.12,0,28,-.08,'float'],[.39,.8,-65,48,.15,'seal'],[.59,1.12,40,62,-.12,'seal'],[.8,.8,65,85,.1,'rise'],[1,1,0,0,.08,'slam']],
    taoGenesis:[[0,0,0,0,0,'float'],[.15,.05,-12,18,-.08,'float'],[.37,.12,22,65,.12,'levitate'],[.6,.09,-25,100,-.12,'levitate'],[.83,.15,12,115,.1,'levitate'],[1,.12,0,0,.06,'slam']]
  };
  S.ritualRoute=(r,el)=>{
    const keys=routes[r.skill];if(!keys)return null;const p=clamp(el/r.cast);let i=1;while(i<keys.length-1&&p>keys[i][0])i++;
    const a=keys[i-1],b=keys[i],u=smooth(clamp((p-a[0])/(b[0]-a[0]))),v=a.slice(1,5).map((n,k)=>mix(n,b[k+1],u));
    const dx=r.zx-r.hx,dy=r.zy-r.hy,L=Math.hypot(dx,dy),ux=L>1?dx/L:Math.cos(r.a||0),uy=L>1?dy/L:Math.sin(r.a||0);
    const x=r.hx+dx*v[0]-uy*v[1],y=r.hy+dy*v[0]+ux*v[1]*.6,face=Math.atan2(r.zy-y,r.zx-x);
    return {x,y,lift:v[2],spin:v[3]*Math.sign(ux||1),face:Number.isFinite(face)?face:r.a,phase:b[5],q:u};
  };
  function add(d,phase,dur,layer,draw){
    while(FX.list.filter(n=>n.artV2).length>=144){const i=FX.list.findIndex(n=>n.artV2);FX.list.splice(i,1);}
    const map=G.mapId,owner=ent(d.id);if(!owner)return;
    FX.list.push({artV2:true,skillArt:true,owner:d.id,skill:d.skill||d.t,phase,t0:performance.now(),dur,layer,draw(g,p,node){
      if(G.mapId!==map||ent(d.id)!==owner||owner.dead||owner.dying)return;
      g.save();g.lineCap='round';g.lineJoin='round';draw(g,p,node);g.restore();
    }});
  }
  S.cancel=(id,skill,all=true)=>{FX.list=FX.list.filter(n=>!(n.artV2&&n.owner===id&&(!skill||n.skill===skill)&&(all||n.phase==='cast')));};
  S.clear=()=>{FX.list=FX.list.filter(n=>!n.artV2);};
  function trail(d,e,m,A,P){
    add(d,'cast',m.dur,'top',(g,p)=>{
      if(e.skillMotion!==m)return;const now=m.t0+p*m.dur,pose=G.skillPose(e,now),x=e.x+pose.dx,y=e.y+pose.dy-pose.lift-30;
      const pts=[];for(let i=7;i>=0;i--){const t=Math.max(m.t0,now-i*16),o=G.skillPose(e,t);pts.push([e.x+o.dx,e.y+o.dy-o.lift-30]);}
      g.globalAlpha*=Math.min(1,p*12,(1-p)*8);line(g,pts,P.main,2+A.grade*.35);
      if(A.grade>=2&&p>.15&&p<.8&&window.drawGhost)for(let i=1;i<=Math.min(3,A.grade);i++){const o=G.skillPose(e,Math.max(m.t0,now-i*28));drawGhost(e,e.x+o.dx,e.y+o.dy-o.lift,.13/i,P.main,g);}
      g.save();g.translate(x,y);g.rotate(m.a);
      if(e.cls==='dualblade')for(const side of [-1,1])blade(g,side*10,side*17,side*(p*2-.6),20+A.grade*4,P);
      if(e.cls==='spearman'){arc(g,0,0,23+A.grade*5,p*5,p*5+1.5,P.accent,1.4);for(let i=0;i<3;i++)line(g,[[-22-i*7,8+i*6],[-8-i*7,3+i*6]],P.main,1.2);}
      if(e.cls==='archer'){for(const side of [-1,1])feather(g,-15,side*12,Math.PI+side*.3,24+A.grade*6,P);}
      if(e.cls==='taoist')for(let i=0;i<3+A.grade;i++){const a=i*TAU/(3+A.grade)+p*2;paper(g,Math.cos(a)*35,Math.sin(a)*20,a*.3,15+A.grade,P);}
      g.restore();
    });
  }
  function point(e,d){const t=ent(d.tid||d.ids?.[0]);return t?{x:t.x,y:t.y-22}:Number.isFinite(d.tx)?{x:d.tx,y:d.ty-22}:Number.isFinite(d.x)?{x:d.x,y:d.y-14}:{x:e.x+Math.cos(d.a||0)*90,y:e.y-25+Math.sin(d.a||0)*60};}
  S.timeline=(d,e)=>{
    const id=d.t,r=d.r||0,a=d.a||0,O={x:d.x0??e.x,y:(d.y0??e.y)-28},T=point(e,d),events=[];
    const hit=(at,x=T.x,y=T.y,opts={})=>events.push({at,x,y,dur:520,...opts});
    const fly=(at,L=0,angle=a,opts={})=>hit(at,L?O.x+Math.cos(angle)*L:T.x,L?O.y+Math.sin(angle)*L:T.y,{from:O,flight:Math.min(at,320),angle,...opts});
    const self=(at=0,opts={})=>hit(at,e.x,e.y-20,{follow:e.id,...opts});
    const aim={x:Number.isFinite(d.x)?d.x:T.x,y:Number.isFinite(d.y)?d.y:T.y};
    const volley=(count,start,gap,fn)=>{for(let i=0;i<count;i++)fn(start+i*gap,i);};
    switch(id){
      case 'fang':self(0,{dur:310});break;
      case 'lotus':volley(d.n||3,0,200,(t,i)=>self(t,{i,R:r?155:135,dur:300}));break;
      case 'shadowstep':volley(r?3:1,120,140,(t,i)=>hit(t,d.x1,d.y1-25,{i}));break;
      case 'rend':volley(r?2:1,130,290,(t,i)=>self(t,{i,forward:75,dur:440}));break;
      case 'tempest':volley(d.n||8,250,d.g||325,(t,i)=>self(t,{i,R:d.R||170,dur:420}));if(r)self(250+(d.n||8)*(d.g||325)+150,{R:(d.R||170)+30,fin:true});break;
      case 'crescent':volley(r?2:1,90,220,(t,i)=>self(t,{i,forward:40,R:d.R||190}));break;
      case 'skyfall':hit(460,d.x1,d.y1,{R:r?175:150});if(r)hit(780,d.x1,d.y1,{R:240,fin:true});break;
      case 'thousand':volley(d.n||8,80,90,(t,i)=>hit(t,T.x,T.y,{i,dur:230}));if(r)hit(80+(d.n||12)*90+120,T.x,T.y,{fin:true});break;
      case 'twindragon':volley(r?3:1,260,260,(t,i)=>hit(t,d.x1,d.y1-20,{from:i?undefined:O,flight:i?0:220,angle:a,dur:500,R:190+i*40,i}));break;
      case 'jade':{const ids=d.ids?.length?d.ids:[null];ids.forEach((id,i)=>{const q=ent(id),x=q?.x??T.x,y=q?q.y-22:T.y;hit(90+Math.min(320,Math.hypot(x-e.x,y+22-e.y)*.55)+i*40,x,y,{from:O,flight:320,angle:a,i});});break;}
      case 'skybolt':volley(r?3:1,300,260,(t,i)=>hit(t,aim.x,aim.y,{i,R:r?170:120,sky:true}));break;
      case 'mercy':case 'aegis':case 'might':case 'nirvana':case 'hawkeye':case 'gale':{
        const buff=['aegis','might','hawkeye','gale'].includes(id);
        for(const targetId of (d.ids?.length?d.ids:[e.id]).slice(0,32)){const q=ent(targetId);if(q)hit(0,q.x,q.y-8,{follow:targetId,buff,dur:buff?Math.max(1200,Math.min(d.d||8000,30000)):targetId===e.id?1250:900});}break;
      }
      case 'heavens':volley(d.n||7,350,420,(t,i)=>hit(t,aim.x,aim.y,{i,R:d.R||190,dur:550}));if(r)hit(350+(d.n||7)*420+200,aim.x,aim.y,{fin:true,R:d.R||190});break;
      case 'spiritsword':(r?[-.36,-.18,0,.18,.36]:[0]).forEach((da,i)=>fly(440,r?600:520,a+da,{flight:440,i,small:!!r}));break;
      case 'meteor':C.meteorPoints(aim.x,aim.y,d.n||5).forEach(([x,y],i)=>hit(500+i*220,x,y,{sky:true,i,R:r?150:130}));if(r)hit(500+(d.n||8)*220+300,aim.x,aim.y,{fin:true,R:220});break;
      case 'hawkshot':{const t=170+Math.min(230,Math.hypot(T.x-e.x,T.y+22-e.y)*.45);volley(d.n||1,t,110,(at,i)=>fly(at,0,a,{i,flight:t}));for(const [key,delay]of [['b',90],['e',60]]){const q=ent(d[key]);if(q)hit(t+delay,q.x,q.y-22,{from:O,flight:t,angle:a});}break;}
      case 'scatter':volley(d.v||1,300,260,(at,i)=>{const n=d.n||5;for(let j=0;j<n;j++)fly(at,d.L||420,a+(j/(n-1)-.5)*(r?.95:.65),{flight:300,i:j,small:true});});break;
      case 'skyrain':volley(d.n||7,420,220,(t,i)=>hit(t,aim.x,aim.y,{i,sky:true,R:d.R||170,dur:350}));if(r)hit(420+(d.n||7)*220+200,aim.x,aim.y,{sky:true,fin:true,R:(d.R||170)*.75});break;
      case 'deadeye':{const at=180+Math.min(160,Math.hypot(T.x-e.x,T.y+22-e.y)*.25);fly(at,0,a,{flight:at-180});(d.ids||[]).slice(1,3).forEach((id,i)=>{const q=ent(id);if(q)hit(at+120+i*60,q.x,q.y-22,{from:T,flight:120,angle:a,small:true});});break;}
      case 'rollshot':volley(d.n||3,200,90,(t,i)=>hit(t,d.x1+Math.cos(a)*440,d.y1-24+Math.sin(a)*440,{from:{x:d.x1,y:d.y1-24},flight:180,angle:a,i}));if(r)hit(320,d.x0,d.y0,{R:130,fin:true});break;
      case 'blast':C.blastPoints(aim.x,aim.y,a,r).forEach(([x,y],i)=>hit(420+i*120,x,y,{from:O,flight:420,loft:100,angle:a,i,R:r?150:170}));break;
      case 'stormphoenix':fly(880,680,a,{flight:720,R:100,dur:350});if(r)hit(1030,O.x+Math.cos(a)*680,O.y+Math.sin(a)*680,{fin:true,R:230});break;
    }
    return events;
  };
  function renderEvents(d,e,design,A,P,events,phase='impact'){
    if(!events.length)return;
    const dur=Math.max(...events.map(v=>v.at+v.dur));
    for(const layer of ['ground','top'])add(d,phase,dur,layer,(g,p)=>{
      const ms=p*dur;
      for(const v of events){
        const following=v.follow&&ent(v.follow),x=following?.x??v.x,y=following?following.y-12:v.y;
        if(v.follow&&(!following||following.dead||following.dying))continue;
        if(v.buff&&ms>v.at+1100){
          if(ms<=v.at+v.dur&&layer==='top'){
            g.save();g.translate(x,y-86);g.globalAlpha*=.55*Math.min(1,(v.at+v.dur-ms)/250);
            if(design.cls==='taoist')paper(g,0,Math.sin(ms/300)*2,0,15,P);
            else for(const side of [-1,1])feather(g,side*2,0,side>0?-.3:Math.PI+.3,14,P);
            g.restore();
          }continue;
        }
        if(v.from&&layer==='top'&&ms>=v.at-v.flight&&ms<v.at){
          const f=clamp((ms-v.at+v.flight)/v.flight),xx=mix(v.from.x,x,f),yy=mix(v.from.y,y,f)-Math.sin(f*Math.PI)*(v.loft||0),angle=Math.atan2(y-v.from.y-(v.loft||0)*Math.PI*Math.cos(f*Math.PI),x-v.from.x);
          g.save();g.globalAlpha*=.9;
          if(design.cls!=='archer')line(g,[[mix(v.from.x,x,Math.max(0,f-.18)),mix(v.from.y,y,Math.max(0,f-.18))],[xx,yy]],P.main,2+A.grade*.3);
          if(design.cls==='archer')lightArrow(g,v.from,xx,yy,angle,A,P,design.motif,f,v.small);
          else if(design.cls==='taoist')design.id==='spiritsword'?blade(g,xx,yy,angle,40+A.grade*7,P):paper(g,xx,yy,angle,22+A.grade*3,P);
          else{g.translate(xx,yy);g.rotate(angle);dragon(g,35+A.grade*5,P,f,.7);}g.restore();
        }
        if(v.sky&&layer==='top'&&ms>=v.at-240&&ms<v.at){const f=(ms-v.at+240)/240;g.save();g.globalAlpha*=.8;const yy=y-(1-f)*190;line(g,[[x-20,yy-60],[x,yy]],P.main,3);if(design.cls==='archer')arrow(g,x,yy,Math.PI/2,32,P);else paper(g,x,yy,f*3,32,P);g.restore();}
        const q=(ms-v.at)/(v.buff?1100:v.dur);if(q<0||q>1)continue;
        const R=(v.R?Math.min(v.R,220):A.R)*(v.small?.48:1)*(v.fin?1.25:1),a=d.a||0;
        g.save();g.translate(x+Math.cos(a)*(v.forward||0),y+Math.sin(a)*(v.forward||0)*.6);
        g.globalAlpha*=Math.min(1,(1-q)*4)*(v.small?.7:1);
        if(layer==='ground')ground(g,design,A,P,q,R,v);else {
          if(!v.small&&A.grade>=1)glow(g,0,-10,R*(v.fin?.8:.48),P,(.15+A.grade*.025)*(1-q));
          M[design.motif](g,{A,P,p:q,R,a,i:v.i||0,fin:!!v.fin});
        }
        g.restore();
      }
    });
  }
  const groundKinds=new Set(['steelLotus','bladeCyclone','bladeComet','mountainFang','heartLotus','tigerChains','skyLances','worldPillar','dragonThrone','jadeRain','emberFlower','mercyLotus','wardGates','starBridge','sealMeteors','nirvanaTree','threeHeavens','primalAvatar','starPrison','worldSever','heavenArsenal','phoenixSun']);
  function ground(g,design,A,P,p,R,v){
    if(!groundKinds.has(design.motif))return;
    g.save();g.scale(1,.5);g.globalAlpha*=.6*(1-p*.65);
    if(['mercyLotus','heartLotus','emberFlower','nirvanaTree','phoenixSun'].includes(design.motif))lotus(g,R*(.3+smooth(clamp(p*2))*.65),6+A.grade,P,p);
    else if(design.cls==='taoist')seal(g,R*(.4+clamp(p*3)*.5),design.motif==='threeHeavens'?3:8,P,p*.3);
    else if(['mountainFang','bladeComet','skyLances','worldPillar'].includes(design.motif))fissure(g,R,P,clamp(p*4));
    else{for(let i=0;i<3;i++)arc(g,0,0,R*(.35+i*.22),i*2+p*2,i*2+p*2+1.2,P.accent,1.4);}
    g.restore();
  }
  S.play=d=>{
    const design=SkillDesigns[d.t],e=ent(d.id);if(!design||!e)return;
    const sk=C.ALL_SKILLS[d.t],A=S.profile(sk,d),P=palettes(design,e),m=e.skillMotion;
    if(m)trail(d,e,m,A,P);
    if(sk.spear)return; // impacts only arrive through the authoritative spearBeat event
    renderEvents(d,e,design,A,P,S.timeline(d,e));
  };
  S.impact=d=>{
    const design=SkillDesigns[d.skill],e=ent(d.id);if(!design||!e)return;
    const m=e.skillMotion;if(!m||m.skill!==d.skill)return;
    const A=S.profile(C.ALL_SKILLS[d.skill],{r:m.rank,sl:m.sl}),P=palettes(design,e);
    renderEvents({...d,t:d.skill},e,design,A,P,[{at:0,x:d.x,y:d.y-20,dur:d.final?760:300,i:d.step||0,small:!d.final,fin:d.final,R:d.area?.radius||A.R}]);
    if(d.final&&e.id===G.myId)FX.shake=Math.max(FX.shake,Math.min(5,1+A.grade));
  };
  S.ritual=(d,r,e)=>{
    const design=SkillDesigns[d.skill];if(!design||!e)return;
    const A=S.profile(C.ALL_SKILLS[d.skill],d),P=palettes(design,e);
    if(d.t==='ritualStart'){
      if(e.skillMotion)trail(d,e,e.skillMotion,A,P);
      const events=Array.from({length:r.hits},(_,i)=>({at:(r.first??r.windup)+i*r.gap,x:r.zx,y:r.zy-20,dur:Math.min(500,r.gap+170),i,R:r.R*.6}));
      renderEvents(d,e,design,A,P,events,'ritualMove');
    }else{
      S.cancel(d.id,d.skill,true);
      renderEvents(d,e,design,A,P,[{at:0,x:d.x,y:d.y-12,dur:1450,R:r.R,fin:true}],'ritualFinish');
      if(e.id===G.myId)FX.shake=Math.max(FX.shake,C.ALL_SKILLS[d.skill].lvl>=130?9:6);
      FX.burst(d.x,d.y-12,12+A.grade*2,[P.main,P.accent,P.core],{speed:130,up:80,life:650,size:2,spark:true});
    }
  };
  // Twin blades: animal cuts, petals, dimensional seams, blades and paired dragons.
  M.tiger=(g,{P,p,R,a,A})=>{
    g.rotate(a-.35);for(let j=-1;j<=1;j++){g.beginPath();g.moveTo(-R*.65,j*15-R*.4);g.quadraticCurveTo(R*.8,j*15-R*.3,R*.5,j*15+R*.4);g.strokeStyle=j?P.main:P.core;g.lineWidth=(j?3:5)*(1-p*.6);g.stroke();}
    if(A.grade>0){poly(g,[[R*.05,-18],[R*.2,-24],[R*.14,-12]],P.accent);poly(g,[[R*.3,-18],[R*.46,-24],[R*.4,-12]],P.accent);}burst(g,R*.5,A.n,P,p);
  };
  M.steelLotus=(g,{P,p,R,A,i})=>{
    g.scale(1,.65);for(let k=0;k<6+A.grade*2;k++){const a=k*TAU/(6+A.grade*2)+p*2+i*.3,r=R*(.3+p*.25);blade(g,Math.cos(a)*r,Math.sin(a)*r,a+Math.PI/2,26+A.grade*7,P);}
    lotus(g,R*.7,6,P,p);glow(g,0,0,R*.3,P,.3);
  };
  M.shadowGate=(g,{P,p,R,a,A,i})=>{
    g.rotate(a);const w=R*(.15+Math.sin(p*Math.PI)*.2);poly(g,[[-w,-R*.8],[w*.5,-R*.4],[w,R*.7],[-w*.6,R*.35]],P.deep+'dd',P.accent);
    for(let k=0;k<2+A.grade;k++){const y=(k-(1+A.grade)/2)*12;blade(g,R*(p-.4),y,(i%2?-.5:.5),R*.65,P);}
    line(g,[[-R*.8,0],[R*.9,0]],P.core,2);glow(g,0,0,R*.5,P,.25);
  };
  M.brokenCross=(g,{P,p,R,a,A,i})=>{
    g.rotate(a+(i?.4:0));for(const side of [-1,1]){g.save();g.rotate(side*.7);poly(g,[[-R,0],[R*.1,-6],[R,0],[R*.1,6]],P.core,P.main);g.restore();}
    for(let k=0;k<A.n;k++){const a=k*TAU/A.n,x=Math.cos(a)*R*p,y=Math.sin(a)*R*p*.6;poly(g,[[x-5,y-8],[x+7,y-5],[x+4,y+6],[x-4,y+4]],P.deep,P.accent);}
  };
  M.bladeCyclone=(g,{P,p,R,A,i,fin})=>{
    for(let row=0;row<(fin?4:3);row++){const rr=R*(.7-row*.16);for(let k=0;k<4+A.grade;k++){const a=k*TAU/(4+A.grade)+p*3+i*.5+row;blade(g,Math.cos(a)*rr,Math.sin(a)*rr*.4-row*24,a+Math.PI/2,24+A.grade*4,P);}}
    for(let j=0;j<3;j++){g.save();g.scale(1,.4);arc(g,0,-j*45,R*(.8-j*.16),p*5+j,p*5+j+4,P.main,2);g.restore();}
  };
  M.twinMoons=(g,{P,p,R,a,i,A})=>{
    g.rotate(a);for(const side of [-1,1]){g.save();g.translate(side*R*.18,side*10);g.scale(1,.6);g.rotate((i?-1:1)*(p*1.7-.7));
      g.beginPath();g.arc(0,0,R*.65,-1.3,1.3);g.arc(-R*.18,0,R*.7,1.13,-1.13,true);g.closePath();g.fillStyle=P.main+'99';g.fill();g.strokeStyle=P.core;g.stroke();g.restore();}
    for(let k=0;k<A.grade;k++)feather(g,-R*.3+k*12,R*.3,k*.4,18,P);
  };
  M.bladeComet=(g,{P,p,R,A})=>{
    for(const s of [-1,1])blade(g,s*16,-(1-clamp(p*4))*100,Math.PI/2+s*.15,R*.75,P);
    fissure(g,R,P,clamp(p*4));for(let k=0;k<A.n;k++){const a=k*TAU/A.n;blade(g,Math.cos(a)*R*p,Math.sin(a)*R*p*.45,a,16+A.grade*3,P);}
    glow(g,0,-5,R*.55*(1-p),P,.65);
  };
  M.mirrorBlades=(g,{P,p,R,A,i,fin})=>{
    const n=fin?8+A.grade:3;for(let k=0;k<n;k++){const a=k*TAU/n+i*2.399,r=R*(.85-p*.5);blade(g,Math.cos(a)*r,Math.sin(a)*r*.6,a+Math.PI,R*.55,P);}
    const a=i*2.399;line(g,[[Math.cos(a)*-R,Math.sin(a)*-R*.6],[Math.cos(a)*R,Math.sin(a)*R*.6]],P.core,3);if(fin)seal(g,R,6,P,p);
  };
  M.twinDragons=(g,{P,p,R})=>{
    for(const side of [-1,1]){g.save();g.translate(side*R*.25,side*12);g.scale(side*.7,.7);dragon(g,R,P,p,1.1);g.restore();}glow(g,0,-10,R*.35,P,.35);
  };
  M.starPrison=(g,{P,p,R,A,i,fin})=>{
    const n=7;for(let k=0;k<n;k++){const a=k*TAU/n-Math.PI/2,r=R*(fin?.8:.58);blade(g,Math.cos(a)*r,Math.sin(a)*r*.55-(1-clamp(p*3))*90,-Math.PI/2,fin?90:45,P);}
    g.save();g.scale(1,.55);const points=Array.from({length:8},(_,k)=>{const a=((k*3+i)%7)*TAU/7-Math.PI/2;return[Math.cos(a)*R*.8,Math.sin(a)*R*.8];});line(g,points,P.main,2);g.restore();if(fin)burst(g,R,A.n*2,P,p);
  };
  M.worldSever=(g,{P,p,R,A,fin})=>{
    g.save();g.rotate(-.6);const L=R*(.6+clamp(p*3)),w=(fin?25:10)*(1-p*.7);poly(g,[[-L,0],[-L*.15,-w],[L,0],[L*.15,w]],P.deep,P.accent);line(g,[[-L,0],[L,0]],P.core,fin?6:3);g.restore();
    for(const side of [-1,1]){g.save();g.translate(side*R*p*.6,0);g.rotate(side*(.5+p));blade(g,0,0,-Math.PI/2,R*.85,P);g.restore();}burst(g,R,A.n,P,p,.3);
  };
  // Spear arts. These motifs appear only on server-confirmed spearBeat events.
  M.cloudNeedle=(g,{P,p,R,a,A})=>{
    g.rotate(a);blade(g,R*.3,0,0,R*.9,P,true);for(let k=0;k<3+A.grade;k++){g.beginPath();g.ellipse(-R*.3+k*10,0,5,12+k*2,0,0,TAU);g.strokeStyle=k%2?P.main:P.accent;g.lineWidth=1;g.stroke();}burst(g,R*.45,5,P,p);
  };
  M.mountainFang=(g,{P,p,R,A})=>{
    for(let k=-2;k<=2;k++){const h=(1-Math.abs(k)*.15)*R*clamp(p*5);poly(g,[[k*R*.22-13,13],[k*R*.22,-h],[k*R*.22+17,9]],P.deep+'cc',P.accent);blade(g,k*R*.22,-h,-Math.PI/2,18+A.grade*3,P,true);}fissure(g,R,P,clamp(p*4));
  };
  M.phantomLances=(g,{P,p,R,a,A,i,fin})=>{
    g.rotate(a);for(let k=0;k<(fin?3+A.grade:2);k++){const y=(k-(fin?2:1)/2)*16;g.save();g.globalAlpha*=k?.55:1;blade(g,R*(.5-p*.15),y,0,R*(k?.7:1),P,true);g.restore();}line(g,[[-R,0],[R*.7,0]],P.core,2);burst(g,R*.6,5+i,P,p);
  };
  M.drillDragon=(g,{P,p,R,a,A})=>{
    g.rotate(a);blade(g,R*.5,0,0,R,P,true);for(let k=0;k<3+A.grade;k++){g.beginPath();g.ellipse(-R*.5+k*R*.17,0,8,8+k*3,p*3,0,TAU);g.strokeStyle=k%2?P.main:P.accent;g.lineWidth=2;g.stroke();}
    for(const side of [-1,1])poly(g,[[R*.25,side*9],[R*.6,side*22],[R*.7,side*12]],P.accent);
  };
  M.judgmentGate=(g,{P,p,R,A,fin})=>{
    gate(g,0,20,R*(fin?1.4:.8),P,p);blade(g,0,-15-(1-clamp(p*4))*100,Math.PI/2,R,P,true);for(let k=0;k<A.n;k++){const a=k*TAU/A.n;paper(g,Math.cos(a)*R*.65,Math.sin(a)*R*.4-20,a,15,P);}glow(g,0,0,R*.4,P,.4);
  };
  M.heartLotus=(g,{P,p,R,a,A})=>{
    g.save();g.scale(1,.55);lotus(g,R*.75,8+A.grade,P,p);g.restore();for(const side of [-1,1]){g.save();g.rotate(a+side*(.8+p));blade(g,0,0,0,R*.8,P,true);g.restore();}burst(g,R*.8,A.n,P,p);
  };
  M.tigerChains=(g,{P,p,R,A})=>{
    for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;for(let j=0;j<7+A.grade;j++){const r=R*(j+1)/(7+A.grade)*(1-p*.35),x=Math.cos(a)*r,y=Math.sin(a)*r*.55;g.beginPath();g.ellipse(x,y,5,3,a,0,TAU);g.strokeStyle=j%2?P.accent:P.main;g.lineWidth=1.5;g.stroke();}blade(g,Math.cos(a)*R,Math.sin(a)*R*.55,a+Math.PI,25,P,true);}seal(g,R*.3,4,P,0);
  };
  M.huntDragon=(g,{P,p,R,a,A,fin})=>{
    g.save();g.rotate(a);g.scale(fin?1:.65,fin?1:.65);dragon(g,R*.9,P,p,1.25);g.restore();blade(g,R*.25,0,a,R,P,true);if(A.grade>1)lightning(g,0,0,R*.8,P,p);
  };
  M.skyLances=(g,{P,p,R,A,fin})=>{
    for(let k=0;k<3+A.grade;k++){const a=k*2.399,r=R*Math.sqrt(k/(3+A.grade))*.75;blade(g,Math.cos(a)*r,Math.sin(a)*r*.45-(1-clamp(p*4))*130,Math.PI/2,fin?90:40,P,true);}fissure(g,R,P,clamp(p*4));glow(g,0,-10,R*.4,P,.5);
  };
  M.worldPillar=(g,{P,p,R,A,fin})=>{
    const drop=1-clamp(p*4),h=fin?250:140,rise=smooth(clamp(p*3-.25));
    g.save();g.scale(1,.42);for(let k=0;k<3;k++){g.beginPath();g.arc(0,0,R*(.3+clamp(p*2)*.7)*(1+k*.18),0,TAU);g.strokeStyle=k?P.main:P.core;g.lineWidth=(3-k)*(1-p*.6);g.stroke();}g.restore();
    fissure(g,R,P,clamp(p*4));
    const n=fin?10:6;for(let k=0;k<n;k++){const b=k*TAU/n+.3,L=(fin?70:40)*rise;if(L>2)blade(g,Math.cos(b)*R*.72,Math.sin(b)*R*.36-L*.15,-Math.PI/2+Math.cos(b)*.35,L,P,true);}
    if(drop<1){const pts=[];for(let i=0;i<=40;i++){const t=i/40,b=t*TAU*2.2+p*4;pts.push([Math.cos(b)*(26+t*10),-t*h*rise+Math.sin(b)*6]);}line(g,pts,P.deep,10);line(g,pts,P.main,6);line(g,pts,P.accent,1.4);
      const [x,y]=pts.at(-1);poly(g,[[x-12,y+4],[x+6,y-10],[x+22,y-2],[x+8,y+8]],P.main,P.core);for(const s2 of [-1,1])line(g,[[x+4,y-6],[x+s2*10,y-22]],P.accent,2);}
    bigSpear(g,0,-drop*180,h,P);glow(g,0,-10,R*.5*(1-p*.5),P,.55);
  };
  M.dragonThrone=(g,{P,p,R,A,i,fin})=>{
    // Each windup hit: one spear rains down into the field; the dragon rises in a column above the centre.
    g.save();g.scale(1,.42);for(let k=0;k<2;k++){g.beginPath();g.arc(0,0,R*(.55+k*.3)*(.6+clamp(p*2)*.4),0,TAU);g.strokeStyle=k?P.main:P.core;g.lineWidth=2-k*.5;g.stroke();}g.restore();
    fissure(g,R*.8,P,clamp(p*4));
    const rain=fin?0:2+Math.min(3,A.grade);for(let k=0;k<rain;k++){const b=(fract(i*7+k)*TAU),r=R*(.2+fract(i*3+k*5)*.6),x=Math.cos(b)*r,y=Math.sin(b)*r*.45,drop=1-clamp(p*3.5-k*.15);
      bigSpear(g,x,y-drop*200,70+A.grade*6,P);if(drop<=0){g.save();g.translate(x,y);g.scale(1,.4);g.beginPath();g.arc(0,0,18*(1+p),0,TAU);g.strokeStyle=P.core;g.lineWidth=2*(1-p);g.stroke();g.restore();}}
    coil(g,0,0,fin?230:150,fin?48:32,P,p,fin?2.6:2);
    if(fin){for(let k=0;k<7;k++){const b=k*TAU/7,r=k?R*.6:0,L=k?110:240;bigSpear(g,Math.cos(b)*r,Math.sin(b)*r*.45-(1-clamp(p*3-k*.06))*240,L,P);}lightning(g,0,0,230,P,p);burst(g,R,A.n,P,p);}
  };

  // Archer arts: actual projectile paths plus distinctly shaped impact artwork.
  M.falcon=(g,{P,p,R,a,A})=>{
    g.rotate(a);const u=clamp(p*2.5);
    g.save();g.scale(.42,1);for(let k=0;k<1+Math.min(2,A.grade);k++){g.beginPath();g.arc(0,0,R*(.25+u*.45)+k*9,0,TAU);g.strokeStyle=k?P.main:P.core;g.lineWidth=(3-k)*(1-p*.7);g.stroke();}g.restore();
    arrow(g,R*.12,0,0,R*.55,P);
    for(let k=0;k<4+A.grade;k++){const b=(k/(3+A.grade)-.5)*1.6+Math.PI;line(g,[[Math.cos(b)*R*.2*u,Math.sin(b)*R*.2*u],[Math.cos(b)*R*(.35+u*.4),Math.sin(b)*R*(.35+u*.4)]],k%2?P.accent:P.core,1.6*(1-p));}
    glow(g,0,0,R*.4*(1-p),P,.5);
  };
  M.featherFan=(g,{P,p,R,a,A,i})=>{g.rotate(a);for(let k=-2;k<=2;k++)feather(g,-R*.3,0,k*.27,R*(.6+p*.3),P);arrow(g,R*.5,0,0,R*.7,P);burst(g,R*.35,4,P,p,i);};
  M.solarEye=(g,{P,p,R,A})=>{
    g.translate(0,-48);g.beginPath();g.moveTo(-R*.7,0);g.quadraticCurveTo(0,-R*.55,R*.7,0);g.quadraticCurveTo(0,R*.45,-R*.7,0);g.strokeStyle=P.accent;g.lineWidth=2;g.stroke();glow(g,0,0,R*.26,P,.7);arc(g,0,0,R*.22,0,TAU,P.core,2);burst(g,R*.75,A.n,P,p);for(const side of [-1,1])feather(g,side*R*.65,0,side>0?0:Math.PI,R*.4,P);
  };
  M.windSteps=(g,{P,p,R,A})=>{
    for(const side of [-1,1]){g.save();g.translate(side*19,8);g.rotate(side*.25);wings(g,R*.6,P,p,3+A.grade);g.restore();}for(let j=0;j<3;j++){g.save();g.scale(1,.4);arc(g,0,-j*35,R*(.5+j*.2),p*5+j,p*5+j+2.7,P.main,2);g.restore();}
  };
  M.jadeRain=(g,{P,p,R,A,i,fin})=>{
    for(let k=0;k<5+A.grade*2;k++){const a=k*2.399+i,rr=R*Math.sqrt((k+.5)/(5+A.grade*2))*.8,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.5;arrow(g,x,y-(1-clamp(p*4))*100,Math.PI/2,fin?65:35,P);if(p>.2)for(let j=0;j<2;j++)feather(g,x,y-10-j*9,(j?1:-1)*.7,14,P);}
  };
  M.eclipseArrow=(g,{P,p,R,a,A})=>{
    g.rotate(a);g.save();g.scale(.45,1);arc(g,0,0,R*.55,0,TAU,P.accent,3);glow(g,0,0,R*.5,P,.2);g.restore();poly(g,[[-R,0],[0,-6],[R,0],[0,6]],P.core,P.main);arrow(g,R*.6,0,0,R,P);for(let k=0;k<A.n;k++){const b=k*TAU/A.n;line(g,[[Math.cos(b)*R*.6,Math.sin(b)*R*.6],[Math.cos(b)*R*.8,Math.sin(b)*R*.8]],P.main,1);}
  };
  M.windWheel=(g,{P,p,R,a,A,i,fin})=>{
    g.rotate(a);for(let k=0;k<4+A.grade;k++){const b=k*TAU/(4+A.grade)+p*4;feather(g,Math.cos(b)*R*.4,Math.sin(b)*R*.4,b+Math.PI/2,R*.5,P);}arrow(g,R*.3,0,0,R*.7,P);if(fin)burst(g,R,A.n,P,p);
  };
  M.emberFlower=(g,{P,p,R,A})=>{
    const fire={...P,main:'#f27635',core:'#fff2bd'};lotus(g,R*(.25+clamp(p*3)*.6),5+A.grade,fire,p);glow(g,0,0,R*.55,fire,.6*(1-p));for(let k=0;k<A.n;k++){const a=k*TAU/A.n;feather(g,Math.cos(a)*R*p,Math.sin(a)*R*p*.6-25*Math.sin(p*Math.PI),a,22,fire);}
  };
  M.thunderBird=(g,{P,p,R,A,fin})=>{
    g.save();g.translate(0,-30);wings(g,R*(fin?1:.75),P,p,6+A.grade);poly(g,[[0,25],[-10,-5],[0,-35],[11,-9],[4,12]],P.core,P.accent);for(const s of [-1,0,1])feather(g,s*5,16,Math.PI/2+s*.28,R*.8,P);g.restore();for(let k=0;k<(fin?5:2);k++)lightning(g,(k-(fin?2:.5))*R*.3,15,70+R*.5,P,p);
  };
  M.heavenArsenal=(g,{P,p,R,A,i,fin})=>{
    for(let j=0;j<3;j++){const yy=-70-j*28,rr=R*(.9-j*.15);arc(g,0,yy,rr,Math.PI*1.12,Math.PI*1.88,P.accent,1.5);for(let k=0;k<5+A.grade;k++){const a=Math.PI*1.12+k/(4+A.grade)*Math.PI*.76;arrow(g,Math.cos(a)*rr,yy+Math.sin(a)*rr*.25,Math.PI/2,fin?65:35,P);}}
    if(fin)for(let k=0;k<A.n;k++)arrow(g,(fract(k)-.5)*R*1.5,15-(1-clamp(p*3))*100,Math.PI/2,35,P);
  };
  M.phoenixSun=(g,c)=>{
    const {P,p,R,A,fin}=c;glow(g,0,-60,R*.9,P,.3);arc(g,0,-60,R*.65,0,TAU,P.accent,3);g.save();g.translate(0,-30);M.thunderBird(g,{...c,R:R*.85});g.restore();for(let k=0;k<A.n;k++){const a=k*TAU/A.n;feather(g,Math.cos(a)*R*.8,Math.sin(a)*R*.65-60,a+Math.PI/2,R*.3,P);}if(fin)lotus(g,R*.8,8,P,p);
  };
  // Taoist arts: brush script, talisman architecture, lotus life and spirit avatars.
  M.inkComet=(g,{P,p,R,a,A})=>{
    g.rotate(a);paper(g,0,0,-.2+p*.5,R*.7,P);for(let k=0;k<3+A.grade;k++){const x=-R*.6-k*9;line(g,[[x,-10+k*7],[x+12,-15+k*7],[x+6,4+k*7]],P.main,2);}burst(g,R*.65,A.n,P,p);
  };
  M.thunderScript=(g,{P,p,R,A,i})=>{
    paper(g,0,-R*.5,p*.15,R*.7,P);for(let k=0;k<3+A.grade;k++){const a=k*TAU/(3+A.grade);lightning(g,Math.cos(a)*R*.6,Math.sin(a)*R*.3,R*(.65+fract(k+i)*.5),P,p);}seal(g,R*.55,8,P,p*.2);
  };
  M.mercyLotus=(g,{P,p,R,A})=>{
    g.save();g.scale(1,.7);lotus(g,R*(.4+Math.sin(p*Math.PI)*.35),8+A.grade,P,p);g.restore();for(let k=0;k<A.n;k++){const a=k*TAU/A.n;paper(g,Math.cos(a)*R*.5,Math.sin(a)*R*.2-p*65,a*.15,14,P);}glow(g,0,-35,R*.45,P,.3);
  };
  M.wardGates=(g,{P,p,R,A})=>{
    for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;gate(g,Math.cos(a)*R*.7,Math.sin(a)*R*.35,R*.5,P,p);}g.save();g.scale(1,.5);seal(g,R*.85,8,P,0);g.restore();paper(g,0,-65,0,32+A.grade*3,P);
  };
  M.starBridge=(g,{P,p,R,A,i,fin})=>{
    const pts=Array.from({length:7},(_,k)=>[Math.cos(k*TAU/7+i*.1)*R*.7,Math.sin(k*TAU/7+i*.1)*R*.4]);line(g,pts.concat([pts[0]]),P.main,2);for(const [x,y]of pts){paper(g,x,y-25,0,22+A.grade*2,P);glow(g,x,y,10,P,.7);}gate(g,0,10,R*(fin?.9:.5),P,p);
  };
  M.sevenSwords=(g,{P,p,R,a,A})=>{
    g.rotate(a);for(let k=0;k<3+A.grade;k++){const yy=(k-(2+A.grade)/2)*15,xx=-Math.abs(yy)*.5;blade(g,xx,yy,0,R*.65,P);paper(g,xx-R*.4,yy,Math.PI/2,17,P);}line(g,[[-R,0],[R*.7,0]],P.accent,1.5);
  };
  M.warBanners=(g,{P,p,R,A})=>{
    for(const side of [-1,1]){const x=side*R*.6,h=70+A.grade*9;line(g,[[x,12],[x,-h]],P.accent,3);poly(g,[[x,-h+8],[x+side*36,-h+12+Math.sin(p*8)*5],[x+side*28,-h+49],[x,-h+45]],P.deep+'dd',P.accent);paper(g,x+side*15,-h+27,side*.1,22,P);}glow(g,0,-38,R*.4,P,.3);seal(g,R*.4,4,P,p*.2);
  };
  M.sealMeteors=(g,{P,p,R,A,i,fin})=>{
    const fire={...P,main:'#ec7a40',core:'#fff0bd'};g.save();g.translate(0,-(1-clamp(p*4))*70);g.rotate(i*.7+p);seal(g,R*.45,6,fire,p);paper(g,0,0,0,R*.6,fire);g.restore();fissure(g,R,fire,clamp(p*4));for(let k=0;k<A.n;k++){const a=k*TAU/A.n;paper(g,Math.cos(a)*R*p,Math.sin(a)*R*p*.5-20*Math.sin(p*Math.PI),a+p,15,fire);}if(fin)glow(g,0,0,R*.6,fire,.5);
  };
  M.nirvanaTree=(g,{P,p,R,A})=>{
    const h=R*(.8+clamp(p*3)*.5);line(g,[[0,5],[0,-h]],P.accent,4);for(let k=0;k<3+A.grade;k++){const yy=-20-k*h/(4+A.grade),spread=R*(.6-k*.06);for(const side of [-1,1]){line(g,[[0,yy],[side*spread*.6,yy-12],[side*spread,yy-30]],P.accent,2);g.save();g.translate(side*spread,yy-30);lotus(g,13+A.grade,5,P,p);g.restore();}}g.save();g.scale(1,.5);lotus(g,R*.65,8,P,p);g.restore();
  };
  M.threeHeavens=(g,{P,p,R,A,i,fin})=>{
    for(let k=0;k<3;k++){const a=-Math.PI/2+k*TAU/3;gate(g,Math.cos(a)*R*.7,Math.sin(a)*R*.35,R*(fin?.85:.6),P,p);}
    g.save();g.scale(1,.5);seal(g,R*.8,3,P,Math.PI/2);seal(g,R*.55,6,P,-p*.5);g.restore();for(let k=0;k<A.n;k++){const a=k*TAU/A.n;paper(g,Math.cos(a)*R*.5,Math.sin(a)*R*.3-30,a,20,P);}if(fin)lightning(g,0,0,190,P,p);
  };
  M.primalAvatar=(g,{P,p,R,A,fin})=>{
    // Brush-drawn spirit silhouette with a yin-yang heart and four pairs of arms.
    g.save();g.translate(0,-R*.35);g.globalAlpha*=.7;glow(g,0,-R*.6,R*.8,P,.3);
    arc(g,0,-R*.72,R*.27,0,TAU,P.accent,1.4);
    poly(g,[[-R*.11,-R*.91],[-R*.16,-R*.77],[-R*.09,-R*.58],[0,-R*.54],[R*.09,-R*.58],[R*.16,-R*.77],[R*.11,-R*.91]],P.main+'66',P.accent);
    for(const side of [-1,1]){line(g,[[side*R*.04,-R*.74],[side*R*.09,-R*.73]],P.core,2);poly(g,[[side*R*.12,-R*.51],[side*R*.34,-R*.35],[side*R*.22,-R*.06],[side*R*.4,R*.36],[side*R*.1,R*.29]],P.main+'44',P.accent);}
    poly(g,[[-R*.11,-R*.93],[-R*.09,-R*1.06],[0,-R*.98],[R*.09,-R*1.06],[R*.11,-R*.93]],P.accent+'88',P.core);
    line(g,[[0,-R*.68],[R*.02,-R*.62],[-R*.02,-R*.62]],P.accent,1.2);
    for(let k=0;k<4;k++)for(const side of [-1,1]){const x=side*R*(.4+k*.12),y=-R*.2+k*R*.12;line(g,[[side*R*.1,-R*.32],[x*.7,y-20],[x,y]],P.accent,3);paper(g,x,y,-side*.4,30,P);}
    g.beginPath();g.arc(0,-R*.16,R*.19,0,TAU);g.fillStyle=P.deep;g.fill();arc(g,0,-R*.16,R*.19,0,Math.PI,P.core,5);arc(g,0,-R*.16,R*.19,Math.PI,TAU,P.main,5);g.restore();
    g.save();g.scale(1,.5);lotus(g,R*.85,12,P,p);seal(g,R*.95,8,P,p*.2);g.restore();if(fin)burst(g,R,A.n*2,P,p);
  };
})();
