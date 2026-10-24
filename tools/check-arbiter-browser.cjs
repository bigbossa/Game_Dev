// Isolated local preview and headless browser. No accounts, live database or real player changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WebSocket=require('ws');
const {spawn}=require('node:child_process');
const port=process.argv[2]||'9346',origin='http://127.0.0.1:3916',out=path.join(__dirname,'../artifacts/arbiter');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const preview=spawn(process.execPath,[path.join(__dirname,'preview-village.cjs'),'3916'],{windowsHide:true,stdio:'pipe'});
  let ws;
  try{
    for(let n=0;n<100;n++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}
    const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
    const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)));assert(page,'test browser tab');
    ws=new WebSocket(page.webSocketDebuggerUrl);const pending=new Map(),errors=[];let seq=0;
    ws.on('message',raw=>{const m=JSON.parse(raw);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
    await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+'/?arbiter-review=1'});
    let ready=false;for(let n=0;n<300;n++){ready=await run("!!window.G?.map && window.ArbiterLook?.ready && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
    assert(ready,JSON.stringify(errors));fs.mkdirSync(out,{recursive:true});
    await run(`(()=>{G.socket.disconnect();G.socket.emit=()=>{};document.getElementById('authStep').classList.add('hidden');document.getElementById('createStep').classList.remove('hidden');document.querySelector('.cls[data-c="arbiter"]').click();})()`);
    assert(await run("document.getElementById('clsDesc').textContent.includes('เทวทัณฑ์')"));
    fs.writeFileSync(path.join(out,'create.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await run(`(()=>{
      document.getElementById('login').classList.add('hidden');
      let pos;outer:for(let y=20;y<G.map.h-20;y++)for(let x=20;x<G.map.w-20;x++)if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)){pos={x:x*C.TILE,y:y*C.TILE};break outer;}
      const s=C.playerStats('arbiter',130,{},{}),e={kind:'p',id:'arbiter-preview',...pos,tx:pos.x,ty:pos.y,cls:'arbiter',faction:'dharma',lvl:130,dir:2,name:'เทวทัณฑ์',hp:s.maxHp,mhp:s.maxHp,wt:5,wp:0,ar:[1,1,1,1],gg:[0,0,0,0,0],flash:0};
      G.me=e;G.myId=e.id;G.cls='arbiter';G.ents.clear();G.ents.set(e.id,e);CharacterMotion.reset(e);C.setViewClass('arbiter');
      G.speed=s.speed;G.stats={lvl:130,hp:s.maxHp,mhp:s.maxHp,mp:s.maxMp,mmp:s.maxMp,atk:s.atk,def:s.def,aspd:0,crit:9,spd:s.speed};
      G.skl=C.cleanSkills('arbiter',null,130);G.skl.free=C.skillPtsFree(G.skl,130);HUD.init(e);HUD.cds={};
      window.arbiterFx=G.socket.listeners('fx')[0];BOOK.toggle(true);
    })()`);
    assert(await run("[...document.querySelectorAll('select[data-bar]')].length===9 && [...document.querySelectorAll('select[data-bar]')].every(x=>!x.disabled)"));
    assert(await run("document.querySelector('.sk-card[data-id=\"oathResonance\"] .sk-pips').children.length===12"));
    assert(await run("document.querySelectorAll('.sk-card .sk-evos').length===8 && document.querySelectorAll('.sk-card[data-id=\"oathBasic\"] .sk-evos').length===0"));
    assert(await run("C.CLASSES.arbiter.skills.slice(1).every(s=>G.skl.bar.includes(s.id))"));
    fs.writeFileSync(path.join(out,'skills-v2.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert(await run("!!ItemArt.iconSrc('w0','dharma') && !!ItemArt.iconSrc('w0','adharma')"));
    await run('BOOK.toggle(false)');
    for(const f of ['dharma','adharma'])for(const lvl of [1,29,30,50,69,70,109,110,130]){
      const count=await run(`(()=>{
        const c=document.createElement('canvas');c.width=340;c.height=300;const g=c.getContext('2d');let n=0;
        for(let dir=0;dir<8;dir++)for(const atk of [false,true])for(let frame=0;frame<(atk?3:4);frame++){
          ArbiterLook.draw(g,{...G.me,faction:'${f}',lvl:${lvl},arbiterForm:${lvl>=110}},{dir,atk,frame},170,270,.85,1000);n++;
        }return n;
      })()`);assert.equal(count,56);
    }
    for(const sk of Object.values(require('../shared/common').ALL_SKILLS).filter(s=>s.cls==='arbiter')){
      await run(`(()=>{const id='${sk.id}',spec=C.ALL_SKILLS[id].arbiter;HUD.icon(id,'dharma');HUD.icon(id,'adharma');if(spec){
        const d={id:G.me.id,t:'arbiter',skill:id,token:1,mapId:G.mapId,a:0,x:G.me.x,y:G.me.y,f:G.me.faction,dur:500,radius:spec.radius||spec.range||100,width:24};
        arbiterFx({...d,phase:'windup'});arbiterFx({...d,phase:'release'});
      }})()`);await pause(25);
    }
    const gallery=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1280;c.height=840;const g=c.getContext('2d');g.fillStyle='#121c2c';g.fillRect(0,0,c.width,c.height);
      g.font='bold 22px sans-serif';g.fillStyle='#e5c887';g.fillText('เทวทัณฑ์ · โมเดลจิบิอ้างอิงอาชีพเดิม',28,36);
      for(let row=0;row<2;row++)for(let col=0;col<5;col++){
        const lvl=[1,30,70,110,130][col],faction=row?'adharma':'dharma',x=128+col*250,y=340+row*350;
        g.fillStyle='#9caec4';g.font='16px sans-serif';g.fillText((row?'อธรรม':'ธรรมะ')+' · Lv.'+lvl+(col===4?' จุติ':''),x-75,y+30);
        ArbiterLook.draw(g,{...G.me,faction,lvl,arbiterForm:col===4,astralBlades:lvl>=50},{dir:2,frame:1},x,y,1.12,1000);
      }return c.toDataURL();
    })()`);
    fs.writeFileSync(path.join(out,'progression.png'),Buffer.from(gallery.split(',')[1],'base64'));
    const comparison=await run(`(async()=>{
      const c=document.createElement('canvas');c.width=1000;c.height=440;const g=c.getContext('2d');g.fillStyle='#121c2c';g.fillRect(0,0,1000,440);
      g.fillStyle='#e5c887';g.font='22px sans-serif';g.fillText('อ้างอิงสัดส่วนและลายเส้น · ทวน / นักรบแนวหน้า / เทวทัณฑ์',28,35);
      const urls=['assets/spearman-dharma-portrait.png','assets/warrior-v4/dharma-portrait.png','assets/arbiter/dharma-portrait.png'];
      for(let i=0;i<urls.length;i++){const im=new Image();im.src=urls[i];await im.decode();const k=240/im.height;g.drawImage(im,170+i*325-im.width*k/2,355-im.height*k,im.width*k,im.height*k);}
      return c.toDataURL();
    })()`);
    fs.writeFileSync(path.join(out,'style-comparison.png'),Buffer.from(comparison.split(',')[1],'base64'));
    const directions=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=1000;const g=c.getContext('2d');g.fillStyle='#121c2c';g.fillRect(0,0,c.width,c.height);
      g.font='20px sans-serif';g.fillStyle='#e5c887';g.fillText('เทวทัณฑ์ · ท่ายืน / โจมตี · 8 ทิศ · สองฝ่าย',25,30);
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        const faction=row<2?'dharma':'adharma',atk=!!(row%2),dir=[2,1,0,7,6,5,4,3][col];
        ArbiterLook.draw(g,{...G.me,faction,lvl:1,wt:0},{dir,atk,frame:1},110+col*200,245+row*240,.77,1000);
      }return c.toDataURL();
    })()`);
    fs.writeFileSync(path.join(out,'directions.png'),Buffer.from(directions.split(',')[1],'base64'));
    await pause(150);assert.equal(errors.length,0,JSON.stringify(errors));
    console.log('PASS: browser boot, class selection, 1,008 directional/level/pose renders, 18 skill icons, live FX and eight active skill evolution cards. '+out);
  }finally{if(ws)ws.close();preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
