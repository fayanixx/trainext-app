import { createClient } from '@supabase/supabase-js'

// Kung walang mabasa mula sa .env o build environment, gagamitin nito ang mismong credentials ng TraiNext project
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  'https://epxeoaxfelsyrrhdgdlg.supabase.co'

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_MJ6M41KG81Oz9VSqcd6lUw_zBz4-DP2' 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})