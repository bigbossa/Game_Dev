// V2: alpha-preserving high-resolution bodies WITH their painted, held spear.
const fs=require('fs'),path=require('path'),L=require('./img-lib');
const {mirror,trim}=require('./sheet-cut');
const darkHair=process.argv.includes('--adharma-hair');
const root=path.join(__dirname,'..'),out=path.join(root,darkHair?'public/assets/adharma-hair':'public/assets');
fs.mkdirSync(out,{recursive:true});
const FW=320,FH=280,AX=160,AY=252,SCALE=.72;
const meta={version:darkHair?3:2,heldWeapon:true,walk:{},attack:{}};
if(darkHair)meta.styles={};
// Reviewed art landmarks. A weapon tip must never become a head or foot anchor.
const cols=[0,325,585,875,1130,1402],rows=[0,291,563,835,1122];
const centres=[161,454,739,999,1262],feet=[284,556,827,1080],head=[18,299,575,847];
const dirs=[0,1,2,3,4,3,2,1];
const tipX=[55,369,658,916,1342],gripX=[85,400,686,949,1325];
const attackTip=[[143,1085],[568,1085],[866,1036],[1138,846],[1374,839]];
const attackGrip=[[150,986],[464,996],[737,990],[1050,947],[1295,956]];
const hairRigs=darkHair?JSON.parse(fs.readFileSync(path.join(root,'class-art/demon-models/spearman-rig.json'))):null;
function cell(src,c,r,rig){
  const x0=cols[c],y0=rows[r],w=cols[c+1]-x0,h=rows[r+1]-y0,d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const si=((y+y0)*src.width+x+x0)*4,i=(y*w+x)*4;d.set(src.data.subarray(si,si+4),i);
    if(d[i+3]<48)d[i+3]=0;
  }
  // Discard disconnected alpha-matte dust and tiny slivers from a neighbouring cell.
  const seen=new Uint8Array(w*h),parts=[];
  for(let k=0;k<w*h;k++){
    if(seen[k]||!d[k*4+3])continue;const q=[k];seen[k]=1;
    for(let j=0;j<q.length;j++){
      const p=q[j],x=p%w,y=Math.floor(p/w);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,n=ny*w+nx;
        if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[n]&&d[n*4+3]){seen[n]=1;q.push(n);}
      }
    }parts.push(q);
  }
  const largest=Math.max(...parts.map(p=>p.length));
  for(const p of parts)if(p.length<largest&&(p.length<Math.max(35,largest*.025)||p.some(k=>k%w<3||k%w>=w-3)))for(const k of p)d[k*4+3]=0;
  let foot=feet[r];
  if(darkHair){
    // Find the dark soles, not the red spear point, independently for each edited hair variant.
    for(let y=Math.max(y0,feet[r]-18);y<Math.min(rows[r+1],feet[r]+21);y++){
      let n=0;for(let x=Math.max(x0,centres[c]-80);x<Math.min(cols[c+1],centres[c]+80);x++){
        const i=((y-y0)*w+x-x0)*4;
        if(d[i+3]>180&&Math.max(d[i],d[i+1],d[i+2])<130&&Math.min(d[i],d[i+1],d[i+2])>8)n++;
      }if(n>=4)foot=y;
    }
  }
  const im=L.scaleImg({w,h,d},SCALE),frame={w:FW,h:FH,d:new Uint8ClampedArray(FW*FH*4)};
  L.blit(frame.d,FW,FH,im,Math.round(AX-(centres[c]-x0)*SCALE),Math.round(AY-(foot-y0)*SCALE));
  const point=([x,y])=>[AX+(x-centres[c])*SCALE,AY+(y-foot)*SCALE];
  return {img:frame,headTop:AY-(foot-head[r])*SCALE,bodyHeight:(foot-head[r])*SCALE,
    tip:point(r===3?attackTip[c]:rig?rig.tips[r][c]:[tipX[c],rows[r]+6]),grip:point(r===3?attackGrip[c]:rig?rig.grips[r][c]:[gripX[c],rows[r]+180])};
}
for(const faction of (darkHair?['adharma']:['dharma','adharma']))for(const style of (darkHair?['short','medium','long','royal']:['long','short'])){
  const short=style==='short',suffix=style==='long'?'':'-'+style;
  // Inventory icon retained from the original modelทวน reference; never overlaid on the body.
  fs.copyFileSync(path.join(root,'class-art/spearman-v2',`${faction}-weapon-icon.png`),path.join(out,`spearman-${faction}-weapon.png`));
  const src=L.readPng(path.join(root,darkHair?'class-art/demon-models':'class-art/spearman-v2',darkHair?`spearman-${style}-source.png`:`${faction}${short?'-short':''}-source.png`));
  if(Math.abs(src.width-1402)>1||Math.abs(src.height-1122)>1)throw Error('Source layout changed: review landmarks before packing');
  const source=Array.from({length:4},(_,r)=>Array.from({length:5},(_,c)=>cell(src,c,r,hairRigs?.[style])));
  const expand=row=>dirs.map((c,i)=>({...row[c],img:i>4?mirror(row[c].img):row[c].img,
    tip:i>4?[FW-1-row[c].tip[0],row[c].tip[1]]:row[c].tip,
    grip:i>4?[FW-1-row[c].grip[0],row[c].grip[1]]:row[c].grip}));
  const walk=[expand(source[1]),expand(source[0]),expand(source[2]),expand(source[0])];
  const attack=[expand(source[0]),expand(source[3]),expand(source[0])];
  for(const [pose,frames] of [['walk',walk],['attack',attack]]){
    const W=FW*8,H=FH*frames.length,d=new Uint8ClampedArray(W*H*4),poseFrames=[];
    frames.forEach((row,r)=>row.forEach((f,c)=>{
      L.blit(d,W,H,f.img,c*FW,r*FH);
      poseFrames.push({headTop:Math.round(f.headTop),bodyHeight:Math.round(f.bodyHeight),headX:AX,
        neckY:Math.round(f.headTop+f.bodyHeight*.53),feetX:AX,feetY:AY,weaponTip:f.tip,grip:f.grip});
    }));
    L.writePng(path.join(out,`spearman-${faction}${suffix}${pose==='attack'?'-attack':''}.png`),W,H,d);
    const entry={frameWidth:FW,frameHeight:FH,anchorX:AX,anchorY:AY,framesPerDir:frames.length,
      heldWeapon:true,poseFrames,weaponPts:frames.flat().map(f=>[[f.tip[0]-AX,f.tip[1]-AY]])};
    if(style==='long')meta[pose][faction]=entry;
    if(darkHair){meta.styles[style]??={walk:{},attack:{}};meta.styles[style][pose][faction]=entry;}
  }
  const face=trim(source[0][0].img);if(short)L.writePng(path.join(out,`spearman-${faction}-portrait.png`),face.w,face.h,face.d);
  console.log(`${faction}: ${FW}x${FH}, held spear, 8 directions, stable body/feet landmarks`);
}
fs.writeFileSync(path.join(out,'spearman.json'),JSON.stringify(meta));
