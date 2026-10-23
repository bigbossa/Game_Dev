// Marks an account as GM (or removes it): npm run gm -- <บัญชี> [off]
// The player logs in again (or presses F5) for it to take effect.
const fs = require('fs');
const path = require('path');
const ENV_FILE = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const db = require('../server/db');
const Accounts = require('../server/accounts');

(async () => {
  const [user, flag] = process.argv.slice(2);
  if (!user) { console.log('ใช้: npm run gm -- <ชื่อบัญชี> [off]'); process.exit(1); }
  const pool = await db.open();
  const on = !['off', '0', 'false'].includes(String(flag || '').toLowerCase());
  const name = await new Accounts(pool).setGm(user, on);
  console.log(name ? `${name}: ${on ? 'เป็น GM แล้ว' : 'ยกเลิก GM แล้ว'}` : `ไม่พบบัญชี "${user}"`);
  await pool.end();
  process.exit(name ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(1); });
