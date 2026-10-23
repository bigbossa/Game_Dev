// Authoritative tests: no sockets, accounts, server instance or player saves.
const assert=require('node:assert/strict'),C=require('../shared/world-data'),World=require('../server/world');
const original=Date.now;let now=100000,checks=0;Date.now=()=>now;
function fixture(type){
 const w=Object.create(World.prototype),def={pvp:false,camp:{x0:0,y0:0,x1:3,y1:3}};
 w.maps={test:{def,map:{w:100,h:100,solid:new Uint8Array(10000)},monsters:[]}};w.players=new Map();w.events=[];w.timers=[];w.hits=[];
 w.emitNear=(...args)=>w.events.push(args.at(-1));w.applyDamage=(m,p,k)=>w.hits.push({id:p.id,power:k});
 const m={id:'m1',type,def:C.MONSTERS[type],mapId:'test',x:1000,y:1000,hx:1000,hy:1000,threat:new Map(),target:'p1',nextSpecial:0,nextAtk:0,nextRetarget:Infinity,hp:100,stunUntil:0,returning:false};
 const p={id:'p1',mapId:'test',x:1080,y:1000,dead:false};w.players.set(p.id,p);return{w,m,p};
}
function finish(w){now+=2000;for(const t of w.timers.splice(0))t.fn();}
try{
 const all=Object.entries(C.MONSTERS),high=all.filter(([,m])=>m.lvl>=80);
 assert.equal(high.length,23);for(const [,m]of all)assert.equal(!!m.skill,m.lvl>=80);
 for(const [type,def]of high){
  let {w,m,p}=fixture(type);w.updateMonster(m,.05,now);assert(m.monsterCast,type);assert.equal(w.hits.length,0);assert.equal(w.events.filter(e=>e.t==='monsterWindup').length,1);
  const cast=m.monsterCast,px=cast.x,py=cast.y;
  w.players.set('safe',{id:'safe',mapId:'test',x:20,y:20});w.players.set('elsewhere',{id:'elsewhere',mapId:'elsewhere',x:px,y:py});
  w.players.set('outside',{id:'outside',mapId:'test',x:px+1000,y:py});w.players.set('dead',{id:'dead',mapId:'test',dead:true,x:px,y:py});
  w.players.set('inside',{id:'inside',mapId:'test',x:px+20*Math.cos(cast.a),y:py+20*Math.sin(cast.a)});
  const before=[m.x,m.y];w.updateMonster(m,.1,now+200);assert.deepEqual([m.x,m.y],before,'Rooted while warning is active');
  finish(w);assert.deepEqual(w.hits.map(h=>h.id),['p1','inside'],type);assert(w.hits.every(h=>h.power===def.skill.power));
  assert.equal(w.events.filter(e=>e.t==='monsterRelease').length,1);assert(!m.monsterCast);assert(!w.startMonsterSkill(m,p,now),'Cooldown');checks++;
  for(const change of ['dodge','death','stun','warp','logout','safe','leash','return','respawn']){
   ({w,m,p}=fixture(type));w.updateMonster(m,.05,now);const token=m.monsterCast;
   if(change==='dodge'){p.x=token.x-500;p.y=token.y;}
   if(change==='death')m.dead=true;
   if(change==='stun')m.stunUntil=now+4000;
   if(change==='warp')p.mapId='elsewhere';
   if(change==='logout')w.players.delete(p.id);
   if(change==='safe'){p.x=20;p.y=20;}
   if(change==='leash')m.hx=-2000;
   if(change==='return')m.returning=true;
   if(change==='respawn')m.monsterCast=null;
   finish(w);assert.equal(w.hits.length,0,type+' '+change);checks++;
  }
 }
 const {w,m,p}=fixture('wolf');assert(!w.startMonsterSkill(m,p,now),'Low-level normal monsters have no new skill');
 const cone={shape:'cone',x:0,y:0,range:200,a:Math.PI-.1,angle:1};
 assert(C.monsterSkillContains(cone,-150,-10));assert(!C.monsterSkillContains(cone,150,0));assert(!C.monsterSkillContains(cone,-201,0));
 console.log(JSON.stringify({species:all.length,highLevelSkills:high.length,combatScenarios:checks,geometry:'circle and wrapped cone pass'}));
}finally{Date.now=original;}
