/**
 * Utilities for building media URLs for casting
 * Cast devices require absolute, publicly-accessible URLs with CORS support
 */

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

/**
 * Build a CORS-enabled media URL for casting
 * Converts relative paths to absolute URLs using the /api/cast/media endpoint
 */
export function buildCastMediaUrl(path: string): string {
  const baseUrl = getBaseUrl()

  // If already an absolute URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Remove leading /api/media/files/ if present (convert to raw path)
  const cleanPath = path.replace(/^\/api\/media\/files\//, '')

  return `${baseUrl}/api/cast/media/${cleanPath}`
}

/**
 * Build manifest data for casting a slideshow presentation
 */
export interface CastSlide {
  url: string
  duration: number
  type: 'image' | 'video'
  caption?: string
}

export interface CastPresentationManifest {
  id: string
  title: string
  slides: CastSlide[]
  transitionType: string
  transitionDurationMs: number
  backgroundMusicUrl?: string | null
}

export function buildCastPresentationManifest(
  presentation: {
    id: string
    slideDurationMs: number
    transitionType: string
    transitionDurationMs: number
    backgroundMusicUrl?: string | null
    slides: Array<{
      id: string
      mediaUrl: string
      mediaType?: 'image' | 'video'
      caption?: string
      durationMs?: number
    }>
  },
  title: string = 'Family Slideshow'
): CastPresentationManifest {
  return {
    id: presentation.id,
    title,
    slides: presentation.slides.map(slide => ({
      url: buildCastMediaUrl(slide.mediaUrl),
      duration: slide.durationMs || presentation.slideDurationMs,
      type: slide.mediaType || 'image',
      caption: slide.caption,
    })),
    transitionType: presentation.transitionType,
    transitionDurationMs: presentation.transitionDurationMs,
    backgroundMusicUrl: presentation.backgroundMusicUrl
      ? buildCastMediaUrl(presentation.backgroundMusicUrl)
      : null,
  }
}
