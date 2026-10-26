const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../shared/world-data'),World=require('../server/world');
const originalNow=Date.now,originalRandom=Math.random;let now=100000,checks=0;
function fixture(lvl=130,pvp=false,faction='dharma'){
  const w=Object.create(World.prototype);w.players=new Map();w.parties=new Map();w.bySocket=new Map();w.timers=[];w.events=[];w.store={put(){}};
  const map=()=>({def:{pvp,gates:[],camp:{x0:0,y0:0,x1:4,y1:4}},map:{w:200,h:200,solid:new Uint8Array(40000)},monsters:[]});
  w.maps={lab:map(),other:map()};w.monsters=w.maps.lab.monsters;w.emitNear=(...a)=>w.events.push(a);w.killPlayer=w.killMonster=t=>{t.dead=true;};
  const stats=C.playerStats('boxer',lvl,{weapon:'w0'},{});
  const p={id:'p',name:'boxer',cls:'boxer',lvl,faction,stats,x:2000,y:2000,dir:0,mapId:'lab',hp:stats.maxHp,mp:stats.maxMp,
    eq:{weapon:'w0'},cds:{},buffs:{},dots:[],lockUntil:0,skl:C.cleanSkills('boxer',null,lvl),socket:{emit(){}}};
  w.players.set(p.id,p);let seq=0;
  const enemy=(x=2080,y=2000)=>{
    const t=pvp?{id:'e'+ ++seq,name:'enemy',cls:'dualblade',faction:C.enemyOf(faction),lvl,stats:C.playerStats('dualblade',lvl,{},{}),buffs:{},socket:{emit(){}}}
      :{id:'m'+ ++seq,def:{atk:100,def:10,hp:1e8,lvl,radius:20},threat:new Map()};
    Object.assign(t,{mapId:'lab',x,y,hp:1e8,dots:[],target:p.id,hx:x,hy:y});if(pvp)w.players.set(t.id,t);else w.maps.lab.monsters.push(t);return t;
  };
  return {w,p,t:enemy(),enemy};
}
function flush(w){let n=0;while(w.timers.length){assert(++n<1000);w.timers.sort((a,b)=>a.at-b.at);const t=w.timers.shift();now=Math.max(now,t.at);t.fn();}}
function cast(f,id='qiJab',data={}){f.w.castSkill(f.p,{id,a:0,tid:f.t.id,tx:f.t.x,ty:f.t.y,...data});}
function ready(f){now+=1000;f.p.gcd=0;f.p.lockUntil=0;f.p.cds={};f.p.mp=f.p.stats.maxMp;}
function test(name,fn){fn();checks++;console.log('PASS '+name);}
try{
  Date.now=()=>now;Math.random=()=>.5;
  test('append class, 11 keys and every level can learn/save skills without overspending',()=>{
    assert.equal(C.CLASS_IDS.indexOf('boxer'),6);assert.equal(C.CLASSES.boxer.skills.length,11);
    assert.deepEqual(C.CLASSES.boxer.skills.map(s=>s.key),C.BAR_KEYS);
    for(let lvl=1;lvl<=130;lvl++){const s=C.cleanSkills('boxer',null,lvl);assert(C.skillPtsFree(s,lvl)>=0);assert.deepEqual(C.cleanSkills('boxer',JSON.parse(JSON.stringify(s)),lvl),s);}
    C.setViewClass('boxer');assert(C.ITEMS.w0.name.includes('สนับหมัด'));C.setViewClass('dualblade');
  });
  for(const faction of ['dharma','adharma'])for(const pvp of [false,true])test(`${faction} ${pvp?'PvP':'PvE'} all attacks, MP, cooldown, guard and breath`,()=>{
    for(const sk of C.CLASSES.boxer.skills){const f=fixture(130,pvp,faction),mp=f.p.mp;cast(f,sk.id);flush(f.w);
      if(C.BUFF_SKILLS.includes(sk.id))assert(f.p.buffs[sk.id]);else assert(f.t.hp<1e8,sk.id);
      assert.equal(f.p.mp,mp-C.skillMp(sk,130));assert(f.p.cds[sk.id]>now,sk.id);
    }
  });
  test('one stack per different landed cast; repeated skill, miss and expired chain',()=>{
    const f=fixture();cast(f);flush(f.w);assert.equal(f.p.qiStacks,1);
    ready(f);cast(f);flush(f.w);assert.equal(f.p.qiStacks,1);
    ready(f);cast(f,'qiElbow');flush(f.w);assert.equal(f.p.qiStacks,2);
    ready(f);cast(f,'qiTempest');flush(f.w);assert.equal(f.p.qiStacks,3);
    ready(f);f.w.applyDamage=()=>0;cast(f,'qiBreaker');flush(f.w);assert.equal(f.p.qiStacks,3);
    now+=C.BOXER.comboMs+1;assert.equal(f.w.boxerStacks(f.p),0);assert.equal(f.p.qiLast,null);
  });
  test('finisher bonus stable across beats/targets and consumed once on first landed hit',()=>{
    for(const id of ['qiBreaker','qiQuake','qiEmperor']){const f=fixture(),powers=[];f.p.qiStacks=3;f.p.qiUntil=now+5000;
      f.enemy(2070);f.w.applyDamage=(p,t,v)=>{powers.push(v);return 10;};cast(f,id);flush(f.w);
      assert.equal(f.p.qiStacks,0);assert(powers.length);assert(powers.every(v=>Math.abs(v-powers[0])<1e-9));
      const sk=C.ALL_SKILLS[id];assert(Math.abs(powers[0]-sk.boxer.power*C.skillPower(f.p.skl.sk[id],C.skillRankOf(f.p.skl,id))*1.6/(sk.boxer.hits||1))<1e-9);
    }
  });
  test('range, wrong class, target id, wall, unlearned, cooldown, root, safe zone do not spend MP',()=>{
    for(const why of ['range','class','id','wall','unlearned','cooldown','root','safe']){
      const f=fixture(),mp=f.p.mp;let id='qiStep',data={};
      if(why==='range')f.t.x+=1000;if(why==='class')id='fang';if(why==='id')data.tid='missing';
      if(why==='wall')f.w.maps.lab.map.solid[41*200+42]=1;
      if(why==='unlearned')delete f.p.skl.sk[id];if(why==='cooldown')f.p.cds[id]=now+1000;
      if(why==='root')f.p.rootUntil=now+1000;if(why==='safe'){f.p.x=f.p.y=48;}
      cast(f,id,data);assert.equal(f.p.mp,mp,why);assert.equal(f.w.timers.length,0,why);
    }
    const f=fixture(1);cast(f,'qiEmperor');assert.equal(f.w.timers.length,0);
  });
  test('dash closes to melee; moving target can dodge subsequent beats',()=>{
    const f=fixture();f.t.x=2300;cast(f,'qiStep');assert(f.p.x>2000&&f.p.x<2300);flush(f.w);assert(f.t.hp<1e8);
    const g=fixture();cast(g,'qiHeaven');const first=g.w.timers.shift();now=first.at;first.fn();const hp=g.t.hp;assert(hp<1e8);g.t.x+=500;flush(g.w);assert.equal(g.t.hp,hp);
  });
  test('death, disconnect, control, warp and roundtrip cancel every pending beat',()=>{
    for(const why of ['death','disconnect','stun','root','epoch','warp','roundtrip','targetGone'])for(const id of ['qiJab','qiHeaven','qiQuake']){
      const f=fixture();cast(f,id);
      if(why==='death')f.p.dead=true;if(why==='disconnect')f.w.players.delete(f.p.id);
      if(why==='stun')f.p.stunUntil=now+3000;if(why==='root')f.p.rootUntil=now+3000;
      if(why==='epoch')f.p.controlEpoch=1;if(why==='warp')f.p.mapId='other';
      if(why==='roundtrip'){f.w.changeMapOne(f.p,'other',{x:2000,y:2000});f.w.changeMapOne(f.p,'lab',{x:2000,y:2000});}
      if(why==='targetGone')f.w.maps.lab.monsters=[];flush(f.w);assert.equal(f.t.hp,1e8,why+'/'+id);
    }
  });
  test('cone excludes enemies behind and caps five; quake caps five; bosses resist stun',()=>{
    for(const id of ['qiTempest','qiQuake']){const f=fixture();for(let i=0;i<8;i++)f.enemy(2070+i);const back=f.enemy(1920);cast(f,id);flush(f.w);
      assert.equal(f.w.maps.lab.monsters.filter(t=>t.hp<1e8).length,5);if(id==='qiTempest')assert.equal(back.hp,1e8);
    }
    const f=fixture();f.t.def.boss=true;cast(f,'qiKnee');flush(f.w);assert(!f.t.stunUntil);assert(f.t.slowUntil>now);
  });
  test('guard counters exactly one direct blow; no poison/reflection/recursive counters',()=>{
    for(const option of [{},{dot:true},{proc:true},{reflect:true},{qiCounter:true}]){
      const f=fixture();cast(f,'qiCounter');f.w.applyDamage(f.t,f.p,.1,option);f.w.applyDamage(f.t,f.p,.1,option);flush(f.w);
      assert.equal(f.t.hp<1e8,Object.keys(option).length===0,JSON.stringify(option));
      if(!Object.keys(option).length)assert.equal(f.p.qiStacks,1);
    }
    for(const why of ['far','expired','controlled']){const f=fixture();cast(f,'qiCounter');if(why==='far')f.t.x+=500;if(why==='expired')now+=2000;if(why==='controlled')f.p.controlEpoch=1;
      f.w.applyDamage(f.t,f.p,.1);flush(f.w);assert.equal(f.t.hp,1e8,why);}
  });
  test('strongest ward only, breath reduces slow duration, buffs expire',()=>{
    const f=fixture();f.p.skl.sk.qiBreath=1;f.p.skl.ev.qiBreath=0;cast(f,'qiBreath');
    const amount=f.w.applyDamage(f.t,f.p,.1);ready(f);cast(f,'qiCounter');const guarded=f.w.applyDamage(f.t,f.p,.1,{dot:true});
    assert(guarded>=amount*.7,'wards must not add');f.w.applyControl(f.p,{slow:2000},now);assert.equal(f.p.slowUntil-now,920);
    now+=10000;assert.equal(f.w.buffVal(f.p,'qiBreathGuard'),0);assert.equal(f.w.buffVal(f.p,'qiCounterGuard'),0);
  });
  test('browser Auto Hunt learns boxer ranges and uses buffs before attacks',()=>{
    const f=fixture(),calls=[],node={addEventListener(){},classList:{toggle(){}},querySelectorAll(){return[];}};
    const G={cls:'boxer',me:f.p,stats:{lvl:130,mp:f.p.mp,hp:f.p.hp,mhp:f.p.hp},skl:f.p.skl,mapId:'lab',useSlot(id){calls.push(id);cast(f,id);this.stats.bf=f.w.buffList(f.p);}};
    const context={C,G,window:null,document:{getElementById:()=>node,addEventListener(){}},localStorage:{getItem(){return null;}},HUD:{cdLeft:()=>0},performance:{now:()=>now}};context.window=context;
    vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/bot.js'),'utf8'),context);context.BOT.api={radiusOf:()=>20,orderMove(){}};
    for(let i=0;i<3;i++){context.BOT.fight(f.t,now);flush(f.w);now+=C.GCD_MS;}
    assert.deepEqual(calls,['qiBreath','qiCounter','qiHeaven']);assert(f.t.hp<1e8);
  });
  console.log(`PASS ${checks} boxer scenarios`);
}finally{Date.now=originalNow;Math.random=originalRandom;}
