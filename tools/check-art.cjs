// Browser smoke test. Run against a local game server and a Chromium CDP port.
// node tools/check-art.cjs [debug-port=9334] [game-origin=http://localhost:3900]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const port = process.argv[2] || '9334', origin = process.argv[3] || 'http://localhost:3900';
const output = path.join(__dirname, '..', 'artifacts');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  const page = pages.find(p => p.type === 'page' && (p.url === 'about:blank' || p.url.startsWith(origin)));
  assert(page, 'Open a blank page in the test browser first');
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [];
  let seq = 0;
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.id) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  try {
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1120, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${origin}/art-preview.html` });
    for (let i = 0; i < 50; i++) {
      if (await evaluate("!!document.querySelector('#creatures canvas')")) break;
      await delay(100);
    }
    const report = await evaluate(`(() => {
      const results = [], select = document.getElementById('map');
      for (const id of C.MAP_ORDER) {
        select.value = id; select.dispatchEvent(new Event('change'));
        if (!document.querySelector('#creatures canvas')) throw new Error('Empty gallery: ' + id);
        results.push({map:id, cards:document.querySelectorAll('#creatures canvas').length});
      }
      const c = document.createElement('canvas'); c.width = 600; c.height = 600;
      const g = c.getContext('2d', {willReadFrequently:true});
      let renders = 0;
      for (const [id, def] of Object.entries(C.MONSTERS)) {
        if (typeof MonsterArt[def.art] !== 'function') throw new Error('Missing art: ' + id);
        for (const scale of [.65, 1, 2]) for (const face of [-1, 1]) for (const moving of [false, true]) {
          g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,600,600);
          g.translate(300,500); g.scale(scale,scale);
          MonsterArt.draw(g,id,0,0,face,1.25,{seed:1,moving,atk:moving ? .6 : 0,flash:moving ? .2 : 0,alpha:.8});
          if (!g.getImageData(0,0,600,600).data.some((v,i)=>i%4===3 && v>0)) throw new Error('Blank monster: '+id);
          renders++;
        }
      }
      select.value='village'; select.dispatchEvent(new Event('change'));
      document.getElementById('motion').click();
      return {maps:results,species:Object.keys(C.MONSTERS).length,archetypes:Object.keys(C.MON_ART).length,renders};
    })()`);
    fs.mkdirSync(output, { recursive: true });
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(output, 'art-preview.png'), Buffer.from(screenshot.data, 'base64'));
    const atlas = await evaluate(`(() => {
      const entries = Object.entries(C.MONSTERS), c = document.createElement('canvas');
      c.width = 1200; c.height = Math.ceil(entries.length / 6) * 190;
      const g = c.getContext('2d'); g.fillStyle = '#f6f4eb'; g.fillRect(0,0,c.width,c.height);
      entries.forEach(([id,def],i) => {
        const x = (i%6)*200+100, y = Math.floor(i/6)*190+148;
        g.save(); g.translate(x,y); const k = Math.min(1.9,120/MonsterArt.heightOf(id)); g.scale(k,k);
        MonsterArt.draw(g,id,0,0,1,1.25,{seed:1,moving:false,atk:0,flash:0}); g.restore();
        g.fillStyle = '#354c48'; g.font = '12px Tahoma'; g.textAlign='center'; g.fillText(def.name,x,y+24);
      });
      return c.toDataURL('image/png').split(',')[1];
    })()`);
    fs.writeFileSync(path.join(output, 'monster-lineup.png'), Buffer.from(atlas, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await delay(150);
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile layout overflows');
    const mobile = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(output, 'art-preview-mobile.png'), Buffer.from(mobile.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin });
    let booted = false;
    for (let i = 0; i < 100; i++) {
      booted = await evaluate("!!window.G?.map && document.getElementById('loading')?.classList.contains('hidden')");
      if (booted) break;
      await delay(100);
    }
    assert(booted, 'Game did not finish booting');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    report.gameBoot = true; report.mobileOverflow = false; report.browserErrors = errors;
    fs.writeFileSync(path.join(output, 'art-check.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { ws.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
