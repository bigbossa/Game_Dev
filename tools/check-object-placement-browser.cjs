// Read-only map review: checks the actual Canvas assets against server geometry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3923',port=process.argv[3]||'9362';
const out=path.join(__dirname,'../artifacts/map-placement'),pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Timeout '+method)),60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 const shot=async(id,canvas)=>fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(await run(`document.getElementById('${canvas}').toDataURL('image/png').split(',')[1]`),'base64'));
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin+'/hunting-review.html'});await send('Page.bringToFront');
  let ready=false;for(let i=0;i<100;i++){ready=await run('!!window.reviewReady');if(ready)break;await pause(150);}assert(ready,JSON.stringify(errors));
  await run("document.getElementById('detail').dispatchEvent(new WheelEvent('wheel',{deltaY:250,cancelable:true}))");
  const report=[];
  for(const id of await run('C.MAP_ORDER')){
   await run(`HuntingReview.select(${JSON.stringify(id)})`);
   const result=await run(`(()=>{
    const {map,def}=HuntingReview.state(),local=def.pvp?C.generateMap(20261018):C.generateField(def,20261018+101*(def.idx+1));
    if(JSON.stringify(map.objects)!==JSON.stringify(local.objects)||map.tiles.some((v,i)=>v!==local.tiles[i])||map.solid.some((v,i)=>v!==local.solid[i]))throw Error('Client/server geometry mismatch');
    const buildings=[];
    for(const o of map.objects){if(o[0]==='sigil'){if(!Art.sigil()?.width)throw Error('Missing ground sigil');continue;}const p=Art.propSprite(o);if(!p)throw Error('Missing sprite '+o[0]+'/'+o[1]);
     if(!def.pvp&&def.id!=='village'&&['house','smith','apothecary','enhancer'].includes(o[0]))buildings.push({type:o[0],x:o[2]-p.ax,y:o[3]-p.ay,w:p.img.width,h:p.img.height});
    }
    for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++){const a=buildings[i],b=buildings[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error('Building overlap '+a.type+'/'+b.type);}
    return {id:def.id,props:map.objects.length,clientServerMatch:true,buildingBounds:buildings};
   })()`);
   report.push(result);await shot(id+'-overview','overview');await shot(id+'-camp','detail');
   await run(`(()=>{const d=HuntingReview.state().def,l=d.lair||C.CENTER;HuntingReview.focus((l.tx+.5)*C.TILE,(l.ty+.5)*C.TILE);})()`);await shot(id+'-arena','detail');
   console.log(JSON.stringify({id,props:result.props,clientServerMatch:true,buildingsSeparated:true}));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await run('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');
  assert.equal(await run("document.querySelectorAll('#maps button').length"),8);
  const screen=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from(screen.data,'base64'));
  assert.equal(errors.length,0,JSON.stringify(errors));fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({origin,maps:report,errors},null,2));
 }finally{await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`).catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
