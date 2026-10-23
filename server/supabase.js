// Supabase API client (secret key: bypasses row level security — server only, never sent to the browser).
// The game itself reads and writes through PostgreSQL (db.js); this client is for Supabase features on top.
let admin = null;

function enabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function client() {
  if (!admin) admin = require('@supabase/server/core').createAdminClient();
  return admin;
}

// checks the URL and secret key with a one-row read through the REST API
async function check() {
  if (!enabled()) return;
  const { error } = await client().from('meta').select('key').limit(1);
  if (error) console.warn('Supabase API:', error.message);
  else console.log(`Supabase API พร้อม — ${new URL(process.env.SUPABASE_URL).hostname}`);
}

module.exports = { enabled, client, check };
