// Pack six painted alpha silhouettes. Never slice through the generated gutters.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),L=require('./img-lib');
const root=path.join(__dirname,'..'),src=L.readPng(path.join(root,'map-art/ice-v2/props-source.png'));
const out=path.join(root,'public/assets/ice-v2'),seen=new Uint8Array(src.width*src.height),parts=[];
for(let start=0;start<seen.length;start++){
  if(seen[start]||src.data[start*4+3]<20)continue;
  const pixels=[start];seen[start]=1;let x0=src.width,y0=src.height,x1=0,y1=0;
  for(let i=0;i<pixels.length;i++){
    const p=pixels[i],x=p%src.width,y=Math.floor(p/src.width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,n=yy*src.width+xx;
      if(xx>=0&&xx<src.width&&yy>=0&&yy<src.height&&!seen[n]&&src.data[n*4+3]>=20){seen[n]=1;pixels.push(n);}}
  }
  if(pixels.length>10000)parts.push({pixels,x0,y0,x1,y1});
}
parts.sort((a,b)=>Math.floor((a.y0+a.y1)/src.height)-Math.floor((b.y0+b.y1)/src.height)||a.x0-b.x0);
assert.equal(parts.length,6,'six complete alpha silhouettes');
const specs=[['icePalace',540,460],['iceObelisk',190,260],['pine',170,235],['rocks',135,115],['pavilion',220,210],['lantern',54,120]];
const meta={version:2,source:'map-art/ice-v2/props-source.png',props:{}};fs.mkdirSync(out,{recursive:true});
for(let i=0;i<parts.length;i++){
  const p=parts[i],[name,maxW,maxH]=specs[i],w=p.x1-p.x0+1,h=p.y1-p.y0+1,d=new Uint8ClampedArray(w*h*4);
  assert(p.x0>0&&p.y0>0&&p.x1<src.width-1&&p.y1<src.height-1,name+' clipped source');
  for(const n of p.pixels)d.set(src.data.subarray(n*4,n*4+4),((Math.floor(n/src.width)-p.y0)*w+n%src.width-p.x0)*4);
  const img=L.scaleImg({w,h,d},Math.min(maxW/w,maxH/h)),W=img.w+16,H=img.h+16,rgba=new Uint8ClampedArray(W*H*4);
  L.blit(rgba,W,H,img,8,8);L.writePng(path.join(out,name+'.png'),W,H,rgba);
  meta.props[name]={file:name+'.png',width:W,height:H,ax:Math.round(W/2),ay:H-10,occludes:name!=='rocks'};
}
const snow=L.readPng(path.join(root,'map-art/ice-v2/snow-source.png'));
const texture=L.scaleImg({w:snow.width,h:snow.height,d:snow.data},768/snow.width);
L.writePng(path.join(out,'snow.png'),texture.w,texture.h,texture.d);
meta.ground={snow:'snow.png'};
fs.writeFileSync(path.join(out,'props.json'),JSON.stringify(meta,null,2)+'\n');console.log('PASS six painted ice props and snow material');
