// Spear arts: shared combo beats; server-confirmed impacts own the actual area footprint.
// Every skill has its own choreography (charge -> strike -> aftermath) and motif; nothing here is shared
// between skills except the drawing helpers. Detail grows every ten levels (C.stageOf), never the reach.
// Draw callbacks are pure (deterministic seeds, no timers); particles / shake / flash are 'cue' nodes run by FX.update.
(function(){
  const S=window.SpearmanFX={},TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>1-Math.pow(1-clamp(v),3),easeIn=v=>Math.pow(clamp(v),3);
  const seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const ent=id=>window.G?.ents.get(id);
  S.power=lvl=>{const stage=C.stageOf(lvl);return {stage,scale:1+stage*.085,orbits:1+Math.floor(stage/4),detail:3+Math.floor(stage/2),
    dragon:stage>=6,crown:stage>=10,divine:stage>=13};};

  // ------------------------------------------------------------ drawing helpers
  const line=(g,pts,col,w=1)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=col;g.lineWidth=Math.max(.3,w);g.stroke();};
  const shape=(g,pts,col)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=col;g.fill();};
  const ring=(g,x,y,R,col,w,flat=.42)=>{if(R<=0)return;g.beginPath();g.ellipse(x,y,R,R*flat,0,0,TAU);g.strokeStyle=col;g.lineWidth=Math.max(.4,w);g.stroke();};
  function glow(g,x,y,r,col,core,alpha=1){
    if(r<=0||alpha<=0)return;const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,core+'c0');gr.addColorStop(.3,col+'70');gr.addColorStop(1,col+'00');
    g.save();g.globalAlpha*=alpha;g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.restore();
  }
  // a spear with its tip at (x, y) pointing along a: leaf blade, guard, tassel, shaft
  function lance(g,x,y,a,len,P,w=1){
    g.save();g.translate(x,y);g.rotate(a);
    line(g,[[-len*1.1,0],[-len*.3,0]],P.deep,3.2*w);line(g,[[-len*1.1,0],[-len*.3,0]],P.accent,1.5*w);
    shape(g,[[0,0],[-len*.17,-5*w],[-len*.33,-2*w],[-len*.29,0],[-len*.33,2*w],[-len*.17,5*w]],P.core);
    line(g,[[0,0],[-len*.17,-5*w],[-len*.33,-2*w]],P.main,.9*w);line(g,[[0,0],[-len*.17,5*w],[-len*.33,2*w]],P.main,.9*w);
    line(g,[[-len*.34,-6*w],[-len*.34,6*w]],P.accent,1.6*w);
    shape(g,[[-len*.36,0],[-len*.46,-4*w],[-len*.6,-1.2*w],[-len*.52,0],[-len*.6,1.2*w],[-len*.46,4*w]],P.main);
    g.restore();
  }
  // fading motion trail from (x0, y0) to the moving head at (x1, y1)
  function streak(g,x0,y0,x1,y1,w,col,core){
    if(Math.hypot(x1-x0,y1-y0)<1)return;
    g.save();g.globalCompositeOperation='lighter';
    const a=g.createLinearGradient(x0,y0,x1,y1);a.addColorStop(0,col+'00');a.addColorStop(1,col+'e0');line(g,[[x0,y0],[x1,y1]],a,w);
    const b=g.createLinearGradient(x0,y0,x1,y1);b.addColorStop(.4,core+'00');b.addColorStop(1,core);line(g,[[x0,y0],[x1,y1]],b,w*.3);
    g.restore();
  }
  function cone(g,x0,y0,x1,y1,w,col){
    if(w<=.3||Math.hypot(x1-x0,y1-y0)<1)return;const a=Math.atan2(y1-y0,x1-x0),nx=-Math.sin(a),ny=Math.cos(a);
    const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,col+'00');gr.addColorStop(1,col+'b0');
    shape(g,[[x0+nx*w,y0+ny*w],[x1,y1],[x0-nx*w,y0-ny*w]],gr);
  }
  // drill helix narrowing toward the tip
  function helix(g,x0,y0,a,L,amp,turns,phase,col,w){
    const c=Math.cos(a),s=Math.sin(a),pts=[];
    for(let i=0;i<=30;i++){const u=i/30,o=Math.sin(u*TAU*turns-phase)*amp*(1-u*.8);pts.push([x0+c*u*L-s*o,y0+s*u*L+c*o]);}
    line(g,pts,col,w);
  }
  function star(g,x,y,R,P,rot=0){
    if(R<=0)return;g.save();g.translate(x,y);g.rotate(rot);g.globalCompositeOperation='lighter';
    const four=(r,c)=>{const k=r*.16;shape(g,[[r,0],[k,k],[0,r],[-k,k],[-r,0],[-k,-k],[0,-r],[k,-k]],c);};
    four(R,P.main);four(R*.6,P.core);g.rotate(Math.PI/4);four(R*.45,P.accent);g.restore();
  }
  // crescent cut centred on (x, y) along a, revealed left to right
  function slash(g,x,y,a,R,bend,th,col,reveal=1){
    if(reveal<=0||R<=0)return;g.save();g.translate(x,y);g.rotate(a);
    const B=Math.abs(bend)*2+th*2+4;g.beginPath();g.rect(-R-2,-B,2*R*reveal+2,B*2);g.clip();
    g.beginPath();g.moveTo(-R,0);g.quadraticCurveTo(0,-bend*2,R,0);g.quadraticCurveTo(0,-bend*2+th*2*Math.sign(bend||1),-R,0);g.closePath();
    g.fillStyle=col;g.fill();g.restore();
  }
  function ribbon(g,x,y,R,start,end,P,width,flat){
    width=Math.min(width,R*.9);g.save();g.translate(x,y);g.scale(1,flat);
    g.beginPath();g.arc(0,0,R,start,end);g.arc(0,0,R-width,end,start,true);g.closePath();
    const gr=g.createRadialGradient(0,0,R-width,0,0,R);gr.addColorStop(0,P.main+'00');gr.addColorStop(.65,P.main+'bb');gr.addColorStop(1,P.core);
    g.fillStyle=gr;g.fill();g.restore();
  }
  // jagged radial cracks on the ground (flattened), revealed outward
  function cracks(g,x,y,R,n,col,w,salt,reveal=1){
    for(let i=0;i<n;i++){
      const b=i*TAU/n+seed(salt+i)*.6,pts=[[x,y]];
      for(let j=1;j<=4;j++){const rr=R*j/4*(.7+seed(salt+i*7+j)*.5),bb=b+(seed(salt+i*13+j)-.5)*.7;pts.push([x+Math.cos(bb)*rr,y+Math.sin(bb)*rr*.42]);}
      line(g,pts.slice(0,1+Math.max(1,Math.round(4*clamp(reveal)))),col,w*(i%2?.6:1));
    }
  }
  // stone chunks thrown up and falling back
  function rocks(g,x,y,R,n,cols,p,salt,H){
    for(let i=0;i<n;i++){
      const b=seed(salt+i)*TAU,v=R*(.5+seed(salt+i+31)*.9),h=H*(.5+seed(salt+i+57)),sz=2+seed(salt+i+77)*4;
      g.save();g.translate(x+Math.cos(b)*v*p,y+Math.sin(b)*v*.45*p-h*4*p*(1-p));g.rotate(p*(seed(i)-.5)*14);
      shape(g,[[-sz,-sz*.4],[-sz*.2,-sz],[sz,-sz*.3],[sz*.6,sz*.7],[-sz*.6,sz*.6]],cols[i%cols.length]);g.restore();
    }
  }
  function dust(g,x,y,R,p,col){
    g.save();g.globalAlpha*=.35*(1-p);
    for(let i=0;i<6;i++){const b=i*TAU/6+.4;g.beginPath();g.arc(x+Math.cos(b)*R*.8,y+Math.sin(b)*R*.32-p*6,R*.32,0,TAU);g.fillStyle=col;g.fill();}
    g.restore();
  }
  const hexPath=(g,x,y,R,rot=0)=>{g.beginPath();for(let i=0;i<6;i++){const b=rot+i*TAU/6+Math.PI/6;i?g.lineTo(x+Math.cos(b)*R,y+Math.sin(b)*R):g.moveTo(x+Math.cos(b)*R,y+Math.sin(b)*R);}g.closePath();};
  // honeycomb guard on the victim: appears, cracks, then shatters into flying plates
  function hexShield(g,x,y,R,P,p,W){
    const crack=clamp((p-.06)/.2),shatter=clamp((p-.3)/.7);
    g.save();g.globalCompositeOperation='lighter';
    if(!shatter){
      hexPath(g,x,y,R);g.fillStyle=P.main+'30';g.fill();g.strokeStyle=P.accent;g.lineWidth=2.2;g.stroke();
      for(let i=0;i<6;i++){const b=i*TAU/6;hexPath(g,x+Math.cos(b)*R*.5,y+Math.sin(b)*R*.5,R*.27);g.strokeStyle=P.main+'90';g.lineWidth=1;g.stroke();}
      for(let i=0;i<5;i++){const b=i*1.27+.4;line(g,[[x,y],[x+Math.cos(b)*R*.45*crack+3,y+Math.sin(b)*R*.45*crack],[x+Math.cos(b+.25)*R*crack,y+Math.sin(b+.25)*R*crack]],P.core,1.3);}
    }else{
      const n=6+Math.floor(W.stage/2);
      for(let i=0;i<n;i++){
        const b=i*TAU/n+seed(i)*.4,d=R*(.3+shatter*(1.2+seed(i+5)));
        g.save();g.translate(x+Math.cos(b)*d,y+Math.sin(b)*d+shatter*shatter*20);g.rotate(shatter*(seed(i+9)-.5)*15);g.globalAlpha*=1-shatter;
        shape(g,[[0,-R*.25],[R*.2,-R*.05],[R*.12,R*.2],[-R*.15,R*.15]],i%2?P.accent:P.main);g.restore();
      }
    }g.restore();
  }
  function brokenShield(g,x,y,R,P,alpha){
    g.save();g.globalAlpha*=alpha;
    for(const side of [-1,1]){g.save();g.translate(side*R*.28,0);
      shape(g,[[x,y-R],[x+side*R*.9,y-R*.7],[x+side*R*.8,y+R*.3],[x,y+R*1.1],[x+side*R*.12,y+R*.25],[x-side*R*.1,y-R*.15]],side<0?P.main:P.accent);g.restore();}
    g.restore();
  }
  function chain(g,x0,y0,x1,y1,P,w,reveal=1){
    const L=Math.hypot(x1-x0,y1-y0),n=Math.max(2,Math.floor(L/(9*w)));if(L<2)return;
    g.save();g.translate(x0,y0);g.rotate(Math.atan2(y1-y0,x1-x0));
    for(let i=0;i<Math.ceil(n*clamp(reveal));i++){g.beginPath();g.ellipse((i+.5)*L/n,0,L/n*.62,(i%2?1.2:3.1)*w,0,0,TAU);g.strokeStyle=i%2?P.accent:P.main;g.lineWidth=1.3*w;g.stroke();}
    g.restore();
  }
  // rotating rune seal of spear marks
  function seal(g,x,y,R,P,W,phase,flat=.42){
    if(R<=0)return;g.save();g.translate(x,y);g.scale(1,flat);g.rotate(phase);
    ring(g,0,0,R,P.main,1.6,1);ring(g,0,0,R*.82,P.accent,1,1);
    const n=4+Math.floor(W.stage/2);
    for(let i=0;i<n;i++){g.save();g.rotate(i*TAU/n);line(g,[[R*.82,0],[R,0]],P.core,1.2);shape(g,[[R*.78,0],[R*.62,-3],[R*.66,0],[R*.62,3]],P.accent);g.restore();}
    if(W.stage>=4){const m=W.stage>=10?8:5,st=m===8?3:2;g.rotate(-phase*2);g.beginPath();
      for(let i=0;i<=m;i++){const b=i*st*TAU/m;i?g.lineTo(Math.cos(b)*R*.78,Math.sin(b)*R*.78):g.moveTo(Math.cos(b)*R*.78,Math.sin(b)*R*.78);}
      g.strokeStyle=P.main;g.lineWidth=1;g.stroke();}
    g.restore();
  }
  function pillar(g,x,y,top,W,P,alpha=1){
    if(W<=0||alpha<=0)return;g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=alpha;
    const gr=g.createLinearGradient(x-W,0,x+W,0);
    gr.addColorStop(0,P.main+'00');gr.addColorStop(.3,P.main+'90');gr.addColorStop(.5,P.core);gr.addColorStop(.7,P.main+'90');gr.addColorStop(1,P.main+'00');
    g.fillStyle=gr;g.fillRect(x-W,top,W*2,y-top);
    g.beginPath();g.ellipse(x,y,W*1.6,W*.55,0,0,TAU);g.fillStyle=P.core+'90';g.fill();g.restore();
  }
  // serpent dragon through pts (head first)
  function dragon(g,pts,P,w){
    if(pts.length<3)return;
    line(g,pts,P.deep,9*w);line(g,pts,P.main,5.5*w);line(g,pts,P.core,1.2*w);
    for(let i=3;i<pts.length-1;i+=3){const [x0,y0]=pts[i],[x1,y1]=pts[i+1],b=Math.atan2(y1-y0,x1-x0)+Math.PI/2;
      line(g,[[x0,y0],[x0+Math.cos(b)*7*w+(x1-x0)*.8,y0+Math.sin(b)*7*w+(y1-y0)*.8]],P.accent,1.2*w);}
    const [hx,hy]=pts[0],[nx,ny]=pts[1];
    g.save();g.translate(hx,hy);g.rotate(Math.atan2(hy-ny,hx-nx));g.scale(w,w);
    shape(g,[[16,0],[4,-8],[-12,-9],[-6,0],[-12,9],[4,8]],P.main);
    line(g,[[-4,-6],[-16,-18],[-2,-9]],P.accent,1.6);line(g,[[-4,6],[-16,18],[-2,9]],P.accent,1.6);
    line(g,[[12,2],[24,8],[30,4]],P.core,1);line(g,[[12,-2],[24,-8],[30,-4]],P.core,1);
    shape(g,[[16,0],[8,3],[2,1]],P.deep);g.beginPath();g.arc(5,-3,1.6,0,TAU);g.fillStyle=P.core;g.fill();g.restore();
  }
  const trail=(f,u,len,step)=>{const pts=[];for(let i=0;i<len;i++)pts.push(f(Math.max(0,u-i*step)));return pts;};
  function tiger(g,x,y,R,P,p){
    g.save();g.translate(x,y);
    g.beginPath();g.ellipse(0,0,R,R*.78,0,0,TAU);g.fillStyle=P.main+'28';g.fill();g.strokeStyle=P.accent+'a0';g.lineWidth=1.4;g.stroke();
    for(const s of [-1,1]){
      shape(g,[[s*R*.5,-R*.6],[s*R*.85,-R*1.05],[s*R*.95,-R*.45]],P.main+'80');
      g.save();g.translate(s*R*.36,-R*.08);g.rotate(s*.35);g.beginPath();g.ellipse(0,0,R*.2,R*.07+R*.03*Math.sin(p*20),0,0,TAU);g.fillStyle=P.core;g.fill();g.restore();
      for(let i=0;i<3;i++)line(g,[[s*R*(.98-i*.04),R*(-.1+i*.2)],[s*R*(.62-i*.04),R*(.02+i*.18)]],P.deep,2);
      shape(g,[[s*R*.12,R*.4],[s*R*.2,R*.72],[s*R*.28,R*.4]],P.core);
    }
    for(let i=0;i<3;i++)line(g,[[-R*.2,-R*(.62-i*.12)],[R*.2,-R*(.62-i*.12)]],P.deep,1.6);
    line(g,[[0,-R*.64],[0,-R*.38]],P.deep,1.6);g.restore();
  }
  function heartBreak(g,x,y,R,P,p,dark){
    const grow=ease(p*5),split=ease((p-.22)/.78);
    g.save();g.globalCompositeOperation='lighter';
    for(const s of [-1,1]){
      g.save();g.translate(x+s*split*R*.9,y+split*split*R*1.2);g.rotate(s*split*.6);g.scale(grow,grow);
      g.beginPath();g.moveTo(0,R*.95);g.bezierCurveTo(s*R*1.5,R*.1,s*R*.9,-R*.95,0,-R*.3);
      g.lineTo(s*R*.12,-R*.05);g.lineTo(-s*R*.08,R*.25);g.lineTo(s*R*.1,R*.55);g.closePath();
      g.fillStyle=(s<0||dark?P.main:P.accent)+'70';g.fill();g.strokeStyle=P.core;g.lineWidth=1.4;g.stroke();g.restore();
    }g.restore();
  }
  function droplets(g,x,y,R,n,cols,p,salt,tear){
    for(let i=0;i<n;i++){
      const b=-Math.PI/2+(seed(salt+i)-.5)*2.6,v=R*(.5+seed(salt+i+3)),sz=(1.5+seed(salt+i+7)*2.2)*(1-p*.4);
      g.beginPath();g.ellipse(x+Math.cos(b)*v*p,y+Math.sin(b)*v*p+R*1.4*p*p,sz*(tear?.75:1),sz*(tear?1.4:1),0,0,TAU);g.fillStyle=cols[i%cols.length];g.fill();
    }
  }
  function huntMark(g,x,y,R,P,p){
    g.save();g.globalAlpha*=Math.min(1,p*6);g.translate(x,y);g.rotate(p*1.4);g.globalCompositeOperation='lighter';
    ring(g,0,0,R,P.main,1.6,1);ring(g,0,0,R*.55,P.accent,1,1);
    for(let i=0;i<4;i++){g.save();g.rotate(i*TAU/4);shape(g,[[R*1.25,0],[R*.7,-R*.13],[R*.82,0],[R*.7,R*.13]],P.core);g.restore();}
    g.restore();
  }

  // bound simultaneous skill nodes in crowded fights (art and cues alike)
  function push(node){
    if(FX.list.filter(e=>e.skillArt).length>=180){const i=FX.list.findIndex(e=>e.skillArt);if(i>=0)FX.list.splice(i,1);}
    FX.list.push(node);
  }
  function add(d,power,delay,dur,layer,draw){
    push({skillArt:true,skill:d.t,owner:d.id,cls:'spearman',tier:power.stage,t0:performance.now()+Math.max(0,delay),dur,layer,
      draw(g,p){g.save();g.lineCap='round';g.lineJoin='round';g.globalAlpha*=Math.min(1,p*14,(1-p)*6);draw(g,p);g.restore();}});
  }

  // ------------------------------------------------------------ the nine arts
  const ART={
    // 1 ทวนทะลวง: wind-drill thrust, sonic rings along the line, star flare on the tip
    1(c){
      const {x,y,tx,ty,tfy,a,L,wind,P,W,s}=c,cs=Math.cos(a),sn=Math.sin(a);
      c.add(0,wind+40,'top',(g,p)=>{
        const gx=x+cs*18,gy=y+sn*18,q=1-p;g.globalCompositeOperation='lighter';
        for(let i=0;i<2+W.orbits;i++){const b=i*TAU/(2+W.orbits)+p*8,rr=(10+W.stage*1.5)*q*s;
          g.beginPath();g.ellipse(gx,gy,rr+1,(rr+1)*.5,a,b,b+1.6);g.strokeStyle=i%2?P.accent:P.main;g.lineWidth=1.4;g.stroke();}
        glow(g,gx,gy,10*s*(.4+p),P.main,P.core,p);
      });
      c.each(at=>{
        c.add(at-70,300,'top',(g,p)=>{
          const q=ease(p*2.6),ex=x+(tx-x)*q,ey=y+(ty-y)*q;g.globalCompositeOperation='lighter';
          cone(g,x,y,ex,ey,9*s*(1-p),P.main);
          for(let j=0;j<=W.orbits;j++)helix(g,x,y,a,L*q,(5+j*3)*s,2+j*.5,p*16+j*Math.PI,j%2?P.accent:P.core,j?1.2:1.8);
          lance(g,ex,ey,a,40*s,P,.9*s);
        });
        c.add(at-30,380,'top',(g,p)=>{
          g.globalCompositeOperation='lighter';
          (W.stage>=6?[.3,.55,.8]:[.4,.75]).forEach((m,i)=>{
            const R=(6+p*16)*s*(1-i*.12);g.beginPath();g.ellipse(x+(tx-x)*m,y+(ty-y)*m,R*.32,R,a,0,TAU);
            g.strokeStyle=i%2?P.accent:P.main;g.lineWidth=2*(1-p)+.5;g.stroke();});
        });
        c.add(at,360,'top',(g,p)=>{glow(g,tx,ty,(22+W.stage*1.5)*s*(1-p*.5),P.main,P.core,1-p);star(g,tx,ty,(13+W.stage)*s*(1-p*.5),P,p*1.5);});
        c.add(at,420,'ground',(g,p)=>{g.globalAlpha*=1-p;ring(g,tx,tfy,(10+p*26)*s,P.main,2.5*(1-p)+.5);});
        c.burst(at,tx,ty,6+W.stage,[P.core,P.main,P.accent],{angle:a,spread:1.2,speed:220,life:380,size:2,spark:true});
        c.shake(at,2);
      });
    },
    // 2 ทวนบดศิลา: leap with an overhead wheel of the spear, slam, cracked earth and flying rock
    2(c){
      const {fx,fy,tx,ty,tfy,a,wind,P,W,s}=c,earth=['#8a7a66','#5b4f44','#b9a58a'];
      c.add(0,wind,'top',(g,p)=>{
        const lift=38*Math.sin(p*Math.PI),cx=fx+Math.cos(a)*16*p,cy=fy-48-lift,R=(30+W.stage*1.4)*s,ph=-Math.PI/2+p*Math.PI*2.4;
        g.globalCompositeOperation='lighter';
        g.save();g.translate(cx,cy);g.scale(1,.8);g.beginPath();g.arc(0,0,R,ph-1.9,ph);g.arc(0,0,R-8*s,ph,ph-1.9,true);g.closePath();
        const gr=g.createRadialGradient(0,0,R-8*s,0,0,R);gr.addColorStop(0,P.main+'00');gr.addColorStop(1,P.core);g.fillStyle=gr;g.fill();g.restore();
        lance(g,cx+Math.cos(ph)*R,cy+Math.sin(ph)*R*.8,ph+Math.PI/2,40*s,P,.8*s);
      });
      c.add(0,340,'ground',(g,p)=>dust(g,fx,fy,(14+p*30)*s,p,earth[2]));
      c.each((at,h)=>{
        c.add(at-90,200,'top',(g,p)=>{const ly=ty-150*s*(1-easeIn(p*1.8));streak(g,tx,ly-70*s,tx,ly,10*s,P.main,P.core);lance(g,tx,ly+10*s,Math.PI/2,70*s,P,1.4*s);});
        c.add(at,900,'ground',(g,p)=>{
          const R=(34+W.stage*2.2)*s,n=5+Math.floor(W.stage/2),rv=ease(p*4);g.globalAlpha*=Math.min(1,(1-p)*2.5);
          cracks(g,tx,tfy,R,n,P.deep,3*s,13+h,rv);g.globalCompositeOperation='lighter';cracks(g,tx,tfy,R,n,P.main,1.2*s,13+h,rv);
        });
        c.add(at,600,'ground',(g,p)=>{g.globalAlpha*=1-p;ring(g,tx,tfy,(18+ease(p)*60)*s,P.core,4*(1-p)+.5);ring(g,tx,tfy,(10+ease(p)*40)*s,earth[2],6*(1-p)+.5);dust(g,tx,tfy,(20+p*40)*s,p,earth[0]);});
        c.add(at,800,'top',(g,p)=>rocks(g,tx,tfy-4,(40+W.stage*3)*s,5+W.stage,[...earth,P.accent],p,41+h,(30+W.stage*2)*s));
        c.add(at,260,'top',(g,p)=>glow(g,tx,ty,40*s,P.main,P.core,1-p));
        c.burst(at,tx,tfy,10+W.stage*2,earth,{speed:200,up:120,life:700,size:3,grav:500});
        c.shake(at,6+W.stage*.3);
      });
    },
    // 3 ทวนสามประสาน: phantom lancers strike from alternating sides, scars stack, a final triangle seal
    3(c){
      const {tx,ty,a,wind,gap,n,P,W,s,e}=c,R=72*s,base=a+Math.PI,total=wind+(n-1)*gap+300;
      const dirOf=h=>h===n-1?base:base+(h%2?.85:-.85)*(h>1?.7:1);
      const origin=h=>{const b=dirOf(h);return [tx+Math.cos(b)*R,ty+Math.sin(b)*R*.7];};
      c.add(0,total,'top',(g,p)=>{
        const el=p*total;let done=0;
        for(let h=0;h<n;h++){const at=wind+h*gap,vis=clamp((el-(at-180))/120)*(1-clamp((el-at)/120));if(el>=at)done++;
          if(vis>0){const [ox,oy]=origin(h);g.save();g.globalAlpha*=vis;star(g,ox,oy,8*s,P,el/200);g.restore();}}
        for(let h=0;h<n;h++){const px=tx+(h-(n-1)/2)*10*s,py=ty-44*s;shape(g,[[px,py-4*s],[px+3*s,py],[px,py+4*s],[px-3*s,py]],h<done?P.core:P.deep);}
      });
      c.each((at,h)=>{
        const [ox,oy]=origin(h),b=Math.atan2(ty-oy,tx-ox),last=h===n-1;
        c.add(at-130,260,'top',(g,p)=>{
          if(window.drawGhost&&e){const q=ease(p*1.6);drawGhost(e,ox+(tx-ox)*q*.35,oy+(ty-oy)*q*.35+22,.28*(1-p),P.main,g,'lighter');}
          const q=ease((p-.25)*2.2),hx=ox+(tx-ox)*q,hy=oy+(ty-oy)*q;streak(g,ox,oy,hx,hy,6*s,P.main,P.core);lance(g,hx,hy,b,36*s,P,.8*s);
        });
        c.add(at,(n-1-h)*gap+500,'top',(g,p)=>{
          const R2=(16+W.stage)*s*(last?1.5:1);g.globalCompositeOperation='lighter';
          slash(g,tx,ty,b+Math.PI/2+.5,R2,5*s,2.5*s,P.main,ease(p*8));slash(g,tx,ty,b+Math.PI/2-.5,R2,-5*s,2*s,P.accent,ease(p*8-.5));
        });
        c.add(at,300,'top',(g,p)=>glow(g,tx,ty,(18+W.stage)*s*(last?1.6:1),P.main,P.core,1-p));
        if(last)c.add(at,520,'top',(g,p)=>{
          const pts=[0,1,2].map(i=>origin(Math.max(0,n-3+i))).map(([px,py])=>[px+(tx-px)*ease(p),py+(ty-py)*ease(p)]);
          g.globalCompositeOperation='lighter';line(g,[...pts,pts[0]],P.core,2.4*(1-p)+.5);star(g,tx,ty,(24+W.stage)*s*(1-p*.5),P,p*2);
        });
        c.burst(at,tx,ty,5+W.stage,[P.core,P.main],{angle:b,spread:1,speed:200,life:300,size:2,spark:true});
        c.shake(at,last?5:2);
      });
    },
    // 4 ทวนเจาะเกราะ: spinning drill vortex, a honeycomb guard on the victim cracks and shatters
    4(c){
      const {x,y,tx,ty,a,L,wind,P,W,s}=c,cs=Math.cos(a),sn=Math.sin(a);
      c.add(0,wind+60,'top',(g,p)=>{
        g.globalCompositeOperation='lighter';const rings=3+Math.floor(W.stage/3);
        for(let i=0;i<rings;i++){const u=(i/rings+p*1.5)%1,d=14+u*40*s,R=(14-u*10)*s;
          g.save();g.translate(x+cs*d,y+sn*d);g.rotate(a);g.beginPath();g.ellipse(0,0,R*.3,R,0,p*20+i,p*20+i+4.2);
          g.strokeStyle=i%2?P.accent:P.main;g.lineWidth=1.6;g.stroke();g.restore();}
        glow(g,x+cs*20,y+sn*20,14*s*p,P.main,P.core,p);
      });
      c.each(at=>{
        c.add(at-60,260,'top',(g,p)=>{
          const q=ease(p*2.4),ex=x+(tx-x)*q,ey=y+(ty-y)*q;g.globalCompositeOperation='lighter';streak(g,x,y,ex,ey,7*s,P.main,P.core);
          for(let j=0;j<2;j++)helix(g,x,y,a,L*q,4*s,3,p*20+j*Math.PI,P.accent,1);lance(g,ex,ey,a,42*s,P,s);
        });
        c.add(at-40,760,'top',(g,p)=>hexShield(g,tx,ty,(22+W.stage*1.2)*s,P,p,W));
        c.add(at,320,'top',(g,p)=>{
          g.globalCompositeOperation='lighter';
          for(let i=0;i<5+W.stage/2;i++){const b=a+(seed(i+3)-.5)*.9,rr=(10+ease(p)*(30+seed(i)*30))*s;
            line(g,[[tx+Math.cos(b)*rr*.4,ty+Math.sin(b)*rr*.4],[tx+Math.cos(b)*rr,ty+Math.sin(b)*rr]],i%2?P.accent:P.core,1.4*(1-p)+.3);}
        });
        c.add(at+80,800,'top',(g,p)=>brokenShield(g,tx,ty-40*s-p*20*s,9*s,P,1-p));
        c.burst(at,tx,ty,8+W.stage,[P.accent,P.core,'#ffffff'],{speed:260,life:450,size:2.4,spark:true});
        c.shake(at,4);
      });
    },
    // 5 ทวนปลิดชีพ: verdict seal and closing brackets, a giant spear falls from the sky, pillar and cut
    5(c){
      const {fx,fy,tx,ty,tfy,wind,P,W,s,mine}=c,R=(30+W.stage*2)*s;
      c.add(0,wind+500,'top',(g,p)=>{
        const el=p*(wind+500),q=clamp(el/wind),out=clamp((el-wind)/500);
        const V=R*2.2,gr=g.createRadialGradient(tx,ty,R*.4,tx,ty,V);gr.addColorStop(0,P.deep+'00');gr.addColorStop(.55,P.deep+'90');gr.addColorStop(1,P.deep+'00');
        g.save();g.globalAlpha*=q*(1-out)*.6;g.fillStyle=gr;g.beginPath();g.arc(tx,ty,V,0,TAU);g.fill();g.restore();
        const B=R*(2.2-1.5*ease(q));g.save();g.globalAlpha*=1-out;
        for(let i=0;i<4;i++){const b=i*TAU/4+Math.PI/4+q*.6;g.save();g.translate(tx+Math.cos(b)*B,ty+Math.sin(b)*B*.8);g.rotate(b+Math.PI*.75);line(g,[[-8*s,0],[0,0],[0,8*s]],P.core,2);g.restore();}
        g.restore();
      });
      c.add(0,wind+120,'top',(g,p)=>{
        const el=p*(wind+120),q=ease(el/wind),sy=ty-90*s;
        g.save();g.globalAlpha*=q;seal(g,tx,sy,R*(.4+.6*q),P,W,el/400,.9);lance(g,tx,sy+R*.7,Math.PI/2,R*1.4,P,s);g.restore();
        g.globalCompositeOperation='lighter';
        for(let i=0;i<4+W.stage/2;i++){const u=(seed(i)+el/500)%1,ox=fx+(seed(i+7)-.5)*36*s;line(g,[[ox,fy-u*70*s],[ox,fy-u*70*s-10*s]],i%2?P.main:P.accent,1.5*(1-u)+.3);}
      });
      c.each(at=>{
        c.add(at-90,180,'top',(g,p)=>{const ly=ty-260*s*(1-easeIn(p*1.6));streak(g,tx,ly-120*s,tx,ly,14*s,P.main,P.core);lance(g,tx,ly,Math.PI/2,100*s,P,1.8*s);});
        c.add(at,560,'top',(g,p)=>pillar(g,tx,tfy,ty-220*s,(16+W.stage)*s*(1-p*.6),P,1-p));
        c.add(at+40,360,'top',(g,p)=>{const w=R*1.3*ease(p*3);g.globalCompositeOperation='lighter';g.globalAlpha*=1-p;
          line(g,[[tx-w,ty-6],[tx+w,ty+6]],P.main,6*s*(1-p)+1);line(g,[[tx-w,ty-6],[tx+w,ty+6]],P.core,2*s*(1-p)+.5);});
        c.add(at,900,'ground',(g,p)=>{g.globalAlpha*=Math.min(1,(1-p)*2);seal(g,tx,tfy,R*1.2*ease(p*3),P,W,p,.42);cracks(g,tx,tfy,R*1.4,6,P.deep,2.5,71,ease(p*5));});
        c.burst(at,tx,ty,14+W.stage*2,[P.core,P.main,P.accent],{speed:320,up:40,life:600,size:3,spark:true});
        c.shake(at,10);if(mine)c.later(at,()=>FX.flash(P.main,260,.18));
      });
    },
    // 6 ทวนสะบั้นหัวใจ: a 1.5-turn whirl around the lancer, an X cut, the heart splits (light petals / blood)
    6(c){
      const {fx,fy,tx,ty,tfy,a,wind,P,W,s,dark}=c,R=(36+W.stage*1.6)*s;
      c.add(0,wind+80,'top',(g,p)=>{
        const ph=a-Math.PI+p*TAU*1.5,cy=fy-26-10*Math.sin(p*Math.PI);g.globalCompositeOperation='lighter';
        ribbon(g,fx,cy,R,ph-2.2,ph,P,10*s*(.5+p*.5),.55);lance(g,fx+Math.cos(ph)*R,cy+Math.sin(ph)*R*.55,ph+Math.PI/2,40*s,P,.8*s);
        for(let i=0;i<3+W.stage/2;i++){const b=ph-i*.5,rr=R*(1+i*.1);g.save();g.translate(fx+Math.cos(b)*rr,cy+Math.sin(b)*rr*.55);g.rotate(b);
          g.beginPath();g.ellipse(0,0,3*s,1.4*s,0,0,TAU);g.fillStyle=dark?P.main:P.core;g.fill();g.restore();}
      });
      c.each((at,h)=>{
        c.add(at-40,360,'top',(g,p)=>{
          const r2=(26+W.stage*1.2)*s;g.globalCompositeOperation='lighter';
          slash(g,tx,ty,a+Math.PI/2+.7,r2,9*s,4*s,P.main,ease(p*4));slash(g,tx,ty,a+Math.PI/2-.7,r2,-9*s,4*s,dark?P.main:P.accent,ease(p*4-.4));
          glow(g,tx,ty,r2*1.2,P.main,P.core,1-p);
        });
        c.add(at+60,700,'top',(g,p)=>heartBreak(g,tx,ty-6*s,(14+W.stage*.8)*s,P,p,dark));
        c.add(at,800,'top',(g,p)=>droplets(g,tx,ty,(30+W.stage*2)*s,6+W.stage,dark?[P.main,P.deep,'#ff5a6a']:[P.core,P.main,P.accent],p,91+h,dark));
        c.add(at+100,1000,'ground',(g,p)=>{
          g.globalAlpha*=(1-p)*.7;
          for(let i=0;i<4+W.stage/3;i++){const b=seed(i+50)*TAU,rr=R*.8*seed(i+60);g.beginPath();g.ellipse(tx+Math.cos(b)*rr,tfy+Math.sin(b)*rr*.4,3*s,1.4*s,0,0,TAU);g.fillStyle=dark?P.deep:P.main;g.fill();}
        });
        c.burst(at,tx,ty,8+W.stage,dark?[P.main,'#ff4a5a',P.deep]:[P.core,P.main,P.accent],{speed:180,up:80,life:600,size:2.5,grav:300});
        c.shake(at,3);
      });
    },
    // 7 ทวนตรึงพยัคฆ์: tiger spirit over a crouch, three claw rakes, the spear pins and chains bind
    7(c){
      const {fx,fy,x,y,tx,ty,tfy,a,wind,P,W,s}=c,R=(40+W.stage*2)*s,ca=Math.PI*.3;
      c.add(0,wind+60,'top',(g,p)=>{
        const q=ease(p*1.4);g.globalCompositeOperation='lighter';
        g.save();g.globalAlpha*=q*.9;tiger(g,fx-Math.cos(a)*10,fy-62*s-q*8,(16+W.stage)*s,P,p);g.restore();
        for(let i=0;i<3;i++)slash(g,x+Math.cos(a)*16+(i-1)*5*s,y+(i-1)*4*s,a,12*s,3*s,1.5*s,i===1?P.core:P.main,ease(p*2-i*.2));
      });
      c.each(at=>{
        c.add(at-50,380,'top',(g,p)=>{
          g.globalCompositeOperation='lighter';
          for(let i=0;i<3;i++){const off=(i-1)*9*s;slash(g,tx+Math.cos(ca+Math.PI/2)*off,ty+Math.sin(ca+Math.PI/2)*off,ca,(20+W.stage)*s,4*s,2.6*s,i===1?P.core:P.main,ease((p-i*.08)*4));}
        });
        c.add(at-60,260,'top',(g,p)=>{const ly=ty-110*s*(1-easeIn(p*1.8));streak(g,tx,ly-50*s,tx,ly+18*s,8*s,P.main,P.core);lance(g,tx,ly+18*s,Math.PI/2,70*s,P,1.3*s);});
        c.add(at+80,900,'top',(g,p)=>{
          const k=3+Math.floor(W.stage/3);g.globalAlpha*=Math.min(1,(1-p)*3);
          for(let i=0;i<k;i++){const b=i*TAU/k+.3;chain(g,tx+Math.cos(b)*R,tfy+Math.sin(b)*R*.42,tx,ty+6*s,P,s*.8,ease(p*3));}
          lance(g,tx,tfy+2,Math.PI/2,70*s,P,1.3*s);
        });
        c.add(at,1000,'ground',(g,p)=>{
          g.globalAlpha*=Math.min(1,(1-p)*3);const rr=R*(1.2-.6*ease(p*1.5));ring(g,tx,tfy,rr,P.main,2);ring(g,tx,tfy,rr*.8,P.accent,1);
          for(let i=0;i<6;i++){const b=i*TAU/6+p;const px=tx+Math.cos(b)*rr*.9,py=tfy+Math.sin(b)*rr*.38;shape(g,[[px-4*s,py],[px,py-2*s],[px+4*s,py],[px,py+1.5*s]],P.deep);}
        });
        c.burst(at,tx,ty,8+W.stage,[P.core,P.accent,P.main],{speed:200,up:30,life:450,size:2.2,spark:true});
        c.shake(at,4);
      });
    },
    // 8 ทวนล่ามังกร: a dragon coils round the lancer, darts along the spear, coils the prey and roars
    8(c){
      const {fx,fy,x,y,tx,ty,tfy,a,wind,P,W,s}=c,w=(.8+W.stage*.05)*s,R0=46*s,ox=tx+Math.cos(a+Math.PI)*R0,oy=ty+Math.sin(a+Math.PI)*R0*.5;
      c.add(0,wind+80,'top',(g,p)=>{
        const f=u=>{const th=a+Math.PI+u*TAU*1.4;return [fx+Math.cos(th)*28*s,fy-20*s+Math.sin(th)*12*s-u*30*s];};
        g.globalCompositeOperation='lighter';dragon(g,trail(f,p,14+W.stage,.03),P,w*.8);glow(g,fx,fy-30*s,30*s,P.main,P.core,p*.5);
      });
      const chase=u=>{
        if(u<.15){const q=u/.15,o=Math.sin(q*TAU)*14*s;return [x+(ox-x)*q-Math.sin(a)*o,y+(oy-y)*q+Math.cos(a)*o];}
        const q=(u-.15)/.85,th=a+Math.PI+q*TAU*1.3,r=R0-18*s*q;return [tx+Math.cos(th)*r,ty+Math.sin(th)*r*.5-q*14*s];
      };
      c.each(at=>{
        c.add(at-120,900,'top',(g,p)=>{
          g.globalCompositeOperation='lighter';dragon(g,trail(chase,p,16+W.stage,.022),P,w);
          if(W.crown&&p>.15)dragon(g,trail(u=>{const [px,py]=chase(Math.max(.15,u));return [2*tx-px,2*ty-py];},p,14+W.stage,.022),{...P,main:P.accent,accent:P.main},w*.85);
        });
        c.add(at+140,600,'ground',(g,p)=>{g.globalAlpha*=1-p;ring(g,tx,tfy,(20+ease(p)*70)*s,P.main,5*(1-p)+.5);ring(g,tx,tfy,(10+ease(p)*50)*s,P.accent,3*(1-p)+.5);});
        c.add(at,800,'top',(g,p)=>huntMark(g,tx,ty,(20+W.stage)*s,P,p));
        c.burst(at+140,tx,ty,12+W.stage*2,[P.core,P.main,P.accent],{speed:280,life:600,size:2.8,spark:true});
        c.shake(at,3);c.shake(at+160,7);
      });
    },
    // 9 ทวนทะลวงสวรรค์: ascend, a fan of spears forms and the heaven gate opens, rain of spears and a pillar
    9(c){
      const {fx,fy,tx,ty,tfy,wind,P,W,s,mine}=c,N=4+Math.floor(W.stage/2),gateY=ty-150*s;
      const fan=i=>{const b=-Math.PI/2+(i-(N-1)/2)*.32;return [fx+Math.cos(b)*60*s,fy-98*s+Math.sin(b)*40*s];};
      c.add(0,wind+60,'top',(g,p)=>{
        const el=p*(wind+60),tips=[];g.globalCompositeOperation='lighter';
        for(let i=0;i<N;i++){const vis=clamp((el-i*wind*.6/N)/120);if(!vis)continue;const [px,py]=fan(i),b=Math.atan2(ty-py,tx-px);
          g.save();g.globalAlpha*=vis;lance(g,px+Math.cos(b)*14*s,py+Math.sin(b)*14*s,b,34*s,P,.75*s);g.restore();tips.push([px,py]);}
        if(tips.length>1){g.save();g.globalAlpha*=.6;line(g,tips,P.accent,1);g.restore();tips.forEach(([px,py])=>star(g,px,py,4*s,P,el/150));}
        const q=ease(el/wind);seal(g,tx,gateY,(26+W.stage*2)*s*q,P,W,el/500,.4);
        for(let i=0;i<5;i++){const b=Math.PI/2+(i-2)*.12;line(g,[[tx,gateY],[tx+Math.cos(b)*120*s*q,gateY+Math.sin(b)*120*s*q]],P.main+'60',2);}
      });
      c.each((at,h)=>{
        for(let i=0;i<N;i++){const [px,py]=fan(i),b=Math.atan2(ty-py,tx-px);
          c.add(at-110+i*90/N,200,'top',(g,p)=>{const q=easeIn(p*1.6);streak(g,px,py,px+(tx-px)*q,py+(ty-py)*q,4*s,P.main,P.core);lance(g,px+(tx-px)*q,py+(ty-py)*q,b,34*s,P,.75*s);});}
        c.add(at-60,260,'top',(g,p)=>lance(g,tx,gateY+(ty-gateY)*easeIn(p*1.5),Math.PI/2,120*s,P,2.2*s));
        c.add(at,700,'top',(g,p)=>pillar(g,tx,tfy,gateY,(22+W.stage*1.5)*s*(1-p*.5),P,1-p));
        c.add(at,1100,'ground',(g,p)=>{g.globalAlpha*=Math.min(1,(1-p)*2);seal(g,tx,tfy,(40+W.stage*3)*s*ease(p*3),P,W,p*1.5,.42);ring(g,tx,tfy,(30+ease(p)*90)*s,P.core,4*(1-p)+.5);});
        c.add(at,420,'top',(g,p)=>{glow(g,tx,ty,(50+W.stage*2)*s,P.main,P.core,1-p);star(g,tx,ty,(26+W.stage)*s*(1-p*.4),P,p+h);});
        if(W.dragon)c.add(at,700,'top',(g,p)=>{g.globalCompositeOperation='lighter';
          dragon(g,trail(u=>{const th=u*TAU*1.5;return [tx+Math.cos(th)*24*s,tfy-u*160*s+Math.sin(th)*6*s];},p,16+W.stage,.03),P,.9*s);});
        c.burst(at,tx,ty,18+W.stage*2,[P.core,P.main,P.accent,'#ffffff'],{speed:380,up:60,life:700,size:3,spark:true});
        c.shake(at,12+W.stage*.2);if(mine)c.later(at,()=>FX.flash(P.core,320,.22));
      });
    },
  };

  S.play=d=>{
    const e=ent(d.id),t=ent(d.tid),sk=C.ALL_SKILLS[d.t];if(!e||!t||!sk?.spear)return;
    const W=S.power(e.lvl||1),f=d.f||e.faction,P=SkillFX.palette('spearman',f),r=d.r||0,k=Number(sk.key);
    const beats=d.beats||C.spearSequence(sk,r),x=e.x,y=e.y-28,tx=t.x,ty=t.y-22,wind=beats[0].at,gap=d.g||260,n=beats.length;
    // one-shot cues run by FX.update at their time (never timers, never inside a draw)
    const mine=!!(window.G&&d.id===G.myId),later=(ms,fn)=>push({skillArt:true,skill:d.t,owner:d.id,cls:'spearman',tier:W.stage,
      t0:performance.now()+Math.max(0,ms),dur:60,layer:'cue',draw(){},cue:fn});
    const c={e,P,W,k,x,y,fx:e.x,fy:e.y,tx,ty,tfy:t.y,a:Math.atan2(ty-y,tx-x),L:Math.hypot(tx-x,ty-y),wind,gap,n,r,mine,
      dark:f==='adharma',s:W.scale*(1+r*.12),later,
      add:(delay,dur,layer,draw)=>add(d,W,delay,dur,layer,draw),
      each:fn=>beats.forEach((b,h)=>fn(b.at,h)),
      shake:(ms,v)=>{if(mine)later(ms,()=>{FX.shake=Math.max(FX.shake,v);});},
      burst:(ms,bx,by,count,cols,o)=>later(ms,()=>FX.burst(bx,by,Math.round(count),cols,o))};
    // Distinct opening/reversal beats lead into one signature finisher, not repeated explosions.
    if(k===3||n===1)(ART[k]||ART[1])(c);
    else{
      beats.slice(0,-1).forEach((b,i)=>{
        const side=i%2?1:-1,ox=x-Math.sin(c.a)*side*18,oy=y+Math.cos(c.a)*side*12;
        c.add(b.at-90,240,'top',(g,p)=>{const q=ease(p*1.7),hx=ox+(tx-ox)*q,hy=oy+(ty-oy)*q;
          streak(g,ox,oy,hx,hy,4*c.s,P.main,P.core);lance(g,hx,hy,c.a,32*c.s,P,.7*c.s);
          if(b.move==='cross'||b.move==='spin')slash(g,tx,ty,c.a+side*.7,30*c.s,14*side,3,P.accent,q);
        });
        c.add(b.at,220,'top',(g,p)=>star(g,tx,ty,14*c.s*(1-p),P,i));
        c.shake(b.at,1.5);
      });
      const end=beats.at(-1).at;
      (ART[k]||ART[1])({...c,wind:end,n:1,each:fn=>fn(end,n-1)});
    }
    // final stage: lightning crown stays centred on the same victim
    if(W.divine)c.add(beats.at(-1).at,560,'top',(g,p)=>{
      g.globalCompositeOperation='lighter';const R=32*c.s;
      for(let j=0;j<3;j++){const b=j*TAU/3+p*.3,pts=[];
        for(let i=0;i<=8;i++){const u=i/8,rr=R*(.6+u*.6),aa=b+u*.5;pts.push([tx+Math.cos(aa)*rr+(i%2?3:-3),ty+Math.sin(aa)*rr]);}
        line(g,pts,P.core,1.3);}
    });
  };
  S.cancel=(id,skill)=>{FX.list=FX.list.filter(f=>!(f.owner===id&&f.skill===skill));};
  S.impact=d=>{
    const e=ent(d.id);if(!e)return;
    const P=SkillFX.palette('spearman',d.f||e.faction),W=S.power(e.lvl||1),event={...d,t:d.skill};
    if(window.SkillArts?.handles(d.skill))SkillArts.impact(d);
    else add(event,W,0,240,'top',(g,p)=>star(g,d.x,d.y-22,(d.final?22:10)*(1-p),P,d.step));
    if(!d.area)return;
    const A=d.area;
    add(event,W,0,480,'ground',(g,p)=>{
      // No level-based scale or flattened ellipse: this outline is the damage boundary.
      g.globalAlpha*=.75*(1-p);g.beginPath();
      if(A.shape==='cone'){g.moveTo(d.cx,d.cy);g.arc(d.cx,d.cy,A.radius,d.a-A.half,d.a+A.half);g.closePath();}
      else g.arc(d.cx,d.cy,A.radius,0,TAU);
      g.fillStyle=P.main+'18';g.fill();g.strokeStyle=P.accent;g.lineWidth=2;g.stroke();
      if(A.shape==='cone'){g.beginPath();g.arc(d.cx,d.cy,A.radius*ease(p),d.a-A.half,d.a+A.half);g.strokeStyle=P.core;g.stroke();}
      else{g.beginPath();g.arc(d.cx,d.cy,A.radius*ease(p),0,TAU);g.strokeStyle=P.core;g.stroke();}
    });
  };
})();
