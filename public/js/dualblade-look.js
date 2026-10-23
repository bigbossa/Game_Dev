// One costume pipeline for dual blades: fitted cloth/armour, hair and a single blade-wing rig.
// Sheet work is cached by ArmorLook; live effects never read pixels or allocate particle timers.
(function () {
  const D = window.DualbladeLook = {}, TAU = Math.PI * 2;
  D.is = e => !e.cls || e.cls === 'dualblade';
  D.stageOf = lvl => Math.max(0, Math.min(13, Math.floor((lvl || 1) / 10)));
  const mk = (w,h) => { const c=document.createElement('canvas');c.width=w;c.height=h;return c; };
  const rgb = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const mix = (a,b,k) => a.map((v,i)=>Math.round(v+(b[i]-v)*k));
  const LIGHT = ['#34455f','#3d5272','#344f89','#2c6691','#267d83','#317d90','#477caa',
    '#a4c4d0','#426b9a','#9aaac7','#d2e0e5','#abbecf','#d4e3e6','#eee6d5'];
  const DARK = ['#452b42','#3b3043','#582737','#482535','#632637','#442833','#522434',
    '#6b283c','#4e2639','#672737','#502b3d','#61233a','#74283c','#862c40'];
  const HAIR_L = ['#65504a','#534b51','#3c465e','#3c5670','#386c77','#557e91','#7b98ae',
    '#a8bbc8','#bbcbd4','#bbc9db','#cfdae3','#d9e6e9','#e5edee','#f5eddc'];
  const HAIR_D = ['#35252e','#30202b','#3b202e','#441d2d','#361a29','#421b2d','#4b1c2d',
    '#3c1626','#4b1729','#351322','#431425','#4f182a','#5b192b','#661d30'];
  D.palette = (f,stage) => {
    const n=Math.max(0,Math.min(13,stage|0)), dark=f==='adharma';
    return {dark,cloth:(dark?DARK:LIGHT)[n],ink:dark?'#170e1b':'#24344c',
      metal:dark?(n>=8?'#d6a29c':'#b58c93'):(n>=8?'#ead39a':'#b8d7e5'),
      light:dark?'#efb3b5':'#f0f8ff',gem:dark?'#ed546e':'#70dce9',
      hair:(dark?HAIR_D:HAIR_L)[n],tip:dark?(n>=6?'#bd3455':'#805065'):(n>=7?'#fff4d6':'#aacada')};
  };
  function polygon(g,pts,fill,edge,width=1) {
    g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();} if(edge){g.strokeStyle=edge;g.lineWidth=width;g.stroke();}
  }
  function jewel(g,x,y,r,p) {
    polygon(g,[[x,y-r],[x+r*.6,y],[x,y+r],[x-r*.6,y]],p.gem,p.ink,Math.max(.7,r*.18));
    g.fillStyle=p.light;g.fillRect(x-r*.13,y-r*.5,Math.max(.7,r*.18),r*.42);
  }
  // Length is measured from the tie in body-height units, not from the canvas edge.
  D.hairProfile = stage => {
    const n=Math.max(0,Math.min(13,stage|0));
    return {length:[0,.15,.23,.32,.40,.47,.52,.57,.61,.65,.69,.73,.78,.84][n],
      width:[0,.035,.045,.055,.065,.075,.085,.09,.095,.10,.11,.115,.12,.135][n],
      loose:[false,false,false,false,false,true,false,false,true,false,true,false,false,true][n],
      braid:n===7||n===9||n===11,split:n>=10,stage:n};
  };
  D.equipmentPalette = (f,t,base) => t<8?base : {
    ...base,
    cloth:f==='adharma'?(t===9?'#351623':'#392b50'):(t===9?'#e9ddbf':'#b6dce5'),
    ink:f==='adharma'?'#150f1b':t===9?'#45465a':'#253e58',
    metal:f==='adharma'?(t===9?'#d6a084':'#b9a1d4'):(t===9?'#bc924b':'#c6aa69'),
    light:f==='adharma'?(t===9?'#cc7890':'#b593cf'):'#fff6de',
    gem:f==='adharma'?(t===9?'#f55170':'#c189ef'):(t===9?'#f1cc78':'#7ddde1'),
  };
  function hairLocks(g,F,I,p,H) {
    if(!H.length)return;
    const B=F.BH,back=F.view==='back',profile=F.view==='side',trail=F.trail||1;
    const signs=H.loose||H.split?[-1,1]:[trail];
    g.save();g.beginPath();g.rect(F.X+3,F.Y+3,I.fw-6,I.fh-6);g.clip();g.translate(F.X,F.Y);
    for(const [sign,lock] of signs.flatMap(sign=>H.loose?[[sign,0],[sign,1],[sign,2]]:[[sign,0]])){
      if(profile&&H.loose&&sign!==trail)continue;
      const rootX=H.loose?F.cx+sign*B*(.09+lock*.018):F.tie[0],rootY=H.loose?F.y0+B*.22:F.tie[1]+B*.02;
      const endY=Math.min(F.y1-B*.05,F.tie[1]+B*(H.length-lock*.045));
      const endX=Math.max(6,Math.min(I.fw-6,F.cx+sign*B*((back?.10:profile?.25:.20)+lock*.023)));
      const width=B*H.width*(H.loose?.48:H.split?.75:.8)*(profile?.85:1),swing=(F.row===0?-1:F.row===2?1:0)*B*.012;
      const c1x=rootX+sign*B*.16,c1y=rootY+B*.17,c2x=endX+sign*width*.6+swing,c2y=endY-B*.22;
      const grad=g.createLinearGradient(Math.min(rootX,endX)-width,0,Math.max(rootX,endX)+width,0);
      const shadow=p.dark?'#351323':'#737d89',highlight=p.dark?p.tip:'#fff8e8';
      grad.addColorStop(0,shadow);grad.addColorStop(.25,p.hair);grad.addColorStop(.48,highlight);grad.addColorStop(.68,p.hair);grad.addColorStop(1,shadow);
      g.beginPath();g.moveTo(rootX-sign*width*.35,rootY);
      g.bezierCurveTo(c1x-sign*width*.7,c1y,c2x-sign*width*.75,c2y,endX-sign*width*.4,endY-B*.04);
      g.lineTo(endX,endY);g.lineTo(endX+sign*width*.28,endY-B*.075);
      g.bezierCurveTo(c2x+sign*width*.65,c2y,c1x+sign*width*.8,c1y,rootX+sign*width*.35,rootY);g.closePath();
      g.fillStyle=grad;g.fill();g.strokeStyle=p.ink;g.lineWidth=Math.max(.8,B*.005);g.stroke();
      for(let strand=0;strand<7;strand++){
        const off=(strand-3)*width*.14;
        g.beginPath();g.moveTo(rootX+off*.3,rootY+B*.015);
        g.bezierCurveTo(c1x+off,c1y,c2x+off,c2y,endX+off*.16,endY-B*(.03+(strand%2)*.02));
        g.strokeStyle=strand%2?shadow:highlight;g.globalAlpha=strand%2?.6:.7;g.lineWidth=Math.max(.65,B*.0035);g.stroke();
      }g.globalAlpha=1;
      if(H.braid){
        // Bindings sit on the same cubic as the hair, rather than floating beside it.
        for(const t of [.45,.62,.78]){
          const q=1-t,x=q*q*q*rootX+3*q*q*t*c1x+3*q*t*t*c2x+t*t*t*endX;
          const y=q*q*q*rootY+3*q*q*t*c1y+3*q*t*t*c2y+t*t*t*endY;
          g.strokeStyle=p.metal;g.lineWidth=B*.008;g.beginPath();g.moveTo(x-width*.35,y-1);g.quadraticCurveTo(x,y+3,x+width*.35,y-1);g.stroke();
        }
      }
    }g.restore();
  }
  // Patterns remain inside each source cloth region, including raised arms and moving legs.
  D.compose = function(base,faction,key,stage,ar,M,R,anchorAt) {
    if (window.DualbladeModel?.ready) return DualbladeModel.compose(faction,key,stage,ar);
    const I=ModelTiers.info(key);
    if(!I||!M)return base;
    const p=D.palette(faction,stage), c=mk(I.W,I.H),g=c.getContext('2d');
    g.drawImage(base,0,0);
    const im=g.getImageData(0,0,I.W,I.H),d=im.data;
    // Attack frames can put the raised hair tie near the eye mask. Protect the
    // original iris pixels through every subsequent decoration pass.
    const eyePixels=Array.from(I.eyes,k=>[k,d[k*4],d[k*4+1],d[k*4+2],d[k*4+3]]);
    const hair=new Set(I.hair), eyes=new Set(I.eyes), ink=rgb(p.ink), light=rgb(p.light);
    const garments=[0,1,2,3].map(slot=>D.equipmentPalette(faction,ar?.[slot]||0,p));
    for(let k=0;k<I.W*I.H;k++){
      const i=k*4;if(!d[i+3]||hair.has(k)||eyes.has(k))continue;
      const r=M.a[i],green=M.a[i+1],blue=M.a[i+2];
      // Do not recolour the hair tie (120), skin or the hand-held swords.
      const slot=blue?2:green?1:(r>=200||r===90||r===150)?0:-1;
      if(slot<0)continue;
      const lum=(Math.max(d[i],d[i+1],d[i+2])+Math.min(d[i],d[i+1],d[i+2]))/510;
      const P=garments[slot],slotCloth=rgb(P.cloth),slotInk=rgb(P.ink),slotLight=rgb(P.light);
      const target=slot===1?mix(slotInk,slotCloth,(ar?.[slot]||0)>=8?.75:.35):slot===2?mix(slotInk,slotCloth,.8):slotCloth;
      const out=lum<.48?mix(slotInk,target,Math.min(1,lum*2.1)):mix(target,slotLight,(lum-.48)*1.1);
      const strength=slot===0&&r===90?.82:.9;
      for(let j=0;j<3;j++)d[i+j]=d[i+j]*(1-strength)+out[j]*strength;
    }
    for(let n=0;n<I.hair.length;n++){
      const i=I.hair[n]*4;if(!d[i+3]||eyes.has(I.hair[n]))continue;
      const lum=(Math.max(d[i],d[i+1],d[i+2])+Math.min(d[i],d[i+1],d[i+2]))/510;
      const body=mix(rgb(p.hair),rgb(p.tip),Math.max(0,I.hairF[n]-.38)*.75);
      const shadow=mix(ink,body,.34);
      // Continuous luminance mapping keeps silver hair shaded without speckled
      // jumps between almost-black outlines and white highlights.
      const out=lum<.08?mix(ink,shadow,lum/.08):lum<.38?mix(shadow,body,(lum-.08)/.3)
        :mix(body,light,Math.min(.5,(lum-.38)*1.4));
      for(let j=0;j<3;j++)d[i+j]=out[j];
    }
    g.putImageData(im,0,0);
    const hairStyle=D.hairProfile(stage), backHair=mk(I.W,I.H), hg=backHair.getContext('2d');
    for(const F of I.frames.filter(Boolean))if(F.view!=='back')hairLocks(hg,F,I,p,hairStyle);
    g.save();g.globalCompositeOperation='destination-over';g.drawImage(backHair,0,0);g.restore();
    // A tailored jacket: diagonal seams, segmented hip panels and thin metal inlays.
    // Each slot has its own mask; equipment tiers add detail without enlarging the body.
    if(R)for(const [slot,mask]of [[0,R.shirt],[1,R.legs],[2,R.arms]]){
      const layer=mk(I.W,I.H),lg=layer.getContext('2d'), equipment=ar?.[slot]||0;
      for(const F of I.frames.filter(Boolean)){
        const B=F.BH,A=anchorAt(F.row*8+F.col);
        if(!A)continue;
        lg.save();lg.beginPath();lg.rect(F.X,F.Y,I.fw,I.fh);lg.clip();lg.translate(F.X,F.Y);
        const x=A.beltX,y=A.beltY,w=Math.min(A.beltW*.65,B*.13);
        if(equipment>=8){
          const P=garments[slot],high=equipment===9;
          // Dye and embroidery cover the entire authored slot, including sleeves and boots.
          // The destination-in mask below follows every pose and keeps skin / gaps transparent.
          const fabric=lg.createLinearGradient(F.x0,0,F.x1,0);
          fabric.addColorStop(0,P.ink);fabric.addColorStop(.35,P.cloth);fabric.addColorStop(.5,P.light);fabric.addColorStop(.65,P.cloth);fabric.addColorStop(1,P.ink);
          lg.globalAlpha=.22;lg.fillStyle=fabric;lg.fillRect(0,0,I.fw,I.fh);lg.globalAlpha=1;
          lg.lineJoin='round';lg.strokeStyle=P.metal;lg.lineWidth=Math.max(.8,B*.006);
          if(slot===0){
            const neck=Math.max(A.S.y0,F.neck[1]-B*.015),ww=B*(F.view==='side'?.075:.13);
            const hem=Math.min(A.S.y1,y+B*(high?.24:.19));
            // Connected collar -> fitted cuirass -> belt -> split coat panels.
            for(const sign of [-1,1]){
              polygon(lg,[[F.cx+sign*ww,neck],[F.cx+sign*ww*.28,neck+B*.10],
                [x+sign*ww*.42,y-B*.02],[x+sign*ww*.85,hem],[x+sign*ww*1.35,hem-B*.04],
                [x+sign*ww*.85,y-B*.06]],P.cloth,P.metal,B*.007);
              lg.beginPath();lg.moveTo(F.cx+sign*ww*.9,neck+B*.025);lg.lineTo(x+sign*ww*.32,y-B*.025);lg.lineTo(x+sign*ww*.92,hem-B*.025);lg.stroke();
              for(let n=0;n<(high?4:3);n++){
                const yy=y+B*(.035+n*.035),xx=x+sign*ww*(.53+n*.10);
                polygon(lg,[[xx,yy-B*.015],[xx+sign*B*.024,yy],[xx,yy+B*.015],[xx-sign*B*.012,yy]],P.ink,P.metal,B*.0035);
              }
            }
            if(F.view!=='back'){
              polygon(lg,[[F.cx,neck+B*.08],[F.cx-ww*.55,neck+B*.15],[x,y-B*.025],[F.cx+ww*.55,neck+B*.15]],P.ink,P.metal,B*.006);
              jewel(lg,F.cx,neck+B*.16,B*(high?.016:.012),P);
            }
            polygon(lg,[[x-w,y-B*.015],[x+w,y-B*.015],[x+w,y+B*.018],[x-w,y+B*.018]],P.ink,P.metal,B*.006);
          }else{
            const box=slot===1?R.legBox[F.row*8+F.col]:A.S;
            if(box){
              const top=slot===1?box.y0:Math.max(box.y0,F.neck[1]+B*.08),bottom=box.y1;
              const step=B*(slot===1?.055:.043);
              for(let yy=top;yy<bottom;yy+=step){
                // Overlapping greave / vambrace plates remain inside each actual limb silhouette.
                lg.beginPath();lg.moveTo(F.x0,yy);lg.lineTo(F.cx,yy+B*.025);lg.lineTo(F.x1,yy);lg.stroke();
              }
              if(high){lg.strokeStyle=P.light;lg.lineWidth=B*.003;for(const sign of [-1,1]){
                lg.beginPath();lg.moveTo(x+sign*B*.07,top);lg.lineTo(x+sign*B*.095,bottom);lg.stroke();
              }}
            }
          }
          lg.restore();continue;
        }
        lg.strokeStyle=p.metal;lg.lineWidth=B*(equipment>=5?.009:.006);lg.lineJoin='round';
        if(slot===0){
          if(stage>=2){
            // Distinct jacket constructions: crossed lapels, an inset cuirass, then a split royal coat.
            const neck=F.neck[1]+B*.025,ww=B*(F.view==='side'?.075:.12);
            const fill=stage>=10?p.light:stage>=6?p.metal:p.ink;
            lg.save();lg.globalAlpha=stage>=10?.68:stage>=6?.35:.48;
            if(stage%3===0)
              polygon(lg,[[F.cx-ww,neck],[F.cx+ww,neck+B*.04],[x+ww*.55,y+B*.15],
                [x,y+B*.18],[x-ww*.55,y+B*.15]],fill,null);
            else for(const sign of [-1,1])
              polygon(lg,[[F.cx+sign*ww,neck],[x+sign*ww*.22,y-B*.04],
                [x+sign*ww*.6,y+B*.17],[x+sign*ww*1.05,y+B*.1]],fill,null);
            lg.restore();
          }
          // Open neck and a short split hem: no scarf, cape or long apron.
          lg.beginPath();lg.moveTo(F.cx-B*.12,F.neck[1]);lg.lineTo(x+w*.4,y);lg.lineTo(x+w*.7,y+B*.15);
          lg.moveTo(F.cx+B*.12,F.neck[1]);lg.lineTo(x-w*.4,y);lg.lineTo(x-w*.7,y+B*.15);lg.stroke();
          for(let j=0;j<1+Math.floor(stage/3);j++){
            const yy=y+B*(.04+j*.021);
            lg.beginPath();lg.moveTo(x-w,yy);lg.lineTo(x-w*.25,yy+B*.018);
            lg.moveTo(x+w,yy);lg.lineTo(x+w*.25,yy+B*.018);lg.stroke();
          }
          if(stage>=3){
            lg.globalAlpha=.55;lg.lineWidth=B*.004;
            for(const side of [-1,1]){
              const xx=x+side*B*.11;
              polygon(lg,[[xx,y-B*.13],[xx+side*B*.035,y-B*.05],[xx,y],[xx-side*B*.025,y-B*.06]],p.ink,p.metal,B*.004);
            }
          }
        }else{
          const step=B*(slot===1?.11:.075);
          for(let yy=F.neck[1]+B*.05;yy<F.y1;yy+=step){
            lg.beginPath();lg.moveTo(F.x0,yy);lg.lineTo(F.x1,yy+B*.025);lg.stroke();
          }
          if(stage>=6){lg.fillStyle=p.gem;lg.globalAlpha=.55;lg.fillRect(x-B*.12,y+B*.17,B*.024,B*.08);}
        }
        lg.restore();
      }
      lg.globalCompositeOperation='destination-in';lg.drawImage(mask,0,0);
      // Legacy region masks contain a few pixels in transparent gaps. Intersect with the actual sprite too.
      lg.drawImage(base,0,0);
      g.drawImage(layer,0,0);
    }
    // Compact hair silhouettes and fitted fastenings. Decorations stay within their animation cell.
    for(const F of I.frames.filter(Boolean)){
      const B=F.BH,A=anchorAt(F.row*8+F.col);
      g.save();g.beginPath();g.rect(F.X+2,F.Y+2,I.fw-4,I.fh-4);g.clip();g.translate(F.X,F.Y);
      const [hx,hy]=F.tie, side=F.view==='side'?F.trail:1;
      if(stage>=2){
        // Swept knot / braided topknot; it sits at the hair tie rather than covering the face.
        g.save();g.translate(hx,hy);g.rotate(side*-.25);
        const length=B*(.055+Math.min(stage,9)*.005);
        g.fillStyle=p.hair;g.strokeStyle=p.ink;g.lineWidth=B*.005;
        g.beginPath();g.ellipse(side*B*.015,-length*.35,B*.028,length*.65,-side*.3,0,TAU);g.fill();g.stroke();
        g.strokeStyle=p.tip;g.lineWidth=B*.003;
        for(let j=0;j<2+Math.floor(stage/4);j++){
          g.beginPath();g.moveTo(-B*.015,-length*.1-j*B*.01);g.quadraticCurveTo(0,-length*.45,side*B*.033,-length*.3-j*B*.008);g.stroke();
        }
        g.restore();
      }
      const crownW=B*(.035+stage*.002),crownY=hy+B*.013;
      polygon(g,[[hx-crownW,crownY],[hx-crownW*.75,crownY-B*.025],
        [hx,crownY-B*(.025+stage*.002)],[hx+crownW*.75,crownY-B*.025],[hx+crownW,crownY]],
        stage>=8?p.metal:p.ink,p.metal,B*.004);
      if(stage>=4)jewel(g,hx,crownY-B*.013,B*(.008+stage*.0004),p);
      if(stage>=8)for(const sign of [-1,1]){
        // Short pins follow the crown, not giant horns or cloth wings.
        polygon(g,[[hx+sign*crownW*.5,crownY-B*.012],[hx+sign*crownW*1.6,crownY-B*.046],
          [hx+sign*crownW,crownY+B*.003]],p.metal,p.ink,B*.003);
      }
      if(A){
        if(ar?.[3])for(const [sx,sy,k]of A.shoulders){
          const shoulder=garments[3],size=B*(.03+Math.min(ar[3],9)*.0015);
          const yy=Math.max(sy,F.neck[1]+B*.035);
          polygon(g,[[sx-k*size*.75,yy-size*.3],[sx+k*size*.6,yy-size*.5],
            [sx+k*size*1.05,yy+size*.5],[sx+k*size*.1,yy+size*.9],[sx-k*size*.75,yy+size*.35]],
            shoulder.cloth,shoulder.metal,B*.005);
          if(ar[3]>=8){
            g.strokeStyle=shoulder.metal;g.lineWidth=B*.004;
            g.beginPath();g.moveTo(sx-k*size*.55,yy+size*.15);g.lineTo(sx+k*size*.65,yy+size*.35);g.stroke();
          }
          if(stage>=5)jewel(g,sx,yy+size*.12,size*.22,shoulder);
        }
        if(F.view!=='back'){
          const w=Math.min(A.beltW*.25,B*.045);
          polygon(g,[[A.beltX-w,A.beltY],[A.beltX,A.beltY-B*.019],[A.beltX+w,A.beltY],
            [A.beltX,A.beltY+B*.019]],p.ink,p.metal,B*.005);
          if(stage>=3)jewel(g,A.beltX,A.beltY,B*.009,p);
        }
      }
      g.restore();
    }
    // Long back-facing hair occludes pauldrons and belt details; they must not float on top of the tresses.
    for(const F of I.frames.filter(Boolean))if(F.view==='back')hairLocks(g,F,I,p,hairStyle);
    if(eyePixels.length){
      const final=g.getImageData(0,0,I.W,I.H);
      for(const [k,r,green,b,a]of eyePixels){
        const i=k*4;final.data[i]=r;final.data[i+1]=green;final.data[i+2]=b;final.data[i+3]=a;
      }
      g.putImageData(final,0,0);
    }
    return c;
  };
  const wings=new Map();
  function wingArt(stage,faction) {
    const key=stage+faction;if(wings.has(key))return wings.get(key);
    const p=D.palette(faction,stage),c=mk(256,256),g=c.getContext('2d');
    g.translate(28,172);g.lineJoin='round';
    const count=2+Math.floor((stage-6)/2),length=105+(stage-6)*9;
    for(let i=count-1;i>=0;i--){
      const a=-.7+i*.22,L=length*(1-i*.085),x=Math.cos(a)*L,y=Math.sin(a)*L;
      const grad=g.createLinearGradient(0,0,x,y);grad.addColorStop(0,p.ink);grad.addColorStop(.5,p.cloth);grad.addColorStop(1,p.light);
      polygon(g,[[5,i*3],[x*.4,y*.6-10],[x,y],[x*.64,y*.7+12],[20,17+i*5]],grad,p.metal,1.6);
      g.strokeStyle=p.gem;g.lineWidth=1.2;g.beginPath();g.moveTo(20,5+i*3);g.lineTo(x*.87,y*.89+2);g.stroke();
      if(stage>=10)jewel(g,x*.64,y*.68,3,p);
    }
    jewel(g,22,11,7,p);
    wings.set(key,c);return c;
  }
  D.drawWings = function(g,e,F,x,y,t,s,pass,meta,size=1){
    const stage=D.stageOf(e.lvl);
    if(e.dead||stage<6||pass!=='back')return;
    const I=ModelTiers.info(ModelTiers.key(e.faction,F.atk,e.cls)),fr=I?.frames[F.frame*8+C.DIR_COL[F.dir]];
    if(!fr)return;
    const B=fr.BH*s,perspective=fr.view==='side',art=wingArt(stage,e.faction);
    const cx=x+(fr.neck[0]-meta.anchorX)*s,cy=y+(fr.neck[1]+fr.BH*.075-meta.anchorY)*s;
    // One pair only, always behind the sprite. Roots spread to shoulder width, leaving the torso readable.
    for(const side of [-1,1]){
      const k=B/250*(.75+stage*.025)*size,far=perspective&&side===fr.trail;
      g.save();g.translate(cx+side*B*.075,cy);
      g.scale(side*k*(perspective?(far?.38:.8):1),k);
      g.rotate(Math.sin(t*1.8)*.025*(e.moving?1.4:1));g.globalAlpha*=far?.6:.92;
      g.drawImage(art,-28,-172);g.restore();
    }
  };
  D.ground=function(g,e,t){
    const stage=D.stageOf(e.lvl);if(e.dead||stage<2)return;
    const p=D.palette(e.faction,stage),r=23+stage*1.8;
    g.save();g.translate(e.x,e.y+1);g.scale(1,.32);g.rotate(t*.12);
    g.strokeStyle=p.gem;g.globalAlpha=.3;g.lineWidth=1.1;
    g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
    const count=stage<6?2:stage<10?4:6;
    for(let j=0;j<count;j++){
      const a=j*TAU/count+t*.16;
      g.save();g.rotate(a);g.globalAlpha=.65;
      polygon(g,[[r-2,-2],[r+5+stage*.2,0],[r-2,2]],p.metal,null);g.restore();
    }
    if(stage>=9){g.globalAlpha=.22;g.setLineDash([8,9]);g.beginPath();g.arc(0,0,r+6,0,TAU);g.stroke();}
    g.restore();
  };
  D.drawAura=function(g,e,F,x,y,t,s,meta){
    const stage=D.stageOf(e.lvl);if(e.dead||stage<4)return;
    const p=D.palette(e.faction,stage),I=ModelTiers.info(ModelTiers.key(e.faction,F.atk,e.cls));
    const fr=I?.frames[F.frame*8+C.DIR_COL[F.dir]];if(!fr)return;
    const B=fr.BH*s;
    // Small sword sparks outside the body; no additive white disc over the face.
    g.save();g.strokeStyle=p.gem;g.lineWidth=.8;
    for(let j=0;j<Math.min(6,stage-2);j++){
      const side=j%2?1:-1,yy=y-B*(.12+(j/2%3)*.22)+Math.sin(t*1.4+j)*3;
      const xx=x+side*B*(.3+.025*(j%3));
      g.globalAlpha=.22+.14*Math.sin(t*2+j)**2;
      g.beginPath();g.moveTo(xx,yy-3);g.lineTo(xx,yy+3);g.moveTo(xx-2,yy);g.lineTo(xx+2,yy);g.stroke();
    }
    g.restore();
  };
})();
