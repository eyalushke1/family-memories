import { NextRequest, NextResponse } from 'next/server'
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { MediaPaths } from '@/lib/storage/media-paths'

// Route config
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type UploadType = 'video' | 'intro-video'

function getS3Client(): S3Client | null {
  const endpoint = process.env.ZADARA_ENDPOINT
  const accessKeyId = process.env.ZADARA_ACCESS_KEY_ID
  const secretAccessKey = process.env.ZADARA_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null
  }

  return new S3Client({
    endpoint,
    forcePathStyle: true,
    region: process.env.ZADARA_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

// POST: Initiate multipart upload and get presigned URLs for parts
export async function POST(request: NextRequest) {
  try {
    const err = checkSupabase()
    if (err) return err

    const s3Client = getS3Client()
    if (!s3Client) {
      return errorResponse('Direct storage not configured. Large file upload not available.', 400)
    }

    const body = await request.json()
    const { type, id, filename, size, partCount } = body as {
      type: UploadType
      id: string
      filename: string
      size: number
      partCount: number
    }

    if (!type || !id || !filename || !size || !partCount) {
      return errorResponse('Missing required fields: type, id, filename, size, partCount', 400)
    }

    // Validate part count (S3 allows 1-10000 parts)
    if (partCount < 1 || partCount > 10000) {
      return errorResponse('Invalid part count. Must be between 1 and 10000.', 400)
    }

    // Check file size limit (2GB)
    const maxSize = 2 * 1024 * 1024 * 1024
    if (size > maxSize) {
      return errorResponse('File too large. Maximum size is 2GB.', 413)
    }

    const bucketName = process.env.ZADARA_BUCKET_NAME ?? 'family-memories'
    let storagePath: string

    switch (type) {
      case 'video':
        storagePath = MediaPaths.videos(id, filename)
        break
      case 'intro-video':
        storagePath = MediaPaths.introVideos(id, filename)
        break
      default:
        return errorResponse('Invalid upload type for multipart upload', 400)
    }

    const contentType = getContentType(filename)

    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: storagePath,
      ContentType: contentType,
    })

    const createResponse = await s3Client.send(createCommand)
    const uploadId = createResponse.UploadId

    if (!uploadId) {
      return errorResponse('Failed to initiate multipart upload', 500)
    }

    // Generate presigned URLs for each part
    const partUrls: { partNumber: number; url: string }[] = []

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const uploadPartCommand = new UploadPartCommand({
        Bucket: bucketName,
        Key: storagePath,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
        expiresIn: 3600, // 1 hour
      })

      partUrls.push({ partNumber, url: presignedUrl })
    }

    return successResponse({
      uploadId,
      storagePath,
      contentType,
      partUrls,
    })
  } catch (error) {
    console.error('Multipart upload initiation error:', error)
    return errorResponse('Failed to initiate multipart upload', 500)
  }
}

// PUT: Complete multipart upload
export async function PUT(request: NextRequest) {
  try {
    const err = checkSupabase()
    if (err) return err

    const s3Client = getS3Client()
    if (!s3Client) {
      return errorResponse('Direct storage not configured', 400)
    }

    const body = await request.json()
    const { type, id, uploadId, storagePath, filename, size, parts } = body as {
      type: UploadType
      id: string
      uploadId: string
      storagePath: string
      filename: string
      size: number
      parts: { partNumber: number; etag: string }[]
    }

    if (!uploadId || !storagePath || !parts || !parts.length) {
      return errorResponse('Missing required fields', 400)
    }

    const bucketName = process.env.ZADARA_BUCKET_NAME ?? 'family-memories'

    // Complete the multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: storagePath,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    })

    await s3Client.send(completeCommand)

    // Record in media_items table
    await supabase.from('media_items').insert({
      storage_path: storagePath,
      content_type: getContentType(filename || storagePath),
      size_bytes: size || 0,
      original_filename: filename,
    })

    // Update the associated record
    if (type === 'video') {
      await supabase
        .from('clips')
        .update({ video_path: storagePath, updated_at: new Date().toISOString() })
        .eq('id', id)
    } else if (type === 'intro-video') {
      await supabase
        .from('intro_clips')
        .update({ video_path: storagePath, updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    return successResponse({
      path: storagePath,
      url: `/api/media/files/${storagePath}`,
    })
  } catch (error) {
    console.error('Multipart upload completion error:', error)
    return errorResponse('Failed to complete multipart upload', 500)
  }
}

// DELETE: Abort multipart upload
export async function DELETE(request: NextRequest) {
  try {
    const s3Client = getS3Client()
    if (!s3Client) {
      return errorResponse('Direct storage not configured', 400)
    }

    const body = await request.json()
    const { uploadId, storagePath } = body as {
      uploadId: string
      storagePath: string
    }

    if (!uploadId || !storagePath) {
      return errorResponse('Missing required fields', 400)
    }

    const bucketName = process.env.ZADARA_BUCKET_NAME ?? 'family-memories'

    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: storagePath,
      UploadId: uploadId,
    })

    await s3Client.send(abortCommand)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Multipart upload abort error:', error)
    return errorResponse('Failed to abort multipart upload', 500)
  }
}
