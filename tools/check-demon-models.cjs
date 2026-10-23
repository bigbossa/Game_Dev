// Inspect the shipped dark bodies and the actual equipment renderer, without logging in.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts');
const origin=process.argv[2]||'http://localhost:3901',port=process.argv[3]||'9334';
const M=JSON.parse(fs.readFileSync(path.join(root,'public/assets/adharma-hair/spearman.json')));
let frames=0;const signatures=[];
for(const style of ['short','medium','long','royal']){
 const suffix=style==='long'?'':'-'+style;
 for(const pose of ['walk','attack']){
  const png=PNG.sync.read(fs.readFileSync(path.join(root,`public/assets/adharma-hair/spearman-adharma${suffix}${pose==='attack'?'-attack':''}.png`)));
  const P=M.styles[style][pose].adharma;
  assert.equal(png.width,P.frameWidth*8);assert.equal(png.height,P.frameHeight*P.framesPerDir);
  if(pose==='walk')signatures.push(crypto.createHash('sha256').update(png.data.filter((v,i)=>i%4===3)).digest('hex'));
  P.poseFrames.forEach((a,i)=>{
   assert.equal(a.feetY,252);assert(a.bodyHeight>(pose==='attack'?155:180)&&a.bodyHeight<205);
   for(const pt of [a.grip,a.weaponTip])assert(pt.every(Number.isFinite));
   const ox=i%8*P.frameWidth,oy=Math.floor(i/8)*P.frameHeight;
   for(let y=0;y<P.frameHeight;y++)for(let x=0;x<P.frameWidth;x++){
    if(x>1&&x<P.frameWidth-2&&y>1&&y<P.frameHeight-2)continue;
    assert(png.data[((oy+y)*png.width+ox+x)*4+3]<100,`Clipped ${style} ${pose} ${i}`);
   }frames++;
  });
 }
}
assert.equal(new Set(signatures).size,4,'Four different hair silhouettes');
// The user subsequently requested a new dharma archer too; only spear assets remain invariant.
const baseline=JSON.parse(fs.readFileSync(path.join(out,'demon-models-dharma-before.json'),'utf8').replace(/^\uFEFF/,'')).filter(b=>!b.Path.includes('archer-v2'));
for(const b of baseline)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(b.Path)).digest('hex').toUpperCase(),b.Hash,'Dharma changed: '+b.Path);
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
  await run('G.socket.disconnect();G.ents.clear()');
  let rendered=0;
  for(const cls of ['archer','spearman'])for(const lvl of cls==='archer'?[1,50,130]:[1,30,60,130]){
   const result=await run(`(()=>{
    const cls=${JSON.stringify(cls)},lvl=${lvl},tier=ModelTiers.tierOf(lvl);
    let armor=0;C.ARMOR_SETS.forEach((s,i)=>{if(lvl>=s.lvl)armor=i+1;});
    const wt=C.WEAPONS.filter(w=>w.lvl<=lvl).at(-1)?.tier||0;
    G.cls=cls;C.setViewClass(cls);G.me={cls,faction:'adharma',lvl,wt,wp:0,ar:[armor,armor,armor,armor],gg:[0,0,0,0,0],x:0,y:0,dir:2};
    if(cls==='spearman'){
     const expected=lvl<30?'short':lvl<60?'medium':lvl<100?'long':'royal';
     if(SpearmanLook.hairStage(tier)!==expected)throw Error('Incorrect level hairstyle');
     const rig=SpearmanLook.modelMeta('adharma',false,tier);
     if(!rig?.poseFrames?.length)throw Error('Missing variant rig');
     const body=ArmorLook.sheet('adharma',false,G.me.ar,tier,null,cls,wt).sheet;
     if(body!==ArmorLook.sheet('adharma',false,G.me.ar,tier,null,cls,wt).sheet)throw Error('Missing variant cache');
    }
    const c=Object.assign(document.createElement('canvas'),{width:2880,height:2310}),g=c.getContext('2d');
    g.fillStyle='#d9ceb0';g.fillRect(0,0,c.width,c.height);
    for(let row=0;row<7;row++)for(let dir=0;dir<8;dir++){
     g.save();g.beginPath();g.rect(dir*360,row*330,360,330);g.clip();g.translate(dir*360,row*330);
     G.drawPreview(g,360,310,0,{atk:row>=4,dir,frame:row<4?row:row-4});g.restore();
    }
    return {png:c.toDataURL().split(',')[1],stage:cls==='spearman'?SpearmanLook.hairStage(tier):ArcherModel.styleOf(tier)};
   })()`);
   fs.writeFileSync(path.join(out,`demon-${cls}-${lvl}.png`),Buffer.from(result.png,'base64'));rendered+=56;
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result={spearPackedFrames:frames,hairSilhouettes:4,renderedFrames:rendered,dharmaAssetsUnchanged:baseline.length,browserErrors:errors};
  fs.writeFileSync(path.join(out,'demon-models-check.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
