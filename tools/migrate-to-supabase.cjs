// Copies the game database (DATABASE_URL) into Supabase (SUPABASE_DB_URL): accounts, sessions, characters, meta.
// Rows already on Supabase are kept (same key = skipped), so it can be run again safely.
// The live game runs in Docker, where the old database is reachable as "db"; stop the game first, then:
//   docker compose stop game
//   docker compose run --rm -v ./server:/app/server -v ./tools:/app/tools game node tools/migrate-to-supabase.cjs
const path = require('path');
const { Client } = require('pg');
const { clientConfig, SCHEMA } = require(path.join(__dirname, '..', 'server', 'db'));

const TABLES = [
  ['accounts', 'id'],
  ['sessions', 'token_hash'],
  ['characters', 'name_key'],
  ['meta', 'key'],
];

async function main() {
  const from = process.env.DATABASE_URL, to = process.env.SUPABASE_DB_URL;
  if (!from || !to) throw new Error('ต้องตั้งทั้ง DATABASE_URL (ฐานเดิม) และ SUPABASE_DB_URL (Supabase)');
  if (from === to) throw new Error('DATABASE_URL กับ SUPABASE_DB_URL เป็นฐานเดียวกัน');
  const src = new Client(clientConfig(from)), dst = new Client(clientConfig(to));
  await src.connect();
  await dst.connect();
  try {
    await dst.query(SCHEMA);
    await dst.query('BEGIN');
    for (const [table, key] of TABLES) {
      const { rows, fields } = await src.query(`SELECT * FROM ${table}`);
      const cols = fields.map((f) => f.name);
      const list = cols.map((c) => `"${c}"`).join(', ');
      const params = cols.map((_, i) => `$${i + 1}`).join(', ');
      let n = 0;
      for (const row of rows) {
        // JSONB columns go over as JSON text; pg would otherwise send arrays as Postgres arrays
        const vals = cols.map((c) => (row[c] !== null && typeof row[c] === 'object' && !(row[c] instanceof Date) ? JSON.stringify(row[c]) : row[c]));
        const r = await dst.query(`INSERT INTO ${table} (${list}) VALUES (${params}) ON CONFLICT ("${key}") DO NOTHING`, vals);
        n += r.rowCount;
      }
      console.log(`${table}: คัดลอก ${n} / ${rows.length} แถว${n < rows.length ? ` (มีอยู่แล้ว ${rows.length - n})` : ''}`);
    }
    // new accounts continue after the copied ids
    await dst.query(`SELECT setval(pg_get_serial_sequence('accounts', 'id'), GREATEST((SELECT MAX(id) FROM accounts), 1))`);
    await dst.query('COMMIT');
    console.log(`ย้ายข้อมูลไป Supabase เสร็จ — ${new URL(to).hostname}`);
  } catch (e) {
    await dst.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((e) => {
  console.error('ย้ายข้อมูลไม่สำเร็จ:', e.message);
  process.exit(1);
});
