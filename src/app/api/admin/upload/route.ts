import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getStorage } from '@/lib/storage'
import { MediaPaths } from '@/lib/storage/media-paths'

// Route segment config for large file uploads
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large uploads

type UploadType = 'avatar' | 'video' | 'thumbnail' | 'animated-thumbnail' | 'intro-video' | 'intro-thumbnail'

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

export async function POST(request: NextRequest) {
  const err = checkSupabase()
  if (err) return err

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as UploadType | null
  const id = formData.get('id') as string | null

  if (!file) {
    return errorResponse('File is required', 400)
  }

  if (!type) {
    return errorResponse('Type is required (avatar, video, thumbnail, animated-thumbnail)', 400)
  }

  if (!id) {
    return errorResponse('ID is required (profile id for avatar, clip id for others)', 400)
  }

  // Validate file type
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/x-m4v', 'video/avi']

  // Also check by file extension for cases where MIME type detection fails
  const ext = file.name.split('.').pop()?.toLowerCase()
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']

  if (type === 'avatar' || type === 'thumbnail' || type === 'animated-thumbnail' || type === 'intro-thumbnail') {
    const isValidImage = allowedImageTypes.includes(file.type) || imageExtensions.includes(ext || '')
    if (!isValidImage) {
      return errorResponse('Invalid image type. Allowed: jpg, png, gif, webp, heic', 400)
    }
  }

  if (type === 'video' || type === 'intro-video') {
    const isValidVideo = allowedVideoTypes.includes(file.type) || videoExtensions.includes(ext || '')
    if (!isValidVideo) {
      return errorResponse('Invalid video type. Allowed: mp4, webm, mov, avi, mkv, m4v', 400)
    }
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
