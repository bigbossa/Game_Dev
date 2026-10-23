// Slot masks and weapon anchors for the V4 painting. Coordinates are in source cells.
// Classify once at build time; rendering only reads a cached 320x280 frame.
const fs=require('node:fs'),path=require('node:path'),L=require('./img-lib');
const dir=path.join(__dirname,'../public/assets/warrior-v4'),M=JSON.parse(fs.readFileSync(path.join(dir,'model.json')));
const FW=M.frameWidth,FH=M.frameHeight;
// Blade root (past the guard), blade tip. Hidden weapons have no foreground effects.
const BLADES=[
  [[76,239,10,272],[78,244,12,279],[127,259,216,280],null,[195,257,247,289]],
  [[73,234,15,252],[77,232,10,254],[111,234,216,241],null,[194,232,247,251]],
  [[66,217,10,245],[78,230,13,262],[121,223,218,239],null,[194,231,248,251]],
  [[66,73,18,16],[64,77,12,44],[68,80,10,49],[221,76,272,43],[186,66,243,20]],
];
// Visible shield boundaries; back-side shields are still tinted with weapon equipment.
const SHIELDS=[
  [[[226,126],[278,164],[283,247],[260,279],[214,236],[205,155]],[[218,133],[260,168],[269,238],[251,275],[213,226],[204,157]],[[217,144],[237,176],[240,264],[221,251],[208,179]],[[92,154],[109,149],[108,236],[79,248],[74,191]],[[52,158],[60,150],[55,239],[20,251],[18,184]]],
  [[[226,125],[277,161],[283,239],[263,265],[215,227],[206,150]],[[221,125],[263,154],[274,224],[252,266],[212,220],[204,150]],[[219,131],[242,162],[244,255],[222,231],[209,157]],[[92,143],[110,140],[108,228],[74,238],[74,178]],[[52,145],[61,142],[55,230],[18,236],[17,176]]],
  [[[225,138],[278,173],[284,240],[262,270],[215,231],[206,161]],[[218,136],[264,168],[274,237],[250,267],[211,226],[204,161]],[[219,140],[243,173],[247,257],[222,240],[210,164]],[[92,147],[111,144],[109,235],[75,242],[75,183]],[[52,150],[61,147],[56,232],[19,244],[18,180]]],
  [[[244,91],[297,128],[298,200],[273,214],[239,177],[229,117]],[[223,94],[261,127],[266,195],[245,210],[216,176],[209,117]],[[217,107],[242,142],[245,201],[224,185],[208,127]],[[50,99],[69,88],[66,178],[27,187],[18,139]],[[41,85],[77,109],[63,174],[22,203],[5,173],[9,120]]],
];
const inside=(x,y,p)=>{let v=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;};
function hullOf(points){
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const hull=[],cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  for(const p of points){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}const lower=hull.length;
  for(let i=points.length-2;i>=0;i--){const p=points[i];while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}hull.pop();return hull;
}
for(const f of ['dharma','adharma'])for(const pose of ['walk','attack']){
  const im=L.readPng(path.join(dir,`${f}-${pose}.png`)),old=L.readPng(path.join(dir,`${f}-${pose}-mask.png`)),D=im.data,out=new Uint8ClampedArray(D.length);
  M.landmarks[f][pose].forEach((m,index)=>{
    const col=index%8,row=index/8|0,[sc,sr]=m.sourceCell,[ox,oy]=m.sourceOffset,s=m.sourceScale,flip=col>4;
    const point=([x,y])=>[flip?FW-1-(x*s+ox):x*s+ox,y*s+oy];
    const src=BLADES[sr][sc],guide=src?[point(src.slice(0,2)),point(src.slice(2))]:null,shield=SHIELDS[sr][sc].map(point);
    let blade=guide,bladeHull=null;
    if(guide){
      const [[ax,ay],[bx,by]]=guide,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),pixels=new Set();
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
        const i=((row*FH+y)*im.width+col*FW+x)*4,[r,g,b]=D.subarray(i,i+3),q=((x-ax)*dx+(y-ay)*dy)/(len*len),d=Math.abs((x-ax)*dy-(y-ay)*dx)/len;
        const [h,sat,l]=L.rgb2hsl(r,g,b);
        if(D[i+3]>90&&q>=-.23&&q<=1.2&&d<24*s&&sat<.3&&l>.32&&(b>=r*.92||g>=r*.98))pixels.add(y*FW+x);
      }
      let best=[],score=Infinity;
      while(pixels.size){const q=[pixels.values().next().value];pixels.delete(q[0]);for(let i=0;i<q.length;i++)for(const d of [-FW-1,-FW,-FW+1,-1,1,FW-1,FW,FW+1])if(pixels.delete(q[i]+d))q.push(q[i]+d);
        if(q.length<12)continue;const distance=Math.min(...q.map(k=>Math.hypot(k%FW-bx,(k/FW|0)-by)));
        if(distance<score){score=distance;best=q;}
      }
      if(best.length){
        const ps=best.map(k=>[k%FW,k/FW|0]);bladeHull=hullOf(ps.flatMap(([x,y])=>[[x-1.5,y-1.5],[x+1.5,y-1.5],[x-1.5,y+1.5],[x+1.5,y+1.5]]));
        const ordered=ps.map(p=>({p,q:((p[0]-ax)*dx+(p[1]-ay)*dy)/len})).sort((a,b)=>a.q-b.q),lo=ordered[0].q,hi=ordered.at(-1).q;
        const average=arr=>arr.reduce((a,{p})=>[a[0]+p[0]/arr.length,a[1]+p[1]/arr.length],[0,0]);
        blade=[average(ordered.filter(p=>p.q<lo+3)),average(ordered.filter(p=>p.q>hi-2))];
      }
    }
    m.blade=blade;m.shield=shield;m.bladeHull=bladeHull;
    const B=m.feetY-m.headTop,cx=(m.head.x0+m.head.x1)/2,slotPoints=[[],[],[],[]],weapon=[];
    // Connected facial skin gives a face envelope that also protects eyes and lips.
    const candidates=new Set(),protectedFace=new Uint8Array(FW*FH);
    for(let y=Math.max(0,Math.floor(m.headTop+B*.28));y<Math.min(FH,m.headTop+B*.61);y++)for(let x=Math.max(0,Math.floor(cx-B*.22));x<Math.min(FW,cx+B*.22);x++){
      const k=((row*FH+y)*im.width+col*FW+x)*4,[r,g,b]=D.subarray(k,k+3);
      if(D[k+3]>180&&r>165&&g>105&&b>65&&r>g*1.05&&g>b*1.04&&b>g*.64)candidates.add(y*FW+x);
    }
    let face=[];
    while(candidates.size){const q=[candidates.values().next().value];candidates.delete(q[0]);for(let i=0;i<q.length;i++)for(const n of [q[i]-1,q[i]+1,q[i]-FW,q[i]+FW])if(candidates.delete(n))q.push(n);if(q.length>face.length)face=q;}
    if(face.length>25&&col!==4){
      const points=face.flatMap(k=>{const x=k%FW,y=k/FW|0;return [[x-2,y-2],[x+2,y-2],[x-2,y+2],[x+2,y+2]];}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),hull=[];
      for(const p of points){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}const lower=hull.length;
      for(let i=points.length-2;i>=0;i--){const p=points[i];while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}hull.pop();
      for(let y=0;y<FH;y++)for(let x=0;x<FW;x++)if(inside(x,y,hull))protectedFace[y*FW+x]=1;
    }
    for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){
      const k=((row*FH+y)*im.width+col*FW+x)*4;if(!D[k+3]||protectedFace[y*FW+x])continue;
      const [r,g,b]=D.subarray(k,k+3),v=(y-m.headTop)/B,u=(x-cx)/B;
      const skin=r>155&&g>88&&b>55&&r>g*1.08&&g>b*1.07;
      let region=0;
      if(inside(x,y,shield))region=7;
      if(bladeHull&&inside(x,y,bladeHull))region=6;
      if(!region&&!skin){
        // Preserve face, eyes, helmet, gold edging and skin. Exposed hair alone follows level.
        if(old.data[k]&&v<.47)region=5;
        if(v>=.48&&v<=1.02&&Math.abs(u)<.37){
          if(v<.63&&Math.abs(u)>.15)region=4;
          else if(v<.84&&Math.abs(u)>.20)region=3;
          else if(v>.84)region=2;
          else region=1;
        }
      }
      if(region){out[k]=region*30;out[k+3]=D[k+3];}
      if(D[k+3]>220&&region>=1&&region<=4)slotPoints[region-1].push([x,y]);
      if(region===6&&D[k+3]>220)weapon.push([x,y]);
    }
    // Lights are pinned to actual visible pieces, never an empty bounding-box centre.
    m.glints=slotPoints.map(ps=>{if(!ps.length)return [];const avg=ps.reduce((a,p)=>[a[0]+p[0]/ps.length,a[1]+p[1]/ps.length],[0,0]);return [ps.reduce((a,p)=>Math.hypot(p[0]-avg[0],p[1]-avg[1])<Math.hypot(a[0]-avg[0],a[1]-avg[1])?p:a)];});
  });
  L.writePng(path.join(dir,`${f}-${pose}-gear.png`),im.width,im.height,out);
}
fs.writeFileSync(path.join(dir,'model.json'),JSON.stringify(M));
console.log('PASS: warrior V4 per-slot gear masks and pose-anchored weapons.');
