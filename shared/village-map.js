// Authored starter valley. The browser and server share every landmark and walkable footprint.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./common'));
  else root.VillageMap=factory(root.C);
})(typeof self!=='undefined'?self:this,function(C){
  const {T,TILE}=C, V={version:2};
  V.centre=[64.5,49.5];
  V.bridge={x0:28,y0:46,x1:43,y1:51};
  V.riverX=y=>35+Math.sin(y*.065)*3.2+Math.sin(y*.15+1)*.8;
  V.riverHalf=2.8;
  V.template={
    w:128,h:96,camp:[44,31,'EW'],next:[124,49],lair:[61,11,6.5],
    slots:[[22,58],[17,77],[21,34],[12,15],[59,80],[80,82],[96,69],[108,83],[96,33],[111,57],[94,16],[112,24],[77,16],[115,12]],
    roads:[
      [5,[7,49],[35,49],[64.5,49.5],[101,49],[125,49]],
      [3.5,[21,49],[21,34],[12,15]], [3.5,[21,49],[22,58],[17,77]],
      [4,[64.5,49.5],[64,69],[59,80],[80,82],[96,69],[108,83]],
      [3.5,[101,49],[96,33],[94,16],[112,24],[115,12]],
      [3.5,[101,49],[111,57],[96,69]],
      [3.5,[96,33],[77,27],[77,16],[61,19],[61,11]],
      [4,[52.5,49],[52.5,59],[64,62],[77.5,59],[77.5,49]],
      [4,[64.5,49.5],[64.5,38]],
    ],
  };
  const ctr=(tx,ty)=>({tx,ty,x:(tx+.5)*TILE,y:(ty+.5)*TILE});
  V.layout=()=>({camp:{x0:44,y0:31,x1:84,y1:67,open:'EW'},spawn:ctr(64,52),
    smith:ctr(77,49),apothecary:ctr(52,49),enhancer:ctr(77,63),stone:ctr(73,56),lanterns:[],backGate:{tx:46,ty:49}});
  // Object anchor is at the front edge of its actual foundation; roof overhang is visual only.
  V.buildings=[
    {asset:'pavilion',tx:64.5,ty:40,block:[61,37,67,39]},
    {asset:'apothecary',tx:52.5,ty:49,block:[50,46,55,48]},
    {asset:'smith',tx:77.5,ty:49,block:[75,46,80,48]},
    {asset:'house',tx:52.5,ty:63,block:[50,60,55,62]},
    {asset:'enhancer',tx:77.5,ty:63,block:[75,60,80,62]},   // ร้านตีบวก (drawn with the forge art)
    {asset:'stone',tx:73.5,ty:56.8,block:[73,56,73,56]},
  ];
  V.distance=(x,y,pts)=>{
    let best=Infinity;
    for(let i=1;i<pts.length;i++){const [a,b]=pts[i-1],[c,d]=pts[i],dx=c-a,dy=d-b;
      const t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1)));
      best=Math.min(best,Math.hypot(x-a-dx*t,y-b-dy*t));}
    return best;
  };
  V.roadDistance=(x,y)=>Math.min(...V.template.roads.map(([w,...pts])=>V.distance(x,y,pts)-w/2));
  V.generate=function(def,seed){
    const w=128,h=96,tiles=new Uint8Array(w*h),solid=new Uint8Array(w*h),objects=[],reserved=new Uint8Array(w*h);
    const random=C.mulberry32(seed),id=(x,y)=>y*w+x,inside=(x,y)=>x>=0&&y>=0&&x<w&&y<h;
    const camp=(x,y,pad=0)=>x>=44-pad&&x<=85+pad&&y>=31-pad&&y<=68+pad;
    const bridge=(x,y)=>x>=V.bridge.x0&&x<=V.bridge.x1&&y>=V.bridge.y0&&y<=V.bridge.y1;
    const block=(x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(inside(x,y))solid[id(x,y)]=reserved[id(x,y)]=1;};
    const prop=(asset,x,y,blocking=false)=>{
      objects.push(['village',asset,Math.round(x*TILE),Math.round(y*TILE)]);
      const tx=Math.floor(x),ty=Math.floor(y-.15);
      if(inside(tx,ty)){reserved[id(tx,ty)]=1;if(blocking)solid[id(tx,ty)]=1;}
    };
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const k=id(x,y),river=Math.abs(x+.5-V.riverX(y+.5));
      if(river<V.riverHalf){tiles[k]=T.WATER;solid[k]=1;}
      else if(river<V.riverHalf+1)tiles[k]=T.SAND;
      if(V.roadDistance(x+.5,y+.5)<0&&tiles[k]!==T.WATER)tiles[k]=T.PATH;
      if(bridge(x,y)){tiles[k]=T.BRIDGE;solid[k]=(y===46||y===51)&&x>28&&x<43?1:0;}
      const plaza=Math.hypot((x+.5-V.centre[0])/9.7,(y+.5-V.centre[1])/7.3);
      if(plaza<=1)tiles[k]=T.PLAZA;
      if(Math.hypot(x+.5-61.5,y+.5-11.5)<6.7)tiles[k]=T.FIELD;
      // Rocky edges and the boss alcove; all approaches remain open.
      const edge=x<2||x>w-3||y<2||y>h-3;
      const alcove=y<8&&x>51&&x<71;
      if((edge||alcove)&&V.roadDistance(x+.5,y+.5)>1.2&&tiles[k]!==T.WATER){tiles[k]=T.CLIFF;solid[k]=1;}
    }
    for(const b of V.buildings){prop(b.asset,b.tx,b.ty);block(...b.block);}
    // Gateway is passable between its two posts, on the actual transition trigger.
    prop('gate',124.5,49.8);block(122,49,122,49);block(126,49,126,49);
    for(const [x,y]of [[59,41],[70,41],[46,46],[46,53],[82,53],[60,62],[69,62],[29,46],[42,46],[29,52],[42,52]])prop('lantern',x,y,true);
    for(const [x,y]of [[57,38],[73,39],[46,60],[83,61]])prop('peach',x,y,true);
    for(const [x,y]of [[46,36],[82,36],[47,66],[82,66]])prop('tree',x,y,true);
    for(const [x,y]of [[58.5,42.5],[70.5,42.5]])objects.push(['banner',x<64?0:1,x*TILE,y*TILE]);
    // Curated garden borders; never put decorative colliders across a road.
    for(let x=46;x<=82;x+=3)for(const y of [33,66])if(V.roadDistance(x,y)>2)prop('shrub',x,y);
    for(let y=39;y<=64;y+=4)for(const x of [45,84])if(V.roadDistance(x,y)>2)prop('shrub',x,y);
    // Dense vegetation is at the valley edge; combat pack centres remain open.
    for(let y=4;y<h-4;y+=2)for(let x=4;x<w-4;x+=2){
      const k=id(x,y);if(tiles[k]!==T.GRASS||reserved[k]||camp(x,y,2)||V.roadDistance(x+.5,y+.5)<2)continue;
      const lair=Math.hypot(x-61,y-11);if(lair<8)continue;
      const pack=Math.min(...V.template.slots.map(([sx,sy])=>Math.hypot(x-sx,y-sy)));
      const r=random(),density=pack<5?.035:.35;
      if(r<density){const asset=x>87&&y>25&&y<75?'bamboo':random()<.12?'peach':'tree';prop(asset,x+.5,y+.8,true);}
      else if(r>.92&&pack>3)prop('rocks',x+.5,y+.8,true);
      else if(r>.84)prop('shrub',x+.5,y+.8);
    }
    // Rocks mark the lair, but the southern entrance and combat centre stay clear.
    for(let n=0;n<9;n++){const a=Math.PI+n*Math.PI/8,x=61.5+Math.cos(a)*7.5,y=11.5+Math.sin(a)*6;
      if(V.roadDistance(x,y)>1.5)prop('rocks',x,y,true);}
    return {id:'village',version:V.version,w,h,seed,tiles,solid,objects};
  };
  return V;
});
