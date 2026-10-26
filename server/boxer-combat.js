// Server-owned qi combos. Every beat rechecks target membership, reach, walls and cast lifetime.
const C = require('../shared/world-data');
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const radius = t => t.def?.radius || 20;
module.exports = {
  boxerStacks(p, now = Date.now()) {
    if(p.dead || now >= (p.qiUntil || 0)){p.qiStacks=0;p.qiLast=null;}
    return p.qiStacks || 0;
  },
  boxerAim(p, sk, d, a) {
    const spec=C.boxerSpec(sk,p.skl.sk[sk.id],C.skillRankOf(p.skl,sk.id));
    const plan={...spec,a,x:p.x,y:p.y};
    if(spec.kind==='guard'||spec.kind==='breath')return plan;
    if(Date.now()<(p.rootUntil||0)||C.safeAt(this.defOf(p),p.x,p.y))return null;
    if(spec.kind==='single'){
      const t=this.slashTarget(p,a,spec.range+(spec.dash||0),Math.PI,d.tid);
      if(!t||(d.tid&&t.id!==d.tid)||!this.arbiterClear(p,t))return null;
      plan.target=t;plan.a=Math.atan2(t.y-p.y,t.x-p.x);
      if(spec.dash && distance(p,t)>spec.range+radius(t)){
        const [x,y]=this.dashEnd(p,plan.a,Math.min(spec.dash,distance(p,t)-radius(t)-60));
        if(distance({x,y},t)>spec.range+radius(t)||C.safeAt(this.defOf(p),x,y))return null;
        plan.step={x,y};
      }
    }
    return plan;
  },
  castBoxer(p, sk, plan, mult, now) {
    const mapId=p.mapId,epoch=p.controlEpoch||0;
    const token=p.qiSeq=(p.qiSeq||0)+1;
    const fx=data=>this.fx(p,{t:'boxer',id:p.id,skill:sk.id,token,mapId,a:plan.a,r:C.skillRankOf(p.skl,sk.id),...data});
    if(plan.kind==='guard'||plan.kind==='breath'){
      this.addBuff(p,sk.id,plan.duration,{[plan.kind==='guard'?'qiCounterGuard':'qiBreathGuard']:plan.guard,...(plan.kind==='breath'?{qiSlowResist:.5}:{})},plan.guard);
      if(plan.kind==='guard')p.qiCounter={until:now+plan.duration,epoch,travel:p.arbiterTravel||0,mult};
      fx({phase:'guard',x:p.x,y:p.y,dur:plan.duration});return;
    }
    if(plan.step){
      const from={x:p.x,y:p.y};p.x=plan.step.x;p.y=plan.step.y;p.lastInput=now+180;
      p.arbiterTravel=(p.arbiterTravel||0)+1;
      fx({phase:'step',...from,x1:p.x,y1:p.y,dur:180});
    }
    p.dir=C.dirFromAngle(plan.a);
    const travel=p.arbiterTravel||0,hits=plan.hits||1;
    const windup=sk.key==='1'?Math.min(plan.windup,C.basicCd(sk,p.stats.aspd+this.buffVal(p,'aspd'))*.35):plan.windup;
    const duration=windup+(hits-1)*(plan.gap||0);
    p.lockUntil=now+duration;p.actUntil=now+duration+180;p.moving=false;
    const valid=()=>this.alive(p)&&this.players.get(p.id)===p&&p.mapId===mapId&&p.qiSeq===token&&
      (p.controlEpoch||0)===epoch&&(p.arbiterTravel||0)===travel&&Date.now()>=(p.stunUntil||0)&&Date.now()>=(p.rootUntil||0);
    const legal=(t,members)=>!t.dead&&t.mapId===mapId&&members.has(t)&&
      distance(p,t)<=plan.range+radius(t)&&!C.safeAt(this.defOf(p),t.x,t.y)&&this.arbiterClear(p,t);
    let landed=false,bonus=1,cancelled=false;
    fx({phase:'windup',x:p.x,y:p.y,radius:plan.range,dur:windup,total:duration});
    for(let beat=0;beat<hits;beat++)this.later(windup+beat*(plan.gap||0),()=>{
      if(!valid()||C.safeAt(this.defOf(p),p.x,p.y)){
        if(!cancelled){cancelled=true;this.emitNear(mapId,p.x,p.y,'fx',{t:'boxer',id:p.id,skill:sk.id,token,mapId,phase:'cancel'});}
        return;
      }
      const candidates=this.enemiesOf(p,p.x,p.y,plan.range),members=new Set(candidates);
      let targets=plan.target?[plan.target]:candidates;
      targets=targets.filter(t=>legal(t,members)).filter(t=>plan.kind!=='cone'||Math.cos(Math.atan2(t.y-p.y,t.x-p.x)-plan.a)>=.35)
        .sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,plan.cap||1);
      for(const t of targets){
        if(!valid())break;
        const stacks=this.boxerStacks(p);
        if(!landed)bonus=plan.finisher?1+stacks*C.BOXER.stackPower:1;
        const dealt=this.applyDamage(p,t,plan.power*mult*bonus/hits,{defK:1/hits,onHitWeight:1/(hits*Math.max(1,targets.length)),
          ...(beat===hits-1?{stun:plan.stun,armorBreak:plan.armorBreak}:{}),qiCounter:!!plan.counter});
        if(dealt>0&&!landed){
          landed=true;
          if(plan.finisher){p.qiStacks=0;p.qiLast=null;p.qiUntil=0;}
          else if(p.qiLast!==sk.id){p.qiStacks=Math.min(C.BOXER.stacks,stacks+1);p.qiLast=sk.id;p.qiUntil=Date.now()+C.BOXER.comboMs;}
        }
      }
      fx({phase:'hit',x:p.x,y:p.y,tx:plan.target?.x,ty:plan.target?.y,radius:plan.range,beat,hits,dur:230,landed:targets.length>0});
    });
  },
  boxerCounter(p, src, opts, now) {
    const guard=p.qiCounter;
    if(!guard||now>=guard.until||opts.dot||opts.proc||opts.reflect||opts.qiCounter||p.dead)return;
    p.qiCounter=null; // one direct incoming blow consumes the window, even when the attacker is too far away
    if((p.controlEpoch||0)!==guard.epoch||(p.arbiterTravel||0)!==guard.travel||now<(p.stunUntil||0)||now<(p.rootUntil||0))return;
    const sk=C.ALL_SKILLS.qiCounter,plan=this.boxerAim(p,{...sk,boxer:{...sk.boxer,kind:'single'}},
      {tid:src.id},Math.atan2(src.y-p.y,src.x-p.x));
    if(plan&&plan.target===src)this.castBoxer(p,sk,{...plan,kind:'single',counter:true},guard.mult,now);
  },
};
