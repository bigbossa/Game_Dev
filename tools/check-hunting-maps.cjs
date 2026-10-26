const assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../shared/world-data'),World=require('../server/world');
const ids=C.MAP_ORDER.filter(id=>id!=='village'&&id!=='pvp'),report=[];
const hash=m=>crypto.createHash('sha256').update(m.tiles).digest('hex');
assert.equal(hash(C.generateField(C.MAPS.village,20261119)),'23e058274d3f568d2eca8b604cb6adcbdabf246fae68b33d12f6fc91f7e1d380','Village terrain unchanged by prop placement');
assert.equal(hash(C.generateMap(20261018)),'49ef7d038fecf43cc1bbe0b961e3c59255cdad0f2fed5403a6e0db209b341413','PvP terrain unchanged by prop placement');
for(const id of ids)for(const seed of [20261018+101*(C.MAP_ORDER.indexOf(id)+1),1,42,98765]){
 const def=C.MAPS[id],map=C.generateField(def,seed),tag=id+'/'+seed;
 assert.equal(map.version,3);assert.deepEqual(map,C.generateField(def,seed),tag+' deterministic');
 const seen=new Uint8Array(map.w*map.h),queue=[];
 const add=(x,y)=>{if(x<0||y<0||x>=map.w||y>=map.h)return;const k=y*map.w+x;
  if(!seen[k]&&C.canStand(map,(x+.5)*C.TILE,(y+.5)*C.TILE)){seen[k]=1;queue.push([x,y]);}};
 add(def.spawn.tx,def.spawn.ty);
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])add(x+dx,y+dy);}
 const reachable=(x,y)=>!!seen[Math.floor(y/C.TILE)*map.w+Math.floor(x/C.TILE)];
 assert(reachable(def.spawn.x,def.spawn.y),tag+' spawn');
 assert(C.safeAt(def,def.spawn.x,def.spawn.y),tag+' safe camp');
 for(const kind of ['smith','apothecary','enhancer','stone']){
  const target=def[kind];assert(queue.filter(([x,y])=>Math.hypot((x+.5)*C.TILE-target.x,(y+.5)*C.TILE-target.y)<180).length>2,tag+' '+kind);
 }
 for(const g of def.gates){
  assert(reachable(g.x,g.y),tag+' gate '+g.to);
  const a=C.arrival(id,g.to);assert(C.canStand(map,a.x,a.y)&&reachable(a.x,a.y),tag+' arrival '+g.to);
 }
 for(const z of def.zones){
  const cells=queue.filter(([x,y])=>x>=z.x0&&x<=z.x1&&y>=z.y0&&y<=z.y1&&!C.noMonster(def,(x+.5)*C.TILE,(y+.5)*C.TILE)&&C.canStand(map,(x+.5)*C.TILE,(y+.5)*C.TILE,C.MONSTERS[z.type].radius));
  assert(cells.length>=(z.fixed?1:55),tag+' '+z.type+' has '+cells.length+' reachable spawn cells');
 }
 for(const b of def.tpl.landmarks){
  for(let y=b.y-b.depth;y<=b.y;y++)for(let x=b.x-b.rx;x<=b.x+b.rx;x++)assert(map.solid[y*map.w+x],tag+' landmark footprint');
  assert(reachable((b.x+.5)*C.TILE,(b.y+2.5)*C.TILE),tag+' landmark approach '+b.kind);
 }
 const random=Math.random;
 try{
  Math.random=C.mulberry32(seed);const world=Object.create(World.prototype);
  world.maps={};world.seq=1;world.monsters=[];world.mById=new Map();
  for(const other of C.MAP_ORDER)world.maps[other]={def:{...C.MAPS[other],zones:other===id?structuredClone(def.zones):[]},map:other===id?map:null,monsters:[]};
  world.spawnAllMonsters();
  assert.equal(world.monsters.length,def.zones.reduce((sum,z)=>sum+z.count,0),tag+' population');
  for(const m of world.monsters){assert(C.canStand(map,m.x,m.y,18),tag+' monster standable');assert(reachable(m.x,m.y),tag+' monster reachable');assert(!C.noMonster(def,m.x,m.y),tag+' monster outside camp');}
  report.push({id,seed,reachable:queue.length,monsters:world.monsters.length});
 }finally{Math.random=random;}
}
console.log(JSON.stringify({maps:ids.length,seedsPerMap:4,spawnedMonsters:report.reduce((n,r)=>n+r.monsters,0),villageAndPvpTerrainUnchanged:true,results:report},null,2));
