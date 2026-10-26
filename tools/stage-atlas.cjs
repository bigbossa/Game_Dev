// Extract connected alpha silhouettes, keeping detached details in their source cell.
const assert=require('node:assert/strict'),L=require('./img-lib');
module.exports=function extract(file,{cols=8,rows=4,minPixels=40}={}){
 const {width:w,height:h,data}=L.readPng(file),seen=new Uint8Array(w*h),groups=new Map();
 for(let start=0;start<seen.length;start++){
  if(seen[start]||data[start*4+3]<24)continue;
  const pixels=[start];seen[start]=1;let x0=w,y0=h,x1=0,y1=0;
  for(let i=0;i<pixels.length;i++){
   const n=pixels[i],x=n%w,y=Math.floor(n/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy,j=yy*w+xx;
    if(xx>=0&&yy>=0&&xx<w&&yy<h&&!seen[j]&&data[j*4+3]>=24){seen[j]=1;pixels.push(j);}
   }
  }
  if(pixels.length<minPixels)continue;
  const col=Math.floor((x0+x1)/2/w*cols),row=Math.floor((y0+y1)/2/h*rows),key=row+'/'+col;
  assert(x0>0&&y0>0&&x1<w-1&&y1<h-1,`${file}: clipped component ${key} (${x0},${y0})-(${x1},${y1})`);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push({pixels,x0,y0,x1,y1,row,col});
 }
 assert.equal(groups.size,cols*rows,`${file}: missing or overlapping cells`);
 return [...groups.values()].map(parts=>{
  const x0=Math.min(...parts.map(p=>p.x0)),y0=Math.min(...parts.map(p=>p.y0));
  const iw=Math.max(...parts.map(p=>p.x1))-x0+1,ih=Math.max(...parts.map(p=>p.y1))-y0+1;
  assert(iw<w/cols*1.42&&ih<h/rows*1.2,`${file}: neighboring cells connected at ${parts[0].row}/${parts[0].col}`);
  const d=new Uint8ClampedArray(iw*ih*4);
  for(const p of parts)for(const n of p.pixels)d.set(data.subarray(n*4,n*4+4),((Math.floor(n/w)-y0)*iw+n%w-x0)*4);
  return {row:parts[0].row,col:parts[0].col,img:{w:iw,h:ih,d}};
 }).sort((a,b)=>a.row-b.row||a.col-b.col);
};
