// Offline tests of the real authoritative handlers, persistence serializer and browser bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../shared/world-data'),World=require('../server/world'),Store=require('../server/store');
const originalNow=Date.now,originalRandom=Math.random;let now=100000,seq=0,checks=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(lvl=130,pvp=false,faction='dharma',cls='arbiter'){
  const w=Object.create(World.prototype);w.players=new Map();w.parties=new Map();w.bySocket=new Map();w.timers=[];w.seq=100;
  w.events=[];w.emitNear=(...a)=>w.events.push(a);w.systemChat=()=>{};w.store=new Store(null);w.fund=w.loadFund();w.score={dharma:0,adharma:0};
  const map=()=>({def:{pvp,gates:[],camp:{x0:0,y0:0,x1:4,y1:4}},map:{w:200,h:200,solid:new Uint8Array(40000)},monsters:[]});
  w.maps={lab:map(),other:map()};w.monsters=w.maps.lab.monsters;w.killPlayer=w.killMonster=t=>{t.dead=true;};
  function player(cls,f){
    const stats=C.playerStats(cls,lvl,{weapon:'w0'},{}),p={id:'p'+ ++seq,name:'Player'+seq,accountId:1,cls,faction:f,lvl,exp:0,stats,
      x:2000,y:2000,mapId:'lab',hp:stats.maxHp,mp:stats.maxMp,eq:{weapon:'w0',body:null,legs:null,arms:null,shoulder:null},alloc:C.cleanAlloc({},lvl),
      inv:Array(C.BAG_SIZE).fill(null),storage:Array(C.STORAGE_SIZE).fill(null),storeGold:456,gold:123,stones:4,locks:[],
      cds:{},dots:[],buffs:{},lockUntil:0,skl:C.cleanSkills(cls,null,lvl),socket:{id:'s'+seq,data:{account:{id:1}},emit(){}}};
    w.players.set(p.id,p);return p;
  }
  const p=player(cls,faction);
  w.store.put({name:p.name,accountId:1});
  const enemy=(x=2080,y=2000)=>{
    const t=pvp?player('dualblade',C.enemyOf(faction)):{id:'m'+ ++seq,def:{atk:100,def:10,hp:1e8,lvl,radius:20},mapId:'lab',dots:[],threat:new Map()};
    Object.assign(t,{x,y,hp:1e8,hx:x,hy:y,target:p.id});if(!pvp)w.maps.lab.monsters.push(t);return t;
  };
  const t=enemy();return {w,p,t,enemy};
}
function flush(w){let i=0;while(w.timers.length){assert(++i<1000);w.timers.sort((a,b)=>a.at-b.at);const t=w.timers.shift();now=Math.max(now,t.at);t.fn();}}
function cast(f,id='oathBasic',data={}){f.w.castSkill(f.p,{id,a:0,tid:f.t.id,tx:f.t.x,ty:f.t.y,...data});}
function reset(f){now+=70000;f.p.mp=f.p.stats.maxMp;}
function test(name,fn){fn();checks++;console.log('PASS '+name);}
try{
  Date.now=()=>now;Math.random=()=>.5;
  test('stable class indices; basic + exactly eight skills; all levels load without overspending',()=>{
    assert.deepEqual(C.CLASS_IDS,['dualblade','taoist','archer','spearman','warrior','arbiter']);
    assert.equal(C.CLASSES.arbiter.skills.length,9);
    for(let lvl=1;lvl<=130;lvl++)for(const cls of C.CLASS_IDS){const d=C.cleanSkills(cls,null,lvl);assert(C.skillPtsFree(d,lvl)>=0);assert.deepEqual(C.cleanSkills(cls,copy(d),lvl),d);}
    assert(C.cleanSkills('arbiter',null,1).sk.oathSlash);assert.equal(C.skillPtsFree(C.cleanSkills('arbiter',null,1),1),0);
  });
  for(const faction of ['dharma','adharma'])for(const pvp of [false,true]){
    test(`${faction} ${pvp?'PvP':'PvE'} every active skill and passive cast rejection`,()=>{
      for(const sk of C.CLASSES.arbiter.skills){const f=fixture(130,pvp,faction),hp=f.t.hp,mp=f.p.mp;cast(f,sk.id);flush(f.w);
        if(sk.passive){assert.equal(f.p.mp,mp);assert.equal(f.t.hp,hp);assert.equal(f.p.cds[sk.id],undefined);}
        else if(['ward','form'].includes(sk.arbiter.kind))assert(f.p.buffs[sk.id]);else assert(f.t.hp<hp,sk.id);
      }
    });
  }
  test('server rejects wrong class, low level, unlearned, cooldown, mana and range',()=>{
    for(const id of ['fang','finalVerdict','astralBlades']){const f=fixture(1),mp=f.p.mp;cast(f,id);assert.equal(f.p.mp,mp);assert.equal(f.w.timers.length,0);}
    for(const fail of ['unlearned','cooldown','mana','range','invalidTarget','wall','root']){
      const f=fixture(),mp=f.p.mp;
      if(fail==='unlearned')delete f.p.skl.sk.oathSlash;
      if(fail==='cooldown')f.p.cds.oathSlash=now+5000;
      if(fail==='mana')f.p.mp=0;
      if(fail==='range')f.t.x+=1000;
      if(fail==='wall')f.w.maps.lab.map.solid[41*200+42]=1;
      if(fail==='root')f.p.rootUntil=now+1000;
      cast(f,'oathSlash',fail==='invalidTarget'?{tid:'missing'}:{});assert.equal(f.w.timers.length,0,fail);if(fail!=='mana')assert.equal(f.p.mp,mp,fail);
    }
    const f=fixture();cast(f);cast(f);assert.equal(f.w.timers.length,1);
  });
  test('basic switches to bounded forward wave at Lv.30; line width, cap, walls',()=>{
    for(const lvl of [29,30,69,70,109,110,130]){const f=fixture(lvl);f.t.x=2220;cast(f);flush(f.w);assert.equal(f.t.hp<1e8,lvl>=30);}
    const f=fixture(70);f.t.x=2200;const near=f.enemy(2100),third=f.enemy(2150),extra=f.enemy(2250),side=f.enemy(2150,2100),behind=f.enemy(1950),far=f.enemy(2400);
    cast(f);flush(f.w);for(const t of [f.t,near,third])assert(t.hp<1e8);for(const t of [extra,side,behind,far])assert.equal(t.hp,1e8);
  });
  test('resonance counts once per landed cast, consumes on sixth, misses do not stack',()=>{
    const f=fixture(30);f.w.applyDamage=()=>10;
    for(let i=0;i<5;i++){cast(f);flush(f.w);reset(f);assert.equal(f.p.oathStacks,i+1);}
    let power;f.w.applyDamage=(p,t,v)=>{power=v;return 10;};cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);assert(Math.abs(power-1.1*1.3*C.arbiterPower(30,true))<1e-8);
    reset(f);f.w.applyDamage=()=>0;cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);
    reset(f);f.w.applyDamage=()=>10;f.enemy();f.enemy();cast(f,'arcblade');flush(f.w);assert.equal(f.p.oathStacks,1);
  });
  test('astral one proc per basic, ICD and no gear recursion',()=>{
    const f=fixture(70),hits=[];Math.random=()=>0;f.w.applyDamage=(p,t,v,o)=>{hits.push(o);return 10;};
    cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,1);assert.equal(hits.at(-1).onHitWeight,0);
    now+=800;cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,1);
    now+=2500;cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,2);Math.random=()=>.5;
  });
  test('telegraphed ultimate can be dodged; target membership is checked at impact',()=>{
    const f=fixture(130,true);cast(f,'finalVerdict');assert.equal(f.t.hp,1e8);assert(f.w.events.some(a=>a[4]?.phase==='windup'));
    f.t.x+=400;flush(f.w);assert.equal(f.t.hp,1e8);
    const g=fixture();g.t.x=2300;const mp=g.p.mp;cast(g,'finalVerdict');assert.equal(g.p.mp,mp);
  });
  test('death, disconnect, control, warp and warp-return cancel pending damage',()=>{
    for(const id of ['oathBasic','oathSlash','arcblade','bladeOrbit','finalVerdict'])for(const why of ['death','logout','stun','root','warp','roundtrip','targetGone']){
      const f=fixture();cast(f,id);
      if(why==='death')f.p.dead=true;if(why==='logout')f.w.players.delete(f.p.id);
      if(why==='stun')f.p.stunUntil=now+3000;if(why==='root')f.p.rootUntil=now+3000;
      if(why==='warp'||why==='roundtrip'){f.w.changeMapOne(f.p,'other',{x:2000,y:2000});if(why==='roundtrip')f.w.changeMapOne(f.p,'lab',{x:2000,y:2000});}
      if(why==='targetGone')f.w.maps.lab.monsters=[];
      flush(f.w);assert.equal(f.t.hp,1e8,id+' '+why);
    }
  });
  test('ward and transformation expire; PvP reductions; faction traits',()=>{
    for(const faction of ['dharma','adharma']){const f=fixture(130,true,faction);cast(f,'oathAegis');assert.equal(f.w.buffVal(f.p,'arbiterGuard'),.2);assert.equal(f.w.buffVal(f.p,faction==='dharma'?'accuracy':'evasion'),.03);now+=5001;assert.equal(f.w.buffVal(f.p,'arbiterGuard'),0);
      cast(f,'ascendantForm');assert.equal(f.w.buffVal(f.p,'arbiterForm'),1);now+=10001;assert.equal(f.w.buffVal(f.p,'arbiterForm'),0);}
    for(const pvp of [false,true]){const f=fixture(130,pvp);const base=f.w.applyDamage(f.t,f.p,1);f.p.hp=f.p.stats.maxHp;cast(f,'oathAegis');const ward=f.w.applyDamage(f.t,f.p,1);assert(Math.abs(ward/base-(pvp?.85:.8))<.03);}
  });
  test('real level-up and save/load preserve existing characters at all evolution thresholds',()=>{
    for(const cls of C.CLASS_IDS)for(const lvl of [29,69,109]){
      const f=fixture(lvl,false,'dharma',cls);f.p.inv[0]='potHpS*4';f.p.storage[0]='w0';
      const before=copy({skl:f.p.skl,inv:f.p.inv,eq:f.p.eq,alloc:f.p.alloc,gold:f.p.gold});
      f.w.gainExp(f.p,C.expToNext(lvl));assert.equal(f.p.lvl,lvl+1);
      for(const k of Object.keys(before))assert.deepEqual(f.p[k],before[k]);
      f.w.save(f.p);const saved=copy(f.w.store.get(f.p.name));f.w.players.delete(f.p.id);
      let response;f.w.join(f.p.socket,{name:f.p.name},r=>response=r);assert(response.ok,JSON.stringify(response));
      const loaded=f.w.players.get(response.id);assert.equal(loaded.lvl,lvl+1);assert.equal(loaded.cls,cls);
      for(const k of ['skl','inv','eq','alloc','gold','storage','storeGold'])assert.deepEqual(loaded[k],saved[k],cls+' '+k);
      if(cls==='arbiter')assert.equal(C.arbiterStage(loaded.lvl),[29,69,109].indexOf(lvl)+1);
    }
    const f=fixture(129);f.w.gainExp(f.p,C.expToNext(129)*100);assert.equal(f.p.lvl,130);assert.equal(f.p.exp,0);
  });
  test('Auto Hunt invokes the same server cast handler and excludes passives',()=>{
    const f=fixture(30),calls=[],node={addEventListener(){},classList:{toggle(){}},querySelectorAll(){return[];}};
    const G={cls:'arbiter',me:f.p,stats:{lvl:30,mp:f.p.mp,hp:f.p.hp,mhp:f.p.hp},skl:f.p.skl,mapId:'lab',
      useSlot(id){calls.push(id);cast(f,id);}};
    const context={C,G,window:null,document:{getElementById:()=>node},localStorage:{getItem(){return null;}},HUD:{cdLeft:()=>0},performance:{now:()=>now}};context.window=context;
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/bot.js'),'utf8'),context);
    context.BOT.api={radiusOf:()=>20,orderMove(){}};context.BOT.fight(f.t,now);flush(f.w);assert(f.t.hp<1e8);assert.equal(calls[0],'arcblade');
    f.t.x=3000;calls.length=0;context.BOT.fight(f.t,now);assert.equal(calls.length,0);assert.equal(G.order.type,'attack');
    assert(!f.p.skl.bar.includes('oathResonance'));
  });
  console.log(`PASS: ${checks} Divine Arbiter test groups.`);
}finally{Date.now=originalNow;Math.random=originalRandom;}
