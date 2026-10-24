// Stateless preview only: exercise actual game boot, map changes, painted occlusion and movement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3904',port=process.argv[3]||'9346',out=path.join(__dirname,'../artifacts/pass-v2');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[],failed=[];let seq=0;
 ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.includes(origin))failed.push(m.params.response.url);
  if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Timeout '+method)),60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('zoomMul','0.72')"});await send('Page.navigate',{url:origin});
  let ready=false;for(let i=0;i<350;i++){ready=await run("!!window.G?.map&&window.PassArt?.ready&&window.VillageArt?.ready&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
  assert(ready,JSON.stringify({errors,failed}));fs.mkdirSync(out,{recursive:true});
  const report=await run(`(async()=>{
   G.socket.disconnect();G.socket.emit=()=>{};document.getElementById('login').classList.add('hidden');
   const s=C.MAPS.pass.spawn,e={kind:'p',id:'painted-pass-review',x:s.x,y:s.y,tx:s.x,ty:s.y,dir:2,cls:'taoist',faction:'dharma',lvl:25,name:'ผู้เดินทาง',hp:140,mhp:140,flash:0,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0]};
   G.me=e;G.myId=e.id;G.cls=e.cls;G.ents.clear();G.ents.set(e.id,e);G.speed=205;G.stats=null;G.order=null;CharacterMotion.reset(e);
   const change=G.socket.listeners('mapchange')[0];await change({id:'pass',x:s.x,y:s.y});
   if(G.mapId!=='pass'||G.mapLoading)throw Error('Map switch failed');
   let painted=0;for(const o of G.map.objects){const p=Art.propSprite(o);if(!p)throw Error('Missing prop '+o[0]);if(p.paintedPass)painted++;}
   const p=Art.propSprite(G.map.objects.find(o=>o[1]==='watchtower')),sample=document.createElement('canvas');sample.width=sample.height=600;
   const g=sample.getContext('2d'),obj={x:300,y:500,sp:p};let alpha;const draw=g.drawImage.bind(g);g.drawImage=(...args)=>{alpha=g.globalAlpha;draw(...args);};
   VillageArt.drawProp(g,obj,{x:300,y:400});if(alpha>.4)throw Error('Roof failed to fade');VillageArt.drawProp(g,obj,{x:300,y:550});if(alpha!==1)throw Error('Roof stayed faded');
   // Return through the village and back to catch stale sprite/chunk caches.
   await change({id:'village',x:C.MAPS.village.spawn.x,y:C.MAPS.village.spawn.y});
   if(!Art.propSprite(G.map.objects.find(o=>o[0]==='village')).paintedVillage)throw Error('Village art replaced');
   await change({id:'pass',x:54.5*48,y:32*48});
   return {paintedProps:painted,roofFade:true,mapSwitches:true};
  })()`);
  await pause(1600);
  const shot=async name=>fs.writeFileSync(path.join(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await shot('watchtower-in-game');
  for(const [name,x,y]of [['camp-in-game',11.5,37],['gate-in-game',128.5,16],['bridge-in-game',82,35]]){
   await run(`G.socket.listeners('mapchange')[0]({id:'pass',x:${x}*48,y:${y}*48})`);await pause(1000);await shot(name);
  }
  await run("G.socket.listeners('mapchange')[0]({id:'pass',x:54.5*48,y:34.5*48})");await pause(300);
  const before=await run('G.me.x');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD'});await pause(650);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD'});
  assert((await run('G.me.x'))>before+25,'Player movement');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const result={...report,movement:true,errors,failedAssets:failed};fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
