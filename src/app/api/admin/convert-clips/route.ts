import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { needsConversion, convertClipVideo } from '@/lib/media/convert-video'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(_request: NextRequest) {
  const start = Date.now()
  console.log('[Admin-Convert] Starting clip conversion scan')

  try {
    const results: { clipId: string; table: string; oldPath: string; newPath?: string; error?: string }[] = []

    // 1. Scan regular clips
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, video_path')
      .not('video_path', 'is', null)
      .neq('video_path', 'presentation')

    if (clipsError) {
      console.error('[Admin-Convert] Failed to fetch clips:', clipsError.message)
    }

    const clipsToConvert = (clips || []).filter((c) => needsConversion(c.video_path))

    // 2. Scan intro clips
    const { data: introClips, error: introError } = await supabase
      .from('intro_clips')
      .select('id, video_path')
      .not('video_path', 'is', null)

    if (introError) {
      console.error('[Admin-Convert] Failed to fetch intro clips:', introError.message)
    }

    const introsToConvert = (introClips || []).filter((c) => needsConversion(c.video_path))

    console.log(`[Admin-Convert] Found ${clipsToConvert.length} clips + ${introsToConvert.length} intros needing conversion`)

    // 3. Convert sequentially
    for (const clip of clipsToConvert) {
      console.log(`[Admin-Convert] Converting clip ${clip.id}: ${clip.video_path}`)
      const result = await convertClipVideo(clip.video_path, clip.id, 'clips')
      results.push({
        clipId: clip.id,
        table: 'clips',
        oldPath: clip.video_path,
        newPath: result.newVideoPath,
        error: result.error,
      })
    }

    for (const intro of introsToConvert) {
      console.log(`[Admin-Convert] Converting intro ${intro.id}: ${intro.video_path}`)
      const result = await convertClipVideo(intro.video_path, intro.id, 'intro_clips')
      results.push({
        clipId: intro.id,
        table: 'intro_clips',
        oldPath: intro.video_path,
        newPath: result.newVideoPath,
        error: result.error,
      })
    }

    const elapsed = Date.now() - start
    const converted = results.filter((r) => !r.error).length
    const failed = results.filter((r) => r.error).length

    console.log(`[Admin-Convert] Complete in ${(elapsed / 1000).toFixed(1)}s — ${converted} converted, ${failed} failed`)

    return NextResponse.json({
      success: true,
      converted,
      failed,
      results,
      elapsedMs: elapsed,
    })
  } catch (e) {
    const elapsed = Date.now() - start
    const error = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[Admin-Convert] Failed after ${elapsed}ms:`, error)
    return NextResponse.json({ success: false, error, elapsedMs: elapsed }, { status: 500 })
  }
}
