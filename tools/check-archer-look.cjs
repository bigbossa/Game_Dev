// Local, disconnected renderer review. Requires an isolated CDP browser on 9334.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.argv[2]||'http://localhost:3901',pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const pages=await fetch('http://127.0.0.1:9334/json/list').then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&(p.url==='about:blank'||p.url.startsWith(origin)));
  assert(page,'Isolated browser required');
  const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
  const out=path.join(__dirname,'..','artifacts');fs.mkdirSync(out,{recursive:true});
  const save=(name,base64)=>fs.writeFileSync(path.join(out,name),Buffer.from(base64,'base64'));
  try{
    await send('Runtime.enable');await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:origin});let ready=false;
    for(let n=0;n<200;n++){ready=await run("!!window.G?.map && document.getElementById('loading').classList.contains('hidden')");if(ready)break;await pause(100);}
    assert(ready,'Boot');
    await run(`(async()=>{
      G.socket.disconnect();G.cls='archer';
      window.arcMeta=await fetch('assets/archer.json').then(r=>r.json());
      window.arcRaw={};
      for(const f of ['dharma','adharma'])arcRaw[f]=await new Promise((resolve,reject)=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='assets/archer-'+f+'.png';
      });
      window.arcHash=(sheet,m,col=0,row=1)=>{
        const c=document.createElement('canvas');c.width=m.frameWidth;c.height=m.frameHeight;
        const g=c.getContext('2d');g.drawImage(sheet,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,0,0,c.width,c.height);
        const d=g.getImageData(0,0,c.width,c.height).data;let hash=2166136261;
        for(const v of d){hash^=v;hash=Math.imul(hash,16777619);}return hash>>>0;
      };
    })()`);
    const levels=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1540;c.height=1260;
      const g=c.getContext('2d');g.fillStyle='#d6e1df';g.fillRect(0,0,c.width,c.height);
      const hashes={armour:[],weapon:[]};
      function label(s,x,y){g.fillStyle='#24404a';g.font='15px sans-serif';g.textAlign='center';g.fillText(s,x,y);}
      for(const [fi,f]of ['dharma','adharma'].entries()){
        const m=arcMeta.walk[f];
        for(let t=1;t<=7;t++){
          const s=ArmorLook.sheet(f,false,[t,t,t,t],0,[0,0,0,0,0],'archer',0).sheet;
          g.drawImage(s,0,m.frameHeight,m.frameWidth,m.frameHeight,(t-1)*220,fi*250+18,m.frameWidth,m.frameHeight);
          label(f+' / Lv.'+C.ARMOR_SETS[t-1].lvl,(t-1)*220+110,fi*250+215);
          hashes.armour.push(arcHash(s,m));
        }
        for(let t=0;t<=10;t++){
          const s=ArmorLook.sheet(f,false,[0,0,0,0],0,[0,0,0,0,0],'archer',t).sheet;
          g.drawImage(s,0,m.frameHeight,m.frameWidth,m.frameHeight,t*140-12,510+fi*355,m.frameWidth*.8,m.frameHeight*.8);
          g.save();g.translate(t*140+25,680+fi*355);ArcherGear.icon(g,t,f,90);g.restore();
          label('Lv.'+(t?t*10:1),t*140+70,800+fi*355);
          hashes.weapon.push(arcHash(s,m));
        }
      }
      return{hashes,image:c.toDataURL().split(',')[1]};
    })()`);
    save('archer-equipment.png',levels.image);
    for(let f=0;f<2;f++){
      assert.equal(new Set(levels.hashes.weapon.slice(f*11,f*11+11)).size,11,'All bows differ on the character');
      assert.equal(new Set(levels.hashes.armour.slice(f*7,f*7+7)).size,7,'All outfits differ on the character');
    }
    const poses=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=2520;
      const g=c.getContext('2d');g.fillStyle='#d6e1df';g.fillRect(0,0,c.width,c.height);let count=0;
      for(const [fi,f]of ['dharma','adharma'].entries())for(const [pi,atk]of[false,true].entries()){
        const m=arcMeta[atk?'attack':'walk'][f],s=ArmorLook.sheet(f,atk,[7,7,7,7],0,[0,0,0,0,0],'archer',10).sheet;
        if(s.width!==m.frameWidth*8||s.height!==m.frameHeight*m.framesPerDir)throw new Error('Frame dimensions changed');
        for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
          const x=col*200+100-m.anchorX*.8,y=(fi*7+pi*4+row)*180+170-m.anchorY*.8;
          g.drawImage(s,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,x,y,m.frameWidth*.8,m.frameHeight*.8);
          g.fillStyle='#24404a';g.font='12px sans-serif';g.fillText(f+' '+(atk?'shoot':row===3?'idle':'walk')+' '+col+':'+row,col*200+10,(fi*7+pi*4+row)*180+14);
          const pts=WeaponLook.points({atk,dir:C.DIR_COL.indexOf(col),frame:row},10,{cls:'archer',faction:f});
          if(!pts.every(p=>p.every(Number.isFinite)))throw new Error('Invalid bow particle position');
          count++;
        }
      }
      return{count,image:c.toDataURL().split(',')[1]};
    })()`);
    save('archer-poses.png',poses.image);assert.equal(poses.count,112);
    const slots=await run(`(()=>{
      const counts=[];
      for(const f of ['dharma','adharma'])for(let slot=0;slot<4;slot++){
        const hashes=[];
        for(let t=0;t<=7;t++){
          const ar=[0,0,0,0];ar[slot]=t;
          hashes.push(arcHash(ArmorLook.sheet(f,false,ar,0,null,'archer',0).sheet,arcMeta.walk[f]));
        }
        counts.push(new Set(hashes).size);
      }return counts;
    })()`);
    assert(slots.every(n=>n===8),'Every individual equipment slot must change independently');
    const details=await run(`(()=>{
      const c=document.createElement('canvas');c.width=896;c.height=1120;
      const g=c.getContext('2d');g.fillStyle='#d6e1df';g.fillRect(0,0,c.width,c.height);
      let iconCount=0,checkedHeads=0;
      for(const [fi,f]of ['dharma','adharma'].entries()){
        for(const [si,slot]of C.ARMOR_SLOTS.entries())for(let t=1;t<=7;t++){
          const it=C.ARMORS.find(it=>it.slot===slot&&it.tier===t),icon=ItemArt.iconCanvas(it.id,f,112);
          g.drawImage(icon,(t-1)*128+8,(fi*4+si)*140);
          g.fillStyle='#24404a';g.font='12px sans-serif';g.textAlign='center';
          g.fillText(slot+' Lv.'+it.lvl,(t-1)*128+64,(fi*4+si)*140+128);iconCount++;
        }
        for(const atk of [false,true]){
          const m=arcMeta[atk?'attack':'walk'][f];
          const a=ArcherGear.compose(f,atk,[0,0,0,0],0),b=ArcherGear.compose(f,atk,[7,7,7,7],0);
          const da=a.getContext('2d').getImageData(0,0,a.width,a.height).data,db=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
          for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
            const [,neck]=ArcherGear.anchor(f,atk,row,col).body;
            for(let y=0;y<neck;y++)for(let x=0;x<m.frameWidth;x++){
              const p=((row*m.frameHeight+y)*a.width+col*m.frameWidth+x)*4;
              for(let k=0;k<4;k++)if(da[p+k]!==db[p+k])throw new Error('Armour changed the head');
            }checkedHeads++;
          }
          for(let p=3;p<da.length;p+=4)if(da[p]!==db[p])throw new Error('Armour changed body silhouette or feet');
        }
      }
      return{iconCount,checkedHeads,image:c.toDataURL().split(',')[1]};
    })()`);
    save('archer-armour-icons.png',details.image);
    assert.equal(details.iconCount,56);assert.equal(details.checkedHeads,112);
    const royal=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1920;c.height=800;
      const g=c.getContext('2d');g.fillStyle='#d8e4de';g.fillRect(0,0,c.width,c.height);
      const hashes=[],wingChecks=[];let referencePixels=0;
      for(const f of ['dharma','adharma']){
        const m=arcMeta.walk[f],sheet=ArmorLook.sheet(f,false,[0,0,0,0],0,null,'archer',0).sheet;
        const raw=document.createElement('canvas');raw.width=sheet.width;raw.height=sheet.height;
        const rg=raw.getContext('2d');rg.drawImage(arcRaw[f],0,0);
        const a=rg.getImageData(0,3*m.frameHeight,raw.width,m.frameHeight).data;
        const b=sheet.getContext('2d').getImageData(0,3*m.frameHeight,raw.width,m.frameHeight).data;
        for(let p=3;p<a.length;p+=4){
          // Dark-elf repairs add missing bow pixels; existing body pixels must
          // survive, and any added alpha must stay inside the weapon envelope.
          if(a[p]!==b[p]){
            const n=(p-3)/4,x=n%raw.width,col=Math.floor(x/m.frameWidth),xx=x%m.frameWidth,y=Math.floor(n/raw.width);
            const bow=ArcherGear.anchor(f,false,3,col).bow;
            const lo=bow?Math.min(bow[0],bow[2],bow[4])-13:0,hi=bow?Math.max(bow[0],bow[2],bow[4])+13:0;
            if(f!=='adharma'||b[p]<a[p]||!bow||xx<lo||xx>hi||y<Math.min(bow[1],bow[5])-4||y>Math.max(bow[1],bow[5])+4)
              throw new Error('Turnaround body differs from source');
          }
          referencePixels++;
        }
      }
      for(const [fi,f]of ['dharma','adharma'].entries())for(let tier=0;tier<8;tier++){
        const m=arcMeta.walk[f],lvl=ModelTiers.LEVELS[tier]||1,x=tier*240+120,y=fi*400+300,s=.95;
        const e={cls:'archer',faction:f,lvl,x,y,wt:0,ar:[0,0,0,0]},F={atk:false,dir:2,frame:3};
        const sheet=ArmorLook.sheet(f,false,[0,0,0,0],tier,null,'archer',0).sheet;
        ModelTiers.drawAura(g,e,F,x,y,1,s,m);
        Wings.draw(g,e,F,x,y,1,s,'back',m,.65);
        g.drawImage(sheet,0,3*m.frameHeight,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
        Wings.draw(g,e,F,x,y,1,s,'front',m,.65);ModelTiers.drawHalo(g,e,F,x,y,1,s,m);
        g.fillStyle='#294039';g.font='18px sans-serif';g.textAlign='center';g.fillText(f+' / Lv.'+lvl,x,fi*400+345);
        hashes.push(arcHash(sheet,m,0,3));
        if(tier>=4){
          const canvas=document.createElement('canvas');canvas.width=400;canvas.height=400;
          const cg=canvas.getContext('2d');Wings.draw(cg,{...e,x:200,y:280},F,200,280,1,1,'back',m);
          const archer=canvas.toDataURL();cg.clearRect(0,0,400,400);
          Wings.draw(cg,{...e,cls:'dualblade',x:200,y:280},{...F,frame:1},200,280,1,1,'back',m);
          wingChecks.push(archer!==canvas.toDataURL());
        }
      }
      // All frame hair anchors are finite and below the bow tip / baked shot effects.
      let frames=0;
      const pc=document.createElement('canvas');pc.width=1600;pc.height=2520;
      const pg=pc.getContext('2d');pg.fillStyle='#d8e4de';pg.fillRect(0,0,pc.width,pc.height);
      for(const [fi,f]of ['dharma','adharma'].entries())for(const [pi,atk]of [false,true].entries()){
        const m=arcMeta[atk?'attack':'walk'][f],key=ModelTiers.key(f,atk,'archer');
        const sheet=ArmorLook.sheet(f,atk,[7,7,7,7],7,null,'archer',10).sheet;
        for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
          const a=ArcherRoyal.frame(key,row,col);
          if(!a||a.indices.length<20||a.top<0||a.neck<=a.top)throw new Error('Invalid hair anchor '+key+' '+row+':'+col);
          const x=col*200+100,y=(fi*7+pi*4+row)*180+165,s=.68;
          const F={atk,dir:C.DIR_COL.indexOf(col),frame:row},e={cls:'archer',faction:f,lvl:130,x,y,wt:10};
          ModelTiers.drawAura(pg,e,F,x,y,1,s,m);Wings.draw(pg,e,F,x,y,1,s,'back',m,.6);
          pg.drawImage(sheet,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
          Wings.draw(pg,e,F,x,y,1,s,'front',m,.6);ModelTiers.drawHalo(pg,e,F,x,y,1,s,m);
          pg.fillStyle='#294039';pg.font='12px sans-serif';pg.fillText(f+' '+(atk?'shoot':row===3?'idle':'walk')+' '+col+':'+row,col*200+5,(fi*7+pi*4+row)*180+14);
          frames++;
        }
      }
      return{hashes,wingChecks,frames,referencePixels,image:c.toDataURL().split(',')[1],poses:pc.toDataURL().split(',')[1]};
    })()`);
    save('archer-royal-levels.png',royal.image);
    save('archer-royal-poses.png',royal.poses);
    for(let f=0;f<2;f++)assert.equal(new Set(royal.hashes.slice(f*8,f*8+8)).size,8,'Every hair stage differs');
    assert(royal.wingChecks.every(Boolean),'Archer wings must differ from the swordsman');
    assert.equal(royal.frames,112);
    const proportions=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1600;c.height=1520;
      const g=c.getContext('2d');g.fillStyle='#d8e4de';g.fillRect(0,0,c.width,c.height);
      let checked=0,maxCollarDelta=0;
      for(const [fi,f]of ['dharma','adharma'].entries()){
        const m=arcMeta.walk[f],key=ModelTiers.key(f,false,'archer');
        const sheet=ArmorLook.sheet(f,false,[7,7,7,7],7,null,'archer',10).sheet;
        for(let col=0;col<8;col++){
          const idle=ArcherRoyal.frame(key,3,col);
          for(const [ri,row]of [3,0,1,2].entries()){
            const a=ArcherRoyal.frame(key,row,col),raw=ArcherGear.anchor(f,false,row,col).body;
            const foot=ArcherPose.point(key,row,col,m.anchorX,m.anchorY);
            if(Math.hypot(foot[0]-m.anchorX,foot[1]-m.anchorY)>1e-6)throw new Error('Foot anchor moved');
            if(row!==3){
              const delta=Math.hypot(a.cx-idle.cx,a.neck-idle.neck);
              maxCollarDelta=Math.max(delta,maxCollarDelta);
              if(delta>2.2)throw new Error('Idle/walk collar jumps: '+f+' '+col+':'+row);
              if(Math.abs(a.headH-idle.headH)>.01)throw new Error('Head proportions differ');
              if(Math.abs(a.cx-raw[0])+Math.abs(a.neck-raw[1])<1)throw new Error('Walk correction missing');
              checked++;
            }
            const x=fi*800+ri*200+100,y=col*190+168,s=.8;
            const F={atk:false,dir:C.DIR_COL.indexOf(col),frame:row},e={cls:'archer',faction:f,lvl:130,x,y,wt:10};
            g.strokeStyle='#a8bab1';g.beginPath();g.moveTo(x-90,y);g.lineTo(x+90,y);g.stroke();
            Wings.draw(g,e,F,x,y,1,s,'back',m,.7);
            g.drawImage(sheet,col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
            ModelTiers.drawHalo(g,e,F,x,y,1,s,m);
            g.fillStyle='#294039';g.font='13px sans-serif';g.textAlign='center';
            g.fillText(f+' / '+['S','SE','E','NE','N','NW','W','SW'][col]+' / '+(row===3?'idle':'walk '+row),x,col*190+18);
          }
        }
      }
      return {checked,maxCollarDelta,image:c.toDataURL().split(',')[1]};
    })()`);
    save('archer-size-balance.png',proportions.image);
    assert.equal(proportions.checked,48);
    const darkLook=await run(`(()=>{
      const m=arcMeta.walk.adharma,key='arc-walk-adharma',hair=[],wings=[];
      const gallery=document.createElement('canvas');gallery.width=1280;gallery.height=800;
      const gg=gallery.getContext('2d');gg.fillStyle='#d8e4de';gg.fillRect(0,0,1280,800);
      let limbs=0;
      for(let tier=0;tier<=10;tier++){
        const sheet=ArmorLook.sheet('adharma',false,[0,0,0,0],0,null,'archer',tier).sheet;
        const data=sheet.getContext('2d').getImageData(0,0,sheet.width,sheet.height).data;
        for(let col=0;col<8;col++){
          const b=ArcherGear.anchor('adharma',false,3,col).bow;
          if(b)for(const k of [0,4]){
            const side=b[6]??(b[k]>=b[2]?1:-1);
            for(let n=1;n<=20;n++){
              const t=n/20,x=Math.round(b[2]+(b[k]-b[2])*t+Math.sin(t*Math.PI)*side*7),y=Math.round(b[3]+(b[k+1]-b[3])*t);
              if(data[((3*m.frameHeight+y)*sheet.width+col*m.frameWidth+x)*4+3]<80)throw new Error('Broken bow limb '+tier+' / '+col+' / '+k+' / '+n);
            }
            limbs++;
          }
          const row=[0,1,5,10].indexOf(tier);
          if(row>=0){
            gg.drawImage(sheet,col*m.frameWidth,3*m.frameHeight,m.frameWidth,m.frameHeight,col*160,200*row+15,m.frameWidth*.8,m.frameHeight*.8);
            gg.fillStyle='#294039';gg.font='13px sans-serif';gg.textAlign='center';gg.fillText('Bow Lv.'+(tier?tier*10:1)+' / '+col,col*160+80,row*200+180);
          }
        }
      }
      for(let tier=1;tier<8;tier++){
        const sheet=ArmorLook.sheet('adharma',false,[0,0,0,0],tier,null,'archer',0).sheet;
        const d=sheet.getContext('2d').getImageData(0,0,sheet.width,sheet.height).data;
        const a=ArcherRoyal.frame(key,3,0);let sum=0,count=0;
        for(const p of a.indices)if(d[p*4+3]>220){sum+=d[p*4]*.23+d[p*4+1]*.57+d[p*4+2]*.2;count++;}
        hair.push(sum/count);
        if(tier>=4){
          const c=document.createElement('canvas');c.width=400;c.height=400;
          const g=c.getContext('2d'),e={cls:'archer',faction:'adharma',lvl:ModelTiers.LEVELS[tier],x:200,y:280};
          Wings.draw(g,e,{atk:false,dir:2,frame:3},200,280,1,1,'back',m);
          const p=g.getImageData(0,0,400,400).data;let weight=0,r=0,b=0,lum=0;
          for(let i=0;i<p.length;i+=4){const a=p[i+3];weight+=a;r+=p[i]*a;b+=p[i+2]*a;lum+=(p[i]*.23+p[i+1]*.57+p[i+2]*.2)*a;}
          wings.push({red:r/weight,blue:b/weight,luminance:lum/weight});
        }
      }
      return {limbs,hair,wings,image:gallery.toDataURL().split(',')[1]};
    })()`);
    save('archer-dark-bows.png',darkLook.image);
    assert.equal(darkLook.limbs,154,'Both limbs in seven visible directions, all eleven bow levels');
    for(let i=1;i<darkLook.hair.length;i++)assert(darkLook.hair[i]<darkLook.hair[i-1],'Higher level hair gets darker');
    assert(darkLook.wings.every(w=>w.red>w.blue*1.3),'Dark wings use red, not violet');
    assert(darkLook.wings[3].luminance<darkLook.wings[0].luminance,'Queen wings get darker');
    const rims=await run(`(()=>{
      const c=document.createElement('canvas');c.width=1440;c.height=1080;
      const g=c.getContext('2d');g.fillStyle='#d8e4de';g.fillRect(0,0,c.width,c.height);
      let maxAlpha=0,checked=0;
      const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      for(const [fi,f]of ['dharma','adharma'].entries())for(const atk of [false,true]){
        const m=arcMeta[atk?'attack':'walk'][f];
        for(let grade=1;grade<=5;grade++){
          const args=[f,atk,[7,7,7,7],6,Array(5).fill(grade),'archer',10];
          const look=ArmorLook.sheet(...args),w=look.sheet.width,h=look.sheet.height;
          if(ArmorLook.sheet(...args).rim!==look.rim)throw new Error('Rim not cached');
          const a=look.sheet.getContext('2d').getImageData(0,0,w,h).data;
          const aligned=canvas(w,h),align=aligned.getContext('2d'),R=look.rimMeta;
          for(let row=0;row<h/m.frameHeight;row++)for(let col=0;col<8;col++)
            align.drawImage(look.rim,col*R.fw+R.pad,row*R.fh+R.pad,m.frameWidth,m.frameHeight,
              col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight);
          const b=align.getImageData(0,0,w,h).data;
          let visible=0;
          for(let i=3;i<b.length;i+=4){
            maxAlpha=Math.max(maxAlpha,b[i]);visible+=b[i];
            if(a[i]===255&&b[i]!==0)throw new Error('Grade light covers opaque character art');
          }
          if(!visible)throw new Error('Grade light disappeared');checked++;
          const gi=[1,3,5].indexOf(grade);if(gi<0)continue;
          const col=ArmorLook.lightOf(f,grade,'archer'),tint=canvas(w,h),tg=tint.getContext('2d');
          tg.drawImage(look.sheet,0,0);tg.globalCompositeOperation='source-in';tg.fillStyle=col;tg.fillRect(0,0,w,h);
          const old=canvas(w,h),og=old.getContext('2d'),r=[0,2,2.2,2.5,2.8,3.2][grade];
          for(const rr of [r,r*.55])for(let n=0;n<16;n++)og.drawImage(tint,Math.cos(n*Math.PI/8)*rr,Math.sin(n*Math.PI/8)*rr);
          og.globalCompositeOperation='destination-out';og.drawImage(look.sheet,0,0);
          let before=old;
          if(grade>=3){
            before=canvas(w,h);const bg=before.getContext('2d');bg.shadowColor=col;bg.shadowBlur=[0,0,0,1,1.5,2][grade];
            bg.drawImage(old,0,0);bg.shadowBlur=0;bg.globalCompositeOperation='destination-out';bg.drawImage(look.sheet,0,0);
          }
          for(const [pi,row]of (atk?[[2,1]]:[[0,3],[1,1]])){
            for(const [vi,rim]of [before,look.rim].entries()){
              const x=gi*480+vi*240+120,y=(fi*3+pi)*180+157,s=.78;
              const F={atk,dir:2,frame:row},e={cls:'archer',faction:f,lvl:100,x,y,wt:10};
              Wings.draw(g,e,F,x,y,1,s,'back',m,.65);
              g.save();g.globalAlpha=vi?.94:.85;
              if(vi)g.drawImage(rim,0,row*R.fh,R.fw,R.fh,x-(m.anchorX+R.pad)*s,y-(m.anchorY+R.pad)*s,R.fw*s,R.fh*s);
              else g.drawImage(rim,0,row*m.frameHeight,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
              g.restore();
              g.drawImage(look.sheet,0,row*m.frameHeight,m.frameWidth,m.frameHeight,x-m.anchorX*s,y-m.anchorY*s,m.frameWidth*s,m.frameHeight*s);
              ModelTiers.drawHalo(g,e,F,x,y,1,s,m);
              g.fillStyle='#294039';g.font='13px sans-serif';g.textAlign='center';
              g.fillText(f+' '+['idle','walk','shoot'][pi]+' / G'+grade+' / '+(vi?'after':'before'),x,(fi*3+pi)*180+18);
            }
          }
        }
      }
      return {checked,maxAlpha,image:c.toDataURL().split(',')[1]};
    })()`);
    save('archer-soft-outline.png',rims.image);
    assert.equal(rims.checked,20);
    assert(rims.maxAlpha<=82,'Archer grade light stays below 33% opacity');
    await run(`(()=>{
      document.activeElement?.blur();document.getElementById('login').classList.add('hidden');
      let spawn;
      outer:for(let y=20;y<G.map.h-20;y++)for(let x=20;x<G.map.w-20;x++)
        if(Array.from({length:9},(_,i)=>C.canStand(G.map,(x+i)*C.TILE,y*C.TILE)).every(Boolean)){spawn={x:x*C.TILE,y:y*C.TILE};break outer;}
      if(!spawn)throw new Error('No corridor');
      const e={kind:'p',id:'archer-local-review',...spawn,tx:spawn.x,ty:spawn.y,dir:2,cls:'archer',faction:'dharma',
        lvl:100,name:'Archer Lv.100',hp:100,mhp:100,flash:0,wt:10,wp:7,wg:3,ar:[7,7,7,7],gg:[3,3,3,3,3]};
      CharacterMotion.reset(e);G.me=e;G.myId=e.id;G.ents.clear();G.ents.set(e.id,e);G.speed=215;G.stats=null;
      window.arcRows=[];const old=SpriteDetail.sheet;
      SpriteDetail.sheet=function(...args){arcRows.push(args[6]);return old.apply(this,args);};
    })()`);
    await pause(500);
    const idle=await run('arcRows.splice(0)');
    assert(idle.length>0&&idle.every(r=>r===3),'Idle must use the reference turnaround');
    const start=await run('G.me.x');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD'});await pause(1100);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD'});
    const walk=await run('arcRows.splice(0)'),distance=await run('G.me.x-'+start);
    assert(walk.includes(0)&&walk.includes(2)&&walk.slice(-10).every(r=>r<3),'Consistent walk cycle');
    assert(distance>130&&distance<290,'Movement distance');
    await pause(350);await run('arcRows.length=0');await pause(250);
    assert((await run('arcRows.splice(0)')).every(r=>r===3),'Stop returns to reference turnaround');
    // Repeat the real input transition for the independently drawn dark elf.
    await run("G.me.faction='adharma';arcRows.length=0");
    await pause(200);
    assert((await run('arcRows.splice(0)')).every(r=>r===3),'Dark elf idle');
    const darkStart=await run('G.me.x');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA'});await pause(1000);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});
    const darkWalk=await run('arcRows.splice(0)'),darkDistance=await run(darkStart+'-G.me.x');
    assert(darkWalk.includes(0)&&darkWalk.includes(2),'Dark elf walk cycle');
    assert(darkDistance>130&&darkDistance<290,'Dark elf movement distance');
    await pause(350);await run('arcRows.length=0');await pause(250);
    assert((await run('arcRows.splice(0)')).every(r=>r===3),'Dark elf stop returns to turnaround');
    // Render actual attack transitions for every skill and direction, both factions.
    const attacks=await run(`(async()=>{
      let count=0;
      for(const faction of ['dharma','adharma']){
        G.me.faction=faction;
        for(let dir=0;dir<8;dir++)for(const kind of ['arrow','multishot','vault','pierce','rain','snipe','eagle','net','phoenix'])
          for(const p of [.1,.48,.85]){
            G.me.atk={kind,dir,t0:performance.now()-p*1000,dur:1000};
            await new Promise(requestAnimationFrame);count++;
          }
      }G.me.atk=null;G.me.faction='dharma';G.me.dir=2;return count;
    })()`);
    await pause(250);save('archer-in-game.png',(await send('Page.captureScreenshot',{format:'png'})).data);
    const cache=await run(`(()=>{
      const e=G.me,a=ArmorLook.sheet(e.faction,false,e.ar,6,e.gg,'archer',e.wt).sheet;
      const cv=document.createElement('canvas'),cg=cv.getContext('2d'),F={atk:false,dir:2,frame:3},m=arcMeta.walk[e.faction];
      Wings.draw(cg,e,F,80,120,1,.5,'back',m);
      const old=CanvasRenderingContext2D.prototype.getImageData;let reads=0;
      CanvasRenderingContext2D.prototype.getImageData=function(...args){reads++;return old.apply(this,args);};
      try{for(let i=0;i<100;i++){
        if(ArmorLook.sheet(e.faction,false,e.ar,6,e.gg,'archer',e.wt).sheet!==a)throw new Error('Cache miss');
        F.frame=i%4;
        Wings.draw(cg,e,F,80,120,1,.5,'back',m);ModelTiers.drawHalo(cg,e,F,80,120,1,.5,m);
      }return reads;}
      finally{CanvasRenderingContext2D.prototype.getImageData=old;}
    })()`);
    assert.equal(cache,0);assert.equal(errors.length,0,JSON.stringify(errors));
    const report={bowVariants:22,outfitVariants:14,slotVariants:slots,armourIcons:details.iconCount,unchangedHeads:details.checkedHeads,poses:poses.count,royalHairStages:royal.hashes.length,distinctWings:royal.wingChecks.length,idleFrame:3,referencePixels:royal.referencePixels,repairedBowLimbs:darkLook.limbs,darkHairLuminance:darkLook.hair,darkWingColors:darkLook.wings,rimChecks:rims.checked,maxRimAlpha:rims.maxAlpha,balancedWalkPoses:proportions.checked,maxCollarDelta:proportions.maxCollarDelta,attackStages:attacks,walkDistance:distance,darkWalkDistance:darkDistance,walkFrames:[...new Set(walk)],cachedPixelReads:cache,errors};
    fs.writeFileSync(path.join(out,'archer-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
