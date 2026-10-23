const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PNG}=require('pngjs');
const dir=path.join(__dirname,'../public/assets/taoist-v2');
const meta=JSON.parse(fs.readFileSync(path.join(dir,'taoist.json')));
let checked=0;
for(const faction of ['dharma','adharma'])for(const pose of ['walk','attack']) {
  const m=meta[pose][faction],{frameWidth:w,frameHeight:h}=m;
  const read=n=>PNG.sync.read(fs.readFileSync(path.join(dir,n)));
  const src=read(`taoist-${faction}${pose==='attack'?'-attack':''}.png`);
  assert.equal(src.width,w*8);assert.equal(src.height,h*m.framesPerDir);
  assert.equal(m.poseFrames.length,8*m.framesPerDir);assert(m.normalizedPose);
  const masks=[read(`armor-tao-${pose}-${faction}.png`),read(`armor2-tao-${pose}-${faction}.png`)];
  for(const mask of masks){assert.equal(mask.width,src.width);assert.equal(mask.height,src.height);}
  const frames=[];
  for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++) {
    let opaque=0,bottom=0,masked=0;const bytes=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const i=((row*h+y)*src.width+col*w+x)*4,a=src.data[i+3];
      if(a>60){opaque++;bottom=Math.max(bottom,y);}
      if(x<2||x>=w-2||y<2||y>=h-2)assert.equal(a,0,`Clipped ${faction}/${pose}/${row}/${col}`);
      if(masks[0].data[i+3]){assert(a>0,'Mask outside artwork');masked++;}
      bytes.push(...src.data.subarray(i,i+4));
    }
    assert(opaque>2500);assert(masked>100);assert(Math.abs(bottom-m.anchorY)<3,'Unstable feet');
    const f=m.poseFrames[row*8+col];
    assert(f.headTop>=0&&f.headTop<f.shoulder[1]);
    assert(f.shoulder.every(Number.isFinite));
    for(const p of f.whisk?[f.whisk.slice(0,2),f.whisk.slice(2)]:[])assert(p[0]>=0&&p[0]<w&&p[1]>=0&&p[1]<h);
    frames.push(Buffer.from(bytes));checked++;
  }
  for(let col=0;col<8;col++) {
    assert(!frames[col].equals(frames[8+col]),'Missing animation pose');
    assert(!frames[8+col].equals(frames[16+col]),'Missing animation pose');
    if(pose==='walk')assert(frames[8+col].equals(frames[24+col]),'Idle differs from neutral stride');
  }
}
console.log(`PASS: ${checked} Taoist frames; transparent gutters, aligned feet, distinct poses, matching masks and equipment landmarks.`);
