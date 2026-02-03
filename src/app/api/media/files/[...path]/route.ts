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

function isVideoType(contentType: string): boolean {
  return contentType.startsWith('video/')
}

// Default chunk size for range requests (5MB for smoother streaming)
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024

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

    // For video/audio files, use efficient range-based streaming
    if (isVideoType(contentType) || contentType.startsWith('audio/')) {
      // Get file metadata without downloading the whole file
      const metadata = await storage.getMetadata(storagePath)
      const totalSize = metadata.size

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          // If no end specified, serve a chunk (not the whole file)
          const requestedEnd = match[2] ? parseInt(match[2], 10) : undefined
          const end = requestedEnd !== undefined
            ? Math.min(requestedEnd, totalSize - 1)
            : Math.min(start + DEFAULT_CHUNK_SIZE - 1, totalSize - 1)

          const chunkSize = end - start + 1

          // Download only the requested range
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

      // No range header - for small files, return full content
      // For large files, return 200 with Accept-Ranges to let browser know it can request ranges
      if (totalSize <= DEFAULT_CHUNK_SIZE) {
        // Small file - just return all of it
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

      // Large file without range header - return first chunk as 206
      // This tells the browser the total size so it can make range requests
      const end = Math.min(DEFAULT_CHUNK_SIZE - 1, totalSize - 1)
      const data = await storage.downloadRange(storagePath, 0, end)

      return new NextResponse(new Uint8Array(data), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(data.length),
          'Content-Range': `bytes 0-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }

    // Non-video files: return full file (images, etc. are typically small)
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
