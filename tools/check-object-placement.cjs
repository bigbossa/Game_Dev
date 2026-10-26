const assert=require('node:assert/strict'),C=require('../shared/world-data');
const reports=[];
for(const id of C.MAP_ORDER)for(const seed of [20261018,1,42,98765]){
 const def=C.MAPS[id],map=def.pvp?C.generateMap(seed):C.generateField(def,seed),tag=id+'/'+seed;
 assert.deepEqual(map,def.pvp?C.generateMap(seed):C.generateField(def,seed),tag+' deterministic');
 const seen=new Uint8Array(map.w*map.h),queue=[];
 const add=(x,y)=>{if(x<0||y<0||x>=map.w||y>=map.h)return;const k=y*map.w+x;if(!seen[k]&&C.canStand(map,(x+.5)*C.TILE,(y+.5)*C.TILE)){seen[k]=1;queue.push([x,y]);}};
 const start=C.spawnOf(def,'dharma');add(Math.floor(start.x/C.TILE),Math.floor(start.y/C.TILE));
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])add(x+dx,y+dy);}
 for(const faction of ['dharma','adharma']){const s=C.spawnOf(def,faction);assert(seen[Math.floor(s.y/C.TILE)*map.w+Math.floor(s.x/C.TILE)],tag+' faction spawn connected');}
 const lair=def.lair||C.CENTER;assert(seen[Math.floor(lair.ty)*map.w+Math.floor(lair.tx)],tag+' arena connected');
 const shops=def.pvp?['dharma','adharma'].flatMap(f=>[C.SMITH[f],C.APOTHECARY[f],C.ENHANCER[f],C.STONES[f]]):[def.smith,def.apothecary,def.enhancer,def.stone];
 for(const s of shops)assert(queue.some(([x,y])=>Math.hypot((x+.5)*C.TILE-s.x,(y+.5)*C.TILE-s.y)<150),tag+' service reachable');
 for(const gate of def.gates||[])assert(seen[gate.ty*map.w+gate.tx],tag+' gate open');
 const natural=map.objects.filter(o=>['tree','rock','bush'].includes(o[0])&&(!def.pvp||!C.baseAt(o[2],o[3])));
 for(const o of natural){
  const x=Math.floor(o[2]/C.TILE),y=Math.floor(o[3]/C.TILE),t=map.tiles[y*map.w+x];
  assert(![C.T.PATH,C.T.BRIDGE,C.T.WATER,C.T.CLIFF].includes(t),tag+' natural prop blocks route/water');
  if(o[0]!=='bush')assert(map.solid[y*map.w+x],tag+' collision follows prop');
 }
 if(def.pvp){
  const points=new Set(natural.map(o=>`${o[0]}:${o[2]}:${o[3]}`));
  for(const o of natural)assert(points.has(`${o[0]}:${map.w*C.TILE-o[2]}:${o[3]}`),tag+' mirrored scenery');
 }else if(id!=='village'){
  assert(Math.abs(def.smith.x-def.apothecary.x)>=8*C.TILE,tag+' separated shop roofs');
  const houses=map.objects.filter(o=>o[0]==='house');assert.equal(houses.length,1,tag+' camp has one residence');
  const trees=natural.filter(o=>o[0]==='tree');
  for(let i=0;i<trees.length;i++)for(let j=i+1;j<trees.length;j++){
   const dx=(trees[i][2]-trees[j][2])/C.TILE,dy=(trees[i][3]-trees[j][3])/C.TILE;
   assert((dx/3.8)**2+(dy/2.8)**2>.985,tag+' tree canopies overcrowded');
  }
 }
 reports.push({id,seed,objects:map.objects.length,reachable:queue.length});
}
console.log(JSON.stringify({maps:8,seeds:4,checks:'determinism, both factions, arena, shops, gates, collision, tree spacing, mirrored PvP scenery',reports},null,2));
