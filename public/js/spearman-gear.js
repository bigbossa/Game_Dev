// Model surfaces, not aura layers. Replaces pixels inside painted garment/hair regions.
(function(){
  const S=window.SpearmanGear={},regions=new WeakMap(),rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp=n=>Math.max(0,Math.min(1,n));
  const HAIR={dharma:['#374b69','#355a80','#46778f','#9bbecf','#bbd6e0','#dae5ea','#e4edf0','#fff2da'],adharma:['#252330','#372331','#51233b','#75263b','#85263c','#a52a45','#bf3c55','#de4e64']};
  // Eye guards follow the visible face, rather than reserving a horizontal band
  // across the entire head (which left blue side locks and nape stripes).
  // Eye centres on the reviewed front / quarter / side source art. Protect each
  // iris separately; an ellipse spanning both eyes also preserves blue bangs.
  const WALK_EYES = [
    [[[144,148.5,6,5],[169,148,6,5]],[[180,146,6,5],[199,149.5,4,4]],[[183,147,4,6]],[],[]],
    [[[145.5,145.5,6.5,5],[170.5,145.5,6.5,5]],[[176.5,143.5,6.5,5],[197.5,146,5,4.5]],[[179,144.5,4.5,5]],[],[]],
    [[[147.5,150.5,6.5,5],[172,151,6,4]],[[183,147,6,5],[202.5,150.5,4.5,5]],[[189,147,4,5]],[],[]],
  ];
  const CAST_EYES = [[[156,163,6,5],[179.5,165,5.5,4]],[[159,166,4.5,4],[178.5,172,5,4]],[[157.5,171,4.5,4]],[],[]];
  S.eyeRegions=(M,row,col)=>{
    const cast=M.framesPerDir===3,index=col>4?8-col:col;
    const points=(cast&&row===1?CAST_EYES:WALK_EYES[cast||row===3?1:row])[index];
    return points.map(([x,y,rx,ry])=>[col>4?M.frameWidth-1-x:x,y,rx,ry]);
  };
  const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  function protectFace(d,W,M,row,col,a,mask){
    if(col===4)return; // the rear view has no exposed face
    const fw=M.frameWidth,fh=M.frameHeight,ox=col*fw,oy=row*fh,B=a.bodyHeight;
    const x0=Math.max(0,Math.floor(a.headX-B*.44)),x1=Math.min(fw-1,Math.ceil(a.headX+B*.44));
    const y0=Math.max(0,Math.floor(a.headTop+B*.27)),y1=Math.min(fh-1,Math.ceil(a.headTop+B*.65));
    const candidates=new Set();
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=((oy+y)*W+ox+x)*4,r=d[i],g=d[i+1],b=d[i+2];
      if(d[i+3]>180&&r>160&&g>90&&b>65&&r>g*1.03&&g>b*1.04&&b>g*.65)candidates.add(y*fw+x);
    }
    let face=[];const parts=[];
    while(candidates.size){
      const q=[candidates.values().next().value];candidates.delete(q[0]);
      for(let i=0;i<q.length;i++)for(const n of [q[i]-1,q[i]+1,q[i]-fw,q[i]+fw])if(candidates.delete(n))q.push(n);
      parts.push(q);if(q.length>face.length)face=q;
    }
    if(face.length<12)return;
    // Convex skin boundary includes dark eyebrows, irises, lips and anti-aliased cheek edges.
    // These are facial detail, even when their pigment resembles red hair or dark armour.
    const bounds=part=>part.reduce((b,k)=>{const x=k%fw,y=Math.floor(k/fw);return [Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];},[fw,fh,0,0]);
    const fb=bounds(face);
    const facial=parts.filter(part=>{if(part===face)return true;if(part.length<8)return false;const b=bounds(part);return b[1]>=fb[1]-2&&b[3]<=fb[3]+2&&b[2]>=fb[0]-B*.13&&b[0]<=fb[2]+B*.13;});
    for(const part of facial){
    const points=[];
    for(const k of part){const x=k%fw,y=Math.floor(k/fw);for(const [dx,dy]of [[-2,-2],[2,-2],[-2,2],[2,2]])points.push([x+dx,y+dy]);}
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const hull=[];
    for(const p of points){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}
    const lower=hull.length;
    for(let i=points.length-2;i>=0;i--){const p=points[i];while(hull.length>lower&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}hull.pop();
    for(let y=y0-2;y<=y1+2;y++)for(let x=x0-2;x<=x1+2;x++){
      if(x<0||y<0||x>=fw||y>=fh)continue;
      let inside=true;for(let i=0;i<hull.length;i++)if(cross(hull[i],hull[(i+1)%hull.length],[x,y])<0){inside=false;break;}
      if(inside)mask[(oy+y)*W+ox+x]=1;
    }
    }
  }
  function classify(src,M,f){
    let cached=regions.get(src);if(cached)return cached;
    const c=mk(src.width,src.height),g=c.getContext('2d');g.drawImage(src,0,0);
    const data=g.getImageData(0,0,c.width,c.height),d=data.data,mask=new Uint8Array(c.width*c.height);
    const faceMask=f==='adharma'?new Uint8Array(mask.length):null;
    if(faceMask)M.poseFrames.forEach((a,i)=>protectFace(d,c.width,M,Math.floor(i/8),i%8,a,faceMask));
    const eyes=M.poseFrames.map((_,i)=>S.eyeRegions(M,Math.floor(i/8),i%8));
    for(let k=0;k<mask.length;k++){
      const i=k*4;if(d[i+3]<48||faceMask?.[k])continue;
      const x=k%c.width,y=Math.floor(k/c.width),col=Math.floor(x/M.frameWidth),row=Math.floor(y/M.frameHeight),a=M.poseFrames[row*8+col];
      const xx=x%M.frameWidth,yy=y%M.frameHeight,B=a.bodyHeight,u=(xx-a.headX)/B,v=(yy-a.headTop)/B;
      const r=d[i],gr=d[i+1],b=d[i+2],skin=r>gr*1.08&&gr>b*1.12&&r>150&&gr>94;
      if(skin)continue;
      const [tx,ty]=a.weaponTip,[hx,hy]=a.grip,dx=hx-tx,dy=hy-ty,L=Math.hypot(dx,dy);
      const along=((xx-tx)*dx+(yy-ty)*dy)/(L*L),dist=Math.abs((xx-tx)*dy-(yy-ty)*dx)/L;
      // Only the distal blade. Hands, shaft and the grip stay in the original painting.
      if(along>=-.06&&along<.48&&dist<B*(.085-along*.075)){mask[k]=6;continue;}
      const dark=f==='adharma',pigment=dark?(r>gr*1.12&&b>gr*.88):(b>r*1.12&&b>gr*1.03);
      const faceZone=eyes[row*8+col].some(([x,y,rx,ry])=>((xx-x)/rx)**2+((yy-y)/ry)**2<1);
      const rear=col>=3&&col<=5;
      const hairZone=(v<.59&&(v<.53||Math.abs(u)>.14))||
        (v>=.55&&Math.abs(u)>.31)||(rear&&v<.70&&Math.abs(u)<.32);
      if(pigment&&hairZone&&!faceZone){mask[k]=5;continue;}
      // Face shadows/lips are not cloth. Keep the broad garment exclusion,
      // after assigning the newly covered hair pixels to their own region.
      const faceSurface=v>.435&&v<.57&&Math.abs(u)<.22&&col!==4;
      if(v<.52||v>1.02||Math.abs(u)>.34||faceZone||faceSurface)continue;
      // The shaft must remain unchanged even when it crosses a sleeve or cuirass.
      if(along>=.48&&along<1.65&&dist<B*.025)continue;
      if(v<.65&&Math.abs(u)>.16)mask[k]=4;
      else if(v<.85&&Math.abs(u)>.17)mask[k]=3;
      else if(v>.86)mask[k]=2;
      else mask[k]=1;
    }
    cached={data,mask};regions.set(src,cached);return cached;
  }
  S.compose=(src,f,M,tier,ar,wt)=>{
    const {data,mask}=classify(src,M,f),c=mk(src.width,src.height),g=c.getContext('2d');
    const im=new ImageData(new Uint8ClampedArray(data.data),c.width,c.height),d=im.data,dark=f==='adharma';
    const hair=rgb(HAIR[f][tier]),ink=rgb(dark?'#120c18':'#172b46'),light=rgb(dark?'#ffb9ad':'#fff9e7');
    const hairInk=rgb(!dark&&tier>=5?(tier===7?'#635b55':'#525864'):(dark?'#120c18':'#172b46'));
    const cloth=ar.map(t=>rgb(C.ARMOR_SETS[t-1]?.look[f].color||(dark?'#38212b':'#557b9a')));
    for(let k=0;k<mask.length;k++){
      const region=mask[k];if(!region)continue;const i=k*4;
      const lum=(Math.max(d[i],d[i+1],d[i+2])+Math.min(d[i],d[i+1],d[i+2]))/510;
      if(region===6){d[i+3]=0;continue;} // old blade removed before constructing its replacement
      let out;
      if(region===5){
        out=lum<.42?blend(hairInk,hair,clamp(lum/.42)):blend(hair,light,clamp((lum-.42)*1.3));
      }else{
        const slot=region-1,t=ar[slot]||0;if(!t)continue;
        const x=k%c.width,y=Math.floor(k/c.width),a=M.poseFrames[Math.floor(y/M.frameHeight)*8+Math.floor(x/M.frameWidth)];
        const u=(x%M.frameWidth-a.headX)/a.bodyHeight,v=(y%M.frameHeight-a.headTop)/a.bodyHeight;
        const base=cloth[slot],metal=rgb(t>=6?(dark?'#c7a080':'#e4cf97'):t>=3?'#a9bbcc':dark?'#744c50':'#9db3c7');
        // Cloth weave -> leather seams -> overlapping scales -> flowing silk -> jade plates -> dragon brocade.
        let shade=lum,accent=0;
        if(t===1)shade*=.87+((x+y)%4)*.025;
        if(t===2){shade*=.85;if((x+Math.floor(y/12)*5)%19<2)accent=.23;}
        if(t===3){const sy=y%7,sx=(x+Math.floor(y/7)*4)%9;shade*=.84+sy*.022;if(sy===0||sx===0)accent=.16;}
        if(t===4)shade=clamp(shade+.06*Math.sin(u*48+v*14));
        if(t===5){shade*=.78+Math.sin(u*36)**2*.22;if((x+Math.floor(y/15)*7)%25<2)accent=.48;}
        if(t>=6){const filigree=Math.sin(u*65+Math.sin(v*25)*2)*Math.cos(v*65);if(filigree>.88)accent=.65;}
        out=shade<.48?blend(ink,base,clamp(shade/.48)):blend(base,light,clamp((shade-.48)*1.55));
        if(accent)out=blend(out,metal,accent);
        // Construction seams replace painted trim within the garment, never add floating plates.
        if(slot===0&&Math.abs(Math.abs(u)-(.04+(v-.55)*.22))<.006)out=blend(out,metal,.65);
        if(slot===1&&Math.abs(u)<.012)out=blend(out,ink,.4);
      }
      for(let j=0;j<3;j++)d[i+j]=out[j];
    }
    // Replace the garment geometry too: remove each original slot, then fit its
    // painted texture to a tier-specific silhouette. Skin/hair are restored last.
    // The royal body already has its full authored silhouette. Stretching separated
    // pixel islands opens cracks between fine armour seams at Lv.100–130.
    const slots=ar.map(t=>t&&!(dark&&tier>=6)?new ImageData(c.width,c.height):null);
    for(let k=0;k<mask.length;k++){
      const slot=mask[k]-1;if(slot<0||slot>3||!slots[slot])continue;
      slots[slot].data.set(d.subarray(k*4,k*4+4),k*4);d[k*4+3]=0;
    }
    for(let slot=0;slot<4;slot++)if(slots[slot]){
      const layer=mk(c.width,c.height);layer.getContext('2d').putImageData(slots[slot],0,0);
      const t=ar[slot],sx=slot===3?1+t*.018:slot===2?1+t*.012:slot===0?1+t*.009:1+t*.006;
      M.poseFrames.forEach((a,i)=>{const X=(i%8)*M.frameWidth,Y=Math.floor(i/8)*M.frameHeight;
        g.save();g.beginPath();g.rect(X,Y,M.frameWidth,M.frameHeight);g.clip();
        g.drawImage(layer,X,Y,M.frameWidth,M.frameHeight,X+a.headX*(1-sx),Y,M.frameWidth*sx,M.frameHeight);g.restore();
      });
    }
    const body=mk(c.width,c.height);body.getContext('2d').putImageData(im,0,0);g.drawImage(body,0,0);
    M.poseFrames.forEach((a,i)=>{
      g.save();const X=(i%8)*M.frameWidth,Y=Math.floor(i/8)*M.frameHeight;
      g.beginPath();g.rect(X,Y,M.frameWidth,M.frameHeight);g.clip();g.translate(X,Y);
      S.blade(g,a,wt,f,M.frameWidth,M.frameHeight);g.restore();
    });
    return c;
  };
  S.blade=(g,a,t,f,fw,fh)=>SpearWeapon.held(g,a,t,f,fw,fh);
})();
