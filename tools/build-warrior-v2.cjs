// นักรบแนวหน้า V2 from the packed V1 atlases (public/assets/warrior-v1): per-frame paint masks and head landmarks
// for the knight helmet / hair-length / armour-colour look drawn live by public/js/warrior-look.js.
//   mask atlas  R = hair (recoloured per level tier), G = 255 cloth + shield field (recoloured per armour set),
//               G = 128 cool steel of the blade (tinted per weapon tier),
//               B = topknot above the helmet bowl (erased: the helmet covers it)
//   model.json  V1 metadata + landmarks[f][pose][i].head = { x0, x1, top, dome, bottom, face } in frame px
// With --v3, analyse the new painted helmet without erasing its crest. npm run warrior uses this mode.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require('./img-lib');
const paintedHelmet=process.argv.includes('--v3');
const nativeHair=process.argv.includes('--v4');
const root=path.join(__dirname,'..'),src=path.join(root,'public/assets',nativeHair?'warrior-v4':paintedHelmet?'warrior-v3':'warrior-v1'),out=path.join(root,'public/assets',nativeHair?'warrior-v4':paintedHelmet?'warrior-v3':'warrior-v2');
fs.mkdirSync(out,{recursive:true});
const meta=JSON.parse(fs.readFileSync(path.join(src,'model.json'),'utf8'));
const FW=meta.frameWidth,FH=meta.frameHeight;
// the painted hair and cloth share one hue family per faction: ธรรมะ teal-blue, อธรรม violet-crimson
const paintOf=(f,r,g,b)=>{const [h,s,l]=L.rgb2hsl(r,g,b);return s>0.12&&l<0.7&&(f==='adharma'?h>=250||h<=15:h>=160&&h<=250);};
// bright cool steel (the dao's blade; the plate armour is warm silver-gold)
const steelOf=(r,g,b)=>{const [h,s,l]=L.rgb2hsl(r,g,b);return l>=0.5&&s<0.6&&h>=180&&h<=250;};
for(const faction of ['dharma','adharma']){
  for(const pose of ['walk','attack']){
    const im=L.readPng(path.join(src,`${faction}-${pose}.png`)),W=im.width,H=im.height,D=im.data,rows=H/FH;
    const mask=new Uint8ClampedArray(W*H*4),marks=meta.landmarks[faction][pose];
    for(let r=0;r<rows;r++)for(let c=0;c<8;c++){
      const X=c*FW,Y=r*FH,m=marks[r*8+c],headTop=m.headTop,BH=m.feetY-headTop;
      const at=(x,y)=>((Y+y)*W+X+x)*4,blue=new Uint8Array(FW*FH);
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){const i=at(x,y);if(D[i+3]>=110&&paintOf(faction,D[i],D[i+1],D[i+2]))blue[y*FW+x]=1;}
      // connected painted regions: the ones starting near the head top are hair, the rest is cloth / shield field
      const comp=new Int32Array(FW*FH).fill(-1),hairComp=new Set();let n=0,main=-1,mainN=0;
      for(let k=0;k<FW*FH;k++)if(blue[k]&&comp[k]<0){
        const q=[k];comp[k]=n;let minY=FH;
        for(let j=0;j<q.length;j++){const v=q[j],x=v%FW,y=v/FW|0;minY=Math.min(minY,y);
          for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=ny*FW+nx;
            if(nx>=0&&nx<FW&&ny>=0&&ny<FH&&blue[nk]&&comp[nk]<0){comp[nk]=n;q.push(nk);}}}
        if(minY<headTop+BH*0.3&&q.length>120){hairComp.add(n);if(q.length>mainN){mainN=q.length;main=n;}}n++;
      }
      let top=FH,bottom=-1;const rowW=new Int32Array(FH);
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){const k=y*FW+x;if(comp[k]<0)continue;const i=at(x,y);
        if(!hairComp.has(comp[k])){mask[i+1]=steelOf(D[i],D[i+1],D[i+2])?128:255;continue;}
        mask[i]=255;if(comp[k]===main){top=Math.min(top,y);bottom=Math.max(bottom,y);rowW[y]++;}}
      assert(main>=0,`no hair found in ${faction}-${pose} frame ${r}/${c}`);
      // helmet bowl top: first hair row at 55% of the widest row (the topknot above it is narrower)
      const widest=Math.max(...rowW);let dome=top;while(dome<bottom&&rowW[dome]<widest*0.55)dome++;
      // head width from the upper half of the main hair mass only (a raised sleeve can touch its lower edge)
      let x0=FW,x1=-1;
      for(let y=dome;y<dome+(bottom-dome)*0.5;y++)for(let x=0;x<FW;x++)if(comp[y*FW+x]===main){x0=Math.min(x0,x);x1=Math.max(x1,x);}
      if(!paintedHelmet&&!nativeHair)for(let y=0;y<dome+2;y++)for(let x=Math.max(0,x0-4);x<=Math.min(FW-1,x1+4);x++){const i=at(x,y);if(D[i+3])mask[i+2]=255;}
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){const k=y*FW+x,i=at(x,y);
        if(comp[k]<0&&D[i+3]>=110&&steelOf(D[i],D[i+1],D[i+2]))mask[i+1]=128;
        if(mask[i]|mask[i+1]|mask[i+2])mask[i+3]=255;}
      // face top (first row with skin inside the head) keeps the helmet brim above the eyes; null on back views
      let face=null;
      for(let y=dome;y<bottom&&face===null;y++){let k=0;for(let x=x0;x<=x1;x++){const i=at(x,y);if(D[i+3]<110)continue;
        const [h,sa,l]=L.rgb2hsl(D[i],D[i+1],D[i+2]);if(h>=8&&h<=45&&sa>0.3&&l>=0.55&&l<=0.93)k++;}if(k>=6)face=y;}
      m.head={x0,x1,top,dome,bottom:Math.min(bottom,dome+85),face};
      if(paintedHelmet){
        // Read the helmet silhouette itself; the new cropped hair is much narrower than the helmet.
        let left=FW,right=0;
        const upper=Math.round(headTop+BH*.13),lower=Math.round(headTop+BH*.31);
        for(let y=upper;y<=lower;y++)for(let x=90;x<=230;x++)if(D[at(x,y)+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
        m.head={x0:left,x1:right,top:headTop,dome:headTop+16,bottom:Math.round(headTop+BH*.46),face};
      }
    }
    L.writePng(path.join(out,`${faction}-${pose}-mask.png`),W,H,mask);
  }
}
meta.version=nativeHair?4:paintedHelmet?3:2;meta.source=nativeHair?'warrior-v4':paintedHelmet?'warrior-v3':'warrior-v1';
fs.writeFileSync(path.join(out,'model.json'),JSON.stringify(meta));
console.log(`PASS: warrior V${meta.version} masks + head landmarks, 2 factions × (walk + attack).`);
