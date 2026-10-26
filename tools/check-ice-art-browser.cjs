// Read-only map art review: no account, socket join, or player writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3918',port=process.argv[3]||'9362',out=path.join(__dirname,'../artifacts/ice-v2');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  const ws=new WS(page.webSocketDebuggerUrl),pending=new Map(),errors=[],failed=[];let seq=0;
  ws.on('message',raw=>{const m=JSON.parse(raw);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.startsWith(origin))failed.push(m.params.response.url);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(m.error):p.resolve(m.result);}
  });
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout '+method));},60000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    fs.mkdirSync(out,{recursive:true});await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+'/hunting-review.html'});
    let ready=false;for(let i=0;i<300;i++){ready=await run('!!window.reviewReady&&!!window.IceArt?.ready');if(ready)break;await pause(100);}assert(ready,JSON.stringify(errors));
    await run("HuntingReview.select('ice')");
    const checks=await run(`(()=>{
      const {map}=HuntingReview.state(),before=JSON.stringify([map.tiles,map.solid,map.objects]),report=[];
      for(const [cx,cy]of [[5,2],[6,1],[6,4],[8,5]])for(const res of [1,1.5,2]){
        const a=Art.renderChunk(map,cx,cy,res),b=Art.renderChunk(map,cx,cy,res),pixels=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
        if(a.toDataURL()!==b.toDataURL())throw Error('Unstable terrain');
        for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw Error('Transparent terrain');
      }
      for(const [cx,cy]of [[5,2],[6,1],[6,4],[8,5]])for(const [dx,dy]of [[.5,0],[0,.5]]){
        const a=Art.renderChunk(map,cx,cy,1),b=Art.renderChunk(map,cx+dx,cy+dy,1),s=a.width;
        const aa=a.getContext('2d').getImageData(dx*s,dy*s,s-dx*s,s-dy*s).data,bb=b.getContext('2d').getImageData(0,0,s-dx*s,s-dy*s).data;
        let changed=0;for(let i=0;i<aa.length;i++)if(Math.abs(aa[i]-bb[i])>2)changed++;
        if(changed>aa.length*.001)throw Error('Chunk seam '+cx+'/'+cy+' '+dx+'/'+dy+': '+changed+'/'+aa.length);
        report.push({cx,cy,dx,dy,changed});
      }
      const names=new Set();for(const o of map.objects){const p=Art.propSprite(o);if(!p)throw Error('Missing prop '+o[0]);
        if(!p.paintedIce)continue;names.add(o[0]);const w=p.img.width,h=p.img.height,data=p.img.getContext('2d').getImageData(0,0,w,h).data;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x<2||y<2||x>=w-2||y>=h-2)&&data[(y*w+x)*4+3])throw Error('Clipped prop '+o[0]);}
      if(before!==JSON.stringify([map.tiles,map.solid,map.objects]))throw Error('Art modified authoritative geometry');
      return {resolutions:[1,1.5,2],opaqueDeterministicChunks:12,seams:report,paintedTypes:[...names],geometryPreserved:true};
    })()`);
    for(const [name,x,y]of [['palace',72,8],['arena',72,20],['frozen-sea',60,43],['obelisk',72,47],['camp',12,48]]){
      await run(`HuntingReview.focus(${x}*C.TILE,${y}*C.TILE)`);
      const data=await run("document.getElementById('detail').toDataURL().split(',')[1]");fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));
    }
    const overview=await run("document.getElementById('overview').toDataURL().split(',')[1]");fs.writeFileSync(path.join(out,'overview.png'),Buffer.from(overview,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert(await run('document.documentElement.scrollWidth<=innerWidth'),'mobile overflow');
    fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    fs.writeFileSync(path.join(out,'art-check.json'),JSON.stringify({...checks,errors,failed},null,2));console.log(JSON.stringify(checks));
  }finally{await send('Page.close').catch(()=>{});ws.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
