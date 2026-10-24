// Crop generated RGBA wing pairs; retain painted pixels and transparent edges.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),L=require('./img-lib');
const root=path.join(__dirname,'..'),src=L.readPng(path.join(root,'class-art/arbiter/evolution-v3/wings-source.png'));
const out=path.join(root,'public/assets/arbiter/evolution-v3');fs.mkdirSync(out,{recursive:true});
const meta={version:3,wings:{}};
for(const [name,box,rx,ry]of [
 ['dharma-2',[0,0,735,500],360,320],['dharma-3',[735,0,1536,500],1150,320],
 ['adharma-2',[0,500,735,1024],360,800],['adharma-3',[735,500,1536,1024],1150,800]]){
 const [x0,y0,x1,y1]=box;let minX=x1,minY=y1,maxX=0,maxY=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(src.data[(y*src.width+x)*4+3]>20){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert(maxX>minX&&maxY>minY,'Missing alpha silhouette '+name);
 assert(minX>x0&&maxX<x1-1&&minY>y0&&maxY<y1-1,'Clipped source '+name);
 const w=maxX-minX+1,h=maxY-minY+1,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=((y+minY)*src.width+x+minX)*4,b=(y*w+x)*4;d.set(src.data.subarray(a,a+4),b);if(d[b+3]<20)d[b+3]=0;}
 const k=Math.min(1,640/w),scaled=L.scaleImg({w,h,d},k),W=scaled.w+16,H=scaled.h+16,rgba=new Uint8ClampedArray(W*H*4);
 L.blit(rgba,W,H,scaled,8,8);L.writePng(path.join(out,name+'.png'),W,H,rgba);
 meta.wings[name]={file:name+'.png',width:W,height:H,rootX:Math.round((rx-minX)*k)+8,rootY:Math.round((ry-minY)*k)+8};
}
fs.writeFileSync(path.join(out,'wings.json'),JSON.stringify(meta,null,2)+'\n');console.log('PASS: four transparent painted wing pairs.');
