// Archer equipment is composed once per outfit, never in the animation loop.
// Authored anchors use the original sheets' pixels; feet, face and pose stay intact.
(function () {
  const AG = window.ArcherGear = {}, prepared = new Map();
  const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const OUT = '#24252e';
  const shade=(hex,k)=>'#'+rgb(hex).map(v=>Math.max(0,Math.min(255,Math.round(v*k))).toString(16).padStart(2,'0')).join('');
  function material(g,d,x0,y0,x1,y1) {
    const p=g.createLinearGradient(x0,y0,x1,y1);
    p.addColorStop(0,shade(d.main,.55));p.addColorStop(.35,d.main);
    p.addColorStop(.48,d.edge);p.addColorStop(.6,d.main);p.addColorStop(1,shade(d.main,.6));
    return p;
  }
  // Wood, leather, iron, silver, jade, crystal, sun, moon, phoenix, star, divine.
  const PALETTES = {
    dharma: [
      ['#99704a','#d9bd88'], ['#61784a','#c9b279'], ['#557488','#cbdde6'],
      ['#356f9b','#e3f3ff'], ['#267a60','#b8f1a9'], ['#29a5ab','#b2fcf7'],
      ['#ba7133','#ffe49a'], ['#4767a4','#e4efff'], ['#ab6833','#fff0ae'],
      ['#7458b0','#e2caff'], ['#e4e8d2','#e6b64b']
    ],
    adharma: [
      ['#70494e','#c7977c'], ['#71404d','#c49277'], ['#565b70','#b8becb'],
      ['#713f70','#e4b3e1'], ['#9d314b','#ffb2bc'], ['#703ca1','#d9b2ff'],
      ['#ae4836','#ffd091'], ['#3e456f','#c0c9ef'], ['#b63f52','#ffd1bb'],
      ['#933d8c','#ffbef1'], ['#34283c','#ee798e']
    ]
  };
  AG.design = function (tier, faction) {
    const t = Math.max(0, Math.min(13, tier | 0)), dark=faction==='adharma';
    const p = t===13?(dark?['#652c54','#f7a8d4']:['#287c68','#afffdb']):t>=11?(dark?(t===12?['#321323','#ff6a87']:['#513665','#ddb8fc']):(t===12?['#f4e8c7','#d7b466']:['#88cdcb','#e1fff0'])):PALETTES[dark ? 'adharma' : 'dharma'][t];
    return { tier: t, main: p[0], edge: p[1], dark: OUT, gem: t >= 8 ? '#ffffff' : p[1] };
  };
  // Body: centre, collar, belt, hem, half width. Bow: upper tip, hand, lower tip.
  // Null means occluded by the body: never draw a weapon through hair or a cloak.
  const WALK = {
    dharma: {
      body: [[99,91,119,148,20],[110,96,125,151,19],[113,94,126,150,17],[114,97,127,151,18],[111,96,125,153,23],[108,96,124,151,18],[109,94,124,152,17],[110,94,122,150,19]],
      bow: [[162,33,150,112,147,169],[164,43,148,116,143,170],[157,44,143,116,135,171],[158,43,147,115,143,171],null,[60,49,73,116,78,172],[65,51,83,117,89,171],[62,47,79,115,86,169]],
      shift: [[0,0],[0,1],[2,0]]
    },
    adharma: {
      body: [[90,92,120,148,20],[109,97,126,151,18],[109,96,124,151,17],[106,96,124,151,19],[100,96,123,152,23],[98,96,124,151,19],[100,96,123,151,17],[102,94,121,149,20]],
      bow: [[155,45,143,117,142,173],[169,47,149,119,148,171],[165,47,142,117,139,173],[156,45,136,117,137,172],null,[36,49,51,116,58,172],[44,50,62,116,67,171],[155,45,145,116,147,172]],
      shift: [[0,0],[-1,1],[1,2]]
    }
  };
  const ATTACK = {
    dharma: {
      body: [
        [[84,119,151,179,19],[92,126,157,183,20],[93,119,153,182,17],[77,119,150,179,18],[81,109,147,180,22],[91,119,150,179,18],[75,119,153,182,17],[76,126,157,183,20]],
        [[96,126,150,179,20],[99,128,152,178,21],[93,126,152,179,18],[98,126,152,180,18],[90,126,155,180,20],[70,126,152,180,18],[75,126,152,179,18],[69,128,152,178,21]],
        [[96,126,151,180,20],[100,142,163,185,20],[101,155,173,193,20],[105,115,148,180,20],[98,163,179,197,21],[63,115,148,180,20],[67,155,173,193,20],[68,142,163,185,20]]
      ],
      bow: [
        [[120,108,119,154,112,187],[119,119,125,159,125,194],[126,118,125,151,120,188],null,null,null,[42,118,43,151,48,188],[49,119,43,159,43,194]],
        [null,[113,49,151,117,127,153],[98,39,141,113,110,154],[101,45,129,110,127,155],[113,44,140,101,125,147],[67,45,39,110,41,155],[70,39,27,113,58,154],[55,49,17,117,41,153]],
        [null,[81,75,138,159,126,202],[88,66,132,164,124,205],null,null,null,[80,66,36,164,44,205],[87,75,30,159,42,202]]
      ]
    },
    adharma: {
      body: [
        [[93,92,122,153,20],[99,95,123,151,20],[98,96,123,150,17],[96,96,125,153,19],[93,91,123,156,22],[90,96,125,153,19],[88,96,123,150,17],[87,95,123,151,20]],
        [[115,96,126,154,20],[117,96,126,154,20],[116,99,128,155,20],[105,96,123,153,19],[99,97,127,157,22],[81,96,123,153,19],[70,99,128,155,20],[69,96,126,154,20]],
        [[110,132,153,172,21],[100,116,143,168,21],[107,137,158,175,21],[112,114,142,165,21],[115,115,144,170,20],[74,114,142,165,21],[79,137,158,175,21],[86,116,143,168,21]]
      ],
      bow: [
        [[130,83,127,112,127,149],null,[123,99,118,126,117,174],[120,99,118,128,111,171],[149,22,138,70,137,82,1,1],[66,99,68,128,75,171],[63,99,68,126,69,174],null],
        [[139,10,174,86,158,128],[139,10,174,86,158,128],[142,14,171,91,153,132],[117,13,149,83,130,136],[144,11,135,72,115,125],[69,13,37,83,56,136],[44,14,15,91,33,132],[47,10,12,86,28,128]],
        [[139,66,147,136,137,181],[139,63,157,124,151,174],[128,69,141,140,125,178],null,null,null,[58,69,45,140,61,178],[47,63,29,124,35,174]]
      ]
    }
  };
  // Turnaround poses are separately authored, not a shifted walking frame.
  const IDLE = {
    dharma: {
      body:[[110,80,111,148,16],[118,82,112,148,16],[112,82,114,148,14],[115,83,114,149,16],[111,83,113,150,19],[108,83,112,150,16],[114,82,111,149,14],[111,80,111,148,16]],
      bow:[[155,38,147,105,148,164],[153,39,145,109,146,166],[147,49,138,109,140,166],[148,49,144,113,151,168],null,[68,50,74,111,76,164],[67,42,78,108,84,163],[67,35,77,105,82,160]]
    },
    adharma: {
      body:[[99,80,111,151,16],[110,81,112,151,16],[108,81,113,151,14],[104,81,114,151,16],[100,81,113,151,19],[100,81,113,151,16],[89,81,112,150,14],[94,79,111,150,16]],
      bow:[[139,49,134,108,137,164],[146,43,140,107,140,165],[137,49,132,116,134,167],[135,49,133,122,138,164],null,[67,50,67,118,69,161],[63,45,71,113,80,167],[148,39,137,106,143,164]]
    }
  };
  function anchor(f, atk, row, col) {
    if(!atk && row===3)return {body:IDLE[f].body[col],bow:IDLE[f].bow[col]};
    const a = atk ? ATTACK[f] : WALK[f];
    if (atk) {
      const body=a.body[row][col], bow=a.bow[row][col]?.slice();
      if(bow)bow[6]=bow[2]>body[0]?1:-1;
      return { body, bow };
    }
    const b = a.body[col].slice(), bow = a.bow[col]?.slice();
    const [dx, dy] = a.shift[Math.min(row, 2)];
    b[0] += dx; b[1] += dy; b[2] += dy; b[3] += dy;
    if (bow) for (let i = 0; i < 6; i += 2) { bow[i] += dx; bow[i + 1] += dy; }
    return { body: b, bow };
  }
  AG.anchor = anchor;
  function dist(x, y, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1)));
    return Math.hypot(x-ax-t*dx, y-ay-t*dy);
  }
  function bowLine(b, upper, t) {
    const k = upper ? 0 : 4, hx = b[2], hy = b[3], tx = b[k], ty = b[k+1];
    const side = b[6] ?? (tx >= hx ? 1 : -1);
    return [hx+(tx-hx)*t+Math.sin(t*Math.PI)*side*7, hy+(ty-hy)*t];
  }
  const visibleLimbs = b => b[7] === 1 ? [true] : [true,false];
  // Several dark-elf turnaround cells contain only fragments of the bow.
  // Restore complete limbs and a string behind the original hand/hair/cloak.
  // This is equipment geometry, composed once together with its level ornaments.
  function restoreBow(g,b,d,pull){
    if(!b)return;
    g.save();g.lineCap='round';g.lineJoin='round';
    g.strokeStyle='#d5a3ac';g.lineWidth=.9;
    g.beginPath();g.moveTo(b[0],b[1]);if(pull)g.lineTo(...pull);g.lineTo(b[4],b[5]);g.stroke();
    const limb=new Path2D();
    const top=bowLine(b,true,1);limb.moveTo(...top);
    for(let i=23;i>=0;i--)limb.lineTo(...bowLine(b,true,i/24));
    for(let i=1;i<=24;i++)limb.lineTo(...bowLine(b,false,i/24));
    g.strokeStyle=OUT;g.lineWidth=5.8;g.stroke(limb);
    g.strokeStyle=material(g,d,b[0]-8,b[1],b[4]+8,b[5]);g.lineWidth=3.8;g.stroke(limb);
    g.strokeStyle=d.edge;g.lineWidth=1.1;g.stroke(limb);
    g.restore();
  }
  // Reuse the equipment's actual bow geometry on the new empty-handed painted models.
  AG.drawBow=function(g,b,tier,faction,pull,ornamentScale=1){
    const d=AG.design(tier,faction);restoreBow(g,b,d,pull);ornaments(g,b,d,ornamentScale);
    if(pull){
      const tip=b[2]+b[6]*15;g.strokeStyle=d.edge;g.lineWidth=1.1;
      g.beginPath();g.moveTo(...pull);g.lineTo(tip,pull[1]);g.stroke();
      g.fillStyle=d.edge;g.beginPath();g.moveTo(tip,pull[1]);g.lineTo(tip-b[6]*5,pull[1]-2);g.lineTo(tip-b[6]*5,pull[1]+2);g.fill();
    }
  };
  // Mask preparation + a restrained edge enhancement once at asset load. It never
  // changes alpha, samples another frame, or sharpens low-alpha fringes.
  AG.prepare = function (faction, images, meta) {
    for (const atk of [false, true]) {
      const key = `arc-${atk ? 'attack' : 'walk'}-${faction}`, name = `archer-${faction}${atk ? '-attack' : ''}`;
      if (prepared.has(key)) continue;
      const src = images[name], m = (atk ? meta.attack : meta.walk)[faction];
      if (!src || !m) continue;
      const c = mk(src.width, src.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(src, 0, 0);
      const id = g.getImageData(0,0,c.width,c.height), original = new Uint8ClampedArray(id.data), d = id.data;
      const masks = Array.from({length:5},()=>new Uint8Array(c.width*c.height));
      const fw = m.frameWidth, fh = m.frameHeight;
      for (let row=0; row<c.height/fh; row++) for (let col=0; col<8; col++) {
        const {body:b,bow} = anchor(faction,atk,row,col), [cx,neck,waist,hem,hw] = b;
        const bowSamples = bow ? visibleLimbs(bow).flatMap(up=>Array.from({length:10},(_,i)=>bowLine(bow,up,(i+1)/10))) : [];
        for (let y=1;y<fh-1;y++) for(let x=1;x<fw-1;x++) {
          const p=(row*fh+y)*c.width+col*fw+x, i=p*4;
          if(d[i+3]<30)continue;
          if(d[i+3]>220 && [i-4,i+4,i-c.width*4,i+c.width*4].every(j=>original[j+3]>220)) {
            for(let ch=0;ch<3;ch++) {
              const avg=(original[i-4+ch]+original[i+4+ch]+original[i-c.width*4+ch]+original[i+c.width*4+ch])/4;
              d[i+ch]=original[i+ch]+Math.max(-9,Math.min(9,(original[i+ch]-avg)*.32));
            }
          }
          const r=d[i],gg=d[i+1],bb=d[i+2], hi=Math.max(r,gg,bb),lo=Math.min(r,gg,bb);
          const skin=r>145 && gg>82 && r>gg*1.08 && gg>bb*1.06 && r-bb>25;
          // Bow samples stay outside the grip so the hand is never recoloured.
          if(bow && Math.hypot(x-bow[2],y-bow[3])>10 && bowSamples.some(p=>Math.hypot(x-p[0],y-p[1])<8)) {
            if(!skin) masks[4][p]=255;
            continue;
          }
          if(skin || y<neck || lo<15)continue;
          const dx=Math.abs(x-cx), cloth=faction==='dharma' ? (gg>=bb*.94 && (gg>=r*.84 || hi-lo<35)) : (bb>=gg*.91 || r>gg*1.13);
          if(y>waist+25 && dx<hw+15) { masks[1][p]=255; continue; }
          // Forearm guards along the hand-to-shoulder line, including full draw.
          if(bow && dist(x,y,cx+(bow[2]>cx?hw:-hw),neck+9,bow[2],bow[3])<6 && dx>hw*.7) {masks[2][p]=255;continue;}
          if(y<neck+17 && dx<hw+8 && cloth) {masks[3][p]=255;continue;}
          if(y<=hem && dx<hw+(y>waist?37:7) && cloth) masks[0][p]=255;
        }
      }
      g.putImageData(id,0,0);
      prepared.set(key,{base:c,m,masks,pixels:d,frames:[]});
      images[name]=c;
    }
  };
  function jewel(g,x,y,r,d) {
    g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r*.7,y);g.lineTo(x,y+r);g.lineTo(x-r*.7,y);g.closePath();
    g.fillStyle=d.main;g.fill();g.strokeStyle=d.edge;g.lineWidth=1.5;g.stroke();
    g.fillStyle='#ffffff';g.fillRect(x-.8,y-r*.45,1.5,2);
  }
  function feather(g,x,y,w,h,d,angle=0) {
    g.save();g.translate(x,y);g.rotate(angle);
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(-w,h*.4,0,h);g.quadraticCurveTo(w,h*.5,0,0);
    g.fillStyle=material(g,d,-w,0,w,h*.3);g.fill();g.strokeStyle=d.edge;g.lineWidth=1.2;g.stroke();
    g.beginPath();g.moveTo(0,2);g.lineTo(0,h-2);g.stroke();g.restore();
  }
  function ornaments(g,b,d,scale=1) {
    if(!b || !d.tier)return;
    const t=d.tier;
    for(const up of visibleLimbs(b)) {
      const p=bowLine(b,up,.68),q=bowLine(b,up,.91);
      const angle=Math.atan2(q[1]-p[1],q[0]-p[0])-Math.PI/2;
      g.save();g.translate(p[0],p[1]);g.scale(scale,scale);g.translate(-p[0],-p[1]);
      if(t<=2) {
        g.save();g.translate(p[0],p[1]);g.rotate(angle);
        g.fillStyle=d.main;g.strokeStyle=d.edge;g.lineWidth=1;
        g.fillRect(-3,-6,6,12);g.strokeRect(-3,-6,6,12);
        if(t===2){g.beginPath();g.moveTo(-3,-2);g.lineTo(3,-2);g.moveTo(-3,2);g.lineTo(3,2);g.stroke();}
        g.restore();
      } else if(t===3) jewel(g,p[0],p[1],5,d);
      else if(t===13){
        // Two open orbital rings and a split crystal fin, shared by held bow and icon.
        g.save();g.translate(p[0],p[1]);g.rotate(angle);
        g.strokeStyle=d.edge;g.lineWidth=2;
        for(const side of [-1,1]){
          g.beginPath();g.ellipse(side*6,-5,8,13,side*.45,.2,Math.PI*1.8);g.stroke();
          g.beginPath();g.moveTo(side*3,3);g.lineTo(side*16,-19);g.lineTo(side*8,-10);g.closePath();g.fillStyle=d.main;g.fill();g.stroke();
        }
        jewel(g,0,1,5,d);g.restore();
      }
      else if(t>=11){
        g.save();g.translate(p[0],p[1]);g.rotate(angle);
        // Crescent antlers at 120; a three-feather sovereign crown at 130.
        for(const side of [-1,1]){
          g.beginPath();g.moveTo(0,8);g.bezierCurveTo(side*17,5,side*20,-15,side*(t===12?9:17),-23);
          g.quadraticCurveTo(side*10,-6,0,2);g.closePath();g.fillStyle=material(g,d,-20,-20,20,10);g.fill();g.strokeStyle=d.edge;g.lineWidth=1;g.stroke();
          if(t===12)for(let n=0;n<3;n++)feather(g,side*4,-3,3,18+n*4,d,Math.PI+side*(.35+n*.35));
        }
        jewel(g,0,0,5,d);g.restore();
      }
      else {
        const count=t>=8?3:t>=6?2:1;
        for(let n=0;n<count;n++) feather(g,p[0],p[1],3+n,12+(t-4)*1.3,d,angle+(n-(count-1)/2)*.65);
        jewel(g,p[0],p[1],t>=9?5:3.8,d);
        if(t===5 || t===7 || t>=9) {
          g.strokeStyle=d.edge;g.lineWidth=1.4;g.beginPath();g.arc(p[0],p[1],t>=9?8:6,0,Math.PI*2);g.stroke();
        }
      }
      g.restore();
    }
  }
  const ARM_TIERS=[0,1,2,3,4,5,8,10,11,12,5];
  // Distinct armour materials, clipped to the appropriate equipped slot.
  function pattern(g,b,t,slot,d,col) {
    const [cx,neck,waist,hem,hw]=b;
    g.strokeStyle=d.edge;g.fillStyle=d.edge;g.lineWidth=1.5;
    if(slot===0) {
      // Seams -> crossed straps -> lamellar chevrons -> leaves -> crystal -> phoenix -> star.
      for(const side of [-1,1]) {
        g.beginPath();g.moveTo(cx+side*hw*.7,neck+8);g.lineTo(cx+side*4,waist);g.lineTo(cx+side*18,hem);g.stroke();
      }
      if(t===2) {g.lineWidth=4;g.beginPath();g.moveTo(cx-hw,neck+9);g.lineTo(cx+hw,waist);g.stroke();}
      if(t===3) for(let y=neck+12;y<hem;y+=8) {g.beginPath();g.moveTo(cx-hw,y);g.lineTo(cx,y+5);g.lineTo(cx+hw,y);g.stroke();}
      if(t>=4) for(const side of [-1,1]) for(let n=0;n<(t>=6?3:2);n++)
        feather(g,cx+side*(7+n*7),waist+n*3,3.2,13,d,side*-.4);
      if(t>=5) jewel(g,cx,waist+6,t>=7?7:5,d);
      if(t===7) {
        g.beginPath();g.moveTo(cx,neck+7);g.lineTo(cx+12,waist);g.lineTo(cx,hem);g.lineTo(cx-12,waist);g.closePath();g.stroke();
      }
    } else if(slot===1 || slot===2) {
      const y0=slot===1?waist+28:neck+13;
      g.lineWidth=t<3?1.2:1.6;
      // Two readable cuffs rather than a fine stripe pattern that shimmers at game scale.
      for(const y of [y0+3,y0+14]) {
        g.beginPath();g.moveTo(cx-55,y);g.lineTo(cx+60,y+(t>=4?7:0));g.stroke();
      }
      if(t>=5)for(const side of [-1,1])jewel(g,cx+side*(slot===1?13:hw+6),y0+8,3,d);
    } else {
      for(const side of [-1,1]) {
        const x=cx+side*hw*.78,y=neck+5;
        if(t<3) {
          g.lineWidth=2;g.beginPath();g.ellipse(x,y+4,10,5,side*.35,0,Math.PI);g.stroke();
        } else {
          const count=t>=6?3:2;
          for(let n=0;n<count;n++)feather(g,x+side*n*4,y+n*2,3.8,10+t*.65,d,side*-.55);
          if(t>=5)jewel(g,x,y+5,4,d);
        }
      }
    }
  }
  AG.compose = function (faction, atk, ar, weaponTier) {
    const key=`arc-${atk?'attack':'walk'}-${faction}`, P=prepared.get(key);
    if(!P)return null;
    const {base,m,masks}=P, c=mk(base.width,base.height),g=c.getContext('2d');
    const d=new Uint8ClampedArray(P.pixels), styles=(ar||[]).map(t=>t?AG.design(ARM_TIERS[t],faction):null);
    const wd=AG.design(weaponTier,faction);
    for(let slot=0;slot<5;slot++) {
      const style=slot===4?wd:styles[slot];
      if(!style)continue;
      const target=rgb(style.main),mask=masks[slot];
      for(let p=0;p<mask.length;p++)if(mask[p]){
        const i=p*4,lum=(d[i]*.23+d[i+1]*.57+d[i+2]*.2)/255;
        const strength=slot===4?.83:.78;
        for(let j=0;j<3;j++) {
          const v=target[j]*(.45+lum*.8)+Math.max(0,lum-.52)*100;
          d[i+j]=d[i+j]*(1-strength)+v*strength;
        }
      }
    }
    g.putImageData(new ImageData(d,c.width,c.height),0,0);
    for(let slot=0;slot<4;slot++) {
      const t=ar?.[slot];if(!t)continue;
      const layer=mk(c.width,c.height),lg=layer.getContext('2d'),mask=mk(c.width,c.height),mg=mask.getContext('2d');
      const md=mg.createImageData(c.width,c.height);
      for(let p=0;p<masks[slot].length;p++)md.data[p*4+3]=Math.min(masks[slot][p],P.pixels[p*4+3]);
      mg.putImageData(md,0,0);
      for(let row=0;row<c.height/m.frameHeight;row++)for(let col=0;col<8;col++){
        lg.save();lg.translate(col*m.frameWidth,row*m.frameHeight);
        pattern(lg,anchor(faction,atk,row,col).body,t,slot,styles[slot],col);lg.restore();
      }
      lg.globalCompositeOperation='destination-in';lg.drawImage(mask,0,0);
      g.globalCompositeOperation='source-atop';g.drawImage(layer,0,0);g.globalCompositeOperation='source-over';
    }
    const repair=faction==='adharma'&&!atk?mk(c.width,c.height):null,rg=repair?.getContext('2d');
    for(let row=0;row<c.height/m.frameHeight;row++)for(let col=0;col<8;col++){
      if(rg&&row===3){
        rg.save();rg.beginPath();rg.rect(col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight);rg.clip();
        rg.translate(col*m.frameWidth,row*m.frameHeight);restoreBow(rg,anchor(faction,atk,row,col).bow,wd);rg.restore();
      }
      g.save();g.beginPath();g.rect(col*m.frameWidth,row*m.frameHeight,m.frameWidth,m.frameHeight);g.clip();
      g.translate(col*m.frameWidth,row*m.frameHeight);
      ornaments(g,anchor(faction,atk,row,col).bow,wd);g.restore();
    }
    if(repair){g.globalCompositeOperation='destination-over';g.drawImage(repair,0,0);g.globalCompositeOperation='source-over';}
    return c;
  };
  AG.glintAnchors = function (key, row, col) {
    const P = prepared.get(key);
    if (!P) return [[], [], [], []];
    const { frameWidth: fw, frameHeight: fh } = P.m;
    return P.masks.slice(0, 4).map((mask, slot) =>
      EquipmentGlints.pick(fw, fh, (x, y) => mask[(row * fh + y) * P.base.width + col * fw + x] > 0, slot === 1)
        .map(p => ArcherPose.point(key, row, col, p[0], p[1])));
  };
  AG.points = function (key,F,meta) {
    const P=prepared.get(key);if(!P)return [];
    const n=F.frame*8+C.DIR_COL[F.dir];
    if(!P.frames[n]){
      const b=anchor(key.endsWith('adharma')?'adharma':'dharma',F.atk,F.frame,C.DIR_COL[F.dir]).bow;
      P.frames[n]=b?visibleLimbs(b).flatMap(up=>[.45,.7,.9].map(t=>{
        const raw=bowLine(b,up,t),p=ArcherPose.point(key,F.frame,C.DIR_COL[F.dir],raw[0],raw[1]);
        return[p[0]-meta.anchorX,p[1]-meta.anchorY];
      })):[];
    }
    return P.frames[n];
  };
  // Inventory uses the same materials and limb ornaments as the held bow.
  AG.icon = function (g,tier,faction,size) {
    const d=AG.design(tier,faction),b=[14,-53,-15,0,14,53,-1];
    g.save();g.translate(size*.5,size*.5);g.scale(size/128,size/128);g.rotate(.4);
    // Follow exactly the same sampled limb used to attach the crest and feathers.
    const p=new Path2D();p.moveTo(14,-53);
    for(let i=19;i>=0;i--){const q=bowLine(b,true,i/20);p.lineTo(...q);}
    for(let i=1;i<=20;i++){const q=bowLine(b,false,i/20);p.lineTo(...q);}
    g.lineCap='round';g.strokeStyle=OUT;g.lineWidth=9;g.stroke(p);g.strokeStyle=material(g,d,-20,-53,15,53);g.lineWidth=6;g.stroke(p);
    g.strokeStyle=d.edge;g.lineWidth=1.5;g.stroke(p);
    g.beginPath();g.moveTo(14,-53);g.lineTo(14,53);g.stroke();
    ornaments(g,b,d);
    g.fillStyle=OUT;g.fillRect(-19,-7,8,14);
    g.strokeStyle=d.edge;g.lineWidth=1;for(let y=-5;y<=5;y+=4){g.beginPath();g.moveTo(-19,y);g.lineTo(-11,y+2);g.stroke();}
    g.beginPath();g.moveTo(22,0);g.lineTo(-44,0);g.stroke();
    g.fillStyle=d.edge;g.beginPath();g.moveTo(-50,0);g.lineTo(-39,-5);g.lineTo(-39,5);g.fill();
    g.restore();
  };
  AG.armourIcon = function(g,slot,tier,faction,size) {
    const d=AG.design(ARM_TIERS[tier]||0,faction);
    g.save();g.scale(size/128,size/128);g.lineJoin='round';g.lineWidth=2.5;g.strokeStyle=OUT;
    g.fillStyle=material(g,d,24,15,101,98);
    g.beginPath();
    if(slot==='body') {
      g.moveTo(45,21);g.lineTo(27,36);g.lineTo(36,51);g.lineTo(43,46);g.lineTo(45,67);
      if(tier<3){g.lineTo(34,105);g.lineTo(64,96);g.lineTo(94,105);}
      else {g.lineTo(28,96);g.lineTo(45,91);g.lineTo(43,112);g.lineTo(64,100);g.lineTo(85,112);g.lineTo(83,91);g.lineTo(100,96);}
      g.lineTo(83,67);g.lineTo(85,46);g.lineTo(92,51);g.lineTo(101,36);g.lineTo(83,21);g.lineTo(64,32);
    }
    else if(slot==='legs') {g.moveTo(37,25);g.lineTo(91,25);g.lineTo(88,104);g.lineTo(69,104);g.lineTo(64,58);g.lineTo(59,104);g.lineTo(40,104);}
    else if(slot==='arms') {
      g.moveTo(42,23);if(tier>=3){g.lineTo(62,12);g.lineTo(69,28);g.lineTo(88,22);}
      else g.lineTo(85,32);
      g.lineTo(78,106);g.lineTo(38,96);
    }
    else {g.moveTo(27,39);g.quadraticCurveTo(64,12,101,39);g.lineTo(110,78);g.lineTo(82,94);g.lineTo(64,65);g.lineTo(46,94);g.lineTo(18,78);}
    g.closePath();g.fill();g.stroke();g.save();g.clip();
    const j={body:0,legs:1,arms:2,shoulder:3}[slot]??0;
    pattern(g,[64,25,57,100,26],tier,j,d,0);
    // Thin stitched edge and a broad shaded centre keep small inventory icons legible.
    g.strokeStyle=d.edge;g.lineWidth=1.2;
    if(slot==='body'){
      g.beginPath();g.moveTo(45,27);g.lineTo(58,39);g.lineTo(49,64);g.moveTo(83,27);g.lineTo(70,39);g.lineTo(79,64);g.stroke();
      g.fillStyle=shade(d.main,.45);g.fillRect(42,63,44,9);
      g.strokeRect(43,64,42,7);jewel(g,64,68,5,d);
      if(tier<3){g.setLineDash([2,3]);g.beginPath();g.moveTo(48,75);g.lineTo(43,99);g.moveTo(80,75);g.lineTo(85,99);g.stroke();g.setLineDash([]);}
    } else if(slot==='legs'){
      g.fillStyle=shade(d.main,.45);g.fillRect(36,25,56,8);g.strokeRect(37,26,54,6);
      for(const x of [49,79]){
        g.fillStyle=material(g,d,x-10,69,x+10,90);
        g.beginPath();g.moveTo(x-10,67);g.lineTo(x+10,67);g.lineTo(x+8,100);g.lineTo(x-9,100);g.closePath();g.fill();g.stroke();
        g.beginPath();g.moveTo(x-6,73);g.lineTo(x,94);g.lineTo(x+6,73);g.stroke();
        if(tier>=3)jewel(g,x,72,4.5,d);
      }
    } else if(slot==='arms'){
      for(const y of [38,84]){
        g.fillStyle=shade(d.main,.45);g.fillRect(35,y,55,8);g.strokeRect(35,y,55,8);
      }
      g.fillStyle=material(g,d,44,45,76,76);
      g.beginPath();g.moveTo(48,45);g.lineTo(75,50);g.lineTo(69,80);g.lineTo(54,75);g.closePath();g.fill();g.stroke();
      if(tier<3){g.beginPath();for(let y=48;y<76;y+=7){g.moveTo(50,y);g.lineTo(71,y+5);}g.stroke();}
    }
    g.restore();
    if(slot==='shoulder'){
      for(const side of [-1,1]){
        const x=64+side*26,y=39;
        if(tier<3){
          g.fillStyle=material(g,d,x-15,y,x+15,y+12);g.beginPath();g.ellipse(x,y+9,18,10,side*.35,0,Math.PI*2);g.fill();g.stroke();
          g.beginPath();g.moveTo(x-12,y+9);g.lineTo(x+12,y+9);g.stroke();
        } else for(let n=0;n<(tier>=6?4:3);n++)
          feather(g,x+side*n*4,y+n*4,7,28+n*3,d,-side*(.65+n*.16));
        if(tier>=4)jewel(g,x,y+11,6,d);
      }
      g.strokeStyle=d.edge;g.lineWidth=3;g.beginPath();g.moveTo(46,39);g.quadraticCurveTo(64,57,82,39);g.stroke();
    } else if(tier>=4)jewel(g,64,slot==='arms'?60:51,6,d);
    if(tier>=6&&slot==='body')for(const side of [-1,1])
      feather(g,64+side*32,30,6,23,d,-side*.8);
    g.restore();
  };
})();
