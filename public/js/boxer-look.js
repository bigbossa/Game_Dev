// Painted boxing poses; bounded server-timed effects and cached skill icons.
(function(){
  const B=window.BoxerLook={},TAU=Math.PI*2,images={},icons=new Map();let model;
  const palette=f=>f==='adharma'?{main:'#ed725e',edge:'#ca986c',core:'#fff0d7',deep:'#281b26'}:{main:'#74e0c0',edge:'#e5c37c',core:'#f7fff0',deep:'#123c38'};
  B.load=async load=>{
    model=await fetch('assets/boxer/model.json').then(r=>{if(!r.ok)throw Error('Missing boxer model');return r.json();});
    await Promise.all(['dharma','adharma'].flatMap(f=>['walk','attack','combat'].map(async pose=>{
      const im=images[f+'-'+pose]=await load('assets/boxer/'+f+'-'+pose+'.png');
      if(pose!=='combat')ModelTiers.analyse(ModelTiers.key(f,pose==='attack','boxer'),im,{...model,framesPerDir:pose==='attack'?3:4});
    })));B.ready=true;
  };
  B.portrait=f=>'assets/boxer/'+(f==='adharma'?'adharma':'dharma')+'-portrait.png';
  B.frame=(e,now=performance.now())=>{
    const a=e.atk,active=!e.dead&&a&&now>=a.t0&&now<a.t0+a.dur;
    return {atk:!!active,dir:active?a.dir:e.dir,frame:active?(a.boxer?.phase==='hit'?1:0):CharacterMotion.walkFrame(e,1)};
  };
  B.draw=(g,e,F,x,y,scale,now)=>{
    if(!B.ready)return;
    const atk=!!F.atk,dir=(F.dir??2)&7;
    let frame=Math.min(atk?2:3,Math.max(0,F.frame||0)),sheet=atk?'attack':'walk';
    const p=palette(e.faction),a=e.atk,active=!e.dead&&a?.boxer&&now<a.t0+a.dur;
    const phase=active?Math.max(0,(now-a.t0)/a.dur):0;
    if(active&&a.boxer.phase==='hit'){
      const skill=a.kind,beat=a.boxer.beat,last=beat===(C.ALL_SKILLS[skill]?.boxer.hits||1)-1;
      const pose=skill==='qiElbow'?0:skill==='qiKnee'?1:skill==='qiQuake'||skill==='qiEmperor'&&last?3:skill==='qiCounter'||skill==='qiHeaven'&&last||skill==='qiJab'&&last?2:-1;
      if(pose>=0){sheet='combat';frame=pose;}
    }
    if(F.combat!==undefined){sheet='combat';frame=Math.max(0,Math.min(3,F.combat));}
    const punch=active&&a.boxer.phase==='hit'?Math.sin(phase*Math.PI):0;
    const facing=dir*Math.PI/4,lean=Math.cos(facing)*punch*.055;
    g.save();g.translate(x,y);g.scale(scale,scale);
    if(e.dead){g.globalAlpha*=.4;g.rotate(-1.1);}else if(e.flash>0)g.filter=`brightness(${1+e.flash})`;
    g.translate(Math.cos(facing)*punch*8,-80+Math.sin(facing)*punch*3);g.rotate(lean);g.translate(0,80);
    g.drawImage(images[e.faction+'-'+sheet],C.DIR_COL[dir]*model.frameWidth,frame*model.frameHeight,
      model.frameWidth,model.frameHeight,-model.anchorX,-model.anchorY,model.frameWidth,model.frameHeight);
    // Evolution ornaments stay quiet at rest; qi only lights during a strike.
    if(!e.dead&&(e.lvl||1)>=50){
      g.fillStyle=p.edge;g.strokeStyle=p.deep;g.lineWidth=1.5;
      for(const side of [-1,1]){g.beginPath();g.moveTo(side*14,-80);g.lineTo(side*19,-72);g.lineTo(side*14,-62);g.lineTo(side*9,-72);g.closePath();g.fill();g.stroke();}
    }
    if(active&&(e.lvl||1)>=100){
      g.globalAlpha*=punch*.8;g.strokeStyle=p.main;g.lineWidth=2;
      g.beginPath();g.ellipse(0,-80,62,25,facing,0,Math.PI*1.4);g.stroke();
    }
    g.restore();
  };
  function fist(g,x,y,size,p,angle=0){
    g.save();g.translate(x,y);g.rotate(angle);g.scale(size,size);g.lineJoin='round';
    const shade=g.createLinearGradient(-20,-26,25,24);shade.addColorStop(0,p.core);shade.addColorStop(.45,p.main);shade.addColorStop(1,p.deep);
    g.fillStyle=shade;g.strokeStyle=p.edge;g.lineWidth=2;
    g.beginPath();g.moveTo(-21,-16);g.lineTo(-14,-27);g.lineTo(17,-25);g.lineTo(25,-13);g.lineTo(20,11);g.lineTo(11,25);g.lineTo(-12,25);g.lineTo(-22,8);g.closePath();g.fill();g.stroke();
    g.strokeStyle=p.deep;g.lineWidth=2;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-10+i*9,-23);g.lineTo(-10+i*9,-10);g.stroke();}
    g.beginPath();g.moveTo(-20,-2);g.lineTo(-3,3);g.lineTo(-5,13);g.stroke();
    for(const yy of [15,21]){g.strokeStyle=p.edge;g.beginPath();g.moveTo(-13,yy);g.lineTo(12,yy);g.stroke();}g.restore();
  }
  B.weaponIcon=(g,it,f,size)=>{const p=palette(f);g.save();g.translate(size/2,size/2);fist(g,-size*.17,0,size/105,p,-.25);fist(g,size*.17,0,size/105,p,.25);g.restore();};
  B.icon=(id,f)=>{
    const key=id+':'+f;if(icons.has(key))return icons.get(key);
    const c=document.createElement('canvas');c.width=c.height=112;const g=c.getContext('2d'),p=palette(f),sk=C.ALL_SKILLS[id],i=C.CLASSES.boxer.skills.indexOf(sk);
    const bg=g.createLinearGradient(0,0,112,112);bg.addColorStop(0,p.deep);bg.addColorStop(1,'#080d14');g.fillStyle=bg;g.fillRect(0,0,112,112);
    g.save();g.translate(56,56);g.strokeStyle=p.edge;g.lineWidth=2;g.beginPath();g.arc(0,0,47,0,TAU);g.stroke();
    if(['qiCounter','qiBreath'].includes(id)){
      g.strokeStyle=p.main;g.lineWidth=4;g.beginPath();g.moveTo(-32,-33);g.quadraticCurveTo(0,-50,32,-33);g.lineTo(27,18);g.quadraticCurveTo(0,43,-27,18);g.closePath();g.stroke();
      fist(g,0,0,.7,p,id==='qiBreath'?0:-.3);
    }else if(id==='qiQuake'||id==='qiEmperor'){
      fist(g,-15,-10,.75,p,-.3);fist(g,16,-10,.75,p,.3);g.strokeStyle=p.main;
      for(let n=0;n<5;n++){g.beginPath();g.moveTo((n-2)*7,17);g.lineTo((n-2)*15,32);g.lineTo((n-2)*18,43);g.stroke();}
    }else{
      const multi=id==='qiJab'||id==='qiTempest'||id==='qiHeaven';
      if(multi)for(const side of [-1,1]){g.globalAlpha=.45;fist(g,side*29,10,.55,p,side*.6);}g.globalAlpha=1;
      fist(g,0,-3,.95,p,id==='qiKnee'?-.85:id==='qiElbow'?.85:-.25);
      g.strokeStyle=p.main;g.lineWidth=3;for(let n=0;n<2+i%3;n++){g.beginPath();g.moveTo(-39+n*10,38);g.lineTo(-29+n*10,20);g.stroke();}
    }
    g.restore();g.fillStyle=p.edge;g.font='bold 12px sans-serif';g.fillText(sk?.key||'',8,17);icons.set(key,c);return c;
  };
  B.play=d=>{
    if(d.mapId!==G.mapId)return;
    const e=G.ents.get(d.id),key=d.id+':'+d.token,spec=C.ALL_SKILLS[d.skill]?.boxer;
    if(d.phase==='cancel'||d.phase==='hit')FX.list=FX.list.filter(f=>f.boxerToken!==key);
    if(d.phase==='cancel'){if(e?.atk?.boxer?.token===d.token){e.atk=null;e.qiLockUntil=0;}return;}
    if(!spec||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
    if(e&&!e.dead&&['windup','hit'].includes(d.phase))e.atk={kind:d.skill,t0:performance.now(),dur:d.phase==='windup'?d.total+180:230,dir:C.dirFromAngle(d.a||0),a:d.a||0,boxer:{phase:d.phase,token:d.token,beat:d.beat||0}};
    if(e&&d.phase==='windup')e.qiLockUntil=performance.now()+(d.total||d.dur||0);
    const warning=d.phase==='windup',p=palette(d.f),r=d.radius||75;
    const decorations=FX.list.filter(f=>f.boxerEffect&&!f.warning);if(decorations.length>=64){const old=FX.list.indexOf(decorations[0]);FX.list.splice(old,1);}
    FX.list.push({t0:performance.now(),dur:d.dur||240,layer:warning?'ground':'top',boxerEffect:true,warning,boxerToken:warning?key:null,
      draw(g,t){
        const entity=G.ents.get(d.id);if(!entity||entity.dead)return;
        g.save();g.translate(warning?d.x:entity.x,warning?d.y:entity.y);g.lineCap='round';g.strokeStyle=p.main;
        if(warning){
          g.globalAlpha=.25+.4*t;g.lineWidth=2;
          const half=spec.kind==='cone'?Math.acos(.35):.7;
          g.beginPath();if(spec.kind==='circle')g.arc(0,0,r,0,TAU);else g.arc(0,0,r,(d.a||0)-half,(d.a||0)+half);g.stroke();
        }else if(d.phase==='guard'){
          g.globalAlpha=.45*(1-t);g.lineWidth=2;g.beginPath();g.ellipse(0,-35,36,48,0,0,TAU);g.stroke();
        }else if(d.phase==='step'){
          g.globalAlpha=.5*(1-t);g.lineWidth=3;g.beginPath();g.moveTo(d.x-entity.x,d.y-entity.y-35);g.lineTo(0,-35);g.stroke();
        }else if(d.phase==='hit'){
          g.globalAlpha=1-t;g.rotate(d.a||0);
          if(spec.kind==='circle'){
            g.lineWidth=2;g.beginPath();g.arc(0,0,r*(.35+t*.65),0,TAU);g.stroke();
            for(let n=0;n<8;n++){const a=n*TAU/8;g.beginPath();g.moveTo(Math.cos(a)*25,Math.sin(a)*25);g.lineTo(Math.cos(a+.1)*r*.55,Math.sin(a+.1)*r*.55);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();}
          }else{
            const reach=Math.min(r,d.tx===undefined?70:Math.hypot(d.tx-entity.x,d.ty-entity.y));
            g.lineWidth=5;g.beginPath();g.moveTo(16,-24);g.quadraticCurveTo(reach*.6,-40-(d.beat%2)*15,reach,-24);g.stroke();
            g.strokeStyle=p.core;g.lineWidth=1.5;
            if(d.landed)for(let n=0;n<7;n++){const a=n*TAU/7;g.beginPath();g.moveTo(reach+Math.cos(a)*7,-24+Math.sin(a)*7);g.lineTo(reach+Math.cos(a)*(15+t*15),-24+Math.sin(a)*(15+t*15));g.stroke();}
          }
          if(['qiHeaven','qiEmperor'].includes(d.skill)&&d.beat===d.hits-1){
            // One short dragon-shaped qi ribbon, no full-screen flash or persistent particle emitter.
            g.strokeStyle=p.edge;g.lineWidth=5;g.beginPath();g.moveTo(20,-20);g.bezierCurveTo(110,-110,5,-140,105,-185);g.stroke();
            g.lineWidth=2;g.beginPath();g.moveTo(105,-185);g.lineTo(121,-192);g.lineTo(119,-174);g.lineTo(139,-169);g.lineTo(114,-157);g.stroke();
          }
        }g.restore();
      }});
  };
  B.updateHUD=()=>{
    let el=document.getElementById('qiCombo');
    if(!el){el=document.createElement('div');el.id='qiCombo';el.style.cssText='font:11px Kanit,sans-serif;color:#9ce6c6;letter-spacing:3px;line-height:18px';document.querySelector('#playerFrame .mp').after(el);}
    const me=G.me;el.hidden=me?.cls!=='boxer';if(el.hidden)return;
    const n=me.dead||performance.now()>=(me.qiUntil||0)?0:me.qiStacks||0;
    const value='จังหวะหมัด '+Array.from({length:3},(_,i)=>i<n?'✊':'○').join(' ');
    if(el.textContent!==value){el.textContent=value;el.setAttribute('aria-label',`จังหวะหมัด ${n} จาก 3`);}
    el.title='ต่อท่าโจมตีต่างชนิดให้โดนภายใน 5 วิ · หมัดหนักใช้ชั้นเพิ่มพลัง';
  };
})();
