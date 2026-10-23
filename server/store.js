// Characters, kept in memory and written behind to PostgreSQL (table characters).
// get / put / list / remove stay synchronous for the world; flush() writes what changed.
class Store {
  constructor(pool) {
    this.pool = pool;
    this.data = {};
    this.dirty = new Set();      // keys to upsert
    this.gone = new Set();       // keys to delete
    this.writing = Promise.resolve();
  }
  async load() {
    const r = await this.pool.query('SELECT name_key, account_id, data FROM characters');
    for (const row of r.rows) this.data[row.name_key] = { ...row.data, accountId: row.account_id };
    return r.rowCount;
  }
  key(name) { return String(name).trim().toLowerCase(); }
  get(name) { return this.data[this.key(name)] || null; }
  // a save from the world carries no accountId: the owner stays the one already stored
  put(rec) {
    const k = this.key(rec.name);
    const old = this.data[k];
    if (rec.accountId === undefined) rec.accountId = old ? old.accountId : null;
    this.data[k] = rec;
    this.dirty.add(k);
    this.gone.delete(k);
  }
  list() { return Object.values(this.data); }
  ofAccount(accountId) { return this.list().filter((r) => r.accountId === accountId); }
  remove(name) {
    const k = this.key(name);
    if (!this.data[k]) return false;
    delete this.data[k];
    this.dirty.delete(k);
    this.gone.add(k);
    return true;
  }
  // flushes run one after another; a failed write puts its keys back for the next flush
  flush() {
    this.writing = this.writing.then(() => this.write()).catch((e) => console.error('บันทึกตัวละครไม่สำเร็จ:', e.message));
    return this.writing;
  }
  async write() {
    if (!this.dirty.size && !this.gone.size) return;
    const up = [...this.dirty], del = [...this.gone];
    this.dirty.clear(); this.gone.clear();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const k of up) {
        const rec = this.data[k];
        if (!rec) continue;
        const { accountId, ...save } = rec;
        await client.query(
          `INSERT INTO characters (name_key, name, account_id, faction, cls, lvl, data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT (name_key) DO UPDATE SET name = $2, account_id = $3, faction = $4, cls = $5, lvl = $6, data = $7, updated_at = now()`,
          [k, rec.name, accountId || null, rec.faction, rec.cls || 'dualblade', rec.lvl || 1, save]);
      }
      if (del.length) await client.query('DELETE FROM characters WHERE name_key = ANY($1)', [del]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      for (const k of up) if (this.data[k]) this.dirty.add(k);
      for (const k of del) if (!this.data[k]) this.gone.add(k);
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = Store;
