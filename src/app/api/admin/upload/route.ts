import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getStorage } from '@/lib/storage'
import { MediaPaths } from '@/lib/storage/media-paths'
import { rateLimit, getRateLimitKey } from '@/lib/api/rate-limit'

type UploadType = 'avatar' | 'video' | 'thumbnail' | 'animated-thumbnail' | 'intro-video' | 'intro-thumbnail'

// Magic byte signatures for file type validation
const MAGIC_BYTES: { pattern: number[]; offset?: number; type: 'image' | 'video' }[] = [
  // JPEG
  { pattern: [0xFF, 0xD8, 0xFF], type: 'image' },
  // PNG
  { pattern: [0x89, 0x50, 0x4E, 0x47], type: 'image' },
  // GIF87a / GIF89a
  { pattern: [0x47, 0x49, 0x46, 0x38], type: 'image' },
  // WebP (RIFF....WEBP)
  { pattern: [0x52, 0x49, 0x46, 0x46], type: 'image' },
  // MP4 (ftyp box)
  { pattern: [0x66, 0x74, 0x79, 0x70], offset: 4, type: 'video' },
  // WebM/MKV (EBML)
  { pattern: [0x1A, 0x45, 0xDF, 0xA3], type: 'video' },
  // MOV (ftyp qt)
  { pattern: [0x00, 0x00, 0x00], type: 'video' },
]

function validateMagicBytes(buffer: Buffer, expectedType: 'image' | 'video'): boolean {
  if (buffer.length < 12) return false

  for (const sig of MAGIC_BYTES) {
    if (sig.type !== expectedType) continue
    const offset = sig.offset ?? 0
    const matches = sig.pattern.every((byte, i) => buffer[offset + i] === byte)
    if (matches) return true
  }
  return false
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 uploads per minute per IP
  const rlErr = rateLimit(getRateLimitKey(request, 'upload'), { maxRequests: 30 })
  if (rlErr) return rlErr

  const err = checkSupabase()
  if (err) return err

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as UploadType | null
  const id = formData.get('id') as string | null

  if (!file) {
    return errorResponse('File is required', 400)
  }

  // Enforce file size limits: 10MB for images, 500MB for videos
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024  // 500MB

  if (!type) {
    return errorResponse('Type is required (avatar, video, thumbnail, animated-thumbnail)', 400)
  }

  if (!id) {
    return errorResponse('ID is required (profile id for avatar, clip id for others)', 400)
  }

  // Validate file type
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']

  if (type === 'avatar' || type === 'thumbnail' || type === 'animated-thumbnail' || type === 'intro-thumbnail') {
    if (!allowedImageTypes.includes(file.type)) {
      return errorResponse('Invalid image type. Allowed: jpg, png, gif, webp', 400)
    }
  }

  if (type === 'video' || type === 'intro-video') {
    if (!allowedVideoTypes.includes(file.type)) {
      return errorResponse('Invalid video type. Allowed: mp4, webm, mov', 400)
    }
  }

  // Check file size limits
  const isVideoUpload = type === 'video' || type === 'intro-video'
  const maxSize = isVideoUpload ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    return errorResponse(`File too large. Maximum size: ${maxMB}MB`, 400)
  }

  // Generate storage path
  let storagePath: string
  const filename = file.name

  switch (type) {
    case 'avatar':
      storagePath = MediaPaths.avatars(id, filename)
      break
    case 'thumbnail':
      storagePath = MediaPaths.thumbnails(id)
      break
    case 'animated-thumbnail':
      storagePath = MediaPaths.animatedThumbnails(id)
      break
    case 'video':
      storagePath = MediaPaths.videos(id, filename)
      break
    case 'intro-video':
      storagePath = MediaPaths.introVideos(id, filename)
      break
    case 'intro-thumbnail':
      storagePath = MediaPaths.introThumbnails(id)
      break
    default:
      return errorResponse('Invalid upload type', 400)
  }

  // Read file data
  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate file content by checking magic bytes
  if (!validateMagicBytes(buffer, isVideoUpload ? 'video' : 'image')) {
    return errorResponse('File content does not match expected type', 400)
  }

  const contentType = getContentType(filename)

  // Upload to storage
  const storage = getStorage()
  await storage.upload(storagePath, buffer, { contentType })

  // Record in media_items table
  await supabase.from('media_items').insert({
    storage_path: storagePath,
    content_type: contentType,
    size_bytes: buffer.length,
    original_filename: filename,
  })

  // Update the associated record with the new path
  if (type === 'avatar') {
    await supabase
      .from('profiles')
      .update({ avatar_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  } else if (type === 'thumbnail') {
    await supabase
      .from('clips')
      .update({ thumbnail_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  } else if (type === 'animated-thumbnail') {
    await supabase
      .from('clips')
      .update({ animated_thumbnail_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  } else if (type === 'video') {
    await supabase
      .from('clips')
      .update({ video_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  } else if (type === 'intro-video') {
    await supabase
      .from('intro_clips')
      .update({ video_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  } else if (type === 'intro-thumbnail') {
    await supabase
      .from('intro_clips')
      .update({ thumbnail_path: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return successResponse({
    path: storagePath,
    url: `/api/media/files/${storagePath}`,
    size: buffer.length,
    contentType,
  }, 201)
}
