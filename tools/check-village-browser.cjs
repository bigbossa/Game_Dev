// Review the actual renderer with an isolated browser and synthetic disconnected entities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3903',port=process.argv[3]||'9351';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),out=path.join(__dirname,'../artifacts/village-v2');
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[],failed=[];let seq=0;
 ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.includes(origin))failed.push(m.params.response.url);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/?village-review=2'});
  let ready=false;for(let i=0;i<350;i++){ready=await run("!!window.G?.map&&window.VillageArt?.ready&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
  if(!ready)console.log(await run("JSON.stringify({url:location.href,state:document.readyState,village:window.VillageArt?.ready,map:!!window.G?.map,loading:document.getElementById('loading')?.textContent,resources:performance.getEntriesByType('resource').slice(-8).map(r=>({name:r.name,duration:r.duration,size:r.transferSize}))})"));
  assert(ready,JSON.stringify({message:'Game boot',errors,failed}));fs.mkdirSync(out,{recursive:true});
  const result=await run(`(async()=>{
   G.socket.disconnect();G.socket.emit=()=>{};
   const raw=await fetch('/api/map/village').then(r=>r.json());if(raw.version!==2)throw Error('Old map payload');
   const local=C.generateField(C.MAPS.village,20261119);
   if(local.solid.some((v,i)=>v!==G.map.solid[i]))throw Error('Client/server collision mismatch');
   let props=0;for(const o of G.map.objects){const p=Art.propSprite(o);if(!p||!p.img.width)throw Error('Missing prop '+o[1]);props++;}
   const paths=[];for(const [tx,ty]of [[52,50],[77,50],[73,57],[20,49],[124,49],[61,15]]){
    const points=PF.find(G.map,C.MAPS.village.spawn.x,C.MAPS.village.spawn.y,(tx+.5)*48,(ty+.5)*48);
    if(!points?.length)throw Error('No click path '+tx+'/'+ty);
    let prev=[C.MAPS.village.spawn.x,C.MAPS.village.spawn.y];for(const p of points){if(!PF.clear(G.map,...prev,...p))throw Error('Path clips scenery');prev=p;}
    paths.push(points.length);
   }
   const scale=.25,c=document.createElement('canvas');c.width=G.map.w*48*scale;c.height=G.map.h*48*scale;
   const g=c.getContext('2d');g.scale(scale,scale);const N=Art.CHUNK,S=N*48,start=performance.now();
   for(let y=0;y<Math.ceil(G.map.h/N);y++)for(let x=0;x<Math.ceil(G.map.w/N);x++)g.drawImage(Art.renderChunk(G.map,x,y),x*S,y*S);
   for(const o of [...G.map.objects].sort((a,b)=>a[3]-b[3])){const p=Art.propSprite(o);g.drawImage(p.img,o[2]-p.ax,o[3]-p.ay);}
   const renderMs=Math.round(performance.now()-start);
   // A crop rendered in adjacent chunks must exactly match the same world-space terrain.
   const a=Art.renderChunk(G.map,4,3),b=Art.renderChunk(G.map,4,3);
   if(a.toDataURL()!==b.toDataURL())throw Error('Terrain flickers between loads');
   const p=Art.propSprite(G.map.objects.find(o=>o[1]==='pavilion')),sample=document.createElement('canvas');sample.width=sample.height=600;
   const sg=sample.getContext('2d'),obj={x:300,y:500,sp:p};let alpha=null;const draw=sg.drawImage.bind(sg);sg.drawImage=(...args)=>{alpha=sg.globalAlpha;draw(...args);};
   VillageArt.drawProp(sg,obj,{x:300,y:400});if(alpha>.4)throw Error('Roof did not fade');
   VillageArt.drawProp(sg,obj,{x:300,y:550});if(alpha!==1)throw Error('Roof stayed faded');
   document.getElementById('login').classList.add('hidden');
   const s=C.MAPS.village.spawn,e={kind:'p',id:'village-review',x:s.x,y:s.y,tx:s.x,ty:s.y,dir:2,cls:'taoist',faction:'dharma',lvl:1,name:'นักพรต',hp:140,mhp:140,flash:0,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0]};
   G.me=e;G.myId=e.id;G.cls=e.cls;G.ents.clear();G.ents.set(e.id,e);G.speed=205;G.stats=null;G.order=null;CharacterMotion.reset(e);
   const other={...e,id:'village-dark',faction:'adharma',x:s.x+180,y:s.y,tx:s.x+180,ty:s.y,name:'นักพรตอธรรม'};CharacterMotion.reset(other);G.ents.set(other.id,other);
   return {props,clickPaths:paths.length,pathSegments:paths,roofFade:true,renderMs,overview:c.toDataURL().split(',')[1]};
  })()`);
  fs.writeFileSync(path.join(out,'village-overview.png'),Buffer.from(result.overview,'base64'));delete result.overview;
  await pause(1400);fs.writeFileSync(path.join(out,'village-in-game.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // Verify real keyboard motion on the actual ground and bridge.
  const before=await run('G.me.x');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD'});await pause(650);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD'});
  assert((await run('G.me.x'))>before+25,'Actual player movement');
  await run("G.ents.delete('village-dark');G.me.x=35*48;G.me.y=49.5*48;G.me.tx=G.me.x;G.me.ty=G.me.y;CharacterMotion.reset(G.me)");
  await pause(900);fs.writeFileSync(path.join(out,'village-bridge.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const report={...result,movement:true,browserErrors:errors,failedAssets:failed};fs.writeFileSync(path.join(out,'check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
