import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { unlink, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { getStorage } from '@/lib/storage'
import { supabase } from '@/lib/supabase/client'
import { canTranscode, getTranscodedPath } from '@/lib/media/formats'
import { transcodeManager } from '@/lib/media/transcode-manager'
import { isMediaRequestAllowed } from '@/lib/media/access'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const execFileAsync = promisify(execFile)
const TRANSCODE_DIR = '/tmp/transcode'

/**
 * Run the actual transcode in background (not awaited by the request handler).
 * Downloads source via streaming, transcodes with ffmpeg, uploads result,
 * and updates the clip's video_path so future plays are direct MP4.
 */
async function runTranscode(storagePath: string) {
  const storage = getStorage()
  const transcodedPath = getTranscodedPath(storagePath)
  const jobId = randomUUID()
  const ext = path.extname(storagePath)
  const inputFile = path.join(TRANSCODE_DIR, `${jobId}${ext}`)
  const outputFile = path.join(TRANSCODE_DIR, `${jobId}.mp4`)

  try {
    // Ensure temp dir exists
    await mkdir(TRANSCODE_DIR, { recursive: true })

    // 1. Stream download from storage to disk (avoids buffering in memory)
    transcodeManager.update(storagePath, { status: 'downloading', message: 'Downloading video from storage...' })
    console.log(`[Transcode] Streaming download: ${storagePath}`)
    const dlStart = Date.now()
    await storage.downloadToFile(storagePath, inputFile)
    const dlSec = ((Date.now() - dlStart) / 1000).toFixed(1)
    console.log(`[Transcode] Downloaded in ${dlSec}s`)

    // 2. Transcode with ffmpeg — generous timeout for long movies
    transcodeManager.update(storagePath, { status: 'transcoding', message: 'Converting video to MP4...' })
    console.log(`[Transcode] Starting ffmpeg: ${storagePath} → MP4`)
    const ffStart = Date.now()

    await execFileAsync('ffmpeg', [
      '-i', inputFile,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputFile,
    ], {
      // 20 minutes for ffmpeg — enough for long movies
      timeout: 1_200_000,
      maxBuffer: 10 * 1024 * 1024,
    })

    const ffSec = ((Date.now() - ffStart) / 1000).toFixed(1)
    console.log(`[Transcode] ffmpeg complete in ${ffSec}s`)

    // 3. Stream upload transcoded file back to storage
    transcodeManager.update(storagePath, { status: 'uploading', message: 'Saving converted video...' })
    console.log(`[Transcode] Uploading to ${transcodedPath}`)
    const ulStart = Date.now()
    await storage.uploadFromFile(outputFile, transcodedPath, 'video/mp4')
    const ulSec = ((Date.now() - ulStart) / 1000).toFixed(1)
    console.log(`[Transcode] Uploaded in ${ulSec}s`)

    // 4. Update clip's video_path to the transcoded version
    transcodeManager.update(storagePath, { status: 'updating', message: 'Updating clip record...' })
    try {
      const { error } = await supabase
        .from('clips')
        .update({ video_path: transcodedPath, updated_at: new Date().toISOString() })
        .eq('video_path', storagePath)

      if (error) {
        console.warn(`[Transcode] DB update warning: ${error.message}`)
      } else {
        console.log(`[Transcode] Updated clip video_path: ${storagePath} → ${transcodedPath}`)
      }
    } catch (dbErr) {
      // Non-fatal — the transcoded file is cached and will be found on next play
      console.warn('[Transcode] DB update failed (non-fatal):', dbErr)
    }

    // 5. Generate signed URL and mark complete
    const url = await storage.getSignedUrl(transcodedPath, 3600)

    transcodeManager.update(storagePath, {
      status: 'complete',
      message: 'Conversion complete',
      url,
      newVideoPath: transcodedPath,
    })

    console.log(`[Transcode] Complete: ${storagePath} → ${transcodedPath}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcoding failed'
    console.error(`[Transcode] Failed for ${storagePath}:`, message)
    transcodeManager.update(storagePath, {
      status: 'error',
      message,
      error: message,
    })
  } finally {
    await unlink(inputFile).catch(() => {})
    await unlink(outputFile).catch(() => {})
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const storagePath = pathSegments.join('/')

  if (!storagePath) {
    return NextResponse.json({ success: false, error: 'Path required' }, { status: 400 })
  }

  // Transcoding is expensive (ffmpeg + storage IO) — never let it be triggered
  // by an unauthenticated caller.
  if (!(await isMediaRequestAllowed(request, storagePath))) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!canTranscode(storagePath)) {
    return NextResponse.json(
      { success: false, error: 'File is not a supported video format' },
      { status: 400 }
    )
  }

  const storage = getStorage()
  const transcodedPath = getTranscodedPath(storagePath)

  // 1. Check if already transcoded in storage
  try {
    const exists = await storage.exists(transcodedPath)
    if (exists) {
      console.log(`[Transcode] Cache hit: ${transcodedPath}`)
      const url = await storage.getSignedUrl(transcodedPath, 3600)

      // Also update clip's video_path if it still points to the old path
      Promise.resolve(
        supabase
          .from('clips')
          .update({ video_path: transcodedPath, updated_at: new Date().toISOString() })
          .eq('video_path', storagePath)
      ).catch(() => {})

      return NextResponse.json({ success: true, url, cached: true })
    }
  } catch {
    // Continue
  }

  // 2. Check if a job is already running
  const existingJob = transcodeManager.get(storagePath)
  if (existingJob) {
    if (existingJob.status === 'complete' && existingJob.url) {
      return NextResponse.json({ success: true, url: existingJob.url, cached: true })
    }
    if (existingJob.status === 'error') {
      // Allow retry — remove the failed job
      transcodeManager.remove(storagePath)
    } else {
      // Job in progress — return status for polling
      return NextResponse.json({
        success: true,
        status: existingJob.status,
        message: existingJob.message,
      })
    }
  }

  // 3. Verify source exists before starting
  const sourceExists = await storage.exists(storagePath)
  if (!sourceExists) {
    return NextResponse.json({ success: false, error: 'Source file not found' }, { status: 404 })
  }

  // 4. Start async transcode job
  transcodeManager.set(storagePath, {
    status: 'downloading',
    message: 'Starting conversion...',
    startedAt: Date.now(),
  })

  // Fire and forget — the client will poll for status
  runTranscode(storagePath).catch((err) => {
    console.error('[Transcode] Unhandled error:', err)
    transcodeManager.update(storagePath, {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  })

  return NextResponse.json({
    success: true,
    status: 'downloading',
    message: 'Starting conversion...',
  })
}
