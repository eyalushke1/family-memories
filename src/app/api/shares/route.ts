import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST — Create a new share link for a clip */
export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const { clipId, profileId, expiryDays } = body as {
    clipId: unknown
    profileId: unknown
    expiryDays: unknown
  }

  if (typeof clipId !== 'string' || !UUID_RE.test(clipId)) {
    return errorResponse('clipId must be a valid UUID', 400)
  }

  // Verify clip exists
  const { data: clip, error: clipError } = await supabase
    .from('clips')
    .select('id, title')
    .eq('id', clipId)
    .single()

  if (clipError || !clip) {
    return errorResponse('Clip not found', 404)
  }

  // Generate 24-char URL-safe token
  const shareToken = randomBytes(18).toString('base64url')

  // Determine expiry
  let expiresAt: string | null = null
  if (typeof expiryDays === 'number' && expiryDays > 0) {
    const d = new Date()
    d.setDate(d.getDate() + expiryDays)
    expiresAt = d.toISOString()
  } else {
    // Read default from settings
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'share_default_expiry_days')
      .single()

    const defaultDays = setting ? parseInt(setting.value, 10) : 30
    if (defaultDays > 0) {
      const d = new Date()
      d.setDate(d.getDate() + defaultDays)
      expiresAt = d.toISOString()
    }
    // If defaultDays is 0 or NaN, expiresAt stays null (never expires)
  }

  const profileUUID = typeof profileId === 'string' && UUID_RE.test(profileId) ? profileId : null

  const { data, error } = await supabase
    .from('shared_clips')
    .insert({
      clip_id: clipId,
      share_token: shareToken,
      created_by_profile_id: profileUUID,
      expires_at: expiresAt,
    })
    .select('id, share_token, expires_at, created_at')
    .single()

  if (error) {
    console.error('[Shares] Failed to create share:', error)
    return errorResponse(`Failed to create share: ${error.message}`)
  }

  // Build share URL from request origin
  const origin = request.headers.get('origin') || request.nextUrl.origin
  const shareUrl = `${origin}/share/${shareToken}`

  return successResponse({
    shareId: data.id,
    shareToken: data.share_token,
    shareUrl,
    expiresAt: data.expires_at,
    clipTitle: clip.title,
  }, 201)
}

/** GET — List shares for a clip (admin use) */
export async function GET(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const clipId = request.nextUrl.searchParams.get('clipId')

  let query = supabase
    .from('shared_clips')
    .select('*')
    .order('created_at', { ascending: false })

  if (clipId) {
    query = query.eq('clip_id', clipId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Shares] Failed to fetch shares:', error)
    return errorResponse(`Failed to fetch shares: ${error.message}`)
  }

  return successResponse(data || [])
}
