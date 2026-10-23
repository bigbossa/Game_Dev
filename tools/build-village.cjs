// Crop and pack generated transparent props; never turn the concept painting into a flat map.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require('./img-lib'),{trim}=require('./sheet-cut');
const root=path.join(__dirname,'..'),src=path.join(root,'map-art/village-v2'),out=path.join(root,'public/assets/village-v2');
fs.mkdirSync(out,{recursive:true});
const buildings=L.readPng(path.join(src,'buildings-draft.png')),nature=L.readPng(path.join(src,'nature-draft.png'));
const specs=[
 ['pavilion',buildings,[0,0,548,512],420,400],['apothecary',buildings,[548,0,1046,512],350,340],
 ['smith',buildings,[1046,0,1536,512],370,350],['house',buildings,[0,512,540,1024],320,310],
 ['gate',buildings,[540,512,1082,1024],244,240],['stone',buildings,[1082,512,1536,1024],86,142],
 ['tree',nature,[0,0,548,565],210,245],['peach',nature,[548,0,1060,558],225,245],
 ['bamboo',nature,[1060,0,1536,565],190,245],['rocks',nature,[0,565,548,1024],132,115],
 ['lantern',nature,[548,550,1060,1024],64,114],['shrub',nature,[1060,565,1536,1024],100,82],
];
const meta={version:2,props:{}};
for(const [name,img,[x0,y0,x1,y1],maxW,maxH]of specs){
 const w=x1-x0,h=y1-y0,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=((y+y0)*img.width+x+x0)*4,b=(y*w+x)*4;d.set(img.data.subarray(a,a+4),b);
  if(d[b+3]<24){d[b]=d[b+1]=d[b+2]=d[b+3]=0;}
 }
 // Remove disconnected alpha dust and neighbouring silhouettes that meet a crop edge.
 const seen=new Uint8Array(w*h),parts=[];
 for(let k=0;k<w*h;k++)if(d[k*4+3]&&!seen[k]){const q=[k];seen[k]=1;
  for(let n=0;n<q.length;n++){const v=q[n],x=v%w,y=Math.floor(v/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,j=ny*w+nx;
    if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[j]&&d[j*4+3]){seen[j]=1;q.push(j);}}}
  parts.push(q);
 }
 const largest=Math.max(...parts.map(p=>p.length));assert(largest>2000,name+' empty');
 for(const p of parts)if(p.length<40||(p.length<largest*.15&&p.some(k=>k<w||k>=w*(h-1)||k%w===0||k%w===w-1)))for(const k of p)d[k*4+3]=0;
 const clean=trim({w,h,d}),scaled=L.scaleImg(clean,Math.min(maxW/clean.w,maxH/clean.h));
 const W=scaled.w+8,H=scaled.h+8,rgba=new Uint8ClampedArray(W*H*4);L.blit(rgba,W,H,scaled,4,4);
 L.writePng(path.join(out,name+'.png'),W,H,rgba);
 meta.props[name]={file:name+'.png',width:W,height:H,ax:Math.round(W/2),ay:H-7,
  occludes:['pavilion','apothecary','smith','house','tree','peach','bamboo','gate'].includes(name)};
}
meta.ground={};
for(const [name,maxW]of [['courtyard',1024],['bridge',1024],['grass',768]]){
 const png=L.readPng(path.join(src,name+'-source.png'));
 const img={w:png.width,h:png.height,d:new Uint8ClampedArray(png.data)};
 if(name!=='grass')for(let i=3;i<img.d.length;i+=4)if(img.d[i]<24)img.d[i]=0;
 const clean=name==='grass'?img:trim(img),scaled=L.scaleImg(clean,Math.min(1,maxW/clean.w));
 L.writePng(path.join(out,name+'.png'),scaled.w,scaled.h,scaled.d);
 meta.ground[name]={file:name+'.png',width:scaled.w,height:scaled.h};
}
fs.writeFileSync(path.join(out,'props.json'),JSON.stringify(meta,null,2)+'\n');
console.log('Built 12 painted village props and 3 terrain assets with preserved alpha.');
