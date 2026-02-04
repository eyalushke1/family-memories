import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

// Route config for streaming large files
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CONTENT_TYPES: Record<string, string> = {
  // Images
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
}

function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

function isStreamingType(contentType: string): boolean {
  return contentType.startsWith('video/') || contentType.startsWith('audio/')
}

// Chunk size for range requests - 10MB for better LG TV compatibility
const RANGE_CHUNK_SIZE = 10 * 1024 * 1024
// Max file size to load fully into memory (50MB)
const MAX_FULL_LOAD_SIZE = 50 * 1024 * 1024

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

    // For video/audio files, handle range requests for streaming
    if (isStreamingType(contentType)) {
      // Get file metadata
      const metadata = await storage.getMetadata(storagePath)
      const totalSize = metadata.size

      // Handle range request (browser requesting specific bytes)
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const requestedEnd = match[2] ? parseInt(match[2], 10) : undefined

          // If end not specified, return a chunk of RANGE_CHUNK_SIZE
          // If end specified, honor the request (but cap at file size)
          const end = requestedEnd !== undefined
            ? Math.min(requestedEnd, totalSize - 1)
            : Math.min(start + RANGE_CHUNK_SIZE - 1, totalSize - 1)

          const chunkSize = end - start + 1

          // Download the requested range
          const data = await storage.downloadRange(storagePath, start, end)

          return new NextResponse(new Uint8Array(data), {
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

      // No range header - return full file with proper headers
      // This is critical for LG TV compatibility - must return 200, not 206
      // The browser will then make range requests if needed

      if (totalSize <= MAX_FULL_LOAD_SIZE) {
        // File small enough to load fully - return complete file
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

      // Large file - stream it in chunks using ReadableStream
      // This allows us to return 200 status with full Content-Length
      const stream = new ReadableStream({
        async start(controller) {
          let offset = 0
          const chunkSize = RANGE_CHUNK_SIZE

          try {
            while (offset < totalSize) {
              const end = Math.min(offset + chunkSize - 1, totalSize - 1)
              const chunk = await storage.downloadRange(storagePath, offset, end)
              controller.enqueue(new Uint8Array(chunk))
              offset = end + 1
            }
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new NextResponse(stream, {
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
