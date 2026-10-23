const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.argv[2]||'http://localhost:3901',port=process.argv[3]||'9336',label=process.argv[4]||'after';
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
    const result=await run(`(async()=>{
      G.socket.disconnect();G.ents.clear();
      const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
      const gallery=make(1600,1120),g=gallery.getContext('2d');g.fillStyle='#28333f';g.fillRect(0,0,1600,1120);
      const heads=make(1600,960),hg=heads.getContext('2d');hg.fillStyle='#28333f';hg.fillRect(0,0,1600,960);
      const meta=await fetch('assets/spearman.json').then(r=>r.json());let frames=0;
      const measurements=[];
      for(const [fi,f]of ['dharma','adharma'].entries())for(const [pi,atk]of [false,true].entries()){
        const src=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src='assets/spearman-'+f+(atk?'-attack':'')+'.png';});
        const m=meta[atk?'attack':'walk'][f],out=SpearmanGear.compose(src,f,m,7,[0,0,0,0],10);
        const raw=make(src.width,src.height).getContext('2d');raw.drawImage(src,0,0);
        const before=raw.getImageData(0,0,src.width,src.height).data,after=out.getContext('2d').getImageData(0,0,out.width,out.height).data;
        for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
          const a=m.poseFrames[row*8+col];frames++;
          let faceChanged=0,facePixels=0,eyeChanged=0,eyePixels=0,missedHairBefore=0,missedHairAfter=0;
          const eyes=SpearmanGear.eyeRegions(m,row,col);
          // Skin in the face must retain its painted colour and alpha.
          for(let y=0;y<280;y++)for(let x=0;x<320;x++){
            const u=(x-a.headX)/a.bodyHeight,v=(y-a.headTop)/a.bodyHeight;
            const i=((row*280+y)*out.width+col*320+x)*4,r=before[i],gr=before[i+1],b=before[i+2];
            const eye=eyes.some(([ex,ey,rx,ry])=>((x-ex)/rx)**2+((y-ey)/ry)**2<1);
            if(eye&&before[i+3]>220){eyePixels++;if([0,1,2,3].some(ch=>before[i+ch]!==after[i+ch]))eyeChanged++;}
            // Regression: the old broad face guard left a blue horizontal strip
            // across side locks/nape; sample that strip outside the real irises.
            if(f==='dharma'&&!eye&&v>.435&&v<.52&&Math.abs(u)<.22&&before[i+3]>220&&b>r*1.12&&b>gr*1.03){
              const [tx,ty]=a.weaponTip,[hx,hy]=a.grip,dx=hx-tx,dy=hy-ty,L=Math.hypot(dx,dy);
              const along=((x-tx)*dx+(y-ty)*dy)/(L*L),dist=Math.abs((x-tx)*dy-(y-ty)*dx)/L;
              if(!(along>=-.06&&along<.48&&dist<a.bodyHeight*(.085-along*.075))){
                missedHairBefore++;if(after[i+2]>after[i]*1.12&&after[i+2]>after[i+1]*1.03)missedHairAfter++;
              }
            }
            if(v<.36||v>.57||Math.abs(u)>.25)continue;
            if(before[i+3]<220||!(r>gr*1.08&&gr>b*1.12&&r>150&&gr>94))continue;
            facePixels++;if([0,1,2,3].some(ch=>before[i+ch]!==after[i+ch]))faceChanged++;
          }
          measurements.push({f,atk,row,col,facePixels,faceChanged,eyePixels,eyeChanged,missedHairBefore,missedHairAfter});
          if(row===(atk?1:(${JSON.stringify(label)}==='source'?2:3))){
            const yy=(fi*2+pi)*280;g.drawImage(out,col*320,row*280,320,280,col*200,yy,200,175);
            const top=a.headTop+a.bodyHeight*.16,side=a.headX-65;
            hg.drawImage(${JSON.stringify(label)}==='source'?src:out,col*320+side,row*280+top,130,130,col*200,(fi*2+pi)*240,200,200);
            hg.fillStyle='#f7dfac';hg.font='13px sans-serif';hg.fillText(f+' '+(atk?'attack':'idle')+' '+col,col*200+12,(fi*2+pi)*240+222);
            g.fillStyle='#f7dfac';g.font='13px sans-serif';g.fillText(f+' '+(atk?'attack':'idle')+' '+col,col*200+12,yy+196);
          }
        }
      }
      return {frames,measurements,gallery:gallery.toDataURL(),heads:heads.toDataURL()};
    })()`);
    const out=path.join(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
    for(const field of ['gallery','heads']){fs.writeFileSync(path.join(out,'spearman-hair-'+field+'-'+label+'.png'),Buffer.from(result[field].split(',')[1],'base64'));delete result[field];}
    fs.writeFileSync(path.join(out,'spearman-hair-'+label+'.json'),JSON.stringify({...result,errors},null,2));
    assert.equal(errors.length,0);assert(result.measurements.every(m=>m.faceChanged===0),'Face skin was recoloured');
    assert(result.measurements.every(m=>m.eyeChanged===0),'Iris pixels were recoloured');
    assert(result.measurements.reduce((n,m)=>n+m.missedHairBefore,0)>1000,'Regression strip is not sampled');
    assert(result.measurements.every(m=>m.missedHairAfter===0),'Original blue remains in the side locks/nape');
    console.log(JSON.stringify({frames:result.frames,facePixels:result.measurements.reduce((n,m)=>n+m.facePixels,0),eyePixels:result.measurements.reduce((n,m)=>n+m.eyePixels,0),correctedHairPixels:result.measurements.reduce((n,m)=>n+m.missedHairBefore,0),remainingBlue:result.measurements.reduce((n,m)=>n+m.missedHairAfter,0)}));
  }finally{await send('Page.close').catch(()=>{});ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
