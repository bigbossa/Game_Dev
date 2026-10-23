// Level milestones shared with the spear class, drawn as guardian seals and battle sashes.
(function(){
  const P=window.WarriorProgression={},TAU=Math.PI*2;
  P.state=e=>{
    const tier=ModelTiers.tierOf(e.lvl||1),alive=!e.dead&&!e.dying;
    return {tier,hair:tier<2?'short':tier<4?'medium':tier<6?'long':'royal',
      ground:alive&&tier>=2,sashes:alive&&tier>=4?(tier>=7?3:tier>=6?2:1):0};
  };
  P.draw=(g,e,F,x,y,scale,t,meta,bounds)=>{
    const s=P.state(e);if(!s.ground)return;
    const dark=e.faction==='adharma',main=dark?'#d58a9c':'#a6d9ec',gold=dark?'#cda474':'#e9d1a1';
    const m=meta.landmarks[dark?'adharma':'dharma'][F.atk?'attack':'walk'][F.frame*8+C.DIR_COL[F.dir]],B=(meta.anchorY-m.headTop)*scale;
    const fit=Math.min(1,bounds?bounds.width/(B*1.5):1),R=Math.min((.23+s.tier*.012)*B,bounds?bounds.width*.38:Infinity);
    g.save();g.translate(x,y);g.scale(1,.34);g.strokeStyle=main;g.lineWidth=Math.max(.7,scale*1.5);g.globalAlpha=.24;
    g.beginPath();g.ellipse(0,0,R,R,0,0,TAU);g.stroke();
    for(let i=0;i<4;i++){
      const a=i*TAU/4+Math.PI/4,px=Math.cos(a)*R,py=Math.sin(a)*R;
      g.save();g.translate(px,py);g.rotate(a+Math.PI/2);g.beginPath();g.moveTo(-3,-4);g.lineTo(3,-4);g.lineTo(3,1);g.lineTo(0,5);g.lineTo(-3,1);g.closePath();g.stroke();g.restore();
    }
    g.restore();if(!s.sashes)return;
    // Thin cloth stays below the shoulder line, with no glow covering the face.
    g.save();g.translate(x,y-B*.52);g.scale(fit,1);
    for(let layer=s.sashes-1;layer>=0;layer--)for(const side of [-1,1]){
      const edges=[[],[]],phase=t*1.5+layer*1.8+side;
      for(let i=0;i<=24;i++){
        const u=i/24,xx=side*B*(.12+(.35+layer*.07)*Math.sin(u*Math.PI*.65)),yy=B*(-.10*Math.sin(u*Math.PI)+.42*u*u+Math.sin(u*9-phase)*.035*u),w=B*.012*Math.sin(u*Math.PI)*(1-u*.55);
        edges[0].push([xx,yy-w]);edges[1].push([xx,yy+w]);
      }
      g.beginPath();[...edges[0],...edges[1].reverse()].forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();
      g.globalAlpha=.48-layer*.08;g.fillStyle=main;g.fill();g.strokeStyle=gold;g.lineWidth=.5;g.stroke();
    }
    g.restore();
  };
})();
