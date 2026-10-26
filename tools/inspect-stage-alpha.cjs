const fs=require('node:fs'),{PNG}=require('pngjs');
for(const f of process.argv.slice(2)){
 const p=PNG.sync.read(fs.readFileSync(f));let transparent=0,partial=0;
 for(let i=3;i<p.data.length;i+=4){if(p.data[i]===0)transparent++;else if(p.data[i]<255)partial++;}
 console.log(JSON.stringify({file:f,width:p.width,height:p.height,transparent,partial,pixels:p.width*p.height}));
}
