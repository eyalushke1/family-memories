import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { parseBuffer } from 'music-metadata'
import { getStorage, MediaPaths } from '@/lib/storage'
import { checkAdmin } from '@/lib/api/admin-check'
import { successResponse, errorResponse } from '@/lib/api/response'

// Sanitize filename for storage (remove special characters but keep readability)
function sanitizeFilename(name: string): string {
  // Remove path separators and dangerous characters
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
}

// Format duration from seconds to mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * POST /api/admin/google-photos/upload-music
 * Upload a music file for use in a presentation
 */
export async function POST(request: NextRequest) {
  const adminErr = await checkAdmin(request)
  if (adminErr) return adminErr

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('No file provided', 400)
    }

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      return errorResponse('Invalid file type. Only audio files are allowed.', 400)
    }

    // Validate file size (max 200MB for longer audio tracks)
    const maxSize = 200 * 1024 * 1024
    if (file.size > maxSize) {
      return errorResponse('File too large. Maximum size is 200MB.', 400)
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract audio metadata
    let metadata: {
      title?: string
      artist?: string
      album?: string
      durationSeconds?: number
      durationFormatted?: string
      year?: number
      genre?: string
    } = {}

    try {
      const parsed = await parseBuffer(new Uint8Array(buffer), { mimeType: file.type })
      metadata = {
        title: parsed.common.title || undefined,
        artist: parsed.common.artist || parsed.common.artists?.join(', ') || undefined,
        album: parsed.common.album || undefined,
        durationSeconds: parsed.format.duration ? Math.round(parsed.format.duration) : undefined,
        durationFormatted: parsed.format.duration ? formatDuration(parsed.format.duration) : undefined,
        year: parsed.common.year || undefined,
        genre: parsed.common.genre?.join(', ') || undefined,
      }
    } catch (metadataErr) {
      console.warn('Could not extract audio metadata:', metadataErr)
      // Continue without metadata - it's not critical
    }

    // Generate filename preserving original name with unique prefix
    const originalName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    const extension = file.name.split('.').pop() || 'mp3'
    const uniqueId = uuidv4().slice(0, 8) // Short unique ID
    const sanitizedName = sanitizeFilename(originalName)
    const filename = `${uniqueId}_${sanitizedName}.${extension}`

    // Generate storage path using a temporary presentation ID
    const storagePath = MediaPaths.presentationMusic('temp', filename)

    // Upload audio file to storage
    const storage = getStorage()
    await storage.upload(storagePath, buffer, {
      contentType: file.type,
    })

    // Also save metadata as a sidecar JSON file
    const metadataPath = storagePath.replace(`.${extension}`, '.json')
    const metadataContent = JSON.stringify({
      originalFilename: file.name,
      displayName: metadata.title || originalName,
      artist: metadata.artist,
      album: metadata.album,
      durationSeconds: metadata.durationSeconds,
      durationFormatted: metadata.durationFormatted,
      year: metadata.year,
      genre: metadata.genre,
      size: file.size,
      contentType: file.type,
      uploadedAt: new Date().toISOString(),
    }, null, 2)

    await storage.upload(metadataPath, Buffer.from(metadataContent), {
      contentType: 'application/json',
    })

    return successResponse({
      path: storagePath,
      filename: file.name,
      displayName: metadata.title || originalName,
      artist: metadata.artist,
      album: metadata.album,
      durationSeconds: metadata.durationSeconds,
      durationFormatted: metadata.durationFormatted,
      year: metadata.year,
      genre: metadata.genre,
      size: file.size,
      contentType: file.type,
    })
  } catch (err) {
    console.error('Failed to upload music:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to upload music: ${message}`)
  }
}
