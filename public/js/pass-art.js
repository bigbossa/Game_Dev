// Painted Willow Canyon shares village materials. Geometry and collision remain authoritative.
(function(){
  const A=window.PassArt={ready:false},T=C.T,S=C.TILE,TAU=Math.PI*2,props=new Map(),ground={},layouts=new WeakMap();
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const hash=(x,y,s=0)=>Art.hash(x,y,s);
  A.palette={grass:['#819467','#6e8964'],path:'#d2bd92',sand:'#bdb894',plaza:'#d5c6a4',water:['#548f89','#3c7776'],cliff:['#b9b79e','#7c8670']};
  A.load=async function(loadImage){
    for(const pack of ['village-v2','pass-v2']){
      const response=await fetch('assets/'+pack+'/props.json');if(!response.ok)throw Error('Missing painted map assets: '+pack);
      const meta=await response.json(),sizes={house:210,smith:225,apothecary:225,gate:190,stone:80,lantern:44,bamboo:175,rocks:120};
      await Promise.all(Object.entries(meta.props).map(async([name,p])=>{
        if(pack==='village-v2'&&!sizes[name])return;
        const image=await loadImage('assets/'+pack+'/'+p.file),scale=pack==='village-v2'?Math.min(1,sizes[name]/p.width):name==='cliffs'?152/p.width:1;
        if(name==='cliffs')ground.cliffs=image;
        const w=Math.round(p.width*scale),h=Math.round(p.height*scale),img=canvas(w,h),g=img.getContext('2d'),ax=Math.round(p.ax*scale),ay=Math.round(p.ay*scale);
        g.fillStyle='rgba(26,45,39,.15)';g.beginPath();g.ellipse(ax,ay-3,w*.28,Math.min(8,h-ay-1),0,0,TAU);g.fill();g.drawImage(image,0,0,w,h);
        props.set(name,{img,ax,ay,width:w,height:h,occludes:p.occludes,paintedPass:true});
      }));
      if(meta.ground)await Promise.all(Object.entries(meta.ground).map(async([name,p])=>{ground[name]=await loadImage('assets/'+pack+'/'+p.file);}));
    }
    const size=768,tile=canvas(size*2,size*2),g=tile.getContext('2d');
    for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?size*2:0,y?size*2:0);g.scale(x?-1:1,y?-1:1);g.drawImage(ground.grass,0,0,size,size);g.restore();}
    g.fillStyle='rgba(104,139,109,.25)';g.fillRect(0,0,tile.width,tile.height);ground.grassTile=tile;
    const dirt=canvas(tile.width,tile.height),d=dirt.getContext('2d');d.fillStyle='#d2bd92';d.fillRect(0,0,dirt.width,dirt.height);d.globalAlpha=.13;d.filter='grayscale(1)';d.drawImage(tile,0,0);ground.dirtTile=dirt;
    A.ready=true;
  };
  A.prop=function(o){
    if(!A.ready)return null;
    const [type,variant,x,y]=o;
    const name=type==='landmark'?variant:type==='tree'?(hash(x,y,19)>.88?'bamboo':'willow'):type==='rock'?(variant%2?'rocks':'cliffs'):type==='bush'?'shrub':type==='enhancer'?'smith':type==='pillar'?'lantern':type;
    const p=props.get(name);if(!p)return null;
    let extra={};
    if(type==='gate'){const to=C.MAPS[C.MAP_ORDER[variant]];extra={gate:true,icon:'➜',label:to?`${to.name} · ${C.levelText(to)}`:''};}
    else extra={smith:{label:'ร้านช่างตีดาบ',light:'#efb165',ly:-48},apothecary:{label:'ร้านขายยา',light:'#d4c28b',ly:-60},enhancer:{label:'ร้านตีบวก',light:'#ffb35a',ly:-48},stone:{label:'ศิลาเคลื่อนย้าย',light:'#89d6c1',ly:-65,icon:'✦'},lantern:{light:'#f5cb88',ly:-65}}[type]||{};
    return {...p,...extra,labelY:-p.ay-12};
  };
  function road(g,points,width,color){
    g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(points[0][0]*S,points[0][1]*S);
    for(let i=1;i<points.length;i++)g.lineTo(points[i][0]*S,points[i][1]*S);g.stroke();
  }
  function wash(g,x,y,r,color){const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,color);q.addColorStop(1,'rgba(80,115,69,0)');g.fillStyle=q;g.fillRect(x-r,y-r,2*r,2*r);}
  function river(g,map,half){
    const d=C.MAPS.pass.tpl;g.beginPath();
    for(let y=-2;y<=map.h+2;y+=.25){const x=(d.riverX(y-.5)-half)*S;if(y===-2)g.moveTo(x,y*S);else g.lineTo(x,y*S);}
    for(let y=map.h+2;y>=-2;y-=.25)g.lineTo((d.riverX(y-.5)+half)*S,y*S);g.closePath();
  }
  function layout(map){
    if(layouts.has(map))return layouts.get(map);
    const seen=new Uint8Array(map.tiles.length),bridges=[];
    for(let i=0;i<seen.length;i++)if(!seen[i]&&map.tiles[i]===T.BRIDGE){
      const queue=[i],cells=[];seen[i]=1;let x0=map.w,y0=map.h,x1=0,y1=0;
      for(let j=0;j<queue.length;j++){
        const p=queue[j],x=p%map.w,y=Math.floor(p/map.w);cells.push([x,y]);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
        for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=ny*map.w+nx;if(nx>=0&&ny>=0&&nx<map.w&&ny<map.h&&!seen[n]&&map.tiles[n]===T.BRIDGE){seen[n]=1;queue.push(n);}}
      }
      bridges.push({cells,x0,y0,x1,y1});
    }
    const value={bridges};layouts.set(map,value);return value;
  }
  A.renderChunk=function(map,cx,cy,res=1){
    const size=Art.CHUNK*S,pad=180,raw=canvas(size+pad*2,size+pad*2),g=raw.getContext('2d'),ox=cx*size,oy=cy*size;g.translate(pad-ox,pad-oy);
    const at=(x,y)=>x<0||y<0||x>=map.w||y>=map.h?T.CLIFF:map.tiles[y*map.w+x];
    const x0=Math.floor((ox-pad)/S),y0=Math.floor((oy-pad)/S),x1=Math.ceil((ox+size+pad)/S),y1=Math.ceil((oy+size+pad)/S);
    const mask=types=>{g.beginPath();for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(types.includes(at(x,y)))g.rect(x*S,y*S,S,S);};
    const fill=style=>{g.fillStyle=style;g.fillRect(ox-pad,oy-pad,size+pad*2,size+pad*2);};
    fill(g.createPattern(ground.grassTile,'repeat'));
    for(let y=Math.floor((oy-320)/280)*280;y<oy+size+320;y+=280)for(let x=Math.floor((ox-320)/280)*280;x<ox+size+320;x+=280)
      wash(g,x+hash(x,y,4)*90,y+hash(x,y,5)*90,220+hash(x,y,3)*100,hash(x,y,2)>.5?'rgba(178,188,112,.25)':'rgba(48,91,66,.18)');
    const dirt=g.createPattern(ground.dirtTile,'repeat');
    for(const [extra,color]of [[22,'rgba(109,107,67,.16)'],[8,'rgba(186,175,127,.45)'],[0,dirt]])
      for(const [w,...p]of C.MAPS.pass.tpl.roads)road(g,p,w*S+extra,color);
    // Footpaths connect the existing camp doors to a small village-style court.
    const camp=C.MAPS.pass.camp,mx=(camp.x0+camp.x1+1)/2,my=(camp.y0+camp.y1+1)/2;
    road(g,[[camp.x0+2,my],[camp.x1+1,my]],3*S,dirt);
    road(g,[[mx,camp.y0+3],[mx,camp.y1-2]],3*S,dirt);
    for(const o of map.objects)if(['house','smith','apothecary','enhancer','stone'].includes(o[0]))road(g,[[mx,o[3]/S+.4],[o[2]/S,o[3]/S+.4]],1.8*S,dirt);
    g.save();mask([T.FIELD]);g.clip();fill(dirt);g.restore();
    for(const m of C.MAPS.pass.tpl.landmarks){
      const x=(m.x+.5)*S,y=m.y*S;g.fillStyle=dirt;g.beginPath();g.roundRect(x-(m.rx+1)*S,y-2*S,(m.rx+1)*2*S,4*S,38);g.fill();
    }
    const lair=C.MAPS.pass.lair,r=(lair.r-.7)*S;
    g.fillStyle=dirt;g.beginPath();g.ellipse((lair.tx+.5)*S,(lair.ty+.5)*S,r+100,r+60,0,0,TAU);g.fill();
    // Feather a single union mask: individual blurred tiles would leave a grid.
    const cliffs=canvas(raw.width,raw.height),cg=cliffs.getContext('2d'),edge=canvas(raw.width,raw.height),eg=edge.getContext('2d');
    cg.translate(pad-ox,pad-oy);cg.fillStyle='#899478';cg.fillRect(ox-pad,oy-pad,raw.width,raw.height);
    cg.globalAlpha=.24;cg.fillStyle=cg.createPattern(ground.grassTile,'repeat');cg.fillRect(ox-pad,oy-pad,raw.width,raw.height);cg.globalAlpha=1;
    const rock=ground.cliffs;
    for(let y=Math.floor((oy-pad-300)/160)*160;y<oy+size+pad+160;y+=160)for(let x=Math.floor((ox-pad-300)/240)*240;x<ox+size+pad+240;x+=240){
      const xx=x+(Math.floor(y/160)%2)*120+hash(x,y,31)*50,yy=y+hash(x,y,32)*65,w=285+hash(x,y,33)*110;
      cg.drawImage(rock,xx-130,yy-120,w,w*rock.height/rock.width);
    }
    eg.translate(pad-ox,pad-oy);eg.filter='blur(12px)';eg.beginPath();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(at(x,y)===T.CLIFF)eg.rect(x*S,y*S,S,S);eg.fill();
    cg.setTransform(1,0,0,1,0,0);cg.globalCompositeOperation='destination-in';cg.drawImage(edge,0,0);g.drawImage(cliffs,ox-pad,oy-pad);
    // Smooth river follows the same curve sampled by server collision (as in stage 1).
    const half=C.MAPS.pass.tpl.riverHalf;
    river(g,map,half+1);g.fillStyle=dirt;g.fill();
    river(g,map,half+.25);g.fillStyle='#809a7a';g.fill();
    river(g,map,half);g.fillStyle='#548f89';g.fill();
    g.save();river(g,map,half);g.clip();
    for(let y=Math.floor((oy-pad)/140)*140;y<oy+size+pad;y+=140)wash(g,83*S+Math.sin(y/S*.09)*3*S,y,220,'rgba(31,81,79,.27)');
    for(let y=Math.floor((oy-pad)/40)*40;y<oy+size+pad;y+=40)for(let k=0;k<7;k++){
      const x=(79+hash(y,k,71)*9)*S,yy=y+hash(y,k,72)*28;g.strokeStyle=k%2?'rgba(193,228,207,.28)':'rgba(48,107,102,.25)';g.lineWidth=1.4;g.beginPath();g.moveTo(x,yy);g.quadraticCurveTo(x+17,yy+4,x+36,yy-1);g.stroke();
    }
    g.restore();
    for(const b of layout(map).bridges){
      if(b.x1*S<ox-pad||b.x0*S>ox+size+pad||b.y1*S<oy-pad||b.y0*S>oy+size+pad)continue;
      g.drawImage(ground.bridge,(b.x0-.5)*S,b.y0*S,(b.x1-b.x0+2)*S,(b.y1-b.y0+1)*S);
    }
    g.drawImage(ground.courtyard,(lair.tx+.5)*S-r,(lair.ty+.5)*S-r*.78,r*2,r*1.56);
    g.drawImage(ground.courtyard,mx*S-225,my*S-170,450,340);
    for(const m of C.MAPS.pass.tpl.landmarks)if(m.kind!=='canyonGate'){
      const w=(m.rx*2+1)*S;g.drawImage(ground.courtyard,(m.x+.5)*S-w/2,(m.y+.5)*S-w*.25,w,w*.5);
    }
    const out=canvas(Math.round(size*res),Math.round(size*res));out.getContext('2d').drawImage(raw,pad,pad,size,size,0,0,out.width,out.height);return out;
  };
})();
