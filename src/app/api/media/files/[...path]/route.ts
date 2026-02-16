import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'
import { getContentType, isStreamingType } from '@/lib/media/formats'

// Route config for streaming large files
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Chunk size when browser sends open-ended range (e.g. bytes=0-)
// 2MB chunks for faster initial load and smoother streaming
const RANGE_CHUNK_SIZE = 2 * 1024 * 1024

/**
 * Parse Range header into start/end bytes.
 * Supports:
 *   bytes=0-999     (standard range)
 *   bytes=0-        (open-ended, from start)
 *   bytes=-500      (suffix range, last 500 bytes - needed for MP4 moov atom)
 */
function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } | null {
  // Suffix range: bytes=-N (last N bytes)
  const suffixMatch = rangeHeader.match(/bytes=-(\d+)/)
  if (suffixMatch && !rangeHeader.match(/bytes=\d/)) {
    const suffix = parseInt(suffixMatch[1], 10)
    const start = Math.max(0, totalSize - suffix)
    return { start, end: totalSize - 1 }
  }

  // Standard range: bytes=N-M or bytes=N-
  const standardMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (standardMatch) {
    const start = parseInt(standardMatch[1], 10)
    const requestedEnd = standardMatch[2] ? parseInt(standardMatch[2], 10) : undefined

    // If no end specified, serve a chunk (not the entire remaining file)
    const end = requestedEnd !== undefined
      ? Math.min(requestedEnd, totalSize - 1)
      : Math.min(start + RANGE_CHUNK_SIZE - 1, totalSize - 1)

    return { start, end }
  }

  return null
}

/**
 * HEAD - Returns metadata without body.
 * Some Smart TV browsers (LG WebOS) send HEAD before GET.
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const storagePath = pathSegments.join('/')

  if (!storagePath) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const storage = getStorage()
    const contentType = getContentType(storagePath)

    if (isStreamingType(contentType)) {
      const metadata = await storage.getMetadata(storagePath)
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(metadata.size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }

    const metadata = await storage.getMetadata(storagePath)
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(metadata.size),
        'Accept-Ranges': 'bytes',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
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

  try {
    const storage = getStorage()
    const contentType = getContentType(storagePath)
    const rangeHeader = request.headers.get('range')

    // For video/audio files, handle range-based streaming
    if (isStreamingType(contentType)) {
      const metadata = await storage.getMetadata(storagePath)
      const totalSize = metadata.size

      // Handle Range request
      if (rangeHeader) {
        const range = parseRange(rangeHeader, totalSize)
        if (range) {
          const { start, end } = range
          const chunkSize = end - start + 1

          // Stream the response directly instead of buffering in memory
          const stream = await storage.downloadRangeStream(storagePath, start, end)

          return new NextResponse(stream, {
            status: 206,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=604800',
            },
          })
        }
      }

      // No Range header - return full file as 200
      // Critical for LG TV: must be 200, NOT 206
      // Browser will see Accept-Ranges and make range requests as needed
      const data = await storage.download(storagePath)

      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }

    // Non-streaming files: return full content
    const data = await storage.download(storagePath)

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error(`Media proxy error for ${storagePath}:`, error)
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
  }
}
