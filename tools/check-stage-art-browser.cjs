// Read-only review: actual terrain renderer, no account or gameplay writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3918',port=process.argv[3]||'9362',out=path.join(__dirname,'../artifacts/stages-v2');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json()),ws=new WS(page.webSocketDebuggerUrl),pending=new Map(),errors=[],failed=[];let seq=0;
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.startsWith(origin))failed.push(m.params.response.url);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(m.error):p.resolve(m.result);}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout '+method));},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  fs.mkdirSync(out,{recursive:true});await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin+'/hunting-review.html'});
  let ready;for(let i=0;i<400;i++){ready=await run('!!window.reviewReady&&!!window.StageArt?.ready');if(ready)break;await pause(100);}assert(ready,JSON.stringify(errors));
  const reports=[];
  for(const id of ['forest','manor','temple','fire']){
   await run(`HuntingReview.select('${id}')`);
   const check=await run(`(()=>{
    const {map,def}=HuntingReview.state(),before=JSON.stringify([map.tiles,map.solid,map.objects]),seams=[];
    const positions=[[Math.floor(def.lair.tx/12),Math.floor(def.lair.ty/12)],[3,4],[5,5],[7,2]];
    for(const [cx,cy]of positions)for(const res of [1,1.5,2]){
     const a=Art.renderChunk(map,cx,cy,res),b=Art.renderChunk(map,cx,cy,res),pixels=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
     if(a.toDataURL()!==b.toDataURL())throw Error('Unstable '+map.id);
     for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw Error('Transparent terrain '+map.id);
    }
    for(const [cx,cy]of positions)for(const [dx,dy]of [[.5,0],[0,.5]]){
     const a=Art.renderChunk(map,cx,cy),b=Art.renderChunk(map,cx+dx,cy+dy),s=a.width;
     const aa=a.getContext('2d').getImageData(dx*s,dy*s,s-dx*s,s-dy*s).data,bb=b.getContext('2d').getImageData(0,0,s-dx*s,s-dy*s).data;
     let changed=0,large=0,maxDelta=0;for(let i=0;i<aa.length;i++){const d=Math.abs(aa[i]-bb[i]);if(d>2)changed++;if(d>10)large++;maxDelta=Math.max(maxDelta,d);}
     if(changed>aa.length*.001&&!${process.argv.includes('--diagnose')})throw Error('Chunk seam '+map.id+' '+cx+'/'+cy+' '+dx+'/'+dy+': '+changed+'/'+aa.length+' large='+large+' max='+maxDelta);
     seams.push({cx,cy,dx,dy,changed,large,maxDelta});
    }
    const names=new Set(),images=new Set();for(const o of map.objects){const p=Art.propSprite(o);if(!p)throw Error('Missing '+o[0]);if(!p.paintedStage)continue;names.add(o[0]);
     if(images.has(p.img))continue;images.add(p.img);const w=p.img.width,h=p.img.height,data=p.img.getContext('2d').getImageData(0,0,w,h).data;
     for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x<2||y<2||x>=w-2||y>=h-2)&&data[(y*w+x)*4+3])throw Error('Clipped '+map.id+' '+o[0]);
    }
    if(before!==JSON.stringify([map.tiles,map.solid,map.objects]))throw Error('Geometry changed');
    return {id:map.id,opaqueDeterministicChunks:12,seams,paintedTypes:[...names],geometryPreserved:true,places:def.tpl.landmarks.map(l=>[l.kind,l.x,l.y]),lair:def.lair,spawn:def.spawn};
   })()`);
   reports.push(check);const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});
   const places=[...check.places.map(([n,x,y])=>[n,x*48,y*48]),['arena',check.lair.tx*48,check.lair.ty*48],['camp',check.spawn.x,check.spawn.y]];
   for(const [name,x,y]of places){await run(`HuntingReview.focus(${x},${y})`);const data=await run("document.getElementById('detail').toDataURL().split(',')[1]");fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(data,'base64'));}
   fs.writeFileSync(path.join(dir,'overview.png'),Buffer.from(await run("document.getElementById('overview').toDataURL().split(',')[1]"),'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await run('document.documentElement.scrollWidth<=innerWidth'),'mobile overflow');
  fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);fs.writeFileSync(path.join(out,'art-check.json'),JSON.stringify({reports,errors,failed},null,2));console.log(JSON.stringify({maps:reports.map(r=>r.id),chunks:48,seams:32,errors,failed}));
 }finally{await send('Page.close').catch(()=>{});ws.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
