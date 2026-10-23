// Dedicated local CDP browser; never logs in or modifies a saved character.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
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
    await send('Page.navigate', { url: origin });
    let ready = false;
    for (let i = 0; i < 180; i++) {
      ready = await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if (ready) break; await pause(100);
    }
    assert(ready);
    const result = await run(`(async () => {
      G.socket.disconnect(); G.ents.clear();
      const metadata = {};
      for (const [cls, file] of [['dualblade','sprites'],['archer','archer'],['taoist','taoist']])
        metadata[cls] = await fetch('assets/' + file + '.json').then(r => r.json());
      const make = (w,h) => Object.assign(document.createElement('canvas'), {width:w,height:h});
      const gallery = make(1200,1440), g = gallery.getContext('2d');
      g.fillStyle = '#263342'; g.fillRect(0,0,gallery.width,gallery.height);
      const poses = make(1440,1320), pg = poses.getContext('2d');
      pg.fillStyle = '#263342'; pg.fillRect(0,0,poses.width,poses.height);
      let frames = 0, maxPoints = 0, warmReads = 0, singleSlotChecks = 0;
      const outside = [], empty = [], times = [];
      for (const [ci, cls] of ['dualblade','taoist','archer'].entries()) for (const [fi, faction] of ['dharma','adharma'].entries()) {
        const row = ci * 2 + fi;
        const e = {cls,faction,lvl:130,x:0,y:0,wt:10,wg:5,wp:0,ar:[7,7,7,7],gg:[5,5,5,5,5],gp:[0,0,0,0,0]};
        G.me = e;
        for (let grade=0;grade<=5;grade++) {
          e.gg = Array(5).fill(grade);
          g.save(); g.translate(grade*200,row*240); G.drawPreview(g,200,208,1.95); g.restore();
          g.fillStyle = EquipmentGlints.color(grade, faction) || '#e1e1e1';
          g.font = '14px sans-serif'; g.textAlign = 'center';
          g.fillText(cls+' / '+C.GRADES[grade].name,grade*200+100,row*240+230);
        }
        e.gg = [1,5,2,3,4]; // Only the body is Mythic in this mixed set.
        for (const atk of [false,true]) {
          let m = cls==='dualblade' ? (atk?metadata[cls].attack:metadata[cls]) : metadata[cls][atk?'attack':'walk'][faction];
          // TaoistPose.prepare expands and normalizes the cast atlas at boot.
          if(cls==='taoist' && atk)m={...m,frameWidth:256,frameHeight:240,anchorX:128,anchorY:238};
          const key = ModelTiers.key(faction,atk,cls), I = ModelTiers.info(key);
          const tier = cls==='dualblade'?DualbladeLook.stageOf(e.lvl):ModelTiers.tierOf(e.lvl);
          const look = ArmorLook.sheet(faction,atk,e.ar,tier,e.gg,cls,e.wt);
          const bg = make(look.sheet.width,look.sheet.height).getContext('2d');
          bg.drawImage(look.sheet,0,0);
          const pixels = bg.getImageData(0,0,bg.canvas.width,bg.canvas.height).data;
          for (let frame=0;frame<I.frames.length/8;frame++) for(let dir=0;dir<8;dir++) {
            const F={atk,frame,dir}, begin=performance.now(), points=EquipmentGlints.points(e,F,m);
            times.push(performance.now()-begin); frames++; maxPoints=Math.max(maxPoints,points.length);
            if(!points.length) empty.push({cls,faction,...F});
            if(points.length>10)throw Error('Unbounded light count');
            for(const p of points) {
              if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid attachment');
              if(p.grade!==e.gg[p.slot])throw Error('Mixed gear inherited another slot rarity');
              if(p.color!==EquipmentGlints.color(p.grade,faction))throw Error('Wrong faction/grade light');
              if(p.slot) {
                const x=Math.round(p.x+m.anchorX), y=Math.round(p.y+m.anchorY);
                const a=pixels[((frame*m.frameHeight+y)*bg.canvas.width+C.DIR_COL[dir]*m.frameWidth+x)*4+3];
                if(!(a>24))outside.push({cls,faction,...F,slot:p.slot,x,y,a});
              }
            }
            // Repeated draw must not rebuild/read a sprite or allocate particle emitters.
            const native=CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData=function(...args){warmReads++;return native.apply(this,args);};
            try {
              const temp=make(260,240).getContext('2d');
              EquipmentGlints.draw(temp,e,F,m,130,230,1,0);
              EquipmentGlints.draw(temp,e,F,m,130,230,1,1.5);
            } finally {CanvasRenderingContext2D.prototype.getImageData=native;}
            // Every slot must disappear independently on unequip/downgrade.
            for(let slot=0;slot<5;slot++) {
              const isolated={...e,gg:Array(5).fill(0)};isolated.gg[slot]=5;
              const one=EquipmentGlints.points(isolated,F,m);
              if(one.some(p=>p.slot!==slot||p.color!==EquipmentGlints.color(5,faction)))throw Error('Wrong isolated item');
              if(slot) {
                isolated.ar=e.ar.slice();isolated.ar[slot-1]=0;
                if(EquipmentGlints.points(isolated,F,m).length)throw Error('Unequipped item has lights');
              }
              singleSlotChecks++;
            }
            if(dir===2 && frame===1) {
              const cell=atk?3:0, sx=C.DIR_COL[dir]*m.frameWidth, sy=frame*m.frameHeight;
              const x=cell*240+120,y=row*220+200,s=.98;
              pg.drawImage(look.sheet,sx,sy,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
              EquipmentGlints.draw(pg,e,F,m,x,y,s,.7);
              pg.fillStyle='#fff';pg.font='13px sans-serif';pg.textAlign='center';pg.fillText(cls+' / '+faction+' / '+(atk?'attack':'walk'),x,row*220+216);
              // High magnification makes cloth attachment errors visible.
              pg.save();pg.beginPath();pg.rect((cell+1)*240,row*220,480,200);pg.clip();
              const bx=(cell+2)*240,by=row*220+290,bs=2.4;
              pg.drawImage(look.sheet,sx,sy,m.frameWidth,m.frameHeight,bx-m.anchorX*bs,by-m.anchorY*bs,m.frameWidth*bs,m.frameHeight*bs);
              EquipmentGlints.draw(pg,e,F,m,bx,by,bs,.7);pg.restore();
            }
          }
          if(EquipmentGlints.points({...e,gg:[0,0,0,0,0]}, {atk,dir:2,frame:1},m).length)throw Error('Normal gear glows');
          if(EquipmentGlints.points({...e,dead:true}, {atk,dir:2,frame:1},m).length)throw Error('Dead entity glows');
        }
      }
      times.sort((a,b)=>a-b);
      return {frames,maxPoints,warmReads,singleSlotChecks,outside,empty,coldP95ms:times[Math.floor(times.length*.95)],
        gallery:gallery.toDataURL().split(',')[1],poses:poses.toDataURL().split(',')[1]};
    })()`);
    const out = path.join(__dirname, '..', 'artifacts');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'equipment-glints-grades.png'), Buffer.from(result.gallery, 'base64'));
    fs.writeFileSync(path.join(out, 'equipment-glints-poses.png'), Buffer.from(result.poses, 'base64'));
    delete result.gallery; delete result.poses;
    fs.writeFileSync(path.join(out, 'equipment-glints-check.json'), JSON.stringify({ ...result, errors }, null, 2));
    assert.equal(result.warmReads, 0);
    assert.equal(result.empty.length, 0);
    assert.equal(result.outside.length, 0, JSON.stringify(result.outside));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    console.log(JSON.stringify(result));
  } finally { ws.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
