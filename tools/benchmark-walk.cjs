// Repeatable local render benchmark. No account is joined or saved.
// Run with a local game server and isolated Chromium CDP on port 9334.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const pages = await fetch('http://127.0.0.1:9334/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && (p.url === 'about:blank' || p.url.startsWith('http://localhost:3900')));
  assert(page);
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map();
  const errors = []; let serial = 0;
  ws.onmessage = ({data}) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  await new Promise((resolve,reject) => { ws.onopen=resolve; ws.onerror=reject; });
  const send = (method,params={}) => new Promise((resolve,reject) => {
    const id=++serial; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params}));
  });
  const run = async expression => {
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://localhost:3900/'});
    let ready=false;
    for(let i=0;i<150;i++) {
      ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if(ready)break; await pause(100);
    }
    assert(ready,'Game boot failed');
    await run(`(() => {
      G.socket.disconnect(); document.activeElement?.blur();
      document.getElementById('login').classList.add('hidden');
      const x=60*C.TILE,y=40*C.TILE;
      G.me={kind:'p',id:'benchmark',x,y,tx:x,ty:y,dir:0,cls:'dualblade',faction:'dharma',
        lvl:30,hp:100,mhp:100,name:'benchmark',wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0],flash:0};
      CharacterMotion.reset(G.me); G.ents.clear(); G.ents.set(G.me.id,G.me);
      G.myId=null; G.speed=215; G.stats=null;
      window.benchmarkReadbacks={count:0,ms:0};
      const original=CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData=function(...args) {
        const start=performance.now(); const result=original.apply(this,args);
        benchmarkReadbacks.count++; benchmarkReadbacks.ms+=performance.now()-start; return result;
      };
    })()`);
    const result = await run(`(async () => {
      const scenarios=[];
      for(const crowded of [false,true]) {
        if(crowded) {
          const ids=['spirit','boar','wolf','mushroom','greensnake'];
          for(let i=0;i<24;i++) {
            const type=ids[i%ids.length],d=C.MONSTERS[type],id='mob'+i;
            const x=G.me.x+(i%6-2.5)*95,y=G.me.y+(Math.floor(i/6)-1.5)*100;
            G.ents.set(id,{kind:'m',id,type,x,y,tx:x,ty:y,name:d.name,lvl:d.lvl,hp:d.hp,mhp:d.hp,
              face:1,seed:i,moving:false,flash:0});
          }
        }
        const intervals=[]; const begin=performance.now(); let previous=begin;
        benchmarkReadbacks.count=0; benchmarkReadbacks.ms=0;
        await new Promise(resolve => {
          function sample(now) {
            const elapsed=(now-begin)/1000;
            // Repeat a small route with turns, exercising previously unseen walk frames.
            G.me.x=60*C.TILE+Math.sin(elapsed*1.2)*100;
            G.me.y=40*C.TILE+Math.sin(elapsed*.6)*40;
            G.me.dir=Math.floor(elapsed*2)%8;
            if(elapsed>2) intervals.push(now-previous);
            previous=now;
            if(elapsed<7)requestAnimationFrame(sample);else resolve();
          }
          requestAnimationFrame(sample);
        });
        const sorted=[...intervals].sort((a,b)=>a-b);
        scenarios.push({crowded,frames:intervals.length,fps:+(1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length)).toFixed(1),
          p50ms:+sorted[Math.floor(sorted.length*.5)].toFixed(1),p95ms:+sorted[Math.floor(sorted.length*.95)].toFixed(1),
          over50ms:intervals.filter(t=>t>50).length,readbacks:{...benchmarkReadbacks}});
      }
      return {canvasPixels:document.getElementById('game').width*document.getElementById('game').height,scenarios};
    })()`);
    assert.equal(errors.length,0,JSON.stringify(errors));
    result.errors=errors;
    const dir=path.join(__dirname,'..','artifacts'); fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,`walk-benchmark-${process.argv[2] || 'current'}.json`),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally { ws.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
