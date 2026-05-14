import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sbuafricshuztudnyzfk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WsTXNTqTFcCdmxQUSQdfQw_TTpTS4ml';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
