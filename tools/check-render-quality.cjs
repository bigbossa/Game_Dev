const assert=require('node:assert/strict'),{controller}=require('../public/js/render-quality');
const q=controller();let now=1000;
assert.equal(q.scale(),1);assert(q.ratio(3,390,844)<=2);
for(let i=0;i<800;i++){now+=33;q.sample(now);}
assert.equal(q.scale(),.7);assert.equal(q.ambient(),false);assert.equal(q.particles(),700);
now+=60000;q.sample(now,false);assert.equal(q.scale(),.7,'background must not reduce quality');
for(let i=0;i<4000;i++){now+=16.67;q.sample(now);}
assert.equal(q.scale(),1,'sustained fast frames recover quality');
q.set('high');for(let i=0;i<500;i++){now+=50;q.sample(now);}assert.equal(q.scale(),1);assert(q.ambient());
q.set('smooth');assert.equal(q.scale(),.72);assert.equal(q.particles(),300);assert(!q.ambient());
q.set('bogus');assert.equal(q.mode(),'auto');assert.equal(q.scale(),1);
assert(q.ratio(2,2560,1440)<=Math.sqrt(2.8e6/(2560*1440)));
console.log('PASS adaptive render budgets: sustained load, recovery, background, manual modes, pixel caps');
