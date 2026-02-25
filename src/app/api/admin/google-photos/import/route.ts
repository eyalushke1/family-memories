import { NextRequest } from 'next/server'
import { getValidAccessToken } from '@/lib/google/oauth'
import { getStorage, MediaPaths } from '@/lib/storage'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse } from '@/lib/api/response'
import { v4 as uuidv4 } from 'uuid'

interface PickerMediaItem {
  id: string
  filename: string
  mimeType: string
  baseUrl: string
  thumbnailUrl: string
  downloadUrl: string
  createTime: string
  width: string
  height: string
  isVideo: boolean
}

interface ImportRequest {
  mediaItems: PickerMediaItem[]
  createPresentation?: boolean
  presentationTitle?: string
  categoryId?: string
  slideDurationMs?: number
  transitionType?: string
  backgroundMusicPath?: string | null
  backgroundMusicPaths?: string[]
  musicFadeOutMs?: number
  muteVideoAudio?: boolean
}

// Download with retry settings
const DOWNLOAD_CONFIG = {
  retries: 2,
  retryDelay: 1000,
  timeoutMs: 30000, // 30s per file download
  concurrency: 5,   // Parallel downloads
}

// Run async tasks with concurrency limit
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function POST(request: NextRequest) {
  // Get profile ID from cookie
  const profileId = request.cookies.get('fm-profile-id')?.value

  if (!profileId) {
    return errorResponse('Profile not selected', 401)
  }

  const body: ImportRequest = await request.json()
  const { mediaItems, createPresentation, presentationTitle, categoryId, slideDurationMs, transitionType, backgroundMusicPath, backgroundMusicPaths, musicFadeOutMs, muteVideoAudio } = body

  if (!mediaItems || mediaItems.length === 0) {
    return errorResponse('No media items selected', 400)
  }

  try {
    // Get OAuth token for authenticated downloads (Picker API requires auth)
    const accessToken = await getValidAccessToken(profileId)
    if (!accessToken) {
      return errorResponse('Google Photos not connected', 401)
    }

    const storage = getStorage()
    const importedItems: { googleMediaId: string; storagePath: string; filename: string }[] = []
    const failedItems: { googleMediaId: string; error: string }[] = []

    // Download and upload items in parallel with concurrency limit
    console.log(`[Import] Starting parallel download of ${mediaItems.length} items (concurrency: ${DOWNLOAD_CONFIG.concurrency})`)

    type DownloadResult = { type: 'success'; googleMediaId: string; storagePath: string; filename: string } | { type: 'failed'; googleMediaId: string; error: string }

    const results = await parallelLimit<PickerMediaItem, DownloadResult>(
      mediaItems,
      DOWNLOAD_CONFIG.concurrency,
      async (item) => {
        // Check if already imported
        const { data: existing } = await supabase
          .from('google_photos_imports')
          .select('storage_path')
          .eq('google_media_id', item.id)
          .single()

        if (existing) {
          return { type: 'success', googleMediaId: item.id, storagePath: existing.storage_path, filename: item.filename }
        }

        // Build download URL with appropriate suffix
        const downloadUrl = item.isVideo
          ? `${item.baseUrl}=dv`
          : `${item.baseUrl}=d`

        // Download with retry
        let lastError = ''

        for (let attempt = 0; attempt < DOWNLOAD_CONFIG.retries; attempt++) {
          try {
            const controller = new AbortController()
            const downloadTimeout = setTimeout(() => controller.abort(), DOWNLOAD_CONFIG.timeoutMs)
            const response = await fetch(downloadUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: controller.signal,
            })
            clearTimeout(downloadTimeout)

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const buffer = Buffer.from(await response.arrayBuffer())

            // Generate storage path
            const creationDate = new Date(item.createTime)
            const year = creationDate.getFullYear().toString()
            const month = (creationDate.getMonth() + 1).toString().padStart(2, '0')
            const uniqueFilename = `${uuidv4()}-${item.filename}`
            const storagePath = MediaPaths.googlePhotosImport(year, month, uniqueFilename)

            // Upload to storage
            await storage.upload(storagePath, buffer, { contentType: item.mimeType })

            // Record import in database
            await supabase.from('google_photos_imports').insert({
              google_media_id: item.id,
              storage_path: storagePath,
              original_filename: item.filename,
              media_type: item.isVideo ? 'video' : 'image',
              imported_by: profileId,
            })

            console.log(`[Import] Downloaded: ${item.filename}`)
            return { type: 'success', googleMediaId: item.id, storagePath, filename: item.filename }
          } catch (err) {
            lastError = err instanceof Error ? err.message : 'Unknown error'
            console.error(`[Import] Attempt ${attempt + 1} failed for ${item.filename}: ${lastError}`)

            if (attempt < DOWNLOAD_CONFIG.retries - 1) {
              await new Promise(resolve => setTimeout(resolve, DOWNLOAD_CONFIG.retryDelay * Math.pow(2, attempt)))
            }
          }
        }

        return { type: 'failed', googleMediaId: item.id, error: lastError }
      }
    )

    // Separate results
    for (const result of results) {
      if (result.type === 'success') {
        importedItems.push({ googleMediaId: result.googleMediaId, storagePath: result.storagePath, filename: result.filename })
      } else {
        failedItems.push({ googleMediaId: result.googleMediaId, error: result.error })
      }
    }

    console.log(`[Import] Complete: ${importedItems.length} succeeded, ${failedItems.length} failed`)

    // If creating a presentation, create the clip and presentation records
    let clipId: string | undefined
    let presentationId: string | undefined

    if (createPresentation && importedItems.length > 0) {
      if (!categoryId) {
        return errorResponse('Category ID is required to create a presentation', 400)
      }

      // Create clip record
      const { data: clip, error: clipError } = await supabase
        .from('clips')
        .insert({
          title: presentationTitle || 'Photo Slideshow',
          category_id: categoryId,
          video_path: 'presentation', // Special marker for presentation clips
          is_active: true,
        })
        .select('id')
        .single()

      if (clipError) {
        console.error('Failed to create clip:', clipError)
        return errorResponse('Failed to create presentation clip')
      }

      clipId = clip.id

      // Create presentation record
      const musicPaths = backgroundMusicPaths && backgroundMusicPaths.length > 0
        ? backgroundMusicPaths
        : backgroundMusicPath ? [backgroundMusicPath] : []

      const { data: presentation, error: presentationError } = await supabase
        .from('presentations')
        .insert({
          clip_id: clipId,
          slide_duration_ms: slideDurationMs || 5000,
          transition_type: transitionType || 'fade',
          background_music_path: musicPaths[0] || null,
          background_music_paths: musicPaths,
          music_fade_out_ms: musicFadeOutMs || 3000,
          mute_video_audio: muteVideoAudio ?? true,
        })
        .select('id')
        .single()

      if (presentationError) {
        console.error('Failed to create presentation:', presentationError)
        return errorResponse('Failed to create presentation')
      }

      presentationId = presentation.id

      // Create slides (images and videos)
      const slides = importedItems.map((item, index) => {
        const isVideo = item.filename.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/)
        return {
          presentation_id: presentationId!,
          image_path: item.storagePath,
          media_type: isVideo ? 'video' : 'image',
          sort_order: index,
          google_photos_id: item.googleMediaId,
        }
      })

      if (slides.length > 0) {
        const { error: slidesError } = await supabase
          .from('presentation_slides')
          .insert(slides)

        if (slidesError) {
          console.error('Failed to create slides:', slidesError)
          return errorResponse('Failed to create presentation slides')
        }
      }

      // Update clip thumbnail from first image
      if (importedItems.length > 0) {
        await supabase
          .from('clips')
          .update({ thumbnail_path: importedItems[0].storagePath })
          .eq('id', clipId)
      }
    }

    // Return partial success result
    const success = failedItems.length === 0

    return successResponse({
      success,
      totalItems: mediaItems.length,
      completedItems: importedItems.length,
      failedItems: failedItems.length,
      imported: importedItems,
      failed: failedItems,
      clipId,
      presentationId,
    }, success ? 200 : 207) // HTTP 207 for partial success
  } catch (err) {
    console.error('Failed to import media:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Failed to import media: ${message}`)
  }
}
