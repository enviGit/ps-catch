import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kmyntcpipyxqqluvqlfm.supabase.co'
const supabaseKey = 'sb_publishable_NfXnve7JNkkoLrgakYZ70A_vCaEzESn'

export const supabase = createClient(supabaseUrl, supabaseKey)