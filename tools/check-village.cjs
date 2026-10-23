const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../shared/world-data'),{PNG}=require('pngjs'),def=C.MAPS.village;
let checks=0;
for(const seed of [20261119,1,42,98765]){
 const map=C.generateField(def,seed),again=C.generateField(def,seed);
 assert.equal(map.version,2);assert.deepEqual(map,again,'Deterministic map');
 const seen=new Uint8Array(map.w*map.h),queue=[];
 const add=(x,y)=>{if(x<0||y<0||x>=map.w||y>=map.h)return;const k=y*map.w+x;
  if(!seen[k]&&C.canStand(map,(x+.5)*C.TILE,(y+.5)*C.TILE)){seen[k]=1;queue.push([x,y]);}};
 add(def.spawn.tx,def.spawn.ty);
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])add(x+dx,y+dy);}
 assert(queue.length>7500,'Reachable play area');
 const reachable=(x,y)=>!!seen[Math.floor(y/C.TILE)*map.w+Math.floor(x/C.TILE)];
 for(const f of ['dharma','adharma']){const s=C.spawnOf(def,f);assert(reachable(s.x,s.y));assert(C.safeAt(def,s.x,s.y,f));assert(C.noMonster(def,s.x,s.y));checks++;}
 for(const kind of ['smith','apothecary','enhancer','stone']){
  const target=def[kind];
  const near=queue.filter(([x,y])=>Math.hypot((x+.5)*C.TILE-target.x,(y+.5)*C.TILE-target.y)<180);
  assert(near.length>2,kind+' reachable within interaction distance');checks++;
 }
 for(const g of def.gates){assert(reachable(g.x,g.y),'Gate trigger open');const a=C.arrival('village',g.to);assert(reachable(a.x,a.y),'Gate return arrival');checks++;}
 for(const z of def.zones){
  const cells=queue.filter(([x,y])=>x>=z.x0&&x<=z.x1&&y>=z.y0&&y<=z.y1&&!C.noMonster(def,(x+.5)*C.TILE,(y+.5)*C.TILE)&&C.canStand(map,(x+.5)*C.TILE,(y+.5)*C.TILE,C.MONSTERS[z.type].radius));
  assert(cells.length>=(z.fixed?1:30),z.type+' reachable spawn ground');checks++;
 }
 // Water stops movement; the stone bridge crosses without any invisible fence.
 for(let x=27;x<=44;x++)assert(reachable((x+.5)*C.TILE,49.5*C.TILE),'Crossing the bridge');
 assert(!C.canStand(map,C.VILLAGE.riverX(40)*C.TILE,40*C.TILE),'River collision');
 for(const b of C.VILLAGE.buildings){const [x0,y0,x1,y1]=b.block;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)assert(map.solid[y*map.w+x],b.asset+' foundation');}
}
for(const id of C.MAP_ORDER){const d=C.MAPS[id];if(d.pvp)continue;const m=C.generateField(d,20261119);assert(C.canStand(m,d.spawn.x,d.spawn.y),'Valid spawn '+id);}
const dir=path.join(__dirname,'../public/assets/village-v2'),meta=JSON.parse(fs.readFileSync(path.join(dir,'props.json')));
for(const [name,p]of Object.entries(meta.props)){
 const png=PNG.sync.read(fs.readFileSync(path.join(dir,p.file)));assert.equal(png.width,p.width);assert.equal(png.height,p.height);
 let ink=0;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const a=png.data[(y*p.width+x)*4+3];if(a>60)ink++;if(x<2||y<2||x>=p.width-2||y>=p.height-2)assert.equal(a,0,name+' clear border');}
 assert(ink>500,name+' visible');assert(p.ax>0&&p.ax<p.width&&p.ay>0&&p.ay<p.height);
}
for(const p of Object.values(meta.ground)){
 const png=PNG.sync.read(fs.readFileSync(path.join(dir,p.file)));assert.equal(png.width,p.width);assert.equal(png.height,p.height);
}
// Exercise the production monster placement logic without creating a server or touching saves.
const World=require('../server/world'),random=Math.random;let spawned=0;
try{
 for(const seed of [1,42,98765,20261119]){
  Math.random=C.mulberry32(seed);
  const world=Object.create(World.prototype);world.maps={};world.seq=1;world.monsters=[];world.mById=new Map();
  for(const id of C.MAP_ORDER)world.maps[id]={def:{...C.MAPS[id],zones:id==='village'?structuredClone(def.zones):[]},map:id==='village'?C.generateField(def,seed):null,monsters:[]};
  world.spawnAllMonsters();
  assert.equal(world.monsters.length,def.zones.reduce((sum,z)=>sum+z.count,0));
  for(const m of world.monsters){assert(C.canStand(world.maps.village.map,m.x,m.y,18),m.type+' standable spawn');assert(!C.noMonster(def,m.x,m.y),m.type+' outside village');spawned++;}
 }
}finally{Math.random=random;}
console.log(JSON.stringify({seeds:4,reachableLandmarksAndZones:checks,spawnedMonsters:spawned,props:Object.keys(meta.props).length,groundAssets:Object.keys(meta.ground).length,deterministic:true,bridgeAndRiver:true,allMapSpawns:true}));
