(function(){
  const $=id=>document.getElementById(id),ids=C.MAP_ORDER;
  const states=new Map();let current,camera={x:0,y:0},zoom=.72,drag=null;
  Art.buildProps();
  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Missing image: '+src));img.src=src;});
  const artReady=Promise.all([VillageArt.load(loadImage),PassArt.load(loadImage),IceArt.load(loadImage),StageArt.load(loadImage)]);
  function chunk(state,x,y){const key=x+','+y;if(!state.chunks.has(key))state.chunks.set(key,Art.renderChunk(state.map,x,y,.7));return state.chunks.get(key);}
  function scene(g,state,rect,w,h){
    const scale=Math.min(w/rect.w,h/rect.h),S=C.TILE*Art.CHUNK;
    g.fillStyle='#111b21';g.fillRect(0,0,w,h);g.save();g.scale(scale,scale);g.translate(-rect.x,-rect.y);
    const x0=Math.max(0,Math.floor(rect.x/S)),y0=Math.max(0,Math.floor(rect.y/S));
    for(let y=y0;y<Math.min(Math.ceil(state.map.h/Art.CHUNK),Math.ceil((rect.y+rect.h)/S));y++)for(let x=x0;x<Math.min(Math.ceil(state.map.w/Art.CHUNK),Math.ceil((rect.x+rect.w)/S));x++)g.drawImage(chunk(state,x,y),x*S,y*S,S,S);
    for(const o of state.props)if(o[0]==='sigil'){const img=Art.sigil();g.save();g.translate(o[2],o[3]);g.scale(1,.62);g.globalAlpha=.55;g.drawImage(img,-img.width/2,-img.height/2);g.restore();}
    for(const o of state.props){const p=Art.propSprite(o);if(!p)continue;const x=o[2]-p.ax,y=o[3]-p.ay;if(x>rect.x+rect.w||y>rect.y+rect.h||x+p.img.width<rect.x||y+p.img.height<rect.y)continue;g.drawImage(p.img,x,y);}
    g.restore();
  }
  function overview(){
    const cv=$('overview'),g=cv.getContext('2d'),d=current.def,s=cv.width/(d.w*C.TILE);cv.height=Math.round(d.h/d.w*cv.width);
    scene(g,current,{x:0,y:0,w:d.w*C.TILE,h:d.h*C.TILE},cv.width,cv.height);
    const dot=(x,y,col,r)=>{g.beginPath();g.fillStyle=col;g.strokeStyle='#152b30';g.lineWidth=2;g.arc(x*s,y*s,r,0,Math.PI*2);g.fill();g.stroke();};
    for(const z of d.zones){const x=((z.cx??(z.x0+z.x1)/2)+.5)*C.TILE,y=((z.cy??(z.y0+z.y1)/2)+.5)*C.TILE;dot(x,y,z.fixed?'#f17760':'#e1d0a5',z.fixed?6:3);}
    const spawn=C.spawnOf(d,'dharma');dot(spawn.x,spawn.y,'#ffe0a0',6);for(const gate of d.gates||[])dot(gate.x,gate.y,'#9cddfa',5);
    if(d.pvp){const other=C.spawnOf(d,'adharma');dot(other.x,other.y,'#ff8a8a',6);}
    g.strokeStyle='#fff4ce';g.lineWidth=1.5;g.strokeRect((camera.x-360/zoom)*s,(camera.y-290/zoom)*s,720/zoom*s,580/zoom*s);
  }
  function draw(){if(!current)return;scene($('detail').getContext('2d'),current,{x:camera.x-360/zoom,y:camera.y-290/zoom,w:720/zoom,h:580/zoom},720,580);overview();}
  function focus(x,y){camera={x,y};draw();}
  async function select(id){
    await artReady;
    if(current&&current.def.id!==id)current.chunks.clear();
    if(!states.has(id)){
      const r=await fetch('/api/map/'+id);if(!r.ok)throw Error('โหลดด่านไม่สำเร็จ');const p=await r.json();
      if(p.version!==(id==='village'?2:id==='pvp'?1:3))throw Error('เซิร์ฟเวอร์ยังใช้แมพรุ่นเดิม กรุณารีสตาร์ตเซิร์ฟเวอร์เกม');
      const dec=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
      states.set(id,{def:C.MAPS[id],map:{...p,id,tiles:dec(p.tiles),solid:dec(p.solid)},chunks:new Map(),props:p.objects.slice().sort((a,b)=>a[3]-b[3])});
    }
    current=states.get(id);Art.setMap(current.def);
    $('title').textContent=`ด่าน ${current.def.idx+1} · ${current.def.name} · ${C.levelText(current.def)}`;
    $('subtitle').textContent=current.def.tpl?.subtitle||(id==='village'?'หมู่บ้านเริ่มต้น · สะพานหินและลานกลางค่าย':'สองฐานทัพ · เส้นทางเหนือ กลาง และใต้');
    for(const b of $('maps').children)b.setAttribute('aria-pressed',b.dataset.id===id?'true':'false');
    $('places').replaceChildren();
    const add=(name,x,y)=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>focus(x,y);$('places').append(b);};
    const spawn=C.spawnOf(current.def,'dharma'),lair=current.def.lair||C.CENTER;
    add(current.def.pvp?'ฐานธรรมะ':'ค่ายพัก',spawn.x,spawn.y);add('ลานบอส',(lair.tx+.5)*C.TILE,(lair.ty+.5)*C.TILE);
    if(current.def.pvp){const other=C.spawnOf(current.def,'adharma');add('ฐานอธรรม',other.x,other.y);}
    for(const p of current.def.tpl?.landmarks||[])add(p.name,(p.x+.5)*C.TILE,(p.y-1)*C.TILE);
    focus(spawn.x,spawn.y);
    $('status').textContent=`วัตถุ ${current.map.objects.length.toLocaleString('th-TH')} ชิ้น · พื้นที่ล่า ${current.def.zones.filter(z=>!z.fixed).length} จุด · บอส 1 จุด`;
    window.reviewReady=true;
  }
  for(const id of ids){const b=document.createElement('button');b.dataset.id=id;b.textContent=`${C.MAPS[id].idx+1} · ${C.MAPS[id].name}`;b.onclick=()=>select(id).catch(showError);$('maps').append(b);}
  function showError(e){$('status').textContent=e.message;console.error(e);}
  $('overview').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();focus((e.clientX-r.left)/r.width*current.map.w*C.TILE,(e.clientY-r.top)/r.height*current.map.h*C.TILE);};
  $('detail').onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);};
  $('detail').onpointermove=e=>{if(!drag)return;const s=720/e.currentTarget.getBoundingClientRect().width/zoom;camera.x-=(e.clientX-drag.x)*s;camera.y-=(e.clientY-drag.y)*s;drag={x:e.clientX,y:e.clientY};draw();};
  $('detail').onpointerup=$('detail').onpointercancel=()=>{drag=null;};
  $('detail').addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.2,Math.min(1.6,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
  window.HuntingReview={select,focus,draw,state:()=>current};select('pass').catch(showError);
})();
