// Compare the original cast assets with the actual normalized game sheets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.argv[2]||'http://localhost:3901';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const pages=await fetch('http://127.0.0.1:9334/json/list').then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)));
  assert(page,'Isolated browser required');
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{
    const m=JSON.parse(data);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
  };
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  try{
    await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:origin});
    let ready=false;
    for(let n=0;n<180;n++){
      ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if(ready)break;await pause(100);
    }
    assert(ready,'Game boot');
    const result=await run(`(async()=>{
      G.socket.disconnect();
      const meta=await fetch('assets/taoist.json').then(r=>r.json());
      const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
      const c=document.createElement('canvas');c.width=1400;c.height=600;
      const g=c.getContext('2d');g.fillStyle='#dce5df';g.fillRect(0,0,c.width,c.height);
      const poses=document.createElement('canvas');poses.width=1600;poses.height=1600;
      const pg=poses.getContext('2d');pg.fillStyle='#dce5df';pg.fillRect(0,0,poses.width,poses.height);
      const failures=[];let checked=0;
      for(const [fi,faction]of ['dharma','adharma'].entries()){
        const raw=await load('assets/taoist-'+faction+'-attack.png');
        const base=await load('assets/taoist-'+faction+'.png');
        const wm=meta.walk[faction],am=meta.attack[faction],key='tao-attack-'+faction;
        const I=ModelTiers.info(key),anchor=TaoistPose.point(key,0,0,am.anchorX,am.anchorY);
        const corrected=ArmorLook.sheet(faction,true,[0,0,0,0],0,[0,0,0,0,0],'taoist',0).sheet;
        const draw=(ctx,img,fw,fh,ax,ay,col,row,x,y)=>{
          ctx.drawImage(img,col*fw,row*fh,fw,fh,x-ax,y-ay,fw,fh);
        };
        const baseline=fi*300+250;
        draw(g,base,wm.frameWidth,wm.frameHeight,wm.anchorX,wm.anchorY,0,1,100,baseline);
        const names=['Idle','Seal: before','Seal: after','Whisk: before','Whisk: after','Palm: before','Palm: after'];
        for(let row=0;row<3;row++){
          draw(g,raw,am.frameWidth,am.frameHeight,am.anchorX,am.anchorY,0,row,300+row*400,baseline);
          draw(g,corrected,I.fw,I.fh,anchor[0],anchor[1],0,row,500+row*400,baseline);
        }
        for(let n=0;n<7;n++){
          g.fillStyle='#24434c';g.font='16px sans-serif';g.textAlign='center';
          g.fillText(names[n],n*200+100,baseline+30);
        }
        for(let col=0;col<8;col++){
          const walkF=ModelTiers.info('tao-walk-'+faction).frames[8+col];
          const shoulder=TaoistGear.attachment('tao-walk-'+faction,walkF);
          draw(pg,base,wm.frameWidth,wm.frameHeight,wm.anchorX,wm.anchorY,col,1,col*200+100,fi*800+190);
          for(let row=0;row<3;row++){
            const F=I.frames[row*8+col],a=TaoistGear.attachment(key,F);
            const foot=TaoistPose.point(key,row,col,am.anchorX,am.anchorY);
            if(Math.abs(foot[0]-anchor[0])>.001||Math.abs(foot[1]-anchor[1])>.001)failures.push('foot '+faction+row+col);
            if(Math.abs((anchor[1]-a[1])-(wm.anchorY-shoulder[1]))>.001)failures.push('body '+faction+row+col);
            if(Math.abs(a[2]-shoulder[2])>.001)failures.push('shoulder '+faction+row+col);
            const bh=anchor[1]-F.y0,wh=wm.anchorY-walkF.y0;
            if(Math.abs(bh-wh)>6)failures.push('height '+faction+row+col+': '+bh+'/'+wh);
            draw(pg,corrected,I.fw,I.fh,anchor[0],anchor[1],col,row,col*200+100,fi*800+(row+1)*200+190);
            checked++;
          }
        }
      }
      return {comparison:c.toDataURL().split(',')[1],poses:poses.toDataURL().split(',')[1],checked,failures};
    })()`);
    const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'taoist-attack-comparison.png'),Buffer.from(result.comparison,'base64'));
    fs.writeFileSync(path.join(out,'taoist-attack-directions.png'),Buffer.from(result.poses,'base64'));
    assert.equal(result.checked,48);assert.deepEqual(result.failures,[]);
    assert.deepEqual(errors,[]);
    const report={attackPoses:result.checked,bodyAndShouldersMatchIdle:true,feetStable:true,browserErrors:errors};
    fs.writeFileSync(path.join(out,'taoist-pose-check.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
