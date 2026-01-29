/**
 * Extract a thumbnail from a video file using browser APIs
 * Captures a frame at a specified time and returns it as a Blob
 */

export interface ThumbnailOptions {
  /** Time in seconds to capture the frame (default: 1) */
  captureTime?: number
  /** Output width in pixels (default: 640) */
  width?: number
  /** Output quality 0-1 (default: 0.85) */
  quality?: number
  /** Output format (default: 'image/webp') */
  format?: 'image/webp' | 'image/jpeg' | 'image/png'
}

export async function extractThumbnailFromVideo(
  videoFile: File,
  options: ThumbnailOptions = {}
): Promise<Blob> {
  const {
    captureTime = 1,
    width = 640,
    quality = 0.85,
    format = 'image/webp',
  } = options

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }

    // Create object URL for the video file
    const videoUrl = URL.createObjectURL(videoFile)

    video.onloadedmetadata = () => {
      // Calculate the actual capture time (don't exceed video duration)
      const actualCaptureTime = Math.min(captureTime, video.duration * 0.1) || 0.1

      // Seek to the capture time
      video.currentTime = actualCaptureTime
    }

    video.onseeked = () => {
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight
      const height = Math.round(width / aspectRatio)

      canvas.width = width
      canvas.height = height

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          // Clean up
          URL.revokeObjectURL(videoUrl)
          video.remove()

          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create thumbnail blob'))
          }
        },
        format,
        quality
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      video.remove()
      reject(new Error('Failed to load video for thumbnail extraction'))
    }

    // Set video properties
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = videoUrl
  })
}

/**
 * Convert a Blob to a File object
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type })
}
