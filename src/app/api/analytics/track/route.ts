import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { VALID_DEVICE_TYPES } from '@/lib/analytics/detect-device'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

/** GET — quick verification that the view_events table is reachable */
export async function GET() {
  const err = checkSupabase()
  if (err) return err

  const { count, error } = await supabase
    .from('view_events')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return errorResponse(`Cannot reach view_events table: ${error.message}`)
  }

  return successResponse({ table: 'view_events', totalRows: count })
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const { action } = body

  // ── START: create a new view event row ──
  if (action === 'start') {
    const { clipId, profileId, deviceType } = body as {
      clipId: unknown
      profileId: unknown
      deviceType: unknown
    }

    if (!isValidUUID(clipId)) return errorResponse('clipId must be a valid UUID', 400)
    if (profileId != null && !isValidUUID(profileId)) return errorResponse('profileId must be a valid UUID', 400)

    const device = typeof deviceType === 'string' && VALID_DEVICE_TYPES.has(deviceType)
      ? deviceType
      : 'web'

    const { data, error } = await supabase
      .from('view_events')
      .insert({
        clip_id: clipId,
        profile_id: isValidUUID(profileId) ? profileId : null,
        device_type: device,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Analytics] Failed to insert view event:', error)
      return errorResponse(`Failed to track view: ${error.message}`)
    }

    return successResponse({ viewEventId: data.id }, 201)
  }

  // ── PROGRESS: periodic heartbeat — update progress but don't set ended_at ──
  if (action === 'progress') {
    const { viewEventId, durationWatched, clipDuration, completionPercent } = body as {
      viewEventId: unknown
      durationWatched: unknown
      clipDuration: unknown
      completionPercent: unknown
    }

    if (!isValidUUID(viewEventId)) return errorResponse('viewEventId must be a valid UUID', 400)

    const { error } = await supabase
      .from('view_events')
      .update({
        duration_watched_seconds: clampInt(durationWatched, 0, 86400, 0),
        clip_duration_seconds: clampInt(clipDuration, 0, 86400, 0),
        completion_percent: clampInt(completionPercent, 0, 100, 0),
      })
      .eq('id', viewEventId)

    if (error) {
      console.error('[Analytics] Failed to update progress:', error)
      return errorResponse(`Failed to update progress: ${error.message}`)
    }

    return successResponse({ updated: true })
  }

  // ── END: final signal — sets ended_at to mark view as finished ──
  if (action === 'end') {
    const { viewEventId, durationWatched, clipDuration, completionPercent } = body as {
      viewEventId: unknown
      durationWatched: unknown
      clipDuration: unknown
      completionPercent: unknown
    }

    if (!isValidUUID(viewEventId)) return errorResponse('viewEventId must be a valid UUID', 400)

    const { error } = await supabase
      .from('view_events')
      .update({
        ended_at: new Date().toISOString(),
        duration_watched_seconds: clampInt(durationWatched, 0, 86400, 0),
        clip_duration_seconds: clampInt(clipDuration, 0, 86400, 0),
        completion_percent: clampInt(completionPercent, 0, 100, 0),
      })
      .eq('id', viewEventId)

    if (error) {
      console.error('[Analytics] Failed to update view event:', error)
      return errorResponse(`Failed to update view: ${error.message}`)
    }

    return successResponse({ updated: true })
  }

  return errorResponse('Invalid action. Use "start", "progress", or "end".', 400)
}
