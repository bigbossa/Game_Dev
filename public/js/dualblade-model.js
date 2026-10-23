// Complete painted replacement bodies. Never combine the old costume or its region masks with this art.
(function(){
 const D=window.DualbladeModel={ready:false},sources={},analysed=new WeakMap();let M;
 const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 D.styleOf=stage=>stage<4?'short':stage<9?'medium':'long';
 D.load=async function(loadImg,IMG,SPR){
  M=await fetch('assets/dualblade-v2/model.json').then(r=>{if(!r.ok)throw Error('Dualblade model missing');return r.json();});
  await Promise.all(['','dark-'].flatMap(prefix=>['short','medium','long'].flatMap(style=>['walk','attack'].map(async pose=>{
   sources[`${prefix}${style}-${pose}`]=await loadImg(`assets/dualblade-v2/${prefix}${style}-${pose}.png`);
  }))));
  Object.assign(SPR,M.walk,{adharmaWalk:true});Object.assign(SPR.attack,M.attack);
  for(const f of ['dharma','adharma']){const p=f==='adharma'?'dark-':'';IMG[f]=sources[p+'long-walk'];IMG[`${f}-attack`]=sources[p+'long-attack'];}
  D.ready=true;return M.weapons;
 };
 // Replace the generic colour-based head detector with the source artist's anatomy landmarks.
 D.register=function(){
  for(const key of ['walk','walk-adharma','attack']){
   const I=ModelTiers.info(key),pose=key==='attack'?'attack':'walk';if(!I)continue;
   I.frames.forEach((F,i)=>{const A=M.frames[pose][i];if(!F||!A)return;
    Object.assign(F,{y0:A.headTop,y1:A.feetY,BH:A.bodyHeight,cx:A.headX,
     neck:[A.headX,A.neckY],headC:[A.headX,A.headTop+A.bodyHeight*.27],tie:[A.headX,A.headTop+A.bodyHeight*.10]});
   });
  }
 };
 function analyse(src,pose){
  if(analysed.has(src))return analysed.get(src);
  const c=mk(src.width,src.height),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(src,0,0);
  const data=g.getImageData(0,0,c.width,c.height),mask=new Uint8Array(c.width*c.height),P=M[pose];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const k=y*c.width+x,i=k*4,d=data.data;if(!d[i+3])continue;
   const col=Math.floor(x/P.frameWidth),row=Math.floor(y/P.frameHeight),A=M.frames[pose][row*8+col];
   const lx=x%P.frameWidth,ly=y%P.frameHeight,B=A.bodyHeight,side=col===2||col===6,front=col<3||col>5;
   const faceX=A.headX+(col===1||col===2?B*.1:col===6||col===7?-B*.1:-B*.03);
   const [r,gr,b]=[d[i],d[i+1],d[i+2]],warm=r>b*1.12&&r>gr*1.06;
   const face=front&&((lx-faceX)/(B*(side?.12:.17)))**2+((ly-(A.headTop+B*.39))/(B*.10))**2<1;
   // Protect actual facial pigments, not a rectangular patch of silver fringe.
   if(face&&(warm||Math.max(r,gr,b)<60))continue;
   if(face&&b>r*1.7&&gr>r*1.3&&r<80){mask[k]=6;continue;}
   if(warm&&r>155&&b>gr*.66)continue; // hands / ears
   const outerHair=Math.abs(lx-A.headX)>B*.22&&ly<A.feetY-B*.08&&r>38&&gr>60&&b>90;
   if(!warm&&b>=r*.98&&b-gr<85&&(r>75||outerHair)){mask[k]=5;continue;} // include the blue shadows at the tail tips
   if(ly<A.neckY-B*.025)continue;
   const dx=Math.abs(lx-A.headX),dy=(ly-A.neckY)/B;
   const slot=dy<.12&&dx>B*.16?3:dx>B*.24&&dy<.4?2:dy>.37?1:0;
   if(b>r*1.04||r<72&&gr<78&&b<100)mask[k]=slot+1;
   else if(warm&&b<gr*.72)mask[k]=slot+7; // painted metal uses the equipped slot's finish
  }
  const out={data,mask};analysed.set(src,out);return out;
 }
 D.compose=function(faction,key,stage,ar){
  const pose=key==='attack'?'attack':'walk',dark=faction==='adharma',src=sources[`${dark?'dark-':''}${D.styleOf(stage)}-${pose}`];
  const {data,mask}=analyse(src,pose),c=mk(src.width,src.height),g=c.getContext('2d');
  const out=new ImageData(new Uint8ClampedArray(data.data),data.width,data.height),d=out.data;
  // Dark saturated cloth survives light stone/grass backgrounds even at the world scale.
  const lightCloth=['#303c51','#314c66','#294369','#244d70','#235469','#255078','#263c6a','#263c70','#163d68','#182e50'];
  const darkCloth=['#302335','#382535','#422333','#482033','#38233e','#49213a','#351e33','#451d30','#381c3e','#401528'];
  const hair=rgb((dark?['#312633','#382331','#402432','#492335','#512237','#58253b','#62253e','#542033','#602138','#682239','#74233d','#7c233d','#86263e','#902940']:
   ['#625a65','#656377','#69768e','#71869a','#8499ab','#97acbc','#a5b7c7','#b5c6d3','#c5d0da','#d3dbe2','#dce2e6','#e5e7e7','#ece9de','#f4edde'])[stage]);
  const cloth=(ar||[0,0,0,0]).map(t=>rgb((dark?darkCloth:lightCloth)[Math.min(9,t||0)]));
  const metal=(ar||[0,0,0,0]).map(t=>rgb(t>=8?(dark?(t===9?'#e6a174':'#bb97d8'):(t===9?'#f3ca70':'#c7dded')):t>=4?'#d6b576':t>=1?'#b2bbc5':'#8c8275'));
  for(let k=0;k<mask.length;k++){
   const v=mask[k];if(!v)continue;const i=k*4;
   const lum=d[i]*.24+d[i+1]*.55+d[i+2]*.21;
   if(v===6){if(dark){const b=d[i+2];d[i]=b;d[i+1]*=.5;d[i+2]*=.45;}continue;}
   const p=v===5?hair:v>=7?metal[v-7]:cloth[v-1];
   const shade=v===5?Math.max(.24,lum/205):v>=7?Math.max(.14,lum/170):Math.max(.18,lum/55);
   for(let j=0;j<3;j++)d[i+j]=Math.min(255,p[j]*shade);
  }
  g.putImageData(out,0,0);
  return window.DualbladeArmor ? DualbladeArmor.compose(c,pose,M,mask,ar,faction,out.data,data.data) : c;
 };
 D.meta=()=>M;
 D.glintAnchors=function(key,row,col,stage,faction='dharma'){
  const pose=key==='attack'?'attack':'walk',P=M[pose],src=sources[(faction==='adharma'?'dark-':'')+D.styleOf(stage)+'-'+pose],{mask,data}=analyse(src,pose);
  return [0,1,2,3].map(slot=>EquipmentGlints.pick(P.frameWidth,P.frameHeight,(x,y)=>{
   const k=(row*P.frameHeight+y)*src.width+col*P.frameWidth+x;
   return data.data[k*4+3]>200&&(mask[k]===slot+1||mask[k]===slot+7);
  },slot===1));
 };
 const portraits={};
 D.portrait=function(faction){
  if(portraits[faction])return portraits[faction];
  const body=D.compose(faction,'walk',0,[0,0,0,0]),P=M.walk,c=mk(P.frameWidth,P.frameHeight);
  c.getContext('2d').drawImage(body,0,P.frameHeight,P.frameWidth,P.frameHeight,0,0,P.frameWidth,P.frameHeight);
  return portraits[faction]=c.toDataURL();
 };
})();
