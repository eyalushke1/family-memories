import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkSupabase } from '@/lib/api/supabase-check'
import { successResponse, errorResponse } from '@/lib/api/response'
import { getStorage } from '@/lib/storage'
import { MediaPaths } from '@/lib/storage/media-paths'
import { getContentType } from '@/lib/media/formats'

type UploadType = 'video' | 'thumbnail' | 'animated-thumbnail' | 'intro-video' | 'intro-thumbnail' | 'avatar'

export async function POST(request: NextRequest) {
  try {
    const err = checkSupabase()
    if (err) return err

    const body = await request.json()
    const { type, id, filename, size } = body as {
      type: UploadType
      id: string
      filename: string
      size: number
    }

    if (!type || !id || !filename) {
      return errorResponse('Missing required fields: type, id, filename', 400)
    }

    // Check file size - limit to 2GB
    const maxSize = 2 * 1024 * 1024 * 1024
    if (size && size > maxSize) {
      return errorResponse('File too large. Maximum size is 2GB.', 413)
    }

    // Generate storage path
    let storagePath: string
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

    const contentType = getContentType(filename)
    const storage = getStorage()

    // Get presigned upload URL (valid for 1 hour)
    const uploadUrl = await storage.getUploadUrl(storagePath, contentType, 3600)

    if (!uploadUrl) {
      // Storage doesn't support presigned URLs (local storage)
      return errorResponse('Direct upload not supported. Use regular upload endpoint.', 400)
    }

    return successResponse({
      uploadUrl,
      storagePath,
      contentType,
    })
  } catch (error) {
    console.error('Get upload URL error:', error)
    return errorResponse('Failed to generate upload URL', 500)
  }
}

// Endpoint to confirm upload completion and update database
export async function PUT(request: NextRequest) {
  try {
    const err = checkSupabase()
    if (err) return err

    const body = await request.json()
    const { type, id, storagePath, filename, size } = body as {
      type: UploadType
      id: string
      storagePath: string
      filename: string
      size: number
    }

    if (!type || !id || !storagePath) {
      return errorResponse('Missing required fields', 400)
    }

    const contentType = getContentType(filename || storagePath)

    // Record in media_items table
    await supabase.from('media_items').insert({
      storage_path: storagePath,
      content_type: contentType,
      size_bytes: size || 0,
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
    })
  } catch (error) {
    console.error('Confirm upload error:', error)
    return errorResponse('Failed to confirm upload', 500)
  }
}
