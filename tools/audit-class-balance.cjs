// Reproducible offline balance data from the live combat handlers. No persistence or accounts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../shared/world-data'),World=require('../server/world');
const out=path.join(__dirname,'../artifacts/class-balance-audit');
const seeds=[11,222,3333,4444,5555,6666],levels=[1,10,30,60,90,120,130];
const gears=[['Normal+0',0,0],['Epic+0',2,0],['Mythic+10',5,10]];
const originalNow=Date.now,originalRandom=Math.random;let now=100000;
const round=n=>Math.round(n*100)/100;
function gear(lvl,grade,plus,seed){
  const best=list=>list.filter(b=>b.lvl<=lvl).at(-1),eq={};
  for(const b of [best(C.WEAPONS),...C.ARMOR_SLOTS.map(s=>best(C.ARMORS.filter(b=>b.slot===s)))].filter(Boolean))eq[b.slot]=C.plusId(C.gradeId(b.id,grade,seed),plus);
  return eq;
}
function fixture(cls,lvl,grade,plus,seed,mode='single80',faction='dharma'){
  now=100000;Math.random=C.mulberry32(seed);
  const w=Object.create(World.prototype);w.players=new Map();w.parties=new Map();w.mById=new Map();w.timers=[];
  w.maps={lab:{def:{pvp:mode==='pvp80',gates:[],camp:{x0:0,y0:0,x1:4,y1:4}},map:{w:200,h:200,solid:new Uint8Array(40000)},monsters:[]}};
  w.emitNear=w.alertPack=()=>{};w.killPlayer=w.killMonster=t=>{t.dead=true;};
  const eq=gear(lvl,grade,plus,seed),alloc=C.guideTarget(cls,lvl,C.statLimits(cls,lvl,eq,{})),s=C.playerStats(cls,lvl,eq,alloc);
  const p={id:'p',cls,lvl,faction,stats:s,eq,alloc,x:2000,y:2000,mapId:'lab',hp:s.maxHp,mp:s.maxMp,
    cds:{},dots:[],buffs:{},lockUntil:0,skl:C.cleanSkills(cls,null,lvl),socket:{emit(){}}};w.players.set(p.id,p);
  assert(C.skillPtsFree(p.skl,lvl)>=0);assert(C.statPtsFree(alloc,lvl)>=0);
  const targets=[];
  for(let i=0;i<(mode==='pack5'?5:1);i++){
    let t;
    if(mode==='pvp80'){
      const stats=C.playerStats('dualblade',lvl,eq,C.guideTarget('dualblade',lvl,C.statLimits('dualblade',lvl,eq,{})));
      t={id:'target',cls:'dualblade',lvl,stats,faction:C.enemyOf(faction),socket:{emit(){}},buffs:{},mapId:'lab',dots:[]};w.players.set(t.id,t);
    }else{
      t={id:'m'+i,def:{...C.monStats(lvl,mode==='boss80'),lvl,radius:mode==='boss80'?58:20,boss:mode==='boss80'},mapId:'lab',dots:[],threat:new Map(),target:p.id};
      w.maps.lab.monsters.push(t);w.mById.set(t.id,t);
    }
    t.x=2000+(mode==='single300'?300:80)+(mode==='pack5'?(i%3)*25:0);t.y=2000+(mode==='pack5'?Math.floor(i/3)*30-15:0);
    t.hp=1e12;targets.push(t); // No overkill; execute bonuses deliberately do not trigger.
  }
  let damage=0,hits=0,healing=0,casts=0;
  const apply=World.prototype.applyDamage,heal=World.prototype.healPlayer;
  w.applyDamage=function(src,tgt,mult,opts){const v=apply.call(this,src,tgt,mult,opts);if(src===p&&targets.includes(tgt)){damage+=v;if(v)hits++;}return v;};
  w.healPlayer=function(t,v){if(t===p)healing+=v;return heal.call(this,t,v);};
  const step=()=>{const due=w.timers.filter(t=>t.at<=now);w.timers=w.timers.filter(t=>t.at>now);for(const t of due)t.fn();for(const t of targets)w.processDots(t,now);};
  const cast=id=>{const old=p.cds[id];w.castSkill(p,{id,a:0,tid:targets[0].id,tx:targets[0].x,ty:targets[0].y});if(p.cds[id]!==old)casts++;};
  return {w,p,step,cast,result:()=>({damage,hits,rawSelfHeal:healing,casts})};
}
function basic(cls,lvl,g,plus,seed,faction){
  const f=fixture(cls,lvl,g,plus,seed,'single80',faction),start=now;
  for(;now<start+60000;now+=50){f.step();f.cast(C.basicOf(cls).id);}f.step();
  return {...f.result(),dps:f.result().damage/60,p:f.p};
}
function single(cls,lvl,seed,mode,sk,faction='dharma'){
  const f=fixture(cls,lvl,2,0,seed,mode,faction);f.cast(sk.id);
  const buffs=JSON.parse(JSON.stringify(f.p.buffs)),start=now;
  for(;now<=start+20000;now+=50)f.step();assert.equal(f.w.timers.length,0);
  return {...f.result(),buffs};
}
const avg=(rows,k)=>round(rows.reduce((sum,r)=>sum+r[k],0)/rows.length);
function csv(file,rows){const cols=Object.keys(rows[0]),cell=x=>'"'+String(typeof x==='object'?JSON.stringify(x):x).replaceAll('"','""')+'"';
  fs.writeFileSync(path.join(out,file),'\uFEFF'+[cols,...rows.map(r=>cols.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\n')+'\n');}
try{
  Date.now=()=>now;const baselines=[],stats=[],skills=[];let parity=0;
  for(const lvl of levels)for(const cls of C.CLASS_IDS)for(const [name,g,plus]of gears){
    const runs=seeds.map(seed=>basic(cls,lvl,g,plus,seed,'dharma'));
    for(let i=0;i<seeds.length;i++){assert.equal(basic(cls,lvl,g,plus,seeds[i],'adharma').damage,runs[i].damage);parity++;}
    baselines.push({cls,name:C.CLASSES[cls].name,lvl,gear:name,dps60:avg(runs,'dps'),minSeedDps:round(Math.min(...runs.map(r=>r.dps))),maxSeedDps:round(Math.max(...runs.map(r=>r.dps))),casts60:avg(runs,'casts'),hits60:avg(runs,'hits')});
    for(let i=0;i<runs.length;i++){const p=runs[i].p,s=p.stats;stats.push({cls,lvl,gear:name,seed:seeds[i],hp:s.maxHp,mp:s.maxMp,atk:s.atk,def:s.def,crit:s.crit,
      basicCdMs:C.basicCd(C.basicOf(cls),s.aspd),evasion:s.evasion,speed:s.speed,attackMoveSpeed:round(s.speed*C.roleOf(cls).attackMove),mpRegenSecond:round(s.maxMp*C.roleOf(cls).manaRegen),alloc:p.alloc,learned:p.skl.sk,evolutions:p.skl.ev,gearFx:s.fx});}
  }
  for(const lvl of [60,100,130])for(const cls of C.CLASS_IDS){const learned=C.cleanSkills(cls,null,lvl);
    for(const sk of C.CLASSES[cls].skills.filter(s=>learned.sk[s.id]))for(const mode of ['single80','single300','boss80','pack5','pvp80']){
      const runs=seeds.map(seed=>single(cls,lvl,seed,mode,sk));
      const dark=single(cls,lvl,seeds[0],mode,sk,'adharma'),light=JSON.parse(JSON.stringify(runs[0]));
      // Arbiter Aegis has equal defensive power with intentional accuracy/evasion faction traits.
      if(sk.id==='oathAegis')for(const r of [dark,light]){delete r.buffs.oathAegis.accuracy;delete r.buffs.oathAegis.evasion;}
      assert.deepEqual(dark,light);parity++;
      skills.push({cls,lvl,id:sk.id,name:sk.name,mode,skillLevel:learned.sk[sk.id],rank:C.skillRankOf(learned,sk.id),baseCooldownMs:sk.cd,mpCost:C.skillMp(sk,lvl),damage:avg(runs,'damage'),hits:avg(runs,'hits'),rawSelfHeal:avg(runs,'rawSelfHeal'),casts:avg(runs,'casts'),buffs:runs[0].buffs});
    }
  }
  assert.equal(new Set(skills.filter(r=>r.lvl===130).map(r=>r.id)).size,Object.keys(C.ALL_SKILLS).length);
  const crypto=require('node:crypto'),sourceSha256=Object.fromEntries(['shared/common.js','shared/world-data.js','server/world.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',f))).digest('hex')]));
  fs.mkdirSync(out,{recursive:true});const data={schema:1,sourceSha256,seeds,levels,factionParityChecks:parity,
    method:'60s basics, 20s isolated skill casts, 50ms server ticks; legal automatic skill/stat allocations, 6 gear/RNG seeds, actual gear procs/crit/DoT. Static targets without attacks, no movement AI, potions or party. Target current HP is infinite; no execute bonus. rawSelfHeal includes overheal. PvP target is one dualblade reference, not a win rate. Skill values cannot be summed as rotation DPS.',baselines,stats,skills};
  fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(data,null,2)+'\n');csv('basic-dps.csv',baselines);csv('stats.csv',stats);csv('skills.csv',skills);
  console.table(baselines.filter(r=>r.lvl===130&&r.gear==='Epic+0'));
  console.log(`PASS: ${baselines.length} DPS rows, ${stats.length} stats rows, ${skills.length} skill rows, ${parity} faction parity checks.`);
}finally{Date.now=originalNow;Math.random=originalRandom;}
