// Geometry regressions on the packed artwork, not just the direction metadata.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{PNG}=require('pngjs');
const root=path.resolve(__dirname,'../public/assets/archer-v2');
const C=require('../shared/common');
for(const [dx,dy,col]of [[1,0,2],[1,1,1],[0,1,0],[-1,1,7],[-1,0,6],[-1,-1,5],[0,-1,4],[1,-1,3]])assert.equal(C.DIR_COL[C.dirFromVec(dx,dy)],col,'Click vector must select the matching compass view');
const failures=[];let directions=0,hands=0,bounds=0;
const skin=(d,i)=>d[i+3]>180&&d[i]>175&&d[i+1]>125&&d[i+2]>95&&d[i]>d[i+1]*1.03&&d[i+1]>d[i+2]*1.03;
for(const prefix of ['','dark-']){
 const M=JSON.parse(fs.readFileSync(path.join(root,prefix+'model.json'))),P=M.walk;
 for(const style of ['short','medium','long']){
  const im=PNG.sync.read(fs.readFileSync(path.join(root,prefix+style+'-walk.png'))),at=(x,y,row,col)=>((row*P.frameHeight+y)*im.width+col*P.frameWidth+x)*4;
  for(let row=0;row<4;row++)for(let col=0;col<8;col++){
   const a=M.styles[style].walk[row*8+col],name=prefix+style+' row '+row+' col '+col;
   let edge=0;
   for(let y=0;y<P.frameHeight;y++)for(let x=0;x<P.frameWidth;x++)if((x<2||x>=P.frameWidth-2||y<2||y>=P.frameHeight-2)&&im.data[at(x,y,row,col)+3])edge++;
   if(edge)failures.push(name+' clipped cell edge');bounds++;
   if(!a.bowBehind){
    let n=0;for(let y=Math.round(a.bow[3])-4;y<=Math.round(a.bow[3])+4;y++)for(let x=Math.round(a.bow[2])-4;x<=Math.round(a.bow[2])+4;x++)if(skin(im.data,at(x,y,row,col)))n++;
    if(n<4)failures.push(name+' grip misses hand ('+n+' skin pixels)');hands++;
   }
   if(![2,3,5,6].includes(col))continue;
   const candidates=new Set();
   for(let y=Math.ceil(a.neckY-40);y<a.neckY-3;y++)for(let x=Math.ceil(a.headX-45);x<a.headX+45;x++)if(skin(im.data,at(x,y,row,col)))candidates.add(y*P.frameWidth+x);
   let face=[];
   while(candidates.size){const q=[candidates.values().next().value];candidates.delete(q[0]);for(let k=0;k<q.length;k++)for(const n of [q[k]-1,q[k]+1,q[k]-P.frameWidth,q[k]+P.frameWidth])if(candidates.delete(n))q.push(n);if(q.length>face.length)face=q;}
   const offset=face.reduce((s,k)=>s+k%P.frameWidth-a.headX,0)/(face.length||1),right=col<4;
   // The centre is authored at the neck, sometimes almost under the cheek; test the sign,
   // not a minimum nose length. Reversing a back diagonal flips this measured sign.
   if(face.length<8||(right?offset<=0:offset>=0))failures.push(name+' face points wrong way: '+offset.toFixed(2));directions++;
  }
  for(let col=0;col<8;col++){
   const f=M.styles[style].walk,idle=f[24+col],walking=f[8+col];
   if(Math.abs((idle.feetY-idle.neckY)-(walking.feetY-walking.neckY))>9)failures.push(prefix+style+' col '+col+' standing/walking collar height mismatch');
  }
 }
}
console.log(JSON.stringify({directions,hands,bounds,failures},null,2));
assert.equal(failures.length,0,'Archer artwork rig regressions');
