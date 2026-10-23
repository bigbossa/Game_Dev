// Pack reviewed painted figures into padded game atlases; no changes to the legacy art.
const fs=require('node:fs'),path=require('node:path'),L=require('./img-lib');
const {mirror}=require('./sheet-cut');
const root=path.resolve(__dirname,'..'),dest=path.join(root,'public/assets/archer-v2');
const darkHair=process.argv.includes('--adharma-hair');
fs.mkdirSync(dest,{recursive:true});
const cols=[0,300,585,865,1120,1402],rows=[0,282,560,838,1122],scale=.52;
const centers={short:[[154,452,718,979,1247],[151,451,716,978,1250],[151,458,718,974,1246],[143,433,703,963,1240]],
 medium:[[151,453,718,982,1252],[150,456,725,977,1255],[156,465,724,974,1250],[163,453,718,967,1246]],
 long:[[154,482,737,970,1250],[157,481,737,968,1253],[154,485,744,968,1253],[156,476,749,968,1250]]};
const hands={short:[[207,194],[214,464],[225,740],[250,937]],medium:[[211,194],[225,465],[235,742],[270,937]],long:[[205,194],[225,466],[226,741],[262,940]]};
// Rightmost visible fist per column, measured in the original drawing. Back view holds the bow on its left.
const grip={short:[[207,503,710,937,1199],[214,506,774,914,1195],[225,508,776,912,1194],[250,537,821,1065,1139]],
 medium:[[211,494,709,938,1200],[225,518,786,923,1208],[235,531,786,925,1205],[270,550,830,1064,1151]],
 long:[[205,523,727,930,1204],[225,532,786,919,1201],[226,539,799,921,1203],[262,577,847,1066,1143]]};
// Relaxed idle uses the authored hand at the hip, identical proportions to the walk's centre pose.
const M={version:4,faction:darkHair?'adharma':'dharma',walk:{frameWidth:240,frameHeight:180,anchorX:120,anchorY:170,framesPerDir:4},attack:{frameWidth:240,frameHeight:180,anchorX:120,anchorY:170,framesPerDir:3},styles:{}};
const dirs=[0,1,2,3,4,3,2,1];
const demonRig=JSON.parse(fs.readFileSync(path.join(root,darkHair?'class-art/demon-models/archer-rig.json':'class-art/celestial-archer/rig.json')));
for(const style of ['short','medium','long']){
 const src=L.readPng(path.join(root,darkHair?'class-art/demon-models':'class-art/celestial-archer',(darkHair?'archer-':'')+style+'-source.png'));
 const rig=demonRig?.[style],cs=rig?.cols||cols,rs=rig?.rows||rows;
 const correction=darkHair&&style==='medium'?{source:'class-art/demon-models/archer-medium-attack-fix.png',column:3,left:835,grip:[858,973]}:rig.attackFix?{...rig.attackFix,source:'class-art/celestial-archer/'+rig.attackFix.source}:null;
 const attackFix=correction?L.readPng(path.join(root,correction.source)):null;
 if(src.width!==1402||src.height!==1122)throw Error('Review atlas dimensions');
 M.styles[style]={};
 for(const [pose,sr]of [['walk',[1,0,2,0]],['attack',[0,3,3]]]){
  const P=M[pose],W=P.frameWidth*8,H=P.frameHeight*sr.length,out=new Uint8ClampedArray(W*H*4),frames=[];
  sr.forEach((r,row)=>dirs.forEach((c,col)=>{
   const fixed=attackFix&&r===3&&c===correction.column,idle=pose==='walk'&&row===3,s=fixed?attackFix:src;
   const x0=fixed?correction.left:r===3&&rig?.attackLeftBounds?.[c]!==undefined?rig.attackLeftBounds[c]:cs[c],y0=rs[r];
   const w=cs[c+1]-x0,h=rs[r+1]-y0,d=new Uint8ClampedArray(w*h*4);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,k=((y+y0)*s.width+x+x0)*4;d.set(s.data.subarray(k,k+4),i);if(d[i+3]<96)d[i+3]=0;}
   const seen=new Uint8Array(w*h),parts=[];
   for(let k=0;k<w*h;k++)if(!seen[k]&&d[k*4+3]){
    const q=[k];seen[k]=1;
    for(let j=0;j<q.length;j++){const p=q[j],x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[n]&&d[n*4+3]){seen[n]=1;q.push(n);}}}parts.push(q);
   }
   const body=parts.reduce((a,b)=>a.length>b.length?a:b,[]),keep=new Set(body);
   for(let k=0;k<w*h;k++)if(!keep.has(k))d[k*4+3]=0;
   const foot=Math.max(...body.map(k=>Math.floor(k/w)))+y0;
   const cx=rig?rig.centres[r][c]:centers[style][r][c],sc=rig?.scale||scale;
   const frame={w:P.frameWidth,h:P.frameHeight,d:new Uint8ClampedArray(P.frameWidth*P.frameHeight*4)};
   L.blit(frame.d,frame.w,frame.h,L.scaleImg({w,h,d},sc),Math.round(P.anchorX-(cx-x0)*sc),Math.round(P.anchorY-(foot-y0)*sc));
   // Source column 3 is BACK-LEFT, not back-right. Mirror the entire figure and rig together.
   const flip=c===3?col===3:col>4,px=x=>flip?P.frameWidth-1-(P.anchorX+(x-cx)*sc):P.anchorX+(x-cx)*sc,py=y=>P.anchorY+(y-foot)*sc;
   const neck=py(rig?rig.necks[r]:rows[r]+118),top=py(rig?rig.heads[r]:rows[r]+12);
   const hx=px(fixed?correction.grip[0]:rig?rig.grips[r][c][0]:grip[style][r][c]),hy=py(fixed?correction.grip[1]:rig?rig.grips[r][c][1]:r===3?hands[style][r][1]:rows[r]+(r===0?194:184));
   const side=hx>px(cx)?1:-1;
   // Release retains the archer's drawn stance; the runtime releases the bowstring and arrow.
   L.blit(out,W,H,flip?mirror(frame):frame,col*P.frameWidth,row*P.frameHeight);
   frames.push({headX:px(cx),headTop:top,neckY:neck,feetY:P.anchorY,bodyHeight:P.anchorY-top,
    body:[px(cx),neck,neck+24,P.anchorY-20,18],bow:r!==3?[hx+side*14,hy-43,hx,hy,hx+side*12,hy+34,-side]:[hx-side*10,hy-45,hx,hy,hx-side*10,hy+43,side],
    idle,bowBehind:c>=3,sourceColumn:c,mirrored:flip,
    crownX:px(cx),crownY:top+12});
  }));
  M.styles[style][pose]=frames;
  L.writePng(path.join(dest,(darkHair?'dark-':'')+style+'-'+pose+'.png'),W,H,out);
 }
}
fs.writeFileSync(path.join(dest,(darkHair?'dark-':'')+'model.json'),JSON.stringify(M));
console.log('Archer V2 packed: 3 hairstyles, 8 directions, 4 walk/idle and 3 attack frames.');
