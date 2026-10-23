// Reviews real cached character/aura atlases and the inventory renderer.
// Dedicated CDP 9334; no login and no changes to saved characters.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
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
  try{
    await send('Runtime.enable');await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin});
    let ready=false;for(let i=0;i<200;i++){ready=await run("!!window.G?.map&&document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}assert(ready);
    await run(`(()=>{
      G.socket.disconnect();G.ents.clear();G.me={cls:'dualblade',faction:'dharma',lvl:70,x:0,y:0,wt:7,wp:0,ar:[5,5,5,5],gg:[0,0,0,0,0],gp:[0,0,0,0,0]};
      window.auraCanvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      window.gradeGallery=auraCanvas(1200,1440);window.gradeG=gradeGallery.getContext('2d');
      gradeG.fillStyle='#1f2d3b';gradeG.fillRect(0,0,1200,1440);
    })()`);
    const metrics=[];
    for(const [ci,cls]of ['dualblade','archer','taoist'].entries())for(const [fi,faction]of ['dharma','adharma'].entries()){
      const result=await run(`(()=>{
        const cls=${JSON.stringify(cls)},faction=${JSON.stringify(faction)},row=${ci*2+fi};
        const metrics=[];Object.assign(G.me,{cls,faction,lvl:70,wt:7,wp:0,gp:[0,0,0,0,0]});
        for(let grade=0;grade<=5;grade++){
          G.me.gg=Array(5).fill(grade);
          const x=grade*200,y=row*240;
          gradeG.save();gradeG.translate(x,y);G.drawPreview(gradeG,200,209,1.95);gradeG.restore();
          gradeG.fillStyle=grade?ArmorLook.lightOf(faction,grade,cls):'#c8c8c8';
          gradeG.font='14px sans-serif';gradeG.textAlign='center';
          gradeG.fillText(cls+' / '+C.GRADES[grade].name,x+100,y+229);
          for(const atk of [false,true]){
            const tier=cls==='dualblade'?DualbladeLook.stageOf(70):ModelTiers.tierOf(70);
            const args=[faction,atk,G.me.ar,tier,G.me.gg,cls,7],look=ArmorLook.sheet(...args);
            if(!grade){if(look.rim)throw Error('Normal gear must not have a rarity outline');continue;}
            if(ArmorLook.sheet(...args).rim!==look.rim)throw Error('Rarity atlas was rebuilt');
            const I=ModelTiers.info(ModelTiers.key(faction,atk,cls)),R=look.rimMeta;
            if(R.pad<8)throw Error('No room for soft outside glow');
            const body=look.sheet.getContext('2d').getImageData(0,0,look.sheet.width,look.sheet.height).data;
            const glow=look.rim.getContext('2d').getImageData(0,0,look.rim.width,look.rim.height).data;
            let total=0,peak=0,inside=0,border=0,feet=0;
            const w=look.rim.width,cols=8,rows=Math.round(look.sheet.height/I.fh);
            for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
              for(let y=0;y<R.fh;y++)for(let x=0;x<R.fw;x++){
                const a=glow[((r*R.fh+y)*w+col*R.fw+x)*4+3];total+=a;peak=Math.max(peak,a);
                if((x<2||y<2||x>=R.fw-2||y>=R.fh-2)&&a>1)border++;
                const bx=x-R.pad,by=y-R.pad;
                if(bx>=0&&bx<I.fw&&by>=0&&by<I.fh){
                  const ba=body[((r*I.fh+by)*look.sheet.width+col*I.fw+bx)*4+3];
                  if(ba===255&&a)inside++;
                }
                if(y>=R.pad+I.fh&&a)feet++;
              }
            }
            metrics.push({cls,faction,grade,atk,total,peak,inside,border,feet,frames:cols*rows});
          }
        }
        // Empty armour slots cannot contribute a higher rarity than the equipped weapon.
        const a=ArmorLook.sheet(faction,false,[0,0,0,0],0,[1,5,5,5,5],cls,0);
        if(a.lightTop!==1)throw Error('Unequipped slots contribute grade light');
        const b=ArmorLook.sheet(faction,false,[1,0,0,0],0,[1,5,0,0,0],cls,0);
        if(b.lightTop!==5)throw Error('Equipped high-grade armour was ignored');
        return metrics;
      })()`);
      metrics.push(...result);
    }
    const preview=await run(`(()=>{
      const canvas=auraCanvas(1360,460),g=canvas.getContext('2d'),floorChecks=[];
      g.fillStyle='#1c2734';g.fillRect(0,0,1360,460);
      Object.assign(G.me,{cls:'dualblade',faction:'dharma',lvl:130,wt:10,wp:10,ar:[7,7,7,7],gg:[5,5,5,5,5],gp:[10,10,10,10,10]});
      for(let dir=0;dir<8;dir++){
        for(const [row,dpr]of [1,2].entries()){
          const c=auraCanvas(170*dpr,180*dpr),cg=c.getContext('2d');cg.scale(dpr,dpr);
          G.drawPreview(cg,170,180,dir*.9+.22);
          g.drawImage(c,dir*170,row*230,170,180);g.fillStyle='#e9edf2';g.font='12px sans-serif';g.textAlign='center';
          g.fillText('dir '+dir+' / DPR '+dpr,dir*170+85,row*230+204);
        }
      }
      // A high-enhancement floor must fade out before all four preview borders.
      for(const cls of C.CLASS_IDS)for(const plus of [8,9,10])for(const count of [1,5])for(const t of [0,.7,1.9,3.2]){
        const c=auraCanvas(170,180),cg=c.getContext('2d'),e={...G.me,cls,x:85,y:164,gp:Array(5).fill(0).map((_,i)=>i<count?plus:0)};
        cg.translate(85,164);cg.scale(1.3,1.3);cg.translate(-85,-164);
        WeaponLook.plusRings(cg,e,t,(170-16)/(2*1.3),12/1.3);
        const d=cg.getImageData(0,0,170,180).data;let border=0;
        for(let y=0;y<180;y++)for(let x=0;x<170;x++)if((x<2||y<2||x>=168||y>=178)&&d[(y*170+x)*4+3]>1)border++;
        floorChecks.push({cls,plus,count,t,border});
      }
      return {image:canvas.toDataURL().split(',')[1],floorChecks};
    })()`);
    const gallery=await run("gradeGallery.toDataURL().split(',')[1]");
    const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'equipment-aura-grades.png'),Buffer.from(gallery,'base64'));
    fs.writeFileSync(path.join(out,'dualblade-crisp-preview.png'),Buffer.from(preview.image,'base64'));
    for(const m of metrics){assert(m.total>0);assert.equal(m.inside,0,JSON.stringify(m));assert.equal(m.border,0,JSON.stringify(m));assert(m.peak<=82);}
    for(const cls of ['dualblade','archer','taoist'])for(const faction of ['dharma','adharma'])for(const atk of [false,true]){
      const levels=metrics.filter(m=>m.cls===cls&&m.faction===faction&&m.atk===atk);
      for(let i=1;i<levels.length;i++)assert(levels[i].total>levels[i-1].total,`Aura strength must increase: ${cls}/${faction}/${atk}`);
    }
    assert(metrics.some(m=>m.cls==='dualblade'&&m.grade===5&&m.feet>0),'Aura must extend below the old hard cell boundary');
    assert(preview.floorChecks.every(x=>!x.border),'Enhancement rings are clipped in the inventory');
    assert.equal(errors.length,0,JSON.stringify(errors));
    const report={variants:metrics.length,frames:metrics.reduce((s,m)=>s+m.frames,0),
      outsideOnly:true,transparentFrameEdges:true,distinctIncreasingGrades:true,enhancementPreviews:preview.floorChecks.length,
      maxOpacity:Math.max(...metrics.map(m=>m.peak)),metrics,browserErrors:errors};
    fs.writeFileSync(path.join(out,'equipment-aura-check.json'),JSON.stringify(report,null,2));
    delete report.metrics;console.log(JSON.stringify(report,null,2));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
