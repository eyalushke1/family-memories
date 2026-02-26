/**
 * Shared video conversion logic.
 * Downloads a video from storage, transcodes to MP4 with ffmpeg,
 * uploads the result, and updates the clip's video_path in the DB.
 *
 * Used by:
 * - Upload endpoints (fire-and-forget after upload)
 * - Cron endpoint (scheduled scan for non-MP4 clips)
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { unlink, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { getStorage } from '@/lib/storage'
import { supabase } from '@/lib/supabase/client'
import { UNIVERSAL_VIDEO_EXTENSIONS } from '@/lib/media/formats'

const execFileAsync = promisify(execFile)
const TRANSCODE_DIR = '/tmp/transcode'

/** Check if a video_path needs conversion (not already MP4/M4V) */
export function needsConversion(videoPath: string): boolean {
  if (!videoPath || videoPath === 'presentation') return false
  const ext = '.' + videoPath.split('.').pop()?.toLowerCase()
  return !UNIVERSAL_VIDEO_EXTENSIONS.includes(ext)
}

/** Get the MP4 path for a converted video, keeping it in the same folder */
export function getConvertedPath(originalPath: string): string {
  const lastDot = originalPath.lastIndexOf('.')
  const withoutExt = lastDot > -1 ? originalPath.substring(0, lastDot) : originalPath
  return `${withoutExt}.mp4`
}

export interface ConvertResult {
  success: boolean
  newVideoPath?: string
  error?: string
}

/**
 * Convert a video clip from any format to MP4.
 * Downloads from storage, transcodes, uploads, and updates DB.
 *
 * @param storagePath - Current video_path in storage (e.g. "videos/abc/movie.avi")
 * @param clipId - The clip ID to update in the DB
 * @param table - Which table to update ('clips' or 'intro_clips')
 */
export async function convertClipVideo(
  storagePath: string,
  clipId: string,
  table: 'clips' | 'intro_clips' = 'clips'
): Promise<ConvertResult> {
  if (!needsConversion(storagePath)) {
    return { success: true, newVideoPath: storagePath }
  }

  const storage = getStorage()
  const convertedPath = getConvertedPath(storagePath)
  const jobId = randomUUID()
  const ext = path.extname(storagePath)
  const inputFile = path.join(TRANSCODE_DIR, `${jobId}${ext}`)
  const outputFile = path.join(TRANSCODE_DIR, `${jobId}.mp4`)

  try {
    await mkdir(TRANSCODE_DIR, { recursive: true })

    // 1. Download source video
    console.log(`[Convert] Downloading: ${storagePath}`)
    const dlStart = Date.now()
    await storage.downloadToFile(storagePath, inputFile)
    const dlSec = ((Date.now() - dlStart) / 1000).toFixed(1)
    console.log(`[Convert] Downloaded in ${dlSec}s`)

    // 2. Transcode with ffmpeg
    console.log(`[Convert] Transcoding: ${storagePath} → MP4`)
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
      timeout: 1_200_000, // 20 minutes
      maxBuffer: 10 * 1024 * 1024,
    })
    const ffSec = ((Date.now() - ffStart) / 1000).toFixed(1)
    console.log(`[Convert] Transcoded in ${ffSec}s`)

    // 3. Upload converted file
    console.log(`[Convert] Uploading: ${convertedPath}`)
    const ulStart = Date.now()
    await storage.uploadFromFile(outputFile, convertedPath, 'video/mp4')
    const ulSec = ((Date.now() - ulStart) / 1000).toFixed(1)
    console.log(`[Convert] Uploaded in ${ulSec}s`)

    // 4. Update clip's video_path to the converted version
    const { error: dbError } = await supabase
      .from(table)
      .update({ video_path: convertedPath, updated_at: new Date().toISOString() })
      .eq('id', clipId)

    if (dbError) {
      console.warn(`[Convert] DB update warning for ${clipId}: ${dbError.message}`)
    } else {
      console.log(`[Convert] Updated ${table}.video_path: ${storagePath} → ${convertedPath}`)
    }

    // 5. Optionally delete the old file (keep it as backup for now)
    // await storage.delete(storagePath).catch(() => {})

    return { success: true, newVideoPath: convertedPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed'
    console.error(`[Convert] Failed for ${storagePath}:`, message)
    return { success: false, error: message }
  } finally {
    await unlink(inputFile).catch(() => {})
    await unlink(outputFile).catch(() => {})
  }
}
