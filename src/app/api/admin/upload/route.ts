import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getStorage } from '@/lib/storage'
import { MediaPaths } from '@/lib/storage/media-paths'

type UploadType = 'avatar' | 'video' | 'thumbnail' | 'animated-thumbnail' | 'intro-video' | 'intro-thumbnail'

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
