// Verify the new dharma atlas without accepting changes to the dark archer or spear assets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts');
const baseline=JSON.parse(fs.readFileSync(path.join(out,'celestial-archer-unchanged-before.json'),'utf8').replace(/^\uFEFF/,''));
for(const b of baseline)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(b.Path)).digest('hex').toUpperCase(),b.Hash,'Unrelated asset changed: '+b.Path);
const M=JSON.parse(fs.readFileSync(path.join(root,'public/assets/archer-v2/model.json')));
let grips=0,bounds=0;
for(const style of ['short','medium','long']){
 const P=M.attack,im=PNG.sync.read(fs.readFileSync(path.join(root,`public/assets/archer-v2/${style}-attack.png`)));
 for(let row=0;row<P.framesPerDir;row++)for(let col=0;col<8;col++){
  const a=M.styles[style].attack[row*8+col],ox=col*P.frameWidth,oy=row*P.frameHeight;
  const at=(x,y)=>((oy+y)*im.width+ox+x)*4;
  for(let y=0;y<P.frameHeight;y++)for(let x=0;x<P.frameWidth;x++)if(x<2||x>=P.frameWidth-2||y<2||y>=P.frameHeight-2)assert(!im.data[at(x,y)+3],`Clipped attack ${style} ${row} ${col}`);
  bounds++;
  let n=0;for(let y=Math.round(a.bow[3])-5;y<=Math.round(a.bow[3])+5;y++)for(let x=Math.round(a.bow[2])-5;x<=Math.round(a.bow[2])+5;x++){
   const i=at(x,y),[r,g,b,alpha]=im.data.subarray(i,i+4);if(alpha>180&&r>170&&g>110&&b>85&&r>g*1.04&&g>b*1.04)n++;
  }assert(n>=4,`Attack grip misses hand: ${style} ${row} ${col} (${n})`);grips++;
 }
}
const result={unchangedDarkAssets:baseline.length,attackHands:grips,attackBounds:bounds};
fs.writeFileSync(path.join(out,'celestial-archer-check.json'),JSON.stringify(result,null,2));console.log(result);
