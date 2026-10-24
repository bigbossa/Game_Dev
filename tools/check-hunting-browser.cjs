// Run with npm run preview:maps and an isolated Chromium debugger on port 9336.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const C=require('../shared/world-data'),origin=process.argv[2]||'http://127.0.0.1:3903',port=process.argv[3]||'9336';
const out=path.join(__dirname,'../artifacts/hunting-v3'),pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin+'/hunting-review.html')}`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Timeout '+method)),60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1050,deviceScaleFactor:1,mobile:false});
  let ready=false;for(let i=0;i<100;i++){ready=await run('!!window.reviewReady');if(ready)break;await pause(150);}assert(ready,JSON.stringify(errors));
  const report=[];
  for(const id of ['pass','forest','manor','temple','ice','fire']){
   await run(`HuntingReview.select(${JSON.stringify(id)})`);
   const def=C.MAPS[id],expected=C.generateField(def,20261018+101*(def.idx+1));
   const result=await run(`(()=>{
     const {map,def}=HuntingReview.state(),local=C.generateField(def,20261018+101*(def.idx+1));
     if(JSON.stringify(map.objects)!==JSON.stringify(local.objects)||map.tiles.some((v,i)=>v!==local.tiles[i])||map.solid.some((v,i)=>v!==local.solid[i]))throw Error('Client/server geometry mismatch');
     let landmarks=0;for(const o of map.objects){
       const p=Art.propSprite(o);if(!p)throw Error('Missing sprite '+o[0]);
       if(o[0]==='landmark')landmarks++;
       else if(!(def.id==='pass'&&o[0]==='tree'))continue;
       const g=p.img.getContext('2d'),w=p.img.width,h=p.img.height,d=g.getImageData(0,0,w,h).data;
       let ink=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=d[(y*w+x)*4+3];if(a>128)ink++;if((x<2||y<2||x>=w-2||y>=h-2)&&a)throw Error('Clipped '+o[1]);}
       if(ink<1500)throw Error('Empty '+o[1]);
     }
     return {id:def.id,version:map.version,landmarks,props:map.objects.length,clientServerMatch:true};
   })()`);
   assert.equal(result.props,expected.objects.length);report.push(result);
   for(const cv of ['overview','detail']){
    const image=await run(`document.getElementById('${cv}').toDataURL('image/png').split(',')[1]`);
    fs.writeFileSync(path.join(out,id+'-'+cv+'.png'),Buffer.from(image,'base64'));
   }
   await run(`(()=>{const d=HuntingReview.state().def;HuntingReview.focus((d.lair.tx+.5)*C.TILE,(d.lair.ty+.5)*C.TILE);})()`);
   const boss=await run("document.getElementById('detail').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,id+'-arena.png'),Buffer.from(boss,'base64'));
   if(id==='pass'){
    for(const [name,x,y]of [['bridge',82,35],['willows',43,47],['gate',128,12],['cliffs',51,8],['camp',11,36]]){
     await run(`HuntingReview.focus(${x}*C.TILE,${y}*C.TILE)`);
     const shot=await run("document.getElementById('detail').toDataURL('image/png').split(',')[1]");fs.writeFileSync(path.join(out,'pass-'+name+'.png'),Buffer.from(shot,'base64'));
    }
    assert(await run(`(()=>{
      const {map}=HuntingReview.state(),before=JSON.stringify([map.tiles,map.solid,map.objects]);
      const a=Art.renderChunk(map,6,2,1),b=Art.renderChunk(map,6,2,1);
      if(a.toDataURL()!==b.toDataURL())throw Error('Unstable stage 2 ground');
      if(before!==JSON.stringify([map.tiles,map.solid,map.objects]))throw Error('Renderer modified geometry');
      const data=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
      for(let i=3;i<data.length;i+=4)if(data[i]!==255)throw Error('Transparent ground seam');
      // Shift the chunk origin by half a chunk: overlapping world pixels must agree.
      // Covers river/road shoulders and cliff scatter, whose padded drawing must not depend on camera.
      for(const [cx,cy]of [[6,2],[10,0]])for(const [dx,dy]of [[.5,0],[0,.5]]){
        const first=Art.renderChunk(map,cx,cy,1),shifted=Art.renderChunk(map,cx+dx,cy+dy,1),s=first.width;
        const aa=first.getContext('2d').getImageData(dx*s,dy*s,s-dx*s,s-dy*s).data;
        const bb=shifted.getContext('2d').getImageData(0,0,s-dx*s,s-dy*s).data;
        let changed=0;for(let i=0;i<aa.length;i++)if(Math.abs(aa[i]-bb[i])>2)changed++;
        if(changed>aa.length*.001)throw Error('Stage 2 chunk seam '+cx+'/'+cy+' '+dx+'/'+dy+': '+changed);
      }
      return true;
    })()`));
   }
   console.log(JSON.stringify(result));
  }
  // Overview click and drag/zoom interact with the same camera used for captures.
  await run(`(()=>{const cv=document.getElementById('detail'),r=cv.getBoundingClientRect();cv.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:r.left+100,clientY:r.top+100,cancelable:true}));document.querySelector('#places button').click();})()`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await run('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');
  const screen=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from(screen.data,'base64'));
  assert.equal(errors.length,0,JSON.stringify(errors));
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({maps:report,errors},null,2));
 }finally{await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`).catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
