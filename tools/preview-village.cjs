// Isolated, stateless preview of workspace terrain. No account or player persistence handlers.
const C=require('../shared/world-data'),express=require('express'),http=require('node:http'),path=require('node:path');
const {Server}=require('socket.io'),app=express(),server=http.createServer(app);new Server(server);
const maps={};for(const [i,id]of C.MAP_ORDER.entries()){
 const d=C.MAPS[id],m=d.pvp?C.generateMap(20261018):C.generateField(d,20261018+101*(i+1));
 maps[id]={id,w:m.w,h:m.h,tile:C.TILE,version:m.version||1,seed:m.seed,tiles:Buffer.from(m.tiles).toString('base64'),solid:Buffer.from(m.solid).toString('base64'),objects:m.objects};
}
app.get('/api/map{/:id}',(req,res)=>{const m=maps[req.params.id||'village'];if(!m)return res.sendStatus(404);res.json(m);});
app.use('/shared',express.static(path.join(__dirname,'../shared')));app.use(express.static(path.join(__dirname,'../public')));
server.listen(3903,'127.0.0.1',()=>console.log('Read-only village preview http://127.0.0.1:3903'));
