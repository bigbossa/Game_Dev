// Review actual cached weapon art and the game renderer in an isolated CDP page.
// No login, character creation, inventory writes or saved-player changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.argv[2]||'http://localhost:3901',label=process.argv[3]||'after';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const pages=await fetch('http://127.0.0.1:9334/json/list').then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)));
  assert(page,'Isolated review page required');
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{
    const m=JSON.parse(data);
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
  };
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  try{
    await send('Runtime.enable');await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin});
    let ready=false;
    for(let n=0;n<150;n++){
      ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if(ready)break;await pause(100);
    }
    assert(ready,'Game boot');
    const result=await run(`(()=>{
      G.socket.disconnect();
      G.me={cls:'dualblade',faction:'dharma',lvl:1,wt:0,wp:0,ar:[0,0,0,0],gg:[0,0,0,0,0],x:0,y:0};
      const c=document.createElement('canvas');c.width=1440;c.height=1160;
      const g=c.getContext('2d');g.fillStyle='#293a4c';g.fillRect(0,0,c.width,c.height);
      const a=document.createElement('canvas');a.width=1320;a.height=460;
      const ag=a.getContext('2d');ag.fillStyle='#293a4c';ag.fillRect(0,0,a.width,a.height);
      const hashes=[],edges=[];let poses=0;
      for(const [fi,faction]of ['dharma','adharma'].entries()){
        for(let n=0;n<12;n++){
          const tier=Math.min(n,10),level=n===11?130:C.WEAPONS[tier].lvl;
          let armour=0;C.ARMOR_SETS.forEach((s,i)=>{if(level>=s.lvl)armour=i+1;});
          Object.assign(G.me,{faction,lvl:level,wt:tier,wp:n===11?10:0,ar:[armour,armour,armour,armour],gg:[0,0,0,0,0]});
          const x=(n%6)*240,y=(fi*2+Math.floor(n/6))*290;
          g.save();g.translate(x,y+18);G.drawPreview(g,240,230,1.95);g.restore();
          g.fillStyle='#e9eadb';g.font='16px sans-serif';g.textAlign='center';
          g.fillText(faction+' / Lv.'+level+(n===11?' / +10':''),x+120,y+266);
          if(n<=10){
            const B=ItemArt.blade(tier,faction,1,140),k=140/(B.tipY-B.gy);
            ag.drawImage(B.img,n*120+60-B.gx*k,fi*220+40-B.gy*k,B.img.width*k,B.img.height*k);
            ag.fillStyle='#e9eadb';ag.font='15px sans-serif';ag.textAlign='center';
            ag.fillText('Lv.'+C.WEAPONS[tier].lvl,n*120+60,fi*220+205);
            hashes.push(B.img.toDataURL());
          }
          for(let dir=0;dir<8;dir++)for(let frame=0;frame<3;frame++)for(const atk of [false,true]){
            WeaponLook.drawBlades(g,G.me,{dir,frame,atk,faction},-500,-500,.46,{noGlow:true});
            poses++;
          }
        }
      }
      // All cached silhouettes must fit, including the heaven guard at large zoom.
      for(const faction of ['dharma','adharma'])for(let tier=0;tier<=10;tier++)for(const side of [0,1]){
        const b=ItemArt.blade(tier,faction,side,192),d=b.img.getContext('2d').getImageData(0,0,b.img.width,b.img.height).data;
        let hits=0;const w=b.img.width,h=b.img.height;
        for(let x=0;x<w;x++)hits+=(d[x*4+3]>100)+(d[((h-1)*w+x)*4+3]>100);
        for(let y=0;y<h;y++)hits+=(d[(y*w)*4+3]>100)+(d[(y*w+w-1)*4+3]>100);
        if(hits)edges.push({faction,tier,side,hits});
      }
      const weaponImages=hashes.map(s=>s.slice(-180));
      return {gallery:c.toDataURL().split(',')[1],blades:a.toDataURL().split(',')[1],weaponImages,poses,edges};
    })()`);
    const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
    for(const [name,value]of [['dualblade-levels',result.gallery],['dualblade-weapons',result.blades]])
      fs.writeFileSync(path.join(out,name+'-'+label+'.png'),Buffer.from(value,'base64'));
    assert.equal(new Set(result.weaponImages.slice(0,11)).size,11);
    assert.equal(new Set(result.weaponImages.slice(11)).size,11);
    if(label!=='before')assert.equal(result.edges.length,0,'Weapon art is cropped at atlas boundaries');
    const cache=await run(`(()=>{
      const b=ItemArt.blade(10,'dharma',1,96),h=ItemArt.halo(10,'dharma',1,96,'#46c2ff');
      for(let i=0;i<100;i++){
        if(ItemArt.blade(10,'dharma',1,96)!==b||ItemArt.halo(10,'dharma',1,96,'#46c2ff')!==h)throw new Error('Cache miss');
      }
      return true;
    })()`);
    const effects=await run(`(()=>{
      const b=ItemArt.blade(10,'dharma',1,96),h=ItemArt.halo(10,'dharma',1,96,'#46c2ff');
      const bd=b.img.getContext('2d').getImageData(0,0,b.img.width,b.img.height).data;
      const hd=h.img.getContext('2d').getImageData(0,0,h.img.width,h.img.height).data;
      let opaque=0,covered=0;
      for(let y=0;y<b.img.height;y++)for(let x=0;x<b.img.width;x++)if(bd[(y*b.img.width+x)*4+3]===255){
        opaque++;if(hd[((y+h.pad)*h.img.width+x+h.pad)*4+3]>1)covered++;
      }
      const e={cls:'dualblade',faction:'dharma',wt:10,wp:10,x:0,y:0};
      const F={atk:false,frame:1,dir:2,faction:'dharma'},oldParts=FX.parts,oldList=FX.list,oldRandom=Math.random;
      const emissions=[];
      try{
        Math.random=()=>.5;
        for(const hz of [30,60,144]){
          FX.parts=[];FX.list=[];e.plusAcc=e.moteAcc=e.auraAcc=0;
          for(let n=0;n<hz;n++){WeaponLook.emit(e,F,0,0,.46,1/hz);WeaponLook.emitPlus(e,F,0,0,.46,1/hz);}
          emissions.push({hz,particles:FX.parts.length,bolts:FX.list.length});
        }
      }finally{FX.parts=oldParts;FX.list=oldList;Math.random=oldRandom;}
      return {opaque,covered,emissions};
    })()`);
    if(label!=='before'){
      assert(effects.opaque>100);
      assert.equal(effects.covered,0,'Halo should not cover opaque metal');
      assert(effects.emissions.every(e=>e.particles<=24&&e.bolts===0),'Idle effect budget');
      const counts=effects.emissions.map(e=>e.particles);
      assert(Math.max(...counts)-Math.min(...counts)<=2,'Frame-rate independent particle count');
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
    const report={variants:22,poses:result.poses,clippedWeapons:result.edges,cacheStable:cache,effects,browserErrors:errors};
    fs.writeFileSync(path.join(out,'dualblade-check-'+label+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
