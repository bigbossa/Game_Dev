// Uses an isolated Chromium profile, a running local server and CDP on port 9334.
// Exercises the actual renderer with local entities; it never joins or saves a player.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const origin = process.argv[2] || 'http://localhost:3900', output = path.join(__dirname, '..', 'artifacts');
(async () => {
  const pages = await fetch('http://127.0.0.1:9334/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && (p.url === 'about:blank' || p.url.startsWith(origin)));
  assert(page, 'An isolated blank page is required');
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [];
  let seq = 0;
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.id) {
      const entry = pending.get(message.id); pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin });
    let loaded = false;
    for (let i = 0; i < 150; i++) {
      loaded = await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if (loaded) break; await pause(100);
    }
    assert(loaded, 'Game boot failed');
    await run(`(() => {
      G.socket.disconnect(); // before assigning a local entity; no server-side account is created
      document.activeElement?.blur(); document.getElementById('login').classList.add('hidden');
      const spawn = C.MAPS.village.spawn;
      let origin;
      // Find an open corridor long enough to test movement without hitting a wall.
      outer: for(let y=20; y<G.map.h-20; y++) for(let x=20; x<G.map.w-20; x++) {
        if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)) {
          origin={x:x*C.TILE,y:y*C.TILE}; break outer;
        }
      }
      if(!origin) throw new Error('No test corridor');
      const e = {kind:'p',id:'local-preview',...origin,tx:origin.x,ty:origin.y,dir:0,
        cls:'dualblade',faction:'dharma',lvl:30,name:'ทดสอบภาพ',hp:100,mhp:100,flash:0,
        wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0]};
      CharacterMotion.reset(e); G.me=e; G.myId=e.id; G.ents.clear(); G.ents.set(e.id,e);
      G.speed=215; G.stats=null;
    })()`);
    await pause(500);
    const start = await run('({x:G.me.x,y:G.me.y})');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD' });
    const motion = await run(`new Promise(resolve => {
      const points=[], begin=performance.now();
      function sample(now) {
        points.push({t:now,x:G.me.x,gait:G.me.gait,lift:G.me.liftY});
        if(now-begin<1000) requestAnimationFrame(sample); else resolve(points);
      } requestAnimationFrame(sample);
    })`);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD' });
    const moved = await run('G.me.x');
    assert(moved - start.x > 130 && moved - start.x < 280, `Movement distance: ${moved - start.x}`);
    assert(motion.every(p => Number.isFinite(p.gait) && Number.isFinite(p.lift)), 'Non-finite pose');
    await pause(200);
    assert.equal(await run('CharacterMotion.walkFrame(G.me)'), 1, 'Walk did not settle to idle');
    const captures = await run(`(() => {
      const c=document.createElement('canvas'); c.width=1600; c.height=1040;
      const g=c.getContext('2d'); g.fillStyle='#edece5'; g.fillRect(0,0,c.width,c.height);
      const original={...G.me};
      const types=[['dualblade','dharma'],['dualblade','adharma'],['taoist','dharma'],['taoist','adharma']];
      for(let row=0;row<types.length;row++) {
        [G.me.cls,G.me.faction]=types[row]; G.me.lvl=1;
        for(let dir=0;dir<8;dir++) {
          g.save(); g.translate(dir*200,row*260); G.drawPreview(g,200,230,dir*.9+.1); g.restore();
          g.fillStyle='#344953'; g.font='13px Tahoma'; g.textAlign='center';
          g.fillText(types[row].join(' / ')+' · '+dir,dir*200+100,row*260+250);
        }
      }
      Object.assign(G.me,original);
      // Synthetic touching red and green cells detect filtering bleed at small sizes.
      const source=document.createElement('canvas'); source.width=64; source.height=32;
      const sg=source.getContext('2d'); sg.fillStyle='#ff0000'; sg.fillRect(0,0,32,32);
      sg.fillStyle='#00ff00'; sg.fillRect(32,0,32,32);
      const atlas=SpriteDetail.sheet(source,.37,32,32);
      const lazy=SpriteDetail.sheet(source,.5,32,32,false,0,0);
      if(lazy.ready.size!==1) throw new Error('Unused sprite frames were built');
      SpriteDetail.sheet(source,.5,32,32,false,1,0);
      if(lazy.ready.size!==2) throw new Error('Next sprite frame was not built');
      const pixels=atlas.img.getContext('2d').getImageData(0,0,atlas.img.width,atlas.img.height).data;
      let greenInRed=0, gutterAlpha=0;
      for(let y=0;y<atlas.img.height;y++) for(let x=0;x<atlas.pitchX;x++) {
        const at=(y*atlas.img.width+x)*4;
        if(x>=atlas.pad && x<atlas.pad+atlas.cw && y>=atlas.pad && y<atlas.pad+atlas.ch) greenInRed+=pixels[at+1];
        else gutterAlpha+=pixels[at+3];
      }
      return {image:c.toDataURL('image/png').split(',')[1],greenInRed,gutterAlpha,
        width:document.getElementById('game').width,cssWidth:innerWidth};
    })()`);
    assert.equal(captures.greenInRed, 0); assert.equal(captures.gutterAlpha, 0);
    assert.equal(captures.width, captures.cssWidth);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'character-detail.png'), Buffer.from(captures.image, 'base64'));
    // Run all attack kinds at multiple stages on both classes, with their real attachment layers.
    const attacks = await run(`(async function() {
      const kinds={dualblade:['slash','cross','spin','whirl','dash','ult','wave','leap','clones','dragon'],
        taoist:['talisman','thunder','heal','ward','bagua','flysword','seal','guardian','taiji']};
      let count=0;
      for(const [cls,skills] of Object.entries(kinds)) for(const faction of ['dharma','adharma']) {
        G.me.cls=cls; G.me.faction=faction; G.me.lvl=80;
        for(const kind of skills) for(const progress of [.1,.45,.8]) {
          G.me.atk={kind,t0:performance.now()-progress*800,dur:800,dir:2,a:Math.PI/2};
          await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); count++;
        }
      }
      G.me.atk=null; G.me.cls='dualblade'; G.me.faction='dharma'; G.me.lvl=30; return count;
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 450, deltaX: 0, deltaY: -100 });
    await pause(350);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(output, 'character-in-game.png'), Buffer.from(screenshot.data, 'base64'));
    const networkMotion = await run(`(async () => {
      const receive=G.socket.listeners('snap')[0], me=G.me, base=me.x;
      const row=(id,x)=>[id,x,me.y,0,1,100,100,0,'preview',30,false,0,0,[0,0,0,0],0,[0,0,0,0,0],0,0];
      for(let i=0;i<5;i++) {
        receive({mid:G.mapId,p:[row(me.id,me.x),row('peer-check',base+100+i*10)],
          m:[['creature-check',C.MONSTER_TYPES.indexOf('spirit'),base+180+i*10,me.y,1,1,100,100,0]],me:{spd:215}});
        G.stats=null;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      await new Promise(resolve=>setTimeout(resolve,150));
      for(const id of ['peer-check','creature-check']) {
        const e=G.ents.get(id);
        if(!Number.isFinite(e.animT) || Math.abs(e.x-e.tx)>.01) throw new Error('Snapshot motion failed: '+id);
        G.ents.delete(id);
      }
      return true;
    })()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await pause(250);
    assert.equal(await run("document.getElementById('game').width"), 780);
    await run("document.getElementById('hud').classList.remove('hidden'); INV.toggle(true)");
    await pause(150);
    const inventoryScale = await run("document.getElementById('invPreview').width / document.getElementById('invPreview').clientWidth");
    assert.equal(inventoryScale, 2);
    await run('INV.toggle(false)');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    const report = { gameBoot: loaded, movementDistance: +(moved-start.x).toFixed(2), sampledFrames: motion.length,
      directionalPreviews:32,attackPoses:attacks,networkMotion,atlasBleed:false,desktopRenderScale:1,mobileRenderScale:2,inventoryRenderScale:inventoryScale,browserErrors:errors };
    fs.writeFileSync(path.join(output,'character-check.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { ws.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
