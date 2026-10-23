// Isolated CDP review; never joins, edits or saves a real player.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), WebSocket = require('ws');
const origin = process.argv[2] || 'http://127.0.0.1:3902';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const pages = await fetch('http://127.0.0.1:9347/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && (p.url === 'about:blank' || p.url.startsWith(origin)));
  assert(page, 'Isolated browser required');
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = [];
  let seq=0;
  ws.onmessage=({data})=>{
    const m=JSON.parse(data);
    if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if(m.id) {const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
  };
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  try {
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin});
    let ready=false;
    for(let n=0;n<300;n++) {
      ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");
      if(ready) break;await pause(100);
    }
    assert(ready,JSON.stringify({message:'Game boot',errors,state:await run("({map:!!window.G?.map,loading:document.getElementById('loading')?.textContent})")}));
    const output=path.join(__dirname,'..','artifacts','taoist-v2');
    fs.mkdirSync(output,{recursive:true});
    await run(`(()=>{
      G.socket.disconnect();
      document.getElementById('authStep').classList.add('hidden');
      document.getElementById('createStep').classList.remove('hidden');
      document.querySelector('.cls[data-c="taoist"]').click();
    })()`);
    assert(await run("[...document.querySelectorAll('.fcard img')].every(i=>i.src.includes('taoist-v2'))"),'Character creation uses the new portraits');
    const gallery=await run(`(async()=>{
      const m=await fetch('assets/taoist-v2/taoist.json').then(r=>r.json());
      const c=document.createElement('canvas');c.width=1200;c.height=740;const g=c.getContext('2d');
      g.fillStyle='#111b28';g.fillRect(0,0,c.width,c.height);
      g.fillStyle='#eed9aa';g.font='600 28px Kanit, sans-serif';g.fillText('นักพรต · ธรรมะ / อธรรม',36,48);
      const poses=[['หน้า',false,0,1],['ข้าง',false,2,1],['หลัง',false,4,1],['ร่ายแส้',true,0,1],['ปล่อยยันต์',true,0,2]];
      for(const [fi,faction]of ['dharma','adharma'].entries()){
        const y=80+fi*320;g.fillStyle=fi?'#ed8390':'#8dd6e5';g.font='20px Kanit, sans-serif';g.fillText(fi?'อธรรม · ดำ / แดง / ทอง':'ธรรมะ · ขาว / ฟ้า / ทอง',36,y+24);
        poses.forEach(([label,atk,col,row],i)=>{
          const meta=m[atk?'attack':'walk'][faction],sheet=ArmorLook.sheet(faction,atk,[0,0,0,0],0,[0,0,0,0,0],'taoist',0).sheet;
          const s=1.15,x=120+i*236,foot=y+250;
          g.drawImage(sheet,col*meta.frameWidth,row*meta.frameHeight,meta.frameWidth,meta.frameHeight,x-meta.anchorX*s,foot-meta.anchorY*s,meta.frameWidth*s,meta.frameHeight*s);
          g.fillStyle='#c5d0de';g.font='16px Kanit, sans-serif';g.textAlign='center';g.fillText(label,x,y+282);g.textAlign='left';
        });
      }
      return c.toDataURL().split(',')[1];
    })()`);
    fs.writeFileSync(path.join(output,'taoist-v2-preview.png'),Buffer.from(gallery,'base64'));
    const result=await run(`(async()=>{
      G.socket.disconnect();
      window.reviewMeta=await fetch('assets/taoist-v2/taoist.json').then(r=>r.json());
      for(const faction of ['dharma','adharma']){
        const m=reviewMeta.attack[faction],key='tao-attack-'+faction,I=ModelTiers.info(key);
        const a=TaoistPose.point(key,0,0,m.anchorX,m.anchorY);
        Object.assign(m,{frameWidth:I.fw,frameHeight:I.fh,anchorX:a[0],anchorY:a[1]});
      }
      const c=document.createElement('canvas');c.width=1540;c.height=1200;
      const g=c.getContext('2d');g.fillStyle='#d6e1df';g.fillRect(0,0,c.width,c.height);
      const label=(text,x,y)=>{g.fillStyle='#233f46';g.font='16px sans-serif';g.textAlign='center';g.fillText(text,x,y);};
      const draw=(sheet,m,col,row,x,y,s=1)=>g.drawImage(sheet,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,x,y,m.frameWidth*s,m.frameHeight*s);
      const weaponHashes=[],armourHashes=[];
      for(const [fi,faction] of ['dharma','adharma'].entries()) {
        const m=reviewMeta.walk[faction];
        for(let t=1;t<=7;t++) {
          const look=ArmorLook.sheet(faction,false,[t,t,t,t],0,[0,0,0,0,0],'taoist',0);
          draw(look.sheet,m,0,1,(t-1)*220+18,fi*250+25,1.05);
          label(faction+' / armour Lv.'+C.ARMOR_SETS[t-1].lvl,(t-1)*220+110,fi*250+278);
          armourHashes.push(look.sheet.toDataURL().slice(-180));
        }
        for(let t=0;t<=10;t++) {
          const look=ArmorLook.sheet(faction,false,[0,0,0,0],0,[0,0,0,0,0],'taoist',t);
          draw(look.sheet,m,0,1,t*140-3,520+fi*240,.82);
          label('weapon '+t,t*140+70,520+fi*240+212);
          weaponHashes.push(look.sheet instanceof HTMLCanvasElement?look.sheet.toDataURL().slice(-180):'base');
        }
      }
      return {image:c.toDataURL().split(',')[1],weaponHashes,armourHashes};
    })()`);
    for(let f=0;f<2;f++) {
      assert.equal(new Set(result.weaponHashes.slice(f*11,f*11+11)).size,11,'Weapon tiers must have distinct art');
      assert.equal(new Set(result.armourHashes.slice(f*7,f*7+7)).size,7,'Armour tiers must have distinct art');
    }
    fs.writeFileSync(path.join(output,'taoist-equipment.png'),Buffer.from(result.image,'base64'));
    const poses=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=1920;
      const g=c.getContext('2d');g.fillStyle='#d6e1df';g.fillRect(0,0,c.width,c.height);
      let count=0;
      for(const [fi,faction] of ['dharma','adharma'].entries()) {
        for(const [pi,atk] of [false,true].entries()) {
          const m=reviewMeta[atk?'attack':'walk'][faction],key=ModelTiers.key(faction,atk,'taoist');
          const look=ArmorLook.sheet(faction,atk,[7,7,7,7],7,[0,0,0,0,0],'taoist',10);
          const I=ModelTiers.info(key);
          for(let row=0;row<3;row++) for(let col=0;col<8;col++) {
            const F=I.frames[row*8+col],a=TaoistGear.attachment(key,F);
            if(!a.every(Number.isFinite)||a[0]<0||a[0]>m.frameWidth||a[1]<0||a[1]>m.frameHeight) throw new Error('Invalid shoulder anchor');
            const yy=(fi*6+pi*3+row)*160+158-m.anchorY*.67,xx=col*200+100-m.anchorX*.67;
            g.drawImage(look.sheet,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,xx,yy,m.frameWidth*.67,m.frameHeight*.67);
            count++;
          }
        }
      }
      return {count,image:c.toDataURL().split(',')[1]};
    })()`);
    assert.equal(poses.count,96);
    fs.writeFileSync(path.join(output,'taoist-poses.png'),Buffer.from(poses.image,'base64'));
    await run(`(()=>{
      document.activeElement?.blur();document.getElementById('login').classList.add('hidden');
      let spawn;
      outer:for(let y=20;y<G.map.h-20;y++)for(let x=20;x<G.map.w-20;x++){
        if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)){spawn={x:x*C.TILE,y:y*C.TILE};break outer;}
      }
      if(!spawn)throw new Error('No corridor');
      const e={kind:'p',id:'tao-local-review',...spawn,tx:spawn.x,ty:spawn.y,dir:2,
        cls:'taoist',faction:'dharma',lvl:130,name:'Taoist Lv.130',hp:100,mhp:100,flash:0,
        wt:10,wp:10,wg:5,ar:[7,7,7,7],gg:[5,5,5,5,5]};
      CharacterMotion.reset(e);G.me=e;G.myId=e.id;G.ents.clear();G.ents.set(e.id,e);G.speed=215;G.stats=null;
      window.reviewRows=[];const old=SpriteDetail.sheet;
      SpriteDetail.sheet=function(...args){reviewRows.push(args[6]);return old.apply(this,args);};
    })()`);
    await pause(1500);
    const idle=await run('reviewRows.splice(0)');
    assert(idle.length>0 && idle.every(row=>row===1),'Idle must use the neutral walk frame');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD'});
    await pause(1100);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD'});
    const walk=await run('reviewRows.splice(0)');
    assert(walk.includes(0)&&walk.includes(2)&&!walk.includes(3),'Walk cycle frames');
    await pause(400);
    await run('reviewRows.length=0');
    await pause(250);
    assert((await run('reviewRows.splice(0)')).every(row=>row===1),'Stop must return to same neutral model');
    await run('G.me.dir=2');
    await pause(300);
    const screen=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(output,'taoist-in-game.png'),Buffer.from(screen.data,'base64'));
    // Warm sheets must not rebuild/read pixels during ordinary motion.
    const cache=await run(`(()=>{
      const e=G.me,old=CanvasRenderingContext2D.prototype.getImageData;
      let reads=0;CanvasRenderingContext2D.prototype.getImageData=function(...a){reads++;return old.apply(this,a);};
      try {
        const a=ArmorLook.sheet(e.faction,false,e.ar,7,e.gg,'taoist',e.wt).sheet;
        for(let n=0;n<100;n++)if(ArmorLook.sheet(e.faction,false,e.ar,7,e.gg,'taoist',e.wt).sheet!==a)throw new Error('Cache miss');
        return {reads};
      }finally{CanvasRenderingContext2D.prototype.getImageData=old;}
    })()`);
    assert.equal(cache.reads,0);
    assert.equal(errors.length,0,JSON.stringify(errors));
    const report={modelVersion:2,creationPortraits:true,weaponVariants:22,armourVariants:14,poses:poses.count,idleFrame:1,walkFrames:[...new Set(walk)],cachedPixelReads:cache.reads,errors};
    fs.writeFileSync(path.join(output,'taoist-check.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
