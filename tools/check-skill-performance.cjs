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
    const redesigned=await run('('+redesignChecks.toString()+')()');
    console.log('PASS four-class redesign:',JSON.stringify(redesigned));
    if(process.argv.includes('--redesign')){
      const sheets=await run('('+designSheets.toString()+')()');
      for(const [name,png]of Object.entries(sheets))fs.writeFileSync(path.join(out,'skill-redesign-'+name+'.png'),Buffer.from(png.split(',')[1],'base64'));
    }
    const png=await run('('+gallery.toString()+')()');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'all-class-skill-stages.png'),Buffer.from(png.split(',')[1],'base64'));
    if(process.argv.includes('--video')){
      const video=await run('('+record.toString()+')()');fs.writeFileSync(path.join(out,'all-class-skill-animation.webm'),Buffer.from(video.split(',')[1],'base64'));
      console.log('Saved actual renderer video: artifacts/all-class-skill-animation.webm');
    }
    if(process.argv.includes('--redesign')){
      await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
      const result=await run('('+recordRedesign.toString()+')()');
      assert(result.frames>=220&&result.scenes===11,'Animation reel must cover every skill with moving frames: '+JSON.stringify({frames:result.frames,scenes:result.scenes}));
      fs.writeFileSync(path.join(out,'skill-redesign-four-classes.webm'),Buffer.from(result.video.split(',')[1],'base64'));console.log('Saved 44-skill animation reel:',result.frames,'frames,',result.scenes,'scenes.');
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
  }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
function redesignChecks(){
  const check=(b,m)=>{if(!b)throw Error(m);},make=review.make,c=make(700,600),g=c.getContext('2d');
  const hashes=new Set(),motions=new Set(),routes=new Set();let renders=0,confirmed=0;
  const hash=()=>{let h=2166136261;const data=g.getImageData(0,0,c.width,c.height).data;for(let i=0;i<data.length;i++)h=Math.imul(h^data[i],16777619);return h;};
  for(const [id,design]of Object.entries(SkillDesigns)){
    const sk=C.ALL_SKILLS[id];check(typeof SkillArts.motifs[design.motif]==='function','Missing motif '+id);
    const progression=[];
    for(const f of ['dharma','adharma'])for(const sl of [1,12]){
      const e=review.actor(design.cls,f),A=SkillArts.profile(sk,{sl,r:sl>1?(sk.evo?.length||0):0}),P=SkillFX.palette(design.cls,f);
      g.clearRect(0,0,700,600);g.save();g.translate(350,350);SkillArts.motifs[design.motif](g,{A,P,p:.35,R:A.R,a:.2,i:1,fin:true});g.restore();renders++;
      check(g.getTransform().a===1&&g.globalAlpha===1,'Motif leaked Canvas state');
      progression.push(hash());if(f==='dharma'&&sl===12)hashes.add(hash());
    }
    check(progression[0]!==progression[1]&&progression[2]!==progression[3],'Training art not changing '+id);
    const e=review.actor(design.cls),{d,motion:m}=review.cast(e,sk,0,12),trace=[];
    for(let k=1;k<20;k++){const now=m.t0+m.dur*k/20,F=G.skillFrame(e,now),P=G.skillPose(e,now);trace.push([F.dir,F.frame,...['dx','dy','lift','roll'].map(k=>Math.round((P[k]||0)*100)/100)]);}
    (sk.ritual?routes:motions).add(JSON.stringify(trace));
    if(sk.spear){
      check(FX.list.every(n=>n.phase==='cast'),'Spear impact before confirmation');
      for(const [step,b]of d.beats.entries()){
        const at=m.t0+b.at,F=G.skillFrame(e,at);check(F.frame===1&&F.dir===m.dir,'Spear missed actual beat');
        review.dispatch({t:'spearBeat',id:e.id,skill:id,x:280,y:220,cx:280,cy:220,a:0,step,final:step===d.beats.length-1,area:b.area});confirmed++;
      }
      check(FX.list.some(n=>n.artV2&&n.phase==='impact'),'Missing confirmed spear motif');
    }
    if(sk.ritual){
      check(!FX.list.some(n=>n.phase==='ritualFinish'),'Premature ritual finale');review.dispatch({...d,t:'ritualRelease'});check(FX.list.some(n=>n.phase==='ritualFinish'),'No confirmed finale');
      check(!FX.list.some(n=>n.phase==='ritualMove'),'Windup remains after release');
    }
    SkillPerformance.cancel(e.id);check(!FX.list.some(n=>n.artV2&&n.owner===e.id),'Cancel left new effects');
  }
  check(hashes.size===44,'Motifs must be distinct');check(motions.size===36,'Regular skill body routes must be distinct');check(routes.size===8,'Eight distinct endgame routes');
  // A second cast replaces only the body trail: a launched rain field must remain.
  const e=review.actor('archer');review.cast(e,C.ALL_SKILLS.skyrain);const field=FX.list.filter(n=>n.phase==='impact');review.dispatch(review.event(e,C.ALL_SKILLS.hawkshot));check(field.every(n=>FX.list.includes(n)),'New cast erased existing field');
  G.socket.listeners('control')[0]({stun:400});check(!e.skillMotion&&field.every(n=>FX.list.includes(n)),'Stun erased already launched field');G.socket.listeners('control')[0]({});
  SkillPerformance.cancel(e.id);check(!FX.list.some(n=>n.artV2),'Explicit interruption retained effects');
  const buff=review.actor('taoist');review.dispatch({...review.event(buff,C.ALL_SKILLS.aegis),d:7000});
  check(FX.list.some(n=>n.artV2&&n.dur===7000),'Buff marker duration must follow server');SkillPerformance.cancel(buff.id);
  FX.list=[];for(let i=0;i<70;i++){const actor=review.actor('taoist','dharma','new-crowd-'+i);review.dispatch(review.event(actor,C.ALL_SKILLS.meteor,1,12));}
  const cap=FX.list.filter(n=>n.artV2).length;check(cap<=144,'Effect cap');
  const before=FX.list.length;g.save();g.globalAlpha=.7;for(const n of FX.list)for(const p of [0,.1,.5,.9,1])n.draw(g,p,n);check(FX.list.length===before&&g.globalAlpha===.7,'Draw must be pure');g.restore();
  SkillPerformance.clear();check(!FX.list.some(n=>n.artV2),'Map change cleanup');
  return {skills:44,uniqueMotifs:hashes.size,uniqueBodyRoutes:motions.size,uniqueRitualRoutes:routes.size,renders,confirmedSpearBeats:confirmed,crowdCap:cap};
}
function textResult(r){assert.equal(r.skills,55);assert(r.crowd<=96);assert.equal(r.expired,0);console.log('PASS all-class performance:',JSON.stringify(r));}
function designSheets(){
  const images={};
  for(const cls of ['dualblade','spearman','archer','taoist']){
    const canvas=review.make(1600,1050),g=canvas.getContext('2d');g.fillStyle='#101c29';g.fillRect(0,0,1600,1050);
    C.CLASSES[cls].skills.forEach((sk,i)=>{
      const e=review.actor(cls,i%2?'adharma':'dharma','sheet-'+cls+'-'+i);e.lvl=Math.max(sk.lvl,sk.evo?.[0]?.lvl||70);
      const rank=sk.evo?.length?1:0,{d,nodes,motion:m}=review.cast(e,sk,rank,12),base=m.t0;let now;
      if(sk.spear){for(const [step,b]of d.beats.entries()){FX.list=[];review.dispatch({t:'spearBeat',skill:sk.id,id:e.id,x:280,y:220,cx:b.area?.shape==='cone'?e.x:280,cy:220,a:0,step,area:b.area,final:step===d.beats.length-1});for(const n of FX.list)n.t0=base+b.at;nodes.push(...FX.list);}now=base+d.beats.at(-1).at+110;}
      else if(sk.ritual){FX.list=[];review.dispatch({...d,t:'ritualRelease'});for(const n of FX.list)n.t0=base+sk.ritual.cast;e.skillMotion.t0=base+sk.ritual.cast;e.ritual.until=base+sk.ritual.cast+790;nodes.push(...FX.list);now=base+sk.ritual.cast+230;}
      else {const events=SkillArts.timeline(d,e),at=events[0]?.at||0;now=base+(['spiritsword','scatter','stormphoenix','rollshot'].includes(sk.id)?Math.min(390,at*.65):at+110);}
      const cell=review.make(400,350),cg=cell.getContext('2d');cg.save();cg.translate(22,67);cg.scale(.8,.8);review.draw(cg,e,nodes,now);cg.restore();
      cg.fillStyle='#f4dcaa';cg.font='16px sans-serif';cg.fillText(sk.key+' · '+SkillDesigns[sk.id].title,14,25);
      cg.fillStyle='#aebfd1';cg.font='13px sans-serif';cg.fillText(sk.name+' · Lv.'+sk.lvl,14,331);g.drawImage(cell,(i%4)*400,Math.floor(i/4)*350);
    });images[cls]=canvas.toDataURL();
  }return images;
}
async function recordRedesign(){
  // All 44 skills, four panes: each scene presents one skill slot across the four classes.
  const canvas=review.make(1280,900),g=canvas.getContext('2d'),cell=review.make(640,450),cg=cell.getContext('2d');
  const classes=['dualblade','spearman','archer','taoist'],names={dualblade:'ดาบคู่',spearman:'ทวน',archer:'ธนู',taoist:'นักพรต'};
  const actors=classes.map((cls,i)=>({e:review.actor(cls,i%2?'adharma':'dharma','reel-'+cls),scene:-1}));
  const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4500000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(r=>recorder.onstop=r);recorder.start();const start=performance.now(),length=2800;let frames=0;const seen=new Set();
  try{await new Promise((resolve,reject)=>{function tick(){try{
    const now=performance.now(),elapsed=now-start,scene=Math.min(10,Math.floor(elapsed/length));frames++;seen.add(scene);g.fillStyle='#101c29';g.fillRect(0,0,1280,900);
    for(const [i,a]of actors.entries()){
      const e=a.e,sk=C.CLASSES[e.cls].skills[scene];
      if(a.scene!==scene){e.lvl=Math.max(sk.lvl,sk.evo?.[0]?.lvl||70);Object.assign(a,review.cast(e,sk,sk.evo?.length?1:0,12),{scene,released:false,impacts:new Set()});}
      if(sk.spear)for(const [step,b]of a.d.beats.entries())if(now-a.motion.t0>=b.at&&!a.impacts.has(step)){FX.list=[];review.dispatch({t:'spearBeat',skill:sk.id,id:e.id,x:280,y:220,cx:b.area?.shape==='cone'?e.x:280,cy:220,a:0,step,area:b.area,final:step===a.d.beats.length-1});a.nodes.push(...FX.list);a.impacts.add(step);}
      if(sk.ritual&&!a.released&&now-a.motion.t0>=sk.ritual.cast){FX.list=[];review.dispatch({...a.d,t:'ritualRelease'});a.nodes.push(...FX.list);a.released=true;}
      cg.clearRect(0,0,640,450);cg.save();cg.translate(95,100);review.draw(cg,e,a.nodes,now);cg.restore();
      cg.fillStyle='#f4dcaa';cg.font='21px sans-serif';cg.fillText(names[e.cls]+' · '+SkillDesigns[sk.id].title,24,35);
      cg.fillStyle='#afc2d4';cg.font='16px sans-serif';cg.fillText('ปุ่ม '+sk.key+' · '+sk.name+' · วิชา Lv.'+sk.lvl,24,422);g.drawImage(cell,(i%2)*640,Math.floor(i/2)*450);
    }
    if(elapsed>=length*11-100)resolve();else requestAnimationFrame(tick);
  }catch(e){reject(e);}}tick();});}finally{recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());}
  const video=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});return {video,frames,scenes:seen.size};
}
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
        require(m&&(SkillArts.handles(sk.id)?nodes.some(n=>n.artV2):nodes.filter(n=>n.performanceArt&&!n.choreoArt).length===2),'Missing skill performance '+sk.id);
        if(SkillArts.handles(sk.id))require(nodes.every(n=>n.artV2||n.choreoArt),'Legacy art still active '+sk.id);
        require(nodes.filter(n=>n.choreoArt).length===(sk.ritual?0:2),'Route art '+sk.id);
        require(sk.ritual?!m.choreo:m.choreo?.tier===SkillChoreo.tier(sk,m.grade),'Choreography stage '+sk.id);
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
        require(!e.skillMotion&&!FX.list.some(n=>(n.performanceArt||n.artV2)&&n.owner===e.id),'Cancel retained cosmetics');
      }
      // Same level/equipment: actual training and evolution independently change detail.
      if(sk.lvl<120){const a=SkillPerformance.profile(sk,{sl:1}),b=SkillPerformance.profile(sk,{sl:12});require(b.detail>a.detail,'Training invisible '+sk.id);
        if(sk.evo?.length)require(SkillPerformance.profile(sk,{sl:1,r:1}).detail>a.detail,'Evolution invisible '+sk.id);
        if(!sk.ritual){const beats=x=>SkillChoreo.build(sk.id,cls.id,x.grade,4000).keys.length;require(beats(b)>beats(a),'Training adds no beats '+sk.id);}}
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
  for(let i=0;i<80;i++){const e=review.actor('warrior','dharma','crowd-'+i);review.dispatch(review.event(e,C.ALL_SKILLS.rallyGuard,0,12));}
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
