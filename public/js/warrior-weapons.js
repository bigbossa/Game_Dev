// Sword-and-shield item art. Tier IDs are saved item IDs, not level order (w13 is Lv.110).
(function () {
  const W = window.WarriorWeapons = {}, TAU = Math.PI * 2;
  const TYPES = ['training','steel','crescent','wind','sky','jade','thunder','dragon','tide','flame','heaven','emperor','primordial','sunmoon'];
  const SHAPES = [
    [[-25,-26],[0,-32],[25,-26],[28,13],[0,34],[-28,13]],
    [[-26,-30],[26,-30],[26,14],[0,37],[-26,14]],
    [[-27,-25],[-10,-36],[10,-36],[27,-25],[22,14],[0,38],[-22,14]],
    [[-28,-30],[0,-39],[28,-30],[21,14],[0,39],[-21,14]],
    [[-32,-34],[-14,-29],[0,-42],[14,-29],[32,-34],[25,13],[0,39],[-25,13]],
    [[-29,-27],[-13,-39],[13,-39],[29,-27],[25,16],[0,39],[-25,16]],
    [[-29,-31],[-11,-24],[0,-43],[11,-24],[29,-31],[22,-5],[29,7],[0,40],[-29,7],[-22,-5]],
    [[-31,-30],[-19,-43],[-10,-32],[0,-40],[10,-32],[19,-43],[31,-30],[26,17],[0,40],[-26,17]],
    [[-30,-23],[-25,-36],[-10,-30],[0,-40],[10,-30],[25,-36],[30,-23],[23,18],[0,40],[-23,18]],
    [[-30,-26],[-27,-43],[-13,-31],[0,-46],[13,-31],[27,-43],[30,-26],[24,18],[0,40],[-24,18]],
    [[-33,-34],[-19,-30],[-12,-44],[0,-36],[12,-44],[19,-30],[33,-34],[27,15],[12,26],[0,42],[-12,26],[-27,15]],
    [[-31,-31],[-20,-43],[-8,-35],[0,-48],[8,-35],[20,-43],[31,-31],[25,16],[0,42],[-25,16]],
    [[-33,-30],[-27,-44],[-14,-34],[0,-49],[14,-34],[27,-44],[33,-30],[29,17],[16,25],[0,43],[-16,25],[-29,17]],
    [[-29,-30],[-12,-39],[0,-32],[12,-39],[29,-30],[27,14],[14,29],[0,39],[-14,29],[-27,14]]
  ];
  const LIGHT = ['#876340','#657d92','#9caed9','#3d91b4','#82bce5','#268e71','#7978d7','#c9983c','#429cae','#8d60bf','#d2bb76','#68b9c8','#e4c475','#5cb99b'];
  const DARK = ['#76503d','#765868','#ae8b99','#a94e69','#c36e7c','#88515d','#a653aa','#ae793e','#8b62a1','#c74c86','#754457','#9b68bb','#a14963','#bf749e'];
  W.design = (tier, faction) => {
    const t = Math.max(0, Math.min(13, Number.isFinite(tier) ? Math.trunc(tier) : 0));
    const dark = faction === 'adharma';
    return { tier:t, type:TYPES[t], shape:SHAPES[t], main:(dark ? DARK : LIGHT)[t],
      deep:dark ? '#271520' : '#132c3c', edge:t<2 ? '#a4a6a1' : t<5 ? '#c7d7e6' : '#e1b864',
      light:dark ? '#ffdecd' : '#f4f9f2', gem:dark ? '#f091bb' : '#a4f3ed' };
  };
  const path = (g, points) => { g.beginPath(); points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); };
  const line = (g, points, color, width=2) => { g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.stroke(); };
  const circle = (g,x,y,r,fill,edge) => {g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(edge){g.strokeStyle=edge;g.lineWidth=1.5;g.stroke();}};
  const diamond = (g,x,y,r,p) => {path(g,[[x,y-r],[x+r*.65,y],[x,y+r],[x-r*.65,y]]);g.fillStyle=p.gem;g.fill();g.strokeStyle=p.edge;g.lineWidth=1.5;g.stroke();line(g,[[x,y-r+2],[x,y+r-2]],p.light,1);};
  function crest(g,p) {
    const t=p.tier;
    if(t===0){for(const x of [-16,-6,6,16])line(g,[[x,-24],[x,24-Math.abs(x)*.5]],'#4c382b',1.5);circle(g,0,0,10,'#6c747c',p.edge);circle(g,-3,-3,3,'#bdc2c1');}
    else if(t===1){line(g,[[-15,0],[15,0]],p.edge,5);line(g,[[0,-23],[0,23]],p.edge,5);diamond(g,0,0,7,p);}
    else if(t===2){g.beginPath();g.arc(0,0,19,-1.35,1.35);g.arc(-9,0,15,1.15,-1.15,true);g.closePath();g.fillStyle=p.edge;g.fill();diamond(g,-9,-12,5,p);}
    else if(t===3){for(let i=0;i<3;i++){g.beginPath();g.moveTo(-18,-15+i*13);g.bezierCurveTo(20,-32+i*13,-22,10+i*13,18,-5+i*13);g.strokeStyle=p.edge;g.lineWidth=3;g.stroke();}}
    else if(t===4){for(const s of [-1,1])for(let i=0;i<3;i++)line(g,[[0,12-i*6],[s*(18-i*3),-12-i*6]],p.edge,3);diamond(g,0,-7,9,p);}
    else if(t===5){path(g,[[0,-25],[17,-8],[12,14],[0,25],[-12,14],[-17,-8]]);g.fillStyle=p.deep;g.fill();g.strokeStyle=p.edge;g.lineWidth=3;g.stroke();diamond(g,0,0,16,p);}
    else if(t===6){path(g,[[4,-29],[-16,4],[-2,4],[-8,29],[17,-8],[3,-8]]);g.fillStyle=p.light;g.fill();g.strokeStyle=p.edge;g.lineWidth=1;g.stroke();}
    else if(t===7||t===10){
      for(const s of [-1,1]){line(g,[[s*6,-14],[s*13,-25],[s*16,-16],[s*10,-4]],p.edge,3);line(g,[[s*8,0],[s*18,5],[s*11,15],[s*5,19]],p.edge,2);}
      path(g,[[-11,-9],[0,-17],[11,-9],[7,12],[0,22],[-7,12]]);g.fillStyle=p.edge;g.fill();
      line(g,[[-8,-5],[-3,-2]],p.deep,3);line(g,[[8,-5],[3,-2]],p.deep,3);diamond(g,0,6,6,p);
      if(t===10)circle(g,0,-22,5,p.gem,p.edge);
    } else if(t===8){for(let i=0;i<3;i++){g.beginPath();g.moveTo(-19,-13+i*13);g.bezierCurveTo(-6,-26+i*13,6,i*13,19,-13+i*13);g.strokeStyle=i===1?p.light:p.edge;g.lineWidth=3;g.stroke();}circle(g,0,-24,4,p.gem);}
    else if(t===9){path(g,[[0,-29],[10,-8],[14,-16],[20,5],[12,23],[0,29],[-15,18],[-19,0],[-8,8]]);g.fillStyle=p.edge;g.fill();path(g,[[0,-8],[8,9],[0,22],[-7,9]]);g.fillStyle=p.gem;g.fill();}
    else if(t===11){for(const x of [-11,0,11])diamond(g,x,x===0?-3:2,x===0?23:14,p);line(g,[[-19,20],[0,29],[19,20]],p.edge,2);}
    else if(t===12){circle(g,0,0,24,null,p.edge);for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3;diamond(g,Math.cos(a)*15,Math.sin(a)*15,10,p);}circle(g,0,0,5,p.light,p.edge);}
    else {circle(g,0,0,24,null,p.edge);circle(g,-9,-2,9,p.edge);g.beginPath();g.arc(7,5,13,-1.3,1.3);g.arc(1,5,10,1.2,-1.2,true);g.closePath();g.fillStyle=p.light;g.fill();diamond(g,0,-22,5,p);}
  }
  W.shield = (g,p) => {
    const gr=g.createLinearGradient(-30,-35,28,35);gr.addColorStop(0,p.light);gr.addColorStop(.23,p.edge);gr.addColorStop(.7,p.deep);gr.addColorStop(1,p.edge);
    path(g,p.shape);g.fillStyle=gr;g.fill();g.strokeStyle='#11151e';g.lineWidth=2.3;g.stroke();
    g.save();g.scale(.84,.86);path(g,p.shape);const face=g.createLinearGradient(-20,-30,22,28);face.addColorStop(0,p.main);face.addColorStop(.5,p.deep);face.addColorStop(1,p.main);g.fillStyle=face;g.fill();g.strokeStyle=p.edge;g.lineWidth=1.4;g.stroke();g.restore();
    crest(g,p);
    for(const s of [-1,1])for(const y of [-21,-8,7])circle(g,s*(22-Math.max(0,y)*.2),y,1.3,p.light);
  };
  W.sword = (g,p) => {
    const t=p.tier,w=4+(t>=5?1:0)+(t>=10?1:0),len=60+(t>=6?6:0);
    let points=[[-w,0],[-w,-len+14],[0,-len],[w+2,-len+17],[w,0]];
    if([2,3,8,13].includes(t))points=[[-w,0],[-w+2,-len+22],[6,-len],[w+7,-len+15],[w+2,-len+34],[w,0]];
    if(t===6)points=[[-w,0],[-w,-20],[-w-3,-27],[-w,-35],[-w-3,-43],[0,-len],[w+2,-len+20],[w,-34],[w+3,-26],[w,0]];
    if(t===9||t===12)points=[[-w,0],[-w-3,-20],[-w,-32],[-w-2,-43],[0,-len],[w+2,-43],[w,-32],[w+3,-20],[w,0]];
    path(g,points);const steel=g.createLinearGradient(-w,0,w+3,0);steel.addColorStop(0,p.main);steel.addColorStop(.48,p.light);steel.addColorStop(.62,'#9aadb9');steel.addColorStop(1,p.deep);g.fillStyle=steel;g.fill();g.strokeStyle=p.edge;g.lineWidth=1.4;g.stroke();
    line(g,[[0,-5],[0,-len+12]],t<3?'#526b7f':p.main,1.5);
    if(t>=5)for(let y=-15;y>-len+18;y-=10)diamond(g,0,y,2,p);
    line(g,[[-12,-2],[-8,3],[0,4],[8,3],[12,-2]],p.deep,6);line(g,[[-12,-2],[-8,3],[0,4],[8,3],[12,-2]],p.edge,3.5);
    line(g,[[0,6],[0,21]],'#251d1c',7);line(g,[[0,6],[0,21]],p.main,4);
    for(let y=8;y<20;y+=4)line(g,[[-2,y],[2,y+2]],p.edge,1);
    if(t>=3)diamond(g,0,24,5,p);else circle(g,0,24,4,p.edge,p.deep);
  };
  W.icon = (g,tier,faction,size=128) => {
    const p=W.design(tier,faction);g.save();g.scale(size/128,size/128);g.lineCap='round';g.lineJoin='round';
    // One large shield and one short dao stay recognizable at 32px inventory size.
    g.save();g.translate(48,65);g.rotate(-.12);W.shield(g,p);g.restore();
    g.save();g.translate(88,86);g.rotate(.39);W.sword(g,p);g.restore();g.restore();
  };
})();
