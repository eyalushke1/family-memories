'use client'

import { useState, useEffect, useCallback, RefObject } from 'react'

export type CastState = 'disconnected' | 'connecting' | 'connected'

interface RemotePlaybackResult {
  /** Current connection state */
  state: CastState
  /** Whether casting is available (devices found) */
  isAvailable: boolean
  /** Whether the Remote Playback API is supported */
  isSupported: boolean
  /** Open the device picker and start casting */
  promptCast: () => Promise<void>
  /** Disconnect from the cast device */
  disconnect: () => void
  /** Error message if casting failed */
  error: string | null
}

/**
 * Hook for using the Remote Playback API to cast media to external devices
 * Supports Chromecast, AirPlay (Safari), and DLNA devices
 *
 * @param videoRef - Reference to the video element to cast
 */
export function useRemotePlayback(
  videoRef: RefObject<HTMLVideoElement | null>
): RemotePlaybackResult {
  const [state, setState] = useState<CastState>('disconnected')
  const [isAvailable, setIsAvailable] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Check if Remote Playback API is supported
    if (!('remote' in video)) {
      setIsSupported(false)
      return
    }

    setIsSupported(true)
    const remote = video.remote

    // Watch for device availability
    const watchAvailability = async () => {
      try {
        await remote.watchAvailability((available: boolean) => {
          setIsAvailable(available)
        })
      } catch {
        // If watchAvailability fails, assume devices might be available
        // The prompt() call will show if none exist
        setIsAvailable(true)
      }
    }

    // Set up event listeners for connection state
    const handleConnecting = () => {
      setState('connecting')
      setError(null)
    }

    const handleConnect = () => {
      setState('connected')
      setError(null)
    }

    const handleDisconnect = () => {
      setState('disconnected')
    }

    remote.addEventListener('connecting', handleConnecting)
    remote.addEventListener('connect', handleConnect)
    remote.addEventListener('disconnect', handleDisconnect)

    // Check initial state
    if (remote.state) {
      setState(remote.state as CastState)
    }

    watchAvailability()

    return () => {
      remote.removeEventListener('connecting', handleConnecting)
      remote.removeEventListener('connect', handleConnect)
      remote.removeEventListener('disconnect', handleDisconnect)

      // Cancel availability watching
      try {
        remote.cancelWatchAvailability()
      } catch {
        // Ignore errors when canceling
      }
    }
  }, [videoRef])

  const promptCast = useCallback(async () => {
    const video = videoRef.current
    if (!video || !('remote' in video)) {
      setError('Remote playback not supported')
      return
    }

    try {
      setError(null)
      await video.remote.prompt()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start casting'

      // Handle common errors with user-friendly messages
      if (message.includes('NotFoundError')) {
        setError('No casting devices found')
      } else if (message.includes('NotAllowedError') || message.includes('cancelled')) {
        // User cancelled, not an error
        setError(null)
      } else if (message.includes('InvalidStateError')) {
        setError('Cannot cast: video not ready')
      } else {
        setError(message)
      }
    }
  }, [videoRef])

  const disconnect = useCallback(() => {
    const video = videoRef.current
    if (!video || !('remote' in video)) return

    // The Remote Playback API doesn't have a direct disconnect method
    // The connection ends when the video is paused or ends
    // Users typically disconnect from the cast device UI
    setState('disconnected')
  }, [videoRef])

  return {
    state,
    isAvailable,
    isSupported,
    promptCast,
    disconnect,
    error,
  }
}

// Type augmentation for RemotePlayback API
// Using 'any' return type to match existing DOM lib declarations
declare global {
  interface HTMLVideoElement {
    remote: RemotePlayback
  }

  interface RemotePlayback extends EventTarget {
    readonly state: 'disconnected' | 'connecting' | 'connected'
    watchAvailability(callback: (available: boolean) => void): Promise<number>
    cancelWatchAvailability(id?: number): void
    prompt(): Promise<void>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onconnecting: ((this: RemotePlayback, ev: Event) => any) | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onconnect: ((this: RemotePlayback, ev: Event) => any) | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ondisconnect: ((this: RemotePlayback, ev: Event) => any) | null
  }
}
