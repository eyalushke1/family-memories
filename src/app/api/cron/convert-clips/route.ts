import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { needsConversion, convertClipVideo } from '@/lib/media/convert-video'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Cron-Convert] CRON_SECRET env var not set — rejecting request')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true

  const querySecret = request.nextUrl.searchParams.get('secret')
  if (querySecret === cronSecret) return true

  return false
}

interface ConvertResult {
  clipId: string
  table: string
  oldPath: string
  newPath?: string
  error?: string
}

async function scanAndConvert(): Promise<ConvertResult[]> {
  const results: ConvertResult[] = []

  // 1. Scan regular clips for non-MP4 video paths
  const { data: clips, error: clipsError } = await supabase
    .from('clips')
    .select('id, video_path')
    .not('video_path', 'is', null)
    .neq('video_path', 'presentation')

  if (clipsError) {
    console.error('[Cron-Convert] Failed to fetch clips:', clipsError.message)
  }

  const clipsToConvert = (clips || []).filter((c) => needsConversion(c.video_path))
  console.log(`[Cron-Convert] Found ${clipsToConvert.length} clips needing conversion out of ${clips?.length || 0} total`)

  // 2. Scan intro clips for non-MP4 video paths
  const { data: introClips, error: introError } = await supabase
    .from('intro_clips')
    .select('id, video_path')
    .not('video_path', 'is', null)

  if (introError) {
    console.error('[Cron-Convert] Failed to fetch intro clips:', introError.message)
  }

  const introsToConvert = (introClips || []).filter((c) => needsConversion(c.video_path))
  console.log(`[Cron-Convert] Found ${introsToConvert.length} intro clips needing conversion out of ${introClips?.length || 0} total`)

  // 3. Convert clips one at a time (to avoid overwhelming the server)
  for (const clip of clipsToConvert) {
    console.log(`[Cron-Convert] Converting clip ${clip.id}: ${clip.video_path}`)
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
    console.log(`[Cron-Convert] Converting intro ${intro.id}: ${intro.video_path}`)
    const result = await convertClipVideo(intro.video_path, intro.id, 'intro_clips')
    results.push({
      clipId: intro.id,
      table: 'intro_clips',
      oldPath: intro.video_path,
      newPath: result.newVideoPath,
      error: result.error,
    })
  }

  return results
}

async function handleConvert(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()
  console.log('[Cron-Convert] Starting clip conversion scan')

  try {
    const results = await scanAndConvert()
    const elapsed = Date.now() - start
    const converted = results.filter((r) => !r.error).length
    const failed = results.filter((r) => r.error).length

    console.log(`[Cron-Convert] Complete in ${(elapsed / 1000).toFixed(1)}s — ${converted} converted, ${failed} failed`)

    return NextResponse.json({
      success: true,
      converted,
      failed,
      results,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    const elapsed = Date.now() - start
    const error = e instanceof Error ? e.message : 'Unknown error'
    console.error(`[Cron-Convert] Failed after ${elapsed}ms:`, error)
    return NextResponse.json({ success: false, error, elapsedMs: elapsed }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handleConvert(request)
}

export async function POST(request: NextRequest) {
  return handleConvert(request)
}
