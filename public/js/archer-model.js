// Painted archer bodies with per-frame garment masks and separately held bows.
(function(){
 const A=window.ArcherModel={ready:false},sources={},analysis=new WeakMap(),rigs={};let M;
 const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
 const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 A.styleOf=t=>t<3?'short':t<6?'medium':'long';
 A.meta=(f='dharma')=>rigs[f]||M;
 A.load=async function(loadImg,IMG){
  await Promise.all(['dharma','adharma'].map(async f=>rigs[f]=await fetch('assets/archer-v2/'+(f==='adharma'?'dark-':'')+'model.json').then(r=>{if(!r.ok)throw Error('Archer metadata missing: '+f);return r.json();})));
  M=rigs.dharma;
  await Promise.all(['','dark-'].flatMap(prefix=>['short','medium','long'].flatMap(style=>['walk','attack'].map(async pose=>sources[prefix+style+'-'+pose]=await loadImg('assets/archer-v2/'+prefix+style+'-'+pose+'.png')))));
  const own={walk:{},attack:{}};
  for(const f of ['dharma','adharma'])for(const pose of ['walk','attack']){
   IMG['archer-'+f+(pose==='attack'?'-attack':'')]=sources[(f==='adharma'?'dark-':'')+'short-'+pose];
   own[pose][f]={...M[pose],weaponPts:rigs[f].styles.short[pose].map(a=>[[a.bow[0]-M[pose].anchorX,a.bow[1]-M[pose].anchorY]])};
  }
  A.ready=true;return own;
 };
 A.anchor=(atk,row,col,tier=0,f='dharma')=>rigs[f].styles[A.styleOf(tier)][atk?'attack':'walk'][row*8+col];
 A.frame=function(key,row,col,tier=0){
  const a=A.anchor(key.includes('attack'),row,col,tier,key.endsWith('adharma')?'adharma':'dharma'),back=col>=3&&col<=5;
  return {...a,cx:a.headX,neck:a.neckY,top:a.headTop,headH:a.neckY-a.headTop,headScale:.8,idle:true,
   view:col===2||col===6?'side':back?'back':'front',trail:col>0&&col<4?-1:col>4?1:0};
 };
 A.register=function(f,atk){
  const I=ModelTiers.info(ModelTiers.key(f,atk,'archer'));if(!I)return;
  I.frames.forEach((F,i)=>{const a=rigs[f].styles.short[atk?'attack':'walk'][i];Object.assign(F,{y0:a.headTop,y1:a.feetY,BH:a.bodyHeight,cx:a.headX,neck:[a.headX,a.neckY],headC:[a.headX,a.headTop+25]});});
 };
 function analyse(style,pose,faction='dharma'){
  const src=sources[(faction==='adharma'?'dark-':'')+style+'-'+pose];if(analysis.has(src))return analysis.get(src);
  const c=mk(src.width,src.height),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(src,0,0);
  const data=g.getImageData(0,0,c.width,c.height),d=data.data,mask=new Uint8Array(c.width*c.height),P=M[pose];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const k=y*c.width+x,i=k*4;if(!d[i+3])continue;
   const col=Math.floor(x/P.frameWidth),row=Math.floor(y/P.frameHeight),a=rigs[faction].styles[style][pose][row*8+col];
   const lx=x%P.frameWidth,ly=y%P.frameHeight,dx=Math.abs(lx-a.headX),[r,gr,b]=[d[i],d[i+1],d[i+2]];
   const skin=r>155&&gr>100&&b>70&&r>gr*1.08&&b>gr*.65&&r>=b;
   if(skin)continue;
   // The reserved hair paint includes blue-grey AND violet highlights/shadows.
   // Requiring green >= red left lavender strands behind, like a second hairstyle.
   // Warm skin, gold ornaments and green eyes are outside this cool material range.
   const hair=b>r+1&&b>gr+1;
   if(hair){mask[k]=5;continue;}
   if(ly<a.neckY-3){if(gr>r*1.25&&gr>b*1.15&&ly>a.headTop+22)mask[k]=6;continue;}
   const dy=ly-a.neckY,slot=dy<13&&dx>12?3:dx>23&&dy<51?2:dy>51?1:0;
   mask[k]=(r>gr*1.09&&gr>b*1.15?7:1)+slot;
  }
  const v={data,mask};analysis.set(src,v);return v;
 }
 A.design=function(tier,f){
  if(tier===10)return {tier:5,cloth:f==='adharma'?'#682c50':'#208976',metal:f==='adharma'?'#daa4c2':'#dbcd8e',ivory:f==='adharma'?null:'#d9f4df',inlay:.95,lustre:.64};
  const t=Math.max(0,Math.min(9,tier|0)),dark=f==='adharma';
  return {tier:t,cloth:(dark?['#252127','#30232b','#36222b','#29232e','#35202a','#2c1823','#251620','#21131c','#281421','#1a1018']:
   ['#354d40','#486447','#48615b','#315d68','#286a57','#246c69','#305b53','#244e54','#235a59','#17483e'])[t],
   metal:t>=8?(dark?(t===9?'#d6ad73':'#b6a0b7'):(t===9?'#e4c47f':'#b6d8d0')):t>=5?(dark?'#bf9769':'#c6a966'):t>=3?'#a1b8b4':'#a08a62',
   ivory:dark?null:['#c4c0a7','#cac7ad','#d0cdb9','#d7d7c8','#dedecb','#e5e7d5','#ecebda','#eeeddd','#e6f0e8','#fff3d9'][t],
   inlay:[0,.1,.2,.35,.5,.65,.85,1.1,1.4,1.8][t],lustre:.2+t*.08};
 };
 A.body=function(f,atk,tier,ar){
  const pose=atk?'attack':'walk',style=A.styleOf(tier),src=sources[(f==='adharma'?'dark-':'')+style+'-'+pose],{data,mask}=analyse(style,pose,f);
  const out=new ImageData(new Uint8ClampedArray(data.data),data.width,data.height),d=out.data,dark=f==='adharma';
  const low=rgb(['#675744','#756347','#867452','#93926d','#a4b5a0','#bdcfbe','#dce6dc','#f2efda'][tier]);
  const high=rgb('#fff9e6');
  for(let k=0;k<mask.length;k++){
   const v=mask[k],i=k*4;
   if(v===6&&dark){const eye=d[i+1];d[i]=eye;d[i+1]*=.45;d[i+2]*=.55;}
   if(v!==5)continue;
   const lum=(data.data[i]*.24+data.data[i+1]*.55+data.data[i+2]*.21)/255;
   if(dark){
    const P=M[pose],x=k%data.width,y=Math.floor(k/data.width),col=Math.floor(x/P.frameWidth),row=Math.floor(y/P.frameHeight);
    const a=rigs[f].styles[style][pose][row*8+col],depth=(y%P.frameHeight-a.headTop)/a.bodyHeight;
    const [start,end]=style==='short'?[.20,.37]:style==='medium'?[.26,.49]:[.34,.65];
    let red=Math.max(0,Math.min(1,(depth-start)/(end-start)));red=red*red*(3-2*red);
    // Black roots and a distinct crimson dip-dye; original strand lighting remains visible.
    const root=[8+lum*32,7+lum*25,10+lum*29],tip=[72+lum*(93+tier*9),4+lum*22,17+lum*33];
    for(let j=0;j<3;j++)d[i+j]=root[j]*(1-red)+tip[j]*red;
    continue;
   }
   const shine=Math.max(0,(lum-.55)/.45)*.7;
   for(let j=0;j<3;j++)d[i+j]=(low[j]+(high[j]-low[j])*shine)*Math.min(1.1,.3+lum*1.1);
  }
  const c=mk(src.width,src.height);c.getContext('2d').putImageData(out,0,0);
  return DualbladeArmor.compose(c,pose,M,mask,ar,f,out.data,data.data,A.design);
 };
 A.compose=function(f,atk,tier,ar,wt){
  const body=A.body(f,atk,tier,ar),P=M[atk?'attack':'walk'],out=mk(body.width,body.height),g=out.getContext('2d');
  // Back views occlude the bow with the torso; front views show it across the outfit.
  for(let row=0;row<P.framesPerDir;row++)for(let col=0;col<8;col++){
   g.save();g.beginPath();g.rect(col*P.frameWidth,row*P.frameHeight,P.frameWidth,P.frameHeight);g.clip();g.translate(col*P.frameWidth,row*P.frameHeight);
   const a=A.anchor(atk,row,col,tier,f),pull=atk&&row===1?[a.headX-a.bow[6]*22,a.bow[3]]:null;
   const drawBody=()=>g.drawImage(body,col*P.frameWidth,row*P.frameHeight,P.frameWidth,P.frameHeight,0,0,P.frameWidth,P.frameHeight);
   if(!a.bowBehind)drawBody();
   ArcherGear.drawBow(g,a.bow,wt,f,pull,.72);
   if(a.bowBehind)drawBody();
   else{
    // Raised limb ornaments tuck under the head/hair instead of covering the face.
    g.save();g.beginPath();g.rect(0,0,P.frameWidth,a.neckY-3);g.clip();drawBody();g.restore();
    // The fist wraps over the grip. Restore only this small authored hand region.
    g.save();g.beginPath();g.ellipse(a.bow[2],a.bow[3],3.8,4.2,0,0,Math.PI*2);g.clip();drawBody();g.restore();
   }
   g.restore();
  }
  return out;
 };
 A.glintAnchors=function(key,row,col,tier){
  const pose=key.includes('attack')?'attack':'walk',P=M[pose],style=A.styleOf(tier),{mask,data}=analyse(style,pose,key.endsWith('adharma')?'adharma':'dharma');
  return [0,1,2,3].map(slot=>EquipmentGlints.pick(P.frameWidth,P.frameHeight,(x,y)=>{const k=(row*P.frameHeight+y)*data.width+col*P.frameWidth+x;return data.data[k*4+3]>200&&(mask[k]===slot+1||mask[k]===slot+7);},slot===1));
 };
 A.points=function(e,F,meta){const a=A.anchor(F.atk,F.frame,C.DIR_COL[F.dir],ModelTiers.tierOf(e.lvl||1),e.faction);if(a.bowBehind)return [];const b=a.bow;return [0,4].flatMap(k=>[.45,.7,.9].map(t=>[b[2]+(b[k]-b[2])*t+Math.sin(t*Math.PI)*b[6]*7-meta.anchorX,b[3]+(b[k+1]-b[3])*t-meta.anchorY]));};
 const portraits={};A.portrait=function(f){if(portraits[f])return portraits[f];const P=M.walk,c=mk(P.frameWidth,P.frameHeight);c.getContext('2d').drawImage(A.compose(f,false,0,[0,0,0,0],0),0,3*P.frameHeight,P.frameWidth,P.frameHeight,0,0,c.width,c.height);return portraits[f]=c.toDataURL();};
})();
