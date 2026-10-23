// Equipped pieces and level appearance are independent, as in SpearmanGear.
// Frame-sized caches avoid recolouring a multi-megapixel atlas on an equipment change.
(function(){
  const S=window.WarriorGear={},bases=new Map(),cache=new Map(),rims=new WeakMap();let M,images,masks;
  const mk=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp=n=>Math.max(0,Math.min(1,n));
  const HAIR={dharma:['#374b69','#355a80','#46778f','#9bbecf','#bbd6e0','#dae5ea','#e4edf0','#fff2da'],adharma:['#252330','#372331','#51233b','#75263b','#85263c','#a52a45','#bf3c55','#de4e64']};
  S.hairColor=(f,t)=>HAIR[f][t];
  S.init=(meta,art,regions)=>{M=meta;images=art;masks=regions;bases.clear();cache.clear();};
  S.meta=()=>M;
  S.anchor=(e,F)=>M.landmarks[e.faction==='adharma'?'adharma':'dharma'][F.atk?'attack':'walk'][F.frame*8+C.DIR_COL[F.dir&7]];
  S.weaponLine=(e,F)=>S.anchor(e,F)?.blade?.map(p=>[p[0]-M.anchorX,p[1]-M.anchorY])||[];
  S.glintAnchors=(e,F)=>S.anchor(e,F)?.glints||[[],[],[],[]];
  function base(f,pose,row,col){
    const key=[f,pose,row,col].join('|');if(bases.has(key))return bases.get(key);
    const {frameWidth:w,frameHeight:h}=M,c=mk(w,h),g=c.getContext('2d',{willReadFrequently:true});
    g.drawImage(images[f+'-'+pose],col*w,row*h,w,h,0,0,w,h);const data=g.getImageData(0,0,w,h);
    g.clearRect(0,0,w,h);g.drawImage(masks[f+'-'+pose],col*w,row*h,w,h,0,0,w,h);
    const D=g.getImageData(0,0,w,h).data,regions=new Uint8Array(w*h);
    for(let k=0;k<regions.length;k++)regions[k]=Math.round(D[k*4]/30);
    const v={data,regions};bases.set(key,v);return v;
  }
  S.frame=(e,F)=>{
    const f=e.faction==='adharma'?'adharma':'dharma',pose=F.atk?'attack':'walk',col=C.DIR_COL[F.dir&7],row=F.frame;
    const tier=ModelTiers.tierOf(e.lvl||1),ar=Array.from({length:4},(_,i)=>e.ar?.[i]||0),wt=e.wt||0;
    const key=[f,pose,row,col,tier,ar.join(','),wt].join('|');if(cache.has(key))return cache.get(key);
    const {data,regions}=base(f,pose,row,col),{frameWidth:w,frameHeight:h}=M,c=mk(w,h),g=c.getContext('2d');
    const im=new ImageData(new Uint8ClampedArray(data.data),w,h),D=im.data,a=S.anchor(e,F),B=M.anchorY-a.headTop,cx=(a.head.x0+a.head.x1)/2;
    const dark=f==='adharma',ink=rgb(dark?'#120c18':'#172b46'),light=rgb(dark?'#ffb9ad':'#fff9e7'),hair=rgb(HAIR[f][tier]),p=WarriorWeapons.design(wt,f);
    const cloth=ar.map(t=>rgb(C.ARMOR_SETS[t-1]?.look[f].color||(dark?'#38212b':'#557b9a')));
    for(let k=0;k<regions.length;k++){
      const region=regions[k];if(!region)continue;const i=k*4,lum=(Math.max(D[i],D[i+1],D[i+2])+Math.min(D[i],D[i+1],D[i+2]))/510;
      let out;
      if(region===5){const hairInk=rgb(!dark&&tier>=5?(tier===7?'#635b55':'#525864'):(dark?'#120c18':'#172b46'));out=lum<.42?mix(hairInk,hair,clamp(lum/.42)):mix(hair,light,clamp((lum-.42)*1.3));}
      else if(region===6){D[i+3]=0;continue;}
      else if(region===7){out=mix(rgb(p.deep),rgb(p.main),clamp(lum*1.8));}
      else{
        const slot=region-1,t=ar[slot];if(!t)continue;
        const material=C.armorLookTier(t),x=k%w,y=k/w|0,u=(x-cx)/B,v=(y-a.headTop)/B;
        const metal=rgb(material>=6?(dark?'#c7a080':'#e4cf97'):material>=3?'#a9bbcc':dark?'#744c50':'#9db3c7');
        let shade=lum,accent=0;
        if(material===1)shade*=.87+((x+y)%4)*.025;
        if(material===2){shade*=.85;if((x+Math.floor(y/12)*5)%19<2)accent=.23;}
        if(material===3){const sy=y%7,sx=(x+Math.floor(y/7)*4)%9;shade*=.84+sy*.022;if(sy===0||sx===0)accent=.16;}
        if(material===4)shade=clamp(shade+.06*Math.sin(u*48+v*14));
        if(material===5){shade*=.78+Math.sin(u*36)**2*.22;if((x+Math.floor(y/15)*7)%25<2)accent=.48;}
        if(material>=6&&Math.sin(u*65+Math.sin(v*25)*2)*Math.cos(v*65)>.88)accent=.65;
        out=shade<.48?mix(ink,cloth[slot],clamp(shade/.48)):mix(cloth[slot],light,clamp((shade-.48)*1.55));
        if(accent)out=mix(out,metal,accent);
        if(slot===0&&Math.abs(Math.abs(u)-(.04+(v-.55)*.22))<.006)out=mix(out,metal,.65);
      }
      for(let j=0;j<3;j++)D[i+j]=out[j];
    }
    g.putImageData(im,0,0);
    // The same weapon designs drive inventory icons and held gear. Hands stay in the painting.
    const shield=mk(w,h),sg=shield.getContext('2d'),poly=a.shield;
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    sg.save();sg.translate((x0+x1)/2,(y0+y1)/2+2);sg.scale((x1-x0)/66,(y1-y0)/88);WarriorWeapons.shield(sg,p);sg.restore();
    const mask=mk(w,h),mg=mask.getContext('2d'),md=mg.createImageData(w,h);
    for(let k=0;k<regions.length;k++)if(regions[k]===7)md.data[k*4+3]=data.data[k*4+3];
    mg.putImageData(md,0,0);sg.globalCompositeOperation='destination-in';sg.drawImage(mask,0,0);g.drawImage(shield,0,0);
    if(a.blade){const [[hx,hy],[tx,ty]]=a.blade,L=Math.hypot(tx-hx,ty-hy);
      g.save();g.translate(hx,hy);g.rotate(Math.atan2(ty-hy,tx-hx)+Math.PI/2);g.scale(col>4?-1.25:1.25,L/(60+(wt>=6?6:0)));WarriorWeapons.sword(g,p);g.restore();
      // The grip passes under the authored hand. Restore skin and gauntlet pixels at its end.
      const dx=tx-hx,dy=ty-hy,len=Math.hypot(dx,dy),handX=hx-dx/len*13,handY=hy-dy/len*13;
      const hand=mk(w,h),hg=hand.getContext('2d'),hd=hg.createImageData(w,h);
      for(let yy=Math.max(0,Math.floor(handY-9));yy<Math.min(h,handY+9);yy++)for(let xx=Math.max(0,Math.floor(handX-9));xx<Math.min(w,handX+9);xx++){
        const k=yy*w+xx;if(regions[k]===6||Math.hypot(xx-handX,yy-handY)>8)continue;
        hd.data.set(im.data.subarray(k*4,k*4+4),k*4);
      }
      hg.putImageData(hd,0,0);g.drawImage(hand,0,0);
    }
    cache.set(key,c);if(cache.size>96)cache.delete(cache.keys().next().value);return c;
  };
  S.rim=(body,e)=>{
    const grade=Math.max(e.gg?.[0]??e.wg??0,...[0,1,2,3].map(i=>e.ar?.[i]?e.gg?.[i+1]||0:0));if(!grade)return null;
    const color=C.gradeLight(e.faction,grade),key=color+grade;let map=rims.get(body);if(!map){map=new Map();rims.set(body,map);}if(map.has(key))return map.get(key);
    const pad=16,c=mk(body.width+pad*2,body.height+pad*2),g=c.getContext('2d'),t=mk(c.width,c.height),tg=t.getContext('2d');
    tg.drawImage(body,pad,pad);tg.globalCompositeOperation='source-in';tg.fillStyle=color;tg.fillRect(0,0,t.width,t.height);
    const r=[0,.9,1.45,2.05,2.8,3.6][grade];
    for(let i=0;i<16;i++){const a=i*Math.PI/8;g.drawImage(t,Math.cos(a)*r,Math.sin(a)*r);}
    g.globalCompositeOperation='destination-out';g.drawImage(body,pad,pad);
    const v={img:c,pad,alpha:[0,.18,.23,.27,.30,.32][grade]};map.set(key,v);return v;
  };
})();
