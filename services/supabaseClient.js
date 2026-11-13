const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qhgbplpzmsvedjjncrxx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = { supabase };
