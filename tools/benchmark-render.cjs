// Stateless real-renderer benchmark; start tools/preview-village.cjs first.
// node tools/benchmark-render.cjs before http://127.0.0.1:3918 9362
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), WebSocket = require('ws');
const [label = 'current', origin = 'http://127.0.0.1:3918', port = '9362'] = process.argv.slice(2);
const mobile = process.argv.includes('--mobile');
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const page = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = []; let serial = 0;
  ws.on('message', data => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  });
  await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  try {
    await send('Runtime.enable'); await send('Page.enable');
    if (process.argv.includes('--baseline')||process.argv.includes('--baseline-smooth')||process.argv.includes('--baseline-polish')) {
      ws.on('message', async raw => {
        const m = JSON.parse(raw); if (m.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = m.params, file = new URL(request.url).pathname.split('/').pop();
        const smooth=process.argv.includes('--baseline-smooth');
        const polish=process.argv.includes('--baseline-polish');
        const saved = path.join(__dirname, polish?'../artifacts/skill-polish/baseline/public/js':smooth?'../artifacts/smooth-v2/baseline/public/js':'../artifacts/performance/before-js', file);
        if (((smooth||polish)?fs.existsSync(saved):['main.js', 'hud.js', 'fx.js'].includes(file))) {
          await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: fs.readFileSync(saved).toString('base64') });
        } else await send('Fetch.continueRequest', { requestId });
      });
      await send('Fetch.enable', { patterns: [{ urlPattern: '*/js/*.js*' }] });
    }
    await send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1280, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 3 : 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    await send('Page.navigate', { url: origin }); await send('Page.bringToFront');
    let ready;
    for (let i = 0; i < 900; i++) { ready = await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')"); if (ready) break; await pause(100); }
    assert(ready, 'game boot');
    await run(`(${setup})()`);
    if(process.argv.includes('--skill-stress'))await run('window.renderBenchSkillStress=true');
    await send('Profiler.enable'); await send('Profiler.start');
    const result = process.argv.includes('--checks-only') ? { scenarios: [] } : await run(`(${sample})()`);
    const { profile } = await send('Profiler.stop');
    if (process.argv.includes('--verify')) result.checks = await run(`(${verify})()`);
    if (process.argv.includes('--verify')) {
      const png = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.join(__dirname, '../artifacts/performance'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, `../artifacts/performance/${label}.png`), Buffer.from(png.data, 'base64'));
    }
    const counts = new Map(); for (const id of profile.samples || []) counts.set(id, (counts.get(id) || 0) + 1);
    result.cpuSamples = profile.nodes.map(n => ({ fn: n.callFrame.functionName, url: n.callFrame.url.split('/').pop(), samples: counts.get(n.id) || 0 })).sort((a, b) => b.samples - a.samples).slice(0, 25);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    const dir = path.join(__dirname, '../artifacts/performance'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await send('Page.close').catch(() => {}); ws.terminate(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
function setup() {
  G.socket.disconnect(); G.myId = null; G.stats = null; G.ents.clear();
  SET.set('graphics', 'auto');
  document.getElementById('login').classList.add('hidden'); document.activeElement?.blur();
  const x = 60 * C.TILE, y = 40 * C.TILE;
  G.me = { kind: 'p', id: 'benchmark', x, y, tx: x, ty: y, dir: 0, cls: 'dualblade', faction: 'dharma',
    lvl: 130, hp: 1000, mhp: 1000, mp: 500, mmp: 500, exp: 10, need: 100, atk: 50, def: 20, k: 0, d: 0,
    name: 'ทดสอบประสิทธิภาพ', wt: 0, wp: 0, wg: 0, ar: [0, 0, 0, 0], gg: [0, 0, 0, 0, 0], flash: 0 };
  G.speed = 215; CharacterMotion.reset(G.me); G.ents.set(G.me.id, G.me); HUD.init(G.me);
  window.renderBench = { textCalls: 0, hudMs: 0, mutations: 0 };
  const original = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText = function (...args) { renderBench.textCalls++; return original.apply(this, args); };
  new MutationObserver(records => { renderBench.mutations += records.length; }).observe(document.getElementById('hud'), { subtree: true, childList: true, attributes: true, characterData: true });
}
async function sample() {
  const scenarios = [];
  for (const scene of ['walk', 'crowd', 'combat']) {
    const count = scene === 'walk' ? 0 : 48;
    const types = ['spirit', 'boar', 'wolf', 'mushroom', 'greensnake'];
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length], d = C.MONSTERS[type], id = 'mob' + i;
      const x = G.me.x + (i % 8 - 3.5) * 75, y = G.me.y + (Math.floor(i / 8) - 2.5) * 70;
      G.ents.set(id, { kind: 'm', id, type, x, y, tx: x, ty: y, name: d.name, lvl: d.lvl, hp: d.hp, mhp: d.hp, face: 1, seed: i, flash: 0 });
    }
    const intervals = [], begin = performance.now(); let previous = begin, measured = false, nextBurst = 0;
    if(scene==='combat'&&window.renderBenchSkillStress)Object.keys(C.CLASSES).forEach((cls,i)=>{
      G.ents.set('skill-'+cls,{...G.me,id:'skill-'+cls,cls,x:G.me.x+(i-3)*65,y:G.me.y+100,tx:G.me.x+(i-3)*65,ty:G.me.y+100});
    });
    await new Promise(resolve => {
      function tick(now) {
        const elapsed = (now - begin) / 1000;
        G.me.x = 60 * C.TILE + Math.sin(elapsed * 1.2) * 100; G.me.y = 40 * C.TILE + Math.sin(elapsed * .6) * 40;
        G.me.dir = Math.floor(elapsed * 2) % 8;
        if (scene === 'combat' && now > nextBurst) {
          nextBurst = now + 250;
          for (let i = 0; i < 12; i++) {
            const x = G.me.x + (i < 2 ? i * 80 : 2500 + i * 80), y = G.me.y;
            FX.burst(x, y, 100, ['#ffffff', '#69cfff'], { speed: 200, life: 900, size: 3, spark: !!(i % 2) });
            FX.text(x, y, '1280', '#ffd76a', 20);
          }
          if(window.renderBenchSkillStress)Object.keys(C.CLASSES).forEach((cls,i)=>{
            for(let n=0;n<3;n++)FX.hit(G.me.x+(i-3)*65,G.me.y-25+n*40,null,n===0,'skill-'+cls);
          });
        }
        const start = performance.now(); HUD.update(G.me); HUD.target(G.ents.get('mob0') || G.me); renderBench.hudMs += performance.now() - start;
        if (elapsed > 2) {
          if (!measured) { renderBench.textCalls = renderBench.hudMs = renderBench.mutations = 0; measured = true; }
          else intervals.push(now - previous);
        }
        previous = now; if (elapsed < 7) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });
    const sorted = [...intervals].sort((a, b) => a - b), n = intervals.length;
    scenarios.push({ scene, monsters: count, frames: n, fps: +(1000 * n / intervals.reduce((a, b) => a + b, 0)).toFixed(1), p95ms: +sorted[Math.floor(n * .95)].toFixed(1), over50ms: intervals.filter(t => t > 50).length,
      textCallsPerFrame: +(renderBench.textCalls / n).toFixed(2), hudMsPerFrame: +(renderBench.hudMs / n).toFixed(3), domMutationsPerFrame: +(renderBench.mutations / n).toFixed(2) });
  }
  return { viewport: `${innerWidth}x${innerHeight} DPR${devicePixelRatio}`, touch: G.touch, scenarios,quality:window.G?.renderQuality?{mode:G.renderQuality.mode(),scale:G.renderQuality.scale(),ambient:G.renderQuality.ambient()}:null };
}

async function verify() {
  const checks = [], check = (value, message) => { if (!value) throw Error(message); checks.push(message); };
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const target = { kind: 'm', name: '<ทดสอบ>', lvl: 10, hp: 50, mhp: 100 };
  HUD.target(target); const originalName = document.querySelector('#tfName span');
  for (let i = 0; i < 120; i++) HUD.target(target);
  check(originalName === document.querySelector('#tfName span'), 'unchanged target preserves DOM');
  target.hp = 25; HUD.target(target);
  check(document.querySelector('#targetFrame .fill').style.width === '25%', 'target health updates immediately');
  target.name = '<เป้าใหม่>'; target.lvl = 25; target.boss = true; HUD.target(target);
  check(document.getElementById('tfName').textContent === '<เป้าใหม่> Lv.25' && !document.querySelector('#tfName เป้าใหม่'), 'target identity changes and escapes markup');
  HUD.target(null); check(document.getElementById('targetFrame').classList.contains('hidden'), 'target hides');
  HUD.target(target); check(!document.getElementById('targetFrame').classList.contains('hidden'), 'target returns');
  G.me.hp = 321; G.me.lvl = 120; HUD.update(G.me);
  check(document.querySelector('#playerFrame .hp span').textContent === '321 / 1000' && document.getElementById('pfLvl').textContent === '120', 'player health and level update');
  const skill = Object.keys(HUD.slots).find(id => HUD.slots[id].data.evo);
  HUD.setCd(skill, 200); HUD.update(G.me);
  check(!!HUD.slots[skill].cd.style.background, 'cooldown sweep starts');
  await new Promise(r => setTimeout(r, 240)); HUD.update(G.me);
  check(!HUD.slots[skill].cd.style.background && !HUD.slots[skill].cdt.textContent, 'cooldown expires');
  const labels = [], stroke = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText = function (text, ...args) { labels.push(text); return stroke.call(this, text, ...args); };
  G.me.name = 'ชื่อเปลี่ยน'; G.me.pk = true; G.me.ev = -10; await frame();
  check(labels.includes('⚔ Lv.120 ชื่อเปลี่ยน (-10)'), 'cached name refreshes for level/name/PvP/evil');
  labels.length = 0; await frame(); check(!labels.includes('⚔ Lv.120 ชื่อเปลี่ยน (-10)'), 'steady name reuses raster');
  document.fonts.dispatchEvent(new Event('loadingdone')); await frame();
  check(labels.includes('⚔ Lv.120 ชื่อเปลี่ยน (-10)'), 'font completion invalidates raster');
  CanvasRenderingContext2D.prototype.strokeText = stroke;
  FX.list = []; FX.parts = []; FX.texts = [];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d', { willReadFrequently: true });
  const part = (x, vx, spark) => ({ x, y: 64, vx, vy: 0, life: 0, max: 1000, size: 3, color: '#ffffff', drag: 0, grav: 0, spark });
  FX.parts.push(part(64, 0, false), part(200, 3000, true), part(-1, 0, false), part(5000, 0, true));
  const parts = FX.parts, texts = FX.texts; FX.text(64, 64, 'ทดสอบ', '#ffffff'); FX.text(5000, 64, '9999', '#ffffff');
  let arcs = 0, lines = 0; const arc = g.arc.bind(g), line = g.lineTo.bind(g);
  g.arc = (...a) => { arcs++; arc(...a); }; g.lineTo = (...a) => { lines++; line(...a); };
  FX.draw(g, 'top'); FX.drawTexts(g); const full = g.getImageData(0, 0, 128, 128).data; const fullCalls = arcs + lines;
  g.clearRect(0, 0, 128, 128); arcs = lines = 0;
  const view = { x: 0, y: 0, w: 128, h: 128 }; FX.draw(g, 'top', view); FX.drawTexts(g, view);
  const culled = g.getImageData(0, 0, 128, 128).data;
  check(full.every((v, i) => v === culled[i]), 'culling preserves pixels including boundary particles and crossing spark trails');
  check(arcs + lines < fullCalls, 'offscreen decoration skips Canvas commands');
  FX.update(2); check(FX.parts === parts && FX.texts === texts && !parts.length && !texts.length, 'particle/text cleanup reuses arrays and expires items');
  let cues = 0, draws = 0;
  FX.list.push({ t0: performance.now() - 1, dur: 1000, layer: 'top', cue: () => cues++, draw: () => draws++ });
  FX.update(0); FX.update(0); FX.draw(g, 'top', view);
  check(cues === 1 && draws === 1, 'skill cues and unbounded warning effects still run');
  FX.list = [];
  if (G.renderQuality) {
    const game = document.getElementById('game'), originalMode = SET.get('graphics');
    SET.toggle(true);
    const select = document.querySelector('#setBody select[data-k="graphics"]');
    check(!!select && select.options.length === 3, 'three graphics modes available');
    const choose = mode => { select.value = mode; select.dispatchEvent(new Event('input', { bubbles: true })); };
    choose('high'); const fullWidth = game.width, cssWidth = game.getBoundingClientRect().width;
    choose('smooth');
    check(G.renderQuality.mode() === 'smooth' && game.width < fullWidth, 'settings change render resolution immediately');
    check(game.getBoundingClientRect().width === cssWidth && G.renderQuality.ambient() === false, 'CSS viewport stays fixed while decorative aura is reduced');
    check(JSON.parse(localStorage.getItem('settings')).graphics === 'smooth', 'graphics setting persists');
    const rect = select.getBoundingClientRect();
    check(rect.width > 150 && rect.left >= 0 && rect.right <= innerWidth, 'graphics selector fits viewport');
    FX.view = null; FX.parts.length = 0;
    FX.burst(0, 0, 2000, ['#fff']);
    check(FX.parts.length === 300, 'smooth mode bounds burst allocations');
    FX.parts.push(...Array.from({ length: 40 }, () => part(0, 0, false))); FX.update(0);
    check(FX.parts.length === 300, 'direct particle emitters respect budget');
    FX.parts.length = 0; FX.view = view;
    FX.burst(10000, 10000, 100, ['#fff']);
    check(FX.parts.length === 0, 'distant decoration skips allocation');
    FX.burst(64, 64, 10, ['#fff']);
    check(FX.parts.length === 10, 'visible decoration remains');
    FX.parts.length = 0; FX.texts.length = 0;
    FX.text(64, 64, '12345', '#ffee66', 20); FX.texts[0].life = 300;
    const strokes = renderBench.textCalls;
    FX.drawTexts(g); const first = renderBench.textCalls;
    FX.drawTexts(g);
    check(first > strokes && renderBench.textCalls === first, 'damage numbers reuse raster');
    document.fonts.dispatchEvent(new Event('loadingdone')); FX.drawTexts(g);
    check(renderBench.textCalls > first, 'damage raster refreshes after font loads');
    FX.texts.length = 0; FX.view = null;
    const findPath = PF.find, entities = [...G.ents], clicks = [], mouseMode = SET.get('lolMouse');
    G.ents.clear();
    try {
      SET.set('lolMouse', false);
      PF.find = (...args) => { clicks.push(args.slice(-2)); return []; };
      for (const mode of ['high', 'smooth']) {
        choose(mode);
        const pointerType = G.touch ? 'touch' : 'mouse';
        game.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType, button: 0, clientX: innerWidth * .18, clientY: innerHeight * .7 }));
        dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType, button: 0 }));
      }
      if(clicks.length!==2||JSON.stringify(clicks[0])!==JSON.stringify(clicks[1]))throw Error('Pointer check: '+JSON.stringify({clicks,lolMouse:SET.get('lolMouse'),dead:G.me.dead}));
      check(true, 'pointer maps to same world position in both render resolutions');
    } finally { PF.find = findPath; SET.set('lolMouse', mouseMode); for (const [id, e] of entities) G.ents.set(id, e); G.order = null; }
    choose('auto'); check(G.renderQuality.mode() === 'auto', 'automatic mode selectable');
    SET.set('graphics', originalMode); SET.toggle(false);
  }
  return checks;
}
