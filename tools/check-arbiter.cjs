// Offline tests of the real authoritative handlers, persistence serializer and browser bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../shared/world-data'),World=require('../server/world'),Store=require('../server/store');
const originalNow=Date.now,originalRandom=Math.random;let now=100000,seq=0,checks=0;
const pointsUsed=d=>130-C.skillPtsFree(d,130);
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
  test('stable class indices; basic + eight skills + two Lv.120/130 arts; all levels load without overspending',()=>{
    assert.deepEqual(C.CLASS_IDS,['dualblade','taoist','archer','spearman','warrior','arbiter','boxer']);
    assert.equal(C.CLASSES.arbiter.skills.length,11);
    assert.deepEqual(C.CLASSES.arbiter.skills.slice(9).map(s=>[s.id,s.key,s.lvl,!!s.ritual]),[['oathFirmament','0',120,true],['oathGenesis','-',130,true]]);
    for(let lvl=1;lvl<=130;lvl++)for(const cls of C.CLASS_IDS){const d=C.cleanSkills(cls,null,lvl);assert(C.skillPtsFree(d,lvl)>=0);assert.deepEqual(C.cleanSkills(cls,copy(d),lvl),d);}
    assert(C.cleanSkills('arbiter',null,1).sk.oathSlash);assert.equal(C.skillPtsFree(C.cleanSkills('arbiter',null,1),1),0);
  });
  for(const faction of ['dharma','adharma'])for(const pvp of [false,true]){
    test(`${faction} ${pvp?'PvP':'PvE'} basic, all eight active skills and both arts`,()=>{
      for(const sk of C.CLASSES.arbiter.skills){const f=fixture(130,pvp,faction),hp=f.t.hp,mp=f.p.mp;cast(f,sk.id);flush(f.w);
        assert(!sk.passive);
        if(C.BUFF_SKILLS.includes(sk.id)){assert(f.p.buffs[sk.id]);assert.equal(f.t.hp,hp);}else assert(f.t.hp<hp,sk.id);
        assert.equal(f.p.mp,mp-C.skillMp(sk,130));assert(f.p.cds[sk.id]>now);
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
    const f=fixture(70);f.t.x=2200;const near=f.enemy(2100),third=f.enemy(2150),fourth=f.enemy(2250),extra=f.enemy(2255),side=f.enemy(2150,2100),behind=f.enemy(1950),far=f.enemy(2400);
    assert.equal(C.ARBITER.waveCap,4);cast(f);flush(f.w);for(const t of [f.t,near,third,fourth])assert(t.hp<1e8);for(const t of [extra,side,behind,far])assert.equal(t.hp,1e8);
  });
  test('resonance counts once per landed cast, consumes on sixth, misses do not stack',()=>{
    const f=fixture(30);f.p.skl.sk.oathResonance=1;f.w.applyDamage=()=>10;
    cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);now+=800; // Learning alone grants no passive.
    cast(f,'oathResonance');f.p.arbiterCombo=0;
    for(let i=0;i<5;i++){cast(f);flush(f.w);now+=800;assert.equal(f.p.oathStacks,i+1);}
    let power;f.w.applyDamage=(p,t,v)=>{power=v;return 10;};cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);assert(Math.abs(power-C.ARBITER.combo[2]*1.3*C.arbiterPower(30,true))<1e-8);
    now+=800;f.w.applyDamage=()=>0;cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);
    now+=800;f.w.applyDamage=()=>10;f.enemy();f.enemy();cast(f,'arcblade');flush(f.w);assert.equal(f.p.oathStacks,1);
    reset(f);cast(f);flush(f.w);assert.equal(f.p.oathStacks,0);
    now+=800;f.p.oathStacks=5;cast(f,'oathResonance');assert.equal(f.p.oathStacks,0);
  });
  test('astral one proc per basic, ICD and no gear recursion',()=>{
    const f=fixture(70),hits=[];Math.random=()=>0;f.w.applyDamage=(p,t,v,o)=>{hits.push(o);return 10;};
    cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,0);now+=800;cast(f,'astralBlades');
    cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,1);assert.equal(hits.at(-1).onHitWeight,0);
    now+=800;cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,1);
    now+=2500;cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,2);
    now=f.p.buffs.astralBlades.until+1;cast(f);flush(f.w);assert.equal(hits.filter(o=>o.proc).length,2);Math.random=()=>.5;
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
    for(const faction of ['dharma','adharma']){const f=fixture(130,true,faction);f.p.skl.sk.oathAegis=1;delete f.p.skl.ev.oathAegis;
      cast(f,'oathAegis');assert.equal(f.w.buffVal(f.p,'arbiterGuard'),.2);assert.equal(f.w.buffVal(f.p,faction==='dharma'?'accuracy':'evasion'),.03);now+=5001;assert.equal(f.w.buffVal(f.p,'arbiterGuard'),0);
      cast(f,'ascendantForm');assert.equal(f.w.buffVal(f.p,'arbiterForm'),1);now=f.p.buffs.ascendantForm.until+1;assert.equal(f.w.buffVal(f.p,'arbiterForm'),0);}
    for(const pvp of [false,true]){const f=fixture(130,pvp);f.p.skl.sk.oathAegis=1;delete f.p.skl.ev.oathAegis;
      const base=f.w.applyDamage(f.t,f.p,1);f.p.hp=f.p.stats.maxHp;cast(f,'oathAegis');const ward=f.w.applyDamage(f.t,f.p,1);assert(Math.abs(ward/base-(pvp?.85:.8))<.03);}
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
  test('Auto Hunt casts both new buffs, then attacks; skips active buffs and distant targets',()=>{
    const f=fixture(30),calls=[],node={addEventListener(){},classList:{toggle(){}},querySelectorAll(){return[];}};
    const G={cls:'arbiter',me:f.p,stats:{lvl:30,mp:f.p.mp,hp:f.p.hp,mhp:f.p.hp},skl:f.p.skl,mapId:'lab',
      useSlot(id){calls.push(id);cast(f,id);this.stats.bf=f.w.buffList(f.p);}};
    const context={C,G,window:null,document:{getElementById:()=>node,addEventListener(){}},localStorage:{getItem(){return null;}},HUD:{cdLeft:()=>0},performance:{now:()=>now}};context.window=context;
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/bot.js'),'utf8'),context);
    context.BOT.api={radiusOf:()=>20,orderMove(){}};
    for(let i=0;i<4;i++){context.BOT.fight(f.t,now);flush(f.w);now+=C.GCD_MS;}
    assert.deepEqual(calls,['oathAegis','oathResonance','astralBlades','bladeOrbit']);assert(f.t.hp<1e8);
    f.t.x=3000;calls.length=0;context.BOT.fight(f.t,now);assert.equal(calls.length,0);assert.equal(G.order.type,'attack');
    assert(f.p.skl.bar.includes('oathResonance'));assert(f.p.skl.bar.includes('astralBlades'));
  });
  test('eight learned skills have standard unlocks, spend points, and evolve only on request',()=>{
    const list=C.CLASSES.arbiter.skills.slice(1,9);
    assert.deepEqual(list.map(s=>s.key),['2','3','4','5','6','7','8','9']);
    assert.deepEqual(list.map(s=>s.lvl),[1,2,4,7,10,30,50,70]);
    for(const sk of list){
      const f=fixture(130);f.p.skl=C.cleanSkills('arbiter',{v:C.SKILL_VER,av:1,sk:{oathBasic:1},ev:{}},130);
      assert(!f.p.skl.sk[sk.id]);cast(f,sk.id);assert.equal(f.p.cds[sk.id],undefined);
      f.w.onSkills(f.p,{cmd:'evo',id:sk.id});assert(!f.p.skl.ev[sk.id]);
      for(let i=0;i<12;i++)f.w.onSkills(f.p,{cmd:'up',id:sk.id});
      assert.equal(f.p.skl.sk[sk.id],12);assert.equal(pointsUsed(f.p.skl),12);
      f.w.onSkills(f.p,{cmd:'up',id:sk.id});assert.equal(pointsUsed(f.p.skl),12);
      for(let i=0;i<sk.evo.length;i++){
        f.p.lvl=sk.evo[i].lvl-1;f.w.onSkills(f.p,{cmd:'evo',id:sk.id});assert.equal(f.p.skl.ev[sk.id]||0,i);
        f.p.lvl=sk.evo[i].lvl;f.w.onSkills(f.p,{cmd:'evo',id:sk.id});assert.equal(f.p.skl.ev[sk.id],i+1);
      }
      assert.equal(pointsUsed(f.p.skl),12+sk.evo.length*C.EVO_COST);
    }
    const f=fixture();const used=pointsUsed(f.p.skl);f.w.onSkills(f.p,{cmd:'up',id:'oathBasic'});
    assert.equal(f.p.skl.sk.oathBasic,1);assert.equal(pointsUsed(f.p.skl),used);
  });
  test('basic damage grows with character level; active damage grows with invested rank only',()=>{
    function power(lvl,id,sl=1,ev=0){const f=fixture(lvl);f.p.skl.sk[id]=sl;f.p.skl.ev[id]=ev;let result;
      f.w.applyDamage=(p,t,v)=>{result=v;return 1;};cast(f,id);flush(f.w);return result;}
    assert(power(30,'oathBasic')>power(29,'oathBasic'));
    assert(power(70,'oathBasic')>power(69,'oathBasic'));
    assert(power(110,'oathBasic')>power(109,'oathBasic'));
    assert.equal(power(130,'oathSlash'),power(1,'oathSlash'));
    for(const id of ['oathSlash','arcblade','bladeOrbit','finalVerdict']){
      assert(Math.abs(power(130,id,12)/power(130,id)-1.55)<1e-8);
      assert(Math.abs(power(130,id,12,1)/power(130,id,12)-1.3)<1e-8);
    }
    for(const [id,x,y] of [['arcblade',2300,2000],['bladeOrbit',2185,2000],['finalVerdict',2080,2168]]){
      for(const rank of [0,1]){const f=fixture();f.p.skl.ev[id]=rank;f.t.x=x;f.t.y=y;
        cast(f,id,id==='finalVerdict'?{tx:2080,ty:2000}:{});flush(f.w);assert.equal(f.t.hp<1e8,!!rank,id);}
    }
  });
  test('buff upgrades affect authoritative bonuses and timers; transformation respects PvP scaling',()=>{
    for(const id of ['oathResonance','astralBlades','oathAegis','ascendantForm']){
      const values=[];
      for(const [sl,rank] of [[1,0],[12,0],[12,1]]){const f=fixture();f.p.skl.sk[id]=sl;f.p.skl.ev[id]=rank;cast(f,id);values.push(f.p.buffs[id]);}
      const key={oathResonance:'oathResonance',astralBlades:'astralPower',oathAegis:'arbiterGuard',ascendantForm:'arbiterDamage'}[id];
      assert(values[1][key]>values[0][key]);assert(values[2][key]>values[1][key]);assert(values[2].dur>values[1].dur);
    }
    for(const pvp of [false,true]){const f=fixture(130,pvp);f.p.skl.sk.ascendantForm=1;f.p.skl.ev.ascendantForm=0;
      const before=f.w.applyDamage(f.p,f.t,1);cast(f,'ascendantForm');const after=f.w.applyDamage(f.p,f.t,1);
      assert(Math.abs(after/before-(pvp?1.08:1.12))<.01);
      now=f.p.buffs.ascendantForm.until+1;assert.equal(f.w.applyDamage(f.p,f.t,1),before);
    }
  });
  test('legacy arbiter migration preserves points and custom slots, adds buffs once, persists',()=>{
    const old={v:C.SKILL_VER,auto:false,sk:{oathBasic:1,oathSlash:9,oathResonance:1,astralBlades:1,oathAegis:1},ev:{},
      bar:['oathSlash','oathBasic','arcblade','oathAegis','bladeOrbit','ascendantForm','finalVerdict',null,null,null,null]};
    const d=C.cleanSkills('arbiter',copy(old),130);assert.deepEqual(d.sk,old.sk);assert.equal(pointsUsed(d),pointsUsed(old));
    assert.deepEqual(d.bar.slice(0,7),old.bar.slice(0,7));assert.deepEqual(d.bar.slice(7,9),['oathResonance','astralBlades']);
    assert.equal(d.auto,false);d.bar[7]=null;assert.deepEqual(C.cleanSkills('arbiter',copy(d),130),d);
    const f=fixture();f.p.skl=d;f.w.save(f.p);const saved=copy(f.w.store.get(f.p.name));
    assert.deepEqual(C.cleanSkills('arbiter',saved.skl,130),d);
    for(const cls of C.CLASS_IDS.filter(c=>c!=='arbiter')){const s=C.cleanSkills(cls,null,130);assert(!('av' in s));assert.deepEqual(C.cleanSkills(cls,copy(s),130),s);}
  });
  test('ฟันคำสัตย์ dashes to a far target, never through walls, then empowers three basic attacks',()=>{
    for(const pvp of [false,true]){
      const f=fixture(130,pvp);f.t.x=2300;f.p.skl.ev.oathSlash=0;const mp=f.p.mp;cast(f,'oathSlash');
      assert(f.p.mp<mp);assert(f.p.x>2150&&f.p.x<2300,'dashed in front of the target');assert(f.w.events.some(a=>a[4]?.phase==='step'));
      flush(f.w);assert(f.t.hp<1e8);const edge=f.p.buffs.oathSlash;assert.equal(edge.charges,C.ARBITER.edge.hits);
      const powers=[];f.w.applyDamage=(p,t,v)=>{powers.push(v);return 10;};
      for(let i=0;i<4;i++){now+=800;f.p.arbiterCombo=2;cast(f);flush(f.w);}
      const plain=C.ARBITER.combo[2]*C.arbiterPower(130,true);
      for(let i=0;i<3;i++)assert(Math.abs(powers[i]-plain*(1+C.ARBITER.edge.bonus))<1e-8,'empowered '+i);
      assert(Math.abs(powers[3]-plain)<1e-8);assert.equal(f.p.buffs.oathSlash,undefined);
    }
    const g=fixture();g.t.x=2400;const mp=g.p.mp;cast(g,'oathSlash');assert.equal(g.p.mp,mp,'beyond dash reach');assert.equal(g.p.x,2000);
    const h=fixture();h.t.x=2300;for(let y=0;y<200;y++)h.w.maps.lab.map.solid[y*200+44]=1;
    const mp2=h.p.mp;cast(h,'oathSlash');assert.equal(h.p.mp,mp2,'a wall blocks the dash');assert.equal(h.p.x,2000);
    const k=fixture();cast(k,'oathSlash');k.w.changeMapOne(k.p,'other',{x:2000,y:2000});flush(k.w);assert.equal(k.t.hp,1e8,'warp cancels');
  });
  test('control: วงแหวนคมดาบ slows and sets up the third beat; มหาพิพากษา stuns (bosses slow)',()=>{
    for(const rank of [0,1]){const f=fixture();f.p.skl.ev.bladeOrbit=rank;cast(f,'bladeOrbit');flush(f.w);
      assert.equal(f.t.slowUntil,now+(rank?1500:1000));assert.equal(f.p.arbiterCombo,2);
      let power;f.w.applyDamage=(p,t,v)=>{power=v;return 1;};now+=800;cast(f);flush(f.w);
      assert(Math.abs(power-C.ARBITER.combo[2]*C.arbiterPower(130,true))<1e-8);}
    for(const rank of [0,1]){const f=fixture();f.p.skl.ev.finalVerdict=rank;cast(f,'finalVerdict');flush(f.w);
      assert.equal(f.t.stunUntil,now+(rank?800:600));}
    const b=fixture();b.t.def.boss=true;cast(b,'finalVerdict');flush(b.w);assert(!b.t.stunUntil);assert(b.t.slowUntil>now);
  });
  test('จุติผู้พิพากษา: basic attacks heal a share of their damage, half against players, never other skills',()=>{
    const heal={};
    for(const pvp of [false,true])for(const rank of [0,1]){
      const f=fixture(130,pvp);f.p.skl.ev.ascendantForm=rank;cast(f,'ascendantForm');f.p.hp=100;
      f.w.applyDamage=()=>1000;now+=800;cast(f);flush(f.w);heal[pvp+':'+rank]=f.p.hp-100;
      f.p.hp=100;now+=6000;cast(f,'arcblade');flush(f.w);assert.equal(f.p.hp,100,'skills do not leech');
    }
    assert.equal(heal['false:0'],1000*C.ARBITER.leech[0]);assert.equal(heal['false:1'],1000*C.ARBITER.leech[1]);
    assert.equal(heal['true:0'],1000*C.ARBITER.leech[0]*C.ARBITER.pvpLeech);
    const f=fixture();f.p.hp=100;f.w.applyDamage=()=>1000;cast(f);flush(f.w);assert.equal(f.p.hp,100,'no leech without the form');
  });
  test('Lv.120/130 arts empower the basic attack afterwards; the newest edict replaces the other',()=>{
    const f=fixture();for(const id of ['oathFirmament','oathGenesis'])assert(f.p.skl.sk[id]>=1,id+' auto-learned');
    cast(f,'oathFirmament');flush(f.w);assert(f.t.hp<1e8);assert.equal(f.w.buffVal(f.p,'arbiterBasic'),.2);
    let power;f.w.applyDamage=(p,t,v)=>{power=v;return 1;};now+=800;f.p.arbiterCombo=2;cast(f);flush(f.w);
    assert(Math.abs(power-C.ARBITER.combo[2]*C.arbiterPower(130,true)*1.2)<1e-8);
    now+=1000;cast(f,'oathGenesis');flush(f.w);assert.equal(f.p.buffs.oathFirmament,undefined);assert.equal(f.w.buffVal(f.p,'arbiterBasic'),.3);
    now=f.p.buffs.oathGenesis.until+1;assert.equal(f.w.buffVal(f.p,'arbiterBasic'),0);
    // an av 1 bar (from before the arts) gets them on its free keys 0 / -, a custom key is kept
    const old=copy(C.cleanSkills('arbiter',null,130));old.av=1;old.bar[9]=old.bar[10]=null;
    assert.deepEqual(C.cleanSkills('arbiter',copy(old),130).bar.slice(9),['oathFirmament','oathGenesis']);
    old.bar[9]='finalVerdict';old.bar[8]=null;assert.deepEqual(C.cleanSkills('arbiter',copy(old),130).bar.slice(8),[null,'finalVerdict','oathGenesis']);
  });
  console.log(`PASS: ${checks} Divine Arbiter test groups.`);
}finally{Date.now=originalNow;Math.random=originalRandom;}
