// Painted stage props and deterministic terrain. Authoritative tiles stay untouched.
(function(){
 const A=window.StageArt={ready:false},T=C.T,S=C.TILE,TAU=Math.PI*2,sets=new Map(),masks=new WeakMap(),seals=new Map();
 const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const H=(x,y,s=0)=>Art.hash(x,y,s);
 const themes={
  forest:{ground:'#355647',path:'#8c9070',stone:'#789184',water:'#24584f',bank:'#557d68',light:'#acd6a5',dark:'#1b3833',accent:'#a4dcc9',leaf:'#9473a0'},
  manor:{ground:'#535f60',path:'#858282',stone:'#969496',water:'#304d62',bank:'#647984',light:'#b2bcb5',dark:'#303e49',accent:'#a5c9dc',leaf:'#95838f'},
  temple:{ground:'#7c916a',path:'#c9ba96',stone:'#d9cdb1',water:'#428e86',bank:'#95b5a0',light:'#dce2b4',dark:'#4b6751',accent:'#c4a360',leaf:'#e5b9b2'},
  fire:{ground:'#484040',path:'#827064',stone:'#82776c',water:'#b74324',bank:'#3b2d2c',light:'#a18c70',dark:'#28272e',accent:'#e5a15d',leaf:'#c38450'}
 };
 A.supports=id=>!!themes[id];
 A.load=async function(loadImage){
  const grass=await loadImage('assets/village-v2/grass.png');
  await Promise.all(Object.entries(themes).map(async([id,th])=>{
   const r=await fetch('assets/stages-v2/'+id+'/props.json');if(!r.ok)throw Error('Missing stage art '+id);
   const meta=await r.json(),props=new Map(),size=384,texture=canvas(size*2,size*2),g=texture.getContext('2d');
   // Reuse the painted ground material with a stage-specific tint, mirrored edges.
   g.fillStyle=th.ground;g.fillRect(0,0,texture.width,texture.height);g.globalAlpha=.25;g.globalCompositeOperation='luminosity';
   for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?size*2:0,y?size*2:0);g.scale(x?-1:1,y?-1:1);g.drawImage(grass,0,0,size,size);g.restore();}
   await Promise.all(Object.entries(meta.props).map(async([name,p])=>{
    const image=await loadImage('assets/stages-v2/'+id+'/'+p.file),img=canvas(p.width,p.height);img.getContext('2d').drawImage(image,0,0);
    props.set(name,{...p,img,paintedStage:true});
   }));
   const scale=(name,source,k,occludes=false)=>{
    const p=props.get(source),w=Math.ceil(p.width*k),h=Math.ceil(p.height*k),img=canvas(w,h);img.getContext('2d').drawImage(p.img,0,0,w,h);
    props.set(name,{...p,img,width:w,height:h,ax:Math.round(p.ax*k),ay:Math.round(p.ay*k),occludes});
   };
   scale('shrub','tree',.31);scale('smallRock','rock',.55);
   scale('stone',id==='forest'?'waystone':id==='fire'?'emberSpire':id==='manor'?'memorial':'lotusShrine',.45);
   scale('pillar',id==='forest'?'waystone':id==='fire'?'emberSpire':id==='manor'?'memorial':'lotusShrine',.3);
   if(id==='manor')scale('grave','memorial',.27);
   if(id==='fire')scale('crystal','emberSpire',.25);
   // Darker canopy variant is cached once, adding variety without per-frame filters.
   const tree=props.get('tree'),variant=canvas(tree.width,tree.height),vg=variant.getContext('2d');
   vg.translate(tree.width,0);vg.scale(-1,1);vg.drawImage(tree.img,0,0);vg.globalCompositeOperation='source-atop';vg.fillStyle=th.dark+'28';vg.fillRect(0,0,tree.width,tree.height);
   props.set('treeAlt',{...tree,img:variant,ax:tree.width-tree.ax});
   sets.set(id,{props,texture});
  }));
  A.ready=true;
 };
 A.prop=function(id,o){
  if(!A.ready||!sets.has(id))return null;
  const [type,v,x,y]=o,{props}=sets.get(id),th=themes[id];
  const name=type==='landmark'?v:type==='tree'?(H(x,y,91)>.5?'treeAlt':'tree'):type==='bush'?'shrub':
   ['house','smith','apothecary','enhancer'].includes(type)?'pavilion':type;
  const p=props.get(name);if(!p)return null;
  let extra={};
  if(type==='gate'){const to=C.MAPS[C.MAP_ORDER[v]];extra={gate:true,icon:'➜',label:to?`${to.name} · ${C.levelText(to)}`:''};}
  else extra={smith:{label:'ร้านช่างตีดาบ',light:'#efba77',ly:-75},apothecary:{label:'ร้านขายยา',light:'#efba77',ly:-75},
   enhancer:{label:'ร้านตีบวก',light:'#efba77',ly:-75},stone:{label:'ศิลาเคลื่อนย้าย',icon:'✦',light:th.accent,ly:-60}}[type]||{};
  return {...p,...extra,labelY:-p.ay-12};
 };
 function line(g,points,color,width=1){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
 function disc(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
 function bossSeal(id,res){
  const key=id+':'+res;if(seals.has(key))return seals.get(key);
  const th=themes[id],r=(C.MAPS[id].lair.r-.8)*S,size=Math.ceil(r*2+16),img=canvas(Math.round(size*res),Math.round(size*res)),g=img.getContext('2d');
  g.scale(img.width/size,img.height/size);g.translate(size/2,size/2);disc(g,0,0,r,th.stone+'b0');
  for(const k of [1,.93,.68]){g.strokeStyle=th.accent+'88';g.lineWidth=k===1?5:2;g.beginPath();g.arc(0,0,r*k,0,TAU);g.stroke();}
  const petals=id==='forest'?3:id==='temple'?8:6;
  for(let i=0;i<petals;i++){
   g.save();g.rotate(i*TAU/petals);g.strokeStyle=th.dark+'50';g.lineWidth=3;g.beginPath();g.moveTo(0,0);
   g.bezierCurveTo(-r*.3,-r*.25,-r*.18,-r*.48,0,-r*.61);g.bezierCurveTo(r*.18,-r*.48,r*.3,-r*.25,0,0);g.stroke();g.restore();
  }
  disc(g,0,0,r*.09,th.accent+'55');const value={img,size};seals.set(key,value);return value;
 }
 function groundMask(map){
  if(masks.has(map))return masks.get(map);
  const raw=canvas(map.w*4,map.h*4),g=raw.getContext('2d');g.fillStyle='#fff';
  for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if([T.GRASS,T.SAND,T.FIELD].includes(map.tiles[y*map.w+x]))g.fillRect(x*4,y*4,4,4);
  const soft=canvas(raw.width,raw.height),sg=soft.getContext('2d');sg.filter='blur(1px)';sg.drawImage(raw,0,0);masks.set(map,soft);return soft;
 }
 A.renderChunk=function(map,cx,cy,res=1){
  const id=map.id,th=themes[id],{texture}=sets.get(id),size=Art.CHUNK*S,ox=cx*size,oy=cy*size;
  const cv=canvas(Math.round(size*res),Math.round(size*res)),g=cv.getContext('2d');g.scale(res,res);g.translate(-ox,-oy);
  const x0=Math.floor(ox/S)-5,y0=Math.floor(oy/S)-5,x1=Math.ceil((ox+size)/S)+5,y1=Math.ceil((oy+size)/S)+5;
  const at=(x,y)=>x<0||y<0||x>=map.w||y>=map.h?T.CLIFF:map.tiles[y*map.w+x];
  const mask=types=>{g.beginPath();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(types.includes(at(x,y)))g.rect(x*S,y*S,S,S);};
  const colors={[T.GRASS]:th.path,[T.FIELD]:th.path,[T.SAND]:th.path,[T.PATH]:th.path,[T.PLAZA]:th.stone,[T.WATER]:th.water,[T.CLIFF]:th.dark,[T.BRIDGE]:th.stone};
  g.fillStyle=th.ground;g.fillRect(ox,oy,size,size);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){g.fillStyle=colors[at(x,y)]||th.ground;g.fillRect(x*S,y*S,S+1/res,S+1/res);}
  const ground=canvas(size,size),gg=ground.getContext('2d');gg.translate(-ox,-oy);gg.drawImage(groundMask(map),0,0,map.w*S,map.h*S);
  gg.globalCompositeOperation='source-in';gg.fillStyle=gg.createPattern(texture,'repeat');gg.fillRect(ox,oy,size,size);g.drawImage(ground,ox,oy);
  // Broad patches and brush strokes share world coordinates across chunk boundaries.
  g.save();mask([T.GRASS,T.FIELD,T.SAND]);g.clip();
  for(let y=Math.floor((oy-180)/120)*120;y<oy+size+180;y+=120)for(let x=Math.floor((ox-180)/120)*120;x<ox+size+180;x+=120){
   const xx=x+H(x,y,4)*50,yy=y+H(x,y,5)*50,r=65+H(x,y,6)*90,q=g.createRadialGradient(xx,yy,0,xx,yy,r);
   q.addColorStop(0,(H(x,y,7)>.45?th.light:th.dark)+'32');q.addColorStop(1,th.ground+'00');g.fillStyle=q;g.fillRect(xx-r,yy-r,r*2,r*2);
  }
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)for(let k=0;k<5;k++){
   const xx=(x+H(x,y,k+10))*S,yy=(y+H(x,y,k+20))*S;
   if(id==='fire'){line(g,[[xx-9,yy-5],[xx,yy],[xx+7,yy-3]],th.dark+'70',1);if(k===0&&H(x,y,33)>.7)line(g,[[xx,yy],[xx+5,yy-2]],'#cc73354a',1);}
   else {line(g,[[xx-3,yy-3],[xx,yy],[xx+2,yy-5]],th.light+'35',1);if(H(x,y,k+30)>.82){g.fillStyle=th.leaf+'70';g.beginPath();g.ellipse(xx,yy,3,1.5,H(x,y,k+40)*TAU,0,TAU);g.fill();}}
  }g.restore();
  // Earth paths receive fine gravel; temple paths become warm dressed stone.
  g.save();mask([T.PATH,T.PLAZA,T.BRIDGE]);g.clip();
  g.globalAlpha=.12;g.globalCompositeOperation='luminosity';g.fillStyle=g.createPattern(texture,'repeat');g.fillRect(ox,oy,size,size);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  for(let y=Math.floor((oy-60)/40)*40;y<oy+size+60;y+=40)for(let x=Math.floor((ox-100)/72)*72;x<ox+size+100;x+=72){
   const xx=x+(Math.round(y/40)%2)*36;
   if(id==='temple'||at(Math.floor(xx/S),Math.floor(y/S))!==T.PATH){g.strokeStyle=th.dark+'40';g.lineWidth=1;g.strokeRect(xx,y,72,40);line(g,[[xx+2,y+2],[xx+69,y+2]],th.light+'55');}
   else for(let k=0;k<5;k++)disc(g,xx+H(x,y,k+50)*72,y+H(x,y,k+60)*40,.6+H(x,y,k+70),k%2?th.dark+'45':th.light+'75');
  }g.restore();
  // Water/lava channels retain their exact solid boundaries and bridge gaps.
  g.save();mask([T.WATER]);g.clip();
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const xx=(x+.2+H(x,y,90)*.6)*S,yy=(y+.2+H(x,y,91)*.6)*S;
   if(id==='fire'){
    const q=g.createRadialGradient(xx,yy,1,xx,yy,65);q.addColorStop(0,'#ffad3955');q.addColorStop(1,'#e85b2100');g.fillStyle=q;g.fillRect(xx-65,yy-65,130,130);
    line(g,[[xx-25,yy+8],[xx-7,yy-4],[xx+10,yy],[xx+30,yy-12]],'#ffcf686a',2);
    if(H(x,y,92)>.5){g.fillStyle='#572d2f';g.beginPath();g.ellipse(xx,yy,10,4,.2,0,TAU);g.fill();}
   }else{
    line(g,[[xx-16,yy],[xx,yy-2],[xx+20,yy]],th.accent+'33',1);
    if(id==='temple'&&H(x,y,94)>.7){g.fillStyle='#528368';g.beginPath();g.ellipse(xx,yy,10,5,-.15,0,TAU);g.fill();disc(g,xx,yy-4,2.8,'#e8babb');}
    if(id==='forest'&&H(x,y,95)>.82)disc(g,xx,yy,2,'#a0d5a945');
   }
  }g.restore();
  const edges=[[0,-1,0,0,S,0],[0,1,0,S,S,S],[-1,0,0,0,0,S],[1,0,S,0,S,S]];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const t=at(x,y),px=x*S,py=y*S;
   if(t===T.WATER||t===T.CLIFF)for(const [dx,dy,ax,ay,bx,by]of edges){
    if([t,T.BRIDGE].includes(at(x+dx,y+dy)))continue;
    const pts=[[px+ax,py+ay],[px+bx,py+by]];line(g,pts,th.dark,10);line(g,pts,th.bank,5);line(g,pts,th.light+'99',1);
   }
   if(t===T.CLIFF){
    g.fillStyle=th.bank+'65';g.beginPath();g.moveTo(px+5,py+15);g.lineTo(px+24,py+4);g.lineTo(px+43,py+16);g.lineTo(px+36,py+37);g.lineTo(px+9,py+42);g.closePath();g.fill();
    line(g,[[px+7,py+15],[px+24,py+7],[px+41,py+16]],th.light+'60',2);
   }
   if(t===T.BRIDGE){
    line(g,[[px,py+S-2],[px+S,py+S-2]],th.dark+'88',2);
    for(const dx of [-1,1])if(at(x+dx,y)===T.WATER){const xx=px+(dx>0?S:0);line(g,[[xx,py],[xx,py+S]],th.dark,7);line(g,[[xx-1,py],[xx-1,py+S]],th.light,3);}
   }
  }
  // Boss seal: subdued enough to keep combat telegraphs readable.
  const lair=C.MAPS[id].lair,bx=(lair.tx+.5)*S,by=(lair.ty+.5)*S;
  g.save();mask([T.GRASS,T.FIELD,T.PATH,T.PLAZA,T.SAND]);g.clip();
  // Rasterize curves once: browser curve flattening can otherwise vary at chunk edges.
  const seal=bossSeal(id,res);g.drawImage(seal.img,bx-seal.size/2,by-seal.size/2,seal.size,seal.size);g.restore();
  return cv;
 };
})();
