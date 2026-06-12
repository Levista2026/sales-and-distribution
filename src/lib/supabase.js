import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://leyiexbcueohoewidaof.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_wH-NBUQEVxOCO_lK2XjaNQ_GiyDeUqr';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
