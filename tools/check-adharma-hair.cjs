// Faction regression and real-renderer hair review. Run after the class renderer checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),artifact=name=>path.join(root,'artifacts',name);
const oldHashes=JSON.parse(fs.readFileSync(artifact('dharma-hair-before-hashes.json'),'utf8').replace(/^\uFEFF/,''));
for(const p of oldHashes)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p.Path)).digest('hex').toUpperCase(),p.Hash,'Dharma asset changed: '+p.Path);
let matching=0;
for(const cls of ['dualblade','archer']){
 const old=JSON.parse(fs.readFileSync(artifact('adharma-hair-'+cls+'-before.json'))),now=JSON.parse(fs.readFileSync(artifact(cls+'-v2-check.json')));
 const light=v=>(v.faction||v.f)==='dharma';
 assert.deepEqual(now.variants.filter(light),old.variants.filter(light),'Dharma render changed: '+cls);matching+=now.variants.filter(light).length;
}
(async()=>{
 const port=process.argv[3]||9334,origin=process.argv[2]||'http://localhost:3901';
 const page=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(origin),{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');let ready=false;
  for(let i=0;i<300;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
  const result=await run(`(()=>{
   G.socket.disconnect();G.ents.clear();const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
   const classes=['dualblade','archer','spearman'],levels=[1,60,130],gallery=mk(1800,1020),g=gallery.getContext('2d'),motion={};
   g.fillStyle='#ded4ba';g.fillRect(0,0,gallery.width,gallery.height);
   const dress=(cls,faction,lvl)=>{let t=0;C.ARMOR_SETS.forEach((s,i)=>{if(lvl>=s.lvl)t=i+1;});G.me={cls,faction,lvl,wt:C.WEAPONS.filter(w=>w.lvl<=lvl).at(-1)?.tier||0,ar:[t,t,t,t],gg:[0,0,0,0,0],x:0,y:0,dir:2};};
   for(const [row,cls]of classes.entries())for(const [li,lvl]of levels.entries())for(const [fi,faction]of ['dharma','adharma'].entries()){
    dress(cls,faction,lvl);const x=(li*2+fi)*300,y=row*340;g.save();g.beginPath();g.rect(x,y,300,340);g.clip();g.translate(x,y);
    G.drawPreview(g,300,300,0,{atk:false,dir:2,frame:cls==='dualblade'?1:3});g.restore();
    g.fillStyle='#29313b';g.font='16px sans-serif';g.textAlign='center';g.fillText(cls+' / '+faction+' / Lv.'+lvl,x+150,y+325);
   }
   let frames=0;const feetChecks=[];
   for(const cls of classes)for(const faction of ['dharma','adharma']){
    dress(cls,faction,130);const c=mk(2560,1820),cg=c.getContext('2d');cg.fillStyle='#ded4ba';cg.fillRect(0,0,c.width,c.height);
    for(let row=0;row<7;row++)for(let dir=0;dir<8;dir++){
     cg.save();cg.beginPath();cg.rect(dir*320,row*260,320,260);cg.clip();cg.translate(dir*320,row*260);
     const F={atk:row>=4,dir,frame:row>=4?row-4:row===3&&cls==='dualblade'?1:row};
     G.drawPreview(cg,320,250,0,F);cg.restore();frames++;
    }motion[cls+'-'+faction]=c.toDataURL().split(',')[1];
   }
   // A different hair outline must remain at every authored progression length.
   for(const cls of ['dualblade','archer'])for(const tier of cls==='dualblade'?[0,4,13]:[0,3,7]){
    const P=cls==='dualblade'?DualbladeModel.meta().walk:ArcherModel.meta().walk;
    const sheets=['dharma','adharma'].map(f=>cls==='dualblade'?DualbladeModel.compose(f,'walk',tier,[0,0,0,0]):ArcherModel.body(f,false,tier,[0,0,0,0]));
    const d=sheets.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);let differences=0;
    for(let k=3;k<d[0].length;k+=4)if(d[0][k]!==d[1][k])differences++;
    if(differences<500)throw Error('Hairstyle silhouette unchanged: '+cls+'/'+tier);
    feetChecks.push({cls,tier,alphaDifferences:differences});
   }
   return {gallery:gallery.toDataURL().split(',')[1],motion,frames,feetChecks};
  })()`);
  fs.writeFileSync(artifact('adharma-hair-comparison.png'),Buffer.from(result.gallery,'base64'));delete result.gallery;
  for(const [name,png]of Object.entries(result.motion))fs.writeFileSync(artifact('adharma-hair-motion-'+name+'.png'),Buffer.from(png,'base64'));delete result.motion;
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report={...result,unchangedDharmaAssets:oldHashes.length,unchangedDharmaVariants:matching,browserErrors:errors};
  fs.writeFileSync(artifact('adharma-hair-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
