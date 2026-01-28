export const supabaseConfig = {
  url: process.env.SUPABASE_URL ?? '',
  key: process.env.SUPABASE_KEY ?? '',
  schema: process.env.SUPABASE_SCHEMA ?? 'family_memories',
}

export const isSupabaseConfigured =
  supabaseConfig.url.length > 0 && supabaseConfig.key.length > 0
