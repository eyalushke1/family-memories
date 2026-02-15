import { NextRequest, NextResponse } from 'next/server'
import { runPingCycle } from '@/lib/keepalive/scheduler'

// Cron endpoint for Cloud Scheduler to trigger keep-alive pings.
// Protected by CRON_SECRET header to prevent unauthorized access.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Cron] Keep-alive triggered by Cloud Scheduler')
    const results = await runPingCycle()
    return NextResponse.json({ success: true, data: results })
  } catch (e) {
    console.error('[Cron] Keep-alive failed:', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
