import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://stkgsygonyxtrdhlgusx.supabase.co'
const supabaseAnonKey = 'sb_publishable_lzLwfUm87890uaQlGaByJw_iuW0PCq4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)