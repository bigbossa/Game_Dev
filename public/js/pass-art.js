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
    d.filter='none';d.globalAlpha=1;
    for(let y=0;y<dirt.height;y+=6)for(let x=0;x<dirt.width;x+=6){
      d.fillStyle=hash(x,y,91)>.5?'rgba(110,86,51,.07)':'rgba(255,238,192,.14)';
      d.fillRect(x+hash(x,y,92)*5,y+hash(x,y,93)*5,1+hash(x,y,94)*3,1);
    }
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
    g.fillStyle=color;
    for(let i=1;i<points.length;i++){
      const [ax,ay]=points[i-1].map(v=>v*S),[bx,by]=points[i].map(v=>v*S),len=Math.hypot(bx-ax,by-ay),nx=-(by-ay)/len,ny=(bx-ax)/len,n=Math.ceil(len/16);
      g.beginPath();
      for(const side of [1,-1])for(let k=0;k<=n;k++){
        const t=(side===1?k:n-k)/n,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
        const spread=width/2+Math.sin(x*.037+y*.023)*5+Math.sin(x*.089-y*.071)*2.5;
        if(side===1&&k===0)g.moveTo(x+nx*spread*side,y+ny*spread*side);else g.lineTo(x+nx*spread*side,y+ny*spread*side);
      }g.closePath();g.fill();
    }
    for(const [x,y]of points){g.beginPath();g.arc(x*S,y*S,width/2-2,0,TAU);g.fill();}
  }
  function wash(g,x,y,r,color){const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,color);q.addColorStop(1,'rgba(80,115,69,0)');g.fillStyle=q;g.fillRect(x-r,y-r,2*r,2*r);}
  function river(g,map,half){
    const d=C.MAPS.pass.tpl;g.beginPath();
    const edgeScale=1+Math.max(0,half-d.riverHalf)*1.8;
    for(let y=-2;y<=map.h+2;y+=.125){const x=(d.riverX(y-.5)-half)*S+bankNoise(y*S,-1)*edgeScale;if(y===-2)g.moveTo(x,y*S);else g.lineTo(x,y*S);}
    for(let y=map.h+2;y>=-2;y-=.125)g.lineTo((d.riverX(y-.5)+half)*S+bankNoise(y*S,1)*edgeScale,y*S);g.closePath();
  }
  const bankNoise=(y,side)=>Math.sin(y*.018+side)*7+Math.sin(y*.047+side*3)*3;
  function tuft(g,x,y,s){
    for(let k=0;k<5;k++){const lean=(k-2)*2.7;g.strokeStyle=k%2?'rgba(183,192,111,.65)':'rgba(65,101,56,.55)';g.lineWidth=1.2;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+lean*.5,y-s*.55,x+lean,y-s*(.6+hash(x,y,k)*.5));g.stroke();}
  }
  function roadDistance(x,y){
    let best=Infinity;
    for(const [w,...pts]of C.MAPS.pass.tpl.roads)for(let i=1;i<pts.length;i++){
      const ax=pts[i-1][0]*S,ay=pts[i-1][1]*S,dx=(pts[i][0]-pts[i-1][0])*S,dy=(pts[i][1]-pts[i-1][1])*S;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
      best=Math.min(best,Math.hypot(x-ax-t*dx,y-ay-t*dy)-w*S/2);
    }return best;
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
    for(let y=Math.floor((oy-440)/280)*280;y<oy+size+440;y+=280)for(let x=Math.floor((ox-440)/280)*280;x<ox+size+440;x+=280)
      wash(g,x+hash(x,y,4)*90,y+hash(x,y,5)*90,220+hash(x,y,3)*100,hash(x,y,2)>.5?'rgba(199,187,103,.34)':'rgba(32,78,55,.32)');
    const dirt=g.createPattern(ground.dirtTile,'repeat');
    for(const [extra,color]of [[34,'rgba(168,156,105,.15)'],[20,'rgba(186,175,127,.25)'],[8,'rgba(186,175,127,.45)'],[0,dirt]])
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
    // Ground cover follows road shoulders, leaving the combat lanes clear.
    for(let y=Math.floor((oy-pad)/26)*26;y<oy+size+pad;y+=26)for(let x=Math.floor((ox-pad)/26)*26;x<ox+size+pad;x+=26){
      const xx=x+hash(x,y,111)*24,yy=y+hash(x,y,112)*24,t=at(Math.floor(xx/S),Math.floor(yy/S));
      if(t!==T.GRASS&&t!==T.PATH)continue;
      const dist=roadDistance(xx,yy),h=hash(x,y,113);
      if(dist>-12&&dist<30&&h>.2)tuft(g,xx,yy,5+h*8);
      else if(dist>35&&t===T.GRASS&&h>.83){
        wash(g,xx,yy,24+h*30,'rgba(51,91,51,.12)');tuft(g,xx,yy,7+h*7);
        if(h>.96){g.globalAlpha=.65;const p=props.get('shrub');g.drawImage(p.img,xx-15,yy-15,30,24);g.globalAlpha=1;}
      }
      if(dist<8&&dist>-60&&h>.5){
        g.fillStyle='rgba(102,91,65,.23)';g.beginPath();g.ellipse(xx,yy,1.5+h*3,.8+h,0,0,TAU);g.fill();
        g.fillStyle='rgba(240,223,178,.65)';g.fillRect(xx-1,yy-1,2,1);
      }
    }
    for(const o of map.objects)if(o[0]==='tree'&&o[2]>ox-pad&&o[2]<ox+size+pad&&o[3]>oy-pad&&o[3]<oy+size+pad)
      wash(g,o[2]+28,o[3]-9,95,'rgba(32,64,47,.23)');
    // Feather a single union mask: individual blurred tiles would leave a grid.
    const cliffs=canvas(raw.width,raw.height),cg=cliffs.getContext('2d'),edge=canvas(raw.width,raw.height),eg=edge.getContext('2d');
    cg.translate(pad-ox,pad-oy);cg.fillStyle='#858977';cg.fillRect(ox-pad,oy-pad,raw.width,raw.height);
    cg.globalAlpha=.24;cg.fillStyle=cg.createPattern(ground.grassTile,'repeat');cg.fillRect(ox-pad,oy-pad,raw.width,raw.height);cg.globalAlpha=1;
    const rock=ground.cliffs;
    for(let y=Math.floor((oy-pad-500)/155)*155;y<oy+size+pad+500;y+=155)for(let x=Math.floor((ox-pad-500)/215)*215;x<ox+size+pad+500;x+=215){
      const xx=x+hash(x,y,31)*125,yy=y+hash(x,y,32)*90,w=265+hash(x,y,33)*190;
      const img=rock;
      cg.save();cg.translate(xx,yy);cg.scale(hash(x,y,36)>.5?-1:1,.75+hash(x,y,37)*.4);
      cg.drawImage(img,-w/2,-w*.6,w,w*img.height/img.width);cg.restore();
      wash(cg,xx,yy,140,hash(x,y,38)>.5?'rgba(27,61,51,.27)':'rgba(177,177,108,.17)');
    }
    eg.translate(pad-ox,pad-oy);eg.filter='blur(12px)';eg.beginPath();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(at(x,y)===T.CLIFF)eg.rect(x*S,y*S,S,S);eg.fill();
    cg.setTransform(1,0,0,1,0,0);cg.globalCompositeOperation='destination-in';cg.drawImage(edge,0,0);g.drawImage(cliffs,ox-pad,oy-pad);
    // Smooth river follows the same curve sampled by server collision (as in stage 1).
    const half=C.MAPS.pass.tpl.riverHalf;
    g.save();g.filter='blur(7px)';river(g,map,half+.8);g.fillStyle='#a7a580';g.fill();g.restore();
    river(g,map,half+.3);g.fillStyle='#758e70';g.fill();
    river(g,map,half);g.fillStyle='#548f89';g.fill();
    g.save();river(g,map,half);g.clip();
    for(let y=Math.floor((oy-pad-260)/100)*100;y<oy+size+pad+260;y+=100){
      const center=C.MAPS.pass.tpl.riverX(y/S-.5)*S;
      wash(g,center,y,180,'rgba(22,67,73,.26)');
      for(const side of [-1,1])wash(g,center+side*(half*S-14),y,85,'rgba(170,192,133,.32)');
    }
    for(let y=Math.floor((oy-pad-220)/140)*140;y<oy+size+pad+220;y+=140)wash(g,83*S+Math.sin(y/S*.09)*3*S,y,220,'rgba(31,81,79,.27)');
    for(let y=Math.floor((oy-pad)/40)*40;y<oy+size+pad;y+=40)for(let k=0;k<7;k++){
      const x=(79+hash(y,k,71)*9)*S,yy=y+hash(y,k,72)*28;g.strokeStyle=k%2?'rgba(193,228,207,.28)':'rgba(48,107,102,.25)';g.lineWidth=1.4;g.beginPath();g.moveTo(x,yy);g.quadraticCurveTo(x+17,yy+4,x+36,yy-1);g.stroke();
    }
    g.restore();
    // Painted bank stones, reeds and short foam marks break up the canal silhouette.
    for(let y=Math.floor((oy-pad-80)/32)*32;y<oy+size+pad+80;y+=32)for(const side of [-1,1]){
      if(layout(map).bridges.some(b=>y>(b.y0-1)*S&&y<(b.y1+2)*S))continue;
      const xx=(C.MAPS.pass.tpl.riverX(y/S-.5)+side*half)*S+bankNoise(y,side),h=hash(y,side,121);
      if(xx<ox-pad||xx>ox+size+pad)continue;
      if(h>.73){
        const img=ground.cliffs,w=26+h*32;g.save();g.translate(xx+side*8,y);g.scale(side,.46+hash(y,side,122)*.25);g.drawImage(img,-w/2,-w*.4,w,w*img.height/img.width);g.restore();
      }
      if(h<.65){tuft(g,xx+side*(12+h*19),y,11+h*17);tuft(g,xx+side*(20+h*23),y+6,9+h*19);}
      if(h>.35){g.strokeStyle='rgba(213,229,193,.38)';g.lineWidth=1.5;g.beginPath();g.moveTo(xx-side*8,y+12);g.quadraticCurveTo(xx-side*14,y+18,xx-side*11,y+30);g.stroke();}
    }
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
