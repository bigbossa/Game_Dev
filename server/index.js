const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const compression = require("compression");
const { Server } = require("socket.io");

const ENV_FILE = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const db = require("./db");
const supabase = require("./supabase");
const Store = require("./store");
const Accounts = require("./accounts");
const World = require("./world");

const PORT = Number(process.env.PORT) || 3900;

async function main() {
  const pool = await db.open();
  const store = new Store(pool);
  const n = await store.load();
  console.log(`PostgreSQL พร้อม — ตัวละคร ${n} ตัว`);
  await supabase.check();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(compression());    // gzip every text response (JS/CSS/JSON) — cuts the 54-script first load by ~70%
  // sprite assets (public/assets, ~70MB) rarely change after they're built, so cache them hard on returning
  // visits; this route is matched before the general static mount below, so it wins for /assets/* requests
  app.use("/assets", express.static(path.join(__dirname, "..", "public", "assets"), { maxAge: "30d", immutable: true }));
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/shared", express.static(path.join(__dirname, "..", "shared")));

  const world = new World(io, store, new Accounts(pool));
  // map terrain + props by id (/api/map = the starting village)
  app.get("/api/map/:id", (req, res) => {
    const m = world.maps[req.params.id];
    if (!m) return res.status(404).json({ error: "unknown map" });
    res.json(m.payload);
  });
  app.get("/api/map", (req, res) => res.json(world.maps.village.payload));

  io.on("connection", (socket) => world.onConnect(socket));

  server.listen(PORT, () => {
    console.log(`ธรรมะ ⚔ อธรรม Online — http://localhost:${PORT}`);
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    world.saveAll();
    await store.flush();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("เปิดเซิร์ฟเวอร์ไม่สำเร็จ:", e.message);
  if (e.code === "28P01") console.error("รหัสผ่าน PostgreSQL ใน DATABASE_URL ไม่ถูกต้อง");
  if (e.code === "ECONNREFUSED") console.error("เชื่อมต่อ PostgreSQL ไม่ได้ — ตรวจว่าเซอร์วิส PostgreSQL ทำงานอยู่");
  process.exit(1);
});
