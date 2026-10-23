const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const page=await fetch('http://127.0.0.1:9334/json/new?http://localhost:3901',{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');let ready=false;
  for(let i=0;i<250;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
  const result=await run(`(async()=>{
   G.socket.disconnect();G.ents.clear();if(MonsterArt.style!=='feral')throw Error('Legacy monster shapes loaded');
   const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const hash=c=>{let h=2166136261;for(const v of pixels(c))h=Math.imul(h^v,16777619);return h;};
   const all=Object.entries(C.MONSTERS),gallery=mk(1600,Math.ceil(all.length/8)*200),g=gallery.getContext('2d');g.fillStyle='#b9b3a1';g.fillRect(0,0,gallery.width,gallery.height);
   let frames=0,clipped=0;const start=performance.now();
   for(const [i,[id,d]]of all.entries()){
    const x=(i%8)*200,y=Math.floor(i/8)*200,scale=Math.min(1.65,145/MonsterArt.heightOf(id),170/((C.MON_ART[d.art].r*2+45)*(d.size||1)));
    g.save();g.translate(x+100,y+164);g.scale(scale,scale);MonsterArt.draw(g,id,0,0,1,.3,{seed:2,moving:false,atk:0});g.restore();
    g.font='12px sans-serif';g.textAlign='center';g.fillStyle='#252a2b';g.fillText(d.name,x+100,y+185);g.fillText('Lv.'+d.lvl,x+100,y+198);
    for(const face of [-1,1])for(const moving of [false,true])for(const atk of [0,1]){
     const c=mk(500,500),ctx=c.getContext('2d');MonsterArt.draw(ctx,id,250,400,face,.4,{seed:2,moving,atk,casting:!moving});
     const p=pixels(c);if(!p.some(v=>v))throw Error('Empty monster '+id);
     for(let y=0;y<500;y++)if(p[(y*500)*4+3]||p[(y*500+499)*4+3])clipped++;
     for(let x=0;x<500;x++)if(p[x*4+3]||p[(499*500+x)*4+3])clipped++;frames++;
    }
   }
   const renderMs=performance.now()-start,maps={},timings={};let deterministic=0;
   const bench=mk(1100,800),bg=bench.getContext('2d'),b0=performance.now();
   const crowd=()=>{for(let frame=0;frame<20;frame++){bg.clearRect(0,0,1100,800);for(let n=0;n<24;n++)MonsterArt.draw(bg,all[n][0],80+n%8*130,220+Math.floor(n/8)*220,1,frame/60,{seed:n,moving:true,atk:0});}};
   crowd();const coldMonsterFrameMs=Math.round((performance.now()-b0)/20*10)/10,b1=performance.now();crowd();
   const monsterFrameMs=Math.round((performance.now()-b1)/20*10)/10;
   const wolfDraw=MonsterArt.wolf;let hotGeometryCalls=0;
   MonsterArt.draw(bg,'wolf',300,300,1,0,{moving:false,seed:0});
   MonsterArt.wolf=(...args)=>{hotGeometryCalls++;return wolfDraw(...args);};
   for(let i=0;i<100;i++)MonsterArt.draw(bg,'wolf',300,300,i%2?1:-1,0,{moving:false,seed:0,flash:i%2*.2,alpha:.8});
   MonsterArt.wolf=wolfDraw;if(hotGeometryCalls)throw Error('Cached pose redrew geometry');
   for(const id of C.MAP_ORDER){
    const data=await fetch('/api/map/'+id).then(r=>r.json()),map={...data,tiles:Uint8Array.from(atob(data.tiles),c=>c.charCodeAt(0)),solid:Uint8Array.from(atob(data.solid),c=>c.charCodeAt(0))};
    Art.setMap(C.MAPS[id]);
    const N=Art.CHUNK,S=N*C.TILE;let best={score:-1,x:1,y:1};
    for(let cy=1;cy<Math.floor(map.h/N)-1;cy++)for(let cx=1;cx<Math.floor(map.w/N)-1;cx++){
     const counts={};for(let y=cy*N;y<(cy+1)*N;y++)for(let x=cx*N;x<(cx+1)*N;x++){const t=map.tiles[y*map.w+x];counts[t]=(counts[t]||0)+1;}
     const score=Object.keys(counts).length*30+Math.min(25,counts[C.T.PATH]||0)+Math.min(35,counts[C.T.WATER]||0)-(counts[C.T.PLAZA]||0);
     if(score>best.score)best={score,x:cx,y:cy};
    }
    const c=mk(900,620),ctx=c.getContext('2d'),ox=best.x*S-160,oy=best.y*S-70,t0=performance.now();
    for(let cy=Math.floor(oy/S);cy<=Math.floor((oy+620)/S);cy++)for(let cx=Math.floor(ox/S);cx<=Math.floor((ox+900)/S);cx++){
     const chunk=Art.renderChunk(map,cx,cy);ctx.drawImage(chunk,cx*S-ox,cy*S-oy);
     if(cx===best.x&&cy===best.y){if(hash(chunk)!==hash(Art.renderChunk(map,cx,cy)))throw Error('Unstable terrain '+id);deterministic++;}
    }
    timings[id]=Math.round(performance.now()-t0);
    for(const o of map.objects.filter(o=>o[2]>ox-180&&o[2]<ox+1080&&o[3]>oy-30&&o[3]<oy+820).sort((a,b)=>a[3]-b[3])){const p=Art.propSprite(o);if(p)ctx.drawImage(p.img,o[2]-ox-p.ax,o[3]-oy-p.ay);}
    const mons=C.MAPS[id].mons||['boss'];for(let n=0;n<Math.min(3,mons.length);n++){
     let spot=null,dist=Infinity;for(let y=240;y<540;y+=20)for(let x=180;x<780;x+=20){const d=Math.hypot(x-(280+n*160),y-420);if(d<dist&&C.canStand(map,x+ox,y+oy,C.MONSTERS[mons[n]].radius)){spot=[x,y];dist=d;}}
     if(spot)MonsterArt.draw(ctx,mons[n],...spot,1,.3,{seed:n,atk:0,moving:false});
    }
    ctx.fillStyle='#151d24dd';ctx.fillRect(0,0,900,40);ctx.fillStyle='#e5dec7';ctx.font='bold 20px sans-serif';ctx.fillText(C.MAPS[id].name,24,28);maps[id]=c.toDataURL().split(',')[1];
   }
   const effects=mk(1200,700),eg=effects.getContext('2d');eg.fillStyle='#555b4d';eg.fillRect(0,0,1200,700);let skillChecks=0;
   for(const [i,art]of ['wolf','golem','bird','dragon','human','serpent'].entries()){
    const sk=C.MONSTER_SKILLS[art],d={...sk,art,id:'preview',token:'preview-'+i,t:'monsterWindup',x:200+(i%3)*400,y:200+Math.floor(i/3)*350,a:-Math.PI/2,d:sk.cast};
    FX.list=[];FX.monsterSkill(d);FX.monsterSkill(d);if(FX.list.length!==1)throw Error('Repeated warning token');for(const fx of FX.list)fx.draw(eg,.65,fx);
    if(!C.monsterSkillContains(d,d.x,d.y))throw Error('Geometry mismatch');
    FX.monsterSkill({...d,t:'monsterCancel'});if(FX.list.some(f=>f.monsterToken===d.token))throw Error('Warning survived cancel');
    FX.monsterSkill({...d,t:'monsterRelease'});for(const fx of FX.list)fx.draw(eg,.35,fx);skillChecks++;
   }
   FX.list=[];
   return{frames,clipped,renderMs:Math.round(renderMs),coldMonsterFrameMs,monsterFrameMs,hotGeometryCalls,deterministic,timings,skillChecks,maps,gallery:gallery.toDataURL().split(',')[1],effects:effects.toDataURL().split(',')[1]};
  })()`);
  fs.mkdirSync('artifacts',{recursive:true});for(const k of ['gallery','effects']){fs.writeFileSync('artifacts/feral-'+k+'.png',Buffer.from(result[k],'base64'));delete result[k];}
  for(const [id,img]of Object.entries(result.maps))fs.writeFileSync('artifacts/feral-map-'+id+'.png',Buffer.from(img,'base64'));delete result.maps;
  result.browserErrors=errors;fs.writeFileSync('artifacts/feral-check.json',JSON.stringify(result,null,2));assert.equal(result.clipped,0);assert.equal(errors.length,0);console.log(JSON.stringify(result));
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
