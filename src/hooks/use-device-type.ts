'use client'

import { useState, useEffect } from 'react'

export type DeviceType = 'tv' | 'desktop' | 'mobile'

/**
 * Detects the device type based on user agent and screen characteristics
 * Supports detection of Smart TV browsers:
 * - LG webOS
 * - Samsung Tizen
 * - Sony/Philips/Hisense Android TV
 * - VIDAA (Hisense)
 * - Generic Smart TV indicators
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop')

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()

    // Detect TV browsers by user agent
    const isTv =
      ua.includes('smart-tv') ||
      ua.includes('smarttv') ||
      ua.includes('webos') ||           // LG webOS
      ua.includes('tizen') ||           // Samsung Tizen
      ua.includes('vidaa') ||           // Hisense VIDAA
      ua.includes('android tv') ||      // Android TV (Sony, Philips, some Hisense)
      ua.includes('googletv') ||        // Google TV
      ua.includes('crkey') ||           // Chromecast
      ua.includes('roku') ||            // Roku
      ua.includes('firetv') ||          // Amazon Fire TV
      ua.includes('appletv') ||         // Apple TV
      ua.includes('netcast') ||         // LG NetCast (older)
      ua.includes('viera') ||           // Panasonic Viera
      ua.includes('bravia') ||          // Sony Bravia
      ua.includes('philipstv') ||       // Philips TV
      (ua.includes('web0s') && ua.includes('linux'))  // webOS variant

    if (isTv) {
      setDeviceType('tv')
      return
    }

    // Check for mobile devices
    const isMobile =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) ||
      ('ontouchstart' in window && window.innerWidth < 1024)

    if (isMobile) {
      setDeviceType('mobile')
      return
    }

    // Default to desktop
    setDeviceType('desktop')
  }, [])

  return deviceType
}

/**
 * Check if the current device is a TV
 */
export function useIsTV(): boolean {
  const deviceType = useDeviceType()
  return deviceType === 'tv'
}

/**
 * Check if the current device is mobile
 */
export function useIsMobile(): boolean {
  const deviceType = useDeviceType()
  return deviceType === 'mobile'
}

/**
 * Get detailed TV platform info if on a TV
 */
export type TVPlatform = 'webos' | 'tizen' | 'androidtv' | 'vidaa' | 'roku' | 'firetv' | 'unknown'

export function useTVPlatform(): TVPlatform | null {
  const [platform, setPlatform] = useState<TVPlatform | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()

    if (ua.includes('webos') || ua.includes('web0s') || ua.includes('netcast')) {
      setPlatform('webos')
    } else if (ua.includes('tizen')) {
      setPlatform('tizen')
    } else if (ua.includes('android tv') || ua.includes('googletv') || ua.includes('bravia') || ua.includes('philipstv')) {
      setPlatform('androidtv')
    } else if (ua.includes('vidaa')) {
      setPlatform('vidaa')
    } else if (ua.includes('roku')) {
      setPlatform('roku')
    } else if (ua.includes('firetv')) {
      setPlatform('firetv')
    } else if (
      ua.includes('smart-tv') ||
      ua.includes('smarttv') ||
      ua.includes('crkey') ||
      ua.includes('appletv')
    ) {
      setPlatform('unknown')
    } else {
      setPlatform(null)
    }
  }, [])

  return platform
}
