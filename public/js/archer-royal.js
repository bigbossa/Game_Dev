// Elf / dark-elf progression. Hair is baked into the outfit cache; jewellery and
// the restrained royal aura use authored head/shoulder anchors for every pose.
(function () {
  const R=window.ArcherRoyal={}, poses=new Map(), TAU=Math.PI*2;
  const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const HAIR={
    dharma:[
      null,['#65442e','#d2a878'],['#705030','#ead29b'],['#776342','#fff0bf'],
      ['#536d5e','#d9efcc'],['#81704b','#fff2c9'],['#5e857a','#f0fff0'],['#788d7b','#fffcec']
    ],
    adharma:[
      null,['#25171d','#966071'],['#21131a','#88505a'],['#1c1016','#783942'],
      ['#170c12','#642630'],['#12090f','#511b25'],['#0d070c','#3e161f'],['#080509','#2c1018']
    ]
  };
  R.palette=(f,t)=>f==='adharma'
    ? {metal:t>=5?'#c65b65':'#ba8a91',dark:t>=6?'#10070c':'#27131d',gem:'#ee334c',light:'#ffb5b9',
      leaf:['#70434f','#68404a','#61313e','#542431','#461925','#35111e','#260c16','#190810'][Math.max(0,Math.min(7,t))],
      tip:t>=6?'#c92239':t>=4?'#b63c50':'#a85365'}
    : {metal:t>=5?'#e8cc80':'#bea46b',dark:'#3d5342',gem:'#51cfac',light:'#efffdc',leaf:'#449582',tip:'#c9f3b1'};
  function pointSegment(x,y,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-ax-dx*t,y-ay-dy*t);
  }
  R.prepare=function(f,images,meta){
    for(const atk of [false,true]){
      const key=`arc-${atk?'attack':'walk'}-${f}`;if(poses.has(key))continue;
      const src=images[`archer-${f}${atk?'-attack':''}`],m=(atk?meta.attack:meta.walk)[f];
      if(!src||!m)continue;
      const c=mk(src.width,src.height),g=c.getContext('2d');g.drawImage(src,0,0);
      const pixels=g.getImageData(0,0,c.width,c.height).data,frames=[];
      for(let row=0;row<m.framesPerDir;row++)for(let col=0;col<8;col++){
        const a=ArcherGear.anchor(f,atk,row,col),[cx,neck]=a.body,idle=!atk&&row===3;
        const headH=idle?58:77,top=Math.max(4,neck-headH),indices=[],depths=[];
        const faceR=idle?13:19,back=col>=3&&col<=5;
        // Find the largest skin island above the collar. A drawn hand is much
        // smaller than the face; bow tips and shot streaks cannot move the crown.
        const skin=new Set();
        if(!back)for(let y=Math.max(0,neck-48);y<neck-5;y++)for(let x=Math.max(0,cx-40);x<Math.min(m.frameWidth,cx+40);x++){
          const i=((row*m.frameHeight+y)*c.width+col*m.frameWidth+x)*4;
          const r=pixels[i],gg=pixels[i+1],b=pixels[i+2];
          if(pixels[i+3]>180&&r>205&&gg>155&&b>125&&r>gg*1.025&&r>b*1.025)skin.add(y*m.frameWidth+x);
        }
        let facePoints=[];
        while(skin.size){
          const first=skin.values().next().value,queue=[first];skin.delete(first);
          for(let n=0;n<queue.length;n++){
            const p=queue[n],xx=p%m.frameWidth,yy=Math.floor(p/m.frameWidth);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
              if(xx+dx<0||xx+dx>=m.frameWidth)continue;
              const k=(yy+dy)*m.frameWidth+xx+dx;
              if(skin.delete(k))queue.push(k);
            }
          }
          if(queue.length>facePoints.length)facePoints=queue;
        }
        const faceX=facePoints.length>15?facePoints.reduce((s,p)=>s+p%m.frameWidth,0)/facePoints.length:cx;
        const faceTop=facePoints.length>15?Math.min(...facePoints.map(p=>Math.floor(p/m.frameWidth))):null;
        const crownY=faceTop===null?top+13+(atk&&row===2?12:0):faceTop-16;
        const candidates=new Set();
        // Ponytails and the top knot extend above the brow anchor.
        for(let y=Math.max(0,Math.floor(top)-24);y<Math.min(m.frameHeight,neck+12);y++)for(let x=0;x<m.frameWidth;x++){
          const p=(row*m.frameHeight+y)*c.width+col*m.frameWidth+x,i=p*4;
          if(pixels[i+3]<80||Math.abs(x-cx)>(idle?67:102))continue;
          if(y>=neck-5&&Math.abs(x-cx)<a.body[4]+10)continue;
          const [r,gg,b]=[pixels[i],pixels[i+1],pixels[i+2]];
          const face=!back && ((x-faceX)/faceR)**2+((y-neck+22)/(idle?14:19))**2<1;
          if(face&&(y>neck-24||(r>205&&gg>155&&b>125)))continue;
          const candidate=f==='dharma'?r>gg*1.05&&gg>b*1.05&&r-b>15&&b<200
            : r>gg*.92&&b>gg*.9&&Math.min(r,gg,b)<160&&(b>r*.62||r>gg*1.3);
          if(!candidate)continue;
          const bow=a.bow;
          if(bow&&Math.abs(x-cx)>faceR+8&&Math.min(pointSegment(x,y,...bow.slice(0,4)),pointSegment(x,y,...bow.slice(2,6)))<9)continue;
          candidates.add(y*m.frameWidth+x);
        }
        // Only hair connected to the upper head survives. This excludes brown
        // leather cuffs / shoulder pieces next to the ends of the ponytail.
        const queue=[];
        for(const p of candidates)if(Math.floor(p/m.frameWidth)<neck-35){queue.push(p);candidates.delete(p);}
        for(let n=0;n<queue.length;n++){
          const p=queue[n],x=p%m.frameWidth,y=Math.floor(p/m.frameWidth);
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            if(x+dx<0||x+dx>=m.frameWidth)continue;
            const k=(y+dy)*m.frameWidth+x+dx;if(candidates.delete(k))queue.push(k);
          }
          indices.push((row*m.frameHeight+y)*c.width+col*m.frameWidth+x);
          depths.push(Math.max(0,Math.min(1,(y-top)/headH)));
        }
        const view=col===2||col===6?'side':back?'back':'front';
        frames.push({col,row,cx,top,neck,headH,idle,view,crownX:faceX,crownY,trail:col>0&&col<4?-1:col>4?1:0,
          indices:Int32Array.from(indices),depths:Float32Array.from(depths)});
      }
      poses.set(key,{m,frames,width:c.width,height:c.height});
    }
  };
  R.frame=function(key,row,col,tier=0){
    if(window.ArcherModel?.ready)return ArcherModel.frame(key,row,col,tier);
    const raw=poses.get(key)?.frames[row*8+col];if(!raw)return raw;
    if(raw.display)return raw.display;
    const [cx,neck]=ArcherPose.point(key,row,col,raw.cx,raw.neck);
    const [,top]=ArcherPose.point(key,row,col,raw.cx,raw.top);
    const [crownX,crownY]=ArcherPose.point(key,row,col,raw.crownX,raw.crownY);
    return raw.display={...raw,cx,neck,top,crownX,crownY,
      headScale:ArcherPose.headScale(key,row,col),headH:neck-top};
  };
  function leaf(g,x,y,w,h,P,rot=0){
    g.save();g.translate(x,y);g.rotate(rot);
    const gr=g.createLinearGradient(-w,0,w,h);gr.addColorStop(0,P.dark);gr.addColorStop(.5,P.leaf);gr.addColorStop(1,P.tip);
    g.fillStyle=gr;g.strokeStyle=P.metal;g.lineWidth=1;
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(-w,h*.45,0,h);g.quadraticCurveTo(w,h*.45,0,0);g.fill();g.stroke();
    g.beginPath();g.moveTo(0,1);g.lineTo(0,h-2);g.stroke();g.restore();
  }
  function gem(g,x,y,r,P){
    g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r*.65,y);g.lineTo(x,y+r);g.lineTo(x-r*.65,y);g.closePath();
    g.fillStyle=P.gem;g.fill();g.strokeStyle=P.metal;g.lineWidth=1.1;g.stroke();
    g.strokeStyle=P.light;g.beginPath();g.moveTo(x,y-r*.7);g.lineTo(x-r*.3,y);g.stroke();
  }
  function braid(g,x,y,len,P,side,width=3){
    g.lineCap='round';g.strokeStyle=P.dark;g.lineWidth=width+2;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+side*7,y+len*.4,x+side*4,y+len);g.stroke();
    for(let n=0;n<len;n+=3){
      const u=n/len,xx=x+side*(Math.sin(u*Math.PI)*4+u*4);
      g.strokeStyle=n%6===0?P.tip:P.metal;g.lineWidth=width;
      g.beginPath();g.moveTo(xx-1.5,y+n);g.lineTo(xx+1.5,y+n+2);g.stroke();
    }
    gem(g,x+side*4,y+len+3,3,P);
  }
  R.compose=function(src,f,key,tier){
    const data=poses.get(key);if(!data||!tier)return src;
    const P=R.palette(f,tier),pal=HAIR[f][tier],low=rgb(pal[0]),high=rgb(pal[1]);
    const c=mk(src.width,src.height),g=c.getContext('2d');g.drawImage(src,0,0);
    const id=g.getImageData(0,0,c.width,c.height),d=id.data;
    for(const F of data.frames)for(let n=0;n<F.indices.length;n++){
      const i=F.indices[n]*4,lum=(d[i]*.25+d[i+1]*.55+d[i+2]*.2)/255;
      if(lum<.1)continue; // original dark contour remains crisp
      let target=blend(low,high,Math.min(1,Math.pow(lum,.75)*1.35));
      if(tier>=4)target=blend(target,rgb(P.tip),Math.pow(F.depths[n],3)*.22);
      for(let j=0;j<3;j++)d[i+j]=target[j];
    }
    g.putImageData(id,0,0);
    for(const F of data.frames){
      g.save();g.beginPath();g.rect(F.col*data.m.frameWidth,F.row*data.m.frameHeight,data.m.frameWidth,data.m.frameHeight);g.clip();
      g.translate(F.col*data.m.frameWidth,F.row*data.m.frameHeight);
      const r=F.idle?15:22;
      // Graduates from a woven circlet to side braids and long, jewelled royal locks.
      if(tier>=2)for(const side of [-1,1]){
        if(F.view==='side'&&side!==F.trail)continue;
        braid(g,F.crownX+side*r,F.neck-34,12+tier*2,P,side,tier>=5?3:2);
      }
      if(tier>=5&&F.view==='back'){
        for(const side of [-1,1])braid(g,F.cx+side*9,F.neck-12,16+(tier-5)*7,P,side,4);
      }
      // The crown itself is drawn live, so its points can extend beyond a cell.
      g.restore();
    }
    return c;
  };
  function at(e,F){
    return R.frame(ModelTiers.key(e.faction,F.atk,'archer'),F.frame,C.DIR_COL[F.dir],ModelTiers.tierOf(e.lvl||1));
  }
  R.drawHead=function(g,e,F,x,y,t,s,meta){
    const tier=ModelTiers.tierOf(e.lvl||1),fr=at(e,F);
    if(e.dead||!tier||!fr)return;
    const P=R.palette(e.faction,tier),w=(fr.idle?17:23)*fr.headScale*(fr.view==='side'?.62:1),cy=fr.crownY;
    g.save();g.translate(x+(fr.crownX-meta.anchorX)*s,y+(cy-meta.anchorY)*s);g.scale(s,s);
    // An open diadem with leaf prongs, never a floating sun ring or demon horns.
    g.strokeStyle=P.dark;g.lineWidth=4;g.beginPath();g.moveTo(-w,3);g.quadraticCurveTo(0,12,w,3);g.stroke();
    g.strokeStyle=P.metal;g.lineWidth=2;g.stroke();
    const count=tier<3?1:tier<5?2:3;
    for(const side of [-1,1])for(let n=0;n<count;n++)
      leaf(g,side*(w*.35+n*w*.22),7-n*2,2.7+tier*.3,-7-tier-(count-n)*1.5,P,side*(.3+n*.15));
    gem(g,0,5,tier>=5?5:3,P);
    if(tier>=4){
      g.strokeStyle=P.metal;g.lineWidth=1;
      g.beginPath();g.moveTo(-w,4);g.quadraticCurveTo(0,27,w,4);g.stroke();gem(g,0,16,2.5,P);
    }
    if(tier>=6){
      // Crescent and star mark the queen stages; sparse glints stay above the face.
      g.strokeStyle=P.light;g.lineWidth=1.5;g.beginPath();g.arc(0,-5,8,Math.PI*.12,Math.PI*.88);g.stroke();
      gem(g,0,-10,tier===7?5:3.5,P);
      for(const side of [-1,1]){g.globalAlpha=.55+.2*Math.sin(t*2+side);gem(g,side*(w+7),-4,2,P);}
    }
    g.restore();
  };
  R.drawAura=function(g,e,F,x,y,t,s,meta){
    const tier=ModelTiers.tierOf(e.lvl||1),fr=at(e,F);
    if(e.dead||tier!==3||!fr)return; // spirit-bow stages own their coordinated outer ornaments
    const P=R.palette(e.faction,tier),height=(meta.anchorY-fr.top)*s;
    g.save();g.translate(x,y);
    // Leaves / dark crystal petals frame the silhouette without painting over it.
    const count=tier>=7?8:tier>=5?6:4;
    for(let n=0;n<count;n++){
      const side=n%2?1:-1,phase=t*.55+n*2.4;
      const xx=side*(22+tier*2+Math.sin(phase)*4),yy=-height*(.18+(n/count)*.65)+Math.cos(phase)*3;
      g.globalAlpha=.45+.12*Math.sin(phase);leaf(g,xx,yy,1.8,5,P,side*.65+Math.sin(phase)*.2);
    }
    if(tier>=6){
      const yy=-height*.45;
      g.globalAlpha=.22;g.strokeStyle=P.metal;g.lineWidth=.8;
      for(const side of [-1,1]){
        g.beginPath();g.moveTo(side*26,yy+15);g.quadraticCurveTo(side*42,yy-15,side*30,yy-36);g.stroke();
      }
    }
    g.restore();
  };
  R.ground=function(g,e,t){
    if(e.dead||(e.wt||0)<3)return;
    const tier=ModelTiers.tierOf(e.lvl||1),P=R.palette(e.faction,tier),r=26+(e.wt||0)*1.5;
    g.save();g.translate(e.x,e.y);g.scale(1,.35);g.globalAlpha=.28+.05*Math.sin(t*1.7);
    g.strokeStyle=P.metal;g.lineWidth=1.4;
    for(const side of [-1,1]){
      g.beginPath();g.arc(0,0,r,side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45);g.stroke();
      for(let n=0;n<5;n++){
        const a=side<0?Math.PI*.65+n*.17:Math.PI*-.35+n*.17;
        leaf(g,Math.cos(a)*r,Math.sin(a)*r,3,9,P,a-Math.PI/2);
      }
    }
    gem(g,0,r*.8,4,P);g.restore();
  };
})();
