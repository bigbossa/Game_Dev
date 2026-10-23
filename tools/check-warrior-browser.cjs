// Uses an isolated headless Edge profile. Never creates an account or sends a skill to the live server.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3900',port=process.argv[3]||'9335';
const out=path.join(__dirname,'../artifacts/class-balance-audit');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)||p.url.includes('?warrior-review=')));assert(page);
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin+'/?warrior-review='+Date.now()});await pause(500);
    let ready=false;for(let i=0;i<200;i++){ready=await run("!!window.G?.map && window.WarriorLook?.ready === true && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,JSON.stringify({message:'game loaded',errors,state:await run("({game:!!window.G,map:!!window.G?.map,model:!!window.WarriorLook,loading:document.getElementById('loading')?.textContent})")}));
    await run(`(()=>{
      G.socket.disconnect();window.warriorEmits=[];G.socket.emit=(ev,data)=>warriorEmits.push({ev,data});
      document.getElementById('authStep').classList.add('hidden');document.getElementById('createStep').classList.remove('hidden');
      document.querySelector('.cls[data-c="warrior"]').click();
    })()`);
    assert(await run("document.getElementById('clsDesc').textContent.includes('นักรบแนวหน้า')"));
    assert(await run("WarriorLook.ready && [...document.querySelectorAll('.fcard img')].every(i=>i.src.startsWith('data:image/png')||i.src.includes('warrior-v1'))"));
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'warrior-create.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await run(`(()=>{
      document.getElementById('login').classList.add('hidden');
      let pos;outer:for(let y=20;y<G.map.h-20;y++)for(let x=20;x<G.map.w-20;x++)if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)){pos={x:x*C.TILE,y:y*C.TILE};break outer;}
      const stats=C.playerStats('warrior',130,{},{});
      const e={kind:'p',id:'warrior-preview',...pos,tx:pos.x,ty:pos.y,cls:'warrior',faction:'dharma',lvl:130,dir:0,name:'นักรบแนวหน้า',hp:stats.maxHp,mhp:stats.maxHp,wt:5,wp:0,wg:0,ar:[1,1,1,1],gg:[0,0,0,0,0],flash:0};
      G.me=e;G.myId=e.id;G.cls='warrior';G.ents.clear();G.ents.set(e.id,e);CharacterMotion.reset(e);C.setViewClass('warrior');
      G.speed=stats.speed;G.stats={lvl:130,hp:stats.maxHp,mhp:stats.maxHp,mp:stats.maxMp,mmp:stats.maxMp,atk:stats.atk,def:stats.def,aspd:0,crit:5,spd:stats.speed};
      G.skl=C.cleanSkills('warrior',null,130);G.order=null;HUD.init(e);HUD.cds={};
      window.warriorFx=G.socket.listeners('fx')[0];window.warriorCast=G.socket.listeners('cast')[0];
    })()`);
    await pause(200);
    for(const faction of ['dharma','adharma']) for(let dir=0;dir<8;dir++){
      await run(`G.me.faction=${JSON.stringify(faction)};G.me.dir=${dir};G.me.atk=null;`);await pause(30);
    }
    const ids=await run("C.CLASSES.warrior.skills.map(s=>s.id)");
    for(const id of ids){
      await run(`(()=>{const sk=C.ALL_SKILLS[${JSON.stringify(id)}];warriorFx({id:G.me.id,t:sk.id,a:0,x:G.me.x,y:G.me.y,f:G.me.faction,dur:500,radius:sk.frontline.range||90});HUD.icon(sk.id,'dharma');HUD.icon(sk.id,'adharma');})()`);
      await pause(40);
    }
    const iconReport=await run(`(()=>{
      const factions=['dharma','adharma'], skills=C.CLASSES.warrior.skills;
      const weapons=[...C.WEAPONS].sort((a,b)=>a.lvl-b.lvl);
      const skillImages=[],weaponImages=[];let scaled=0;
      for(const f of factions){
        for(const sk of skills){
          const c=HUD.icon(sk.id,f);skillImages.push(c.toDataURL());
          for(const size of [32,48]){const small=document.createElement('canvas');small.width=small.height=size;
            if(!WarriorIcons.draw(small.getContext('2d'),sk,f,size))throw Error('Missing skill '+sk.id);scaled++;}
        }
        for(const w of weapons){
          if(!C.ITEMS[w.id].name.includes('ดาบและโล่'))throw Error('Wrong weapon name '+w.id);
          const c=ItemArt.iconCanvas(w.id,f,128),p=c.getContext('2d').getImageData(0,0,128,128).data;
          let opaque=0;for(let i=3;i<p.length;i+=4)if(p[i])opaque++;
          if(opaque<500)throw Error('Empty weapon icon '+w.id);
          for(let i=0;i<128;i++)for(const n of [i,127*128+i,i*128,i*128+127])if(p[n*4+3])throw Error('Clipped weapon '+w.id);
          weaponImages.push(c.toDataURL());
          for(const size of [32,48]){ItemArt.iconCanvas(w.id,f,size);scaled++;}
        }
      }
      if(new Set(skillImages).size!==22)throw Error('Duplicate skill/faction icon');
      if(new Set(weaponImages).size!==28)throw Error('Duplicate weapon/faction icon');
      // The atlas is painted with held equipment: inventory rendering must not add a second weapon to it.
      return {skillIcons:skillImages.length,weaponIcons:weaponImages.length,scaledRenders:scaled,weaponIds:weapons.map(w=>w.id)};
    })()`);
    assert.equal(iconReport.skillIcons,22);assert.equal(iconReport.weaponIcons,28);
    const gallery=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1200;c.height=1040;const g=c.getContext('2d');
      g.fillStyle='#101722';g.fillRect(0,0,c.width,c.height);g.fillStyle='#e8c789';g.font='bold 24px sans-serif';
      g.fillText('นักรบแนวหน้า · 11 วิชา / ดาบและโล่ 14 ระดับ',24,34);
      const skills=C.CLASSES.warrior.skills,weapons=[...C.WEAPONS].sort((a,b)=>a.lvl-b.lvl);
      ['dharma','adharma'].forEach((f,r)=>{
        skills.forEach((sk,i)=>{const x=8+i*108,y=54+r*142;
          g.drawImage(HUD.icon(sk.id,f),x+8,y,88,88);g.fillStyle='#d9dce2';g.font='12px sans-serif';
          g.fillText(sk.name,x+2,y+105,104);g.fillStyle=f==='dharma'?'#7ed7ed':'#f19aae';g.font='11px sans-serif';
          g.fillText((f==='dharma'?'ธรรมะ':'อธรรม')+' · '+sk.key,x+10,y+123);
        });
      });
      g.fillStyle='#e8c789';g.font='18px sans-serif';g.fillText('อาวุธตามเลเวล · ธรรมะ / อธรรม',24,366);
      ['dharma','adharma'].forEach((f,fr)=>weapons.forEach((w,i)=>{
        const x=24+(i%7)*166,y=382+fr*320+Math.floor(i/7)*157;
        g.fillStyle=f==='dharma'?'#152d3a':'#30212d';g.fillRect(x,y,148,147);
        g.drawImage(ItemArt.iconCanvas(w.id,f),x+22,y+2,104,104);
        g.fillStyle='#e8c789';g.font='bold 12px sans-serif';g.fillText('Lv.'+w.lvl+' · '+w.id,x+10,y+119);
        g.fillStyle='#d9dce2';g.font='11px sans-serif';g.fillText(w.name,x+8,y+137,132);
      }));return c.toDataURL('image/png').split(',')[1];
    })()`);
    fs.writeFileSync(path.join(out,'warrior-skill-weapons.png'),Buffer.from(gallery,'base64'));
    // A rejected targeted cast must not start a client cooldown; accepted casts use the server cooldown.
    await run("HUD.cds={};G.useSlot('shieldBash',{a:0,tid:'missing'});");
    assert.equal(await run("HUD.cdLeft('shieldBash')"),0);
    await run("warriorCast({id:'shieldBash',cd:11500});");
    assert(await run("HUD.cdLeft('shieldBash')>11000"));
    await run(`(()=>{
      const c=document.createElement('canvas');c.id='warriorSheet';c.width=1200;c.height=850;
      c.style='position:fixed;inset:0;z-index:99999;width:1200px;height:850px';document.body.appendChild(c);const g=c.getContext('2d');
      g.fillStyle='#101a27';g.fillRect(0,0,1200,850);g.fillStyle='#e7c179';g.font='28px sans-serif';g.fillText('นักรบแนวหน้า · ดาบและโล่',35,42);
      for(let row=0;row<4;row++)for(let dir=0;dir<8;dir++){
        const faction=row<2?'dharma':'adharma',e={faction,lvl:row%2?130:1,dir,moving:false,atk:row%2?{t0:100,dur:600}:null};
        WarriorLook.draw(g,e,{dir,atk:!!e.atk,frame:1},70+dir*150,235+row*195,.64,400);
        g.fillStyle='#b8c8dc';g.font='12px sans-serif';g.fillText(faction+' Lv.'+e.lvl+' / '+dir,20+dir*150,249+row*195);
      }
    })()`);
    fs.writeFileSync(path.join(out,'warrior-directions.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await run("document.getElementById('warriorSheet').remove();");
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await run("document.getElementById('login').classList.remove('hidden');document.querySelector('.cls[data-c=warrior]').click();");await pause(150);
    assert(await run("document.querySelector('.cls[data-c=warrior]').getBoundingClientRect().right<=innerWidth"));
    fs.writeFileSync(path.join(out,'warrior-mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.equal(errors.length,0,JSON.stringify(errors));
    const report={desktop:true,mobile:true,directions:16,skillFx:ids.length,portraits:2,...iconReport,serverConfirmedCooldown:true,browserErrors:errors};
    fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
