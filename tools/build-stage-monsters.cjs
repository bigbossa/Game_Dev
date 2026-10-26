const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const L=require('./img-lib'),extract=require('./stage-atlas.cjs'),C=require('../shared/world-data'),spec=require('../monster-art/stages-v2/SPRITES.json');
const root=path.join(__dirname,'..'),out=path.join(root,'public/assets/monsters'),indexFile=path.join(out,'index.json');
const maps=process.argv.slice(2).length?process.argv.slice(2):['forest','manor','temple','fire'];
for(const map of maps){
 const species=spec.species.filter(s=>s.map===map);assert.deepEqual(species.map(s=>s.id),[...C.MAPS[map].mons,C.MAPS[map].boss]);
 // Validate the entire stage before changing its manifest.
 const sheets=species.map(s=>({...s,cells:extract(path.join(root,'monster-art/stages-v2',s.id+'-source.png'))}));
 const index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
 for(const {id,cells}of sheets){
  const contentHeight=176,pad=8;
  for(let col=0;col<8;col++){
   const poses=cells.filter(c=>c.col===col),scale=contentHeight/poses.find(c=>c.row===1).img.h;
   for(const c of poses)c.img=L.scaleImg(c.img,scale);
  }
  const fw=Math.max(...cells.map(c=>c.img.w))+pad*2,fh=Math.max(...cells.map(c=>c.img.h))+pad*2;
  const d=new Uint8ClampedArray(fw*8*fh*4*4);
  for(const c of cells)L.blit(d,fw*8,fh*4,c.img,c.col*fw+Math.round((fw-c.img.w)/2),c.row*fh+fh-pad-c.img.h);
  const file=id+'-v2.png',version=crypto.createHash('sha256').update(d).digest('hex').slice(0,12);
  L.writePng(path.join(out,file),fw*8,fh*4,d);
  index[id]={file,version,fw,fh,cols:8,rows:4,ax:fw/2,ay:fh-pad,contentHeight,idleRow:1,walkRows:[0,1,2,1],attackRow:3,managedBy:'build-stage-monsters'};
  console.log(id+': 32 frames, '+fw+'x'+fh);
 }
 fs.writeFileSync(indexFile,JSON.stringify(index,null,2)+'\n');
}
