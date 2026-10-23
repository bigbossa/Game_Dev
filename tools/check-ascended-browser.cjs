const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.argv[2]||'http://localhost:3901',port=process.argv[3]||'9336';
(async()=>{
  const page=await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`,{method:'PUT'}).then(r=>r.json());
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  try{
    await send('Runtime.enable');let ready=false;
    for(let i=0;i<250;i++){ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await new Promise(r=>setTimeout(r,100));}assert(ready);
    const result=await run(`(()=>{
      G.socket.disconnect();G.ents.clear();
      const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      const hash=c=>{let h=2166136261;for(const v of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^v,16777619);return h;};
      const gallery=make(1600,1080),g=gallery.getContext('2d'),effects=make(1600,1500),eg=effects.getContext('2d');
      for(const [ctx,w,h]of [[g,1600,1080],[eg,1600,1500]]){ctx.fillStyle='#1b2834';ctx.fillRect(0,0,w,h);}
      let frames=0,icons=0,draws=0,heldWeaponFrames=0,clippedPixels=0,hotkeyCasts=0;const hashes=[];
      for(const [ci,cls]of C.CLASS_IDS.entries())for(const [fi,f]of ['dharma','adharma'].entries())for(const [li,lvl]of [120,130].entries()){
        const row=fi*2+li,x=ci*400,y=row*270,at=li+8,wt=li+11;
        G.cls=cls;C.setViewClass(cls);G.myId='test';
        const e=G.me={id:'test',cls,faction:f,lvl,x:0,y:0,dir:2,wt,wp:0,ar:[at,at,at,at],gg:[0,0,0,0,0],gp:[0,0,0,0,0]};G.ents.set(e.id,e);
        g.fillStyle='#f3dba3';g.font='16px sans-serif';g.fillText(cls+' / '+f+' / Lv.'+lvl,x+12,y+24);
        g.save();g.translate(x,y+30);G.drawPreview(g,220,215,0,{atk:false,dir:2,frame:cls==='archer'||cls==='spearman'?3:1});g.restore();
        g.save();g.translate(x+175,y+42);G.drawPreview(g,210,205,0,{atk:true,dir:1,frame:1});g.restore();
        for(const [i,id]of ['w'+wt,'sh'+at,'pa'+at,'br'+at,'sd'+at].entries()){
          const im=ItemArt.iconCanvas(id,f,44);g.drawImage(im,x+140+i*49,y+220);icons++;hashes.push(hash(im));
        }
        for(const atk of [false,true]){
          const sheet=ArmorLook.sheet(f,atk,e.ar,ModelTiers.tierOf(lvl),null,cls,wt).sheet;
          if(!sheet?.width)throw Error('Missing atlas '+cls);
          const c=make(220,220),cg=c.getContext('2d');
          for(let frame=0;frame<(atk?3:cls==='archer'||cls==='spearman'?4:3);frame++)for(let dir=0;dir<8;dir++){
            cg.clearRect(0,0,220,220);G.drawPreview(cg,220,220,0,{atk,dir,frame});frames++;
            if(cls==='spearman'){
              const c=make(320,280);SpearWeapon.held(c.getContext('2d'),SpearmanLook.anchor(f,atk,frame,C.DIR_COL[dir]),wt,f,320,280);heldWeaponFrames++;
              const data=c.getContext('2d').getImageData(0,0,320,280).data;
              for(let xx=0;xx<320;xx++)for(const yy of [0,1,278,279])if(data[(yy*320+xx)*4+3])clippedPixels++;
              for(let yy=0;yy<280;yy++)for(const xx of [0,1,318,319])if(data[(yy*320+xx)*4+3])clippedPixels++;
            }
          }
        }
        const sk=C.CLASSES[cls].skills.find(s=>s.lvl===lvl&&s.ritual),d={t:'ritualStart',id:e.id,cls,skill:sk.id,x:200,y:245,a:0,radius:sk.ritual.radius,cast:sk.ritual.cast,f};
        e.x=200;e.y=245;FX.list=[];AscendedSkills.play(d);
        // no standing channel: mid-move the body is away from where it stood and in an attack drawing
        if(!AscendedSkills.active(e)||!AscendedSkills.frame(e,e.ritual.t0+300)?.atk)throw Error('No move pose');
        {const o=AscendedSkills.pose(e,e.ritual.t0+300,{dx:0,dy:0,lift:0});if(Math.hypot(o.dx,o.dy)+Math.abs(o.lift)<20)throw Error('Body does not travel '+sk.id);}
        for(const n of FX.list)for(const p of [0,.3,.9]){const c=make(600,600);n.draw(c.getContext('2d'),p,n);draws++;}
        AscendedSkills.play({...d,t:'ritualCancel'});if(FX.list.length||AscendedSkills.active(e))throw Error('Cancellation persists');
        G.stats={lvl:130,mp:5000,aspd:0};G.skl=C.cleanSkills(cls,null,130);G.skl.sk[sk.id]=1;
        G.rebuildKeys();HUD.me=e;HUD.buildBar();HUD.cds={};G.spearWait={};
        if(document.querySelectorAll('#skillbar .slot').length!==13)throw Error('Incomplete skill bar');
        const emit=G.socket.emit,sent=[];G.socket.emit=(...args)=>sent.push(args);
        document.activeElement?.blur();
        try{dispatchEvent(new KeyboardEvent('keydown',{key:sk.key}));dispatchEvent(new KeyboardEvent('keyup',{key:sk.key}));}finally{G.socket.emit=emit;}
        if(!sent.some(([kind,v])=>kind==='skill'&&v.id===sk.id))throw Error('Hotkey failed '+sk.id);hotkeyCasts++;
        if(HUD.cdLeft(sk.id)>0)throw Error('Unconfirmed cast consumed cooldown');
        for(const key of ['0','-']){const slot=document.querySelector('#skillbar .slot[data-key="'+key+'"]');if(!slot)throw Error('Missing new slot');}
        document.body.classList.add('touch');
        const slots=[...document.querySelectorAll('#skillbar .slot')].map(el=>el.getBoundingClientRect());
        for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
          const a=slots[i],b=slots[j],overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left),overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
          if(overlapX>10&&overlapY>10)throw Error('Touch slots overlap '+i+'/'+j);
        }document.body.classList.remove('touch');
        AscendedSkills.play(d);AscendedSkills.play({...d,t:'ritualRelease',recovery:650});
        if(FX.list.some(n=>n.phase==='charge'))throw Error('Warning persists');
        for(const n of FX.list)for(const p of [.1,.3,.6,.95]){const c=make(700,700);n.draw(c.getContext('2d'),p,n);draws++;}
        if(fi===0){eg.save();eg.translate(ci*400,li*750+90);eg.scale(.7,.7);for(const n of FX.list)n.draw(eg,.28,n);eg.restore();
          eg.fillStyle='#f3dba3';eg.font='16px sans-serif';eg.fillText(sk.name+' / '+lvl,ci*400+8,li*750+28);
          eg.save();eg.translate(ci*400,li*750+450);eg.scale(.7,.7);FX.list=[];AscendedSkills.play(d);for(const n of FX.list)n.draw(eg,.7,n);eg.restore();}
      }
      FX.list=[];
      G.skl.free=C.skillPtsFree(G.skl,130);BOOK.toggle(true);
      for(const sk of C.CLASSES[G.cls].skills.filter(s=>s.ritual))if(!document.querySelector('#bookPanel [data-up="'+sk.id+'"]'))throw Error('Skill missing from book');
      BOOK.toggle(false);
      const native=CanvasRenderingContext2D.prototype.getImageData;let hotReads=0;
      CanvasRenderingContext2D.prototype.getImageData=function(...a){hotReads++;return native.apply(this,a);};
      try{for(let i=0;i<100;i++)ArmorLook.sheet('adharma',false,[9,9,9,9],7,null,'spearman',12);}finally{CanvasRenderingContext2D.prototype.getImageData=native;}
      if(hotReads)throw Error('Atlas re-read in hot path');
      return{frames,icons,draws,heldWeaponFrames,clippedPixels,hotkeyCasts,hotReads,uniqueIcons:new Set(hashes).size,gallery:gallery.toDataURL(),effects:effects.toDataURL()};
    })()`);
    const out=path.join(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
    for(const k of ['gallery','effects']){fs.writeFileSync(path.join(out,'ascended-'+k+'.png'),Buffer.from(result[k].split(',')[1],'base64'));delete result[k];}
    fs.writeFileSync(path.join(out,'ascended-browser.json'),JSON.stringify({...result,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(result.clippedPixels,0);assert.equal(result.hotkeyCasts,16);console.log(JSON.stringify(result));
  }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
