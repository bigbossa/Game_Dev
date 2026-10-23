// Disconnected real-browser skill dispatch/render review, CDP port 9334.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.argv[2]||'http://localhost:3901',pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const pages=await fetch('http://127.0.0.1:9334/json/list').then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)));assert(page);
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
  try{
    await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:origin});
    let ready=false;
    for(let n=0;n<200;n++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
    assert(ready);
    await run(`(()=>{
      G.socket.disconnect();G.ents.clear();
      window.skillActor={id:'local-skill-review',kind:'p',name:'Skill review',cls:'dualblade',faction:'dharma',lvl:130,
        x:160,y:260,dir:0,hp:100,mhp:100,wt:7,ar:[4,4,4,4],gg:[0,0,0,0,0],flash:0};
      G.ents.set(skillActor.id,skillActor);
      G.ents.set('local-target',{id:'local-target',kind:'m',x:380,y:260,hp:100,mhp:100});
      window.skillDispatch=G.socket.listeners('fx')[0];
      window.skillEvent=(sk,r=0,a=0)=>{
        // the fields server/world.js castSkill sends for each skill
        const id=skillActor.id,base={id,f:skillActor.faction,r,t:sk,a,
          x:380,y:260,tx:380,ty:240,x0:160,y0:260,x1:360,y1:260,ids:['local-target'],tid:'local-target'};
        if(['mercy','aegis','might','nirvana','hawkeye','gale'].includes(sk))Object.assign(base,{ids:[id],d:r?10000:8000});
        if(sk==='fang')base.c=r?2:0;
        if(sk==='lotus')base.n=r?4:3;
        if(sk==='tempest'){const n=[8,10,12][r];Object.assign(base,{n,R:[170,200,230][r],g:Math.round(2600/n)});}
        if(sk==='crescent')base.R=r?220:190;
        if(sk==='thousand')base.n=r?12:8;
        if(sk==='heavens')Object.assign(base,{R:[190,230,270][r],n:[7,9,11][r]});
        if(sk==='skyrain')Object.assign(base,{R:[170,215,260][r],n:[7,9,11][r]});
        if(sk==='meteor')base.n=r?8:5;
        if(sk==='hawkshot')base.n=r?2:1;
        if(sk==='scatter')Object.assign(base,{n:r?7:5,L:r?480:420,v:r?2:1});
        if(sk==='rollshot')Object.assign(base,{n:r?5:3,x0:360,x1:160});
        if(sk==='deadeye')base.s=r?1:0;
        return base;
      };
      window.skillCast=(cls,sk,lvl,f,r=0,a=0)=>{
        Object.assign(skillActor,{cls,lvl,faction:f,x:160,y:260,dead:false,leap:null,dash:null,atk:null});
        FX.list=[];FX.parts=[];FX.flashes=[];
        skillDispatch(skillEvent(sk,r,a));
        if(!FX.list.length||FX.list.some(f=>!f.skillArt))throw new Error('Legacy or missing art: '+sk);
        return FX.list.slice();
      };
      window.drawSkillAt=(g,nodes,time)=>{
        const t0=Math.min(...nodes.map(n=>n.t0)),length=FX.list.length,parts=FX.parts.length;
        for(const layer of ['ground','top'])for(const n of nodes){
          const p=(t0+time-n.t0)/n.dur;if(p>=0&&p<=1)n.draw(g,p,n);
        }
        if(FX.list.length!==length||FX.parts.length!==parts)throw new Error('Draw emitted effects');
      };
    })()`);
    const smoke=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1000;c.height=700;const g=c.getContext('2d');
      let casts=0,draws=0,maxNodes=0;const classes={};
      const oldTimeout=window.setTimeout;window.setTimeout=()=>{throw new Error('Skill created a timer');};
      try{
        for(const cls of Object.values(C.CLASSES)){
          classes[cls.id]=[];
          for(const sk of cls.skills){
            classes[cls.id].push(sk.id);
            for(const f of ['dharma','adharma'])for(const lvl of [1,30,60,100,130]){
              const r=Math.min(sk.evo?.length||0,lvl>=130?2:lvl>=60?1:0);
              const nodes=skillCast(cls.id,sk.id,lvl,f,r);
              maxNodes=Math.max(maxNodes,nodes.length);casts++;
              const end=Math.max(...nodes.map(n=>n.t0+n.dur))-Math.min(...nodes.map(n=>n.t0));
              for(const time of [end*.15,end*.45,end*.85]){
                g.clearRect(0,0,c.width,c.height);drawSkillAt(g,nodes,time);draws++;
                const T=g.getTransform();if(T.a!==1||T.d!==1||T.e!==0||T.f!==0||g.globalAlpha!==1||g.globalCompositeOperation!=='source-over')
                  throw new Error('Canvas state leaked '+sk.id);
              }
            }
            for(let dir=0;dir<8;dir++){
              const nodes=skillCast(cls.id,sk.id,130,'adharma',Math.min(sk.evo?.length||0,2),dir*Math.PI/4);
              drawSkillAt(g,nodes,250);draws++;
            }
          }
        }
      }finally{window.setTimeout=oldTimeout;}
      // High level adds complexity even when the weapon and evolution are fixed.
      const progression=[];
      for(const cls of Object.values(C.CLASSES)){
        const sk=cls.skills[0].id,hashes=[];
        for(const lvl of [1,30,60,100,130]){
          const nodes=skillCast(cls.id,sk,lvl,'dharma');g.clearRect(0,0,c.width,c.height);drawSkillAt(g,nodes,140);
          hashes.push(c.toDataURL());
        }progression.push(new Set(hashes).size);
      }
      const n=skillCast('archer','skyrain',130,'dharma',2);
      for(let i=0;i<60;i++)skillDispatch(skillEvent('skyrain',2));
      const crowd=FX.list.filter(n=>n.skillArt).length;
      FX.list.forEach(n=>n.t0-=30000);FX.update(0);
      return {casts,draws,maxNodes,classes,progression,crowd,expired:FX.list.length};
    })()`);
    assert.equal(smoke.casts,Object.values(smoke.classes).reduce((n,s)=>n+s.length*10,0));   // 2 factions x 5 levels per skill, every classassert.equal(smoke.expired,0);assert(smoke.crowd<=180);
    assert(smoke.progression.every(n=>n===5));
    for(const cls of ['dualblade','taoist','archer']){
      const image=await run(`(()=>{
        const cls=${JSON.stringify(cls)},skills=C.CLASSES[cls].skills;
        const c=document.createElement('canvas');c.width=1800;c.height=9*230;
        const g=c.getContext('2d');g.fillStyle='#dbe2dc';g.fillRect(0,0,c.width,c.height);
        const times={fang:120,lotus:280,shadowstep:200,rend:220,tempest:1200,crescent:150,skyfall:560,thousand:520,twindragon:400,
          jade:100,skybolt:400,mercy:450,aegis:1000,heavens:1000,spiritsword:220,might:1000,meteor:950,nirvana:450,
          hawkshot:100,scatter:150,hawkeye:900,gale:900,skyrain:800,deadeye:260,rollshot:360,blast:560,stormphoenix:420};
        for(const [si,sk]of skills.entries())for(const [fi,f]of ['dharma','adharma'].entries())for(const [li,lvl]of [10,70,130].entries()){
          const col=fi*3+li,x=col*300,y=si*230;
          const r=Math.min(sk.evo?.length||0,lvl>=130?2:lvl>=70?1:0);
          const nodes=skillCast(cls,sk.id,lvl,f,r);
          const area=['tempest','skyfall','twindragon','heavens','meteor','nirvana','mercy','skyrain','blast','skybolt'].includes(sk.id),scale=area?.48:.7;
          g.save();g.beginPath();g.rect(x,y+26,300,198);g.clip();
          g.translate(x+150-(area?350:280)*scale,y+174-260*scale);g.scale(scale,scale);
          const time=times[sk.id]||180,t0=Math.min(...nodes.map(n=>n.t0));
          for(const n of nodes)if(n.layer==='ground'){
            const p=(t0+time-n.t0)/n.dur;if(p>=0&&p<=1)n.draw(g,p,n);
          }
          // Actual character sprite gives the effect a readable size reference.
          drawGhost(skillActor,160,260,1,null,g,'source-over');
          for(const n of nodes)if(n.layer==='top'){
            const p=(t0+time-n.t0)/n.dur;if(p>=0&&p<=1)n.draw(g,p,n);
          }
          g.restore();g.fillStyle='#243e3b';g.font='13px sans-serif';g.textAlign='left';
          g.fillText(sk.id+' / '+f+' / Lv.'+lvl,x+10,y+20);
          g.strokeStyle='#b0c0b8';g.strokeRect(x+.5,y+.5,299,229);
        }
        return c.toDataURL().split(',')[1];
      })()`);
      fs.writeFileSync(path.join(out,'skills-'+cls+'.png'),Buffer.from(image,'base64'));
    }
    const perf=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1000;c.height=700;const g=c.getContext('2d');
      const nodes=skillCast('taoist','heavens',130,'dharma',2);
      drawSkillAt(g,nodes,800);
      const old=CanvasRenderingContext2D.prototype.getImageData;let reads=0;
      CanvasRenderingContext2D.prototype.getImageData=function(...args){reads++;return old.apply(this,args);};
      const t=performance.now();
      try{for(let i=0;i<120;i++){g.clearRect(0,0,1000,700);drawSkillAt(g,nodes,500+i*10);}}
      finally{CanvasRenderingContext2D.prototype.getImageData=old;}
      return {cachedPixelReads:reads,averageDrawMs:(performance.now()-t)/120};
    })()`);
    assert.equal(perf.cachedPixelReads,0);assert.equal(errors.length,0,JSON.stringify(errors));
    const report={...smoke,...perf,errors};
    fs.writeFileSync(path.join(out,'skill-fx-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
