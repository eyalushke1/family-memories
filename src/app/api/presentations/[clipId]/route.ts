import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// GET - Get presentation data for playback
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const err = checkSupabase()
  if (err) return err

  const { clipId } = await params

  // Get presentation by clip ID
  const { data: presentation, error: presError } = await supabase
    .from('presentations')
    .select('*')
    .eq('clip_id', clipId)
    .single()

  if (presError || !presentation) {
    return errorResponse('Presentation not found', 404)
  }

  // Get slides
  const { data: slides, error: slidesError } = await supabase
    .from('presentation_slides')
    .select('*')
    .eq('presentation_id', presentation.id)
    .order('sort_order', { ascending: true })

  if (slidesError) {
    console.error('Failed to fetch slides:', slidesError)
    return errorResponse(`Failed to fetch slides: ${slidesError.message}`)
  }

  // Transform slides to include proxy URLs
  const slidesWithUrls = slides.map((slide) => ({
    id: slide.id,
    imageUrl: `/api/media/files/${slide.image_path}`,
    caption: slide.caption,
    durationMs: slide.duration_ms,
    sortOrder: slide.sort_order,
  }))

  return successResponse({
    id: presentation.id,
    slideDurationMs: presentation.slide_duration_ms,
    transitionType: presentation.transition_type,
    transitionDurationMs: presentation.transition_duration_ms,
    backgroundMusicUrl: presentation.background_music_path
      ? `/api/media/files/${presentation.background_music_path}`
      : null,
    musicFadeOutMs: presentation.music_fade_out_ms || 3000,
    muteVideoAudio: presentation.mute_video_audio ?? true,
    slides: slidesWithUrls,
  })
}
