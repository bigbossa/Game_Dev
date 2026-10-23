// Fitted equipment materials: follow the artist's seams in each animation frame.
// Never add a second silhouette or place rigid panels using the head as a torso anchor.
(function(){
 const A=window.DualbladeArmor={},fields=new WeakMap();
 const LIGHT=['#333d50','#425471','#65534b','#315677','#277182','#275284','#24446d','#203e62','#285573','#233959'];
 const DARK=['#302535','#493348','#5c3841','#403957','#51314e','#58273d','#43253c','#3e203b','#3d2755','#491d32'];
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
 const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 A.design=(tier,faction)=>{
  if(tier===10)return {tier:5,cloth:faction==='adharma'?'#753657':'#247d6b',metal:faction==='adharma'?'#e2a4c4':'#e7d49d',inlay:1.65,lustre:.63};
  const t=clamp(tier|0,0,9),dark=faction==='adharma';
  return {tier:t,cloth:(dark?DARK:LIGHT)[t],
   metal:t===9?(dark?'#e3ad7d':'#efd18b'):t===8?(dark?'#c5a4e3':'#d2ebf0'):t>=5?'#d5b47a':t>=3?'#a4c7d9':t===2?'#b89c7b':t===1?'#8c9aaf':'#747981',
   // Width is in atlas pixels. Higher equipment grows existing inlays inside its own cloth surface.
   inlay:[0,0,.2,.55,.9,1.25,1.6,1.95,2.35,3.1][t],
   lustre:[.18,.24,.32,.46,.50,.62,.69,.76,.85,.94][t]};
 };
 const slotOf=v=>v>=7?v-7:v>=1&&v<=4?v-1:-1;
 function prepare(mask,source,W,H,fw,fh){
  if(fields.has(mask))return fields.get(mask);
  const slot=new Int8Array(mask.length),distance=new Float32Array(mask.length);
  const shade=new Float32Array(mask.length);
  for(let k=0;k<mask.length;k++){
   const i=k*4;slot[k]=slotOf(mask[k]);distance[k]=mask[k]>=7?0:99;
   shade[k]=(source[i]*.24+source[i+1]*.55+source[i+2]*.21)/255;
  }
  // Chamfer distance along each garment. No propagation through skin/hair, between equipment slots,
  // across disconnected sleeves, or across animation-cell boundaries.
  for(const reverse of [false,true]){
   const step=reverse?-1:1,start=reverse?mask.length-1:0,end=reverse?-1:mask.length;
   for(let k=start;k!==end;k+=step){
    if(slot[k]<0)continue;
    const x=k%W,y=Math.floor(k/W),lx=x%fw,ly=y%fh;
    for(const [dx,dy,cost]of [[-step,0,1],[0,-step,1],[-step,-step,1.414],[step,-step,1.414]]){
     if(lx+dx<0||lx+dx>=fw||ly+dy<0||ly+dy>=fh)continue;
     const n=k+dx+dy*W;if(slot[n]===slot[k])distance[k]=Math.min(distance[k],distance[n]+cost);
    }
   }
  }
  const result={slot,distance,shade};fields.set(mask,result);return result;
 }
 A.compose=function(base,pose,meta,mask,ar,faction,baseData,source,design=A.design){
  const W=base.width,H=base.height,P=meta[pose],F=prepare(mask,source,W,H,P.frameWidth,P.frameHeight);
  const c=Object.assign(document.createElement('canvas'),{width:W,height:H}),g=c.getContext('2d');
  const out=new ImageData(new Uint8ClampedArray(baseData),W,H),d=out.data;
  const palettes=Array.from({length:4},(_,slot)=>{
   const p=design(ar?.[slot]||0,faction);return {...p,cloth:rgb(p.cloth),metal:rgb(p.metal),ivory:p.ivory?rgb(p.ivory):null};
  });
  for(let k=0;k<mask.length;k++){
   const slot=F.slot[k];if(slot<0)continue;
   const i=k*4,p=palettes[slot],lum=F.shade[k],paintedMetal=mask[k]>=7;
   // Retain all original folds and outline shading. Broad flat polygons cannot slide over the pose.
   const clothShade=clamp(.25+lum*2.05,.24,1.30),metalShade=clamp(.24+lum*2.35,.24,1.34);
   const spread=paintedMetal?1:smooth((p.inlay+.65-F.distance[k])/.9);
   const amount=spread*(paintedMetal?(p.tier<3?.40+p.tier*.16:.9):.72+p.lustre*.22);
   const edgeGuard=smooth((lum-.035)/.12); // keep dark painted outlines, creases and small joins
   // Optional ivory silk keeps the celestial archer's pale panels distinct from jade insets.
   const silk=p.ivory&&!paintedMetal?smooth((lum-.45)/.35)*smooth((Math.min(source[i],source[i+1],source[i+2])/Math.max(1,source[i],source[i+1],source[i+2])-.78)/.16):0;
   for(let j=0;j<3;j++){
    const cloth=(p.cloth[j]*(1-silk)+(p.ivory?.[j]||0)*silk)*clothShade,metal=p.metal[j]*metalShade;
    const material=cloth+(metal-cloth)*amount;
    d[i+j]=clamp(material*edgeGuard+source[i+j]*(1-edgeGuard),0,255);
   }
  }
  // Alpha, protected skin, fingers, eyes and hair are copied verbatim. No secondary armour canvas,
  // no enlarged shoulder/coat fragments, and no cumulative source-over thickening of the edges.
  g.putImageData(out,0,0);return c;
 };
})();
