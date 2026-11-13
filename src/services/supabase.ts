import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qhgbplpzmsvedjjncrxx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bMgdBdxXosxUTnlX8_XZtw_pYbnNsPT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
