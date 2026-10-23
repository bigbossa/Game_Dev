// The cast artwork has adult proportions; the walk artwork is chibi.
// Normalize once at load time, before masks, equipment and level looks are built.
// All coordinates use the same map, including shoulders and weapon particles.
(function () {
  const TP = window.TaoistPose = {}, profiles = new Map();
  const headTop = {
    dharma: [[15,16,15,16,17,17,17,14],[36,35,37,40,39,40,38,37],[22,22,23,22,23,23,24,22]],
    adharma: [[15,15,16,16,17,16,17,16],[35,36,38,39,39,39,37,36],[34,34,34,34,34,34,34,34]],
  };
  const walkTop = {
    dharma: [10,10,10,12,11,12,10,10],
    adharma: [12,12,13,13,13,13,13,12],
  };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function rowMap(p,y) {
    const body = clamp((y-p.sy)/(p.footY-p.sy),0,1);
    // Blend across the neck; a hard horizontal scale change creates a visible seam.
    const neck = clamp((p.sy-y)/16,0,1), blend = neck*neck*(3-2*neck);
    const width = (p.bodyWidth+(1-p.bodyWidth)*body)*(1-blend)+p.headScale*blend;
    return {
      width,
      sx:p.sx+(p.footX-p.sx)*body,
      dx:p.dx+(p.destFootX-p.dx)*body,
      y:p.dy+(y-p.sy)*(y<=p.sy?p.headScale:p.bodyScale),
    };
  }
  function point(p,x,y) {
    const a=rowMap(p,y);
    return [a.dx+(x-a.sx)*a.width,a.y];
  }
  TP.point = function(key,row,col,x,y) {
    const p=profiles.get(key)?.frames[row*8+col];
    return p?point(p,x,y):[x,y];
  };
  TP.attachment = function(key,F,a) {
    const p=profiles.get(key)?.frames[F.row*8+F.col];
    if(!p)return a;
    const [x,y]=point(p,a[0],a[1]),s=rowMap(p,a[1]);
    return [x,y,a[2]*s.width,Math.atan(Math.tan(a[3])*p.bodyScale/s.width)];
  };
  // Inverse resampling avoids scanline gaps. RGBA is interpolated with alpha;
  // categorical armour masks use nearest sampling to preserve channel IDs.
  function resample(image,profile,mask) {
    const {source:m,target:n,frames}=profile;
    const input=document.createElement('canvas');input.width=image.width;input.height=image.height;
    const ig=input.getContext('2d');ig.drawImage(image,0,0);
    const src=ig.getImageData(0,0,input.width,input.height).data;
    const out=document.createElement('canvas');out.width=n.frameWidth*8;out.height=n.frameHeight*m.framesPerDir;
    const g=out.getContext('2d'),id=g.createImageData(out.width,out.height),dst=id.data;
    for(const [f,p]of frames.entries()){
      const col=f%8,row=Math.floor(f/8),ox=col*n.frameWidth,oy=row*n.frameHeight;
      for(let y=0;y<n.frameHeight;y++){
        const sy=p.sy+(y+.5-p.dy)/(y+.5<=p.dy?p.headScale:p.bodyScale);
        if(sy<0||sy>=m.frameHeight)continue;
        const a=rowMap(p,sy);
        for(let x=0;x<n.frameWidth;x++){
          const sx=a.sx+(x+.5-a.dx)/a.width;
          if(sx<0||sx>=m.frameWidth)continue;
          const d=((oy+y)*out.width+ox+x)*4;
          if(mask){
            const s=((row*m.frameHeight+Math.floor(sy))*input.width+col*m.frameWidth+Math.floor(sx))*4;
            dst[d]=src[s];dst[d+1]=src[s+1];dst[d+2]=src[s+2];dst[d+3]=src[s+3];
          }else{
            const bx=Math.floor(sx-.5),by=Math.floor(sy-.5),fx=sx-.5-bx,fy=sy-.5-by;
            let alpha=0,r=0,green=0,b=0;
            for(let v=0;v<2;v++)for(let u=0;u<2;u++){
              const px=bx+u,py=by+v;
              if(px<0||py<0||px>=m.frameWidth||py>=m.frameHeight)continue;
              const s=((row*m.frameHeight+py)*input.width+col*m.frameWidth+px)*4;
              const w=(u?fx:1-fx)*(v?fy:1-fy)*src[s+3];
              alpha+=w;r+=src[s]*w;green+=src[s+1]*w;b+=src[s+2]*w;
            }
            if(alpha){dst[d]=r/alpha;dst[d+1]=green/alpha;dst[d+2]=b/alpha;dst[d+3]=alpha;}
          }
        }
      }
    }
    g.putImageData(id,0,0);
    return out;
  }
  TP.prepare = function(faction,images,meta) {
    const key=`tao-attack-${faction}`,m=meta.attack[faction],w=meta.walk[faction];
    if(!m||m.normalizedPose)return;
    const n={...m,frameWidth:256,frameHeight:240,anchorX:128,anchorY:238,normalizedPose:true};
    const frames=[];
    for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
      const F={row,col},cast=TaoistGear.attachment(key,F);
      const walk=TaoistGear.attachment(`tao-walk-${faction}`,{row:1,col});
      const targetHead=walk[1]-walkTop[faction][col],sourceHead=cast[1]-headTop[faction][row][col];
      frames.push({
        sx:cast[0],sy:cast[1],dx:n.anchorX+walk[0]-w.anchorX,dy:n.anchorY-(w.anchorY-walk[1]),
        footX:m.anchorX,footY:m.anchorY,destFootX:n.anchorX,
        headScale:targetHead/sourceHead,bodyScale:(w.anchorY-walk[1])/(m.anchorY-cast[1]),
        bodyWidth:walk[2]/cast[2],sourceHeadTop:headTop[faction][row][col],
      });
    }
    const profile={source:m,target:n,frames};
    images[`taoist-${faction}-attack`]=resample(images[`taoist-${faction}-attack`],profile,false);
    for(const prefix of ['armor-','armor2-']){
      const name=prefix+key;
      if(images[name])images[name]=resample(images[name],profile,true);
    }
    // Metadata for hair/crown analysis must exclude the raised whisk.
    n.poseFrames=frames.map(p=>({
      headTop:point(p,p.sx,p.sourceHeadTop)[1],
      collar:point(p,p.sx,p.sy),
    }));
    n.weaponPts=(m.weaponPts||[]).map((pts,f)=>pts.map(([x,y])=>{
      const q=point(frames[f],x+m.anchorX,y+m.anchorY);
      return [q[0]-n.anchorX,q[1]-n.anchorY];
    }));
    profiles.set(key,profile);
    meta.attack[faction]=n;
  };
})();
