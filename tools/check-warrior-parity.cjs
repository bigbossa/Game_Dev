const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../shared/world-data'),World=require('../server/world');
const oldNow=Date.now;let now=10000,count=0;
function setup(faction,pvp){
  const w=Object.create(World.prototype),events=[];
  w.maps={arena:{def:{pvp,camp:{x0:0,y0:0,x1:1,y1:1}},map:{w:100,h:100,solid:new Uint8Array(10000)},monsters:[]}};
  w.players=new Map();w.parties=new Map();w.timers=[];w.emitNear=(mid,x,y,event,d)=>events.push({event,...d});
  w.applyDamage=(p,t)=>{t.hp--;return 1;};
  const p={id:'p1',cls:'warrior',faction,lvl:130,x:2000,y:2000,mapId:'arena',hp:1000,mp:10000,stats:C.playerStats('warrior',130,{},{}),cds:{},buffs:{},skl:C.cleanSkills('warrior',null,130),socket:{emit:(event,d)=>events.push({event,...d})}};
  const t={id:pvp?'p2':'m2',cls:pvp?'spearman':undefined,faction:C.enemyOf(faction),x:2080,y:2000,mapId:'arena',hp:1000,def:{radius:20},stats:C.playerStats('spearman',130,{},{}),buffs:{}};
  w.players.set(p.id,p);if(pvp)w.players.set(t.id,t);else w.maps.arena.monsters.push(t);
  const wall=()=>{w.maps.arena.map.solid[Math.floor(p.y/48)*100+Math.floor(2040/48)]=1;};
  const flush=()=>{for(const q of w.timers){now=q.at;q.fn();}w.timers=[];};
  return {w,p,t,events,wall,flush};
}
try{
  Date.now=()=>now;
  for(const faction of ['dharma','adharma'])for(const pvp of [false,true])for(const skill of ['guardSlash','shieldBash','sunderStrike']){
    for(const scenario of ['blocked','wallAfter','rangeAfter','rootAfter','success']){
      const f=setup(faction,pvp),before=f.p.mp;
      f.p.skl.sk[skill]=1;if(scenario==='blocked')f.wall();
      // A stale facing angle still faces the locked valid melee target.
      f.w.castSkill(f.p,{id:skill,tid:f.t.id,a:Math.PI/3});
      if(scenario==='blocked'){assert.equal(f.p.mp,before);assert.equal(f.events.length,0);count++;continue;}
      const start=f.events.find(e=>e.t===skill);assert(start);assert.equal(start.tid,f.t.id);assert.equal(start.a,0);
      assert(!f.events.some(e=>e.t==='frontlineHit'),'No predicted impact');
      if(scenario==='wallAfter')f.wall();if(scenario==='rangeAfter')f.t.x+=1000;if(scenario==='rootAfter')f.p.rootUntil=now+1000;
      f.flush();
      const event=f.events.find(e=>e.t===(scenario==='success'?'frontlineHit':'frontlineCancel'));
      assert(event,skill+' '+scenario);assert.equal(event.castId,start.castId);
      assert.equal(f.t.hp,scenario==='success'?999:1000);count++;
    }
  }
}finally{Date.now=oldNow;}
const entity={id:'p',skillMotion:{skill:'shieldBash',castId:2},atk:{}},context={C,window:{},G:{ents:new Map([['p',entity]]),mapId:'arena'},FX:{list:[]},SkillArts:{cancel(){},clear(){}},performance:{now:()=>100}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('public/js/skill-performance.js','utf8'),context);
const S=context.SkillPerformance;
S.play({t:'frontlineHit',id:'p',skill:'shieldBash',castId:1});assert(!entity.skillMotion.confirmed,'Stale impact ignored');
S.play({t:'frontlineHit',id:'p',skill:'shieldBash',castId:2});assert(entity.skillMotion.confirmed);
S.play({t:'frontlineCancel',id:'p',skill:'shieldBash',castId:1});assert(entity.skillMotion,'Stale cancel ignored');
context.FX.list=[{warriorArt:true,owner:'p',skill:'shieldBash'},{warriorArt:true,owner:'other',skill:'shieldBash'},{performanceArt:true,owner:'p',skill:'shieldBash'}];
S.play({t:'frontlineCancel',id:'p',skill:'shieldBash',castId:2});assert.equal(entity.skillMotion,null);assert.equal(entity.atk,null);assert.equal(context.FX.list.length,1);S.clear();assert.equal(context.FX.list.length,0);
context.ModelTiers={tierOf:l=>[1,15,30,50,60,80,100,130].filter(n=>l>=n).length-1};
vm.runInContext(fs.readFileSync('public/js/warrior-progression.js','utf8'),context);
for(const [lvl,ground,sashes,hair]of [[1,false,0,'short'],[29,false,0,'short'],[30,true,0,'medium'],[59,true,0,'medium'],[60,true,1,'long'],[99,true,1,'long'],[100,true,2,'royal'],[130,true,3,'royal']]){
  const s=context.WarriorProgression.state({lvl});assert.equal(s.ground,ground);assert.equal(s.sashes,sashes);assert.equal(s.hair,hair);
  for(const flag of ['dead','dying']){const d=context.WarriorProgression.state({lvl,[flag]:true});assert(!d.ground);assert.equal(d.sashes,0);}
}
console.log('PASS:',count,'authoritative casts, blocked paths, impact/cancel tokens, effect cleanup and level milestones');
