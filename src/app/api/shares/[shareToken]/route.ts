import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

/** GET — Validate share token and return clip data for playback */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { shareToken } = await params

  if (!shareToken || shareToken.length < 10) {
    return errorResponse('Invalid share token', 400)
  }

  // Look up the share
  const { data: share, error: shareError } = await supabase
    .from('shared_clips')
    .select('*')
    .eq('share_token', shareToken)
    .single()

  if (shareError || !share) {
    return errorResponse('Share link not found', 404)
  }

  if (!share.is_active) {
    return errorResponse('This share link has been revoked', 410)
  }

  // Check expiry
  if (share.expires_at) {
    if (new Date(share.expires_at) < new Date()) {
      return errorResponse('This share link has expired', 410)
    }
  } else {
    // No explicit expiry — check against global default
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'share_default_expiry_days')
      .single()

    const defaultDays = setting ? parseInt(setting.value, 10) : 30
    if (defaultDays > 0) {
      const expiresAt = new Date(share.created_at)
      expiresAt.setDate(expiresAt.getDate() + defaultDays)
      if (expiresAt < new Date()) {
        return errorResponse('This share link has expired', 410)
      }
    }
    // If defaultDays is 0 or NaN, link never expires
  }

  // Fetch the clip
  const { data: clip, error: clipError } = await supabase
    .from('clips')
    .select('id, title, description, video_path, thumbnail_path, duration_seconds, intro_clip_id')
    .eq('id', share.clip_id)
    .single()

  if (clipError || !clip) {
    return errorResponse('Clip no longer exists', 404)
  }

  // Fetch intro clip if exists
  let introClip = null
  if (clip.intro_clip_id) {
    const { data: intro } = await supabase
      .from('intro_clips')
      .select('id, video_path, duration_seconds')
      .eq('id', clip.intro_clip_id)
      .eq('is_active', true)
      .single()

    introClip = intro
  }

  // Fetch presentation data if this is a slideshow
  let presentation = null
  if (clip.video_path === 'presentation') {
    const { data: pres } = await supabase
      .from('presentations')
      .select('*')
      .eq('clip_id', clip.id)
      .single()

    if (pres) {
      const { data: slides } = await supabase
        .from('presentation_slides')
        .select('*')
        .eq('presentation_id', pres.id)
        .order('sort_order', { ascending: true })

      presentation = { ...pres, slides: slides || [] }
    }
  }

  // Update view count and last viewed
  await supabase
    .from('shared_clips')
    .update({
      view_count: (share.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', share.id)

  return successResponse({
    clip: {
      id: clip.id,
      title: clip.title,
      description: clip.description,
      videoPath: clip.video_path,
      thumbnailPath: clip.thumbnail_path,
      durationSeconds: clip.duration_seconds,
    },
    introClip: introClip ? {
      id: introClip.id,
      videoPath: introClip.video_path,
      durationSeconds: introClip.duration_seconds,
    } : null,
    presentation,
  })
}

/** DELETE — Revoke a share link */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { shareToken } = await params

  const { error } = await supabase
    .from('shared_clips')
    .update({ is_active: false })
    .eq('share_token', shareToken)

  if (error) {
    console.error('[Shares] Failed to revoke share:', error)
    return errorResponse(`Failed to revoke share: ${error.message}`)
  }

  return successResponse({ revoked: true })
}
