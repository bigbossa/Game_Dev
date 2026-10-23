// Check every grade combination and equipment occupancy, including stale network slot data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/equipment-aura.js'),'utf8'),context);
const A=context.window.EquipmentAura;
let cases=0;
for(let packed=0;packed<6**5;packed++){
  let v=packed;const gg=Array.from({length:5},()=>{const g=v%6;v=Math.floor(v/6);return g;});
  for(let mask=0;mask<16;mask++){
    const ar=Array.from({length:4},(_,i)=>mask&(1<<i)?1:0);
    const worn=gg.filter((g,i)=>!i||ar[i-1]);
    const grade=Math.max(...worn),count=worn.filter(g=>g===grade).length;
    const actual=A.state({gg,ar});
    if(grade<3)assert.equal(actual,null);
    else{assert.equal(actual.grade,grade);assert.equal(actual.count,count);}
    cases++;
  }
}
const e={ar:[1,1,1,1],gg:[4,4,4,4,5]};
assert.equal(A.state(e).grade,5);assert.equal(A.state(e).count,1);
assert.equal(JSON.stringify(A.state(e)),JSON.stringify(A.state({...e,gg:[0,0,0,0,5]})));
e.ar[3]=0;assert.equal(A.state(e).grade,4);assert.equal(A.state(e).count,4);
assert.equal(A.state({...e,dead:true}),null);
for(const faction of ['dharma','adharma']){
  const colors=new Set();
  for(const grade of [3,4,5]){
    let last=0;
    for(let count=1;count<=5;count++){
      const s=A.state({faction,ar:[1,1,1,1],gg:Array.from({length:5},(_,i)=>i<count?grade:0)});
      assert(s.radius>last);last=s.radius;colors.add(s.palette.main);
    }
  }
  assert.equal(colors.size,3);
}
console.log(`PASS: ${cases} grade/slot combinations; highest-grade-only size, removal, death and faction colours`);
