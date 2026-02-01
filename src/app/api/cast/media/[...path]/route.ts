import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

function isVideoType(contentType: string): boolean {
  return contentType.startsWith('video/')
}

function addCorsHeaders(headers: Headers): Headers {
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
  return headers
}

export async function OPTIONS() {
  const headers = new Headers()
  addCorsHeaders(headers)
  return new NextResponse(null, { status: 204, headers })
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

    // For video with Range header, support partial content (HTTP 206)
    if (isVideoType(contentType) && rangeHeader) {
      const data = await storage.download(storagePath)
      const totalSize = data.length

      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (!match) {
        const headers = new Headers({
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800',
        })
        addCorsHeaders(headers)
        return new NextResponse(new Uint8Array(data), { status: 200, headers })
      }

      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
      const chunkSize = end - start + 1

      const headers = new Headers({
        'Content-Type': contentType,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=604800',
      })
      addCorsHeaders(headers)

      return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers,
      })
    }

    // Non-range request: return full file
    const data = await storage.download(storagePath)
    const cacheMaxAge = isVideoType(contentType) ? 604800 : 86400

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Accept-Ranges': 'bytes',
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
    })
    addCorsHeaders(headers)

    return new NextResponse(new Uint8Array(data), { status: 200, headers })
  } catch (error) {
    console.error(`Cast media proxy error for ${storagePath}:`, error)
    return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
  }
}
