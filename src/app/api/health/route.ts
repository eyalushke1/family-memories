import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/client'

export async function GET() {
  const config = {
    supabaseConfigured: isSupabaseConfigured,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_KEY,
    supabaseSchema: process.env.SUPABASE_SCHEMA || 'family_memories',
    storageType: process.env.STORAGE_TYPE || 'not set',
    hasZadaraEndpoint: !!process.env.ZADARA_ENDPOINT,
    nodeEnv: process.env.NODE_ENV,
  }

  return NextResponse.json({
    status: isSupabaseConfigured ? 'healthy' : 'misconfigured',
    config,
    message: isSupabaseConfigured
      ? 'All required environment variables are set'
      : 'Missing SUPABASE_URL or SUPABASE_KEY environment variables',
  })
}
