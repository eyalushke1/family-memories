/**
 * Single source of truth for supported media formats.
 * Used by upload validation, media proxy, signed URLs, and player.
 */

export const VIDEO_CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
}

export const AUDIO_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
}

export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
}

export const ALL_CONTENT_TYPES: Record<string, string> = {
  ...IMAGE_CONTENT_TYPES,
  ...VIDEO_CONTENT_TYPES,
  ...AUDIO_CONTENT_TYPES,
}

/** Extensions that play reliably across all browsers (Chrome, Safari, Firefox, TV) */
export const UNIVERSAL_VIDEO_EXTENSIONS = ['.mp4', '.m4v']

/** Extensions with limited browser support */
export const LIMITED_SUPPORT_EXTENSIONS: Record<string, string> = {
  '.mkv': 'MKV files do not play in Safari or on smart TVs',
  '.avi': 'AVI files have limited browser support',
  '.mov': 'MOV files may not play on some Android browsers or smart TVs',
  '.webm': 'WebM may not play on older Safari versions',
}

export const VIDEO_EXTENSIONS = Object.keys(VIDEO_CONTENT_TYPES).map(ext => ext.slice(1))
export const ALLOWED_VIDEO_MIME_TYPES = [...Object.values(VIDEO_CONTENT_TYPES), 'video/avi']

export function getContentType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return ALL_CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export function isStreamingType(contentType: string): boolean {
  return contentType.startsWith('video/') || contentType.startsWith('audio/')
}

export function getFormatWarning(filename: string): string | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return LIMITED_SUPPORT_EXTENSIONS[ext] ?? null
}

/** Extensions that ALWAYS require server-side transcoding (never play in browsers) */
export const TRANSCODE_EXTENSIONS = ['.avi', '.mkv', '.mpg', '.mpeg', '.wmv', '.flv']

/** Returns true if the format is known to never work in browsers */
export function needsTranscoding(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return TRANSCODE_EXTENSIONS.includes(ext)
}

/** Returns true if the file is a video that CAN be transcoded (any video format) */
export function canTranscode(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return ext in VIDEO_CONTENT_TYPES
}

export function getTranscodedPath(originalPath: string): string {
  // videos/abc-123/movie.avi → transcoded/videos/abc-123/movie.mp4
  const lastDot = originalPath.lastIndexOf('.')
  const withoutExt = lastDot > -1 ? originalPath.substring(0, lastDot) : originalPath
  return `transcoded/${withoutExt}.mp4`
}
