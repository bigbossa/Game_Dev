// The walk sheet has a larger head and shorter torso than its turnaround row.
// Match that row's proportions in the outfit cache, keeping the feet fixed.
// Equipment and hair are transformed together; live attachments use this map.
(function () {
  const AP=window.ArcherPose={}, profiles=new Map();
  const clamp=v=>Math.max(0,Math.min(1,v));
  AP.prepare=function(f,meta){
    const m=meta.walk[f],frames=[];
    for(let row=0;row<3;row++)for(let col=0;col<8;col++){
      const a=ArcherGear.anchor(f,false,row,col).body;
      const base=ArcherGear.anchor(f,false,0,col).body;
      const idle=ArcherGear.anchor(f,false,3,col).body;
      const headScale=58/77,dy=idle[1]+(a[1]-base[1])*headScale;
      frames.push({
        sx:a[0],sy:a[1],dx:idle[0]+(a[0]-base[0])*headScale,dy,
        headScale,bodyWidth:idle[4]/a[4],
        bodyScale:(m.anchorY-dy)/(m.anchorY-a[1]),
        footX:m.anchorX,footY:m.anchorY,
      });
    }
    profiles.set(`arc-walk-${f}`,{m,frames});
  };
  function rowMap(p,y){
    const body=clamp((y-p.sy)/(p.footY-p.sy));
    const neck=clamp((p.sy-y)/16),blend=neck*neck*(3-2*neck);
    return {
      width:(p.bodyWidth+(1-p.bodyWidth)*body)*(1-blend)+p.headScale*blend,
      sx:p.sx+(p.footX-p.sx)*body,dx:p.dx+(p.footX-p.dx)*body,
      y:p.dy+(y-p.sy)*(y<=p.sy?p.headScale:p.bodyScale),
    };
  }
  AP.point=function(key,row,col,x,y){
    const p=profiles.get(key)?.frames[row*8+col];
    if(!p)return [x,y];
    const a=rowMap(p,y);return [a.dx+(x-a.sx)*a.width,a.y];
  };
  AP.headScale=(key,row,col)=>profiles.get(key)?.frames[row*8+col]?.headScale||1;
  // Runs only when an outfit enters ArmorLook's bounded cache, never per frame.
  AP.compose=function(src,key){
    const profile=profiles.get(key);if(!profile)return src;
    const {m,frames}=profile,w=src.width,h=src.height;
    const input=document.createElement('canvas');input.width=w;input.height=h;
    const ig=input.getContext('2d');ig.drawImage(src,0,0);
    const pixels=ig.getImageData(0,0,w,h);
    const out=document.createElement('canvas');out.width=w;out.height=h;
    const g=out.getContext('2d'),id=g.createImageData(w,h),d=id.data;
    // Preserve the reference turnaround exactly, including its alpha contour.
    d.set(pixels.data.subarray(3*m.frameHeight*w*4),3*m.frameHeight*w*4);
    const data=pixels.data;
    for(const [n,p]of frames.entries()){
      const col=n%8,row=Math.floor(n/8),ox=col*m.frameWidth,oy=row*m.frameHeight;
      for(let y=0;y<m.frameHeight;y++){
        const sy=p.sy+(y+.5-p.dy)/(y+.5<=p.dy?p.headScale:p.bodyScale);
        if(sy<0||sy>=m.frameHeight)continue;
        const a=rowMap(p,sy);
        for(let x=0;x<m.frameWidth;x++){
          const sx=a.sx+(x+.5-a.dx)/a.width;
          if(sx<0||sx>=m.frameWidth)continue;
          const bx=Math.floor(sx-.5),by=Math.floor(sy-.5),fx=sx-.5-bx,fy=sy-.5-by;
          let alpha=0,r=0,green=0,b=0;
          // Premultiplied bilinear interpolation prevents dark transparent edges.
          for(let v=0;v<2;v++)for(let u=0;u<2;u++){
            const px=bx+u,py=by+v;
            if(px<0||py<0||px>=m.frameWidth||py>=m.frameHeight)continue;
            const i=((oy+py)*w+ox+px)*4,weight=(u?fx:1-fx)*(v?fy:1-fy)*data[i+3];
            alpha+=weight;r+=data[i]*weight;green+=data[i+1]*weight;b+=data[i+2]*weight;
          }
          if(alpha){
            const i=((oy+y)*w+ox+x)*4;
            d[i]=r/alpha;d[i+1]=green/alpha;d[i+2]=b/alpha;d[i+3]=alpha;
          }
        }
      }
    }
    g.putImageData(id,0,0);return out;
  };
})();
