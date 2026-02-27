export type DeviceType =
  | 'iphone'
  | 'ipad'
  | 'android'
  | 'mac'
  | 'windows-pc'
  | 'linux'
  | 'lg-tv'
  | 'samsung-tv'
  | 'tv'
  | 'web'
  | 'other'

/**
 * Detects the device type from the browser's User-Agent string.
 * Called client-side only.
 */
export function detectDevice(): DeviceType {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()

  // Smart TVs (check first — their UAs can also match other patterns)
  if (ua.includes('webos') || ua.includes('lgbrowser') || ua.includes('lg netcast')) return 'lg-tv'
  if (ua.includes('samsung') || ua.includes('tizen')) return 'samsung-tv'

  // Mobile
  if (ua.includes('iphone')) return 'iphone'
  if (ua.includes('ipad') || (ua.includes('macintosh') && 'ontouchend' in document)) return 'ipad'
  if (ua.includes('android')) return 'android'

  // Desktop
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'mac'
  if (ua.includes('windows')) return 'windows-pc'
  if (ua.includes('linux')) return 'linux'

  return 'other'
}

/** All valid device type strings accepted by the tracking API */
export const VALID_DEVICE_TYPES: ReadonlySet<string> = new Set<DeviceType>([
  'iphone', 'ipad', 'android', 'mac', 'windows-pc', 'linux',
  'lg-tv', 'samsung-tv', 'tv', 'web', 'other',
])
