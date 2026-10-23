// Accounts: register / login with a password, remember-me sessions, GM flag.
// Passwords are stored as scrypt hashes; the browser keeps a random session token, the database only its sha256.
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const USER_RE = /^[\p{L}\p{M}\p{N}_]{2,20}$/u;
const PASS_MIN = 6, PASS_MAX = 72;
const SESSION_DAYS = 30;
const KEYLEN = 64, SCRYPT = { N: 16384, r: 8, p: 1 };

async function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pass, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
async function checkPassword(pass, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(pass, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(want, got);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

class Accounts {
  constructor(pool) {
    this.pool = pool;
  }
  static cleanUser(u) { return String(u || '').trim(); }
  static userError(u) { return USER_RE.test(u) ? '' : 'ชื่อบัญชีต้องยาว 2-20 ตัว (ไทย/อังกฤษ/ตัวเลข/_ ไม่มีเว้นวรรค)'; }
  static passError(p) {
    if (typeof p !== 'string' || p.length < PASS_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASS_MIN} ตัว`;
    if (p.length > PASS_MAX) return `รหัสผ่านยาวได้ไม่เกิน ${PASS_MAX} ตัว`;
    return '';
  }

  async register(user, pass) {
    user = Accounts.cleanUser(user);
    const err = Accounts.userError(user) || Accounts.passError(pass);
    if (err) return { error: err };
    const hash = await hashPassword(pass);
    const r = await this.pool.query(
      `INSERT INTO accounts (username, user_key, pass_hash, last_login) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_key) DO NOTHING RETURNING id, username, is_gm`,
      [user, user.toLowerCase(), hash]);
    if (!r.rowCount) return { error: 'ชื่อบัญชีนี้มีผู้ใช้แล้ว' };
    return { account: r.rows[0] };
  }
  async login(user, pass) {
    user = Accounts.cleanUser(user);
    const r = await this.pool.query('SELECT id, username, is_gm, pass_hash FROM accounts WHERE user_key = $1', [user.toLowerCase()]);
    const row = r.rows[0];
    if (!row || typeof pass !== 'string' || !(await checkPassword(pass, row.pass_hash))) return { error: 'ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง' };
    await this.pool.query('UPDATE accounts SET last_login = now() WHERE id = $1', [row.id]);
    return { account: { id: row.id, username: row.username, is_gm: row.is_gm } };
  }
  // re-asks the password before something that cannot be undone (deleting a character)
  async verifyPassword(id, pass) {
    const r = await this.pool.query('SELECT pass_hash FROM accounts WHERE id = $1', [id]);
    return !!r.rowCount && typeof pass === 'string' && checkPassword(pass, r.rows[0].pass_hash);
  }
  async changePassword(id, oldPass, newPass) {
    const err = Accounts.passError(newPass);
    if (err) return { error: err };
    const r = await this.pool.query('SELECT pass_hash FROM accounts WHERE id = $1', [id]);
    if (!r.rowCount || typeof oldPass !== 'string' || !(await checkPassword(oldPass, r.rows[0].pass_hash))) return { error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    await this.pool.query('UPDATE accounts SET pass_hash = $2 WHERE id = $1', [id, await hashPassword(newPass)]);
    await this.pool.query('DELETE FROM sessions WHERE account_id = $1', [id]);   // other devices log in again
    return {};
  }

  async newSession(accountId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.pool.query(
      `INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
      [sha256(token), accountId]);
    return token;
  }
  async bySession(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const r = await this.pool.query(
      `SELECT a.id, a.username, a.is_gm FROM sessions s JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)]);
    if (!r.rowCount) return null;
    await this.pool.query('UPDATE accounts SET last_login = now() WHERE id = $1', [r.rows[0].id]);
    return r.rows[0];
  }
  async endSession(token) {
    if (typeof token === 'string') await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }
  async setGm(user, on) {
    const r = await this.pool.query('UPDATE accounts SET is_gm = $2 WHERE user_key = $1 RETURNING username', [Accounts.cleanUser(user).toLowerCase(), !!on]);
    return r.rowCount ? r.rows[0].username : null;
  }
}

module.exports = Accounts;
