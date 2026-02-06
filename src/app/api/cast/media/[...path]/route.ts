import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

// Route config for streaming large files
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

function isStreamingType(contentType: string): boolean {
  return contentType.startsWith('video/') || contentType.startsWith('audio/')
}

function addCorsHeaders(headers: Headers): Headers {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
  return headers
}

// Chunk size when browser sends open-ended range
const RANGE_CHUNK_SIZE = 10 * 1024 * 1024

/**
 * Parse Range header - supports standard and suffix ranges.
 * Suffix range (bytes=-N) is critical for MP4 moov atom at end of file.
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

    const end = requestedEnd !== undefined
      ? Math.min(requestedEnd, totalSize - 1)
      : Math.min(start + RANGE_CHUNK_SIZE - 1, totalSize - 1)

    return { start, end }
  }

  return null
}

export async function OPTIONS() {
  const headers = new Headers()
  addCorsHeaders(headers)
  return new NextResponse(null, { status: 204, headers })
}

export async function HEAD(
  _request: NextRequest,
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
    const metadata = await storage.getMetadata(storagePath)

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': String(metadata.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=604800',
    })
    addCorsHeaders(headers)

    return new NextResponse(null, { status: 200, headers })
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

          const headers = new Headers({
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=604800',
          })
          addCorsHeaders(headers)

          return new NextResponse(stream, { status: 206, headers })
        }
      }

      // No Range header - return full file as 200
      const data = await storage.download(storagePath)

      const headers = new Headers({
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=604800',
      })
      addCorsHeaders(headers)

      return new NextResponse(new Uint8Array(data), { status: 200, headers })
    }

    // Non-streaming files: return full content
    const data = await storage.download(storagePath)

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    })
    addCorsHeaders(headers)

    return new NextResponse(new Uint8Array(data), { status: 200, headers })
  } catch (error) {
    console.error(`Cast media proxy error for ${storagePath}:`, error)
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
  }
}
