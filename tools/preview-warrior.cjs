// Read-only asset preview: current workspace files + existing server's terrain.
// No accounts, player saves or gameplay handlers are attached to this socket server.
const express=require('express'),http=require('node:http'),path=require('node:path');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app);new Server(server);
app.get('/api/map{/:id}',async(req,res)=>{
  try{const r=await fetch('http://127.0.0.1:3900'+req.originalUrl);res.status(r.status).type('json').send(await r.text());}
  catch(e){res.status(502).json({error:'Start the game on port 3900 for terrain previews'});}
});
app.use('/shared',express.static(path.join(__dirname,'../shared')));
app.use(express.static(path.join(__dirname,'../public')));
server.listen(3902,'127.0.0.1',()=>console.log('Read-only warrior preview: http://127.0.0.1:3902'));
