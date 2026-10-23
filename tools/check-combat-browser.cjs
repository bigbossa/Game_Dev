// Uses the same isolated CDP browser as check-character-browser.cjs. Never logs in or creates an account.
const assert = require('node:assert/strict');
const origin = process.argv[2] || 'http://localhost:3901';
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const pages = await fetch('http://127.0.0.1:9334/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && (p.url === 'about:blank' || p.url.startsWith(origin)));
  assert(page);
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [];
  let seq = 0;
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin });
    let ready = false;
    for (let i = 0; i < 200; i++) {
      ready = await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if (ready) break; await pause(100);
    }
    assert(ready);
    await run(`(() => {
      G.socket.disconnect();
      document.activeElement?.blur(); document.getElementById('login').classList.add('hidden');
      window.reviewEmits = [];
      G.socket.emit = (ev, data) => reviewEmits.push({ev, data});
      G.cls='archer'; C.setViewClass('archer');
      let origin;
      outer: for(let y=20;y<G.map.h-20;y++) for(let x=20;x<G.map.w-20;x++) {
        if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)) {
          origin={x:x*C.TILE,y:y*C.TILE};break outer;
        }
      }
      if(!origin)throw Error('No corridor');
      window.reviewOrigin=origin;
      const e={kind:'p',id:'combat-preview',...origin,tx:origin.x,ty:origin.y,cls:'archer',faction:'dharma',
        lvl:130,dir:0,name:'ทดสอบสมดุล',hp:2715,mhp:2715,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0],flash:0};
      G.me=e;G.myId=e.id;G.ents.clear();G.ents.set(e.id,e);CharacterMotion.reset(e);
      G.speed=220;G.stats={lvl:130,hp:2715,mhp:2715,mp:2000,mmp:2000,aspd:0,atk:530,crit:22,def:112,spd:220,
        evasion:8,accuracy:12,resistance:0};
      G.skl=C.cleanSkills('archer',null,130);G.order=null;
      window.controlReview=G.socket.listeners('control')[0];
      controlReview({stun:0,root:0,slow:0});
    })()`);
    await run("controlReview({stun:1500,root:0,slow:0});");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD' });
    await pause(250);
    assert.equal(await run('G.me.x'), await run('reviewOrigin.x'), 'stun must stop keyboard movement');
    await run("G.useSlot('arrow',{a:0,tx:G.me.x+200,ty:G.me.y});");
    assert.equal(await run("reviewEmits.filter(e=>e.ev==='skill').length"), 0, 'stun blocks local cast');
    await run("controlReview({stun:0,root:1500,slow:0});G.useSlot('vault',{a:0});G.useSlot('arrow',{a:0,tx:G.me.x+200,ty:G.me.y});");
    assert.deepEqual(await run("reviewEmits.filter(e=>e.ev==='skill').map(e=>e.data.id)"), ['arrow'], 'root allows shooting but blocks escape');
    await pause(200);
    assert.equal(await run('G.me.x'), await run('reviewOrigin.x'), 'root must stop keyboard movement');
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD' });
    await run("G.order={type:'move',gx:G.me.x+250,gy:G.me.y,path:[[G.me.x+250,G.me.y]],t:performance.now()};");
    await pause(200);
    assert.equal(await run('G.me.x'), await run('reviewOrigin.x'), 'root must stop click movement');
    // Compare integrated distance to real elapsed animation time, not a fixed frame count.
    const move = await run(`(async () => {
      controlReview({stun:0,root:0,slow:2000});
      G.me.atk={type:'arrow',t:performance.now(),dur:2000,a:0};
      const x=G.me.x,t=performance.now();
      await new Promise(r=>setTimeout(r,350));
      return {dx:G.me.x-x,ms:performance.now()-t};
    })()`);
    const expected = 220 * 0.9 * 0.65 * move.ms / 1000;
    assert(Math.abs(move.dx - expected) < 10, `slow + attacking prediction: ${move.dx} vs ${expected}`);
    await run("G.order=null;G.me.atk=null;controlReview({stun:0,root:0,slow:0});INV.renderStats();");
    const text = await run("document.getElementById('statList').textContent");
    assert(text.includes('หลบหลีก') && text.includes('แม่นยำ') && text.includes('ต้านทานควบคุม'));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log('PASS: browser stun/root input, attack/escape restrictions, click movement, slow + attack speed prediction, stat display; no runtime errors.');
  } finally { ws.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
