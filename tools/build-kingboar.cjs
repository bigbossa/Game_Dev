// Pack the two generated transparent direction sheets. Keep one scale per direction
// across its animation frames, so the body does not inflate during a step/attack.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const L=require('./img-lib');
const root=path.join(__dirname,'..'),src=path.join(root,'monster-art/village-v2'),out=path.join(root,'public/assets/monsters');
const cells=[];
for(const [part,file]of ['kingboar-south-source.png','kingboar-north-source.png'].entries()){
 const p=L.readPng(path.join(src,file)),W=p.width,H=p.height,d=p.data,seen=new Uint8Array(W*H),occupied=new Set();
 // Generated gutters are uneven: find full alpha silhouettes instead of cutting
 // equal rectangles through tusks and tails. Small disconnected alpha dust is omitted.
 for(let start=0;start<seen.length;start++)if(!seen[start]&&d[start*4+3]>=24){
  const q=[start];seen[start]=1;let x0=W,x1=0,y0=H,y1=0;
  for(let n=0;n<q.length;n++){const i=q[n],x=i%W,y=Math.floor(i/W);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*W+xx;if(xx>=0&&xx<W&&yy>=0&&yy<H&&!seen[j]&&d[j*4+3]>=24){seen[j]=1;q.push(j);}}}
  if(q.length<3000)continue;
  const r=Math.floor((y0+y1)/2/H*4),col=Math.floor((x0+x1)/2/W*4),key=r+':'+col;
  assert(!occupied.has(key),file+' overlapping poses '+key);occupied.add(key);
  assert(x0>2&&y0>2&&x1<W-3&&y1<H-3,file+' clipped silhouette');
  const w=x1-x0+1,h=y1-y0+1,ink=new Uint8ClampedArray(w*h*4);
  for(const i of q)ink.set(d.subarray(i*4,i*4+4),((Math.floor(i/W)-y0)*w+i%W-x0)*4);
  cells.push({r,col:part*4+col,img:{w,h,d:ink}});
 }
 assert.equal(occupied.size,16,file+' must contain 16 separated complete poses');
}
for(let col=0;col<8;col++){
 const poses=cells.filter(c=>c.col===col),idle=poses.find(c=>c.r===1),scale=224/idle.img.h;
 for(const c of poses)c.img=L.scaleImg(c.img,scale);
}
const pad=8,fw=Math.max(...cells.map(c=>c.img.w))+pad*2,fh=Math.max(...cells.map(c=>c.img.h))+pad*2;
const rgba=new Uint8ClampedArray(fw*8*fh*4*4);
for(const c of cells)L.blit(rgba,fw*8,fh*4,c.img,c.col*fw+Math.round((fw-c.img.w)/2),c.r*fh+fh-pad-c.img.h);
fs.mkdirSync(out,{recursive:true});L.writePng(path.join(out,'kingboar-v2.png'),fw*8,fh*4,rgba);
const version=crypto.createHash('sha256').update(rgba).digest('hex').slice(0,12),indexPath=path.join(out,'index.json');
const index=fs.existsSync(indexPath)?JSON.parse(fs.readFileSync(indexPath,'utf8')):{};
index.kingboar={file:'kingboar-v2.png',version,fw,fh,cols:8,rows:4,ax:fw/2,ay:fh-pad,contentHeight:224,height:132,idleRow:1,walkRows:[0,1,2,1],attackRow:3,managedBy:'build-kingboar'};
fs.writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({frames:cells.length,...index.kingboar}));
