// Divine Arbiter: shared visual language for nine readable icons and authoritative skill FX.
(function () {
  const A = window.ArbiterLook, TAU = Math.PI * 2, cache = new Map();
  const clamp = v => Math.max(0, Math.min(1, v));
  const palette = f => f === 'adharma'
    ? { core:'#fff1fc', main:'#ce8aff', edge:'#ff5779', metal:'#a899c7', deep:'#40203e', bg:'#0c081a' }
    : { core:'#f5fdff', main:'#75dcff', edge:'#efca78', metal:'#b8d9ec', deep:'#154e73', bg:'#071323' };
  function line(g, points, color, width = 1.5) {
    g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y));
    g.strokeStyle=color;g.lineWidth=width;g.stroke();
  }
  function shape(g, points, fill, edge, width = 1) {
    g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();}if(edge){g.strokeStyle=edge;g.lineWidth=width;g.stroke();}
  }
  function diamond(g,x,y,r,p) {
    shape(g,[[x,y-r],[x+r*.6,y],[x,y+r],[x-r*.6,y]],p.main,p.edge,1);
    line(g,[[x,y-r*.65],[x,y+r*.5]],p.core,1.2);
  }
  function halo(g,x,y,r,p,alpha=1) {
    g.save();g.globalAlpha*=alpha;
    const grad=g.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,p.main+'80');grad.addColorStop(.45,p.main+'28');grad.addColorStop(1,p.main+'00');
    g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);g.restore();
  }
  function ring(g,r,p,angle=0,marks=8) {
    g.save();g.rotate(angle);g.strokeStyle=p.edge;g.lineWidth=1.5;
    g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();
    g.strokeStyle=p.main;g.lineWidth=.8;g.beginPath();g.arc(0,0,r*.88,0,TAU);g.stroke();
    for(let i=0;i<marks;i++){
      const a=i*TAU/marks;g.save();g.rotate(a);line(g,[[r*.92,0],[r,0]],p.core,1.5);
      if(i%2===0)diamond(g,r*.74,0,Math.min(5,r*.1),p);g.restore();
    }g.restore();
  }
  function sword(g,x,y,angle,size,p) {
    g.save();g.translate(x,y);g.rotate(angle);g.scale(size,size);
    const steel=g.createLinearGradient(-7,0,7,0);
    steel.addColorStop(0,p.deep);steel.addColorStop(.42,p.metal);steel.addColorStop(.5,p.core);steel.addColorStop(.7,p.main);steel.addColorStop(1,p.deep);
    shape(g,[[0,-62],[7,-46],[4,0],[-4,0],[-7,-46]],steel,p.edge,1.1);
    line(g,[[0,-53],[0,-7]],p.core,1.7);
    shape(g,[[-15,1],[-11,-5],[-4,-2],[0,-7],[4,-2],[11,-5],[15,1],[5,4],[-5,4]],p.edge,p.deep);
    line(g,[[0,5],[0,17]],p.deep,6);line(g,[[0,6],[0,15]],p.edge,2);
    diamond(g,0,-3,5,p);diamond(g,0,20,3,p);g.restore();
  }
  function crescent(g,r,p,angle=0,thickness=.22) {
    g.save();g.rotate(angle);
    g.beginPath();g.moveTo(r*.15,-r*.82);
    g.quadraticCurveTo(r*1.4,0,r*.15,r*.82);
    g.quadraticCurveTo(r*(1.25-thickness*2),0,r*.15,-r*.82);
    const grad=g.createLinearGradient(0,0,r,0);grad.addColorStop(0,p.main+'00');grad.addColorStop(.6,p.main+'b0');grad.addColorStop(1,p.core);
    g.fillStyle=grad;g.fill();g.strokeStyle=p.main;g.lineWidth=1;g.stroke();g.restore();
  }
  function wings(g,p,size=1,spread=0) {
    for(const side of [-1,1]){g.save();g.scale(side*size,size);g.rotate(-spread);
      for(let i=0;i<5;i++){
        const x=12+i*6,y=-6+i*5;
        shape(g,[[8,12],[x+12,y-22-i*2],[x+8,y+5],[x,y+16]],i%2?p.main:p.metal,p.edge,.7);
        line(g,[[11,10],[x+10,y-14]],p.core,.7);
      }g.restore();}
  }
  function sparks(g,p,progress,r,count=10) {
    for(let i=0;i<count;i++){
      const a=i*2.39996,dist=r*(.2+progress*.8)*( .55+(i%4)*.15);
      const x=Math.cos(a)*dist,y=Math.sin(a)*dist;
      line(g,[[x,y],[x+Math.cos(a)*7,y+Math.sin(a)*7]],i%3?p.main:p.edge,1.4);
    }
  }
  function shield(g,p,size=1) {
    g.save();g.scale(size,size);
    const grad=g.createLinearGradient(-24,0,26,0);grad.addColorStop(0,p.deep);grad.addColorStop(.5,p.metal);grad.addColorStop(1,p.deep);
    shape(g,[[0,-35],[27,-25],[23,10],[0,34],[-23,10],[-27,-25]],grad,p.edge,2);
    shape(g,[[0,-26],[18,-20],[15,7],[0,24],[-15,7],[-18,-20]],p.bg,p.main,1);
    diamond(g,0,-1,16,p);line(g,[[-15,-20],[0,-26],[15,-20]],p.core,1.5);g.restore();
  }
  A.icon = (id,faction) => {
    if(!C.CLASSES.arbiter.skills.some(s=>s.id===id))id='oathBasic';
    const f=faction==='adharma'?'adharma':'dharma',key=f+':'+id;
    if(!cache.has(key)){
      const c=document.createElement('canvas');c.width=c.height=112;const g=c.getContext('2d'),p=palette(f);
      const bg=g.createLinearGradient(0,0,112,112);bg.addColorStop(0,p.deep);bg.addColorStop(.55,p.bg);bg.addColorStop(1,'#03060c');
      g.fillStyle=bg;g.fillRect(0,0,112,112);g.save();g.beginPath();g.rect(5,5,102,102);g.clip();
      g.translate(56,56);g.lineCap='round';g.lineJoin='round';halo(g,0,0,66,p);
      g.save();g.globalAlpha=.16;ring(g,43,p,.18,12);line(g,[[-48,36],[45,-38]],p.main,9);g.restore();
      g.shadowColor=p.main;g.shadowBlur=5;
      switch(id){
        case 'oathBasic': sword(g,-5,19,.55,.91,p);line(g,[[21,-28],[30,-35]],p.edge,2);break;
        case 'oathSlash': crescent(g,46,p,-.6,.34);sword(g,-8,13,.68,.86,p);sparks(g,p,.5,50,6);break;
        case 'oathResonance':
          ring(g,34,p,-Math.PI/2,10);diamond(g,0,0,21,p);
          for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;diamond(g,Math.cos(a)*34,Math.sin(a)*34,8,p);}break;
        case 'arcblade':
          g.rotate(-.45);for(let i=0;i<3;i++){g.save();g.translate(-28+i*20,0);crescent(g,40-i*5,p,0,.3);g.restore();}break;
        case 'astralBlades':
          g.save();g.scale(1,.6);ring(g,41,p,.4,8);g.restore();
          sword(g,-25,16,-.25,.62,p);sword(g,25,16,.25,.62,p);sword(g,0,25,0,.92,p);break;
        case 'oathAegis': shield(g,p,1.14);break;
        case 'bladeOrbit':
          ring(g,28,p,0,8);diamond(g,0,0,9,p);
          for(let i=0;i<4;i++){const a=i*TAU/4+.3;sword(g,Math.cos(a)*29,Math.sin(a)*29,a+Math.PI,.45,p);}break;
        case 'ascendantForm':
          wings(g,p,1,0);halo(g,0,-7,32,p);diamond(g,0,1,18,p);
          g.save();g.translate(0,-29);g.scale(1,.35);ring(g,22,p,0,6);g.restore();
          shape(g,[[-11,-22],[-14,-35],[-4,-29],[0,-40],[4,-29],[14,-35],[11,-22]],p.edge,p.core,.8);break;
        case 'finalVerdict':
          g.save();g.translate(0,28);g.scale(1,.35);ring(g,41,p,0,12);g.restore();
          line(g,[[-16,-48],[-16,15]],p.main+'80',3);line(g,[[17,-48],[17,15]],p.edge+'80',2);
          sword(g,0,-19,Math.PI,1,p);halo(g,0,31,24,p);sparks(g,p,.7,43,8);break;
      }
      g.restore();g.shadowBlur=0;
      const border=g.createLinearGradient(0,0,112,112);border.addColorStop(0,p.edge);border.addColorStop(.45,p.metal);border.addColorStop(.7,p.deep);border.addColorStop(1,p.edge);
      g.strokeStyle=border;g.lineWidth=2;g.strokeRect(2.5,2.5,107,107);
      g.strokeStyle=p.edge+'55';g.lineWidth=1;g.strokeRect(6.5,6.5,99,99);
      for(const [x,y,a] of [[5,5,0],[107,5,Math.PI/2],[107,107,Math.PI],[5,107,-Math.PI/2]]){
        g.save();g.translate(x,y);g.rotate(a);shape(g,[[0,0],[14,0],[5,5],[0,14]],p.edge,p.bg);g.restore();
      }cache.set(key,c);
    }
    // DOM consumers need their own element; only the expensive artwork is cached.
    const c=document.createElement('canvas');c.width=c.height=112;c.getContext('2d').drawImage(cache.get(key),0,0);return c;
  };

  A.play = d => {
    const key=d.id+':'+d.token,sk=C.ALL_SKILLS[d.skill],spec=sk?.arbiter;
    if(d.phase==='cancel'||d.phase==='release')FX.list=FX.list.filter(f=>f.arbiterToken!==key);
    if(d.phase==='cancel'||!spec||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
    const p=palette(d.f),rank=Math.max(0,Math.min(2,d.r||0));
    const warning=d.phase==='windup'&&spec.kind==='verdict',windup=d.phase==='windup';
    const follow=['ward','form','resonance','blades'].includes(d.phase),persistent=['ward','form'].includes(d.phase);
    const duration=Math.max(1,d.dur||400),radius=Math.max(1,d.radius||spec.radius||spec.range||60);
    let ended=false;
    if(follow)FX.list=FX.list.filter(f=>!(f.arbiterEffect&&f.owner===d.id&&f.skill===d.skill&&f.follow));
    // Decorations are bounded; never evict an authoritative ground warning to make room for a flash.
    if(FX.list.filter(f=>f.arbiterEffect&&!f.warning).length>=96){
      const i=FX.list.findIndex(f=>f.arbiterEffect&&!f.warning);if(i>=0)FX.list.splice(i,1);
    }
    FX.list.push({t0:performance.now(),dur:duration,layer:warning?'ground':'top',arbiterEffect:true,
      owner:d.id,skill:d.skill,follow,warning,arbiterToken:windup?key:null,
      draw(g,progress){
        const t=clamp(progress),out=1-t,ease=1-Math.pow(out,3),entity=window.G?.ents?.get(d.id);
        if(follow&&entity?.dead || persistent&&!entity)ended=true;
        if(ended)return;
        g.save();g.translate(follow&&entity?entity.x:d.x,follow&&entity?entity.y:d.y);
        g.lineCap='round';g.lineJoin='round';
        if(warning){
          // This circle is in world coordinates, not a perspective ellipse: it is the actual server hit area.
          g.fillStyle=p.main+'16';g.beginPath();g.arc(0,0,radius,0,TAU);g.fill();
          ring(g,radius,p,0,12);g.strokeStyle=p.core;g.lineWidth=3;
          g.beginPath();g.arc(0,0,radius-5,-Math.PI/2,-Math.PI/2+TAU*t);g.stroke();
          g.globalAlpha*=.35+.45*t;g.save();g.rotate(-t*.5);ring(g,radius*.48,p,0,6);g.restore();
          diamond(g,0,0,18+6*t,p);g.restore();return;
        }
        g.globalAlpha*=persistent?Math.min(1,t*20,out*8)*.65:windup?.3+.6*t:Math.min(1,out*3);
        if(windup){
          g.rotate(d.a||0);halo(g,28,-14,35,p,t);crescent(g,36+12*t,p,0,.12);g.restore();return;
        }
        if(follow){
          const seconds=t*duration/1000;
          if(d.phase==='ward'){
            g.save();g.scale(1,.35);ring(g,49,p,seconds*.25,8);g.restore();
            for(let i=0;i<3;i++){const a=seconds*.8+i*TAU/3;g.save();g.translate(Math.cos(a)*45,-48+Math.sin(a)*11);g.scale(.65,.8);shield(g,p,.65);g.restore();}
          }else if(d.phase==='form'){
            // The model owns the painted wings and crest. One ground seal avoids duplicate wings over the face.
            g.save();g.scale(1,.32);g.globalAlpha*=.6;ring(g,43+rank*3,p,seconds*.16,6);g.restore();
            for(let i=0;i<6;i++){const h=(seconds*19+i*23)%112;diamond(g,(i%2?1:-1)*(35+i*3),-h,1.5,p);}
          }else if(d.phase==='resonance'){
            g.translate(0,-44);halo(g,0,0,58,p);ring(g,24+ease*17,p,t*.4,10);
            for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;diamond(g,Math.cos(a)*33,Math.sin(a)*33,6+ease*2,p);}
          }else{
            g.translate(0,-35);for(let i=0;i<3;i++)sword(g,(i-1)*35,-ease*18,((i-1)*.3),.55+ease*.12,p);
            sparks(g,p,ease,70,8);
          }
        }else if(d.phase==='astral'){
          g.translate(0,-22);g.rotate(-.45);sword(g,0,-32+ease*48,Math.PI,.7,p);crescent(g,40,p,t*.4,.2);
        }else if(d.phase==='release'){
          if(spec.kind==='verdict'){
            // The impact appears immediately after server damage; the remaining motion is a short afterglow.
            g.save();g.globalAlpha*=out;ring(g,radius,p,0,12);g.restore();
            halo(g,0,-12,radius*.7,p,out);g.save();g.scale(1,.4);ring(g,radius*(.65+.35*ease),p,t*.2,12);g.restore();
            g.save();g.globalAlpha*=out;sword(g,0,-105+ease*12,Math.PI,1.7+rank*.15,p);g.restore();
            for(let i=0;i<6+rank*2;i++){const a=i*TAU/(6+rank*2),r=radius*.65;line(g,[[Math.cos(a)*r,Math.sin(a)*r-100*out],[Math.cos(a)*r,Math.sin(a)*r]],i%2?p.main:p.edge,2);}
            sparks(g,p,ease,radius,14);
          }else if(spec.kind==='circle'){
            ring(g,radius*(.7+.3*ease),p,t*.8,12);
            for(let i=0;i<4+rank;i++){const a=t*1.4+i*TAU/(4+rank);g.save();g.translate(Math.cos(a)*radius*.65,Math.sin(a)*radius*.65);sword(g,0,0,a+Math.PI/2,.65,p);g.restore();}
            sparks(g,p,ease,radius,12);
          }else if(spec.kind==='line'||d.wave){
            g.rotate(d.a||0);const width=Math.max(8,d.width||24),x=radius*ease;
            const trail=g.createLinearGradient(Math.max(0,x-110),0,x+1,0);trail.addColorStop(0,p.main+'00');trail.addColorStop(1,p.main+'90');
            shape(g,[[Math.max(0,x-110),-width*.5],[x,-width],[x,width],[Math.max(0,x-110),width*.5]],trail);
            g.translate(x,0);g.scale(.6,1);crescent(g,width*1.2,p,0,.35);line(g,[[-20,0],[4,0]],p.core,2);
          }else{
            g.rotate(d.a||0);const r=spec.kind==='basic'?70:90;
            g.translate(0,-14);crescent(g,r,p,(t-.5)*.7,.23+rank*.06);
            if(spec.kind==='single'){g.save();g.globalAlpha*=.4;crescent(g,r*.78,p,-.25,.16);g.restore();}
            if((d.combo||0)===0&&spec.kind==='basic')line(g,[[24,-25],[73,22]],p.edge,2);
            g.translate(r*.65,0);sparks(g,p,ease,33,6+rank*2);
          }
        }
        g.restore();
      }});
  };
  A.levelUp=(id,faction,from,to)=>{
    const entity=window.G?.ents?.get(id);if(!entity)return;
    const p=palette(faction||entity.faction),evolved=C.arbiterStage(to)>C.arbiterStage(from),duration=evolved?1900:1150;
    FX.list=FX.list.filter(f=>!(f.arbiterLevel&&f.owner===id));
    let ended=false;
    for(const layer of ['ground','top'])FX.list.push({t0:performance.now(),dur:duration,layer,arbiterEffect:true,arbiterLevel:true,owner:id,
      draw(g,progress){
        const e=window.G?.ents?.get(id);if(!e||e.dead)ended=true;if(ended)return;
        const t=clamp(progress),fade=Math.min(1,t*8,(1-t)*3),ease=1-Math.pow(1-t,3);
        g.save();g.translate(e.x,e.y);g.globalAlpha*=fade;
        if(layer==='ground'){
          g.save();g.scale(1,.34);g.globalAlpha*=.7;ring(g,24+ease*(evolved?39:22),p,t*.18,6);g.restore();
        }else{
          // Slender side ribbons and rising motes frame the character instead of a solid light column.
          for(const side of [-1,1]){
            const x=side*(evolved?36:26),height=(evolved?150:110)*ease;
            const grad=g.createLinearGradient(x,-height,x,0);grad.addColorStop(0,p.main+'00');grad.addColorStop(.65,p.main+'55');grad.addColorStop(1,p.edge+'00');
            g.strokeStyle=grad;g.lineWidth=3;g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x+side*12,-height*.3,x-side*7,-height*.75,x,-height);g.stroke();
          }
          for(let i=0;i<(evolved?14:8);i++){
            const h=(t*(evolved?165:120)+i*17)%150,x=Math.sin(i*2.4)*43;
            g.save();g.globalAlpha*=Math.sin(h/150*Math.PI);diamond(g,x,-h,i%3?1.5:2.5,p);g.restore();
          }
        }g.restore();
      }});
    FX.text(entity.x,entity.y-118,evolved?'วิวัฒนาการ · Lv.'+to:'Lv.'+to,p.edge,evolved?22:18,{max:duration,vy:-18});
  };
})();
