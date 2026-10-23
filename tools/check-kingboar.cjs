const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto'),{PNG}=require('pngjs');
const C=require('../shared/world-data'),dir=path.join(__dirname,'../public/assets/monsters');
const meta=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8')).kingboar,png=PNG.sync.read(fs.readFileSync(path.join(dir,meta.file)));
assert.equal(meta.cols,8);assert.equal(meta.rows,4);assert.equal(png.width,meta.fw*8);assert.equal(png.height,meta.fh*4);
const hashes=new Set();let frames=0;
for(let row=0;row<4;row++)for(let col=0;col<8;col++){
 let ink=0,minY=meta.fh,maxY=0;const buf=Buffer.alloc(meta.fw*meta.fh*4);
 for(let y=0;y<meta.fh;y++)for(let x=0;x<meta.fw;x++){
  const i=((row*meta.fh+y)*png.width+col*meta.fw+x)*4,a=png.data[i+3];png.data.copy(buf,(y*meta.fw+x)*4,i,i+4);
  if(a>60){ink++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(x<4||x>=meta.fw-4||y<4||y>=meta.fh-4)assert.equal(a,0,'No clipped sprite '+row+'/'+col);
 }
 assert(ink>6000,'Visible pose');assert(Math.abs(maxY-meta.ay)<4,'Feet share ground anchor');
 if(row===1)assert(Math.abs(maxY-minY+1-meta.contentHeight)<4,'Stable idle height');
 hashes.add(crypto.createHash('sha256').update(buf).digest('hex'));frames++;
}
assert.equal(hashes.size,32,'All authored poses distinct');assert.equal(C.MAPS.village.boss,'kingboar');assert.equal(C.MONSTERS.kingboar.lvl,25);
assert.equal(C.MAPS.village.zones.filter(z=>z.type==='kingboar').reduce((n,z)=>n+z.count,0),1);
console.log(JSON.stringify({frames,directions:8,distinctPoses:hashes.size,transparentBorders:true,groundAnchors:true,bossLevel:25}));
