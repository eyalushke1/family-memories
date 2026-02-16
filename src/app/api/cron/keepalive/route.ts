import { NextRequest, NextResponse } from 'next/server'
import { runPingCycle } from '@/lib/keepalive/scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET env var not set — rejecting request')
    return false
  }

  // Check Authorization header (Cloud Scheduler standard)
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  // Check query param (easy browser/curl testing)
  const querySecret = request.nextUrl.searchParams.get('secret')
  if (querySecret === cronSecret) return true

  console.warn('[Cron] Auth failed. Header:', authHeader ? 'present' : 'missing', 'Query:', querySecret ? 'present' : 'missing')
  return false
}

async function handleKeepAlive(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  console.log('[Cron] Keep-alive triggered')

  try {
    const results = await runPingCycle()
    const elapsed = Date.now() - start
    console.log(`[Cron] Keep-alive complete in ${elapsed}ms — ${results.length} ping(s)`)

    return NextResponse.json({
      success: true,
      data: results,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    const elapsed = Date.now() - start
    const error = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[Cron] Keep-alive failed after ${elapsed}ms:`, error)
    return NextResponse.json({ success: false, error, elapsedMs: elapsed }, { status: 500 })
  }
}

// GET — easy to test in browser or with curl
export async function GET(request: NextRequest) {
  return handleKeepAlive(request)
}

// POST — Cloud Scheduler default
export async function POST(request: NextRequest) {
  return handleKeepAlive(request)
}
