// Real status panel with intercepted socket writes; never joins or saves an account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WS=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3918',port=process.argv[3]||'9362',out=path.join(__dirname,'../artifacts/stats-ui');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json()),ws=new WS(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
 ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 try{
  fs.mkdirSync(out,{recursive:true});await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:origin});
  let ready;for(let i=0;i<600;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,JSON.stringify(errors));
  await run(`(()=>{G.socket.disconnect();window.statMessages=[];G.socket.emit=(event,data)=>statMessages.push({event,data});G.myId=null;G.cls='warrior';G.stats={lvl:100,atk:1250,def:480,mhp:12000,mmp:1750,aspd:35,crit:18};document.getElementById('login').classList.add('hidden');STATS.set({a:{atk:65,hp:80,def:55,mp:24,aspd:28,crit:5},free:40,auto:'guide',lim:{crit:50}});STATS.toggle(true);})()`);
  await run("document.getElementById('hud').classList.remove('hidden')");
  await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await pause(200);
  const checks=await run(`(async()=>{
   const report=[],check=(v,m)=>{if(!v)throw Error(m);report.push(m);},q=s=>document.querySelector(s);
   check(document.querySelectorAll('.st-row').length===6,'all six stats');check(q('.st-free b').textContent==='40','available points prominent');
   for(const n of [1,5,1000]){q('[data-k="atk"][data-n="'+n+'"]').click();const m=statMessages.at(-1);check(m.event==='stat'&&m.data.cmd==='add'&&m.data.k==='atk'&&m.data.n===n,'add '+n+' retains protocol');}
   q('.st-guide-btn').click();check(statMessages.at(-1).data.cmd==='guide','class guide request');
   const auto=q('#stAuto');auto.value='hp';auto.dispatchEvent(new Event('change',{bubbles:true}));check(statMessages.at(-1).data.cmd==='auto'&&statMessages.at(-1).data.k==='hp','auto selection request');
   const confirmOwner=window.UI||window,oldConfirm=confirmOwner.confirm;let accepted=false;confirmOwner.confirm=()=>window.UI?Promise.resolve(accepted):accepted;const before=statMessages.length;
   q('.st-reset').click();await Promise.resolve();check(statMessages.length===before,'cancel reset sends nothing');accepted=true;q('.st-reset').click();await Promise.resolve();check(statMessages.at(-1).data.cmd==='reset','confirmed reset request');confirmOwner.confirm=oldConfirm;
   const body=q('#statPts'),button=q('[data-k="atk"][data-n="1"]');body.scrollTop=100;button.focus({preventScroll:true});const scroll=body.scrollTop;
   G.stats.atk=1444;await new Promise(r=>setTimeout(r,650));
   check(q('[data-real-stat="atk"]').textContent==='1,444','equipment/buff values refresh');check(button===q('[data-k="atk"][data-n="1"]'),'stat tick preserves DOM');check(document.activeElement===button,'stat tick preserves focus: '+document.activeElement.outerHTML.slice(0,160));check(body.scrollTop===scroll,'stat tick preserves scroll');
   STATS.set({a:{...STATS.a,atk:66},free:39,auto:'hp',lim:{crit:50}});check(q('.st-free b').textContent==='39','server point acknowledgement');check(document.activeElement.dataset.k==='atk','allocation acknowledgement restores focus');
   STATS.set({a:{aspd:80,crit:75},free:20});check(q('[data-k="aspd"]').disabled&&q('[data-k="crit"]').disabled,'capped stats disabled');
   STATS.set({a:{},free:0});check([...document.querySelectorAll('#statPts [data-k]')].every(b=>b.disabled)&&q('.st-guide-btn').disabled,'zero points disables allocation');
   G.stats.lvl=1;STATS.set({a:{},free:0});check(q('.st-reset').textContent.includes('ฟรี'),'level one free reset');
   for(const cls of C.CLASS_IDS){G.cls=cls;G.stats.lvl=130;STATS.set({a:{atk:50,hp:60},free:277});check(q('.st-guide-h').textContent.includes(C.CLASSES[cls].name),'guide '+cls);}
   G.cls='warrior';G.stats={lvl:100,atk:1250,def:480,mhp:12000,mmp:1750,aspd:35,crit:18};STATS.set({a:{atk:65,hp:80,def:55,mp:24,aspd:28,crit:5},free:40,auto:'guide',lim:{crit:50}});body.scrollTop=0;
   return report;
  })()`);
  fs.writeFileSync(path.join(out,'desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const width of [390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await run("document.body.classList.add('touch');STATS.toggle(false);STATS.toggle(true);document.getElementById('statPts').scrollTop=0");await pause(150);
   const fit=await run("(()=>{const p=document.getElementById('statPts');return {scroll:p.scrollWidth,client:p.clientWidth,document:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...document.querySelectorAll('.st-actions button')].map(b=>b.getBoundingClientRect().height)};})()");
   assert(fit.scroll<=fit.client+1&&fit.document<=fit.viewport&&fit.buttons.every(h=>h>=43.9),'mobile fits '+width+': '+JSON.stringify(fit));
   fs.writeFileSync(path.join(out,'mobile-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await run("document.getElementById('statPts').scrollTop=100000");assert(await run("(()=>{const r=document.querySelector('.st-reset').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0;})()"),'reset reachable '+width);
  }
  await run("document.querySelector('#statPanel .close').click()");assert(await run("!STATS.open&&document.getElementById('statPanel').classList.contains('hidden')"),'close panel');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,mobile:[390,320],errors},null,2));console.log(JSON.stringify({checks,mobile:[390,320],errors}));
 }finally{await send('Page.close').catch(()=>{});ws.terminate();}
})().catch(e=>{console.error(e);process.exitCode=1;});
