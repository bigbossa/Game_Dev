// Cached, native Canvas landmarks and ground ornament for the six hunting stages.
// Footprints and navigation stay in shared/hunting-layouts.js; this module only paints.
(function(){
  const TAU=Math.PI*2,cache=new Map(),S=C.TILE;
  const colors={pass:'#e6c58a',forest:'#94d6ba',manor:'#b3a6ce',temple:'#dcc17a',ice:'#a9e8ff',fire:'#ed9b62'};
  function poly(g,pts,fill,stroke='#253335',width=2){
    g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}
  }
  function ellipse(g,x,y,rx,ry,fill){g.fillStyle=fill;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill();}
  function line(g,pts,col,w=2){g.strokeStyle=col;g.lineWidth=w;g.lineJoin='round';g.lineCap='round';g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();}
  function glow(g,x,y,r,col){const q=g.createRadialGradient(x,y,1,x,y,r);q.addColorStop(0,col);q.addColorStop(1,col.slice(0,7)+'00');ellipse(g,x,y,r,r,q);}
  function roof(g,x,y,w,h,base,trim){
    poly(g,[[x-w*.53,y+h*.12],[x-w*.46,y+h*.32],[x-w*.31,y+h*.25],[x,y-h],[x+w*.31,y+h*.25],[x+w*.46,y+h*.32],[x+w*.53,y+h*.12],[x+w*.44,y+h*.62],[x,y+h*.73],[x-w*.44,y+h*.62]],base);
    poly(g,[[x,y-h],[x+w*.31,y+h*.25],[x+w*.46,y+h*.32],[x+w*.53,y+h*.12],[x+w*.44,y+h*.62],[x,y+h*.73]],'#142c3840',null);
    for(let i=-8;i<=8;i++){
      const p=i/8;
      line(g,[[x+p*w*.03,y-h+8],[x+p*w*.33,y+h*.22],[x+p*w*.44,y+h*.56]],'#ffffff19',1.5);
    }
    line(g,[[x-w*.52,y+h*.16],[x-w*.44,y+h*.62],[x,y+h*.73],[x+w*.44,y+h*.62],[x+w*.52,y+h*.16]],trim,5);
    line(g,[[x,y-h-12],[x,y-h+8]],trim,5);
  }
  function plinth(g,x,y,w,col='#8d9292'){
    for(let i=0;i<3;i++){
      const k=2-i;poly(g,[[x-w/2-k*7,y-k*8],[x+w/2+k*7,y-k*8],[x+w/2+k*7,y+8-k*8],[x-w/2-k*7,y+8-k*8]],col);
      line(g,[[x-w/2-k*7,y-k*8],[x+w/2+k*7,y-k*8]],'#e4ded099',2);
    }
  }
  function lantern(g,x,y,col){
    line(g,[[x,y-19],[x,y+28]],'#574439',3);
    glow(g,x,y,29,col+'45');ellipse(g,x,y,10,15,col);line(g,[[x-10,y-13],[x+10,y-13]],'#aa9871',3);line(g,[[x,y+13],[x,y+26]],'#be7954',2);
  }
  function hall(g,{roofColor='#31565d',trim='#d8bd80',wall='#c6bfa6',ruined=false,ice=false}={}){
    plinth(g,280,454,350,ice?'#91b7cc':'#7d8180');
    poly(g,[[124,300],[436,300],[436,433],[124,433]],wall);
    poly(g,[[282,300],[436,300],[436,433],[282,433]],'#192e352b',null);
    for(const x of [139,209,351,421]){g.fillStyle=ice?'#b6e7ef':'#7a4138';g.fillRect(x-6,291,12,143);line(g,[[x-3,294],[x-3,429]],trim,2);}
    poly(g,[[249,340],[311,340],[311,433],[249,433]],'#243843');
    for(const x of [168,377]){
      poly(g,[[x-20,336],[x+20,336],[x+20,386],[x-20,386]],ice?'#78c7e1':'#405659');
      for(let j=-1;j<=1;j++)line(g,[[x+j*11,338],[x+j*11,384]],trim,1.5);
      for(let y=348;y<386;y+=13)line(g,[[x-18,y],[x+18,y]],trim,1.5);
    }
    roof(g,280,285,405,65,roofColor,trim);
    poly(g,[[199,193],[361,193],[361,267],[199,267]],wall);
    for(const x of [215,243,317,345])line(g,[[x,199],[x,258]],ice?'#779dbf':'#6c4036',5);
    roof(g,280,182,274,59,roofColor,trim);
    poly(g,[[245,259],[315,259],[315,280],[245,280]],'#263d42',trim);
    // An inset seal uses shapes instead of tiny illegible text.
    poly(g,[[280,262],[287,270],[280,278],[273,270]],trim,null);
    lantern(g,153,325,ice?'#a6efff':'#f1c47e');lantern(g,407,325,ice?'#a6efff':'#f1c47e');
    if(ruined){
      poly(g,[[326,214],[344,200],[351,234],[332,241]],'#29383d',null);
      line(g,[[370,300],[359,331],[375,352],[363,374],[369,429]],'#484655',4);
      for(let i=0;i<7;i++)poly(g,[[330+i*13,446],[337+i*13,433-i%3*5],[345+i*13,446]],'#73727c');
      for(const x of [140,420])line(g,[[x,297],[x-5,338],[x+9,366],[x+1,409]],'#506458',5);
    }
  }
  function crystal(g,x,y,w,h,col){
    poly(g,[[x,y-h],[x+w*.6,y-h*.65],[x+w*.5,y-10],[x,y+7],[x-w*.5,y-10],[x-w*.6,y-h*.65]],col,'#688faa');
    poly(g,[[x,y-h],[x,y+7],[x-w*.5,y-10],[x-w*.6,y-h*.65]],'#edffff88',null);
    poly(g,[[x,y-h],[x+w*.6,y-h*.65],[x+w*.5,y-10],[x,y+7]],'#486ab24a',null);
    line(g,[[x,y-h],[x,y+7]],'#efffffaa',2);
  }
  function tree(g){
    for(let i=0;i<9;i++){
      const a=i*2.4;line(g,[[280,424],[280+Math.cos(a)*70,432],[280+Math.cos(a)*163,447+Math.sin(a)*10]],'#303f38',18-i%3*3);
      line(g,[[280,422],[280+Math.cos(a)*70,429],[280+Math.cos(a)*156,443+Math.sin(a)*10]],'#7b8a62',4);
    }
    poly(g,[[241,429],[256,349],[238,283],[193,248],[214,232],[263,271],[271,213],[292,220],[298,275],[343,231],[365,238],[311,293],[308,351],[325,430]],'#536146');
    line(g,[[266,421],[275,346],[268,282],[281,224]],'#a29c71',5);
    const rnd=C.mulberry32(917);
    for(let i=0;i<65;i++){
      const a=rnd()*TAU,r=Math.sqrt(rnd()),x=280+Math.cos(a)*185*r,y=198+Math.sin(a)*83*r;
      ellipse(g,x,y,22+rnd()*28,17+rnd()*25,['#203f38','#315647','#42755b','#598468','#83a17a'][i%5]);
    }
    for(let i=0;i<12;i++){
      const x=147+i*25,y=239+Math.sin(i)*17;
      line(g,[[x,y],[x+8,y+34],[x+2,y+68]],'#638a6f',2);
      glow(g,x+2,y+70,20,'#95e4d044');ellipse(g,x+2,y+70,3,5,'#b7f0db');
    }
    glow(g,284,350,44,'#8bdacb66');poly(g,[[284,324],[301,349],[284,375],[269,349]],'#87e2c6','#d1fff0');
  }
  function tower(g,kind){
    const bell=kind==='bellTower',stone=kind==='waystone'||kind==='memorial';
    plinth(g,280,452,stone?170:152,'#818c89');
    if(stone){
      poly(g,[[228,432],[222,316],[241,284],[319,284],[338,316],[332,432]],'#6b7f78');
      poly(g,[[241,284],[319,284],[310,307],[232,324],[222,316]],'#b1b59b',null);
      for(let y=330;y<410;y+=22)poly(g,[[280,y-7],[287,y],[280,y+7],[273,y]],'#c4d7b5',null);
      line(g,[[305,296],[300,337],[314,363]],'#344f4b',3);
      if(kind==='memorial'){lantern(g,205,422,'#bdd1e8');lantern(g,355,422,'#bdd1e8');}
      return;
    }
    for(const x of [223,337]){g.fillStyle='#745849';g.fillRect(x-8,260,16,175);line(g,[[x-4,262],[x-4,433]],'#bc9f74',3);}
    poly(g,[[214,367],[346,367],[346,386],[214,386]],'#7b6551');
    if(bell){
      line(g,[[280,242],[280,279]],'#b7aa73',6);
      poly(g,[[258,279],[302,279],[309,329],[319,342],[241,342],[251,329]],'#b5a169');
      ellipse(g,280,340,39,7,'#746744');line(g,[[261,289],[257,322]],'#f0d698',3);
    }else{
      for(let x=225;x<=335;x+=22)line(g,[[x,316],[x,354]],'#c9b183',4);
      line(g,[[216,320],[344,320]],'#c9b183',5);
      for(let y=387;y<445;y+=12)line(g,[[264,y],[295,y]],'#c9b183',4);
    }
    roof(g,280,251,220,55,'#445f62','#d6bf88');
    lantern(g,225,286,'#f8d389');lantern(g,335,286,'#f8d389');
  }
  function make(kind){
    const img=document.createElement('canvas');img.width=560;img.height=500;
    const g=img.getContext('2d');
    ellipse(g,288,456,kind==='ancientTree'?207:kind.includes('Spire')?97:188,19,'#132c303b');
    if(kind==='ancientTree')tree(g);
    else if(['waystone','memorial','watchtower','bellTower'].includes(kind))tower(g,kind);
    else if(kind==='iceObelisk'||kind==='emberSpire'){
      const fire=kind==='emberSpire',col=fire?'#ea9770':'#97dce9';
      plinth(g,280,451,138,fire?'#665359':'#9dbdcd');
      glow(g,280,350,100,(fire?'#ff996b':'#89e5ff')+'44');
      crystal(g,243,436,35,112,col);crystal(g,318,436,43,157,col);crystal(g,280,438,66,248,col);
      for(let i=0;i<5;i++)ellipse(g,215+i*32,330-Math.sin(i*2)*65,2,2,'#fff1d9');
    }else if(kind==='icePalace'){
      crystal(g,124,429,58,225,'#87ccdf');crystal(g,436,429,58,225,'#87ccdf');
      hall(g,{roofColor:'#628fb7',trim:'#daf9fa',wall:'#c2dce8',ice:true});
      crystal(g,280,119,33,77,'#9ee5ed');
    }else if(kind==='dragonForge'){
      plinth(g,280,451,355,'#665456');
      for(const sign of [-1,1]){
        poly(g,[[280+sign*153,439],[280+sign*182,362],[280+sign*156,300],[280+sign*119,273],[280+sign*90,296],[280+sign*117,320],[280+sign*137,375],[280+sign*112,439]],'#5e5053','#302f38',4);
        poly(g,[[280+sign*156,300],[280+sign*157,250],[280+sign*131,284]],'#ba9f81');
        glow(g,280+sign*115,297,22,'#ffb16399');ellipse(g,280+sign*115,297,5,3,'#ffe7aa');
      }
      poly(g,[[233,421],[246,356],[314,356],[327,421]],'#967064');
      ellipse(g,280,356,34,11,'#ffcb79');glow(g,280,333,78,'#ff9b5d66');
      poly(g,[[253,356],[262,317],[277,333],[287,286],[303,324],[306,352]],'#ffbb65',null);
      poly(g,[[271,354],[279,329],[285,343],[294,321],[295,353]],'#ffebaf',null);
    }else if(kind==='canyonGate'){
      for(const x of [119,441]){plinth(g,x,452,60);poly(g,[[x-23,437],[x-23,263],[x+23,263],[x+23,437]],'#a19275');line(g,[[x-14,281],[x-14,426]],'#e2caa0',4);}
      poly(g,[[107,277],[453,277],[453,312],[107,312]],'#866d51');
      roof(g,280,240,416,66,'#4b6262','#dcc18b');
      for(const x of [168,392])lantern(g,x,335,'#efd39c');
      poly(g,[[235,276],[325,276],[325,310],[235,310]],'#3d5558','#dcc18b');
      for(const x of [257,280,303])poly(g,[[x,282],[x+7,293],[x,304],[x-7,293]],'#dcc18b',null);
      // The gate is a closed landmark; the traversable stage exit uses the normal gate prop.
      for(let x=157;x<428;x+=25)line(g,[[x,318],[x,437]],'#866d51',9);
    }else if(kind==='rootShrine'||kind==='lotusShrine'){
      hall(g,{roofColor:kind==='rootShrine'?'#446a57':'#668b7e',trim:'#c9d8ab',wall:'#9aa88d'});
      if(kind==='rootShrine')for(const x of [136,420])line(g,[[x,430],[x-20,391],[x+10,344],[x-7,298]],'#49674c',9);
    }else hall(g,{roofColor:kind==='ruinedHall'?'#494d65':'#62817c',trim:kind==='ruinedHall'?'#a3a0b9':'#e8c880',wall:kind==='ruinedHall'?'#91909e':'#e1d1ab',ruined:kind==='ruinedHall'});
    return {img,ax:280,ay:470};
  }
  function prop(o){if(!cache.has(o[1]))cache.set(o[1],make(o[1]));return cache.get(o[1]);}
  function ground(g,map,x0,y0,size){
    const d=C.MAPS[map.id];if(!d?.tpl?.landmarks)return;
    const col=colors[d.id],l=d.lair,x=(l.tx+.5)*S,y=(l.ty+.5)*S,r=(l.r-.8)*S;
    // World coordinates and clipping keep circles continuous across cached chunk boundaries.
    if(x+r>=x0&&x-r<=x0+size&&y+r>=y0&&y-r<=y0+size){
      g.save();g.translate(-x0,-y0);g.globalAlpha=.4;
      for(const scale of [1,.92,.7]){g.strokeStyle=col;g.lineWidth=scale===1?5:2;g.beginPath();g.arc(x,y,r*scale,0,TAU);g.stroke();}
      for(let i=0;i<12;i++){
        const a=i*TAU/12,cx=x+Math.cos(a)*r*.82,cy=y+Math.sin(a)*r*.82;
        poly(g,[[cx,cy-9],[cx+7,cy],[cx,cy+9],[cx-7,cy]],col,null);
        line(g,[[x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3],[x+Math.cos(a)*r*.68,y+Math.sin(a)*r*.68]],col,2);
      }
      poly(g,Array.from({length:8},(_,i)=>[x+Math.cos(i*TAU/8)*r*.25,y+Math.sin(i*TAU/8)*r*.25]),null,col,3);
      g.restore();
    }
    // Stone spans over ice fissures / lava, with a visible edge against the water.
    if(d.id==='ice'||d.id==='fire'||d.id==='temple'){
      const t=C.T;
      for(let ty=y0/S;ty<Math.min(map.h,(y0+size)/S);ty++)for(let tx=x0/S;tx<Math.min(map.w,(x0+size)/S);tx++){
        if(map.tiles[ty*map.w+tx]!==t.BRIDGE)continue;
        const px=tx*S-x0,py=ty*S-y0;
        g.fillStyle=d.id==='ice'?'#a5c1d2':d.id==='fire'?'#65575b':'#b6ad91';g.fillRect(px,py,S,S);
        g.strokeStyle=d.id==='fire'?'#a98d76':'#e1e7df';g.lineWidth=1;g.strokeRect(px+2,py+2,S-4,S-4);
        for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(map.tiles[(ty+dy)*map.w+tx+dx]===t.WATER){
          line(g,dx?[[px+(dx>0?S-3:3),py],[px+(dx>0?S-3:3),py+S]]:[[px,py+(dy>0?S-3:3)],[px+S,py+(dy>0?S-3:3)]],col,4);
        }
      }
    }
  }
  window.HuntingArt={prop,ground};
})();
