// Pack generated alpha art into the game's direction convention. No recolouring or matte synthesis.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const L=require('./img-lib'),extract=require('./stage-atlas.cjs');
const root=path.join(__dirname,'..'),out=path.join(root,'public/assets/boxer');
fs.mkdirSync(out,{recursive:true});
const FW=300,FH=280,AX=150,AY=252;
const meta={version:2,frameWidth:FW,frameHeight:FH,anchorX:AX,anchorY:AY,walkFrames:4,attackFrames:3,combatPoses:['elbow','knee','uppercut','slam'],landmarks:{}};
for(const faction of ['dharma','adharma']){
  const cells=extract(path.join(root,'class-art/boxer',faction+'-source.png'));
  const scale=210/(cells.slice(0,8).reduce((n,c)=>n+c.img.h,0)/8);
  const pack=(list,combat=false)=>list.map(({img,row,col})=>{
    let left=img.w,right=0;
    for(let y=Math.floor(img.h*(combat?.45:.15));y<img.h*(combat?.65:.36);y++)for(let x=0;x<img.w;x++)if(img.d[(y*img.w+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
    const centre=(left+right)/2,im=L.scaleImg(img,scale),x=Math.round(AX-centre*scale),y=AY-im.h+1;
    assert(x>1&&y>1&&x+im.w<FW-1&&y+im.h<FH-1,'frame clipped');
    const d=new Uint8ClampedArray(FW*FH*4);L.blit(d,FW,FH,im,x,y);
    return {img:{w:FW,h:FH,d},row,col,headTop:y,feetY:AY,centre:AX};
  });
  const frames=pack(cells),combat=pack(extract(path.join(root,'class-art/boxer',faction+'-combat-source.png')),true);
  const columns=[0,7,6,5,4,3,2,1];
  meta.landmarks[faction]={};
  for(const [pose,rows] of [['walk',[1,0,2,0]],['attack',[0,3,0]],['combat',[0,1,2,3]]]){
    const W=FW*8,H=FH*rows.length,d=new Uint8ClampedArray(W*H*4),marks=[];
    rows.forEach((r,j)=>columns.forEach((c,i)=>{const f=(pose==='combat'?combat:frames)[r*8+c];L.blit(d,W,H,f.img,i*FW,j*FH);marks.push({headTop:f.headTop,feetY:AY,source:[r,c]});}));
    L.writePng(path.join(out,faction+'-'+pose+'.png'),W,H,d);meta.landmarks[faction][pose]=marks;
  }
  L.writePng(path.join(out,faction+'-portrait.png'),FW,FH,frames[0].img.d);
}
fs.writeFileSync(path.join(out,'model.json'),JSON.stringify(meta,null,2));
console.log('PASS boxer: 2 factions, 8 directions, 4 walking + 3 attack + 4 combat poses, aligned feet.');
