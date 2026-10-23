// Pack the new painted model, preserving alpha and reviewed anatomical/hand landmarks.
// Rebuild with node tools/build-dualblade-v2.cjs. Original character assets stay untouched.
const fs=require('node:fs'),path=require('node:path'),L=require('./img-lib');
const {mirror}=require('./sheet-cut');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'public/assets/dualblade-v2');
const darkHair=process.argv.includes('--adharma-hair');
fs.mkdirSync(dest,{recursive:true});
const cols=[0,300,600,865,1140,1402],rows=[0,288,574,850,1122];
const cx=[140,450,735,1005,1270],feet=[282,568,846,1104],tops=[5,292,576,852],scale=.52;
// Hilt -> tip, measured in source coordinates. Keep the hands; remove only the blade distal to the guard.
const hands=[
 [[62,210,4,253,206,209,285,256],[382,211,307,258,505,210,586,247],[670,209,610,261,766,204,842,251],[936,212,873,256,1050,212,1135,252],[1201,214,1143,255,1320,211,1396,253]],
 [[67,482,3,516,204,482,277,530],[384,482,310,533,513,479,592,515],[672,482,611,528,776,483,853,528],[945,479,880,522,1063,481,1134,526],[1208,484,1143,526,1327,483,1397,525]],
 [[64,770,3,801,214,771,293,812],[389,769,310,818,519,770,592,808],[680,773,617,812,779,772,857,815],[947,770,878,814,1069,774,1137,815],[1207,772,1143,813,1326,771,1398,814]],
 [[52,964,5,909,222,1029,308,1064],[388,963,316,931,517,1029,590,1054],[680,981,603,958,780,1027,858,1052],[937,1004,866,1032,1090,963,1135,910],[1204,983,1142,1002,1329,960,1398,907]]
];
const dirs=[0,1,2,3,4,3,2,1],meta={version:2,scale,walk:{frameWidth:172,frameHeight:187,anchorX:86,anchorY:185,framesPerDir:3},attack:{frameWidth:262,frameHeight:193,anchorX:131,anchorY:191,framesPerDir:3},frames:{},weapons:{}};
function sourceCell(src,c,r,reference){
 const x0=cols[c],y0=rows[r],w=cols[c+1]-x0,h=rows[r+1]-y0,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const si=((y+y0)*src.width+x+x0)*4,i=(y*w+x)*4;d.set(src.data.subarray(si,si+4),i);
  if(d[i+3]<96)d[i+3]=0;
 }
 // The largest connected figure owns the cell. Remove alpha-matte dust, not thin internal details.
 const seen=new Uint8Array(w*h),parts=[];
 for(let k=0;k<w*h;k++)if(!seen[k]&&d[k*4+3]){
  const q=[k];seen[k]=1;
  for(let j=0;j<q.length;j++){const p=q[j],x=p%w,y=Math.floor(p/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,n=ny*w+nx;
    if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[n]&&d[n*4+3]){seen[n]=1;q.push(n);}
   }
  }parts.push(q);
 }
 const biggest=Math.max(...parts.map(p=>p.length));
 for(const p of parts)if(p.length<biggest)for(const k of p)d[k*4+3]=0;
 if(reference){
  // Hair-only edits can shift a whole row slightly. Fit the unchanged face-to-foot
  // anatomy back to the existing rig before using its hand/weapon anchors.
  const center=cx[c]-x0,skinY=(bytes,W,X,Y)=>{
   const ys=[];
   for(let y=Math.floor(h*.2);y<h*.61;y++)for(let x=Math.max(0,Math.floor(center-46));x<Math.min(w,center+46);x++){
    const i=((y+Y)*W+x+X)*4,R=bytes[i],G=bytes[i+1],B=bytes[i+2];
    if(bytes[i+3]>180&&R>155&&G>100&&R>G*1.06&&R>B*1.12&&B>G*.66)ys.push(y);
   }
   ys.sort((a,b)=>a-b);return ys.length>10?ys[Math.floor(ys.length*.5)]:null;
  };
  const fy=skinY(d,w,0,0),targetFace=skinY(reference.data,reference.width,x0,y0);
  let bottom=0;for(let y=0;y<h;y++)for(let x=Math.max(0,Math.floor(center-65));x<Math.min(w,center+65);x++)if(d[(y*w+x)*4+3]>180)bottom=Math.max(bottom,y);
  const targetFeet=feet[r]-y0,k=fy!==null&&targetFace!==null?Math.max(.92,Math.min(1.12,(targetFeet-targetFace)/(bottom-fy))):1;
  const fitted=new Uint8ClampedArray(d.length),scaled=L.scaleImg({w,h,d},k);
  L.blit(fitted,w,h,scaled,Math.round(center-center*k),Math.round(targetFeet-bottom*k));d.set(fitted);
 }
 const blades=[hands[r][c].slice(0,4),hands[r][c].slice(4)];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(const [hx,hy,tx,ty]of blades){
  const vx=tx-hx,vy=ty-hy,L2=vx*vx+vy*vy,t=((x+x0-hx)*vx+(y+y0-hy)*vy)/L2;
  const dist=Math.abs((x+x0-hx)*vy-(y+y0-hy)*vx)/Math.sqrt(L2);
  if(t>.12&&t<1.1&&dist<13)d[(y*w+x)*4+3]=0;
 }
 return {w,h,d};
}
for(const style of ['short','medium','long']){
 const src=L.readPng(path.join(root,darkHair?'class-art/adharma-hair':'class-art/dualblade-v2',`${darkHair?'dualblade-':''}${style}-source.png`));
 const reference=darkHair?L.readPng(path.join(root,'class-art/dualblade-v2',`${style}-source.png`)):null;
 if(Math.abs(src.width-1402)>2||Math.abs(src.height-1122)>2)throw Error('Review source layout');
 for(const [pose,sourceRows]of [['walk',[1,0,2]],['attack',[0,3,3]]]){
  const M=meta[pose],W=M.frameWidth*8,H=M.frameHeight*3,d=new Uint8ClampedArray(W*H*4),frames=[],weapons=[];
  sourceRows.forEach((r,row)=>dirs.forEach((c,col)=>{
   const flipped=col>4,cell=sourceCell(src,c,r,reference),scaled=L.scaleImg(cell,scale),frame={w:M.frameWidth,h:M.frameHeight,d:new Uint8ClampedArray(M.frameWidth*M.frameHeight*4)};
   const dx=Math.round(M.anchorX-(cx[c]-cols[c])*scale),dy=Math.round(M.anchorY-(feet[r]-rows[r])*scale);
   L.blit(frame.d,frame.w,frame.h,scaled,dx,dy);
   L.blit(d,W,H,flipped?mirror(frame):frame,col*M.frameWidth,row*M.frameHeight);
   const px=x=>flipped?M.frameWidth-1-(M.anchorX+(x-cx[c])*scale):M.anchorX+(x-cx[c])*scale;
   const py=y=>M.anchorY+(y-feet[r])*scale;
   frames.push({headTop:py(tops[r]),bodyHeight:(feet[r]-tops[r])*scale,headX:px(cx[c]),neckY:py(rows[r]+(r===3?155:138)),feetX:px(cx[c]),feetY:M.anchorY});
   weapons.push([hands[r][c].slice(0,4),hands[r][c].slice(4)].map(([hx,hy,tx,ty])=>[px(hx)-M.anchorX,py(hy)-M.anchorY,px(tx)-M.anchorX,py(ty)-M.anchorY]));
  }));
  L.writePng(path.join(dest,`${darkHair?'dark-':''}${style}-${pose}.png`),W,H,d);
  meta.frames[pose]=frames;meta.weapons[pose]=weapons;
 }
}
meta.weapons.walkAdharma=meta.weapons.walk;
if(!darkHair)fs.writeFileSync(path.join(dest,'model.json'),JSON.stringify(meta));
console.log('Dualblade V2: 3 painted hair styles, 8 directions, 3 walk / 3 attack frames, independent hand anchors.');
