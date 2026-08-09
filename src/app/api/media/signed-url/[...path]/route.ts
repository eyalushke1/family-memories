import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'
import { isMediaRequestAllowed } from '@/lib/media/access'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const storagePath = pathSegments.join('/')

  if (!storagePath) {
    return NextResponse.json({ success: false, error: 'Path required' }, { status: 400 })
  }

  // Without this, anyone could mint a presigned storage URL for any object.
  if (!(await isMediaRequestAllowed(request, storagePath))) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const storage = getStorage()

    // Verify file exists before generating URL
    const exists = await storage.exists(storagePath)
    if (!exists) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
    }

    // Generate signed URL valid for 1 hour
    const url = await storage.getSignedUrl(storagePath, 3600)

    return NextResponse.json(
      { success: true, url },
      {
        headers: {
          // Cache the signed URL for 50 minutes (URL valid for 60)
          'Cache-Control': 'private, max-age=3000',
        },
      }
    )
  } catch (error) {
    console.error(`Signed URL error for ${storagePath}:`, error)
    return NextResponse.json({ success: false, error: 'Failed to generate URL' }, { status: 500 })
  }
}
