// Read-only browser integration on a stateless preview (or supplied live origin); never creates an account.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const {spawn}=require('node:child_process');
const port=process.argv[2]||'9362',origin=process.argv[3]||'http://127.0.0.1:3920',out=path.join(__dirname,'../artifacts/boxer');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const preview=process.argv[3]?null:spawn(process.execPath,[path.join(__dirname,'preview-village.cjs'),'3920'],{windowsHide:true,stdio:'ignore'});
  let ws,page;const errors=[],failedAssets=[];
  try{
    for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}
    page=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
    ws=new WebSocket(page.webSocketDebuggerUrl);let seq=0;const pending=new Map();
    ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
      if(m.method==='Network.responseReceived'&&m.params.response.status>=400&&m.params.response.url.includes('/boxer'))failedAssets.push(m.params.response.url);
      if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(m.error):p.resolve(m.result);}});
    await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Page.bringToFront');
    await send('Page.navigate',{url:origin+'/?boxer-review=1'});
    let ready=false;for(let i=0;i<400;i++){ready=await run("!!window.G?.map && !!window.BoxerLook?.ready && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
    assert(ready,JSON.stringify({errors,failedAssets}));fs.mkdirSync(out,{recursive:true});
    await run(`(()=>{G.socket.disconnect();G.socket.emit=()=>{};document.getElementById('authStep').classList.add('hidden');document.getElementById('createStep').classList.remove('hidden');document.querySelector('.cls[data-c="boxer"]').click();})()`);
    assert(await run("document.getElementById('clsDesc').textContent.includes('นักสู้หมัดปราณ') && [...document.querySelectorAll('.fcard img')].every(i=>i.src.includes('/boxer/'))"));
    await pause(150);fs.writeFileSync(path.join(out,'create.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await run(`(()=>{
      document.getElementById('login').classList.add('hidden');
      const pos=C.spawnOf(G.mapDef,'dharma'),s=C.playerStats('boxer',130,{},{}),e={kind:'p',id:'boxer-preview',...pos,tx:pos.x,ty:pos.y,cls:'boxer',faction:'dharma',lvl:130,dir:2,name:'นักสู้หมัดปราณ',hp:s.maxHp,mhp:s.maxHp,wt:5,wp:0,ar:[1,1,1,1],gg:[0,0,0,0,0],flash:0};
      G.me=e;G.myId=e.id;G.cls='boxer';G.ents.clear();G.ents.set(e.id,e);CharacterMotion.reset(e);C.setViewClass('boxer');G.speed=s.speed;
      G.stats={lvl:130,hp:s.maxHp,mhp:s.maxHp,mp:s.maxMp,mmp:s.maxMp,atk:s.atk,def:s.def,aspd:0,crit:10,spd:s.speed};
      G.skl=C.cleanSkills('boxer',null,130);G.skl.free=C.skillPtsFree(G.skl,130);HUD.init(e);HUD.cds={};window.boxerFx=G.socket.listeners('fx')[0];BOOK.toggle(true);
    })()`);
    assert(await run("document.querySelectorAll('.sk-card').length===11 && [...document.querySelectorAll('select[data-bar]')].every(x=>!x.disabled)"));
    fs.writeFileSync(path.join(out,'skills.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert(await run("!!ItemArt.iconSrc('w0','dharma') && !!ItemArt.iconSrc('w0','adharma') && document.getElementById('pfImg').src.includes('/boxer/') && ModelTiers.key('dharma',false,'boxer')!==ModelTiers.key('dharma',false,'dualblade')"));await run('BOOK.toggle(false)');
    const pixels=await run(`(()=>{
      const c=document.createElement('canvas');c.width=340;c.height=300;const g=c.getContext('2d');let n=0;
      for(const faction of ['dharma','adharma'])for(const lvl of [1,50,100,130])for(let dir=0;dir<8;dir++)for(const atk of [false,true])for(let frame=0;frame<(atk?3:4);frame++){
        g.clearRect(0,0,340,300);BoxerLook.draw(g,{...G.me,faction,lvl},{dir,atk,frame},170,270,.85,1000);
        const data=g.getImageData(0,0,340,300).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)opaque++;if(opaque<4000)throw Error('Missing boxer pose');n++;
      }
      for(const faction of ['dharma','adharma'])for(const lvl of [1,50,100,130])for(let dir=0;dir<8;dir++)for(let combat=0;combat<4;combat++){
        g.clearRect(0,0,340,300);BoxerLook.draw(g,{...G.me,faction,lvl},{dir,combat},170,270,.85,1000);
        const data=g.getImageData(0,0,340,300).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)opaque++;if(opaque<3000)throw Error('Missing combat pose');n++;
      }return n;
    })()`);assert.equal(pixels,704);
    for(const sk of require('../shared/common').CLASSES.boxer.skills){
      await run(`(()=>{const skill='${sk.id}',s=C.ALL_SKILLS[skill].boxer,d={id:G.myId,skill,token:1,t:'boxer',mapId:G.mapId,a:0,x:G.me.x,y:G.me.y,f:G.me.faction,radius:s.range||100,dur:300,total:400};
        boxerFx({...d,phase:'windup'});boxerFx({...d,phase:'hit',beat:0,hits:s.hits||1});
        const c=document.createElement('canvas');c.width=c.height=600;const g=c.getContext('2d');
        for(const f of FX.list.filter(f=>f.boxerEffect))for(const t of [0,.2,.8])f.draw(g,t);
        boxerFx({...d,phase:'cancel'});if(G.me.atk)throw Error('cancel leaves boxing pose');
        for(const faction of ['dharma','adharma'])if(BoxerLook.icon(skill,faction).width!==112)throw Error('icon');
      })()`);
    }
    assert(await run(`(()=>{G.me.qiStacks=3;G.me.qiUntil=performance.now()+5000;BoxerLook.updateHUD();return document.getElementById('qiCombo').getAttribute('aria-label')==='จังหวะหมัด 3 จาก 3';})()`));
    assert(await run(`(()=>{G.me.qiUntil=0;BoxerLook.updateHUD();return document.getElementById('qiCombo').getAttribute('aria-label')==='จังหวะหมัด 0 จาก 3';})()`));
    const gallery=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=1020;const g=c.getContext('2d');g.fillStyle='#152329';g.fillRect(0,0,c.width,c.height);
      g.fillStyle='#e5c37c';g.font='24px Kanit,sans-serif';g.fillText('นักสู้หมัดปราณ · ธรรมะ / อธรรม · 8 ทิศ',24,32);
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        BoxerLook.draw(g,{...G.me,faction:row<2?'dharma':'adharma',lvl:1,atk:null},{dir:[2,1,0,7,6,5,4,3][col],atk:!!(row%2),frame:1},100+col*200,260+row*245,.9,1000);
      }return c.toDataURL();
    })()`);fs.writeFileSync(path.join(out,'directions.png'),Buffer.from(gallery.split(',')[1],'base64'));
    const combatGallery=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=1020;const g=c.getContext('2d');g.fillStyle='#152329';g.fillRect(0,0,1600,1020);
      g.fillStyle='#e5c37c';g.font='24px Kanit,sans-serif';g.fillText('ศอก · เข่า · หมัดเสย · ทุบพื้น',24,32);
      for(let row=0;row<4;row++)for(let col=0;col<8;col++)BoxerLook.draw(g,{...G.me,faction:col<4?'dharma':'adharma',lvl:1,atk:null},{dir:[2,1,0,6][col%4],combat:row},100+col*200,260+row*245,.9,1000);
      return c.toDataURL();
    })()`);fs.writeFileSync(path.join(out,'combat-poses.png'),Buffer.from(combatGallery.split(',')[1],'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await run("document.body.classList.add('touch');G.touch=true;HUD.buildBar();");await pause(100);
    fs.writeFileSync(path.join(out,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);
    const result={origin,poses:pixels,skills:11,factions:2,comboHUD:true,mobile:true,errors,failedAssets};
    fs.writeFileSync(path.join(out,process.argv[3]?'browser-live.json':'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{if(ws)ws.close();if(page)await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`).catch(()=>{});if(preview)preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
