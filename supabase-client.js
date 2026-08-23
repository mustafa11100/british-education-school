const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured; PostgreSQL integration is disabled.');
}

const supabase = (url && serviceKey)
  ? createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

function requireSupabase() {
  if (!supabase) {
    const err = new Error('Supabase is not configured');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  return supabase;
}

module.exports = { supabase, requireSupabase };
