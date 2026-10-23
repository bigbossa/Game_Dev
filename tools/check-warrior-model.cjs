// Isolated browser review of real model/equipment rendering; no account or player data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3902',port=process.argv[3]||'9335',out=path.join(__dirname,'../artifacts/warrior-v4');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin+'/warrior-review.html')}`,{method:'PUT'}).then(r=>r.json());
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.on('message',data=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}});
  await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out '+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await send('Runtime.enable');await send('Page.enable');
    let ready=false;for(let i=0;i<120;i++){ready=await run('!!window.reviewReady');if(ready)break;await pause(100);}assert(ready,JSON.stringify(errors));
    const result=await run(`(()=>{
      const hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h;};
      const F={atk:false,dir:2,frame:1},entity=f=>({cls:'warrior',faction:f,lvl:1,wt:0,ar:[0,0,0,0],gg:[0,0,0,0,0],gp:[0,0,0,0,0],wp:0});
      let frames=0,slots=0,weapons=0,levels=0;
      for(const f of ['dharma','adharma']){
        const e=entity(f),base=WarriorLook.body(e,F),h=hash(base);
        if(base!==WarriorLook.body(e,F))throw Error('Unstable cache');
        for(let slot=0;slot<4;slot++){
          const ar=[0,0,0,0];ar[slot]=5;
          if(hash(WarriorLook.body({...e,ar},F))===h)throw Error('Missing equipment slot '+slot);slots++;
        }
        if(hash(WarriorLook.body({...e,ar:[2,3,4,5]},F))===hash(WarriorLook.body({...e,ar:[2,5,4,3]},F)))throw Error('Mixed sets collapse to one outfit');
        if(hash(WarriorLook.body({...e,gg:[5,5,5,5,5],wp:10,gp:[10,10,10,10,10]},F))!==h)throw Error('Grade/enhancement changes base equipment');
        const wh=C.WEAPONS.map(w=>hash(WarriorLook.body({...e,wt:w.tier},F)));
        if(new Set(wh).size!==C.WEAPONS.length)throw Error('Weapon designs duplicated');weapons+=wh.length;
        const lh=[1,15,30,50,60,80,100,130].map(lvl=>hash(WarriorLook.body({...e,lvl},F)));
        if(new Set(lh).size!==8)throw Error('Missing level hair color');levels+=lh.length;
        if(EquipmentAura.state({...e,gg:[0,5,5,5,5]}))throw Error('Unequipped armor creates aura');
        if(EquipmentGlints.points({...e,gg:[0,5,5,5,5]},F,WarriorGear.meta()).length)throw Error('Unequipped armor creates glints');
        if(EquipmentAura.state({...e,ar:[1,1,1,1],gg:[5,5,4,3,2]}).count!==2)throw Error('Mixed grades enlarge top aura');
        if(EquipmentGlints.points({...e,dead:true,ar:[1,1,1,1],gg:[5,5,5,5,5]},F,WarriorGear.meta()).length)throw Error('Dead glints');
        for(const atk of [false,true])for(let frame=0;frame<(atk?3:4);frame++)for(let dir=0;dir<8;dir++){
          const P={atk,frame,dir},c=WarriorLook.body({...e,lvl:130,ar:[2,4,6,7],wt:13},P),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          let opaque=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)opaque++;
          if(opaque<6000)throw Error('Empty frame '+[f,atk,frame,dir]);
          for(let x=0;x<c.width;x++)if(d[x*4+3]||d[((c.height-1)*c.width+x)*4+3])throw Error('Vertical clipping');
          for(let y=0;y<c.height;y++)if(d[(y*c.width)*4+3]||d[(y*c.width+c.width-1)*4+3])throw Error('Horizontal clipping');
          frames++;
        }
        if(hash(WarriorLook.body(e,F))!==h)throw Error('Removing gear fails to restore base');
      }
      for(const [lv,t]of [[14,0],[15,1],[29,1],[30,2],[49,2],[50,3],[59,3],[60,4],[79,4],[80,5],[99,5],[100,6],[129,6],[130,7]])if(ModelTiers.tierOf(lv)!==t)throw Error('Level threshold');
      return {frames,slots,weapons,levels,unequip:true,mixedSlots:true,gradeIndependent:true,levelThresholds:true};
    })()`);
    const isolation=await run(`(async()=>{
      const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data,load=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
      let changed=0,skin=0,slots=0,effects=0;
      for(const faction of ['dharma','adharma']){
        const F={atk:false,dir:2,frame:1},e={cls:'warrior',faction,lvl:1,wt:0,ar:[0,0,0,0],gg:[0,0,0,0,0],gp:[0,0,0,0,0],wp:0};
        const base=pixels(WarriorLook.body(e,F)),c=Object.assign(document.createElement('canvas'),{width:320,height:280}),g=c.getContext('2d');
        g.drawImage(await load('assets/warrior-v4/'+faction+'-walk-gear.png'),0,280,320,280,0,0,320,280);const mask=pixels(c);
        for(let slot=0;slot<4;slot++){
          const ar=[0,0,0,0];ar[slot]=7;const next=pixels(WarriorLook.body({...e,ar},F));let n=0;
          for(let k=0;k<base.length;k+=4)if(base[k]!==next[k]||base[k+1]!==next[k+1]||base[k+2]!==next[k+2]||base[k+3]!==next[k+3]){if(Math.round(mask[k]/30)!==slot+1)throw Error('Slot recolors other equipment '+slot);n++;}
          if(n<20)throw Error('Slot has no meaningful surface');slots++;
        }
        const top=pixels(WarriorLook.body({...e,lvl:130},F)),a=WarriorGear.anchor(e,F);
        for(let y=a.headTop+40;y<a.headTop+100;y++)for(let x=a.head.x0;x<a.head.x1;x++){
          const k=(y*320+x)*4,[r,gr,b]=base.slice(k,k+3);
          if(base[k+3]>220&&r>170&&gr>110&&b>80&&r>gr*1.06&&gr>b*1.04&&Math.round(mask[k]/30)===0){skin++;if(r!==top[k]||gr!==top[k+1]||b!==top[k+2])changed++;}
        }
        const render=(changes,opts={})=>{const z=Object.assign(document.createElement('canvas'),{width:480,height:420});WarriorLook.draw(z.getContext('2d'),{...e,...changes},F,240,310,1,1234,opts);return z.toDataURL();};
        const plain=render({});if(render({wp:1})===plain)throw Error('Enhancement +1 invisible');
        const grades=[0,1,2,3,4,5].map(n=>render({gg:[n,0,0,0,0]}));if(new Set(grades).size!==6)throw Error('Missing rarity effect');
        if(render({wp:10,gg:[5,0,0,0,0]},{noGlow:true})!==render({},{noGlow:true}))throw Error('Ghost leaks equipment effects');
        if(render({dead:true,wp:10,gg:[5,0,0,0,0]})!==render({dead:true}))throw Error('Dead model leaks effects');
        effects+=8;
      }
      if(changed||skin<100)throw Error('Face damaged '+changed+'/'+skin);
      return {isolatedSlots:slots,protectedSkinPixels:skin,skinChanges:changed,effectChecks:effects};
    })()`);
    Object.assign(result,isolation);fs.mkdirSync(out,{recursive:true});
    for(const kind of ['levels','equipment','directions']){
      const png=await run(`(()=>{
        const kind=${JSON.stringify(kind)},c=Object.assign(document.createElement('canvas'),{width:1600,height:kind==='directions'?1320:660}),g=c.getContext('2d');g.fillStyle='#182534';g.fillRect(0,0,c.width,c.height);
        const n=kind==='equipment'?7:8;
        for(let f=0;f<2;f++)for(let i=0;i<n;i++){
          const e={cls:'warrior',faction:f?'adharma':'dharma',lvl:kind==='levels'?[1,15,30,50,60,80,100,130][i]:1,ar:kind==='equipment'?Array(4).fill(i+1):[0,0,0,0],wt:kind==='equipment'?i*2:0,gg:[0,0,0,0,0],gp:[0,0,0,0,0],wp:0};
          const x=100+i*200,y=f*330+280;
          WarriorLook.draw(g,e,{atk:false,dir:kind==='directions'?i:2,frame:1},x,y,kind==='levels'?.65:.9,1234);
          g.fillStyle='#e8c789';g.font='16px sans-serif';g.fillText(e.faction+' '+(kind==='levels'?'Lv.'+e.lvl:kind==='equipment'?'Set '+(i+1):'Dir '+i),x-70,y+32);
          if(kind==='directions')WarriorLook.draw(g,e,{atk:true,dir:i,frame:1},x,f*330+900,.65,1234);
        }return c.toDataURL().split(',')[1];
      })()`);fs.writeFileSync(path.join(out,kind+'.png'),Buffer.from(png,'base64'));
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1050,deviceScaleFactor:1,mobile:false});
    fs.writeFileSync(path.join(out,'review.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    assert.equal(errors.length,0,JSON.stringify(errors));fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({...result,browserErrors:errors},null,2));console.log(result);
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
