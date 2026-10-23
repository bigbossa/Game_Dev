// Real client dispatch + Canvas/sprite render, disconnected from account state.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),WebSocket=require('ws');
const origin=process.argv[2]||'http://127.0.0.1:3903',port=process.argv[3]||'9351';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),out=path.join(__dirname,'../artifacts');
(async()=>{
  const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`,{method:'PUT'}).then(r=>r.json());
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:origin});
    let ready=false;for(let i=0;i<900;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready,'client boot');
    await run('('+setup.toString()+')()');
    textResult(await run('('+verify.toString()+')()'));
    const png=await run('('+gallery.toString()+')()');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'all-class-skill-stages.png'),Buffer.from(png.split(',')[1],'base64'));
    if(process.argv.includes('--video')){
      const video=await run('('+record.toString()+')()');fs.writeFileSync(path.join(out,'all-class-skill-animation.webm'),Buffer.from(video.split(',')[1],'base64'));
      console.log('Saved actual renderer video: artifacts/all-class-skill-animation.webm');
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
  }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
function textResult(r){assert.equal(r.skills,55);assert(r.crowd<=96);assert.equal(r.expired,0);console.log('PASS all-class performance:',JSON.stringify(r));}
function setup(){
  G.socket.disconnect();G.ents.clear();FX.list=[];
  window.review={dispatch:G.socket.listeners('fx')[0],make:(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h})};
  review.actor=(cls,f='dharma',id='performance-review')=>{
    const e={id,kind:'p',cls,faction:f,lvl:130,x:170,y:220,tx:170,ty:220,dir:0,hp:1e6,mhp:1e6,ar:[3,3,3,3],wt:5,gg:[0,0,0,0,0],wp:0,flash:0};
    G.ents.set(id,e);CharacterMotion.reset(e);G.me=e;G.myId=e.id;return e;
  };
  const t=review.actor('warrior','adharma','performance-target');t.x=280;t.tx=280;
  review.event=(e,sk,r=0,sl=1)=>{
    const d={id:e.id,t:sk.id,f:e.faction,r,sl,a:0,x:280,y:220,tx:280,ty:200,x0:170,y0:220,x1:230,y1:220,tid:t.id,ids:[t.id]};
    if(sk.spear){d.beats=C.spearSequence(sk,r);Object.assign(d,{dur:d.beats.at(-1).at+240,delay:d.beats[0].at,n:d.beats.length,g:180});}
    if(sk.frontline)Object.assign(d,{dur:(sk.frontline.windup||200)+200,radius:sk.frontline.range||90,x:e.x,y:e.y});
    if(sk.ritual)Object.assign(d,{t:'ritualStart',skill:sk.id,cls:e.cls,cast:sk.ritual.cast,radius:sk.ritual.radius});
    if(['mercy','aegis','might','nirvana','hawkeye','gale'].includes(sk.id))Object.assign(d,{ids:[e.id],d:8000});
    if(sk.id==='fang')d.c=r?2:0;
    if(sk.id==='lotus')d.n=r?4:3;
    if(sk.id==='tempest')Object.assign(d,{n:[8,10,12][r],R:[170,200,230][r],g:Math.round(2600/[8,10,12][r])});
    if(sk.id==='crescent')d.R=r?220:190;
    if(sk.id==='thousand')d.n=r?12:8;
    if(['heavens','skyrain'].includes(sk.id))Object.assign(d,{R:[190,230,270][r],n:[7,9,11][r]});
    if(sk.id==='meteor')d.n=r?8:5;
    if(sk.id==='hawkshot')d.n=r?2:1;
    if(sk.id==='scatter')Object.assign(d,{n:r?7:5,L:r?480:420,v:r?2:1});
    if(sk.id==='rollshot')d.n=r?5:3;
    if(sk.id==='deadeye')d.s=r?1:0;
    return d;
  };
  review.cast=(e,sk,r=0,sl=1)=>{e.atk=null;e.ritual=null;e.leap=null;e.dying=0;e.dead=false;e.x=170;e.y=220;e.tx=170;e.ty=220;FX.list=[];const d=review.event(e,sk,r,sl);review.dispatch(d);return {d,nodes:FX.list.slice(),motion:e.skillMotion};};
  review.draw=(g,e,nodes,now)=>{
    g.save();g.translate(40,78);g.scale(.7,.7);
    const draw=layer=>{for(const n of nodes){const p=(now-n.t0)/n.dur;if(n.layer===layer&&p>=0&&p<=1&&n.draw)n.draw(g,p,n);}};
    draw('ground');G.me=e;G.drawPreview(g,340,236,now/1000,G.skillFrame(e,now),G.skillPose(e,now));draw('top');g.restore();
  };
}
function verify(){
  const require=(ok,msg)=>{if(!ok)throw Error(msg);},c=review.make(700,500),g=c.getContext('2d');
  let skills=0,casts=0,draws=0,rituals=0;const classMotion={};
  for(const cls of Object.values(C.CLASSES)){
    classMotion[cls.id]=0;
    for(const sk of cls.skills){skills++;require(SkillPerformance.configs[sk.id],'Unmapped '+sk.id);
      for(const f of ['dharma','adharma'])for(let r=0;r<=(sk.evo?.length||0);r++)for(const sl of [1,6,12]){
        const e=review.actor(cls.id,f),{d,nodes,motion:m}=review.cast(e,sk,r,sl);casts++;
        require(m&&nodes.filter(n=>n.performanceArt).length===2,'Missing skill performance '+sk.id);
        const poses=new Set();
        for(const p of [.12,.34,.57,.84]){
          const now=m.t0+m.dur*p,F=G.skillFrame(e,now),P=G.skillPose(e,now);draws++;
          require([P.dx,P.dy,P.lift,P.roll||0,P.sx||1,P.sy||1].every(Number.isFinite),'Invalid body '+sk.id);
          require(F.dir>=0&&F.dir<8&&F.frame>=0&&F.frame<=3,'Invalid atlas '+sk.id);
          require(F.atk,'Standing instead of casting '+sk.id);
          poses.add(JSON.stringify([F.frame,F.dir,...Object.values(P)]));
          g.clearRect(0,0,c.width,c.height);review.draw(g,e,nodes,now);
          const T=g.getTransform();require(T.a===1&&T.d===1&&T.e===0&&T.f===0&&g.globalAlpha===1&&g.globalCompositeOperation==='source-over','Canvas state leak '+sk.id);
        }
        require(poses.size>=3,'Static choreography '+sk.id);classMotion[cls.id]++;
        require(!SkillPerformance.active(e,m.t0+m.dur+1),'Animation never ends');
        if(sk.ritual){review.dispatch({...d,t:'ritualRelease'});require(e.ritual?.released,'Missing confirmed ritual');review.dispatch({...d,t:'ritualCancel'});rituals++;}
        else if(sk.spear)review.dispatch({...d,t:'spearCancel',skill:sk.id});else SkillPerformance.cancel(e.id);
        require(!e.skillMotion&&!FX.list.some(n=>n.performanceArt&&n.owner===e.id),'Cancel retained cosmetics');
      }
      // Same level/equipment: actual training and evolution independently change detail.
      if(sk.lvl<120){const a=SkillPerformance.profile(sk,{sl:1}),b=SkillPerformance.profile(sk,{sl:12});require(b.detail>a.detail,'Training invisible '+sk.id);
        if(sk.evo?.length)require(SkillPerformance.profile(sk,{sl:1,r:1}).detail>a.detail,'Evolution invisible '+sk.id);}
    }
  }
  // All eight facings, and no cosmetics at a previous location after warping/death.
  for(const cls of Object.values(C.CLASSES))for(let dir=0;dir<8;dir++){
    const e=review.actor(cls.id),sk=cls.skills[0],d=review.event(e,sk,0,12);d.a=dir*Math.PI/4;review.dispatch(d);
    const now=e.skillMotion.t0+80;review.draw(g,e,FX.list,now);draws++;require(G.skillFrame(e,now).dir===dir,'Wrong facing');
    e.dead=true;require(!SkillPerformance.active(e,now),'Dead caster animates');e.dead=false;
    const map=G.mapId;G.mapId='different-map';require(!SkillPerformance.active(e,now),'Warp retained animation');G.mapId=map;
  }
  FX.list=[];
  for(let i=0;i<80;i++){const e=review.actor('warrior','dharma','crowd-'+i);review.dispatch(review.event(e,C.ALL_SKILLS.guardianOath,0,12));}
  const crowd=FX.list.filter(n=>n.performanceArt).length;require(crowd<=96,'Unbounded crowd');
  SkillPerformance.clear();require(![...G.ents.values()].some(e=>e.skillMotion),'Map cleanup');
  FX.list.forEach(n=>n.t0-=30000);FX.update(0);const expired=FX.list.length;
  return {skills,casts,draws,rituals,classMotion,crowd,expired};
}
function gallery(){
  const canvas=review.make(1440,1400),g=canvas.getContext('2d');
  const ids=['crescent','skybolt','scatter','spearHeart','earthShatter'];
  g.fillStyle='#111d29';g.fillRect(0,0,1440,1400);
  for(const [row,cls]of C.CLASS_IDS.entries())for(let col=0;col<3;col++){
    const sk=col===2?C.CLASSES[cls].skills.find(s=>s.lvl===130):C.ALL_SKILLS[ids[row]],e=review.actor(cls,col===1?'adharma':'dharma','gallery-'+row+'-'+col);
    e.lvl=col===0?Math.max(1,sk.lvl):col===1?Math.max(100,sk.evo?.[0]?.lvl||0):130;
    const {nodes,motion:m}=review.cast(e,sk,col===1?1:0,col?12:1);
    const cell=review.make(480,280),cg=cell.getContext('2d'),now=m.t0+m.dur*(sk.ritual?.move==='spiral'?.6:.45);
    review.draw(cg,e,nodes,now);cg.fillStyle='#f2ddb3';cg.font='15px sans-serif';
    cg.fillText(cls+' · '+(col===0?'ขั้นต้น':col===1?'ขั้นวิวัฒนาการ':'วิชา Lv.130'),14,23);
    cg.fillStyle='#bdccda';cg.font='14px sans-serif';cg.fillText(sk.name,14,265);
    g.drawImage(cell,col*480,row*280);
  }return canvas.toDataURL();
}
async function record(){
  const canvas=review.make(1440,1400),g=canvas.getContext('2d'),cell=review.make(480,280),cg=cell.getContext('2d');
  const ids=['crescent','skybolt','scatter','spearHeart','earthShatter'],actors=[];
  for(const [row,cls]of C.CLASS_IDS.entries())for(let col=0;col<3;col++){
    const sk=col===2?C.CLASSES[cls].skills.find(s=>s.lvl===130):C.ALL_SKILLS[ids[row]];
    const e=review.actor(cls,col===1?'adharma':'dharma','video-'+row+'-'+col);e.lvl=col===0?Math.max(1,sk.lvl):col===1?Math.max(100,sk.evo?.[0]?.lvl||0):130;actors.push({row,col,sk,e,cycle:-1});
  }
  const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5000000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(r=>recorder.onstop=r);
  recorder.start();const start=performance.now();
  await new Promise((resolve,reject)=>{function tick(){try{
    const now=performance.now(),elapsed=now-start,cycle=Math.floor(elapsed/4200);g.fillStyle='#111d29';g.fillRect(0,0,1440,1400);
    for(const a of actors){
      const {e,sk,row,col}=a;if(a.cycle!==cycle){Object.assign(a,review.cast(e,sk,col===1?1:0,col?12:1),{cycle,released:false,impacts:new Set()});}
      if(sk.ritual&&!a.released&&now-a.motion.t0>=sk.ritual.cast){FX.list=[];review.dispatch({...a.d,t:'ritualRelease'});a.nodes.push(...FX.list);a.released=true;}
      if(sk.spear)for(const [i,b]of a.d.beats.entries())if(now-a.motion.t0>=b.at&&!a.impacts.has(i)){
        FX.list=[];review.dispatch({t:'spearBeat',skill:sk.id,id:e.id,x:280,y:220,cx:b.area?.shape==='cone'?e.x:280,cy:220,a:0,area:b.area,final:i===a.d.beats.length-1});a.nodes.push(...FX.list);a.impacts.add(i);
      }
      cg.clearRect(0,0,480,280);review.draw(cg,e,a.nodes,now);cg.fillStyle='#f2ddb3';cg.font='15px sans-serif';cg.fillText(e.cls+' · '+(col===0?'ขั้นต้น':col===1?'ขั้นวิวัฒนาการ':'วิชา Lv.130'),14,23);cg.fillStyle='#bdccda';cg.font='14px sans-serif';cg.fillText(sk.name,14,265);g.drawImage(cell,col*480,row*280);
    }
    if(elapsed>8300)resolve();else requestAnimationFrame(tick);
  }catch(e){reject(e);}}tick();});
  recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());
  return new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});
}
