const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const before=process.argv.includes('--before');
(async()=>{
 const page=await fetch('http://127.0.0.1:9334/json/new?http://localhost:3901',{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');let ready=false;
  for(let i=0;i<300;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
  // Reproduce the old classifier in this isolated page only; never edit the shipped file.
  if(before)await run("fetch('js/spearman-gear.js').then(r=>r.text()).then(s=>(0,eval)(s.replace('||faceMask?.[k]','').replace('t&&!(dark&&tier>=6)','t')))");
  const result=await run(`(async()=>{
   G.socket.disconnect();G.ents.clear();
   const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
   const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
   const images={},royal=await load('assets/adharma-hair/spearman-adharma-royal.png'),attack=await load('assets/adharma-hair/spearman-adharma-royal-attack.png');
   // Reviewed face bounds on the shipped royal atlas; independent of the runtime classifier.
   const idle=[[131,120,175,161],[175,119,211,154],[179,123,205,155],[187,135,205,152]];
   const bounds={walk:[[[133,127,172,160],[178,129,214,161],[185,132,209,163],[190,140,212,156]],idle,[[135,126,176,160],[181,127,217,158],[190,129,216,158],[191,136,211,154]],idle],attack:[idle,[[147,139,188,168],[153,155,192,182],[157,160,191,189],[196,149,207,158]],idle]};
   let facePixels=0,faceChanges=0,frames=0,hotReads=0,bodyPixels=0,bodyHoles=0;const changedRegions={};
   for(const lvl of [100,110,120,130])for(const [pose,src]of [['walk',royal],['attack',attack]]){
    const raw=make(src.width,src.height);raw.getContext('2d').drawImage(src,0,0);const original=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
    const ar=C.ARMOR_SETS.filter(s=>s.lvl<=lvl).length,wt=C.WEAPONS.filter(s=>s.lvl<=lvl).at(-1).tier;
    const body=ArmorLook.sheet('adharma',pose==='attack',[ar,ar,ar,ar],ModelTiers.tierOf(lvl),null,'spearman',wt).sheet;
    const d=body.getContext('2d').getImageData(0,0,body.width,body.height).data;
    const rig=SpearmanLook.modelMeta('adharma',pose==='attack',ModelTiers.tierOf(lvl));
    for(let row=0;row<bounds[pose].length;row++)for(let col=0;col<8;col++){
     const a=rig.poseFrames[row*8+col],B=a.bodyHeight,[tx,ty]=a.weaponTip,[hx,hy]=a.grip,dx=hx-tx,dy=hy-ty,L=Math.hypot(dx,dy);
     for(let y=Math.ceil(a.headTop+B*.55);y<280;y++)for(let x=0;x<320;x++){
      const k=((row*280+y)*body.width+col*320+x)*4;if(original[k+3]<250)continue;
      const along=((x-tx)*dx+(y-ty)*dy)/(L*L),dist=Math.abs((x-tx)*dy-(y-ty)*dx)/L;
      if(along<.55&&dist<B*.12)continue; // authored spearhead is intentionally replaced
      bodyPixels++;if(d[k+3]<245)bodyHoles++;
     }
    }
    for(let row=0;row<bounds[pose].length;row++)for(let col=0;col<8;col++){
     frames++;if(col===4)continue;const b=bounds[pose][row][col>4?8-col:col];
     let cx=(b[0]+b[2])/2;const cy=(b[1]+b[3])/2,rx=(b[2]-b[0])*.40,ry=(b[3]-b[1])*.40;if(col>4)cx=319-cx;
     for(let y=Math.ceil(cy-ry);y<=cy+ry;y++)for(let x=Math.ceil(cx-rx);x<=cx+rx;x++){
      if(((x-cx)/rx)**2+((y-cy)/ry)**2>1)continue;
      const k=((row*280+y)*body.width+col*320+x)*4;if(original[k+3]<250)continue;
      // Side-view bangs cross this bounding ellipse; cool violet strands are hair, not skin/eyes.
      if(original[k+2]>original[k+1])continue;
      facePixels++;if(d[k]!==original[k]||d[k+1]!==original[k+1]||d[k+2]!==original[k+2]||d[k+3]!==original[k+3]){faceChanges++;const key=pose+' '+row+' '+col;const q=changedRegions[key]??={n:0,samples:[]};q.n++;if(q.samples.length<3)q.samples.push([x,y,...original.slice(k,k+3),...d.slice(k,k+3)]);}
     }
    }
   }
   const gallery=make(1200,760),g=gallery.getContext('2d');g.fillStyle='#b9c6aa';g.fillRect(0,0,gallery.width,gallery.height);
   g.imageSmoothingEnabled=false;
   for(let pose=0;pose<4;pose++)for(let col=0;col<3;col++){
    const atk=pose===3,row=[3,0,2,1][pose],source=atk?attack:royal,body=ArmorLook.sheet('adharma',atk,[9,9,9,9],7,null,'spearman',12).sheet;
    const x=col*400,y=pose*190;
    g.drawImage(source,col*320+110,row*280+100,105,80,x,y+20,200,153);
    g.drawImage(body,col*320+110,row*280+100,105,80,x+200,y+20,200,153);
    g.fillStyle='#172323';g.font='13px sans-serif';g.fillText('source / equipped - pose '+pose+' dir '+col,x+10,y+15);
   }
   images.face=gallery.toDataURL();
   const preview=make(960,350),pg=preview.getContext('2d');pg.fillStyle='#d9ceb0';pg.fillRect(0,0,960,350);
   for(const [i,lvl]of [100,120,130].entries()){
    const ar=C.ARMOR_SETS.filter(s=>s.lvl<=lvl).length,wt=C.WEAPONS.filter(s=>s.lvl<=lvl).at(-1).tier;
    G.me={cls:'spearman',faction:'adharma',lvl,wt,wp:0,ar:[ar,ar,ar,ar],gg:[0,0,0,0,0],x:0,y:0,dir:1};
    pg.save();pg.translate(i*320,0);G.drawPreview(pg,320,310,0,{atk:false,dir:1,frame:3});pg.restore();pg.fillStyle='#222';pg.font='16px sans-serif';pg.fillText('Lv.'+lvl,i*320+135,336);
   }images.preview=preview.toDataURL();
   const get=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...args){hotReads++;return get.apply(this,args);};
   for(let i=0;i<60;i++)G.drawPreview(pg,320,310,0,{atk:false,dir:1,frame:3});
   CanvasRenderingContext2D.prototype.getImageData=get;
   return {images,facePixels,faceChanges,bodyPixels,bodyHoles,frames,hotReads,changedRegions};
  })()`);
  const out=path.resolve(__dirname,'../artifacts');
  for(const [name,png]of Object.entries(result.images))fs.writeFileSync(path.join(out,`spear-${name}-${before?'before':'after'}.png`),Buffer.from(png.split(',')[1],'base64'));
  delete result.images;assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({...result,changedRegions:Object.keys(result.changedRegions).length}));
  if(!before){assert(result.facePixels>10000);assert(result.bodyPixels>100000);assert.equal(result.faceChanges,0,'Authored facial features must remain unchanged');assert.equal(result.bodyHoles,0,'Royal armour must not tear the painted silhouette');assert.equal(result.hotReads,0);}
  fs.writeFileSync(path.join(out,`spear-face-${before?'before':'after'}.json`),JSON.stringify(result,null,2));
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
