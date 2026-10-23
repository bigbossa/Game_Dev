const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.argv[2]||'http://localhost:3901',port=process.argv[3]||'9334';
(async()=>{
  const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`,{method:'PUT'}).then(r=>r.json());
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await send('Runtime.enable');let ready=false;
    for(let i=0;i<250;i++){ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
    const result=await run(`(()=>{
      G.socket.disconnect();G.ents.clear();G.cls='spearman';C.setViewClass('spearman');
      const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      const hash=(c,alphaOnly=false)=>{let h=2166136261;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=alphaOnly?3:0;i<d.length;i+=alphaOnly?4:1)h=Math.imul(h^d[i],16777619);return h;};
      const gallery=make(1540,920),g=gallery.getContext('2d');g.fillStyle='#172331';g.fillRect(0,0,1540,920);
      const poses=make(1600,960),pg=poses.getContext('2d');pg.fillStyle='#172331';pg.fillRect(0,0,1600,960);
      let frames=0,border=0,icons=0,cacheReads=0;const iconHashes={},silhouettes=new Set();
      for(const [fi,f]of ['dharma','adharma'].entries()){
        iconHashes[f]=[];
        for(let t=0;t<=10;t++){
          const im=ItemArt.iconCanvas(C.WEAPONS[t].id,f,128);iconHashes[f].push(hash(im));icons++;
          g.drawImage(im,t*140+6,fi*460+8);
          // Render equal-size heads at a fixed origin for silhouette comparisons.
          const shape=make(140,100),sg=shape.getContext('2d');sg.translate(24,50);SpearWeapon.head(sg,t,f,100,20);silhouettes.add(hash(shape,true));
          g.save();g.translate(t*140+20,fi*460+200);SpearWeapon.head(g,t,f,100,100*SpearWeapon.design(t,f).width);g.restore();
          g.fillStyle='#e8d4a5';g.textAlign='center';g.font='14px sans-serif';g.fillText('Lv.'+C.WEAPONS[t].lvl,t*140+70,fi*460+154);
          g.font='12px sans-serif';g.fillText(SpearWeapon.design(t,f).name,t*140+70,fi*460+240);
          G.me={cls:'spearman',faction:f,lvl:30,x:0,y:0,dir:2,wt:t,wp:0,ar:[0,0,0,0],gg:[0,0,0,0,0],gp:[0,0,0,0,0]};
          g.save();g.translate(t*140,fi*460+250);G.drawPreview(g,140,195,0,{atk:false,dir:2,frame:3});g.restore();
          for(const atk of [false,true])for(let frame=0;frame<(atk?3:4);frame++)for(let col=0;col<8;col++){
            const a=SpearmanLook.anchor(f,atk,frame,col),c=make(320,280),cg=c.getContext('2d');
            SpearWeapon.held(cg,a,t,f,320,280);frames++;
            const d=cg.getImageData(0,0,320,280).data;
            for(let x=0;x<320;x++)for(const y of [0,1,278,279])if(d[(y*320+x)*4+3])border++;
            for(let y=0;y<280;y++)for(const x of [0,1,318,319])if(d[(y*320+x)*4+3])border++;
            const dir=C.DIR_COL.indexOf(col),line=SpearmanLook.weaponLine(G.me,{atk,frame,dir}),tip=SpearWeapon.fit(a,t).tip;
            if(Math.hypot(line[1][0]+a.feetX-tip[0],line[1][1]+a.feetY-tip[1])>.01)throw Error('Enhancement line misses tip');
            if(!d.some((v,i)=>i%4===3&&v))throw Error('Missing spearhead');
          }
        }
        G.me.wt=10;
        for(const [row,atk]of [false,true].entries())for(let dir=0;dir<8;dir++){
          pg.save();pg.translate(dir*200,(fi*2+row)*240);G.drawPreview(pg,200,220,0,{atk,dir,frame:atk?1:3});pg.restore();
          pg.fillStyle='#f5d7a6';pg.font='13px sans-serif';pg.fillText(f+' '+(atk?'attack':'idle')+' '+dir,dir*200+25,(fi*2+row)*240+236);
        }
      }
      const native=CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData=function(...a){cacheReads++;return native.apply(this,a);};
      try{const c=make(320,280),g=c.getContext('2d');for(let i=0;i<200;i++)SpearWeapon.held(g,SpearmanLook.anchor('dharma',false,3,0),10,'dharma',320,280);}finally{CanvasRenderingContext2D.prototype.getImageData=native;}
      return {frames,border,icons,iconHashes,uniqueSilhouettes:silhouettes.size,cacheReads,gallery:gallery.toDataURL(),poses:poses.toDataURL()};
    })()`);
    const out=path.join(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
    for(const [field,file]of [['gallery','spear-weapon-levels'],['poses','spear-weapon-poses']]){fs.writeFileSync(path.join(out,file+'.png'),Buffer.from(result[field].split(',')[1],'base64'));delete result[field];}
    fs.writeFileSync(path.join(out,'spear-weapon-check.json'),JSON.stringify({...result,errors},null,2));
    assert.equal(result.border,0,'Spear is clipped at a cell edge');assert.equal(result.cacheReads,0);assert.equal(result.uniqueSilhouettes,11);
    for(const hashes of Object.values(result.iconHashes))assert.equal(new Set(hashes).size,11);
    assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify(result));
  }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
