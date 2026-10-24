// Real combat, EXP, join and save handlers; in-memory store, no account/database changes.
const assert=require('node:assert/strict'),C=require('../shared/world-data'),World=require('../server/world'),Store=require('../server/store');
const oldNow=Date.now,oldRandom=Math.random;let now=100000,serial=0;const rows=[];
function fixture(){
 const w=Object.create(World.prototype);w.players=new Map();w.parties=new Map();w.bySocket=new Map();w.timers=[];w.seq=1;
 w.store=new Store(null);w.fund=w.loadFund();w.score={dharma:0,adharma:0};w.events=[];w.emitNear=(...a)=>w.events.push(a);w.systemChat=()=>{};
 w.maps={};for(const id of ['village','pass','pvp'])w.maps[id]={def:C.MAPS[id],map:{w:200,h:200,solid:new Uint8Array(40000)},monsters:[]};
 w.monsters=[];w.canPk=()=>true;w.markPk=()=>{};w.killPlayer=w.killMonster=t=>{t.dead=true;};
 return w;
}
function player(w,cls,lvl,faction='dharma'){
 const stats=C.playerStats(cls,lvl,{weapon:'w0'},{}),p={id:'p'+ ++serial,cls,lvl,faction,mapId:'village',x:2000,y:2000,
  stats,hp:stats.maxHp,mp:stats.maxMp,eq:{weapon:'w0'},alloc:{},buffs:{},cds:{},dots:[],lastHurt:0,lastHitAt:0,
  skl:C.cleanSkills(cls,null,lvl),socket:{emit(){}},exp:0,pk:false};w.players.set(p.id,p);return p;
}
function monster(p,boss=false){return {id:'m'+ ++serial,mapId:p.mapId,x:2080,y:2000,hx:2080,hy:2000,hp:1e7,
 def:{lvl:p.lvl,atk:100,def:10,radius:20,boss,exp:100},dots:[],threat:new Map(),target:p.id};}
try{
 Date.now=()=>now;Math.random=()=>.5;
 for(let lvl=1;lvl<=130;lvl++){
  const k=C.beginnerStrength(lvl);assert(k>=0&&k<=1);if(lvl>20)assert.equal(k,0);
  if(lvl>1)assert(k<=C.beginnerStrength(lvl-1));
 }
 for(const v of [NaN,undefined,0,-1,Infinity])assert.equal(C.beginnerStrength(v),0);
 for(const cls of C.CLASS_IDS)for(const faction of ['dharma','adharma'])for(const lvl of [1,10,15,20,21,30]){
  const w=fixture(),p=player(w,cls,lvl,faction),m=monster(p),real=w.beginnerSupport;
  const dealt=w.applyDamage(p,m,1,{proc:true}),taken=w.applyDamage(m,p,1,{proc:true});
  p.hp=p.stats.maxHp;p.dead=false;w.beginnerSupport=()=>0;
  const baseDealt=w.applyDamage(p,m,1,{proc:true}),baseTaken=w.applyDamage(m,p,1,{proc:true});
  w.beginnerSupport=real;const k=C.beginnerStrength(lvl);
  assert(Math.abs(dealt-baseDealt*(1+C.BEGINNER.dealt*k))<=1.5,cls+' outgoing');
  assert(Math.abs(taken-baseTaken*(1-C.BEGINNER.reduce*k))<=1.5,cls+' incoming');
  if(lvl>20){assert.equal(dealt,baseDealt);assert.equal(taken,baseTaken);}
  if(faction==='dharma')rows.push({cls,lvl,dealt,baseDealt,taken,baseTaken});
 }
 console.log('PASS: 72 class/faction/level combat cases; smooth taper and unchanged Lv.21+.');
 {
  const w=fixture(),p=player(w,'arbiter',10),m=monster(p);
  for(const reason of ['boss','highMonster','otherMap','pk','pkFight','player']){
   const q={...p},t={...m,def:{...m.def}};
   if(reason==='boss')t.def.boss=true;if(reason==='highMonster')t.def.lvl=21;
   if(reason==='otherMap')q.mapId=t.mapId='pass';if(reason==='pk')q.pk=true;
   if(reason==='pkFight')q.pkFight=now+1000;if(reason==='player')t.socket={emit(){}};
   assert.equal(w.beginnerSupport(q,t),0,reason);
  }
  const opponent=player(w,'archer',10,'adharma');opponent.hp=1e5;
  const a=w.applyDamage(p,opponent,1,{proc:true});w.beginnerSupport=()=>0;
  assert.equal(w.applyDamage(p,opponent,1,{proc:true}),a,'PvP unchanged');
 }
 console.log('PASS: no assistance against bosses/high-level monsters, outside village, PK or PvP.');
 {
  const w=fixture(),p=player(w,'dualblade',10),other=player(w,'taoist',25),m=monster(p);
  p.party=other.party='team';w.parties.set('team',{members:[p.id,other.id],rules:{...C.PARTY_DEFAULT}});
  const gains=new Map();w.gainExp=(q,n)=>gains.set(q.id,n);w.shareExp(p,m);const assisted=new Map(gains);
  const real=w.beginnerSupport;w.beginnerSupport=()=>0;w.shareExp(p,m);
  assert(Math.abs(assisted.get(p.id)-gains.get(p.id)*1.25)<=1);assert.equal(assisted.get(other.id),gains.get(other.id));
  w.beginnerSupport=real;p.pk=true;w.shareExp(p,m);assert.equal(gains.get(p.id),Math.round(assisted.get(p.id)/1.25));
 }
 console.log('PASS: party EXP assistance is individual; veterans and PK gain no extra bonus.');
 {
  const w=fixture(),p=player(w,'warrior',1);p.hp=p.mp=1;
  w.beginnerRest(p,now,1);assert.equal(p.hp,1+p.stats.maxHp*.028);assert.equal(p.mp,1+p.stats.maxMp*.025);
  for(const block of ['recentHurt','recentAttack','casting','dot','dead','pk','pkFight','outside','highLevel']){
   const q={...p,hp:1,mp:1,dots:[]};
   if(block==='recentHurt')q.lastHurt=now-3999;if(block==='recentAttack')q.lastHitAt=now-3999;
   if(block==='casting')q.actUntil=now+1000;if(block==='dot')q.dots=[{}];if(block==='dead')q.dead=true;
   if(block==='pk')q.pk=true;if(block==='pkFight')q.pkFight=now+1000;if(block==='outside')q.mapId='pass';if(block==='highLevel')q.lvl=21;
   w.beginnerRest(q,now,1);assert.equal(q.hp,1,block);assert.equal(q.mp,1,block);
  }
  p.hp=p.stats.maxHp-.01;p.mp=p.stats.maxMp-.01;w.beginnerRest(p,now,1);assert.equal(p.hp,p.stats.maxHp);assert.equal(p.mp,p.stats.maxMp);
 }
 console.log('PASS: rest requires four seconds without attacks/damage/casts; no DOT, death or PK regeneration; capped resources.');
 {
  const w=fixture();
  for(const [i,cls]of C.CLASS_IDS.entries()){
   const socket={id:'new'+i,data:{account:{id:i+1}},emit(){}},name='Beginner'+i;let result;
   w.join(socket,{create:true,name,cls,faction:i%2?'adharma':'dharma'},r=>result=r);assert(result.ok,JSON.stringify(result));
   const p=w.bySocket.get(socket.id);assert.equal(p.gold,320);
   for(const [id,n]of C.BEGINNER.supplies)assert(p.inv.includes(C.stackKey(id,n)));
   p.inv[p.inv.indexOf('potHpS*12')]='potHpS*11';p.gold=20;w.save(p);w.players.delete(p.id);w.bySocket.delete(socket.id);
   w.join(socket,{name},r=>result=r);assert(result.ok);const again=w.bySocket.get(socket.id);
   assert.equal(again.gold,20);assert(again.inv.includes('potHpS*11'));assert(!again.inv.includes('potHpS*12'));
   assert.equal(again.cls,cls);assert.equal(result.note,'');
  }
  w.store.put({name:'Existing',accountId:99,lvl:1,cls:'arbiter',faction:'dharma',gold:7,inv:['potMpS*3'],eq:{weapon:'w0'}});
  const socket={id:'old',data:{account:{id:99}},emit(){}};let result;w.join(socket,{name:'Existing'},r=>result=r);
  assert(result.ok);const p=w.bySocket.get('old');assert.equal(p.gold,7);assert.deepEqual(p.inv.filter(Boolean),['potMpS*3']);assert.equal(w.beginnerSupport(p),1);
 }
 console.log('PASS: real creation for six classes, starter supplies saved once, reconnect preserves consumption; existing saves retain inventory and receive PvE help.');
 console.table(rows.filter(r=>r.cls==='arbiter'));
}finally{Date.now=oldNow;Math.random=oldRandom;}
