// Verify the actual game renderer on a stateless preview server; no player writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const WS = require('ws');
const origin = process.argv[2] || 'http://127.0.0.1:3904', port = process.argv[3] || '9351';
const out = path.join(__dirname, '../artifacts/pass-monsters-v2');
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const page = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  const ws = new WS(page.webSocketDebuggerUrl), pending = new Map(), errors = [], failed = [];
  let seq = 0;
  ws.on('message', data => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && m.params.response.url.startsWith(origin)) failed.push(m.params.response.url);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    }
  });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error('Timeout ' + method)); }, 60000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  try {
    await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin + '/?pass-monsters-review=2' });
    let ready = false;
    for (let i = 0; i < 450; i++) {
      ready = await run("!!window.G?.map && window.VillageArt?.ready && document.getElementById('loading').classList.contains('hidden')");
      if (ready) break; await pause(100);
    }
    assert(ready, 'Game failed to boot: ' + JSON.stringify(errors));
    const result = await run(`(async () => {
      G.socket.disconnect(); G.socket.emit = () => {};
      const index = await fetch('/assets/monsters/index.json?v=pass-monsters-v2').then(r => r.json());
      const ids = [...C.MAPS.pass.mons, C.MAPS.pass.boss], dirs = [2,1,0,7,6,5,4,3], labels = ['S','SE','E','NE','N','NW','W','SW'];
      const states = [{moving:true,t:0}, {moving:false,t:0}, {moving:true,t:.26}, {moving:false,atk:1,t:0}];
      const names = ['Walk A', 'Idle', 'Walk B', 'Attack'];
      const mk = (w,h) => Object.assign(document.createElement('canvas'), {width:w,height:h});
      const warm = mk(600,600).getContext('2d');
      for (const id of ids) {
        if (!MonsterArt.hasSheet(id)) throw Error('Missing registration ' + id);
        MonsterArt.draw(warm,id,300,300,1,0,{seed:0});
      }
      // Decode the same URLs and allow the renderer's onload/mipmap work to finish.
      await Promise.all(ids.map(id => new Promise((resolve,reject) => {
        const img = new Image(); img.onload = resolve; img.onerror = reject;
        img.src = '/assets/monsters/' + index[id].file + '?v=' + index[id].version;
      })));
      await new Promise(r => setTimeout(r, 200));
      let fallback = 0, verified = 0;
      const originals = {};
      for (const art of new Set(ids.map(id => C.MONSTERS[id].art))) {
        originals[art] = MonsterArt[art]; MonsterArt[art] = () => { fallback++; };
      }
      const gallery = mk(1400,840), gg = gallery.getContext('2d');
      gg.fillStyle='#172830'; gg.fillRect(0,0,1400,840);
      const sheets = {}, effects = [];
      for (const [n,id] of ids.entries()) {
        const m = index[id], sheet = mk(1600,960), g = sheet.getContext('2d');
        g.fillStyle='#172830'; g.fillRect(0,0,1600,960);
        for (let row=0;row<4;row++) for (let col=0;col<8;col++) {
          const x=col*200+100,y=row*240+212;
          g.fillStyle='#eee1b6'; g.font='16px sans-serif'; g.textAlign='center';
          g.fillText(labels[col]+' / '+names[row],x,row*240+24);
          g.save(); g.translate(x,y); const scale=Math.min(1.8,170/(C.MON_ART[C.MONSTERS[id].art].h*C.MONSTERS[id].size)); g.scale(scale,scale);
          const draw=g.drawImage.bind(g); let sampled;
          g.drawImage=(...a)=>{sampled=a; return draw(...a);};
          MonsterArt.draw(g,id,0,0,1,states[row].t,{...states[row],dir:dirs[col],seed:0});
          g.drawImage=draw; g.restore();
          if (!sampled) throw Error('No sprite draw '+id);
          const ratio=sampled[0].width/(m.fw*8);
          if (Math.abs(sampled[1]-col*m.fw*ratio)>.001 || Math.abs(sampled[2]-row*m.fh*ratio)>.001)
            throw Error('Wrong direction/state '+id+' '+row+'/'+col);
          verified++;
        }
        sheets[id]=sheet.toDataURL().split(',')[1];
        // Idle + attack together at a readable scale, one species per card.
        const col=n%4,row=Math.floor(n/4),x=col*350,y=row*420;
        gg.fillStyle='#223a42'; gg.fillRect(x+10,y+10,330,400);
        gg.fillStyle='#eee1b6'; gg.font='18px sans-serif'; gg.textAlign='center';
        gg.fillText(C.MONSTERS[id].name,x+175,y+44);
        gg.font='14px sans-serif'; gg.fillText('Lv.'+C.MONSTERS[id].lvl+' · '+id,x+175,y+70);
        for(let pose=0;pose<2;pose++) {
          gg.save(); gg.translate(x+175,y+218+pose*165); const scale=Math.min(1.55,130/(C.MON_ART[C.MONSTERS[id].art].h*C.MONSTERS[id].size)); gg.scale(scale,scale);
          MonsterArt.draw(gg,id,0,0,1,0,{dir:1,seed:0,atk:pose}); gg.restore();
        }
        const eg=warm,draw=eg.drawImage.bind(eg); let alpha,filter;
        eg.drawImage=(...a)=>{alpha=eg.globalAlpha;filter=eg.filter;return draw(...a);};
        MonsterArt.draw(eg,id,300,300,1,0,{dir:0,seed:0,alpha:.35,flash:.5});
        eg.drawImage=draw;
        if(Math.abs(alpha-.35)>.01 || !filter.includes('brightness') || eg.globalAlpha!==1 || eg.filter!=='none') throw Error('Hit/death state leak '+id);
        effects.push(id);
      }
      Object.assign(MonsterArt,originals);
      if(fallback) throw Error('Procedural fallback count '+fallback);
      document.getElementById('login').classList.add('hidden');
      const x=128*C.TILE,y=23*C.TILE;
      const p={kind:'p',id:'village-art-review',x,y:y+140,tx:x,ty:y+140,dir:6,cls:'taoist',faction:'dharma',lvl:25,name:'นักพรต',hp:1500,mhp:1500,flash:0,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0]};
      G.me=p;G.myId=p.id;G.cls=p.cls;G.ents.clear();G.ents.set(p.id,p);G.speed=205;G.stats=null;G.order=null;CharacterMotion.reset(p); await G.socket.listeners('mapchange')[0]({id:'pass',x:p.x,y:p.y}); if(G.mapId!=='pass'||G.mapLoading)throw Error('Pass map failed to load');
      ids.forEach((id,n)=>{
        const d=C.MONSTERS[id],mx=x-300+(n%4)*200,my=y-80+Math.floor(n/4)*240;
        G.ents.set('review-'+id,{kind:'m',id:'review-'+id,type:id,x:mx,y:my,tx:mx,ty:my,face:1,dir8:1,moving:false,hp:d.hp,mhp:d.hp,name:d.name,lvl:d.lvl,boss:!!d.boss,seed:n,flash:0});
      });
      return {verifiedFrames:verified,proceduralFallbacks:fallback,effectsVerified:effects,sheets,gallery:gallery.toDataURL().split(',')[1]};
    })()`);
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'lineup.png'),Buffer.from(result.gallery,'base64'));delete result.gallery;
    for(const [id,data] of Object.entries(result.sheets)) fs.writeFileSync(path.join(out,id+'-poses.png'),Buffer.from(data,'base64'));
    delete result.sheets;
    await pause(1500);
    fs.writeFileSync(path.join(out,'in-game.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    Object.assign(result,{origin,errors,failedAssets:failed});
    fs.writeFileSync(path.join(out,'check.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
  } finally { await send('Page.close').catch(()=>{});ws.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
