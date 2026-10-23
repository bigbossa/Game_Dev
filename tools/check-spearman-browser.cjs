// Real renderer/controls, disconnected local entities; never writes player accounts.
// SpearmanFX/skill choreography checks cover the nine sk.spear attacks.
// Lv.120/130 rituals use the separate ascended-skills renderer and its checks.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), WebSocket=require('ws');
const origin = process.argv[2] || 'http://127.0.0.1:3903';
const port = process.argv[3] || '9351';
const pause = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const page = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' }).then(r=>r.json());
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(), errors = []; let seq = 0;
  ws.onmessage = ({data}) => {
    const m = JSON.parse(data); if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
  };
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try {
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin});
    let ready=false;
    for(let i=0;i<900;i++){ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
    assert(ready,'game boot');
    assert(await run(`(()=>{const b=document.querySelector('[data-c="spearman"]');b.click();return !b.disabled && b.classList.contains('selected') && document.querySelector('.fcard img').src.includes('spearman');})()`),'spearman selectable');
    const result = await run(`(()=>{
      G.socket.disconnect(); G.ents.clear();
      G.cls='spearman'; C.setViewClass('spearman');
      const me={id:'spear-review',kind:'p',cls:'spearman',faction:'dharma',lvl:130,dir:0,
        x:2000,y:2000,tx:2000,ty:2000,name:'ทวน',hp:3668,mhp:3668,wt:0,wp:0,wg:0,ar:[0,0,0,0],gg:[0,0,0,0,0],flash:0};
      G.me=me;G.myId=me.id;G.ents.set(me.id,me);CharacterMotion.reset(me);
      G.skl=C.cleanSkills('spearman',null,130);G.stats={lvl:130,hp:3668,mhp:3668,mp:2194,mmp:2194,aspd:0,atk:651,def:85,crit:5};
      HUD.init(me);
      const target={...me,id:'spear-target',cls:'dualblade',faction:'adharma',x:2080,tx:2080,hp:1e6,mhp:1e6};
      G.ents.set(target.id,target);CharacterMotion.reset(target);
      const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1400;const g=canvas.getContext('2d');
      g.fillStyle='#111924';g.fillRect(0,0,1440,1400);
      const levels=[1,15,30,50,60,80,100,130], hashes={};
      for(const [row,f] of ['dharma','adharma'].entries()){
        hashes[f]=[];
        for(const [col,lvl] of levels.entries()){
          me.faction=f;me.lvl=lvl;
          const c=document.createElement('canvas');c.width=360;c.height=310;
          G.drawPreview(c.getContext('2d'),360,280,1.81,{atk:false,dir:2,frame:3});
          const bytes=c.getContext('2d').getImageData(0,0,360,280).data;
          let hash=2166136261;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619);
          hashes[f].push(hash);
          const px=(col%4)*360,py=(row*2+Math.floor(col/4))*320;
          g.drawImage(c,px,py);
          g.fillStyle='#e2c88f';g.font='15px sans-serif';g.textAlign='center';
          g.fillText(f+' Lv.'+lvl,px+180,py+300);
        }
      }
      me.faction='dharma';me.lvl=130;
      const dispatch=G.socket.listeners('fx')[0];let draws=0;
      for(const sk of C.CLASSES.spearman.skills.filter(sk=>sk.spear)){
        g.drawImage(HUD.icon(sk.id,'dharma'),(Number(sk.key)-1)*150+35,1290,90,90);
        for(const f of ['dharma','adharma'])for(let rank=0;rank<=sk.evo.length;rank++)for(let dir=0;dir<8;dir++){
          me.faction=f;me.dir=dir;me.dead=false;FX.list=[];
          const beats=C.spearSequence(sk,rank);
          dispatch({t:sk.id,id:me.id,tid:target.id,a:dir*Math.PI/4,r:rank,f,n:beats.length,beats,delay:beats[0].at,g:180,dur:beats.at(-1).at+240});
          if(!me.atk || !Number.isFinite(me.atk.dur) || !FX.list.length)throw Error('Missing cast '+sk.id);
          const c=document.createElement('canvas');c.width=320;c.height=320;const cg=c.getContext('2d');
          for(const fx of FX.list)for(const p of [0,.01,.1,.5,.9,1]){fx.draw(cg,p,fx);draws++;}
          G.drawPreview(cg,320,320,dir*.9+.35);
          if(cg.getTransform().a!==1)throw Error('Canvas state leaked');
          for(const b of beats){const at=me.atk.t0+b.at,F=SpearmanLook.frame(me,at),P=SpearmanLook.pose(me,at,{dx:0,dy:0,lift:0});if(!F.atk||F.frame!==1||![P.dx,P.dy,P.lift].every(Number.isFinite))throw Error('Body missed authoritative impact');}
          const b=beats.at(-1);dispatch({t:'spearBeat',skill:sk.id,id:me.id,tid:target.id,x:target.x,y:target.y,cx:target.x,cy:target.y,a:0,step:beats.length-1,final:true,area:b.area});
          for(const fx of FX.list)if(fx.layer==='ground')fx.draw(cg,.5,fx);
          dispatch({t:'spearCancel',skill:sk.id,id:me.id});if(me.atk||FX.list.some(x=>x.owner===me.id&&x.skill===sk.id))throw Error('Interrupted combo effects remain');
        }
      }
      const emits=[];G.socket.emit=(ev,data)=>emits.push({ev,data});G.cls='spearman';
      for(const sk of C.CLASSES.spearman.skills.filter(sk=>sk.spear)){HUD.cds={};G.useSlot(sk.id,{a:0,tid:target.id,tx:target.x,ty:target.y});}
      if(emits.filter(e=>e.ev==='skill').length!==9)throw Error('All 9 skills must dispatch');
      const icon=ItemArt.iconCanvas(C.WEAPONS[0].id,'dharma');
      if(!icon.getContext('2d').getImageData(0,0,icon.width,icon.height).data.some((v,i)=>i%4===3&&v))throw Error('Missing weapon icon');
      window.spearReviewCanvas=canvas;
      return {hashes,draws,emits:emits.length,portrait:document.getElementById('pfImg').src};
    })()`);
    for(const hashes of Object.values(result.hashes))assert.equal(new Set(hashes).size,8,'each level milestone changes the model');
    assert(result.portrait.includes('spearman'));
    const png=await run('spearReviewCanvas.toDataURL()');
    fs.writeFileSync(path.join(__dirname,'../artifacts/spearman-progression.png'),Buffer.from(png.split(',')[1],'base64'));
    const visual=await run('('+visualChecks.toString()+')()');
    for(const [name,png] of Object.entries(visual.images))fs.writeFileSync(path.join(__dirname,'../artifacts/'+name+'.png'),Buffer.from(png.split(',')[1],'base64'));
    console.log('PASS:',visual.checks);
    if(process.argv.includes('--video')){
      const video=await run('('+recordChoreography.toString()+')()');
      fs.writeFileSync(path.join(__dirname,'../artifacts/spearman-animation.webm'),Buffer.from(video.split(',')[1],'base64'));
      console.log('Saved artifacts/spearman-animation.webm (actual preview renderer + timed effects).');
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
    console.log('PASS: browser assets, selection, 16 level looks, both factions/8 directions/all skill ranks, 9 cast controls, icons, and '+result.draws+' effect draws.');
  } finally { await send('Page.close').catch(()=>{});ws.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

function visualChecks(){
  const me=G.me,target=G.ents.get('spear-target'),images={},checks=[];
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h;};
  const require=(b,m)=>{if(!b)throw Error(m);};
  const sample=(ar,wt,gg=[0,0,0,0,0],atk=false)=>{
    const c=make(320,280),v=ArmorLook.sheet(me.faction,atk,ar,0,gg,'spearman',wt);
    c.getContext('2d').drawImage(v.sheet,0,(atk?1:3)*280,320,280,0,0,320,280);return {c,v,h:hash(c)};
  };
  const gear=make(1600,640),gg=gear.getContext('2d');gg.fillStyle='#111924';gg.fillRect(0,0,gear.width,gear.height);
  for(const [row,f] of ['dharma','adharma'].entries()){
    me.faction=f;me.lvl=1;me.atk=null;
    const base=sample([0,0,0,0],0).h;
    for(let slot=0;slot<4;slot++){
      const seen=new Set([base]);
      for(let tier=1;tier<=7;tier++){const ar=[0,0,0,0];ar[slot]=tier;seen.add(sample(ar,0).h);}
      require(seen.size===8,f+' equipment slot '+slot+' must change for every set');
    }
    require(sample([0,0,0,0],0).h===base,'unequipping restores original');
    const weapons=new Set();for(let wt=0;wt<=10;wt++)weapons.add(sample([0,0,0,0],wt).h);
    require(weapons.size===11,'all weapon tiers must change shape');
    const glow=sample([7,7,7,7],10,[5,5,5,5,5]);require(glow.v.rim&&glow.v.lightTop===5,'equipment grade outline');
    // equipment-aura.md: even Mythic light may not cover opaque face/clothing pixels.
    for(const atk of [false,true]){
      const look=sample([7,7,7,7],10,[5,5,5,5,5],atk).v,R=look.rimMeta;
      const body=look.sheet.getContext('2d').getImageData(0,0,look.sheet.width,look.sheet.height).data;
      const rim=look.rim.getContext('2d').getImageData(0,0,look.rim.width,look.rim.height).data;
      for(let row=0;row<(atk?3:4);row++)for(let col=0;col<8;col++)for(let y=0;y<280;y++)for(let x=0;x<320;x++){
        const ba=body[((row*280+y)*look.sheet.width+col*320+x)*4+3];
        const ra=rim[((row*R.fh+y+R.pad)*look.rim.width+col*R.fw+x+R.pad)*4+3];
        require(ba!==255||ra===0,'grade glow overlaps model');
      }
    }
    const plain=sample([0,0,0,0],0).c,clothed=sample([7,7,7,7],10).c;
    const A=SpearmanLook.anchor(f,false,3,0),face=[Math.round(A.headX-A.bodyHeight*.10),Math.round(A.headTop+A.bodyHeight*.42),Math.round(A.bodyHeight*.20),Math.round(A.bodyHeight*.11)];
    const pface=plain.getContext('2d').getImageData(...face).data,cface=clothed.getContext('2d').getImageData(...face).data;
    require(pface.every((v,i)=>v===cface[i]),'equipment must preserve the face');
    for(let tier=0;tier<=7;tier++){
      me.ar=[tier,tier,tier,tier];me.wt=tier?Math.min(10,tier+3):0;me.wp=0;me.gg=[0,0,0,0,0];
      const c=make(200,280);G.drawPreview(c.getContext('2d'),200,280,1.81,{atk:false,dir:2,frame:3});gg.drawImage(c,tier*200,row*320);
      gg.fillStyle='#d8c694';gg.font='14px sans-serif';gg.textAlign='center';gg.fillText(f+' set '+tier,tier*200+100,row*320+305);
    }
    // Held spear anchors follow all 8 directional attack frames, including mirrored poses.
    for(let dir=0;dir<8;dir++)for(const atk of [false,true]){
      const line=SpearmanLook.weaponLine(me,{atk,frame:atk?1:3,dir});
      require(line.length===2&&line.flat().every(Number.isFinite),'weapon attachment landmarks');
    }
  }
  checks.push('56 armour changes, 22 weapon looks, unequip, face protection, 112 aura frames without opaque overlap, 32 weapon anchors');
  images['spearman-equipment']=gear.toDataURL();
  me.ar=[0,0,0,0];me.wt=0;me.wp=0;me.gg=[0,0,0,0,0];
  const motion=make(1600,960),mg=motion.getContext('2d');mg.fillStyle='#111924';mg.fillRect(0,0,motion.width,motion.height);
  for(let row=0;row<4;row++)for(let dir=0;dir<8;dir++){
    me.faction=row<2?'dharma':'adharma';me.lvl=1;
    const c=make(200,220);G.drawPreview(c.getContext('2d'),200,220,0,{atk:row%2===1,dir,frame:row%2===1?1:3});mg.drawImage(c,dir*200,row*240);
    mg.fillStyle='#d8c694';mg.font='12px sans-serif';mg.fillText(me.faction+' '+(row%2?'thrust':'idle')+' '+dir,dir*200+10,row*240+233);
  }
  images['spearman-poses']=motion.toDataURL();
  const sk=C.CLASSES.spearman.skills[2],beats=C.spearSequence(sk);me.atk={t0:1000,dur:beats.at(-1).at+240,kind:sk.id,beats,hits:beats.length,dir:0,a:0};
  for(const b of beats)require(SpearmanLook.frame(me,1000+b.at).frame===1,'each combo hit thrusts');
  require(!SpearmanLook.frame(me,2400).atk,'attack returns to idle');me.atk=null;
  const choreography=make(1600,2250),ch=choreography.getContext('2d'),gestures=new Set();ch.fillStyle='#111924';ch.fillRect(0,0,1600,2250);
  me.faction='dharma';me.lvl=30;
  for(const [row,sk] of C.CLASSES.spearman.skills.filter(sk=>sk.spear).entries()){
    const beats=C.spearSequence(sk),wind=beats[0].at,hits=beats.length,gap=180,last=beats.at(-1).at;
    me.atk={t0:1000,kind:sk.id,beats,delay:wind,hits,gap,dur:last+240,dir:0,a:0};
    const signature=[];
    for(const [col,elapsed] of [0,wind*.5,wind,last+80,last+179].entries()){
      const F=SpearmanLook.frame(me,1000+elapsed),P=SpearmanLook.pose(me,1000+elapsed,{dx:0,dy:0,lift:0});
      signature.push([F.dir,F.frame,Math.round(P.dx),Math.round(P.dy),Math.round(P.lift)]);
      const c=make(320,220);G.drawPreview(c.getContext('2d'),320,220,elapsed/1000,F,P);ch.drawImage(c,col*320,row*250);
      ch.fillStyle='#dac797';ch.font='12px sans-serif';ch.fillText(sk.key+' '+sk.name+' '+Math.round(elapsed)+' ms',col*320+12,row*250+242);
    }
    gestures.add(JSON.stringify(signature));
  }
  require(gestures.size===9,'nine distinct body choreographies');me.atk=null;images['spearman-choreography']=choreography.toDataURL();
  const effect=(id,lvl,f)=>{
    me.faction=f;me.lvl=lvl;me.x=90;me.y=190;target.x=250;target.y=190;FX.list=[];
    const sk=C.ALL_SKILLS[id],now=performance.now(),last=C.spearSequence(sk).at(-1).at;
    SpearmanFX.play({t:id,id:me.id,tid:target.id,f,r:0,n:1,delay:sk.spear.windup,g:260});
    const c=make(380,320),g=c.getContext('2d');
    for(const layer of ['ground','top'])for(const fx of FX.list)if(fx.layer===layer){const p=(now+last+120-fx.t0)/fx.dur;if(p>=0&&p<=1)fx.draw(g,p,fx);}
    require(g.getTransform().a===1&&g.globalAlpha===1&&g.globalCompositeOperation==='source-over','effect restores canvas state');
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let area=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>10)area++;
    return {c,h:hash(c),area};
  };
  const arts=make(2280,1020),ag=arts.getContext('2d');ag.fillStyle='#111924';ag.fillRect(0,0,arts.width,arts.height);
  for(const [fi,f] of ['dharma','adharma'].entries()){
    const shapes=new Set();
    for(const [i,sk] of C.CLASSES.spearman.skills.filter(sk=>sk.spear).entries()){
      const low=effect(sk.id,1,f),high=effect(sk.id,130,f);shapes.add(high.h);
      require(high.area>low.area*1.2,'high LV effect is more elaborate: '+f+' '+sk.id);
      const x=(i%3)*760+fi*380,y=Math.floor(i/3)*340;ag.drawImage(high.c,x,y);
      ag.fillStyle='#d8c694';ag.font='14px sans-serif';ag.fillText(sk.key+' '+sk.name+' / '+f+' Lv.130',x+15,y+330);
    }require(shapes.size===9,'nine distinct skill motifs');
  }
  images['spearman-skills']=arts.toDataURL();
  const levels=make(1520,680),lg=levels.getContext('2d');lg.fillStyle='#111924';lg.fillRect(0,0,levels.width,levels.height);
  for(const [row,f] of ['dharma','adharma'].entries())for(const [col,lvl] of [1,30,70,130].entries()){
    const art=effect(C.CLASSES.spearman.skills[0].id,lvl,f);lg.drawImage(art.c,col*380,row*340);
    lg.fillStyle='#d8c694';lg.font='14px sans-serif';lg.fillText(f+' Lv.'+lvl,col*380+15,row*340+330);
  }
  images['spearman-skill-levels']=levels.toDataURL();
  for(let i=0;i<70;i++)SpearmanFX.play({t:C.CLASSES.spearman.skills[8].id,id:me.id,tid:target.id,n:3,r:4});
  require(FX.list.filter(e=>e.skillArt).length<=180,'bounded concurrent effects');
  checks.push('9 distinct effects in both factions; Lv.130 coverage > Lv.1; combo timing; 180 effect cap');
  return {images,checks};
}

async function recordChoreography(){
  const canvas=Object.assign(document.createElement('canvas'),{width:1800,height:960}),g=canvas.getContext('2d');
  const cell=Object.assign(document.createElement('canvas'),{width:600,height:320}),cg=cell.getContext('2d');
  const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const stopped=new Promise(resolve=>recorder.onstop=resolve);
  const actors=C.CLASSES.spearman.skills.filter(sk=>sk.spear).map((sk,i)=>{
    const e={...G.me,id:'record-spear-'+i,faction:i%2?'adharma':'dharma',lvl:130,dir:0,x:150,y:260,tx:150,ty:260,atk:null,ar:[6,6,6,6],wt:8,wp:0,gg:[0,0,0,0,0]};
    const t={...e,id:'record-target-'+i,x:270,y:260};G.ents.set(e.id,e);G.ents.set(t.id,t);return {sk,e,t,fx:[],cycle:-1,impacts:new Set()};
  });
  recorder.start();const start=performance.now();
  await new Promise((resolve,reject)=>{
    function tick(){
      try{
      const now=performance.now(),elapsed=now-start,cycle=Math.floor(elapsed/2200);
      g.fillStyle='#101b29';g.fillRect(0,0,1800,960);
      actors.forEach(({sk,e,t,fx,cycle:lastCycle},i)=>{
        if(lastCycle!==cycle){
          const beats=C.spearSequence(sk),wind=beats[0].at,hits=beats.length,gap=260;
          e.atk={t0:now,dur:beats.at(-1).at+240,kind:sk.id,dir:0,a:0,beats,delay:wind,gap,hits};
          FX.list=[];SpearmanFX.play({t:sk.id,id:e.id,tid:t.id,f:e.faction,n:hits,beats,g:gap,delay:wind});actors[i].fx=fx=FX.list.slice();actors[i].cycle=cycle;actors[i].impacts.clear();
        }
        for(const [step,b]of (e.atk?.beats||[]).entries())if(now-e.atk.t0>=b.at&&!actors[i].impacts.has(step)){
          FX.list=[];SpearmanFX.impact({id:e.id,tid:t.id,skill:sk.id,step,final:step===e.atk.beats.length-1,x:t.x,y:t.y,cx:b.area?.shape==='cone'?e.x:t.x,cy:t.y,a:0,area:b.area});fx.push(...FX.list);actors[i].impacts.add(step);
        }
        G.me=e;cg.clearRect(0,0,600,320);
        for(const art of fx)if(art.layer==='ground'){const p=(now-art.t0)/art.dur;if(p>=0&&p<1)art.draw(cg,p,art);}
        const F=SpearmanLook.frame(e,now),P=SpearmanLook.pose(e,now,{dx:0,dy:0,lift:0});G.drawPreview(cg,300,276,now/1000,F,P);
        cg.fillStyle='#778393';cg.beginPath();cg.ellipse(t.x,t.y,19,7,0,0,Math.PI*2);cg.fill();
        cg.strokeStyle='#8a99aa';cg.lineWidth=2;cg.strokeRect(t.x-14,t.y-45,28,42);
        for(const art of fx)if(art.layer==='top'){const p=(now-art.t0)/art.dur;if(p>=0&&p<1)art.draw(cg,p,art);}
        cg.fillStyle='#eddbac';cg.font='16px sans-serif';cg.fillText(sk.key+' '+sk.name+' · '+e.faction+' Lv.130',20,307);
        g.drawImage(cell,(i%3)*600,Math.floor(i/3)*320);
      });
      if(elapsed>=6500)resolve();else requestAnimationFrame(tick);
      }catch(error){recorder.stop();stream.getTracks().forEach(t=>t.stop());reject(error);}
    }tick();
  });
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
  return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
}
