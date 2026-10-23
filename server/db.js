// PostgreSQL connection + schema. SUPABASE_DB_URL, else DATABASE_URL (see .env.example), picks the server and database;
// the database itself is created on first start when the user may do so.
const fs = require('fs');
const path = require('path');
const { Pool, Client } = require('pg');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  username    TEXT NOT NULL,
  user_key    TEXT NOT NULL UNIQUE,            -- lower-case username (logins ignore case)
  pass_hash   TEXT NOT NULL,
  is_gm       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,                -- sha256 of the token kept by the browser
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS characters (
  name_key    TEXT PRIMARY KEY,                -- lower-case character name
  name        TEXT NOT NULL,
  account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,   -- NULL = imported, not claimed yet
  faction     TEXT NOT NULL,
  cls         TEXT NOT NULL,
  lvl         INTEGER NOT NULL DEFAULT 1,
  data        JSONB NOT NULL,                  -- the whole save (inventory, equipment, skills, position...)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_account ON characters(account_id);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Supabase serves the public schema over its REST API: row level security with no policies
-- keeps the publishable key out; the game connects as the owner, which RLS does not restrict
ALTER TABLE accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta       ENABLE ROW LEVEL SECURITY;
`;

function connString() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('ไม่ได้ตั้งค่า DATABASE_URL — คัดลอก .env.example เป็น .env แล้วใส่รหัสผ่าน PostgreSQL');
    process.exit(1);
  }
  return url;
}

// connect; a missing database (3D000) is created through the server's "postgres" database
// Supabase only accepts TLS. Its certificate is checked against Supabase's CA
// (Database Settings → SSL → Download certificate, saved as SUPABASE_DB_CA, default server/supabase-ca.crt)
function clientConfig(url) {
  const host = new URL(url).hostname;
  if (!/.supabase.(co|com)$/.test(host)) return { connectionString: url };
  const caFile = process.env.SUPABASE_DB_CA || path.join(__dirname, 'supabase-ca.crt');
  return { connectionString: url, ssl: fs.existsSync(caFile) ? { ca: fs.readFileSync(caFile, 'utf8') } : true };
}

async function ensureDatabase(url) {
  const probe = new Client(clientConfig(url));
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (e) {
    await probe.end().catch(() => {});
    if (e.code !== '3D000') throw e;
  }
  const u = new URL(url);
  const name = decodeURIComponent(u.pathname.slice(1));
  u.pathname = '/postgres';
  const admin = new Client(clientConfig(u.toString()));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  await admin.end();
  console.log(`สร้างฐานข้อมูล ${name} แล้ว`);
}

// characters saved in data/players.json before the database: imported once, without an account
async function importJson(pool) {
  const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'players.json');
  const done = await pool.query(`SELECT value FROM meta WHERE key = 'imported_json'`);
  if (done.rowCount || !fs.existsSync(file)) return;
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.warn('อ่าน players.json ไม่ได้:', e.message); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let n = 0;
    for (const rec of Object.values(data)) {
      if (!rec || !rec.name) continue;
      const r = await client.query(
        `INSERT INTO characters (name_key, name, faction, cls, lvl, data) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name_key) DO NOTHING`,
        [rec.name.trim().toLowerCase(), rec.name, rec.faction || 'dharma', rec.cls || 'dualblade', rec.lvl || 1, rec]);
      n += r.rowCount;
    }
    await client.query(`INSERT INTO meta (key, value) VALUES ('imported_json', $1)`, [new Date().toISOString()]);
    await client.query('COMMIT');
    console.log(`นำเข้าตัวละครจาก ${path.basename(file)} ${n} ตัว (ยังไม่มีเจ้าของ — ผู้เล่นผูกเข้าบัญชีได้ตอนสมัคร/หน้าเลือกตัวละคร)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function open() {
  const url = connString();
  await ensureDatabase(url);
  const pool = new Pool({ ...clientConfig(url), max: 10 });
  pool.on('error', (e) => console.error('PostgreSQL:', e.message));
  await pool.query(SCHEMA);
  await importJson(pool);
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  return pool;
}

module.exports = { open, connString, clientConfig, SCHEMA };
