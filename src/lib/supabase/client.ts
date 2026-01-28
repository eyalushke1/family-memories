import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, isSupabaseConfigured } from './config'

export { isSupabaseConfigured }

export const supabase = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.key, {
      db: { schema: 'family_memories' },
    })
  : null!
