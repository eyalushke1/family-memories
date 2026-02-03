import { NextRequest } from 'next/server'
import { getStorage } from '@/lib/storage'
import { checkAdmin } from '@/lib/api/admin-check'
import { successResponse } from '@/lib/api/response'

interface MusicMetadata {
  originalFilename?: string
  displayName?: string
  artist?: string
  album?: string
  durationSeconds?: number
  durationFormatted?: string
  year?: number
  genre?: string
  size?: number
  contentType?: string
  uploadedAt?: string
}

/**
 * GET /api/admin/uploaded-music
 * List all previously uploaded music files from the temp storage with metadata
 */
export async function GET(request: NextRequest) {
  const adminErr = checkAdmin(request)
  if (adminErr) return adminErr

  try {
    const storage = getStorage()

    // List files in the temp music folder
    const files = await storage.list('presentations/temp/music/')

    // Filter to only audio files
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']
    const audioFiles = files.filter((file) => {
      const ext = file.path.toLowerCase().slice(file.path.lastIndexOf('.'))
      return audioExtensions.includes(ext)
    })

    // Load metadata for each audio file
    const musicFilesWithMetadata = await Promise.all(
      audioFiles.map(async (file) => {
        const filename = file.path.split('/').pop() || file.path
        const extension = filename.slice(filename.lastIndexOf('.'))
        const metadataPath = file.path.replace(extension, '.json')

        let metadata: MusicMetadata = {}

        try {
          // Try to read the metadata sidecar file
          const metadataBuffer = await storage.download(metadataPath)
          metadata = JSON.parse(metadataBuffer.toString('utf-8'))
        } catch {
          // No metadata file exists (older uploads) - extract name from filename
          // Filename format: {uuid}_{original_name}.{ext} or just {uuid}.{ext}
          const nameWithoutExt = filename.replace(extension, '')
          const underscoreIdx = nameWithoutExt.indexOf('_')
          const displayName = underscoreIdx > 0
            ? nameWithoutExt.slice(underscoreIdx + 1).replace(/_/g, ' ')
            : nameWithoutExt

          metadata = {
            displayName,
            uploadedAt: file.lastModified?.toISOString(),
          }
        }

        return {
          path: file.path,
          filename: metadata.originalFilename || filename,
          displayName: metadata.displayName || filename,
          artist: metadata.artist || null,
          album: metadata.album || null,
          durationSeconds: metadata.durationSeconds || null,
          durationFormatted: metadata.durationFormatted || null,
          year: metadata.year || null,
          genre: metadata.genre || null,
          size: metadata.size || file.size,
          uploadedAt: metadata.uploadedAt || file.lastModified?.toISOString() || null,
        }
      })
    )

    // Sort by upload date, newest first
    musicFilesWithMetadata.sort((a, b) => {
      if (!a.uploadedAt || !b.uploadedAt) return 0
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    })

    return successResponse(musicFilesWithMetadata)
  } catch (err) {
    console.error('Failed to list uploaded music:', err)
    // Return empty array on error since this is non-critical
    return successResponse([])
  }
}
