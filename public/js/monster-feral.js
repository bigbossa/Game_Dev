// Feral bestiary. Feet and combat bounds match the existing eleven archetypes.
// Species keep their own materials; silhouette, anatomy and expression replace the plush models.
(function(){
 const M=window.MonsterArt,TAU=Math.PI*2,INK='#1b2228',BONE='#d3c6a8';
 function poly(g,pts,col,edge=true){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fillStyle=col||'#454a4a';g.fill();if(edge){g.strokeStyle=INK;g.lineWidth=.65;g.stroke();}}
 function line(g,p,col,w=2){g.beginPath();p.forEach((v,i)=>i?g.lineTo(...v):g.moveTo(...v));g.strokeStyle=col||INK;g.lineWidth=w;g.lineJoin='round';g.lineCap='round';g.stroke();}
 function mass(g,x,y,rx,ry,col){
  const grad=g.createLinearGradient(x-rx,y-ry,x+rx,y+ry);grad.addColorStop(0,col||'#64665e');grad.addColorStop(.45,col||'#64665e');grad.addColorStop(1,'#22282a');
  const p=[[-.8,-.6],[-.25,-1],[.58,-.85],[1,-.2],[.8,.6],[.12,1],[-.75,.68],[-1,-.1]].map(([a,b])=>[x+a*rx,y+b*ry]);poly(g,p,grad);
  // Restrained surface facets and scratches give armour, scales and fur depth at game scale.
  g.save();g.clip();const light=g.createRadialGradient(x-rx*.35,y-ry*.55,0,x,y,Math.max(rx,ry));light.addColorStop(0,'rgba(232,220,189,.19)');light.addColorStop(1,'rgba(8,14,18,.18)');g.fillStyle=light;g.fillRect(x-rx,y-ry,rx*2,ry*2);
  poly(g,[[x-rx*.8,y-ry*.6],[x+rx*.1,y-ry*.1],[x+rx*.65,y+ry*.85],[x-rx*.8,y+ry]],'rgba(9,15,18,.10)',false);
  for(let i=0;i<9;i++){const xx=x+Math.sin(i*12.7+x)*rx*.85,yy=y+Math.cos(i*7.3+y)*ry*.8;line(g,[[xx,yy],[xx+2,yy+2.5]],i%3?'rgba(9,15,18,.17)':'rgba(238,224,189,.2)',.5);}
  g.restore();line(g,[[x-rx*.75,y-ry*.55],[x-rx*.2,y-ry*.87],[x+rx*.5,y-ry*.72]],'rgba(245,225,190,.22)',.7);
 }
 function spike(g,x,y,dx,dy,col=BONE,w=4){poly(g,[[x-w,y],[x+dx,y+dy],[x+w,y+2]],col);}
 function eye(g,x,y,k=1,col='#ee8849'){
  for(const side of [-1,1]){poly(g,[[x+side*2*k,y],[x+side*10*k,y-3*k],[x+side*8*k,y+2*k],[x+side*3*k,y+2*k]],col,false);line(g,[[x+side*2*k,y-2*k],[x+side*11*k,y-5*k]],INK,2*k);}
 }
 function maw(g,x,y,w=12,fangs=true){poly(g,[[x-w,y-2],[x+w,y-2],[x+w*.7,y+5],[x-w*.65,y+4]],'#130f14');if(fangs)for(const s of [-1,1])spike(g,x+s*w*.65,y-1,0,7,BONE,2);}
 function move(g,t,s){const p=s.moving&&!s.casting?Math.sin(t*9+(s.seed||0)):0;g.translate((s.atk||0)*6,-Math.abs(p)*1.4+(s.casting?1+Math.sin(t*7)*.7:0));return p;}
 function claws(g,x,y,col=BONE){for(let i=0;i<3;i++)spike(g,x-4+i*4,y,3,4,col,1.6);}
 function plates(g,x,y,n,col){for(let i=0;i<n;i++)poly(g,[[x-10,y+i*5],[x+10,y+i*5],[x+7,y+5+i*5],[x-7,y+5+i*5]],col);}
 function scars(g,x,y){for(let i=0;i<3;i++)line(g,[[x+i*3,y],[x-3+i*3,y+8]],'#a79a7b',.7);}
 M.wisp=(g,t,s,L)=>{
  g.save();g.translate(0,-24+Math.sin(t*2+(s.seed||0))*2);
  for(const side of [-1,1])poly(g,[[side*10,-10],[side*30,-21],[side*24,4],[side*41,15],[side*13,10]],L.c2);
  poly(g,[[-19,-12],[-12,-29],[8,-30],[22,-15],[18,5],[9,27],[1,15],[-11,24],[-8,8],[-20,0]],L.c1);
  eye(g,0,-10,1.2,L.eye||'#a6e5ef');maw(g,0,2,7);
  for(const side of [-1,1])spike(g,side*13,-21,side*8,-13,L.horn||'#748c94',3);
  g.restore();
 };
 M.boar=(g,t,s,L)=>{
  g.save();const step=move(g,t,s);
  for(const [x,k]of [[-23,1],[-9,-1],[14,-1],[28,1]]){mass(g,x,-9-step*k*2,5,10,L.leg||L.mane);claws(g,x,-1-step*k*2,'#57585a');}
  mass(g,-7,-25,31,21,L.body);
  for(let i=0;i<6;i++)spike(g,-30+i*8,-39,2,-8-i%2*5,L.armor||L.mane,5);
  mass(g,23,-24,21,19,L.head);mass(g,37,-20,12,8,L.snout);
  spike(g,15,-39,-8,-13,L.back,5);spike(g,31,-39,4,-12,L.back,4);
  eye(g,27,-30,.75,L.eye||'#ff9b52');maw(g,38,-14,8,false);
  for(const x of [28,43])poly(g,[[x-3,-12],[x-1,-23],[x+5,-30],[x+2,-13]],BONE);
  scars(g,-18,-27);line(g,[[-35,-23],[-43,-31],[-45,-23]],L.mane,3);g.restore();
 };
 M.wolf=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);
  poly(g,[[-22,-24],[-48,-30],[-55,-42],[-44,-37],[-25,-37]],L.top);
  for(const [x,k]of [[-24,1],[-11,-1],[15,-1],[27,1]]){line(g,[[x,-25],[x-4,-13-p*k*2],[x+1,-3-p*k*2]],L.bottom,6);claws(g,x+2,-2-p*k*2);}
  mass(g,-4,-29,30,15,L.top);mass(g,17,-32,14,20,L.bottom);
  for(let i=0;i<5;i++)spike(g,4-i*6,-39,-7,-8,L.top,5);
  mass(g,25,-39,17,13,L.top);spike(g,16,-47,-4,-13,L.top,5);spike(g,31,-47,4,-12,L.top,4);
  mass(g,38,-32,13,7,L.bottom);eye(g,29,-41,.75,L.eye);maw(g,39,-28,10);poly(g,[[46,-36],[51,-33],[46,-30]],L.dark);
  if(L.stripes||L.spots)for(let i=0;i<5;i++)line(g,[[-23+i*7,-37],[-27+i*7,-26]],L.stripes||L.spots,L.stripes?3:2);
  scars(g,11,-32);g.restore();
 };
 M.golem=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);
  for(const k of [-1,1]){mass(g,k*15,-11-p*k,12,13,L.leg);mass(g,k*31,-38+p*k,15,22,L.limb);mass(g,k*36,-23+p*k,13,12,L.rock);spike(g,k*29,-52,k*12,-17,L.moss,8);}
  mass(g,0,-44,28,29,L.rock);plates(g,0,-35,4,L.limb);mass(g,0,-72,20,17,L.head);
  eye(g,0,-73,1.2,L.eye);line(g,[[-10,-64],[0,-61],[9,-65]],INK,3);
  for(const side of [-1,1])line(g,[[side*5,-54],[side*14,-45],[side*9,-37],[side*17,-28]],L.eye,1.4);
  poly(g,[[0,-58],[7,-48],[0,-39],[-7,-48]],L.eye);g.restore();
 };
 M.serpent=(g,t,s,L)=>{
  g.save();move(g,t,s);line(g,[[-6,-10],[-33,-7],[-44,-17],[-33,-23]],L.body,10);mass(g,0,-10,27,9,L.body);
  if(L.hood)poly(g,[[-8,-13],[-20,-39],[-8,-52],[17,-50],[32,-31],[19,-14]],L.mark);
  mass(g,9,-27,11,20,L.body);plates(g,10,-31,4,L.belly);mass(g,12,-43,21,10,L.body);
  eye(g,16,-44,.9,L.eye);maw(g,20,-37,10);line(g,[[25,-32],[30,-27],[35,-29]],'#ac3a47',1);
  for(let i=0;i<4;i++)spike(g,-7+i*7,-49,1,-5,L.horn||L.mark,3);g.restore();
 };
 M.insect=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);
  for(const k of [-1,1])for(let i=0;i<4;i++)line(g,[[k*10,-24],[k*(24+i*3),-35+i*6],[k*(34+i*2),-4-p*k*2]],L.leg,3);
  mass(g,0,-25,24,16,L.shell);plates(g,0,-35,4,L.dark);mass(g,10,-15,15,10,L.dark);
  for(const k of [-1,1]){poly(g,[[k*14,-17],[k*27,-13],[k*22,-2],[k*15,-11]],L.sting||BONE);eye(g,10,-17,.6,'#ed6343');}
  if(L.kind==='scorpion'){line(g,[[-14,-29],[-31,-43],[-24,-57],[-5,-53]],L.shell,6);spike(g,-5,-53,9,11,L.sting,5);}
  else for(const k of [-1,1])line(g,[[k*8,-33],[k*15,-44],[k*22,-45]],L.leg,1.5);
  g.restore();
 };
 M.bird=(g,t,s,L)=>{
  g.save();move(g,t,s);
  for(const k of [-1,1]){line(g,[[k*7,-20],[k*10,-5],[k*17,-2]],L.beak,3);claws(g,k*12,-2,L.beak);}
  mass(g,0,-32,17,23,L.body);plates(g,0,-35,4,L.wing);
  for(const k of [-1,1]){
   g.save();g.translate(k*10,-43);g.scale(k,1);g.rotate(Math.sin(t*3)*.08);
   poly(g,[[0,0],[17,-18],[37,-23],[30,-7],[20,15],[8,21]],L.wing);
   for(let i=0;i<5;i++)poly(g,[[10+i*4,-9-i*2],[37-i*2,-22+i*5],[17-i*2,20-i*2]],i%2?L.body:L.wing);g.restore();
  }
  mass(g,4,-57,13,13,L.body);eye(g,5,-58,.75,L.eye);poly(g,[[9,-54],[24,-49],[15,-42],[14,-49]],L.beak);
  for(let i=0;i<3;i++)spike(g,-4+i*5,-65,-8,-10-i*2,L.crest,3);g.restore();
 };
 function blade(g,x,y,L,attack){g.save();g.translate(x,y);g.rotate(-.18-attack*1.3);line(g,[[0,15],[0,-35]],'#655849',4);
  if(L.weapon==='staff'){mass(g,0,-37,7,9,L.wcol);spike(g,0,-44,0,-10,L.trim,4);}
  else{poly(g,[[-3,-8],[-5,-34],[2,-52],[5,-13]],L.wcol);line(g,[[-8,-8],[8,-8]],L.trim,3);}
  g.restore();}
 M.human=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);if(L.ghost)g.globalAlpha*=.83;
  if(L.cape)poly(g,[[-14,-57],[-32,-6],[-10,-13],[0,0],[20,-9],[13,-53]],L.cape);
  for(const k of [-1,1]){mass(g,k*9,-10-p*k*2,6,12,L.robe2);mass(g,k*20,-38+p*k,7,15,L.robe2);}
  poly(g,[[-14,-54],[14,-54],[19,-15],[7,-5],[0,-16],[-10,-8],[-20,-17]],L.robe);plates(g,0,-44,5,L.robe2);
  line(g,[[-14,-50],[0,-38],[13,-51]],L.trim,3);line(g,[[-17,-25],[16,-25]],L.trim,3);
  mass(g,0,-65,14,13,L.hair);mass(g,1,-63,11,10,L.headless?'#7bb0b5':L.skin);eye(g,2,-65,.8,L.eye||'#ad694b');maw(g,3,-57,5,false);
  if(L.hat==='straw')poly(g,[[-25,-72],[0,-85],[23,-71]],'#8b7953');
  else if(L.hat==='helm'||L.hat==='crown'){poly(g,[[-15,-65],[-13,-78],[-5,-76],[0,-84],[6,-76],[13,-79],[16,-65],[5,-73]],L.trim);}
  else if(L.hat==='hood')poly(g,[[-14,-54],[-18,-75],[0,-83],[17,-74],[15,-54],[10,-70],[0,-74],[-10,-68]],L.robe2);
  blade(g,25,-28,L,s.atk||0);mass(g,25,-28,4,5,L.skin);g.restore();
 };
 M.plant=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);
  for(const k of [-1,1]){line(g,[[k*7,-21],[k*14,-3],[k*24,-2]],L.bark,7);line(g,[[k*12,-38],[k*30,-29],[k*36,-8]],L.bark,5);spike(g,k*28,-28,k*10,-14,L.spot||'#6c7253',3);}
  mass(g,0,-29,18,27,L.bark);
  if(L.kind==='mush'){
   poly(g,[[-34,-42],[-27,-61],[-13,-72],[7,-70],[29,-58],[35,-41],[16,-45],[7,-37],[-10,-44]],L.cap);
   for(let i=0;i<6;i++)mass(g,-24+i*9,-53-(i%3)*5,3,2,L.spot);
  }else{for(const k of [-1,0,1]){line(g,[[k*8,-40],[k*22,-65],[k*33,-75]],L.bark,6);spike(g,k*18,-57,k*10,-21,L.leaf||'#566a43',8);}mass(g,0,-57,20,13,L.leaf2);}
  eye(g,0,-31,1.2,L.eye||'#e2a35a');maw(g,0,-18,11);scars(g,-10,-40);g.restore();
 };
 M.dragon=(g,t,s,L)=>{
  g.save();const p=move(g,t,s);line(g,[[-14,-26],[-43,-14],[-60,-26],[-64,-43]],L.body,12);
  for(let i=0;i<5;i++)spike(g,-20-i*9,-25+i%2*6,-6,-10,L.horn,4);
  for(const k of [-1,1]){
   poly(g,[[k*12,-56],[k*34,-94],[k*61,-76],[k*49,-48],[k*37,-61],[k*26,-33]],L.wing);
   line(g,[[k*12,-56],[k*34,-94],[k*61,-76]],L.horn,2);
   line(g,[[k*34,-94],[k*37,-61]],L.horn,1.4);mass(g,k*19,-11-p*k,11,13,L.body);claws(g,k*20,-1-p*k);
  }
  mass(g,0,-37,27,28,L.body);plates(g,3,-47,6,L.belly);mass(g,7,-68,21,23,L.body);
  for(const k of [-1,1]){spike(g,7+k*14,-83,k*8,-24,L.horn,6);mass(g,k*26,-36,7,13,L.body);claws(g,k*26,-25);}
  mass(g,20,-65,21,10,L.body);eye(g,13,-75,1.2,L.eye);maw(g,28,-58,13);g.restore();
 };
 M.demon=(g,t,s,look)=>{
  const L=look||{leg:'#303039',cape:'#38232c',t1:'#58454e',t2:'#292b36',belt:'#3b2c30',gem:'#c33f44',plate:'#52505b',horn:BONE,skin:'#90766f',eye:'#f77746',blade:'#a6adb3'};
  g.save();const p=move(g,t,s);g.scale(1.5,1.5);
  poly(g,[[-19,-99],[-43,-18],[-23,-24],[-18,0],[0,-15],[25,-2],[42,-22],[17,-99]],L.cape);
  for(const k of [-1,1]){mass(g,k*14,-16-p*k,12,19,L.leg);mass(g,k*34,-58,13,24,L.plate);for(let i=0;i<3;i++)spike(g,k*(24+i*6),-76,k*(4+i*2),-17+i*3,L.horn,5);}
  mass(g,0,-57,29,33,L.t1);plates(g,0,-55,6,L.t2);mass(g,0,-91,19,20,L.skin);
  for(const k of [-1,1])poly(g,[[k*12,-99],[k*18,-119],[k*29,-126],[k*23,-105],[k*18,-95]],L.horn);
  eye(g,0,-94,1.3,L.eye);maw(g,0,-80,11);poly(g,[[0,-74],[7,-64],[0,-52],[-7,-64]],L.gem);
  blade(g,43,-42,{weapon:'sabre',wcol:L.blade,trim:L.horn},s.atk||0);g.restore();
 };
 M.style='feral';
})();
