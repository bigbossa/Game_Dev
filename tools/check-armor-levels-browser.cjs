// Use a dedicated CDP browser and test server; does not log in or change saved characters.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const origin = process.argv[2] || 'http://localhost:3909';
const port = process.argv[3] || '9349';
(async () => {
  const page = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [];
  let seq = 0;
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  try {
    await send('Runtime.enable');
    let ready = false;
    for (let i = 0; i < 250; i++) {
      ready = await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if (ready) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert(ready, 'game loaded');
    const result = await run(`(() => {
      G.socket.disconnect(); G.ents.clear(); GM.init(true);
      const sets = Array.from(document.getElementById('gmSet').options, o => ({ value: o.value, text: o.text }));
      const selected = document.getElementById('gmSet').value;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
      const ctx = canvas.getContext('2d'); let icons = 0, sheets = 0;
      for (const cls of C.CLASS_IDS) for (const faction of ['dharma', 'adharma']) {
        G.cls = cls; C.setViewClass(cls);
        for (const tier of [10, 11, 12, 13]) {
          const lvl = C.ARMOR_SETS[tier - 1].lvl;
          const weapon = C.WEAPONS.filter(w => w.lvl <= lvl).at(-1);
          for (const atk of [false, true]) {
            const sheet = ArmorLook.sheet(faction, atk, [tier, tier, tier, tier], ModelTiers.tierOf(lvl), [5,5,5,5,5], cls, weapon.tier).sheet;
            if (!sheet?.width) throw Error('Missing armour atlas: ' + cls + ' / ' + tier);
            sheets++;
          }
          for (const prefix of ['sh', 'pa', 'br', 'sd']) {
            const icon = ItemArt.iconCanvas(prefix + tier, faction, 64);
            if (!icon.getContext('2d').getImageData(0,0,64,64).data.some((v,i) => i % 4 === 3 && v)) throw Error('Empty icon');
            icons++;
          }
          WeaponLook.plusRings(ctx, { faction, cls, wt: weapon.tier, ar: [tier,tier,tier,tier], gp: [10,10,10,10,10], x:120, y:120 }, 0);
        }
      }
      const hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h;};
      const gallery=document.createElement('canvas');gallery.width=1440;gallery.height=1280;
      const gg=gallery.getContext('2d');gg.fillStyle='#14212c';gg.fillRect(0,0,1440,1280);
      const assets={};let compared=0,weaponFrames=0;
      for(const [ci,cls] of C.CLASS_IDS.entries())for(const [fi,faction] of ['dharma','adharma'].entries()){
        G.cls=cls;C.setViewClass(cls);const x=fi*720,y=ci*320;
        gg.fillStyle='#e8d6ae';gg.font='18px sans-serif';gg.fillText(C.CLASSES[cls].name+' / '+faction,x+16,y+24);
        for(const [wi,id] of ['w10','w13','w11','w12'].entries()){
          const icon=ItemArt.iconCanvas(id,faction,100);gg.drawImage(icon,x+16+wi*112,y+40);
          gg.font='14px sans-serif';gg.fillStyle='#d2dde4';gg.fillText('Lv.'+C.ITEMS[id].lvl,x+46+wi*112,y+158);
          if(id==='w13'){
            assets[cls+'-'+faction+'-weapon-110.png']=ItemArt.iconCanvas(id,faction,256).toDataURL();
            for(const other of ['w10','w11','w12'])if(hash(icon)===hash(ItemArt.iconCanvas(other,faction,100)))throw Error('Weapon art reused '+cls);
          }
        }
        for(const [si,prefix] of ['sh','pa','br','sd'].entries()){
          const old=ItemArt.iconCanvas(prefix+'4',faction,48),fresh=ItemArt.iconCanvas(prefix+'10',faction,48);
          if(hash(old)===hash(fresh))throw Error('Lv.40/50 identical '+cls+' '+prefix);compared++;
          gg.drawImage(old,x+16+si*112,y+190);gg.drawImage(fresh,x+68+si*112,y+190);
          gg.fillText('40 / 50',x+35+si*112,y+258);
          assets[cls+'-'+faction+'-'+prefix+'-50.png']=ItemArt.iconCanvas(prefix+'10',faction,256).toDataURL();
        }
        const e=G.me={id:'design-test',cls,faction,lvl:110,x:0,y:0,dir:2,wt:13,wp:0,ar:[10,10,10,10],gg:[0,0,0,0,0],gp:[0,0,0,0,0]};G.myId=e.id;G.ents.set(e.id,e);
        gg.save();gg.beginPath();gg.rect(x+465,y+30,250,275);gg.clip();gg.translate(x+475,y+30);G.drawPreview(gg,230,260,0,{atk:false,dir:2,frame:1});gg.restore();
        for(const atk of [false,true]){
          const outfit40=ArmorLook.sheet(faction,atk,[4,4,4,4],ModelTiers.tierOf(110),null,cls,13).sheet;
          const outfit50=ArmorLook.sheet(faction,atk,[10,10,10,10],ModelTiers.tierOf(110),null,cls,13).sheet;
          if(hash(outfit40)===hash(outfit50))throw Error('Outfit unchanged '+cls);
          for(let dir=0;dir<8;dir++)for(let frame=0;frame<(atk?3:(cls==='archer'||cls==='spearman'?4:3));frame++){
            ctx.clearRect(0,0,240,240);G.drawPreview(ctx,240,240,0,{atk,dir,frame});weaponFrames++;
          }
          // Mixed Lv.50 + endgame pieces must not paint endgame decorations on the silk slot.
          ArmorLook.sheet(faction,atk,[10,8,9,10],ModelTiers.tierOf(110),null,cls,13);
        }
      }
      return { sets, selected, icons, sheets, compared, weaponFrames, assets, gallery:gallery.toDataURL() };
    })()`);
    assert.deepEqual(result.sets.map(s => Number(s.text.match(/Lv\.(\d+)/)[1])), Array.from({ length: 13 }, (_, i) => (i + 1) * 10));
    assert.equal(result.selected, 'tier:9', 'highest-level set selected');
    assert.equal(new Set(result.sets.map(s => s.value)).size, 13);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    const out=path.join(__dirname,'../public/assets/equipment-designs');fs.mkdirSync(out,{recursive:true});
    for(const [name,data] of Object.entries(result.assets))fs.writeFileSync(path.join(out,name),Buffer.from(data.split(',')[1],'base64'));
    fs.writeFileSync(path.join(__dirname,'../artifacts/equipment-110-designs.png'),Buffer.from(result.gallery.split(',')[1],'base64'));
    console.log(`PASS: GM levels 10–130, ${result.icons} icons, ${result.sheets} atlases, ${result.compared} distinct Lv.40/50 pairs, ${result.weaponFrames} Lv.110 frames; exported ${Object.keys(result.assets).length} PNG assets and design gallery`);
  } finally {
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
