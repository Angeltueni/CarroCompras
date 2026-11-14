const { createClient } = require('@supabase/supabase-js');

// Sanitización de variables de entorno (evita comillas, espacios o strings vacíos)
function cleanUrl(val, fallback) {
  if (!val || typeof val !== 'string') return fallback;
  const cleaned = val.trim().replace(/^['"]|['"]$/g, '');
  return cleaned.startsWith('http') ? cleaned : fallback;
}

function cleanKey(val, fallback) {
  if (!val || typeof val !== 'string') return fallback;
  const cleaned = val.trim().replace(/^['"]|['"]$/g, '');
  return cleaned.length > 5 ? cleaned : fallback;
}

const SUPABASE_URL = cleanUrl(process.env.SUPABASE_URL, 'https://qhgbplpzmsvedjjncrxx.supabase.co');
const ANON_KEY = cleanKey(process.env.SUPABASE_KEY, 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT');
// Si defines SUPABASE_SERVICE_KEY los servicios la usan (permite cerrar el acceso directo desde la app con RLS)
const SUPABASE_KEY = cleanKey(process.env.SUPABASE_SERVICE_KEY, ANON_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

module.exports = { supabase, SUPABASE_URL };
