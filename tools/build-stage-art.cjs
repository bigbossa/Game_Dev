const fs=require('node:fs'),path=require('node:path'),L=require('./img-lib'),extract=require('./stage-atlas.cjs');
const spec=require('../map-art/stages-v2/ART.json'),root=path.join(__dirname,'..');
const maps=process.argv.slice(2).length?process.argv.slice(2):Object.keys(spec.maps);
for(const map of maps){
 const cfg=spec.maps[map],source=path.join(root,'map-art/stages-v2',map+'-source.png');
 const cells=extract(source,{cols:3,rows:2}),out=path.join(root,'public/assets/stages-v2',map),meta={version:2,props:{}};
 const sizes=[[540,430],[270,290],[240,260],[200,240],[130,115],[210,200]];
 fs.mkdirSync(out,{recursive:true});
 cells.forEach((cell,i)=>{
  const name=cfg.names[i],[mw,mh]=sizes[i],im=L.scaleImg(cell.img,Math.min(mw/cell.img.w,mh/cell.img.h));
  const w=im.w+16,h=im.h+16,d=new Uint8ClampedArray(w*h*4);L.blit(d,w,h,im,8,8);L.writePng(path.join(out,name+'.png'),w,h,d);
  meta.props[name]={file:name+'.png',width:w,height:h,ax:Math.round(w/2),ay:h-10,occludes:name!=='rock'};
 });
 fs.writeFileSync(path.join(out,'props.json'),JSON.stringify(meta,null,2)+'\n');console.log(map+': six painted props');
}
