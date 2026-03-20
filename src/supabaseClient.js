import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://stkgsygonyxtrdhlgusx.supabase.co'
export const supabaseAnonKey = 'sb_publishable_lzLwfUm87890uaQlGaByJw_iuW0PCq4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)