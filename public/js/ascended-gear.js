// Endgame armour: fitted inlays and layered plates, baked once into each pose atlas.
// Uses the same garment anchors as equipment lights; never adds a second pair of wings.
(function () {
  const A=window.AscendedGear={},TAU=Math.PI*2;
  A.palette=(f,t)=>f==='adharma'
    ? t===9?{cloth:'#29111f',metal:'#d19177',edge:'#ffe0bd',gem:'#ff4765'}:{cloth:'#352740',metal:'#b597d9',edge:'#efdcff',gem:'#d994f7'}
    : t===9?{cloth:'#f5e9cd',metal:'#bc974e',edge:'#fffbed',gem:'#f6d181'}:{cloth:'#d8eeee',metal:'#59999d',edge:'#f3fffa',gem:'#7ee7e4'};
  function shape(g,pts,fill,stroke,w=.8){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=w;g.stroke();}
  function jewel(g,x,y,r,P){shape(g,[[x,y-r],[x+r*.65,y],[x,y+r],[x-r*.65,y]],P.gem,P.edge,.6);}
  function crest(g,cls,x,y,r,P,high){
    g.save();g.translate(x,y);g.strokeStyle=P.edge;g.lineWidth=.7;
    if(cls==='dualblade'){
      for(const s of [-1,1])shape(g,[[0,-r],[s*r,-r*.35],[s*r*.75,r*.7],[0,r*1.2],[s*r*.3,0]],P.metal,P.edge);
    }else if(cls==='archer'){
      for(const s of [-1,1])for(let i=0;i<(high?3:2);i++){g.save();g.rotate(s*(.35+i*.4));shape(g,[[0,0],[-r*.35,-r*.65],[0,-r*(1.2+i*.12)],[r*.35,-r*.65]],P.cloth,P.metal);g.restore();}
    }else if(cls==='taoist'){
      for(let i=0;i<(high?8:5);i++){g.save();g.rotate(i*TAU/(high?8:5));shape(g,[[0,0],[-r*.35,-r*.65],[0,-r*1.1],[r*.35,-r*.65]],P.cloth,P.metal);g.restore();}
    }else{
      for(const s of [-1,1])for(let i=0;i<(high?3:2);i++)shape(g,[[s*i*r*.24,-r*.6],[s*(i+1)*r*.42,-r],[s*(i+1)*r*.5,r*.3],[s*i*r*.24,r*.7]],P.metal,P.edge);
    }
    jewel(g,0,0,r*.42,P);g.restore();
  }
  A.compose=(src,key,cls,f,ar)=>{
    const I=ModelTiers.info(key),fw=I?.fw||(cls==='spearman'?320:256),fh=I?.fh||(cls==='spearman'?280:240);
    const c=Object.assign(document.createElement('canvas'),{width:src.width,height:src.height}),g=c.getContext('2d');g.drawImage(src,0,0);
    const anchor=cls==='archer'?ArcherGear.glintAnchors:cls==='spearman'?SpearmanLook.glintAnchors:ArmorLook.glintAnchors;
    for(let row=0;row<src.height/fh;row++)for(let col=0;col<8;col++){
      const points=anchor(key,row,col),X=col*fw,Y=row*fh;
      g.save();g.beginPath();g.rect(X+2,Y+2,fw-4,fh-4);g.clip();g.translate(X,Y);
      for(let slot=0;slot<4;slot++){
        const tier=ar[slot];if(tier<8||tier>9)continue;
        const P=A.palette(f,tier),ps=points[slot]||[],s=fw/256,high=tier===9;
        for(const [i,[x,y]]of ps.entries()){
          const side=i===0?-1:1;
          if(slot===0){
            // Narrow lapels and embroidered tabards stay on the torso, below the face.
            const h=(high?13:10)*s,w=3*s;
            g.strokeStyle=P.metal;g.lineWidth=.8*s;
            g.beginPath();g.moveTo(x-side*w,y-h*.4);g.lineTo(x,y+h*.3);g.lineTo(x-side*w,y+h);g.stroke();
            crest(g,cls,x,y,3.4*s,P,high);
            for(let n=0;n<(high?3:2);n++)jewel(g,x-side*w*.4,y+(5+n*2.5)*s,.8*s,P);
          }else if(slot===3){
            // Compact pauldrons attached at the authored shoulder points, no long scarf blades.
            const w=(high?8:7)*s,h=4*s;
            shape(g,[[x-side*w*.4,y-h],[x+side*w,y-h*.65],[x+side*w*1.15,y+h*.4],[x+side*w*.3,y+h],[x-side*w*.4,y+h*.3]],P.cloth,P.metal,1*s);
            crest(g,cls,x+side*w*.3,y,3*s,P,high);
          }else{
            const w=slot===1?3*s:4*s,h=(high?5:4)*s;
            g.strokeStyle=P.metal;g.lineWidth=1.2*s;
            g.beginPath();g.moveTo(x-w,y-h);g.lineTo(x,y-h+2*s);g.lineTo(x+w,y-h);g.stroke();
            if(high){g.beginPath();g.moveTo(x-w,y+h);g.lineTo(x,y+h+2*s);g.lineTo(x+w,y+h);g.stroke();}
            jewel(g,x,y,1.5*s,P);
          }
        }
      }g.restore();
    }return c;
  };
  A.icon=(g,slot,cls,tier,f,size)=>{
    const P=A.palette(f,tier),high=tier===9;g.save();g.translate(size/2,size/2);g.scale(size/100,size/100);
    const cloth=g.createLinearGradient(-30,0,30,0);cloth.addColorStop(0,P.metal);cloth.addColorStop(.45,P.cloth);cloth.addColorStop(1,P.metal);
    if(slot==='body'){
      shape(g,[[-13,-33],[-30,-20],[-24,3],[-17,-3],[-22,33],[0,40],[22,33],[17,-3],[24,3],[30,-20],[13,-33],[0,-20]],cloth,P.edge,1.4);
      for(const s of [-1,1]){shape(g,[[s*5,-18],[s*13,-28],[s*16,28],[s*5,34]],P.cloth,P.metal);crest(g,cls,s*12,8,7,P,high);}
      shape(g,[[-18,4],[18,4],[18,10],[-18,10]],P.metal,P.edge);jewel(g,0,7,5,P);
    }else if(slot==='legs')for(const s of [-1,1]){
      shape(g,[[s*3,-30],[s*25,-30],[s*21,13],[s*28,32],[s*5,32],[s*3,6]],cloth,P.edge,1.4);crest(g,cls,s*14,9,8,P,high);
    }else if(slot==='arms')for(const s of [-1,1]){
      g.save();g.translate(s*19,0);g.rotate(s*-.24);shape(g,[[-12,-28],[12,-28],[10,22],[0,30],[-10,22]],cloth,P.edge,1.5);crest(g,cls,0,0,12,P,high);g.restore();
    }else for(const s of [-1,1]){
      shape(g,[[0,-19],[s*24,-29],[s*43,-14],[s*39,12],[s*19,24],[s*5,8]],cloth,P.edge,1.4);crest(g,cls,s*23,-2,13,P,high);
    }
    g.restore();
  };
  A.whiskIcon=(g,tier,f,size)=>{
    if(tier===13){g.save();g.translate(size*.5,size*.4);g.scale(size/100,size/100);g.rotate(-.35);TaoistGear.solarWhisk(g,57,8,f);g.restore();return;}
    const P=A.palette(f,tier===12?9:8);g.save();g.translate(size*.52,size*.46);g.scale(size/100,size/100);g.rotate(-.35);
    shape(g,[[-3,-35],[3,-35],[3,8],[-3,8]],P.metal,P.edge,1);
    crest(g,'taoist',0,1,tier===12?14:11,P,tier===12);
    for(let i=-4;i<=4;i++){
      g.beginPath();g.moveTo(i*1.1,8);g.bezierCurveTo(i*5,16,i*4,31,i*2+8,43-Math.abs(i)*1.5);g.strokeStyle=i%2?P.edge:P.gem;g.lineWidth=i%2?1.2:2;g.stroke();
    }g.restore();
  };
})();
