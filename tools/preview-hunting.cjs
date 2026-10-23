// Isolated geometry preview: same server generator, no database or gameplay handlers.
const express=require('express'),path=require('node:path'),C=require('../shared/world-data');
const app=express(),maps=new Map();
app.get('/api/map/:id',(req,res)=>{
  const id=req.params.id,d=C.MAPS[id];if(!d||d.pvp)return res.sendStatus(404);
  if(!maps.has(id)){
    const m=C.generateField(d,20261018+101*(C.MAP_ORDER.indexOf(id)+1));
    maps.set(id,{...m,id,tile:C.TILE,tiles:Buffer.from(m.tiles).toString('base64'),solid:Buffer.from(m.solid).toString('base64')});
  }
  res.json(maps.get(id));
});
app.use('/shared',express.static(path.join(__dirname,'../shared')));
app.use(express.static(path.join(__dirname,'../public')));
app.listen(3903,'127.0.0.1',()=>console.log('Hunting maps preview: http://127.0.0.1:3903/hunting-review.html'));
