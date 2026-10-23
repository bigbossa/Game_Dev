// Pack generated painted artwork into the existing game's directional atlas convention.
// Preserve source alpha and art; only crop, remove isolated matte dust, scale and mirror.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require('./img-lib'),{mirror,trim}=require('./sheet-cut');
const root=path.join(__dirname,'..'),out=path.join(root,'public/assets/warrior-v4');
fs.mkdirSync(out,{recursive:true});
const FW=320,FH=280,AX=160,AY=252,SCALE=.72;
const cols=[0,305,590,875,1145,1402],rows=[0,309,609,897,1122],dirs=[0,1,2,3,4,3,2,1];
const meta={version:4,source:'warrior-v4',paintedHelmet:false,frameWidth:FW,frameHeight:FH,anchorX:AX,anchorY:AY,walkFrames:4,attackFrames:3,heldWeapon:true,landmarks:{}};
function cut(src,c,r){
  const x0=cols[c],y0=rows[r],w=cols[c+1]-x0,h=rows[r+1]-y0,d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,j=((y+y0)*src.width+x+x0)*4;d.set(src.data.subarray(j,j+4),i);if(d[i+3]<50)d[i+3]=0;}
  const seen=new Uint8Array(w*h),parts=[];
  for(let k=0;k<w*h;k++)if(!seen[k]&&d[k*4+3]){
    const q=[k];seen[k]=1;for(let j=0;j<q.length;j++){
      const v=q[j],x=v%w,y=Math.floor(v/w);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[n]&&d[n*4+3]){seen[n]=1;q.push(n);}}
    }parts.push(q);
  }
  const largest=Math.max(...parts.map(p=>p.length));
  for(const p of parts)if(p.length<Math.max(90,largest*.006))for(const k of p)d[k*4+3]=0;
  let foot=0,top=h;
  for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>128)n++;if(n>=8){foot=y;top=Math.min(top,y);}}
  let minX=w,maxX=0;
  for(let y=Math.max(0,foot-15);y<=foot;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
  const centre=(minX+maxX)/2,img=L.scaleImg({w,h,d},SCALE),frame={w:FW,h:FH,d:new Uint8ClampedArray(FW*FH*4)};
  L.blit(frame.d,FW,FH,img,Math.round(AX-centre*SCALE),Math.round(AY-foot*SCALE));
  assert(largest>4000,`empty source cell ${c}/${r}`);
  // Anchor the final resampled soles: asymmetric slash poses can otherwise shift sideways.
  let sole=0,head=FH,left=FW,right=0;
  for(let y=0;y<FH;y++){let n=0;for(let x=0;x<FW;x++)if(frame.d[(y*FW+x)*4+3]>128)n++;if(n>=5){sole=y;head=Math.min(head,y);}}
  for(let y=Math.max(0,sole-11);y<=sole;y++)for(let x=0;x<FW;x++)if(frame.d[(y*FW+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
  const anchored={w:FW,h:FH,d:new Uint8ClampedArray(FW*FH*4)},dy=AY-sole;
  L.blit(anchored.d,FW,FH,frame,Math.round(AX-(left+right)/2),dy);
  return {img:anchored,headTop:head+dy,feetY:AY,sourceCentre:Math.round(x0+centre),sourceFeet:y0+foot,
    sourceCell:[c,r],sourceScale:SCALE,sourceOffset:[Math.round(AX-centre*SCALE)+Math.round(AX-(left+right)/2),Math.round(AY-foot*SCALE)+dy]};
}
for(const faction of ['dharma','adharma']){
  const src=L.readPng(path.join(root,'class-art/warrior-v4',faction+'-source.png'));assert.equal(src.width,1402);assert.equal(src.height,1122);
  const cells=Array.from({length:4},(_,r)=>Array.from({length:5},(_,c)=>cut(src,c,r)));
  const expand=row=>dirs.map((c,i)=>({...row[c],img:i>4?mirror(row[c].img):row[c].img}));
  const walk=[expand(cells[1]),expand(cells[0]),expand(cells[2]),expand(cells[0])];
  const attack=[expand(cells[0]),expand(cells[3]),expand(cells[0])];
  meta.landmarks[faction]={};
  for(const [pose,frames]of [['walk',walk],['attack',attack]]){
    const W=FW*8,H=FH*frames.length,d=new Uint8ClampedArray(W*H*4);
    frames.forEach((row,r)=>row.forEach((f,c)=>L.blit(d,W,H,f.img,c*FW,r*FH)));
    L.writePng(path.join(out,`${faction}-${pose}.png`),W,H,d);
    meta.landmarks[faction][pose]=frames.flat().map(({img,...m})=>m);
  }
  const portrait=trim(cells[0][0].img);L.writePng(path.join(out,faction+'-portrait.png'),portrait.w,portrait.h,portrait.d);
}
fs.writeFileSync(path.join(out,'model.json'),JSON.stringify(meta,null,2));
console.log('PASS: painted warrior atlases, 8 directions × (4 walk + 3 attack) × 2 factions, preserved alpha, anchored soles.');
