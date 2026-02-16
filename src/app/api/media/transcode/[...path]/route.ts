import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { getStorage } from '@/lib/storage'
import { needsTranscoding, getTranscodedPath } from '@/lib/media/formats'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const execFileAsync = promisify(execFile)
const TRANSCODE_DIR = '/tmp/transcode'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const storagePath = pathSegments.join('/')

  if (!storagePath) {
    return NextResponse.json({ success: false, error: 'Path required' }, { status: 400 })
  }

  if (!needsTranscoding(storagePath)) {
    return NextResponse.json(
      { success: false, error: 'File does not need transcoding' },
      { status: 400 }
    )
  }

  const storage = getStorage()
  const transcodedPath = getTranscodedPath(storagePath)

  // Check if already transcoded
  try {
    const exists = await storage.exists(transcodedPath)
    if (exists) {
      console.log(`[Transcode] Cache hit: ${transcodedPath}`)
      const url = await storage.getSignedUrl(transcodedPath, 3600)
      return NextResponse.json({ success: true, url, cached: true })
    }
  } catch {
    // Continue to transcode
  }

  // Verify source exists
  const sourceExists = await storage.exists(storagePath)
  if (!sourceExists) {
    return NextResponse.json({ success: false, error: 'Source file not found' }, { status: 404 })
  }

  const jobId = randomUUID()
  const ext = path.extname(storagePath)
  const inputFile = path.join(TRANSCODE_DIR, `${jobId}${ext}`)
  const outputFile = path.join(TRANSCODE_DIR, `${jobId}.mp4`)

  try {
    // Download source
    console.log(`[Transcode] Downloading: ${storagePath}`)
    const sourceData = await storage.download(storagePath)
    await writeFile(inputFile, sourceData)
    console.log(`[Transcode] Downloaded ${(sourceData.length / 1024 / 1024).toFixed(1)}MB`)

    // Transcode with ffmpeg
    console.log(`[Transcode] Starting ffmpeg: ${storagePath} → MP4`)
    const startTime = Date.now()

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
    ], { timeout: 240_000 }) // 4 minute timeout for ffmpeg

    const elapsed = Date.now() - startTime
    console.log(`[Transcode] ffmpeg complete in ${(elapsed / 1000).toFixed(1)}s`)

    // Upload transcoded file
    const transcodedData = await readFile(outputFile)
    console.log(`[Transcode] Uploading ${(transcodedData.length / 1024 / 1024).toFixed(1)}MB to ${transcodedPath}`)

    await storage.upload(transcodedPath, transcodedData, {
      contentType: 'video/mp4',
    })

    // Generate signed URL
    const url = await storage.getSignedUrl(transcodedPath, 3600)

    console.log(`[Transcode] Complete: ${storagePath} → ${transcodedPath}`)
    return NextResponse.json({ success: true, url, cached: false, elapsedMs: elapsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcoding failed'
    console.error(`[Transcode] Failed for ${storagePath}:`, message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  } finally {
    // Clean up temp files
    await unlink(inputFile).catch(() => {})
    await unlink(outputFile).catch(() => {})
  }
}
