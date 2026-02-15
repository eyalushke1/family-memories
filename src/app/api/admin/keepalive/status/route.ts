import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getSchedulerStatus } from '@/lib/keepalive/scheduler'

export async function GET() {
  const err = checkSupabase()
  if (err) return err

  try {
    const status = await getSchedulerStatus()
    return successResponse(status)
  } catch (e) {
    console.error('Failed to get scheduler status:', e)
    return errorResponse(e instanceof Error ? e.message : 'Failed to get status')
  }
}
