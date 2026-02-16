import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { getSchedulerStatus } from '@/lib/keepalive/scheduler'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = {
    supabaseConfigured: isSupabaseConfigured,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_KEY,
    supabaseSchema: process.env.SUPABASE_SCHEMA || 'family_memories',
    storageType: process.env.STORAGE_TYPE || 'not set',
    hasZadaraEndpoint: !!process.env.ZADARA_ENDPOINT,
    hasCronSecret: !!process.env.CRON_SECRET,
    keepaliveIntervalHours: process.env.KEEPALIVE_INTERVAL_HOURS || '6',
    nodeEnv: process.env.NODE_ENV,
  }

  let keepalive = null
  if (isSupabaseConfigured) {
    try {
      keepalive = await getSchedulerStatus()
    } catch {
      keepalive = { error: 'Failed to fetch keepalive status' }
    }
  }

  return NextResponse.json({
    status: isSupabaseConfigured ? 'healthy' : 'misconfigured',
    config,
    keepalive,
    message: isSupabaseConfigured
      ? 'All required environment variables are set'
      : 'Missing SUPABASE_URL or SUPABASE_KEY environment variables',
  })
}
