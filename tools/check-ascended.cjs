const assert=require('node:assert/strict');
const C=require('../shared/world-data'),World=require('../server/world');
const realNow=Date.now,realRandom=Math.random;let now=100000,count=0;
Date.now=()=>now;Math.random=()=>.5;
function fixture(cls,sk){
  const w=Object.create(World.prototype);w.players=new Map();w.parties=new Map();w.timers=[];w.events=[];
  w.maps={arena:{def:{pvp:false,gates:[]},map:{w:200,h:200,solid:new Uint8Array(40000)},monsters:[]}};
  w.emitNear=(...a)=>w.events.push(a);w.toast=()=>{};w.killMonster=t=>{t.dead=true};
  const stats=C.playerStats(cls,130,{},{}),p={id:'p',cls,lvl:130,faction:'dharma',stats,x:2000,y:2000,dir:0,mapId:'arena',hp:stats.maxHp,
    mp:5000,cds:{},dots:[],buffs:{},pot:{},lockUntil:0,skl:C.cleanSkills(cls,null,130),socket:{emit(){}}};
  p.skl.sk[sk.id]=1;w.players.set(p.id,p);
  const target=(id,x,y)=>{const t={id,x,y,mapId:'arena',hp:1e7,dots:[],def:{atk:100,def:10,hp:1e7,radius:20,speed:100,aggro:200},threat:new Map(),hx:x,hy:y};w.maps.arena.monsters.push(t);return t;};
  const x=p.x+(sk.ritual.range?100:0),y=p.y;
  const a=target('a',x,y),b=target('b',x+50,y+50),far=target('far',x+sk.ritual.radius+100,y);
  return{w,p,a,b,far,cast:()=>w.castSkill(p,{id:sk.id,tx:x,ty:y,a:0}),flush:()=>{while(w.timers.length){w.timers.sort((a,b)=>a.at-b.at);const t=w.timers.shift();now=t.at;t.fn();}}};
}
try{
  assert.equal(C.BAR_KEYS.length,11);
  for(const cls of C.CLASS_IDS){
    if(cls==='arbiter'){assert.equal(C.CLASSES[cls].skills.length,9);assert.equal(C.ALL_SKILLS.finalVerdict.lvl,110);continue;}
    const endgame=C.CLASSES[cls].skills.filter(s=>['0','-'].includes(s.key));assert.equal(endgame.length,2);
    const arts=endgame.filter(s=>s.ritual);
    for(const lvl of [119,120,129,130]){
      const s=C.cleanSkills(cls,null,lvl);assert(C.skillPtsFree(s,lvl)>=0);
      const old=JSON.parse(JSON.stringify(s));old.bar=old.bar.slice(0,9);
      const fixed=C.cleanSkills(cls,old,lvl);assert.deepEqual(fixed.bar.slice(0,9),old.bar);assert.deepEqual(fixed.bar.slice(9),endgame.map(s=>s.id));
    }
    for(const sk of arts){
      const f=fixture(cls,sk);f.cast();assert.equal(f.a.hp,1e7,'no early damage');assert.equal(f.p.mp,5000-C.skillMp(sk,130));
      // no long channel: the move's hits start right after the short wind-up and the finishing blow lands at cast
      const R=sk.ritual,at=f.w.timers.map(t=>t.at-now).sort((x,y)=>x-y);
      assert.equal(f.p.lockUntil,now+R.cast+650);assert.equal(at.length,R.hits+1);
      assert.equal(at[0],R.first??R.windup);assert.equal(at.at(-1),R.cast);assert(R.cast<=1100,'the whole move takes about a second');
      // the hits add up to the old single blast (each part only takes its share of the armour)
      {const ref=fixture(cls,sk),mult=C.skillPower(1,0),hp=ref.a.hp;ref.w.applyDamage(ref.p,ref.a,R.damage*mult);const whole=hp-ref.a.hp;
       const g=fixture(cls,sk);g.cast();g.flush();const split=1e7-g.a.hp;
       assert(Math.abs(split-whole)<=R.hits+1,`${sk.id}: split ${split} vs single blast ${whole}`);}
      const oldMp=f.p.mp;f.cast();assert.equal(f.p.mp,oldMp,'no cast during channel');
      const oldX=f.p.x;f.w.onInput(f.p,{x:oldX+20,y:f.p.y,moving:true,dir:0});assert.equal(f.p.x,oldX,'channel locks movement');
      f.flush();assert(f.a.hp<1e7&&f.b.hp<1e7,'AoE hits both');assert.equal(f.far.hp,1e7);
      assert(f.w.events.some(e=>e.at(-1)?.t==='ritualRelease'));count++;
      for(const mode of ['death','warp','disconnect','stun','root']){
        const q=fixture(cls,sk);q.cast();
        if(mode==='death')q.p.dead=true;
        if(mode==='warp')q.p.mapId='elsewhere';
        if(mode==='disconnect')q.w.players.delete(q.p.id);
        if(mode==='stun'||mode==='root'){q.w.applyControl(q.p,{[mode]:1500},now);assert.equal(q.p.ritual,null);assert.equal(q.p.lockUntil,0);}
        q.flush();assert.equal(q.a.hp,1e7,mode);assert.equal(q.b.hp,1e7,mode);assert(!q.w.events.some(e=>e.at(-1)?.t==='ritualRelease'));count++;
      }
      for(const mode of ['level','unlearned','mp','root']){
        const q=fixture(cls,sk);if(mode==='level')q.p.lvl=sk.lvl-1;if(mode==='unlearned')delete q.p.skl.sk[sk.id];if(mode==='mp')q.p.mp=0;if(mode==='root')q.p.rootUntil=now+1000;
        const mp=q.p.mp;q.cast();assert.equal(q.w.timers.length,0);assert.equal(q.p.mp,mp);count++;
      }
      const q=fixture(cls,sk);q.w.castSkill(q.p,{id:sk.id,tx:999999,ty:2000,a:0});
      assert(Math.abs(Math.hypot(q.p.ritual.x-q.p.x,q.p.ritual.y-q.p.y)-sk.ritual.range)<.01,'aim range clamp');
      // Existing PvP faction/safe-zone checks are still exercised by applyDamage.
      const z=fixture(cls,sk);z.w.maps.arena.def.pvp=true;
      const ally={...z.p,id:'ally',stats:{...z.p.stats,maxHp:1e7},hp:1e7,socket:{emit(){}},x:z.a.x};z.w.players.set('ally',ally);
      z.cast();z.flush();assert.equal(ally.hp,1e7,'same-faction ally protected');
      const learn=fixture(cls,sk);learn.p.skl={v:C.SKILL_VER,sk:{},ev:{},bar:Array(11).fill(null)};
      learn.w.save=()=>{};learn.w.sendSkills=()=>{};learn.p.lvl=sk.lvl-1;
      learn.w.onSkills(learn.p,{cmd:'up',id:sk.id});assert(!learn.p.skl.sk[sk.id]);
      learn.p.lvl=sk.lvl;learn.w.onSkills(learn.p,{cmd:'up',id:sk.id});assert.equal(learn.p.skl.sk[sk.id],1);
      assert.equal(learn.p.skl.bar[C.BAR_KEYS.indexOf(sk.key)],sk.id,'learning places new hotkey');
    }
  }
  const drops=new Set(Object.values(C.DROPS).flatMap(d=>d.items.map(([id])=>id)));
  for(const id of ['w11','w12','sh8','sh9','pa8','pa9','br8','br9','sd8','sd9']){
    assert(drops.has(id),id+' obtainable');
    for(let grade=0;grade<6;grade++)for(const plus of [0,10]){
      const it=C.ITEMS[C.makeKey(id,grade,27,plus)];assert(it,id+' valid variant');
      for(const k of ['atk','def','hp','mp','speed','crit'])if(it[k]!==undefined)assert(Number.isFinite(it[k]),id+' '+k);
    }
  }
  console.log(JSON.stringify({combatCases:count,newSkills:8,gearBases:10,variantChecks:120,oldBarsPreserved:true}));
}finally{Date.now=realNow;Math.random=realRandom;}
