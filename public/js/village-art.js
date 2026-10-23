// Painted props + world-space terrain. Geometry comes from the authoritative village layout.
(function(){
 const V=window.VillageArt={ready:false},T=C.T,TILE=C.TILE,L=C.VILLAGE,props=new Map(),ground={};
 const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const hash=(x,y,s=0)=>Art.hash(x,y,s);
 V.load=async function(loadImage){
  const response=await fetch('assets/village-v2/props.json');if(!response.ok)throw Error('Village assets missing');
  const meta=await response.json();
  await Promise.all(Object.entries(meta.props).map(async([name,p])=>{
   const original=await loadImage('assets/village-v2/'+p.file),img=canvas(p.width,p.height),g=img.getContext('2d');
   g.fillStyle='rgba(26,45,39,.17)';g.beginPath();g.ellipse(p.ax,p.ay-3,p.width*.32,Math.min(12,p.height*.05),0,0,Math.PI*2);g.fill();
   g.drawImage(original,0,0);props.set(name,{...p,img});
  }));
  await Promise.all(Object.entries(meta.ground).map(async([name,p])=>{ground[name]=await loadImage('assets/village-v2/'+p.file);}));
  // Mirror tile edges so the painted texture repeats without hard seams.
  const s=768,tile=canvas(s*2,s*2),tg=tile.getContext('2d');
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){tg.save();tg.translate(x?s*2:0,y?s*2:0);tg.scale(x?-1:1,y?-1:1);tg.drawImage(ground.grass,0,0,s,s);tg.restore();}
  tg.fillStyle='rgba(104,139,109,.25)';tg.fillRect(0,0,s*2,s*2);ground.grassTile=tile;
  const dirt=canvas(s*2,s*2),dg=dirt.getContext('2d');dg.fillStyle='#d2bd92';dg.fillRect(0,0,s*2,s*2);
  dg.globalAlpha=.13;dg.filter='grayscale(1)';dg.drawImage(tile,0,0);ground.dirtTile=dirt;
  V.ready=true;
 };
 V.prop=function(o){
  const p=props.get(o[1]);if(!p)return null;
  const extra={
   smith:{label:'โรงตีเหล็ก',light:'#efb165',ly:-48},
   apothecary:{label:'ร้านยา',light:'#d4c28b',ly:-80},
   stone:{label:'ศิลาเคลื่อนย้าย',light:'#89d6c1',ly:-65,icon:'✦'},
   gate:{label:'ด่านผาหลิว · Lv.20–40',gate:true,icon:'➜'},
   lantern:{light:'#f5cb88',ly:-65},
  }[o[1]]||{};
  return {...p,...extra,labelY:-p.ay-12,paintedVillage:true};
 };
 V.drawProp=function(g,p,player){
  const s=p.sp,left=p.x-s.ax,top=p.y-s.ay;
  const behind=s.occludes&&player&&player.y<p.y-12&&player.y>top+24&&player.x>left+12&&player.x<left+s.img.width-12&&player.y-75<top+s.img.height;
  g.save();if(behind)g.globalAlpha=.38;g.drawImage(s.img,left,top);g.restore();
 };
 function road(g,pts,width,color){
  g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(pts[0][0]*TILE,pts[0][1]*TILE);
  for(let i=1;i<pts.length-1;i++){
   const p=pts[i],a=pts[i-1],b=pts[i+1],before=Math.hypot(p[0]-a[0],p[1]-a[1]),after=Math.hypot(b[0]-p[0],b[1]-p[1]),r=Math.min(1.3,before/3,after/3);
   g.lineTo((p[0]+(a[0]-p[0])*r/before)*TILE,(p[1]+(a[1]-p[1])*r/before)*TILE);
   g.quadraticCurveTo(p[0]*TILE,p[1]*TILE,(p[0]+(b[0]-p[0])*r/after)*TILE,(p[1]+(b[1]-p[1])*r/after)*TILE);
  }
  const end=pts[pts.length-1];g.lineTo(end[0]*TILE,end[1]*TILE);g.stroke();
 }
 function river(g,half){
  g.beginPath();for(let y=-2;y<=98;y+=.4){const x=(L.riverX(y)-half)*TILE;iPoint(g,x,y*TILE,y===-2);}
  for(let y=98;y>=-2;y-=.4)g.lineTo((L.riverX(y)+half)*TILE,y*TILE);g.closePath();
 }
 function iPoint(g,x,y,first){if(first)g.moveTo(x,y);else g.lineTo(x,y);}
 function courtyard(g){
  const [tx,ty]=L.centre,x=tx*TILE,y=ty*TILE,R=9.7*TILE;
  if(ground.courtyard){g.drawImage(ground.courtyard,x-R,y-R*.75,R*2,R*1.5);return;}
  g.save();g.translate(x,y);g.scale(1,.75);
  const stone=g.createRadialGradient(-R*.3,-R*.3,20,0,0,R);stone.addColorStop(0,'#e3d6b7');stone.addColorStop(1,'#c5b695');
  g.fillStyle=stone;g.beginPath();g.arc(0,0,R,0,Math.PI*2);g.fill();
  for(let ring=0;ring<5;ring++){
   const r=R-ring*46;g.strokeStyle=ring%2?'#b4a584':'#f0e3c6';g.lineWidth=ring===0?6:2;
   g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();
   if(ring<4)for(let i=0;i<48;i++){const a=(i+(ring%2)*.5)*Math.PI/24;
    g.strokeStyle='rgba(111,100,79,.27)';g.lineWidth=1.5;g.beginPath();g.moveTo(Math.cos(a)*r,Math.sin(a)*r);g.lineTo(Math.cos(a)*(r-44),Math.sin(a)*(r-44));g.stroke();}
  }
  const r=170;g.fillStyle='#d9cdad';g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();
  g.fillStyle='#8d8b77';g.beginPath();g.arc(0,0,r,-Math.PI/2,Math.PI/2);g.arc(0,r/2,r/2,Math.PI/2,-Math.PI/2,true);g.arc(0,-r/2,r/2,Math.PI/2,-Math.PI/2);g.fill();
  for(const [yy,col]of [[-r/2,'#e0d4b4'],[r/2,'#8d8b77']]){g.fillStyle=col;g.beginPath();g.arc(0,yy,21,0,Math.PI*2);g.fill();}
  for(const rr of [r+5,r+14,r+25]){g.strokeStyle=rr===r+14?'#bca26e':'#f1e1b7';g.lineWidth=3;g.beginPath();g.arc(0,0,rr,0,Math.PI*2);g.stroke();}
  for(let i=0;i<8;i++){const a=i*Math.PI/4;g.save();g.rotate(a);g.translate(0,-235);g.strokeStyle='#af9661';g.lineWidth=3;g.beginPath();g.moveTo(0,-20);g.quadraticCurveTo(16,0,0,20);g.quadraticCurveTo(-16,0,0,-20);g.stroke();g.restore();}
  g.restore();
 }
 function bridge(g){
  const b=L.bridge,x=b.x0*TILE,y=b.y0*TILE,W=(b.x1-b.x0+1)*TILE,H=(b.y1-b.y0+1)*TILE;
  if(ground.bridge){g.drawImage(ground.bridge,x,y,W,H);return;}
  g.fillStyle='rgba(23,62,59,.28)';g.fillRect(x+12,y+18,W,H);
  const stone=g.createLinearGradient(0,y,0,y+H);stone.addColorStop(0,'#c2b89d');stone.addColorStop(.5,'#e0d4b8');stone.addColorStop(1,'#c7b99a');
  g.fillStyle=stone;g.fillRect(x,y,W,H);g.strokeStyle='#ab9d80';g.lineWidth=1.5;
  for(let row=0;row<6;row++){const yy=y+row*48;g.beginPath();g.moveTo(x,yy);g.lineTo(x+W,yy);g.stroke();
   for(let xx=x+(row%2)*48;xx<x+W;xx+=96){g.beginPath();g.moveTo(xx,yy);g.lineTo(xx,yy+48);g.stroke();}}
  for(const yy of [y+12,y+H-12]){
   g.fillStyle='#8f927f';g.fillRect(x+36,yy-7,W-72,20);g.fillStyle='#e1d6bb';g.fillRect(x+36,yy-11,W-72,9);
   for(let xx=x+48;xx<x+W;xx+=96){g.fillStyle='#a6a48d';g.fillRect(xx-9,yy-26,18,37);g.fillStyle='#eee2c7';g.fillRect(xx-12,yy-31,24,9);}
  }
 }
 V.renderChunk=function(map,cx,cy,res=1){
  const S=Art.CHUNK*TILE,ox=cx*S,oy=cy*S,c=canvas(Math.round(S*res),Math.round(S*res)),g=c.getContext('2d');
  g.scale(res,res);g.translate(-ox,-oy);g.fillStyle=g.createPattern(ground.grassTile,'repeat');g.fillRect(ox,oy,S,S);
  // Large overlapping colour patches have world-space centres: no visible tile or chunk grid.
  for(let y=Math.floor((oy-320)/280)*280;y<oy+S+320;y+=280)for(let x=Math.floor((ox-320)/280)*280;x<ox+S+320;x+=280){
   const r=220+hash(x,y,3)*100,px=x+hash(x,y,4)*90,py=y+hash(x,y,5)*90;
   const grad=g.createRadialGradient(px,py,0,px,py,r);grad.addColorStop(0,hash(x,y,2)>.5?'rgba(178,188,112,.25)':'rgba(48,91,66,.18)');grad.addColorStop(1,'rgba(80,115,69,0)');g.fillStyle=grad;g.fillRect(px-r,py-r,r*2,r*2);
  }
  for(const [w,...pts]of L.template.roads)road(g,pts,w*TILE+12,'rgba(109,107,67,.22)');
  const dirt=g.createPattern(ground.dirtTile,'repeat');
  for(const [w,...pts]of L.template.roads)road(g,pts,w*TILE,dirt);
  // Banks and river share the same curve used by server collision.
  river(g,L.riverHalf+1);g.fillStyle='#bdb894';g.fill();
  river(g,L.riverHalf+.25);g.fillStyle='#688d75';g.fill();
  river(g,L.riverHalf);g.fillStyle='#548f89';g.fill();
  g.save();river(g,L.riverHalf);g.clip();
  for(let y=Math.floor(oy/60)*60-60;y<oy+S+60;y+=60){
   const x=L.riverX(y/TILE)*TILE;g.strokeStyle='rgba(187,226,208,.3)';g.lineWidth=2;
   for(let k=0;k<4;k++){const xx=x-100+hash(y,k,1)*190,yy=y+k*12;g.beginPath();g.moveTo(xx,yy);g.quadraticCurveTo(xx+14,yy+5,xx+36,yy-1);g.stroke();}
  }g.restore();bridge(g);
  // Boss ground and building approaches are matte so combat tells remain legible.
  g.fillStyle='#aa9b79';g.beginPath();g.ellipse(61.5*TILE,11.5*TILE,6.7*TILE,6.7*TILE,0,0,Math.PI*2);g.fill();
  for(const b of L.buildings){if(b.asset==='stone')continue;const [x0,y0,x1,y1]=b.block;
   g.fillStyle='#c8ba97';g.beginPath();g.roundRect((x0-1)*TILE,(y0-1)*TILE,(x1-x0+3)*TILE,(y1-y0+3)*TILE,32);g.fill();}
  courtyard(g);
  // Sparse ground strokes; immutable chunk cache keeps this out of the frame loop.
  for(let ty=Math.max(0,cy*12);ty<Math.min(map.h,cy*12+12);ty++)for(let tx=Math.max(0,cx*12);tx<Math.min(map.w,cx*12+12);tx++){
   const t=map.tiles[ty*map.w+tx];
   if(t===T.CLIFF){g.fillStyle='rgba(53,72,57,.45)';g.fillRect(tx*TILE,ty*TILE,TILE,TILE);
    if((tx+ty)%2===0){const rock=props.get('rocks'),s=105+hash(tx,ty,73)*40;g.drawImage(rock.img,tx*TILE-40,ty*TILE-45,s,s*.87);}continue;}
   if(t!==T.GRASS&&t!==T.PATH&&t!==T.SAND)continue;
   for(let k=0;k<3;k++){const x=(tx+hash(tx,ty,k+30))*TILE,y=(ty+hash(tx,ty,k+50))*TILE;
    g.strokeStyle=t===T.GRASS?(k%2?'rgba(207,213,146,.32)':'rgba(45,88,51,.18)'):'rgba(121,107,77,.17)';g.lineWidth=1;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-3,y-2,x-2,y-(t===T.GRASS?5:1));g.stroke();}
  }
  return c;
 };
})();
