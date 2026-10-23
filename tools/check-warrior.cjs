const assert = require('node:assert/strict');
const C = require('../shared/world-data'), World = require('../server/world');
const originalNow = Date.now, originalRandom = Math.random;
let now = 100000, serial = 0, cases = 0;
function fixture(pvp = false, faction = 'dharma') {
  const w = Object.create(World.prototype);
  w.players = new Map(); w.parties = new Map(); w.timers = [];
  w.maps = { arena: { def: { pvp, gates: [], camp: { x0: 0, y0: 0, x1: 4, y1: 4 } },
    map: { w: 200, h: 200, solid: new Uint8Array(40000) }, monsters: [] } };
  w.emitNear = w.alertPack = () => {}; w.killPlayer = w.killMonster = t => { t.dead = true; };
  function player(cls, f) {
    const stats = C.playerStats(cls, 130, {}, {});
    const p = { id: 'p' + ++serial, cls, lvl: 130, faction: f, stats, x: 2000, y: 2000, mapId: 'arena',
      hp: stats.maxHp, mp: stats.maxMp, cds: {}, dots: [], buffs: {}, lockUntil: 0,
      skl: C.cleanSkills(cls, null, 130), socket: { emit() {} } };
    w.players.set(p.id, p); return p;
  }
  const p = player('warrior', faction);
  const t = pvp ? player('dualblade', C.enemyOf(faction)) : {
    id: 'm' + ++serial, mapId: 'arena', dots: [], threat: new Map(), target: null,
    def: { atk: 100, def: 10, radius: 20, hp: 1e7, speed: 100, aggro: 200 } };
  t.x = 2080; t.y = 2000; t.hp = 1e7;
  if (!pvp) Object.assign(t, { hx: t.x, hy: t.y, wx: t.x, wy: t.y, nextAtk: Infinity,
    nextSpecial: Infinity, nextWander: Infinity });
  w.moveToward = () => {};
  if (!pvp) w.maps.arena.monsters.push(t);
  return { w, p, t, player };
}
function flush(w) { while (w.timers.length) { w.timers.sort((a,b) => a.at-b.at); const t=w.timers.shift(); now=Math.max(now,t.at); t.fn(); } }
function cast(f, id, rank = 0) {
  f.p.skl.sk[id] = 12; f.p.skl.ev[id] = rank;
  f.w.castSkill(f.p, { id, tid: f.t.id, a: 0 }); cases++;
}
try {
  Date.now = () => now; Math.random = () => .5;
  assert.deepEqual(C.CLASS_IDS, ['dualblade','taoist','archer','spearman','warrior']);
  for (let lvl=1;lvl<=130;lvl++) {
    const s=C.statsFor('warrior',lvl), skills=C.cleanSkills('warrior',null,lvl);
    assert(C.skillPtsFree(skills,lvl)>=0);
    assert.deepEqual(C.cleanSkills('warrior',JSON.parse(JSON.stringify(skills)),lvl),skills);
    assert(s.maxHp>C.statsFor('spearman',lvl).maxHp);
    assert(s.def>C.statsFor('taoist',lvl).def);
    assert(s.atk<C.statsFor('dualblade',lvl).atk);
  }
  for(const faction of ['dharma','adharma']) for(const pvp of [false,true])
    for(const sk of C.CLASSES.warrior.skills) for(let rank=0;rank<=sk.evo.length;rank++) {
      const f=fixture(pvp,faction), hp=f.t.hp, front=sk.frontline||{};
      cast(f,sk.id,rank); flush(f.w);
      assert.equal(f.p.hp,f.p.stats.maxHp,'tank has no self-heal or self-damage');
      if(front.damage||sk.ritual) assert(f.t.hp<hp,sk.id+' hits');
      else assert.equal(f.t.hp,hp,sk.id+' does not deal damage');
      if(front.ward) assert(f.w.buffVal(f.p,'frontGuard')>0,sk.id+' protects');
      if(front.taunt) {
        if(pvp) assert.equal(f.t.controlEpoch,undefined,'taunt cannot force or CC players');
        else assert.equal(f.t.target,f.p.id,'taunt takes aggro');
      }
      if(front.damage) for(const stop of ['stun','root','death','warp','targetWarp','despawn','range']) {
        const z=fixture(pvp,faction), before=z.t.hp;
        cast(z,sk.id,rank);
        if(stop==='stun'||stop==='root') z.w.applyControl(z.p,{[stop]:1000},now);
        if(stop==='death')z.p.dead=true;
        if(stop==='warp')z.p.mapId='other';
        if(stop==='targetWarp'){z.t.mapId='other';if(!pvp)z.w.maps.arena.monsters=[];}
        if(stop==='despawn'){z.w.players.delete(z.t.id);z.w.maps.arena.monsters=[];}
        if(stop==='range')z.t.x+=1000;
        flush(z.w);assert.equal(z.t.hp,before,sk.id+' interrupted by '+stop);
      }
    }
  // Invalid melee targets never spend resources or start cooldowns.
  for(const sk of C.CLASSES.warrior.skills.filter(s=>s.frontline&&s.frontline.damage&&!s.frontline.area)) {
    const f=fixture(),mp=f.p.mp;
    f.w.castSkill(f.p,{id:sk.id,tid:'missing',a:0});
    assert.equal(f.p.mp,mp);assert.equal(f.p.cds[sk.id],undefined);
  }
  // Highest tank ward wins; caster cannot multiply mitigation by rotating four wards.
  {
    const f=fixture(true),p=f.p;
    f.w.addBuff(p,'ironGuard',10000,{frontGuard:.3},.3);
    f.w.addBuff(p,'rallyGuard',10000,{frontGuard:.16},.16);
    f.w.addBuff(p,'lastBastion',10000,{frontGuard:.4},.4);
    assert.equal(f.w.buffVal(p,'frontGuard'),.4);
    p.buffs={};const raw=f.w.applyDamage(f.t,p,1);
    p.hp=p.stats.maxHp;
    f.w.addBuff(p,'aegis',10000,{guard:.4},.4);
    f.w.addBuff(p,'lastBastion',10000,{frontGuard:.4},.4);
    const guarded=f.w.applyDamage(f.t,p,1);
    assert(Math.abs(guarded-raw*.6)<=1,'tank + healer ward must remain 40%, not 80%');
    now+=10001;assert.equal(f.w.buffVal(p,'frontGuard'),0);
  }
  // Party, distance, faction and map restrictions apply to protection.
  {
    const f=fixture(true),ally=f.player('archer','dharma'),far=f.player('taoist','dharma'),enemy=f.t;
    f.p.party=ally.party=far.party=enemy.party='pt';
    f.w.parties.set('pt',{members:[f.p.id,ally.id,far.id,enemy.id]});far.x+=1000;
    cast(f,'rallyGuard',1);
    assert.equal(f.w.buffVal(ally,'frontGuard'),.16);
    assert.equal(f.w.buffVal(far,'frontGuard'),0);assert.equal(f.w.buffVal(enemy,'frontGuard'),0);
    ally.mapId='elsewhere';ally.buffs={};f.p.cds={};f.p.gcd=0;
    cast(f,'rallyGuard',1);assert.equal(f.w.buffVal(ally,'frontGuard'),0);
  }
  // Boss taunt is short, does not interrupt a boss attack, and cannot chain immediately.
  {
    const f=fixture();f.t.def.boss=true;f.t.monsterCast={token:'ongoing'};
    cast(f,'battleCry',2);assert.equal(f.t.nextRetarget,now+1500);
    const first=f.t.tauntImmuneUntil;f.p.cds={};f.p.gcd=0;
    now+=2000;cast(f,'battleCry',2);assert.equal(f.t.tauntImmuneUntil,first);
    assert.equal(f.t.monsterCast.token,'ongoing');
    f.t.target=null;f.p.cds={};f.p.gcd=0;now=first+1;
    cast(f,'battleCry',2);assert.equal(f.t.target,f.p.id);
  }
  // Stronger living ward cannot be replaced/extended by a weaker same-skill cast.
  {
    const f=fixture();f.w.addBuff(f.p,'ironGuard',6000,{frontGuard:.3},.3);
    const until=f.p.buffs.ironGuard.until;now+=1000;
    assert.equal(f.w.addBuff(f.p,'ironGuard',6000,{frontGuard:.25},.25),false);
    assert.equal(f.p.buffs.ironGuard.until,until);
  }
  // Taunt changes only the temporary target; boss XP and loot credit remain real damage.
  {
    const f=fixture(),attacker=f.player('archer','dharma'),earned=new Map();
    f.t.def.boss=true;f.t.def.exp=1000;f.t.def.respawn=60000;
    f.t.target=attacker.id;f.t.threat.set(attacker.id,100000);
    const ledger=[...f.t.threat];cast(f,'battleCry',2);
    assert.deepEqual([...f.t.threat],ledger,'taunt must not fabricate damage credit');
    f.w.gainExp=(p,n)=>earned.set(p.id,n);
    f.w.rollLoot=(p,type,opts)=>assert.deepEqual(opts.recipients,[attacker]);
    f.w.reap=f.w.systemChat=()=>{};
    World.prototype.killMonster.call(f.w,f.t,attacker);
    assert.equal(earned.has(f.p.id),false,'zero-damage taunt must not steal boss XP');
    assert.equal(earned.get(attacker.id),Math.round(1000*C.levelExpMul(attacker.lvl)));
  }
  // A temporary target ends on expiry or invalidation, without destroying the prior fight.
  for(const boss of [false,true]) for(const end of ['expiry','death','map','logout','safe','range','leash']) {
    const f=fixture(),attacker=f.player('archer','dharma');
    f.t.def.boss=boss;f.t.target=attacker.id;f.t.threat.set(attacker.id,100000);
    cast(f,'battleCry',2);
    f.w.updateMonster(f.t,0,now);
    assert.equal(f.t.target,f.p.id,'forced target remains during taunt');
    const immune=f.t.tauntImmuneUntil;
    if(end==='expiry')now=f.t.taunt.until;
    if(end==='death'){f.p.dead=true;f.t.target=null;f.t.returning=true;}
    if(end==='map'){f.p.mapId='other';f.t.target=null;f.t.returning=true;}
    if(end==='logout'){f.w.players.delete(f.p.id);f.t.target=null;f.t.returning=true;}
    if(end==='safe'){f.p.x=50;f.p.y=50;}
    if(end==='range')f.p.x+=1000;
    if(end==='leash')f.t.hx-=1000;
    f.w.updateMonster(f.t,0,now);
    assert.equal(f.t.taunt,null,end+' clears forced target');
    assert.equal(f.t.target,end==='leash'?null:attacker.id,end+' resumes prior fight or leash reset');
    assert.equal(f.t.tauntImmuneUntil,immune,'ending early cannot bypass taunt immunity');
    if(end!=='leash')assert.equal(f.t.threat.get(attacker.id),100000,'real damage credit survives');
  }
  // A monster nobody was fighting stays on the taunter after expiry (the taunt opened the fight; monsters never
  // pick one themselves) — still with no fabricated threat/credit — and lets go under the normal break rules.
  {
    const f=fixture();cast(f,'battleCry');now=f.t.taunt.until;
    f.w.updateMonster(f.t,0,now);assert.equal(f.t.target,f.p.id,'taunted monster keeps fighting the taunter');
    assert.equal(f.t.taunt,null);assert.equal(f.t.threat.size,0,'no fake damage credit');
    f.p.x+=1000;f.w.updateMonster(f.t,0,now+1);assert.equal(f.t.target,null,'breaks off once out of range');
  }
  // Real tank damage still earns credit; a dead prior target falls back to a living contributor.
  {
    const f=fixture(),attacker=f.player('archer','dharma');
    f.t.target=attacker.id;f.t.threat.set(attacker.id,100000);cast(f,'battleCry');
    const damage=f.w.applyDamage(f.p,f.t,1);
    assert.equal(f.t.threat.get(f.p.id),damage);
    attacker.dead=true;now=f.t.taunt.until;f.w.updateMonster(f.t,0,now);
    assert.equal(f.t.target,f.p.id,'actual damage can retain normal aggro after taunt');
    assert.equal(f.t.taunt,null);
  }
  for(const invalid of ['safe','leash']) {
    const f=fixture();
    if(invalid==='safe'){
      f.p.x=50;f.p.y=50;f.t.x=f.t.hx=150;f.t.y=f.t.hy=50;
    } else f.t.hx-=1000;
    cast(f,'battleCry');assert.equal(f.t.target,null,invalid+' cannot taunt');
    assert.equal(f.t.taunt,undefined);
  }
  // A second tank cannot take over during immunity; a new legal taunt works after it expires.
  {
    const f=fixture(),second=f.player('warrior','dharma');cast(f,'battleCry');
    const immunity=f.t.tauntImmuneUntil;
    second.skl.sk.battleCry=12;second.skl.ev.battleCry=0;
    f.w.castSkill(second,{id:'battleCry',a:0});assert.equal(f.t.target,f.p.id);
    now=immunity+1;f.w.updateMonster(f.t,0,now);second.cds={};second.gcd=0;
    f.w.castSkill(second,{id:'battleCry',a:0});assert.equal(f.t.target,second.id);
    assert.equal(f.t.threat.size,0);
  }
  // Every monster around turns on the warrior (no cap), and the shorter cooldown can re-taunt the same pack.
  {
    const f=fixture(),pack=[f.t];
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,m={...f.t,id:'pack'+i,threat:new Map(),target:null,dots:[],
      x:2000+Math.cos(a)*280,y:2000+Math.sin(a)*280};Object.assign(m,{hx:m.x,hy:m.y,wx:m.x,wy:m.y});f.w.maps.arena.monsters.push(m);pack.push(m);}
    const far={...f.t,id:'far',threat:new Map(),target:null,x:2400,y:2000};Object.assign(far,{hx:far.x,hy:far.y});f.w.maps.arena.monsters.push(far);
    cast(f,'battleCry');
    for(const m of pack)assert.equal(m.target,f.p.id,'every monster within range is taunted');
    assert.equal(far.target,null,'monsters outside the range are left alone');
    now+=C.ALL_SKILLS.battleCry.cd;for(const m of pack){f.w.updateMonster(m,0,now);m.target=null;}
    f.p.cds={};f.p.gcd=0;cast(f,'battleCry');
    for(const m of pack)assert.equal(m.target,f.p.id,'taunt can be recast on the same pack after the cooldown');
  }
  // Keys 0 / - are ascended arts like every other class's.
  assert.deepEqual(C.CLASSES.warrior.skills.filter(s=>s.ritual).map(s=>s.key),['0','-']);
  // โล่รับแทน: a party member near the warrior takes 30% less, the warrior takes that part (its wards shrink it).
  {
    const f=fixture(),ally=f.player('archer','dharma'),solo=fixture();
    f.p.party=ally.party='pt';f.w.parties.set('pt',{members:[f.p.id,ally.id]});ally.x=f.p.x+100;
    const alone=solo.player('archer','dharma');
    const full=solo.w.applyDamage(solo.t,alone,1),covered=f.w.applyDamage(f.t,ally,1),W=C.WARRIOR_COVER;
    assert.equal(covered,full-Math.floor(full*W.share),'ally takes 30% less');
    assert.equal(f.p.stats.maxHp-f.p.hp,Math.floor(full*W.share),'the warrior takes that 30%');
    f.p.hp=f.p.stats.maxHp;f.w.addBuff(f.p,'ironGuard',10000,{frontGuard:.3},.3);ally.hp=ally.stats.maxHp;
    f.w.applyDamage(f.t,ally,1);
    assert.equal(f.p.stats.maxHp-f.p.hp,Math.round(Math.floor(full*W.share)*.7),"the warrior's own ward shrinks its part");
    // too far, too hurt, dead or not in the party: no cover
    f.p.buffs={};f.p.hp=f.p.stats.maxHp;ally.x=f.p.x+W.range+50;
    assert.equal(f.w.applyDamage(f.t,ally,1),full,'out of range');ally.x=f.p.x+100;
    f.p.hp=Math.floor(f.p.stats.maxHp*W.minHp);assert.equal(f.w.applyDamage(f.t,ally,1),full,'warrior too hurt');
    f.p.hp=f.p.stats.maxHp;f.p.dead=true;assert.equal(f.w.applyDamage(f.t,ally,1),full,'dead warrior');f.p.dead=false;
    f.w.parties.set('pt',{members:[ally.id]});assert.equal(f.w.applyDamage(f.t,ally,1),full,'left the party');
    f.w.parties.set('pt',{members:[f.p.id,ally.id]});
    // a blow on the warrior itself is never split
    const self=f.w.applyDamage(f.t,f.p,1);f.p.hp=f.p.stats.maxHp;
    assert.equal(self,solo.w.applyDamage(solo.t,solo.p,1),'no cover for the warrior itself');
    // PvP: only half of the share
    const g=fixture(true),mate=g.player('archer','dharma'),lone=fixture(true),lm=lone.player('archer','dharma');
    g.p.party=mate.party='pt';g.w.parties.set('pt',{members:[g.p.id,mate.id]});mate.x=g.p.x+100;
    g.w.markPk=lone.w.markPk=()=>{};g.w.canPk=lone.w.canPk=()=>true;
    const pfull=lone.w.applyDamage(lone.t,lm,1),pcov=g.w.applyDamage(g.t,mate,1);
    assert.equal(pcov,pfull-Math.floor(pfull*W.share*W.pvp),'PvP cover is half');
  }
  console.log(`PASS: ${cases} warrior casts; both factions, PvE/PvP, interruption, taunt lifecycle/rewards/immunity, party wards, no stacking, progression and save roundtrip.`);
} finally { Date.now=originalNow;Math.random=originalRandom; }
