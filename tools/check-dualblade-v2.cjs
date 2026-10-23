// Isolated renderer checks: new asset loading, slot/skin isolation, alpha containment and real-scale previews.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.argv[2]||'http://localhost:3901',port=process.argv[3]||'9334';
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');let ready=false;
  for(let i=0;i<250;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
  const result=await run(`(async()=>{
   G.socket.disconnect();G.ents.clear();if(!DualbladeModel.ready)throw Error('Old model fallback');
   const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
   const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const sources={};
   for(const prefix of ['','dark-'])for(const style of ['short','medium','long'])for(const pose of ['walk','attack']){
    const im=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src='assets/dualblade-v2/'+prefix+style+'-'+pose+'.png';});
    const c=mk(im.width,im.height);c.getContext('2d').drawImage(im,0,0);sources[prefix+style+'-'+pose]=pixels(c);
   }
   const gallery=mk(1400,840),g=gallery.getContext('2d'),directions=mk(1600,1600),dg=directions.getContext('2d'),world=mk(1000,480),wg=world.getContext('2d');
   for(const [c,ctx]of [[gallery,g],[directions,dg],[world,wg]]){ctx.fillStyle='#dfd3b3';ctx.fillRect(0,0,c.width,c.height);}
   const M=DualbladeModel.meta(),variants=[];let alphaLeaks=0,skinChanges=0,skinSamples=0,frames=0,cacheMisses=0,slotChecks=0,frontWingPixels=0,outsideBodyPixels=0;
   const dress=(faction,lvl)=>{
    let armor=0,wt=0;C.ARMOR_SETS.forEach((s,i)=>{if(lvl>=s.lvl)armor=i+1;});C.WEAPONS.forEach((s,i)=>{if(lvl>=s.lvl)wt=i;});
    G.me={cls:'dualblade',faction,lvl,wt,wp:0,ar:[armor,armor,armor,armor],gg:[0,0,0,0,0],x:0,y:0,dir:2};
   };
   for(const [fi,faction]of ['dharma','adharma'].entries())for(let stage=0;stage<=13;stage++){
    const lvl=stage?stage*10:1;dress(faction,lvl);const x=stage%7*200,y=(fi*2+Math.floor(stage/7))*210;
    g.save();g.translate(x,y);G.drawPreview(g,200,181,0,{atk:false,dir:2,frame:1});g.restore();
    g.fillStyle='#292b39';g.font='14px sans-serif';g.textAlign='center';g.fillText(faction+' Lv.'+lvl,x+100,y+200);
    for(const atk of [false,true]){
     const pose=atk?'attack':'walk',P=M[pose],key=ModelTiers.key(faction,atk,'dualblade');
     const c=ArmorLook.sheet(faction,atk,G.me.ar,stage,null).sheet,d=pixels(c),src=sources[(faction==='adharma'?'dark-':'')+DualbladeModel.styleOf(stage)+'-'+pose];
     if(c!==ArmorLook.sheet(faction,atk,G.me.ar,stage,null).sheet)cacheMisses++;
     let hash=2166136261;
     for(let k=0;k<d.length;k++){
      hash=Math.imul(hash^d[k],16777619);
      if(k%4!==3)continue;
      if(d[k]!==src[k])alphaLeaks++; // exact silhouette and alpha in every frame, including soft edges
      if(src[k]===0&&d[k]>0)outsideBodyPixels++;
     }
     variants.push({faction,stage,atk,hash});
     for(let f=0;f<24;f++){
      const col=f%8,row=Math.floor(f/8),A=M.frames[pose][f],B=A.bodyHeight;
      for(let yy=Math.ceil(A.headTop+B*.32);yy<A.neckY;yy++)for(let xx=Math.ceil(A.headX-B*.12);xx<A.headX+B*.14;xx++){
       const i=((row*P.frameHeight+yy)*c.width+col*P.frameWidth+xx)*4,r=src[i],gr=src[i+1],b=src[i+2];
       if(src[i+3]>200&&r>b*1.12&&r>gr*1.06&&r>155&&b>gr*.66){skinSamples++;if(d[i]!==r||d[i+1]!==gr||d[i+2]!==b)skinChanges++;}
      }
      const ctx=mk(260,260).getContext('2d'),F={atk,dir:C.DIR_COL.indexOf(col),frame:row,faction};
      Wings.draw(ctx,G.me,F,130,220,1,.46,'front',P,1);
      if(pixels(ctx.canvas).some((v,i)=>i%4===3&&v))frontWingPixels++;
      frames++;
     }
    }
   }
   for(const faction of ['dharma','adharma'])for(const atk of [false,true])for(const tier of [8,9])for(let slot=0;slot<4;slot++){
    const ar=[0,0,0,0],a=ArmorLook.sheet(faction,atk,ar,13,null).sheet,before=pixels(a);ar[slot]=tier;
    const after=pixels(ArmorLook.sheet(faction,atk,ar,13,null).sheet);let changed=0;
    for(let k=0;k<after.length;k+=4)if(after[k]!==before[k]||after[k+1]!==before[k+1]||after[k+2]!==before[k+2])changed++;
    if(changed<100)throw Error('Missing slot '+faction+'/'+atk+'/'+tier+'/'+slot);slotChecks++;
   }
   for(const [row,[faction,lvl,atk]]of ['dharma','adharma'].flatMap(f=>[120,130].flatMap(l=>[false,true].map(a=>[f,l,a]))).entries()){
    dress(faction,lvl);
    for(let dir=0;dir<8;dir++){
     const x=dir*200,y=row*200;dg.save();dg.translate(x,y);G.drawPreview(dg,200,170,0,{atk,dir,frame:1});dg.restore();
     dg.fillStyle='#292b39';dg.font='12px sans-serif';dg.textAlign='center';dg.fillText(faction+' '+lvl+' '+(atk?'attack':'idle')+' '+dir,x+100,y+190);
    }
   }
   for(const [fi,faction]of ['dharma','adharma'].entries())for(const [li,lvl]of [1,40,90,120,130].entries()){
    dress(faction,lvl);const x=li*200,y=fi*240;
    wg.fillStyle='#b9ab8a';wg.fillRect(x,y+178,200,1);wg.fillRect(x,y,1,240);
    wg.save();wg.translate(x+46,y+42);wg.scale(.46/.86,.46/.86);G.drawPreview(wg,200,235,0,{atk:false,dir:2,frame:1});wg.restore();
    wg.fillStyle='#292b39';wg.font='15px sans-serif';wg.textAlign='center';wg.fillText(faction+' Lv.'+lvl,x+100,y+212);
   }
   let glintChecks=0;
   for(const faction of ['dharma','adharma'])for(const lvl of [1,40,130])for(const atk of [false,true]){
    dress(faction,lvl);G.me.ar=[9,9,9,9];G.me.gg=[5,5,5,5,5];
    const P=M[atk?'attack':'walk'],c=ArmorLook.sheet(faction,atk,G.me.ar,DualbladeLook.stageOf(lvl),null).sheet,d=pixels(c);
    for(let col=0;col<8;col++)for(let frame=0;frame<3;frame++){
     const F={atk,dir:C.DIR_COL.indexOf(col),frame,faction};
     for(const p of EquipmentGlints.points(G.me,F,P).filter(p=>p.slot)){
      const x=Math.round(p.x+P.anchorX)+col*P.frameWidth,y=Math.round(p.y+P.anchorY)+frame*P.frameHeight;
      if(d[(y*c.width+x)*4+3]<200||p.color!=='#ff3346')throw Error('Mythic light outside painted equipment');glintChecks++;
     }
    }
   }
   if(glintChecks<300)throw Error('Missing equipment lights');
   // Hold hair, weapons and aura fixed: the equipment alone must visibly change.
   const comparison=mk(1600,720),cg=comparison.getContext('2d'),silhouettes=[];
   cg.fillStyle='#dfd3b3';cg.fillRect(0,0,1600,720);
   for(const [fi,faction]of ['dharma','adharma'].entries())for(let tier=0;tier<=9;tier++){
    const c=ArmorLook.sheet(faction,false,[tier,tier,tier,tier],13,null).sheet,d=pixels(c),P=M.walk;
    let alphaHash=2166136261,materialHash=2166136261;
    for(let yy=P.frameHeight;yy<P.frameHeight*2;yy++)for(let xx=0;xx<P.frameWidth;xx++){
     const i=(yy*c.width+xx)*4;alphaHash=Math.imul(alphaHash^d[i+3],16777619);
     for(let n=0;n<3;n++)materialHash=Math.imul(materialHash^d[i+n],16777619);
    }silhouettes.push({faction,tier,hash:alphaHash,materialHash});
    for(const [si,s]of [.86,.46].entries()){
     const x=tier*160+80,y=(fi*2+si)*180+143;
     cg.drawImage(c,0,P.frameHeight,P.frameWidth,P.frameHeight,x-P.anchorX*s,y-P.anchorY*s,P.frameWidth*s,P.frameHeight*s);
     cg.fillStyle='#292b39';cg.font='12px sans-serif';cg.textAlign='center';cg.fillText(faction+' '+(tier?'Lv.'+C.ARMOR_SETS[tier-1].lvl:'No gear'),x,y+24);
    }
   }
   // The animation path must reuse baked equipment, never classify or read pixels again.
   const native=CanvasRenderingContext2D.prototype.getImageData;let hotReads=0;
   ArmorLook.sheet('dharma',false,[9,9,9,9],13,null);
   CanvasRenderingContext2D.prototype.getImageData=function(...args){hotReads++;return native.apply(this,args);};
   try{for(let i=0;i<100;i++)ArmorLook.sheet('dharma',false,[9,9,9,9],13,null);}finally{CanvasRenderingContext2D.prototype.getImageData=native;}
   const motion={};
   for(const faction of ['dharma','adharma']){
    dress(faction,130);const c=mk(2560,1560),ctx=c.getContext('2d');
    for(let row=0;row<6;row++)for(let dir=0;dir<8;dir++){
     ctx.save();ctx.translate(dir*320,row*260);ctx.beginPath();ctx.rect(0,0,320,260);ctx.clip();
     G.drawPreview(ctx,320,250,0,{atk:row>=3,dir,frame:row%3});ctx.restore();
    }motion[faction]=c.toDataURL().split(',')[1];
   }
   return {variants,frames,alphaLeaks,skinChanges,skinSamples,cacheMisses,slotChecks,frontWingPixels,glintChecks,outsideBodyPixels,hotReads,silhouettes,motion,
    comparison:comparison.toDataURL().split(',')[1],
    gallery:gallery.toDataURL().split(',')[1],directions:directions.toDataURL().split(',')[1],world:world.toDataURL().split(',')[1]};
  })()`);
  const out=path.resolve(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
  for(const name of ['gallery','directions','world','comparison']){fs.writeFileSync(path.join(out,'dualblade-v2-'+name+'.png'),Buffer.from(result[name],'base64'));delete result[name];}
  for(const faction of ['dharma','adharma'])fs.writeFileSync(path.join(out,'dualblade-fit-motion-'+faction+'.png'),Buffer.from(result.motion[faction],'base64'));
  delete result.motion;
  result.browserErrors=errors;fs.writeFileSync(path.join(out,'dualblade-v2-check.json'),JSON.stringify(result,null,2));
  for(const name of ['alphaLeaks','skinChanges','cacheMisses','frontWingPixels','outsideBodyPixels','hotReads'])assert.equal(result[name],0,name);
  for(const faction of ['dharma','adharma']){
   const designs=result.silhouettes.filter(s=>s.faction===faction);
   assert.equal(new Set(designs.map(s=>s.hash)).size,1,'Equipment must stay in the painted character contour');
   assert.equal(new Set(designs.map(s=>s.materialHash)).size,10,'Each equipment tier must retain its own material design');
  }
  assert(result.skinSamples>500);assert.equal(result.slotChecks,32);assert.equal(result.frames,1344);
  for(const faction of ['dharma','adharma'])for(const atk of [false,true])assert.equal(new Set(result.variants.filter(v=>v.faction===faction&&v.atk===atk).map(v=>v.hash)).size,14);
  assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({...result,variants:result.variants.length}));
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
