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
        case 'oathFirmament': {
          const pts=Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*TAU/6;return [Math.cos(a)*36,Math.sin(a)*36];});
          for(const k of [0,1])line(g,[pts[k],pts[k+2],pts[k+4],pts[k]],k?p.edge:p.main,2);
          sword(g,0,-24,Math.PI,.95,p);for(const [x,y] of pts)diamond(g,x,y,4,p);break;
        }
        case 'oathGenesis':
          wings(g,p,1.2,.1);halo(g,0,-4,40,p);
          for(let i=-1;i<=1;i++)sword(g,i*24,-30+Math.abs(i)*12,Math.PI,.5,p);
          sword(g,0,-14,Math.PI,1.05,p);g.save();g.translate(0,32);g.scale(1,.3);ring(g,34,p,0,10);g.restore();break;
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

  // Combat V4: tapered silk-light trails, prismatic petals and restrained bloom.
  // No random values per frame: strands stay attached to the motion instead of flickering.
  function ribbon(g,p,r,start,sweep,width,flatten=1) {
    const point=(u,inner)=>{
      const a=start+sweep*u,body=Math.pow(Math.sin(Math.PI*u),.7),rr=r-(inner?width*body:0);
      return [Math.cos(a)*rr,Math.sin(a)*rr*flatten];
    };
    const grad=g.createLinearGradient(-r,-r*flatten,r,r*flatten);
    grad.addColorStop(0,p.edge+'00');grad.addColorStop(.28,p.edge+'90');grad.addColorStop(.65,p.main+'dd');grad.addColorStop(1,p.core);
    g.save();g.beginPath();for(let i=0;i<=32;i++){const [x,y]=point(i/32,false);i?g.lineTo(x,y):g.moveTo(x,y);}
    g.strokeStyle=grad;g.lineWidth=7;g.globalAlpha*=.22;g.shadowColor=p.main;g.shadowBlur=9;g.stroke();g.restore();
    g.beginPath();for(let i=0;i<=32;i++){const [x,y]=point(i/32,false);i?g.lineTo(x,y):g.moveTo(x,y);}
    for(let i=32;i>=0;i--){const [x,y]=point(i/32,true);g.lineTo(x,y);}g.closePath();g.fillStyle=grad;g.fill();
    g.beginPath();for(let i=4;i<31;i++){const [x,y]=point(i/32,false);i===4?g.moveTo(x,y):g.lineTo(x,y);}
    g.strokeStyle=p.core;g.lineWidth=1.25;g.stroke();
    g.beginPath();for(let i=0;i<=28;i++){const a=start+sweep*i/32;const x=Math.cos(a)*(r+5),y=Math.sin(a)*(r+5)*flatten;i?g.lineTo(x,y):g.moveTo(x,y);}
    g.strokeStyle=p.edge+'95';g.lineWidth=.7;g.stroke();
  }
  function star(g,x,y,size,p,angle=0) {
    g.save();g.translate(x,y);g.rotate(angle);halo(g,0,0,size*2.4,p,.65);
    shape(g,[[0,-size], [size*.17,-size*.17],[size*.62,0],[size*.17,size*.17],[0,size],[-size*.17,size*.17],[-size*.62,0],[-size*.17,-size*.17]],p.core);
    g.restore();
  }
  function petal(g,p,x,y,angle,size,alpha=1) {
    g.save();g.translate(x,y);g.rotate(angle);g.globalAlpha*=alpha;
    const grad=g.createLinearGradient(0,0,0,-size);grad.addColorStop(0,p.main+'00');grad.addColorStop(.5,p.main+'55');grad.addColorStop(1,p.core+'dd');
    g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-size*.48,-size*.35,-size*.16,-size*.84,0,-size);
    g.bezierCurveTo(size*.33,-size*.66,size*.4,-size*.27,0,0);g.fillStyle=grad;g.fill();
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(size*.12,-size*.54,0,-size);g.strokeStyle=p.edge+'bb';g.lineWidth=.9;g.stroke();g.restore();
  }
  function motes(g,p,t,r,count=12,lift=0) {
    for(let i=0;i<count;i++){
      const a=i*2.39996,dist=r*(.25+.7*t)*(.6+(i%4)*.12),x=Math.cos(a)*dist,y=Math.sin(a)*dist*.65-lift*t;
      g.save();g.globalAlpha*=Math.sin(Math.PI*clamp((1-t)*1.3))*(.5+(i%3)*.2);
      if(i%4===0)star(g,x,y,3+i%3,p,a);else petal(g,p,x,y,a+t,6+i%5);g.restore();
    }
  }
  function lance(g,p,height,width) {
    const grad=g.createLinearGradient(0,-height,0,0);grad.addColorStop(0,p.main+'00');grad.addColorStop(.4,p.main+'60');grad.addColorStop(.88,p.core);grad.addColorStop(1,p.edge);
    shape(g,[[-width,-height],[width,-height],[width*.55,-height*.2],[0,0],[-width*.55,-height*.2]],grad);
    line(g,[[0,-height*.86],[0,-height*.1]],p.core,1.8);
    for(const s of [-1,1])line(g,[[s*width*2.3,-height*.88],[s*width*1.5,-height*.35]],p.main+'90',.8);
  }

  A.play = d => {
    const key=d.id+':'+d.token,sk=C.ALL_SKILLS[d.skill],spec=sk?.arbiter;
    if(d.phase==='cancel'||d.phase==='release')FX.list=FX.list.filter(f=>f.arbiterToken!==key);
    if(d.phase==='cancel'||!spec||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;
    const p=palette(d.f),rank=Math.max(0,Math.min(2,d.r||0));
    const warning=d.phase==='windup'&&spec.kind==='verdict',windup=d.phase==='windup';
    const follow=['ward','form','resonance','blades'].includes(d.phase),persistent=['ward','form'].includes(d.phase);
    // Only the release afterglow gets more time. Authoritative windup and buff lifetimes are untouched.
    const afterglow=d.phase==='release'?(spec.kind==='verdict'?800:spec.kind==='circle'?550:400):0;
    const duration=Math.max(1,d.dur||400,afterglow),radius=Math.max(1,d.radius||spec.radius||spec.range||60);
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
          // The outer circle remains the exact server hit area, with a filling timing rim.
          const wash=g.createRadialGradient(0,0,radius*.15,0,0,radius);
          wash.addColorStop(0,p.main+'00');wash.addColorStop(.82,p.main+'08');wash.addColorStop(1,p.edge+'38');
          g.fillStyle=wash;g.beginPath();g.arc(0,0,radius,0,TAU);g.fill();
          g.strokeStyle=p.edge;g.lineWidth=1.5;g.stroke();g.strokeStyle=p.core;g.lineWidth=2.5;
          g.beginPath();g.arc(0,0,radius-4,-Math.PI/2,-Math.PI/2+TAU*t);g.stroke();
          for(let i=0;i<6;i++){const a=i*TAU/6;const x=Math.cos(a)*radius*.83,y=Math.sin(a)*radius*.83;
            petal(g,p,x,y,a-Math.PI/2,18+18*t,.4+.5*t);}
          g.save();g.rotate(t*.25);shape(g,[[0,-30],[26,15],[-26,15]],null,p.main+'99');
          shape(g,[[0,30],[26,-15],[-26,-15]],null,p.edge+'99');g.restore();star(g,0,0,9+9*t,p);
          g.restore();return;
        }
        g.globalAlpha*=persistent?Math.min(1,t*20,out*8)*.65:windup?.3+.6*t:Math.min(1,out*3);
        if(windup){
          g.translate(0,-18);g.rotate(d.a||0);
          ribbon(g,p,40+22*(1-t),-1.6+t*.5,1.8,3+5*t,.65);
          for(let i=0;i<5;i++){const a=i*2.39996,r=65*(1-t)+12;star(g,Math.cos(a)*r,Math.sin(a)*r*.6,1+2*t,p);}
          g.restore();return;
        }
        if(follow){
          const seconds=t*duration/1000;
          if(d.phase==='ward'){
            // A translucent lotus shell: open at the face, strongest along the silhouette.
            g.save();g.translate(0,-39);
            for(let i=0;i<7;i++){const a=i*TAU/7+seconds*.22,x=Math.cos(a)*43,y=Math.sin(a)*17+35;
              petal(g,p,x,y,Math.cos(a)*.5,66+Math.sin(a)*12,.55+.3*Math.sin(a));}
            ribbon(g,p,53,seconds*.4,Math.PI*1.45,4,.36);g.restore();
            star(g,0,-104,8,p,Math.sin(seconds)*.1);
          }else if(d.phase==='form'){
            // The model owns its wings. Ascending silk and a crown frame them without covering the torso.
            for(const side of [-1,1]){
              g.save();g.translate(side*49,-38);g.scale(side,1);
              ribbon(g,p,55,-1.6+Math.sin(seconds*.7)*.15,2.3,9,.85);g.restore();
              for(let i=0;i<4;i++){const h=(seconds*25+i*31)%136;petal(g,p,side*(38+h*.15),-h,side*.45,11,Math.sin(h/136*Math.PI));}
            }
            g.save();g.translate(0,-115);ribbon(g,p,23,Math.PI,Math.PI,4,.4);star(g,0,-9,7,p);g.restore();
          }else if(d.phase==='resonance'){
            g.translate(0,-48);halo(g,0,0,52,p,.4);
            const pts=[];for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2+t*.3;pts.push([Math.cos(a)*(28+ease*16),Math.sin(a)*(28+ease*16)]);}
            line(g,[pts[0],pts[2],pts[4],pts[1],pts[3],pts[0]],p.edge+'80',.8);
            for(const [x,y]of pts)star(g,x,y,6+Math.sin(t*Math.PI)*3,p);
            ribbon(g,p,54,-t*2,Math.PI*1.25,7,.7);motes(g,p,t,75,10,20);
          }else{
            // Summoning: three descending needles assemble into the model's orbiting blades.
            for(let i=0;i<3;i++){g.save();g.translate((i-1)*37,-45-Math.sin(i+1)*15);g.rotate((i-1)*.3);
              lance(g,p,65,5);star(g,0,0,9,p);g.restore();}
            ribbon(g,p,64,t*1.2,Math.PI*1.7,6,.3);motes(g,p,t,80,10,35);
          }
        }else if(d.phase==='step'){
          // ฟันคำสัตย์'s dash: a ribbon of light from the old spot to the new one
          const dx=(d.x1??d.x)-d.x,dy=(d.y1??d.y)-d.y,L=Math.hypot(dx,dy);g.translate(0,-26);g.rotate(Math.atan2(dy,dx));
          const trail=g.createLinearGradient(0,0,Math.max(1,L),0);trail.addColorStop(0,p.main+'00');trail.addColorStop(.7,p.main+'90');trail.addColorStop(1,p.core);
          g.globalAlpha*=out;shape(g,[[0,-2],[L*ease,-9],[L*ease+14,0],[L*ease,9],[0,2]],trail);
          for(let i=1;i<5;i++)star(g,L*ease*i/5,Math.sin(i*2.1)*7,3,p);
        }else if(d.phase==='astral'){
          g.translate(0,-8);g.rotate(-.45);lance(g,p,90*(1-t*.4),7);star(g,0,0,18*out+4,p);motes(g,p,t,47,8);
        }else if(d.phase==='release'){
          if(spec.kind==='verdict'){
            // Damage lands on release: the lance is already touching the ground at t=0.
            halo(g,0,-8,radius*.62,p,out*.65);
            g.save();g.globalAlpha*=out;lance(g,p,240+rank*25,15+rank*3);
            g.translate(0,-120);line(g,[[-41,-12],[-23,0],[23,0],[41,-12]],p.edge,2);
            star(g,0,0,13,p);g.restore();
            star(g,0,-3,36*out+9,p,Math.PI/2);
            for(let i=0;i<3;i++)ribbon(g,p,radius*(.38+.58*ease)-i*10,i*TAU/3+t*.2,1.8,12*out+2,.42);
            for(let i=0;i<8;i++){const a=i*TAU/8;petal(g,p,Math.cos(a)*radius*.72*ease,Math.sin(a)*radius*.3*ease,a+Math.PI/2,36*out+12);}
            motes(g,p,t,radius,22,30);
          }else if(spec.kind==='circle'){
            for(let i=0;i<3;i++){
              const a=i*TAU/3+ease*2.5,r=radius*(.65+.3*ease);
              ribbon(g,p,r,a,1.8,15+rank*3,.66);
              star(g,Math.cos(a+1.8)*r,Math.sin(a+1.8)*r*.66,7,p,a);
            }motes(g,p,t,radius,18);
          }else if(spec.kind==='line'||d.wave){
            g.rotate(d.a||0);const width=Math.max(8,d.width||24),x=radius*ease;
            for(const side of [-1,1]){
              const trail=g.createLinearGradient(0,0,Math.max(1,x),0);trail.addColorStop(0,p.main+'00');trail.addColorStop(.8,p.main+'65');trail.addColorStop(1,p.core);
              g.beginPath();g.moveTo(0,side*width*.2);g.bezierCurveTo(x*.4,side*width*.1,x*.8,side*width,x,0);
              g.bezierCurveTo(x*.72,side*width*.45,x*.3,0,0,side*width*.2);g.fillStyle=trail;g.fill();
            }
            g.translate(x,0);ribbon(g,p,width*1.12,-1.5,3,8+rank*2,1);star(g,width*.3,0,10,p,Math.PI/2);
            motes(g,p,t,width*1.4,8);
          }else{
            g.rotate(d.a||0);const basic=spec.kind==='basic',r=basic?78:103,flip=(d.combo||0)%2?-1:1;
            g.translate(0,-14);g.scale(1,flip);
            const a=-1.75+ease*.7;
            ribbon(g,p,r,a,2.2,basic?12:23,.74);
            if(basic&&(d.combo||0)===0){g.save();g.globalAlpha*=.45;ribbon(g,p,r*.82,-a-2.2,2.2,8,.74);g.restore();}
            if(!basic){g.save();g.globalAlpha*=.55;ribbon(g,p,r*.83,a-.35,2.5,9,.74);g.restore();}
            star(g,Math.cos(a+2.2)*r,Math.sin(a+2.2)*r*.74,basic?7:12,p);
            g.translate(r*.68,0);motes(g,p,t,basic?35:54,basic?7:13);
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
