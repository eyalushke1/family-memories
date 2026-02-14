import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { runPingCycle } from '@/lib/keepalive/scheduler'

export async function POST() {
  const err = checkSupabase()
  if (err) return err

  try {
    const results = await runPingCycle()
    return successResponse(results)
  } catch (e) {
    console.error('Failed to run ping cycle:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to run ping cycle')
  }
}
