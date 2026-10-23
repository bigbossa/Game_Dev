// Pack the painted Taoist turnarounds without redrawing their artwork.
// Source cuts and anatomical landmarks live in class-art/taoist-v2/rig.json.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const L = require('./img-lib'), { mirror, trim } = require('./sheet-cut');
const root = path.join(__dirname, '..'), source = path.join(root, 'class-art/taoist-v2');
const out = path.join(root, 'public/assets/taoist-v2');
const rig = JSON.parse(fs.readFileSync(path.join(source, 'rig.json'), 'utf8'));
const FW = 256, FH = 240, AX = 128, AY = 220;
const dirs = [0, 1, 2, 3, 4, 3, 2, 1];
const meta = { version: 2, walk: {}, attack: {} };
fs.mkdirSync(out, { recursive: true });

function cut(src, bounds) {
  const [x0, y0, x1, y1] = bounds, w = x1-x0, h = y1-y0;
  const d = new Uint8ClampedArray(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const a=((y+y0)*src.width+x+x0)*4, b=(y*w+x)*4;
    d.set(src.data.subarray(a,a+4),b);
  }
  // Ignore isolated matte specks; keep the supplied alpha along painted edges.
  const seen=new Uint8Array(w*h), parts=[];
  for(let k=0;k<w*h;k++) if(!seen[k] && d[k*4+3]>24) {
    const q=[k];seen[k]=1;
    for(let n=0;n<q.length;n++) {
      const v=q[n],x=v%w,y=Math.floor(v/w);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const nx=x+dx,ny=y+dy,i=ny*w+nx;
        if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[i]&&d[i*4+3]>24){seen[i]=1;q.push(i);}
      }
    }
    parts.push(q);
  }
  const largest=Math.max(...parts.map(p=>p.length));
  assert(largest>2500, 'Missing painted figure: '+bounds);
  for(const p of parts) {
    const neighbour=p.length<largest&&p.some(k=>k%w===0||k%w===w-1||k<w||k>=w*(h-1));
    if(neighbour||p.length<Math.max(35,largest*.004))for(const k of p)d[k*4+3]=0;
  }
  for(let k=0;k<w*h;k++)if(d[k*4+3]<=24)d[k*4+3]=0;
  return trim({w,h,d});
}

function frame(img, landmark, scale) {
  const scaled=L.scaleImg(img,scale), d=new Uint8ClampedArray(FW*FH*4);
  const footX=img.w*landmark.footX, footY=img.h-1;
  const ox=Math.round(AX-footX*scale),oy=Math.round(AY-footY*scale);
  assert(ox>=3&&oy>=3&&ox+scaled.w<FW-3&&oy+scaled.h<FH-3,'Figure exceeds atlas cell');
  L.blit(d,FW,FH,scaled,ox,oy);
  const point=([x,y])=>[ox+x*img.w*scale,oy+y*img.h*scale];
  const shoulder=point(landmark.collar);
  return {img:{w:FW,h:FH,d}, headTop:point([landmark.footX,landmark.headTop])[1],
    shoulder:[...shoulder,landmark.span*img.w*scale,0],
    whisk:landmark.whisk?landmark.whisk.flatMap(point):null};
}

function flipped(f) {
  return {...f,img:mirror(f.img),shoulder:[FW-1-f.shoulder[0],f.shoulder[1],f.shoulder[2],-f.shoulder[3]],
    whisk:f.whisk?[FW-1-f.whisk[0],f.whisk[1],FW-1-f.whisk[2],f.whisk[3]]:null};
}

function masks(d,W,H,frames,faction) {
  const mask=new Uint8ClampedArray(d.length), blank=new Uint8ClampedArray(d.length);
  frames.flat().forEach((f,n)=>{
    const X=(n%8)*FW,Y=Math.floor(n/8)*FH,cy=f.shoulder[1],cx=f.shoulder[0];
    for(let y=Math.ceil(cy+4);y<AY;y++)for(let x=0;x<FW;x++) {
      const i=((Y+y)*W+X+x)*4;
      if(d[i+3]<80)continue;
      const [r,g,b]=d.subarray(i,i+3),[h,s,l]=L.rgb2hsl(r,g,b);
      // Keep skin, gold, gourd, paper talismans and whisk hair untouched.
      const warm=r>b+24&&h>12&&h<65;
      const accent=faction==='dharma'?h>175&&h<255&&s>.22:(h<14||h>335)&&s>.35;
      if(warm||(!accent&&s>.25))continue;
      if(f.whisk){const [wx,wy,tx,ty]=f.whisk,dx=tx-wx,dy=ty-wy;
        const t=Math.max(0,Math.min(1,((x-wx)*dx+(y-wy)*dy)/(dx*dx+dy*dy)));
        if(Math.hypot(x-wx-dx*t,y-wy-dy*t)<20)continue;}
      const rel=Math.abs(x-cx),half=f.shoulder[2];
      const slot=y>AY-23&&rel<half?1:rel>half*1.12?2:0;
      const value=accent?255:l>.6||l<.32?90:0;
      if(value){mask[i+slot]=value;mask[i+3]=255;}
    }
  });
  return [mask,blank];
}

for(const faction of ['dharma','adharma']) {
  const src=L.readPng(path.join(source,faction+'-source.png')),spec=rig[faction];
  assert.deepEqual([src.width,src.height],spec.size);
  const cells=Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>{
    const img=cut(src,[spec.cols[c],spec.rowStarts?.[r]??spec.rows[r],spec.cols[c+1],spec.rows[r+1]]);
    const lm=spec.landmarks[r][c];
    // Consistent head size, with authored crouching/casting proportions preserved.
    return frame(img,lm,84/(img.h*(lm.collar[1]-lm.headTop)));
  }));
  const expand=row=>dirs.map((c,i)=>i>4?flipped(row[c]):row[c]);
  for(const [pose,rows] of [['walk',[1,0,2,0]],['attack',[0,3,4]]]) {
    const frames=rows.map(r=>expand(cells[r])),W=FW*8,H=FH*frames.length,d=new Uint8ClampedArray(W*H*4);
    frames.forEach((row,r)=>row.forEach((f,c)=>L.blit(d,W,H,f.img,c*FW,r*FH)));
    L.writePng(path.join(out,`taoist-${faction}${pose==='attack'?'-attack':''}.png`),W,H,d);
    meta[pose][faction]={frameWidth:FW,frameHeight:FH,anchorX:AX,anchorY:AY,framesPerDir:rows.length,
      normalizedPose:true,paintedTaoist:true,poseFrames:frames.flat().map(({img,...f})=>f)};
    const [mask,blank]=masks(d,W,H,frames,faction);
    L.writePng(path.join(out,`armor-tao-${pose}-${faction}.png`),W,H,mask);
    L.writePng(path.join(out,`armor2-tao-${pose}-${faction}.png`),W,H,blank);
  }
  const portrait=cut(src,[spec.cols[0],spec.rows[0],spec.cols[1],spec.rows[1]]);
  L.writePng(path.join(out,`taoist-${faction}-portrait.png`),portrait.w,portrait.h,portrait.d);
}
fs.writeFileSync(path.join(out,'taoist.json'),JSON.stringify(meta,null,2)+'\n');
console.log('Built Taoist v2: two factions, eight directions, four walk / three cast frames, portraits and armour masks.');
