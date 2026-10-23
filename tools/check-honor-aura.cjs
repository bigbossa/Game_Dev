// Dedicated browser; exercises actual preview rendering without logging in or changing saves.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.argv[2]||'http://localhost:3909',port=process.argv[3]||'9349';
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
      const hash=c=>{let h=2166136261;for(const n of c.getContext('2d').getImageData(0,0,c.width,c.height).data)h=Math.imul(h^n,16777619);return h;};
      const gallery=make(1400,1680),g=gallery.getContext('2d');g.fillStyle='#172430';g.fillRect(0,0,1400,1680);
      const classes=make(1200,620),cg=classes.getContext('2d');cg.fillStyle='#172430';cg.fillRect(0,0,1200,620);
      const metrics=[];let cases=0,poses=0,pixelReads=0;
      const check=(x,message)=>{if(!x)throw Error(message);cases++;};
      const base={id:'honor-test',cls:'dualblade',lvl:50,x:0,y:0,wt:0,wg:0,wp:0,ar:[4,4,4,4],gg:[0,0,0,0,0],gp:[0,0,0,0,0]};
      for(const [fi,faction]of ['dharma','adharma'].entries())for(const [gi,grade]of [3,4,5].entries()){
        let previous=0;
        for(let count=1;count<=5;count++){
          const e={...base,faction,gg:Array.from({length:5},(_,i)=>i<count?grade:0)};
          const S=EquipmentAura.state(e);check(S.count===count&&S.grade===grade,'Count / grade');
          const c=make(360,360),ctx=c.getContext('2d');EquipmentAura.drawAt(ctx,e,180,320,180,1.2);
          const pixels=ctx.getImageData(0,0,360,360).data;let area=0,border=0;
          for(let y=0;y<360;y++)for(let x=0;x<360;x++){const a=pixels[(y*360+x)*4+3];if(a>3)area++;if(a>1&&(x<2||y<2||x>357||y>357))border++;}
          check(area>previous,'Aura area must grow from 1 to 5');check(!border,'Aura clipped');previous=area;
          const before=hash(c);ctx.clearRect(0,0,360,360);EquipmentAura.drawAt(ctx,e,180,320,180,2.4);check(before!==hash(c),'Aura must animate');
          metrics.push({faction,grade,count,area});
          G.me=e;G.myId=e.id;G.ents.set(e.id,e);const x=(count-1)*280,y=(fi*3+gi)*280;
          g.save();g.beginPath();g.rect(x,y,280,280);g.clip();g.translate(x+20,y+5);G.drawPreview(g,240,230,1.2,{atk:false,dir:2,frame:1});g.restore();
          g.fillStyle=S.palette.main;g.font='15px sans-serif';g.textAlign='center';g.fillText(faction+' / '+C.GRADES[grade].name+' / '+count+' pieces',x+140,y+263);
        }
      }
      check(!EquipmentAura.state({...base,gg:[2,2,2,2,2]}),'Epic must not trigger');
      check(!EquipmentAura.state({...base,ar:[0,0,0,0],gg:[0,5,5,5,5]}),'Empty slots must not count');
      check(!EquipmentAura.state({...base,dead:true,gg:[5,5,5,5,5]}),'Dead player');
      check(EquipmentAura.state({...base,gg:[4,5,3,4,0]}).count===1,'Only highest grade counts');
      check(EquipmentAura.state({...base,gg:[4,4,4,4,5]}).count===1,'4 Legendary plus 1 Mythic');
      check(EquipmentAura.state({...base,gg:[5,4,4,4,4]}).count===1,'Highest in weapon slot');
      check(EquipmentAura.state({...base,gg:[3,4,4,3,4]}).count===3,'3 Legendary plus 2 Unique');
      check(EquipmentAura.state({...base,gg:[4,5,3,4,0]}).grade===5,'Highest qualifying grade');
      check(EquipmentAura.state({...base,gg:[0,0,0,0,5]}).count===1,'Armour alone');
      check(EquipmentAura.state({...base,gg:undefined,wg:5,ar:[0,0,0,0]}).count===1,'Weapon fallback');
      const downgraded={...base,gg:[4,5,0,0,0]};downgraded.gg[1]=3;
      check(EquipmentAura.state(downgraded).grade===4&&EquipmentAura.state(downgraded).count===1,'Downgrade immediately');
      const c=make(280,280),ctx=c.getContext('2d');
      // Four Legendary pieces must not enlarge or tint a single Mythic item's light.
      G.me={...base,faction:'dharma',gg:[4,4,4,4,5]};
      G.drawPreview(ctx,280,270,1.2,{atk:false,dir:2,frame:1});
      // drawPreview uses live time for light animation; inspect the actual emitter list deterministically.
      const glintMeta={frameWidth:256,frameHeight:256,anchorX:128,anchorY:254};
      const mixed=EquipmentGlints.points(G.me,{atk:false,dir:2,frame:1},glintMeta);
      check(mixed.every(p=>p.grade===5&&p.slot===4),'Lower grade glints contribute light');
      ctx.clearRect(0,0,280,280);
      for(const [ci,cls]of C.CLASS_IDS.entries())for(const [fi,faction]of ['dharma','adharma'].entries()){
        const e={...base,cls,faction,gg:[5,5,5,5,5]};G.me=e;
        for(const atk of [false,true])for(let dir=0;dir<8;dir++)for(let frame=0;frame<3;frame++){
          ctx.clearRect(0,0,280,280);G.drawPreview(ctx,280,270,1.2,{atk,dir,frame});poses++;
        }
        cg.save();cg.beginPath();cg.rect(ci*300,fi*310,300,310);cg.clip();cg.translate(ci*300+10,fi*310+10);G.drawPreview(cg,280,260,1.2,{atk:false,dir:2,frame:1});cg.restore();
        cg.fillStyle=C.gradeLight(faction,5);cg.font='16px sans-serif';cg.textAlign='center';cg.fillText(cls+' / '+faction,ci*300+150,fi*310+292);
        for(const grade of [3,4,5])check(EquipmentGlints.color(grade,faction)===EquipmentAura.state({...e,gg:Array(5).fill(grade)}).palette.main,'Body/glint palette');
      }
      const native=CanvasRenderingContext2D.prototype.getImageData;
      // The actual 170x180 inventory preview must leave a transparent gutter around its new aura.
      const actualDraw=EquipmentAura.drawAt;let clipped=0;
      EquipmentAura.drawAt=function(g,e,x,y,H,t){
        const layer=make(g.canvas.width,g.canvas.height),lg=layer.getContext('2d');lg.setTransform(g.getTransform());
        actualDraw(lg,e,x,y,H,t);
        const data=lg.getImageData(0,0,layer.width,layer.height).data;
        for(let yy=0;yy<layer.height;yy++)for(let xx=0;xx<layer.width;xx++)if((xx<2||yy<2||xx>=layer.width-2||yy>=layer.height-2)&&data[(yy*layer.width+xx)*4+3]>2)clipped++;
        actualDraw(g,e,x,y,H,t);
      };
      try{for(const cls of C.CLASS_IDS){G.me={...base,cls,faction:'dharma',lvl:130,gg:[5,5,5,5,5]};const small=make(170,180);G.drawPreview(small.getContext('2d'),170,180,1.2,{atk:false,dir:2,frame:1});}}finally{EquipmentAura.drawAt=actualDraw;}
      check(clipped===0,'Inventory aura cropped at the canvas edge');
      CanvasRenderingContext2D.prototype.getImageData=function(...args){pixelReads++;return native.apply(this,args);};
      try{for(let i=0;i<100;i++)EquipmentAura.drawAt(ctx,{...base,gg:[5,5,5,5,5]},140,250,120,i*.1);}finally{CanvasRenderingContext2D.prototype.getImageData=native;}
      check(pixelReads===0,'Animation reads pixels');
      return{cases,poses,metrics,gallery:gallery.toDataURL(),classes:classes.toDataURL()};
    })()`);
    assert.equal(errors.length,0,JSON.stringify(errors));
    for(const name of ['gallery','classes'])fs.writeFileSync(path.join(__dirname,'../artifacts/honor-aura-'+name+'.png'),Buffer.from(result[name].split(',')[1],'base64'));
    delete result.gallery;delete result.classes;
    fs.writeFileSync(path.join(__dirname,'../artifacts/honor-aura-check.json'),JSON.stringify(result,null,2));
    console.log(`PASS: ${result.cases} aura checks, ${result.poses} character poses, both factions and 1–5 pieces; gallery exported`);
  }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`);}
})().catch(e=>{console.error(e);process.exitCode=1;});
