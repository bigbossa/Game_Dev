// One set of sharp, faceted spearheads for held models and inventory icons.
// Coordinates: socket at 0, tip at +1; transverse coordinates scale by width.
(function () {
  const S = window.SpearWeapon = {}, TAU = Math.PI * 2;
  const SHAPES = [
    [[-.10,0],[0,-.52],[.35,-.70],[1,0],[.35,.70],[0,.52]],
    [[-.12,-.24],[.12,-.46],[.72,-.36],[1,0],[.72,.36],[.12,.46],[-.12,.24]],
    [[-.10,0],[.04,-.52],[.48,-1.25],[.82,-.82],[.48,-.68],[1,0],[.32,.65],[.05,.38]],
    [[-.12,0],[.18,-.38],[.48,-.87],[.70,-.55],[1,0],[.64,.20],[.37,.92],[.12,.63]],
    [[-.12,0],[.02,-.42],[.08,-1.32],[.39,-.83],[.32,-.43],[.72,-.36],[1,0],[.72,.36],[.32,.43],[.39,.83],[.08,1.32],[.02,.42]],
    [[-.14,0],[.10,-.50],[.30,-1.02],[.64,-.72],[1,0],[.64,.72],[.30,1.02],[.10,.50]],
    [[-.12,0],[.04,-.62],[.29,-.44],[.22,-1.10],[.55,-.61],[.49,-.88],[1,0],[.53,.18],[.58,.60],[.32,.42],[.24,.96],[.12,.49]],
    [[-.12,0],[.05,-.38],[.02,-.90],[.30,-1.28],[.22,-.68],[.44,-.54],[.75,-.30],[1,0],[.75,.30],[.44,.54],[.22,.68],[.30,1.28],[.02,.90],[.05,.38]],
    [[-.12,0],[.08,-.40],[.22,-1.04],[.73,-1.12],[.47,-.64],[.30,-.55],[.48,-.38],[1,0],[.48,.38],[.30,.55],[.47,.64],[.73,1.12],[.22,1.04],[.08,.40]],
    [[-.12,0],[.04,-.48],[.36,-1.18],[.21,-.58],[.52,-.79],[.48,-.35],[1,0],[.67,.40],[.70,.82],[.46,.60],[.28,1.18],[.33,.49],[.07,.55]],
    [[-.14,0],[.03,-.44],[.02,-1.20],[.48,-1.34],[.30,-.82],[.60,-.65],[.48,-.34],[.80,-.24],[1,0],[.80,.24],[.48,.34],[.60,.65],[.30,.82],[.48,1.34],[.02,1.20],[.03,.44]],
  ];
  SHAPES.push([[-.14,0],[.04,-.42],[.15,-1.32],[.68,-1.35],[.47,-.95],[.30,-.60],[.52,-.38],[1,0],[.52,.38],[.30,.60],[.47,.95],[.68,1.35],[.15,1.32],[.04,.42]],
    [[-.14,0],[.05,-.55],[.01,-1.34],[.26,-1.14],[.37,-.56],[.55,-.84],[.75,-.38],[1,0],[.75,.38],[.55,.84],[.37,.56],[.26,1.14],[.01,1.34],[.05,.55]]);
  SHAPES.push([[-.14,0],[.02,-.32],[.22,-.45],[.38,-1.18],[.67,-.52],[1,0],[.67,.52],[.38,1.18],[.22,.45],[.02,.32]]);
  const NAMES = ['ฝึกหัด','เข็มเหล็กกล้า','จันทร์เสี้ยว','วายุ','ปีกนภา','ผลึกหยก','อสนีบาต','เขี้ยวมังกร','ตรีศูลธารา','เพลิงราชัน','มงกุฎเทพมังกร','จันทร์จักรพรรดิ','ตรีศูลปฐมเทพ','สุริยันจันทรา'];
  const PALETTES = {
    dharma: ['#899fae','#b6ccd8','#a9bfec','#58c3ce','#63b9f0','#48c7a2','#8c9ff6','#eac26e','#77dcd9','#c29bf0','#f6dea5'],
    adharma: ['#927779','#a99da8','#b78aaa','#c36b8c','#cb657c','#b8315c','#a275df','#d99656','#ad70a5','#ee6954','#df6275'],
  };
  S.design = (tier, faction) => {
    const t = Math.max(0, Math.min(13, tier | 0)), dark = faction === 'adharma';
    return {tier:t,name:NAMES[t],shape:SHAPES[t],width:[.12,.12,.16,.15,.18,.20,.18,.21,.22,.21,.24,.26,.28,.23][t],
      main:t===13?(dark?'#c16b9f':'#66d3ad'):t>=11?(dark?(t===12?'#882f4b':'#9b75b5'):(t===12?'#f7df9c':'#92e4e5')):PALETTES[dark?'adharma':'dharma'][t],ink:dark?'#231321':'#24394e',
      edge:dark?'#ffe2d2':'#f5fcff',gold:t>=5?(dark?'#cf9c6c':'#e9c97f'):(dark?'#af9295':'#a8bdcb'),
      gem:dark?(t===5?'#f64169':'#ff6579'):(t===5?'#9bffe0':'#7eeaff'),shaft:dark?'#382632':'#35566b'};
  };
  function polygon(g, points, fill, stroke, line) {
    g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
    if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=line;g.stroke();}
  }
  // Dimensions include the socket and all barbs; a transparent gutter prevents
  // the long high-level heads from being cut flat at a sprite-cell boundary.
  S.fit = (a, tier, fw=320, fh=280) => {
    const d=S.design(tier,'dharma'),[tx,ty]=a.weaponTip,[hx,hy]=a.grip;
    const x=tx+(hx-tx)*.44,y=ty+(hy-ty)*.44,angle=Math.atan2(ty-hy,tx-hx);
    let length=Math.hypot(hx-tx,hy-ty)*.44+a.bodyHeight*.008*d.tier;
    const width=length*d.width,co=Math.cos(angle),si=Math.sin(angle);
    let fit=1;
    for(const [u,v]of [[-.18,-1.45],[-.18,1.45],[1,-1.45],[1,1.45]]) {
      const dx=u*length*co-v*width*si,dy=u*length*si+v*width*co;
      if(dx>0)fit=Math.min(fit,(fw-3-x)/dx);else if(dx<0)fit=Math.min(fit,(3-x)/dx);
      if(dy>0)fit=Math.min(fit,(fh-3-y)/dy);else if(dy<0)fit=Math.min(fit,(3-y)/dy);
    }
    fit=Math.max(.05,fit);length*=fit;
    return {x,y,angle,length,width:width*fit,tip:[x+length*co,y+length*si]};
  };
  S.head = (g,tier,faction,length,width) => {
    const d=S.design(tier,faction),t=d.tier,w=width;
    g.save();g.lineJoin='miter';g.miterLimit=2.4;
    const steel=g.createLinearGradient(0,-w,0,w);
    steel.addColorStop(0,d.ink);steel.addColorStop(.36,d.main);steel.addColorStop(.48,d.edge);
    steel.addColorStop(.52,d.main);steel.addColorStop(1,d.ink);
    polygon(g,d.shape.map(([x,y])=>[x*length,y*w]),steel,d.ink,Math.max(.7,length*.016));
    // Trace the bevel around the side prongs too; dark metal alone loses its
    // silhouette against hair and the inventory's dark background.
    g.strokeStyle=t>=7?d.gold:d.main;g.lineWidth=Math.max(.55,length*.009);g.stroke();
    // Separate bevel planes preserve an acute tip without a blurry glow wash.
    polygon(g,[[.08*length,0],[.35*length,-w*.3],[length,0],[.35*length,w*.12]],d.edge,null,0);
    g.strokeStyle=d.gold;g.lineWidth=Math.max(.65,length*.012);
    g.beginPath();g.moveTo(.05*length,-w*.27);g.lineTo(.38*length,-w*.47);g.lineTo(.85*length,-w*.05);g.stroke();
    // Socket, collars and engraved inlays grow with equipment level.
    const socket=g.createLinearGradient(0,-w*.34,0,w*.34);
    socket.addColorStop(0,d.ink);socket.addColorStop(.4,d.gold);socket.addColorStop(1,d.ink);
    g.fillStyle=socket;g.fillRect(-length*.15,-w*.32,length*.20,w*.64);
    g.strokeStyle=d.edge;g.lineWidth=Math.max(.5,length*.008);
    for(let i=0;i<(t>=5?3:1);i++){
      const x=(-.12+i*.06)*length;g.beginPath();g.moveTo(x,-w*.31);g.lineTo(x,w*.31);g.stroke();
    }
    if(t>=2){
      const count=t>=7?5:t>=4?3:1;
      g.strokeStyle=d.gold;g.lineWidth=Math.max(.55,length*.01);
      for(let i=0;i<count;i++){
        const x=length*(.18+i*.085),r=length*.025;
        g.beginPath();g.moveTo(x-r,-w*.32);g.lineTo(x,-w*.50);g.lineTo(x+r,-w*.32);g.stroke();
      }
    }
    if(t>=4){
      const x=length*.19,r=length*(t>=9?.055:.041);
      polygon(g,[[x-r,0],[x,-w*.30],[x+r,0],[x,w*.30]],d.gem,d.gold,Math.max(.6,length*.012));
      g.fillStyle=d.edge;g.beginPath();g.arc(x-r*.2,-w*.07,Math.max(.55,r*.22),0,TAU);g.fill();
    }
    if(t>=7){
      // Scrollwork follows the winged socket; each side ends in a sharp barb.
      g.strokeStyle=d.gold;g.lineWidth=Math.max(.6,length*.012);
      for(const side of [-1,1]){
        g.beginPath();g.moveTo(.06*length,side*w*.44);
        g.bezierCurveTo(.06*length,side*w*1.1,.30*length,side*w*.95,.24*length,side*w*.57);g.stroke();
        if(t>=10)polygon(g,[[.14*length,side*w*.8],[.36*length,side*w*1.08],[.23*length,side*w*.66]],d.gem,d.gold,length*.008);
        if(t>=11){
          polygon(g,[[.30*length,side*w*.7],[.52*length,side*w*(t===12?.7:1.16)],[.41*length,side*w*.45]],d.edge,d.gold,length*.008);
          for(let j=0;j<(t===12?4:2);j++){const x=(.30+j*.075)*length;g.beginPath();g.moveTo(x,side*w*.17);g.lineTo(x+length*.025,side*w*.32);g.lineTo(x+length*.05,side*w*.17);g.stroke();}
        }
      }
    }
    g.restore();
  };
  S.held = (g,a,t,f,fw,fh) => {
    const p=S.fit(a,t,fw,fh);g.save();g.translate(p.x,p.y);g.rotate(p.angle);
    S.head(g,t,f,p.length,p.width);g.restore();
  };
  S.icon = (g,t,f,size) => {
    const d=S.design(t,f),unit=size/128;
    g.save();g.translate(size*.51,size*.51);g.rotate(-Math.PI/4);g.scale(unit,unit);
    const length=53,w=length*d.width;
    // Held art retains its painted grip; the icon uses the same socket/metal and a wrapped haft.
    g.translate(13,0);
    const shaft=g.createLinearGradient(0,-2.4,0,2.4);
    shaft.addColorStop(0,d.ink);shaft.addColorStop(.4,d.gold);shaft.addColorStop(.55,d.shaft);shaft.addColorStop(1,d.ink);
    g.fillStyle=shaft;g.fillRect(-78,-2.4,78,4.8);
    g.fillStyle=d.shaft;g.fillRect(-56,-3.1,23,6.2);
    g.strokeStyle=d.gold;g.lineWidth=.9;
    for(let x=-55;x<-34;x+=3){g.beginPath();g.moveTo(x,-3);g.lineTo(x+2,3);g.stroke();}
    polygon(g,[[-84,0],[-76,-3],[-73,0],[-76,3]],d.main,d.edge,.6);
    if(t>=3)for(let i=0;i<Math.min(t-1,5);i++){
      const x=-27+i*4.5;g.fillStyle=i%2?d.gold:d.main;g.fillRect(x,-2.8,1.6,5.6);
    }
    S.head(g,t,f,length,w);g.restore();return true;
  };
})();
