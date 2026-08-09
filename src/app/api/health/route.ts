import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { getSchedulerStatus } from '@/lib/keepalive/scheduler'
import { isMediaAccessConfigured } from '@/lib/media/access'

export const dynamic = 'force-dynamic'

export async function GET() {
  // The media gateway fails closed: with no signing secret every media request
  // is rejected, so this must be verifiable without shipping the secret.
  const mediaAccessConfigured = isMediaAccessConfigured()

  const config = {
    supabaseConfigured: isSupabaseConfigured,
    mediaAccessConfigured,
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

  const healthy = isSupabaseConfigured && mediaAccessConfigured
  const problems = [
    !isSupabaseConfigured && 'Missing SUPABASE_URL or SUPABASE_KEY',
    !mediaAccessConfigured &&
      'Missing MEDIA_TOKEN_SECRET/TOKEN_ENCRYPTION_KEY — all media requests will be rejected',
  ].filter(Boolean)

  return NextResponse.json({
    status: healthy ? 'healthy' : 'misconfigured',
    config,
    keepalive,
    message: healthy ? 'All required environment variables are set' : problems.join('; '),
  })
}
