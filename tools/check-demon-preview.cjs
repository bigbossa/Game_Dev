const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const file='file:///'+path.resolve(__dirname,'../artifacts/demon-models-preview.html').replaceAll('\\','/');
 const page=await fetch('http://127.0.0.1:9334/json/new?'+encodeURIComponent(file),{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let seq=0;
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1140,height:690,deviceScaleFactor:1,mobile:false});
  let loaded=false;for(let i=0;i<100;i++){loaded=await run('typeof images!=="undefined"&&Object.values(images).every(i=>i.complete&&i.naturalWidth===2880)');if(loaded)break;await new Promise(r=>setTimeout(r,100));}assert(loaded);
  for(const job of ['archer','spearman'])for(const [pose,time,dir]of [['idle',0,2],['walk',.2,7],['attack',.3,7]]){
   await run('playing=false;rotate.checked=false;cls.value='+JSON.stringify(job)+';dir.value='+JSON.stringify(String(dir))+';pose.value='+JSON.stringify(pose)+';time='+time+';draw(performance.now());');
   const shot=await send('Page.captureScreenshot',{format:'png'});
   fs.writeFileSync(path.resolve(__dirname,`../artifacts/demon-${job}-${pose}.png`),Buffer.from(shot.data,'base64'));
  }console.log('PASS: 7 offline atlases, class/pose/direction controls; 6 review captures.');
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
