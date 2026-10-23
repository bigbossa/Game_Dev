// Actual renderer, isolated disconnected actors; never joins or writes a player account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3903',port=process.argv[3]||9351,out=path.join(__dirname,'../artifacts/kingboar-v2');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json()),ws=new WS(page.webSocketDebuggerUrl),pending=new Map(),errors=[],failed=[];let seq=0;
 ws.on('message',d=>{const m=JSON.parse(d);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.startsWith(origin))failed.push(m.params.response.url);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin+'/?kingboar-review=2'});
  let ready=false;for(let i=0;i<900;i++){ready=await run("!!window.G?.map&&window.VillageArt?.ready&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,'Game boot');
  const report=await run(`(async()=>{
   G.socket.disconnect();G.socket.emit=()=>{};
   const meta=(await fetch('/assets/monsters/index.json?v=kingboar-v2').then(r=>r.json())).kingboar;
   if(!MonsterArt.hasSheet('kingboar')||!meta)throw Error('Boss sheet not registered');
   const img=new Image();img.src='/assets/monsters/'+meta.file+'?v='+meta.version;await img.decode();
   const c=document.createElement('canvas');c.width=2080;c.height=1040;const g=c.getContext('2d');g.fillStyle='#18252b';g.fillRect(0,0,c.width,c.height);
   MonsterArt.draw(g,'kingboar',0,0,1,0,{});await new Promise(r=>setTimeout(r,500));
   let fallback=0;const old=MonsterArt.boar;MonsterArt.boar=(...a)=>{fallback++;return old(...a);};
   const labels=['S','SE','E','NE','N','NW','W','SW'],dirs=[2,1,0,7,6,5,4,3],states=[{moving:true,t:0},{moving:false,t:0},{moving:true,t:.26},{moving:true,atk:1,t:0}],names=['Walk A','Idle','Walk B','Attack'];let verified=0;
   for(let row=0;row<4;row++)for(let col=0;col<8;col++){
    const x=col*260+130,y=row*250+215;g.fillStyle='#ecd9a7';g.font='18px sans-serif';g.textAlign='center';g.fillText(labels[col]+' / '+names[row],x,row*250+35);
    g.save();g.translate(x,y);g.scale(1.3,1.3);const draw=g.drawImage.bind(g);let sampled=null;
    g.drawImage=(...a)=>{sampled=a;return draw(...a);};MonsterArt.draw(g,'kingboar',0,0,col<4?1:-1,states[row].t,{...states[row],dir:dirs[col],seed:0});g.drawImage=draw;g.restore();
    if(!sampled||sampled[0].naturalWidth!==img.naturalWidth||sampled[1]!==col*meta.fw||sampled[2]!==row*meta.fh)throw Error('Wrong sprite direction/state '+row+'/'+col);verified++;
   }
   MonsterArt.boar=old;if(fallback)throw Error('Used old procedural boss');
   const effect=document.createElement('canvas');effect.width=effect.height=400;const eg=effect.getContext('2d'),draw=eg.drawImage.bind(eg);let alpha,filter;
   eg.drawImage=(...a)=>{alpha=eg.globalAlpha;filter=eg.filter;return draw(...a);};MonsterArt.draw(eg,'kingboar',200,300,1,0,{dir:0,alpha:.35,flash:.5});
   if(Math.abs(alpha-.35)>.01||!filter.includes('brightness'))throw Error('Death/hit feedback missing');if(eg.globalAlpha!==1||eg.filter!=='none')throw Error('Canvas state leaked');
   document.getElementById('login').classList.add('hidden');
   const lair=C.MAPS.village.lair,x=(lair.tx+.5)*48,y=(lair.ty+.5)*48;
   const p={kind:'p',id:'boss-review',x:x-210,y:y+210,tx:x-210,ty:y+210,dir:7,cls:'taoist',faction:'dharma',lvl:25,name:'นักพรต',hp:1500,mhp:1500,flash:0,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0]};
   G.me=p;G.myId=p.id;G.cls=p.cls;G.ents.clear();G.ents.set(p.id,p);G.speed=205;G.stats=null;G.order=null;CharacterMotion.reset(p);
   const d=C.MONSTERS.kingboar;G.ents.set('boss-preview',{kind:'m',id:'boss-preview',type:'kingboar',x,y,tx:x,ty:y,face:1,dir8:1,moving:false,hp:d.hp,mhp:d.hp,name:d.name,lvl:d.lvl,boss:true,seed:0,flash:0});
   return{verifiedFrames:verified,proceduralFallbacks:fallback,alphaAndFlash:true,version:meta.version,gallery:c.toDataURL().split(',')[1]};
  })()`);
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'kingboar-poses.png'),Buffer.from(report.gallery,'base64'));delete report.gallery;
  await pause(1300);fs.writeFileSync(path.join(out,'kingboar-in-game.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await run("G.ents.get('boss-preview').atkT=performance.now()-180");await pause(30);fs.writeFileSync(path.join(out,'kingboar-attack.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);Object.assign(report,{origin,verifiedAt:new Date().toISOString(),errors,failedAssets:failed});fs.writeFileSync(path.join(out,'check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
