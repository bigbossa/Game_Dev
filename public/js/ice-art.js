// North Sea Ice Palace: painted props and deterministic, cached world terrain.
(function(){
  const A=window.IceArt={ready:false},T=C.T,S=C.TILE,TAU=Math.PI*2,props=new Map(),snowMasks=new WeakMap();
  let snowTile;
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const hash=(x,y,s=0)=>Art.hash(x,y,s);
  A.load=async function(loadImage){
    const response=await fetch('assets/ice-v2/props.json');if(!response.ok)throw Error('Missing ice palace artwork');
    const meta=await response.json();
    const snow=await loadImage('assets/ice-v2/'+meta.ground.snow),tileSize=768;
    snowTile=canvas(tileSize*2,tileSize*2);const sg=snowTile.getContext('2d');
    for(let y=0;y<2;y++)for(let x=0;x<2;x++){sg.save();sg.translate(x?tileSize*2:0,y?tileSize*2:0);sg.scale(x?-1:1,y?-1:1);sg.drawImage(snow,0,0,tileSize,tileSize);sg.restore();}
    await Promise.all(Object.entries(meta.props).map(async([name,p])=>{
      const image=await loadImage('assets/ice-v2/'+p.file),img=canvas(p.width,p.height),g=img.getContext('2d');
      g.drawImage(image,0,0);props.set(name,{...p,img,paintedIce:true});
    }));
    // Variants share the same source art and are prepared once, not during drawing.
    for(const [name,source,scale]of [['smallCrystal','iceObelisk',.36],['stone','iceObelisk',.48],['shrub','pine',.32]]){
      const p=props.get(source),w=Math.ceil(p.width*scale),h=Math.ceil(p.height*scale),img=canvas(w,h);
      img.getContext('2d').drawImage(p.img,0,0,w,h);
      props.set(name,{...p,img,width:w,height:h,ax:Math.round(p.ax*scale),ay:Math.round(p.ay*scale),occludes:false});
    }
    const gate=canvas(198,205),g=gate.getContext('2d'),p=props.get('iceObelisk');
    for(const x of [8,132])g.drawImage(p.img,x,29,58,168);
    g.strokeStyle='#456b88';g.lineWidth=15;g.beginPath();g.moveTo(39,87);g.quadraticCurveTo(99,1,159,87);g.stroke();
    g.strokeStyle='#e3f6ff';g.lineWidth=7;g.stroke();
    props.set('gate',{img:gate,width:198,height:205,ax:99,ay:196,occludes:true,paintedIce:true});
    const fence=canvas(58,56),fg=fence.getContext('2d');
    for(const y of [25,40]){fg.fillStyle='#47677e';fg.fillRect(4,y,50,7);fg.fillStyle='#c8e5ef';fg.fillRect(4,y,50,2);}
    for(const x of [12,29,46]){fg.fillStyle='#7293aa';fg.fillRect(x-3,15,6,37);fg.fillStyle='#e7f6ff';fg.fillRect(x-3,15,3,35);
      fg.beginPath();fg.moveTo(x,8);fg.lineTo(x+5,16);fg.lineTo(x-5,16);fg.closePath();fg.fill();}
    props.set('fence',{img:fence,width:58,height:56,ax:29,ay:52,occludes:false,paintedIce:true});
    A.ready=true;
  };
  A.prop=function(o){
    if(!A.ready)return null;
    const [type,v]=o,name=type==='landmark'?v:type==='tree'?'pine':type==='rock'?'rocks':type==='bush'?'shrub':
      ['house','smith','apothecary','enhancer'].includes(type)?'pavilion':type==='crystal'?'smallCrystal':type==='pillar'?'lantern':type;
    const p=props.get(name);if(!p)return null;
    let extra={};
    if(type==='gate'){const to=C.MAPS[C.MAP_ORDER[v]];extra={gate:true,icon:'➜',label:to?`${to.name} · ${C.levelText(to)}`:''};}
    else extra={smith:{label:'ร้านช่างตีดาบ',light:'#efb165',ly:-75},apothecary:{label:'ร้านขายยา',light:'#efb165',ly:-75},
      enhancer:{label:'ร้านตีบวก',light:'#efb165',ly:-75},stone:{label:'ศิลาเคลื่อนย้าย',icon:'✦',light:'#9edcff',ly:-78},
      lantern:{light:'#efc98a',ly:-76}}[type]||{};
    return {...p,...extra,labelY:-p.ay-12};
  };
  function line(g,points,color,width){g.strokeStyle=color;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
  const isSnow=t=>[T.GRASS,T.SAND,T.FIELD,T.PATH].includes(t);
  function snowMask(map){
    if(snowMasks.has(map))return snowMasks.get(map);
    const raw=canvas(map.w*4,map.h*4),r=raw.getContext('2d');r.fillStyle='#fff';
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if(isSnow(map.tiles[y*map.w+x]))r.fillRect(x*4,y*4,4,4);
    const soft=canvas(raw.width,raw.height),g=soft.getContext('2d');g.filter='blur(1.5px)';g.drawImage(raw,0,0);snowMasks.set(map,soft);return soft;
  }
  A.renderChunk=function(map,cx,cy,res=1){
    const size=Art.CHUNK*S,ox=cx*size,oy=cy*size,cv=canvas(Math.round(size*res),Math.round(size*res)),g=cv.getContext('2d');
    g.scale(res,res);g.translate(-ox,-oy);
    const x0=Math.floor(ox/S)-4,y0=Math.floor(oy/S)-4,x1=Math.ceil((ox+size)/S)+4,y1=Math.ceil((oy+size)/S)+4;
    const at=(x,y)=>x<0||y<0||x>=map.w||y>=map.h?T.CLIFF:map.tiles[y*map.w+x];
    const mask=types=>{g.beginPath();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(types.includes(at(x,y)))g.rect(x*S,y*S,S,S);};
    const colors={[T.GRASS]:'#dce9ed',[T.SAND]:'#d2e2e8',[T.PATH]:'#bdd1da',[T.FIELD]:'#c8dce3',[T.ICE]:'#7faec2',
      [T.WATER]:'#23556d',[T.CLIFF]:'#5d839a',[T.PLAZA]:'#b8cfdb',[T.BRIDGE]:'#cadce4'};
    g.fillStyle='#dce9ed';g.fillRect(ox,oy,size,size);
    // A subpixel overlap prevents a pale grid when preview chunks use 0.7x scale.
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const t=at(x,y);g.fillStyle=isSnow(t)?colors[T.ICE]:colors[t]||'#dce9ed';g.fillRect(x*S,y*S,S+1/res,S+1/res);}
    const snow=canvas(size,size),sn=snow.getContext('2d');sn.translate(-ox,-oy);
    sn.drawImage(snowMask(map),0,0,map.w*S,map.h*S);sn.globalCompositeOperation='source-in';
    sn.fillStyle=sn.createPattern(snowTile,'repeat');sn.fillRect(ox,oy,size,size);g.drawImage(snow,ox,oy);
    // Broad snowdrifts are tied to world coordinates, continuous across chunks.
    g.save();mask([T.GRASS,T.SAND,T.FIELD,T.PATH]);g.clip();
    for(let y=Math.floor((oy-240)/160)*160;y<oy+size+240;y+=160)for(let x=Math.floor((ox-240)/160)*160;x<ox+size+240;x+=160){
      const xx=x+hash(x,y,1)*80,yy=y+hash(x,y,2)*80,r=100+hash(x,y,3)*100;
      const q=g.createRadialGradient(xx,yy,0,xx,yy,r);q.addColorStop(0,hash(x,y,4)>.5?'#ffffff85':'#739bb53b');q.addColorStop(1,'#c8e0ed00');
      g.fillStyle=q;g.fillRect(xx-r,yy-r,r*2,r*2);
      g.strokeStyle='#f6fcff30';g.lineWidth=2;g.beginPath();g.ellipse(xx,yy+40,r*.7,r*.12,-.12,Math.PI,TAU);g.stroke();
    }g.restore();
    // Deep turquoise ice, submerged facets and sparse long cracks; no tile outlines.
    g.save();mask([T.ICE,T.WATER]);g.clip();
    g.globalAlpha=.12;g.globalCompositeOperation='soft-light';g.fillStyle=g.createPattern(snowTile,'repeat');g.fillRect(ox,oy,size,size);
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      if(at(x,y)!==T.ICE&&at(x,y)!==T.WATER)continue;
      if(hash(x,y,23)>.84){
        const px=(x+hash(x,y,24))*S,py=(y+hash(x,y,25))*S,len=55+hash(x,y,26)*80;
        const points=[[px-len*.6,py-18],[px-15,py-7],[px,py],[px+len*.6,py+12],[px+len,py+34]];
        line(g,points,'#23577438',4);line(g,points,'#d4f4ff55',1);
        line(g,[[px,py],[px+9,py-19],[px-2,py-43]],'#e1fbff55',1);
      }
      if(hash(x,y,35)>.82){const px=x*S,py=y*S;g.fillStyle='#ccf2f717';g.beginPath();g.moveTo(px,py);g.lineTo(px+100,py+30);g.lineTo(px+20,py+56);g.closePath();g.fill();}
    }g.restore();
    // Visible frozen banks mark the same impassable water edges as the server.
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const t=at(x,y),px=x*S,py=y*S;
      if(t===T.WATER)for(const [dx,dy,pts]of [[0,-1,[[px,py],[px+S,py]]],[0,1,[[px,py+S],[px+S,py+S]]],[-1,0,[[px,py],[px,py+S]]],[1,0,[[px+S,py],[px+S,py+S]]]]){
        if([T.WATER,T.BRIDGE].includes(at(x+dx,y+dy)))continue;
        line(g,pts,'#4a819b',11);line(g,pts,'#a7dbe5',6);line(g,pts,'#e5f5f8',2);
      }
      if(t===T.PATH||t===T.GRASS)for(let k=0;k<3;k++){
        const xx=(x+hash(x,y,k+60))*S,yy=(y+hash(x,y,k+70))*S;
        line(g,[[xx,yy],[xx+2,yy-.6]],k%2?'#ffffff55':'#7594aa25',1);
      }
      if(t===T.BRIDGE){
        g.fillStyle='#cfdee5';g.fillRect(px,py,S,S);
        line(g,[[px,py+S-1],[px+S,py+S-1]],'#7999ae',2);line(g,[[px,py+2],[px+S,py+2]],'#f1faff',2);
        line(g,[[px+(y%2?S*.5:0),py],[px+(y%2?S*.5:0),py+S]],'#91adbc',1);
        for(const dx of [-1,1])if(at(x+dx,y)!==T.BRIDGE&&at(x+dx,y)===T.WATER){const xx=px+(dx>0?S:0);line(g,[[xx,py],[xx,py+S]],'#67899f',7);line(g,[[xx-1,py],[xx-1,py+S]],'#effaff',3);}
      }
    }
    // Pale engraved stone courtyard and the empress's snowflake seal.
    const lair=C.MAPS.ice.lair,bx=(lair.tx+.5)*S,by=(lair.ty+.5)*S,r=(lair.r-.7)*S;
    g.save();mask([T.PLAZA,T.GRASS,T.PATH,T.ICE,T.FIELD,T.SAND]);g.clip();
    mask([T.PLAZA]);g.moveTo(bx+r,by);g.arc(bx,by,r,0,TAU);g.clip();
    g.fillStyle='#b8cfdb';g.fillRect(ox,oy,size,size);
    g.globalAlpha=.14;g.fillStyle=g.createPattern(snowTile,'repeat');g.fillRect(ox,oy,size,size);g.globalAlpha=1;
    for(let y=Math.floor((oy-80)/56)*56;y<oy+size+80;y+=56)for(let x=Math.floor((ox-160)/88)*88;x<ox+size+160;x+=88){
      const xx=x+(Math.round(y/56)%2)*44;g.strokeStyle='#7e9fb350';g.lineWidth=1;g.strokeRect(xx,y,88,56);
      line(g,[[xx+2,y+2],[xx+85,y+2]],'#edfaff80',1);
    }
    g.strokeStyle='#497f9f60';g.lineWidth=3;
    for(const k of [1,.92,.64]){g.beginPath();g.arc(bx,by,r*k,0,TAU);g.stroke();}
    for(let i=0;i<6;i++){
      const a=i*TAU/6,gx=Math.cos(a),gy=Math.sin(a);line(g,[[bx,by],[bx+gx*r*.58,by+gy*r*.58]],'#ebfaffaa',5);
      for(const d of [.3,.45])for(const side of [-1,1])line(g,[[bx+gx*r*d,by+gy*r*d],[bx+gx*r*(d-.1)-gy*r*.09*side,by+gy*r*(d-.1)+gx*r*.09*side]],'#ebfaffaa',3);
    }g.restore();
    return cv;
  };
})();
