// Stateless browser checks: synthetic actors, no login, no account writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3922',port=process.argv[3]||'9362',out=path.join(__dirname,'../artifacts/skill-polish');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
 const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let serial=0;
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:origin});await send('Page.bringToFront');
  let ready=false;for(let i=0;i<700;i++){ready=await run("!!window.SkillPolish && !!window.G?.map && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,'game boot');
  await run('G.socket.disconnect(); G.socket.emit=()=>{}; G.myId=null; G.stats=null; G.ents.clear(); FX.list=[]; FX.parts=[]; FX.view=null;');
  const result=await run(`(${verify})()`);fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'gallery.png'),Buffer.from(result.gallery.split(',')[1],'base64'));delete result.gallery;
  for(const mobile of [false,true]){
   await send('Emulation.setDeviceMetricsOverride',{width:mobile?390:1280,height:mobile?844:900,deviceScaleFactor:1,mobile});
   await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
   await send('Page.reload',{ignoreCache:true});
   let ready=false;for(let i=0;i<700;i++){ready=await run("!!window.NOTES && !document.getElementById('patchLink').classList.contains('hidden') && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,'patch notes ready');
   const notes=await run(`(()=>{G.socket.disconnect();document.getElementById('patchLink').click();const panel=document.getElementById('patchPanel'),first=document.querySelector('.pn-note'),r=panel.getBoundingClientRect();return {open:!panel.classList.contains('hidden'),latest:first.textContent.includes('เอฟเฟกต์สกิล 7 อาชีพ'),modes:first.textContent.includes('เน้นลื่น'),fits:r.left>=-1&&r.right<=innerWidth+1,seen:localStorage.getItem('patchSeen'),menu:!G.touch||!!document.querySelector('#menuGrid #newsBtn')};})()`);
   assert(notes.open&&notes.latest&&notes.modes&&notes.fits&&notes.menu,JSON.stringify(notes));result[mobile?'mobileNotes':'desktopNotes']=notes;
   await pause(300); // wait for the mobile sheet's entrance animation before capturing it
   fs.writeFileSync(path.join(out,mobile?'patch-mobile.png':'patch-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.equal(errors.length,0,JSON.stringify(errors));result.origin=origin;result.errors=errors;
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await send('Page.close').catch(()=>{});ws.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
function verify(){
 const check=(ok,msg)=>{if(!ok)throw Error(msg);},checks=[],cv=document.createElement('canvas');cv.width=560;cv.height=250;
 const g=cv.getContext('2d',{willReadFrequently:true}),classes=Object.values(C.CLASSES),hashes=new Set();let casts=0,renders=0;
 const actor=(cls,faction)=>{const e={kind:'p',id:'polish-'+cls,cls,faction,x:150,y:210,tx:150,ty:210,dir:0,lvl:130,hp:1000,mhp:1000,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0],flash:0};G.ents.set(e.id,e);return e;};
 const paint=(p)=>{for(const n of FX.list.filter(n=>n.polished)){n.draw(g,p,n);renders++;}};
 const hash=()=>{let h=2166136261;for(const b of g.getImageData(0,0,560,250).data)h=Math.imul(h^b,16777619);return h;};
 const before=SET.get('graphics');
 for(const mode of ['high','auto','smooth']){
  SET.set('graphics',mode);
  for(const cls of classes)for(const faction of ['dharma','adharma']){
   const e=actor(cls.id,faction);
   for(const sk of cls.skills){
    FX.list=[];SkillPolish.play({t:sk.id,id:e.id,sl:12,r:sk.evo?.length||0,a:.2});casts++;
    check(FX.list.some(n=>n.polished&&n.phase==='cast'),'Missing cast '+sk.id);
    check(!FX.list.some(n=>n.phase==='impact'),'Cast claims impact '+sk.id);
    for(const p of [.05,.28,.7,1]){g.clearRect(0,0,560,250);const T=g.getTransform();g.globalAlpha=.7;paint(p);check(g.globalAlpha===.7&&g.getTransform().a===T.a&&g.getTransform().e===T.e&&g.globalCompositeOperation==='source-over','Canvas state leak');g.globalAlpha=1;}
    SkillPolish.play({t:'spearCancel',id:e.id,skill:sk.id});check(!FX.list.some(n=>n.polished),'Cancellation left cast');
   }
   FX.hit(320,145,null,true,e.id);check(FX.list.some(n=>n.polished&&n.phase==='impact'),'Confirmed hit missing '+cls.id);
   g.clearRect(0,0,560,250);paint(.22);if(mode==='high')hashes.add(hash());
   const node=FX.list.find(n=>n.polished);g.clearRect(0,0,560,250);e.dead=true;paint(.2);check(!g.getImageData(0,0,560,250).data.some(Boolean),'Dead caster retains effect');e.dead=false;
   const map=G.mapId;G.mapId='other';paint(.2);check(!g.getImageData(0,0,560,250).data.some(Boolean),'Map leaked effect');G.mapId=map;
   FX.view={x:10000,y:10000,w:50,h:50};paint(.2);check(!g.getImageData(0,0,560,250).data.some(Boolean),'Offscreen drawing');FX.view=null;
   check(FX.list.includes(node),'Drawing mutated effects');FX.list=[];
  }
  const e=actor('boxer','dharma'),warning={warning:true,t0:performance.now(),dur:10000,layer:'ground',draw(){}};FX.list=[warning];
  for(let i=0;i<250;i++)FX.hit(320,145,null,true,e.id);
  const count=FX.list.filter(n=>n.polished).length;check(count<=({smooth:12,auto:24,high:48}[mode]),'Unbounded crowd');check(FX.list.includes(warning),'Decoration evicted warning');
  let imageCalls=0;const drawImage=g.drawImage;g.drawImage=function(...args){imageCalls++;return drawImage.apply(this,args);};
  const n=FX.list.length;paint(.2);g.drawImage=drawImage;
  check(mode!=='smooth'||imageCalls===count,'Smooth mode must use one image per ornament');
  check(FX.list.length===n,'Draw emits effects');SkillPolish.clear();check(FX.list.length===1&&FX.list[0]===warning,'Cleanup removed warning');
  checks.push(mode+': all casts, confirmed hits, death/map/offscreen, state isolation, bounded crowd and warning preservation');
 }
 check(hashes.size===14,'Each class and faction needs distinct hit artwork');
 // Exercise the actual socket dispatcher and control cancellation, not only the ornament API.
 for(const cls of classes){
  FX.list=[];const e=actor(cls.id,'dharma'),sk=cls.skills[0];G.me=e;
  const d={t:sk.boxer?'boxer':sk.arbiter?'arbiter':sk.id,id:e.id,skill:sk.id,phase:'windup',mapId:G.mapId,x:e.x,y:e.y,a:0,f:e.faction,sl:1,r:0,dur:300,total:300,radius:80,n:1,g:200,token:1};
  G.socket.listeners('fx')[0](d);check(FX.list.some(n=>n.polished),'Dispatcher integration '+cls.id);
  G.socket.listeners('control')[0]({stun:300});check(!FX.list.some(n=>n.polished),'Control cleanup '+cls.id);G.socket.listeners('control')[0]({});
 }
 checks.push('all seven actual dispatch paths and stun cleanup');
 const boxer=actor('boxer','dharma'),skill=C.CLASSES.boxer.skills[0].id;
 FX.list=[];SkillPolish.play({t:'boxer',phase:'windup',skill,id:boxer.id,token:2});
 SkillPolish.play({t:'boxer',phase:'cancel',skill,id:boxer.id,token:1});check(FX.list.some(n=>n.polished&&n.token===2),'Stale cancel erased next cast');
 SkillPolish.play({t:'boxer',phase:'cancel',skill,id:boxer.id,token:2});check(!FX.list.some(n=>n.polished),'Matching cancel retained cast');
 checks.push('cast tokens isolate late cancellation');
 SET.set('graphics','high');FX.list=[];
 const sheet=document.createElement('canvas');sheet.width=1120;sheet.height=classes.length*250;const sg=sheet.getContext('2d');
 classes.forEach((cls,row)=>['dharma','adharma'].forEach((f,col)=>{
  sg.save();sg.translate(col*560,row*250);sg.fillStyle=col?'#211a2a':'#15252d';sg.fillRect(0,0,560,250);
  sg.fillStyle='#f7e9c6';sg.font='600 18px Kanit, sans-serif';sg.fillText(cls.name+' · '+(col?'อธรรม':'ธรรมะ'),18,28);
  const e=actor(cls.id,f);G.me=e;FX.list=[];FX.view=null;
  drawGhost(e,150,228,.95,null,sg,'source-over');
  SkillPolish.play({t:cls.skills[5].id,id:e.id,sl:12,r:1,a:0});
  FX.hit(330,140,null,true,e.id);for(const n of FX.list.filter(n=>n.polished))n.draw(sg,.22,n);
  sg.fillStyle='#b8c6ca';sg.font='12px Kanit, sans-serif';sg.fillText('แสงขณะออกท่า',90,246);sg.fillText('จังหวะโจมตีโดน',290,222);sg.restore();
 }));
 FX.list=[];FX.parts=[];G.me=null;SET.set('graphics',before);
 return {skills:classes.reduce((sum,c)=>sum+c.skills.length,0),casts,renders,distinctClassFactionHits:hashes.size,checks,gallery:sheet.toDataURL()};
}
