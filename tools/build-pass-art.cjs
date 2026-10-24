// Pack six generated transparent props. Painted pixels and alpha are preserved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require('./img-lib'),{trim}=require('./sheet-cut');
const root=path.join(__dirname,'..'),src=path.join(root,'map-art/pass-v2/props-source.png'),out=path.join(root,'public/assets/pass-v2');
const source=L.readPng(src),specs=[['watchtower',360,420],['canyonGate',510,400],['waystone',220,290],['willow',210,250],['cliffs',380,320],['shrub',92,75]];
// The generated layout has unequal cells. Isolate connected alpha silhouettes so
// the willow's tips and neighbouring rocks are kept whole without cross-contamination.
const seen=new Int32Array(source.width*source.height),queue=new Int32Array(seen.length),components=[];
for(let start=0;start<seen.length;start++){
  if(seen[start]||source.data[start*4+3]<20)continue;
  const id=components.length+1;let head=0,tail=1,x0=source.width,y0=source.height,x1=0,y1=0;queue[0]=start;seen[start]=id;
  while(head<tail){
    const p=queue[head++],x=p%source.width,y=Math.floor(p/source.width);
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    for(const n of [x? p-1:-1,x<source.width-1?p+1:-1,p-source.width,p+source.width])
      if(n>=0&&n<seen.length&&!seen[n]&&source.data[n*4+3]>=20){seen[n]=id;queue[tail++]=n;}
  }
  components.push({id,area:tail,x0,y0,x1:x1+1,y1:y1+1});
}
const objects=components.filter(p=>p.area>10000).sort((a,b)=>Math.floor(a.y0/538)-Math.floor(b.y0/538)||a.x0-b.x0);
assert.equal(objects.length,6,'Expected six separated silhouettes');
fs.mkdirSync(out,{recursive:true});const meta={version:2,source:'map-art/pass-v2/props-source.png',props:{}};
for(let index=0;index<specs.length;index++){
  const [name,maxW,maxH]=specs[index],{id,x0,x1,y0,y1}=objects[index];
  const w=x1-x0,h=y1-y0,d=new Uint8ClampedArray(w*h*4);let transparent=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const a=((y+y0)*source.width+x+x0)*4,b=(y*w+x)*4;d.set(source.data.subarray(a,a+4),b);
    if(seen[(y+y0)*source.width+x+x0]!==id){d[b]=d[b+1]=d[b+2]=d[b+3]=0;transparent++;}
  }
  assert(transparent>w*h*.1,name+' needs real alpha');
  const clean=trim({w,h,d});assert(clean.w>40&&clean.h>40,name+' empty');
  const scaled=L.scaleImg(clean,Math.min(maxW/clean.w,maxH/clean.h)),W=scaled.w+12,H=scaled.h+12,rgba=new Uint8ClampedArray(W*H*4);
  L.blit(rgba,W,H,scaled,6,6);L.writePng(path.join(out,name+'.png'),W,H,rgba);
  meta.props[name]={file:name+'.png',width:W,height:H,ax:Math.round(W/2),ay:H-9,occludes:name!=='shrub',sourceCell:[x0,y0,x1,y1]};
}
fs.writeFileSync(path.join(out,'props.json'),JSON.stringify(meta,null,2)+'\n');
console.log('PASS: six painted stage 2 props packed with transparent padding.');
