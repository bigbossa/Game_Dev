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
    const icons=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1360;c.height=390;const g=c.getContext('2d');g.fillStyle='#0b1422';g.fillRect(0,0,c.width,c.height);
      g.font='bold 24px sans-serif';g.fillStyle='#efca78';g.fillText('เทวทัณฑ์ · ไอคอนสกิลใหม่ / ธรรมะ & อธรรม',24,34);
      const seen=new Set();
      for(const [row,faction] of ['dharma','adharma'].entries())C.CLASSES.arbiter.skills.forEach((sk,i)=>{
        const im=ArbiterLook.icon(sk.id,faction),x=24+i*148,y=58+row*162;seen.add(im.toDataURL());g.drawImage(im,x,y);
        if(im===ArbiterLook.icon(sk.id,faction))throw Error('Shared DOM canvas');
        g.font='12px sans-serif';g.fillStyle='#d7e4f1';g.fillText(sk.key+' · '+sk.name,x,y+133);
      });if(seen.size!==18)throw Error('Icons must be visually distinct');return c.toDataURL();
    })()`);
    fs.writeFileSync(path.join(out,'skill-icons-v2.png'),Buffer.from(icons.split(',')[1],'base64'));
    for(const faction of ['dharma','adharma']){
      const effects=await run(`(()=>{
        const c=document.createElement('canvas');c.width=1200;c.height=1090;const g=c.getContext('2d');g.fillStyle='#101c2b';g.fillRect(0,0,c.width,c.height);
        g.font='bold 24px sans-serif';g.fillStyle='#efca78';g.fillText('เทวทัณฑ์ · เอฟเฟกต์สกิล · ${faction}',24,35);
        const original={x:G.me.x,y:G.me.y,faction:G.me.faction};Object.assign(G.me,{x:0,y:0,faction:'${faction}'});
        try{C.CLASSES.arbiter.skills.forEach((sk,i)=>{
          const x=i%3*400,y=55+Math.floor(i/3)*340,s=C.arbiterSpec(sk,12,sk.evo.length);
          g.save();g.beginPath();g.rect(x+4,y,392,302);g.clip();g.translate(x+200,y+162);
          g.strokeStyle='#273b50';g.lineWidth=1;g.beginPath();g.ellipse(0,0,130,45,0,0,Math.PI*2);g.stroke();
          const phase=({resonance:'resonance',astral:'blades',ward:'ward',form:'form'})[s.kind]||'release';
          const d={id:G.me.id,skill:sk.id,token:100+i,r:sk.evo.length,f:'${faction}',x:0,y:0,a:0,phase,
            radius:s.radius||s.range||80,width:s.width||24,dur:s.duration||400};
          FX.list=[];
          if(s.kind==='verdict'){
            ArbiterLook.play({...d,phase:'windup',dur:1200});g.save();g.scale(.8,.8);FX.list[0].draw(g,.7);g.restore();FX.list=[];
          }
          ArbiterLook.draw(g,{...G.me,lvl:1,wt:0},{dir:0,frame:1},0,0,.46*.8,1000);
          ArbiterLook.play(d);g.save();g.scale(.8,.8);FX.list.forEach(f=>f.draw(g,.3));g.restore();
          g.restore();g.fillStyle='#dceafa';g.font='17px sans-serif';g.fillText(sk.key+' · '+sk.name,x+20,y+310);
        });}finally{Object.assign(G.me,original);FX.list=[];}return c.toDataURL();
      })()`);
      fs.writeFileSync(path.join(out,'skill-effects-'+faction+'-v2.png'),Buffer.from(effects.split(',')[1],'base64'));
    }
    const samples=await run(`(()=>{
      const c=document.createElement('canvas');c.width=800;c.height=800;const g=c.getContext('2d');let n=0;
      const saved={x:G.me.x,y:G.me.y,dead:G.me.dead};Object.assign(G.me,{x:0,y:0,dead:false});
      try{for(const faction of ['dharma','adharma'])for(const sk of C.CLASSES.arbiter.skills)for(let rank=0;rank<=sk.evo.length;rank++){
        const s=C.arbiterSpec(sk,12,rank),phase=({resonance:'resonance',astral:'blades',ward:'ward',form:'form'})[s.kind]||'release';
        for(const mode of [phase,'windup',...(s.kind==='basic'?['wave','astral']:[])]){
          FX.list=[];ArbiterLook.play({id:G.me.id,skill:sk.id,token:1,r:rank,f:faction,x:0,y:0,a:.4,
            phase:mode==='wave'?'release':mode,wave:mode==='wave',radius:s.radius||s.range||80,width:s.width||24,dur:s.duration||400});
          for(const t of [0,.15,.5,.85,1])for(const effect of FX.list){
            g.setTransform(1,0,0,1,400,400);g.globalAlpha=.73;effect.draw(g,t);n++;
            const m=g.getTransform();if(m.a!==1||m.b!==0||m.c!==0||m.d!==1||m.e!==400||m.f!==400||Math.abs(g.globalAlpha-.73)>.001)throw Error('Canvas state leak');
          }
        }
      }
      FX.list=[];const warning={id:G.me.id,skill:'finalVerdict',token:999,x:0,y:0,radius:170,phase:'windup',dur:1200};
      ArbiterLook.play(warning);if(FX.list[0].layer!=='ground')throw Error('Warning layer');
      for(let i=0;i<150;i++)ArbiterLook.play({id:G.me.id,skill:'oathSlash',token:i,x:0,y:0,phase:'release'});
      if(FX.list.filter(f=>!f.warning).length>96||!FX.list.some(f=>f.warning))throw Error('FX budget or warning lost');
      ArbiterLook.play({...warning,phase:'cancel'});if(FX.list.some(f=>f.warning))throw Error('Warning not cancelled');
      FX.list=[];ArbiterLook.play({id:G.me.id,skill:'oathAegis',token:200,x:0,y:0,phase:'ward',dur:5000});
      const effect=FX.list[0];G.me.dead=true;effect.draw(g,.2);G.me.dead=false;g.clearRect(-400,-400,800,800);effect.draw(g,.3);
      if(g.getImageData(0,0,800,800).data.some(v=>v))throw Error('Buff revived after death');
      }finally{Object.assign(G.me,saved);FX.list=[];}return n;
    })()`);
    assert.equal(samples,380);console.log('PASS: '+samples+' FX samples, canvas state, icon uniqueness, FX budget, warning cancellation and buff death cleanup.');
    const rooted=await run(`(()=>{
      const sent=[],emit=G.socket.emit,control=G.control;G.socket.emit=(event,d)=>{if(event==='skill')sent.push(d.id);};
      G.control={rootUntil:performance.now()+10000};HUD.cds={};G.spearWait={};
      try{for(const sk of C.CLASSES.arbiter.skills)G.useSlot(sk.id,{a:0,tid:'test',tx:G.me.x,ty:G.me.y});}
      finally{G.socket.emit=emit;G.control=control;G.spearWait={};}return sent;
    })()`);
    assert.deepEqual(rooted,['oathResonance','astralBlades','oathAegis','ascendantForm']);
    await pause(150);assert.equal(errors.length,0,JSON.stringify(errors));
    console.log('PASS: browser boot, class selection, 1,008 directional/level/pose renders, 18 skill icons, live FX and eight active skill evolution cards. '+out);
  }finally{if(ws)ws.close();preview.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
