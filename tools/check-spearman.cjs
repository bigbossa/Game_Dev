const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { PNG } = require('pngjs');
const C = require('../shared/world-data'), World = require('../server/world');
const realNow = Date.now, realRandom = Math.random;
let now = 100000, seq = 0, casts = 0;
Date.now = () => now; Math.random = () => .5;
function fixture(faction = 'dharma', pvp = false) {
  const w = Object.create(World.prototype);
  w.players = new Map(); w.parties = new Map(); w.timers = []; w.events = [];
  w.maps = { arena: { def: { pvp, gates: [], camp: { x0: 0, y0: 0, x1: 4, y1: 4 } },
    map: { w: 200, h: 200, solid: new Uint8Array(40000) }, monsters: [] } };
  w.emitNear = (...args) => w.events.push(args);
  w.killMonster = w.killPlayer = t => { t.dead = true; };
  const makePlayer = (cls, f) => {
    const stats = C.playerStats(cls, 130, {}, {});
    const p = { id: 'p' + ++seq, cls, lvl: 130, faction: f, stats, x: 2000, y: 2000, dir: 0, mapId: 'arena',
      hp: stats.maxHp, mp: stats.maxMp, cds: {}, dots: [], buffs: {}, pot: {}, lockUntil: 0,
      skl: C.cleanSkills(cls, null, 130), socket: { emit() {} } };
    w.players.set(p.id, p); return p;
  };
  const p = makePlayer('spearman', faction);
  const enemy = () => {
    if (pvp) { const t = makePlayer('taoist', C.enemyOf(faction)); t.x += 80; t.hp = 1e7; t.stats.maxHp = 1e7; return t; }
    const t = { id: 'm' + ++seq, x: 2080, y: 2000, mapId: 'arena', hp: 1e7, dots: [],
      def: { atk: 100, def: 10, hp: 1e7, radius: 20, speed: 100, aggro: 200 }, threat: new Map(), target: null, hx: 2080, hy: 2000 };
    w.maps.arena.monsters.push(t); return t;
  };
  return { w, p, t: enemy(), other: enemy() };
}
function flush(w) {
  let n = 0;
  while (w.timers.length) {
    assert(++n < 1000); w.timers.sort((a,b) => a.at-b.at);
    const timer = w.timers.shift(); now = Math.max(now, timer.at); timer.fn();
  }
}
function cast(f, sk, rank = 0) {
  f.p.skl.sk[sk.id] = 12; f.p.skl.ev[sk.id] = rank;
  f.w.castSkill(f.p, { id: sk.id, tid: f.t.id, a: 0 }); casts++;
}
try {
  assert.deepEqual(C.CLASS_IDS.slice(0, 4), ['dualblade', 'taoist', 'archer', 'spearman']);
  for (let lvl = 1; lvl <= 130; lvl++) {
    const s = C.statsFor('spearman', lvl);
    for (const cls of ['dualblade', 'archer', 'taoist']) {
      const other = C.statsFor(cls, lvl);
      assert(s.atk > other.atk); assert(s.maxHp > other.maxHp);
      assert(s.def <= other.def); assert(s.crit < other.crit);
    }
    assert(s.maxMp > C.statsFor('archer', lvl).maxMp);
    const skills = C.cleanSkills('spearman', null, lvl);
    assert(C.skillPtsFree(skills, lvl) >= 0);
    assert.deepEqual(C.cleanSkills('spearman', JSON.parse(JSON.stringify(skills)), lvl), skills);
  }
  for (const faction of ['dharma','adharma']) for (const pvp of [false,true])
    for (const sk of C.CLASSES.spearman.skills.filter(s => s.spear)) for (let rank = 0; rank <= sk.evo.length; rank++) {
      const f = fixture(faction, pvp), hp = f.t.hp, otherHp = f.other.hp;
      cast(f, sk, rank); flush(f.w);
      assert(f.t.hp < hp, `${sk.id}/${rank} must damage its locked target`);
      if(C.spearSequence(sk,rank).at(-1).area)assert(f.other.hp<otherHp,`${sk.id}/${rank} final beat hits nearby enemies`);
      else assert.equal(f.other.hp, otherHp, `${sk.id}/${rank} stays single target`);
      assert.equal(f.other.dots.length, 0);
      assert.equal(f.other.breakUntil, undefined);
      for (const interruption of ['death','warp','range','stun','root','despawn','casterDeath','casterWarp','logout']) {
        const f = fixture(faction, pvp), hp = f.t.hp;
        cast(f, sk, rank);
        if (interruption === 'death') f.t.dead = true;
        if (interruption === 'warp') f.t.mapId = 'elsewhere';
        if (interruption === 'range') f.t.x += 1000;
        if (interruption === 'stun') { f.p.stunUntil = now + 5000; f.p.controlEpoch = 1; }
        if (interruption === 'root') { f.p.rootUntil = now + 5000; f.p.controlEpoch = 1; }
        if (interruption === 'logout') f.w.players.delete(f.p.id);
        if (interruption === 'despawn') { f.w.players.delete(f.t.id); f.w.maps.arena.monsters = []; }
        if (interruption === 'casterDeath') f.p.dead = true;
        if (interruption === 'casterWarp') f.p.mapId = 'elsewhere';
        const otherHp = f.other.hp;
        flush(f.w); assert.equal(f.t.hp, hp, `${sk.id}: interrupted ${interruption}`);
        assert.equal(f.other.hp, otherHp, 'must not fall back to a nearby enemy');
      }
    }
  for (const sk of C.CLASSES.spearman.skills.filter(s => s.spear)) {
    const f = fixture(), mp = f.p.mp;
    f.p.skl.sk[sk.id] = 12;
    f.w.castSkill(f.p, { id: sk.id, tid: 'invalid', a: 0 });
    assert.equal(f.p.mp, mp); assert.equal(f.p.cds[sk.id], undefined); assert.equal(f.w.timers.length, 0);
    f.w.castSkill(f.p, { id: 'fang', tid: f.t.id, a: 0 }); assert.equal(f.w.timers.length, 0);
    f.w.maps.arena.monsters = [];
    f.w.castSkill(f.p, { id: sk.id, a: 0 }); assert.equal(f.p.mp, mp);
  }
  const bossDamage = boss => {
    const f = fixture(); f.t.def.boss = boss;
    cast(f, C.ALL_SKILLS.spearBoss, 1); flush(f.w); return 1e7 - f.t.hp;
  };
  assert(bossDamage(true) > bossDamage(false) * 1.45, 'boss bonus is applied');
  const execution = low => {
    const f = fixture(); f.t.hp = low ? 2e6 : 1e7;
    const hp = f.t.hp; cast(f, C.ALL_SKILLS.spearExecution, 2); flush(f.w); return hp-f.t.hp;
  };
  assert(execution(true) > execution(false) * 1.35, 'low HP finisher bonus is applied');
  // Exact authoritative timings and budgets, independent of crit/rounding.
  for(const sk of C.CLASSES.spearman.skills.filter(s=>s.spear))for(let rank=0;rank<=sk.evo.length;rank++){
    const f=fixture(),start=now,hits=[],plan=C.spearSequence(sk,rank);
    f.w.applyDamage=(src,t,power,opts)=>hits.push({id:t.id,at:now-start,power,opts});cast(f,sk,rank);flush(f.w);
    const primary=hits.filter(h=>h.id===f.t.id),collateral=hits.filter(h=>h.id===f.other.id);
    assert.deepEqual(primary.map(h=>h.at),plan.map(b=>b.at));
    const legacy=sk.spear.damage*(sk.id==='spearChain'?(rank?5:3):sk.id==='spearHeaven'&&rank?2:1);
    assert(Math.abs(plan.reduce((n,b)=>n+b.power,0)-legacy)<1e-8,'Preserve primary damage budget '+sk.id);
    if(plan.at(-1).area){assert.equal(collateral.length,1);assert.equal(collateral[0].at,plan.at(-1).at);assert(Math.abs(collateral[0].power/primary.at(-1).power-plan.at(-1).area.scale)<1e-8);}
    else assert.equal(collateral.length,0);
    if(plan.length>1){
      const f=fixture(),hits=[];f.w.applyDamage=(p,t)=>hits.push(t.id);cast(f,sk,rank);
      f.w.timers.sort((a,b)=>a.at-b.at);const first=f.w.timers.shift();now=first.at;first.fn();
      f.t.x+=1000;const second=f.w.timers.shift();now=second.at;second.fn();f.t.x-=1000;flush(f.w);
      assert.deepEqual(hits,[f.t.id],'Broken combo cannot resume after target returns');
    }
  }
  for(const id of ['spearCrush','spearHeart','spearHeaven']){
    const sk=C.ALL_SKILLS[id],A=C.spearSequence(sk).at(-1).area;
    const f=fixture(),hits=[],cx=A.shape==='cone'?f.p.x:f.t.x,cy=f.p.y;
    const add=(id,x,y)=>{const m={...f.other,id,x,y,threat:new Map(),dots:[]};f.w.maps.arena.monsters.push(m);return m;};
    f.other.x=cx+A.radius-1;f.other.y=cy;
    const outside=add('outside',cx+A.radius+1,cy),behind=add('behind',cx-A.radius+1,cy);
    f.w.applyDamage=(p,t)=>hits.push(t.id);cast(f,sk);flush(f.w);
    assert(hits.includes(f.other.id));assert(!hits.includes(outside.id));assert.equal(hits.includes(behind.id),A.shape==='circle');
    // The cap counts secondary targets, excluding the primary, exactly once each.
    const many=fixture(),seen=[];for(let i=0;i<12;i++)many.w.maps.arena.monsters.push({...many.other,id:'pack'+i,x:2080+i,y:2001,dots:[],threat:new Map()});
    many.w.applyDamage=(p,t)=>{if(t!==many.t)seen.push(t.id);};cast(many,sk);flush(many.w);
    assert.equal(seen.length,A.cap);assert.equal(new Set(seen).size,A.cap);
    // A wall between the impact and a secondary enemy blocks collateral.
    const wall=fixture(),blocked=[];wall.other.x=2165;wall.w.maps.arena.map.solid[41*200+44]=1;
    wall.w.applyDamage=(p,t)=>blocked.push(t.id);cast(wall,sk);flush(wall.w);assert(!blocked.includes(wall.other.id));assert(blocked.includes(wall.t.id));
    // Field PvP authorization, party membership and safe areas still apply to splash.
    const pk=fixture('dharma',true);pk.w.maps.arena.def.pvp=false;pk.w.maps.arena.def.camp={x0:44,y0:40,x1:45,y1:43};pk.p.pk=true;pk.p.party='party';
    const allies=[{...pk.other,id:'ally',faction:'dharma'},{...pk.other,id:'party',party:'party'},{...pk.other,id:'safe',x:2140}];
    for(const a of allies)pk.w.players.set(a.id,a);const damaged=[];pk.w.applyDamage=(p,t)=>damaged.push(t.id);cast(pk,sk);flush(pk.w);
    assert(damaged.includes(pk.other.id));for(const a of allies)assert(!damaged.includes(a.id),a.id+' excluded from area');
  }
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/js/model-tiers.js'),'utf8'), ctx);
  const MT = ctx.window.ModelTiers;
  for (const faction of ['dharma','adharma']) for (const [i,lvl] of [1,15,30,50,60,80,100,130].entries()) {
    assert.equal(MT.tierOf(lvl),i); if(i)assert.equal(MT.tierOf(lvl-1),i-1);
    assert(MT.nameOf(i,faction,'spearman').includes('ทวน'));
    assert.notEqual(MT.key(faction,false,'spearman'),MT.key(faction,false,'taoist'));
  }
  const meta = require('../public/assets/spearman.json');
  for (const f of ['dharma','adharma']) for (const pose of ['walk','attack']) {
    const m = meta[pose][f], png = PNG.sync.read(fs.readFileSync(path.join(__dirname,`../public/assets/${f==='adharma'?'adharma-hair/':''}spearman-${f}${pose==='attack'?'-attack':''}.png`)));
    assert.equal(png.width,m.frameWidth*8); assert.equal(png.height,m.frameHeight*m.framesPerDir);
    for(let r=0;r<m.framesPerDir;r++) for(let c=0;c<8;c++) {
      let visible=0;
      for(let y=0;y<m.frameHeight;y++)for(let x=0;x<m.frameWidth;x++)
        if(png.data[((r*m.frameHeight+y)*png.width+c*m.frameWidth+x)*4+3]>80)visible++;
      assert(visible>100,'every pose/direction must contain a character');
    }
  }
  console.log(`PASS: ${casts} spear casts; shared combo timing, damage budgets, 3 capped area finishers, PvE/PvP, safe areas, parties, walls, interruption, bosses, progression and sprite atlases.`);
} finally { Date.now = realNow; Math.random = realRandom; }
