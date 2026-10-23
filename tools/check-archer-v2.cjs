// Verify the real renderer in an isolated browser/server; never touch player saves.
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
  for(let i=0;i<300;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
  const result=await run(`(async()=>{
   G.socket.disconnect();G.ents.clear();if(!ArcherModel.ready)throw Error('Missing new archer model');
   const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
   const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const hash=d=>{let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);return h;};
   const M=ArcherModel.meta(),src={};
   for(const prefix of ['','dark-'])for(const s of ['short','medium','long'])for(const pose of ['walk','attack']){
    const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src='assets/archer-v2/'+prefix+s+'-'+pose+'.png';});
    const c=mk(im.width,im.height);c.getContext('2d').drawImage(im,0,0);src[prefix+s+'-'+pose]=pixels(c);
   }
   let alphaLeaks=0,skinChanges=0,skinSamples=0,cacheMisses=0,glintChecks=0,frames=0,occlusionChecks=0,faceOcclusions=0,lightEyeSamples=0,lightEyeChanges=0,coolHairSamples=0,purpleHairResidue=0;const variants=[];
   const levels=[1,15,30,50,60,80,100,120,130],gallery=mk(1800,500),g=gallery.getContext('2d');g.fillStyle='#dfd6b8';g.fillRect(0,0,gallery.width,gallery.height);
   const dress=(f,lvl)=>{let armor=0;C.ARMOR_SETS.forEach((s,i)=>{if(lvl>=s.lvl)armor=i+1;});const wt=C.WEAPONS.filter(w=>w.lvl<=lvl).at(-1)?.tier||0;G.me={cls:'archer',faction:f,lvl,wt,wp:0,ar:[armor,armor,armor,armor],gg:[0,0,0,0,0],x:0,y:0,dir:2};};
   for(const [fi,f]of ['dharma','adharma'].entries())for(const [li,lvl]of levels.entries()){
    dress(f,lvl);const tier=ModelTiers.tierOf(lvl),x=li*200,y=fi*250;
    g.save();g.beginPath();g.rect(x,y,200,250);g.clip();g.translate(x,y);G.drawPreview(g,200,225,0,{atk:false,dir:2,frame:3});g.restore();g.fillStyle='#293135';g.font='14px sans-serif';g.fillText(f+' Lv.'+lvl,x+25,y+244);
    for(const atk of [false,true]){
     const pose=atk?'attack':'walk',P=M[pose],base=src[(f==='adharma'?'dark-':'')+ArcherModel.styleOf(tier)+'-'+pose],body=ArcherModel.body(f,atk,tier,G.me.ar),d=pixels(body),key=ModelTiers.key(f,atk,'archer');
     for(let k=0;k<d.length;k+=4){if(d[k+3]!==base[k+3])alphaLeaks++;
      const [r,gr,b]=[base[k],base[k+1],base[k+2]];
      // Reserved lavender source strands must all become the faction hair colour,
      // including red > green highlights that the previous mask silently skipped.
      if(base[k+3]>200&&b>r+4&&b>gr+4){coolHairSamples++;if(d[k+2]>d[k]+4&&d[k+2]>d[k+1]+4)purpleHairResidue++;}
      if(base[k+3]>200&&r>155&&gr>100&&b>70&&r>gr*1.08&&b>gr*.65&&r>=b){skinSamples++;if(d[k]!==r||d[k+1]!==gr||d[k+2]!==b)skinChanges++;}
      if(f==='dharma'&&base[k+3]>200&&gr>r*1.3&&gr>b*1.2){
       const x=(k/4)%body.width,y=Math.floor(k/4/body.width),a=ArcherModel.anchor(atk,Math.floor(y/P.frameHeight),Math.floor(x/P.frameWidth),tier,f);
       if(y%P.frameHeight<a.neckY-6&&y%P.frameHeight>a.headTop+20){lightEyeSamples++;if(d[k]!==r||d[k+1]!==gr||d[k+2]!==b)lightEyeChanges++;}
      }
     }
     const sheet=ArmorLook.sheet(f,atk,G.me.ar,tier,null,'archer',G.me.wt).sheet;
     const equipped=pixels(sheet);
     if(sheet!==ArmorLook.sheet(f,atk,G.me.ar,tier,null,'archer',G.me.wt).sheet)cacheMisses++;
     variants.push({f,lvl,atk,hash:hash(pixels(sheet))});
     for(let row=0;row<P.framesPerDir;row++)for(let col=0;col<8;col++){
      const a=ArcherModel.anchor(atk,row,col,tier,f);if(a.bow.some(v=>!Number.isFinite(v)))throw Error('Invalid bow');
      const F={atk,frame:row,dir:C.DIR_COL.indexOf(col)},lines=WeaponLook.ownLines(G.me,F);
      if(lines.length!==(a.bowBehind?0:2))throw Error('Weapon enhancement ignores bow occlusion');
      const live=ArcherModel.frame(key,row,col,tier);if(live.bow!==a.bow||live.neckY!==a.neckY)throw Error('Live equipment uses another faction rig');
      for(let yy=Math.max(0,Math.ceil(a.headTop));yy<Math.floor(a.neckY-4);yy++)for(let xx=0;xx<P.frameWidth;xx++){
       const i=((row*P.frameHeight+yy)*body.width+col*P.frameWidth+xx)*4;
       if(d[i+3]===255&&d[i]>175&&d[i+1]>125&&d[i+2]>95&&d[i]>d[i+1]*1.03&&d[i+1]>d[i+2]*1.03&&(equipped[i]!==d[i]||equipped[i+1]!==d[i+1]||equipped[i+2]!==d[i+2]))faceOcclusions++;
      }
      occlusionChecks++;
      for(const slot of ArcherModel.glintAnchors(key,row,col,tier))for(const [xx,yy]of slot){const i=((row*P.frameHeight+yy)*body.width+col*P.frameWidth+xx)*4;if(d[i+3]<200)throw Error('Glint outside clothes');glintChecks++;}
      frames++;
     }
    }
   }
   const materials=[];for(const f of ['dharma','adharma'])for(let t=0;t<=9;t++)materials.push({f,t,hash:hash(pixels(ArcherModel.body(f,false,7,[t,t,t,t])))});
   let ornamentChecks=0,ornamentCentrePixels=0,hairChecks=0;
   const ornamentHashes={};
   for(const f of ['dharma','adharma'])for(const lvl of [60,80,100,120,130])for(let dir=0;dir<8;dir++)for(const atk of [false,true])for(const time of [0,.9])for(const size of [.6,1]){
    dress(f,lvl);G.me.moving=true;
    const c=mk(400,400),ctx=c.getContext('2d'),F={atk,frame:atk?1:3,dir},P=M[atk?'attack':'walk'],s=.46;
    ctx.drawImage=()=>{throw Error('Legacy wing image drawn for archer');};
    Wings.draw(ctx,G.me,F,200,240,time,s,'front',P,size);
    if(pixels(c).some(v=>v))throw Error('Archer decoration must never draw over the body');
    Wings.draw(ctx,G.me,F,200,240,time,s,'back',P,size);
    const d=pixels(c),a=ArcherModel.anchor(atk,F.frame,C.DIR_COL[dir],ModelTiers.tierOf(lvl),f);
    const rest=ArcherModel.anchor(false,3,C.DIR_COL[dir],ModelTiers.tierOf(lvl),f),B=rest.bodyHeight*s;
    const cx=200+(rest.headX-P.anchorX)*s,cy=240+(a.feetY-P.anchorY)*s-B*.53;let visible=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
     if(d[(y*c.width+x)*4+3]<20)continue;visible++;
     // Independent interior envelope: hair/face/torso have no back-effect paint.
     if(((x+.5-cx)/(B*.44))**2+((y+.5-cy)/(B*.51))**2<1)ornamentCentrePixels++;
    }
    if(visible<50)throw Error('Missing spirit-bow ornament');
    if(dir===2&&!atk&&time===0)ornamentHashes[f+'-'+lvl]=hash(d);
    ornamentChecks++;
   }
   for(const [tier,style]of [[0,'short'],[3,'medium'],[7,'long']]){
    const P=M.walk,body=ArcherModel.body('adharma',false,tier,[0,0,0,0]),d=pixels(body),base=src['dark-'+style+'-walk'];
    for(let col=0;col<8;col++){
     const a=ArcherModel.anchor(false,3,col,tier,'adharma');let black=0,red=0;
     for(let y=Math.ceil(a.headTop);y<P.anchorY;y++)for(let x=0;x<P.frameWidth;x++){
      const k=((3*P.frameHeight+y)*body.width+col*P.frameWidth+x)*4;
      if(base[k+3]<200||base[k+2]<=base[k]*1.025||base[k+1]<=base[k]*.98)continue;
      if(y<a.neckY-12&&Math.max(d[k],d[k+1],d[k+2])<65)black++;
      if(y>a.headTop+a.bodyHeight*.25&&d[k]>80&&d[k]>d[k+1]*2.5&&d[k]>d[k+2]*1.8)red++;
     }
     if(black<10||red<10)throw Error('Missing black/crimson hair: '+style+' '+col+' '+black+'/'+red);hairChecks++;
    }
   }
   const motion={};for(const f of ['dharma','adharma']){
    dress(f,130);const c=mk(2560,1820),ctx=c.getContext('2d');ctx.fillStyle='#d9ceb0';ctx.fillRect(0,0,c.width,c.height);
    for(let row=0;row<7;row++)for(let dir=0;dir<8;dir++){
     ctx.save();ctx.beginPath();ctx.rect(dir*320,row*260,320,260);ctx.clip();ctx.translate(dir*320,row*260);
     G.drawPreview(ctx,320,250,0,{atk:row>=4,dir,frame:row<4?row:row-4});ctx.restore();
    }motion[f]=c.toDataURL().split(',')[1];
   }
   dress('dharma',130);ArmorLook.sheet('dharma',false,G.me.ar,7,null,'archer',12);
   let hotReads=0;const original=CanvasRenderingContext2D.prototype.getImageData;
   CanvasRenderingContext2D.prototype.getImageData=function(...a){hotReads++;return original.apply(this,a);};
   for(let i=0;i<100;i++)ArmorLook.sheet('dharma',false,G.me.ar,7,null,'archer',12);
   CanvasRenderingContext2D.prototype.getImageData=original;
   return {alphaLeaks,skinChanges,skinSamples,lightEyeSamples,lightEyeChanges,coolHairSamples,purpleHairResidue,cacheMisses,glintChecks,frames,occlusionChecks,faceOcclusions,ornamentChecks,ornamentCentrePixels,ornamentHashes,hairChecks,hotReads,variants,materials,motion,gallery:gallery.toDataURL().split(',')[1]};
  })()`);
  const out=path.resolve(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'archer-v2-levels.png'),Buffer.from(result.gallery,'base64'));delete result.gallery;
  for(const f of ['dharma','adharma'])fs.writeFileSync(path.join(out,'archer-v2-motion-'+f+'.png'),Buffer.from(result.motion[f],'base64'));delete result.motion;
  result.browserErrors=errors;fs.writeFileSync(path.join(out,'archer-v2-check.json'),JSON.stringify(result,null,2));
  for(const k of ['alphaLeaks','skinChanges','lightEyeChanges','cacheMisses','hotReads','faceOcclusions','ornamentCentrePixels','purpleHairResidue'])assert.equal(result[k],0,k);
  assert(result.coolHairSamples>10000,'Exercise lavender source highlights across all factions and poses');
  assert.equal(new Set(Object.values(result.ornamentHashes)).size,10,'Distinct ornaments for both factions and all five levels');
  assert(result.lightEyeSamples>100,'Green eyes remain visible at all hair levels');
  for(const f of ['dharma','adharma'])assert.equal(new Set(result.materials.filter(v=>v.f===f).map(v=>v.hash)).size,10);
  assert(result.skinSamples>1000);assert(result.glintChecks>1000);assert.equal(errors.length,0,JSON.stringify(errors));
  console.log(JSON.stringify({...result,variants:result.variants.length,materials:result.materials.length}));
 }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
