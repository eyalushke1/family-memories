'use client'

import { RefObject, useState } from 'react'
import { Cast, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useRemotePlayback, CastState } from '@/hooks/use-remote-playback'
import { cn } from '@/lib/utils'

interface CastButtonProps {
  /** Reference to the video element to cast */
  videoRef: RefObject<HTMLVideoElement | null>
  /** Additional CSS classes */
  className?: string
  /** Size of the button icon */
  size?: number
  /** Show text label */
  showLabel?: boolean
}

/**
 * Cast button component that uses the Remote Playback API
 * Shows different states: available, connecting, connected, error
 */
export function CastButton({
  videoRef,
  className,
  size = 24,
  showLabel = false,
}: CastButtonProps) {
  const { state, isAvailable, isSupported, promptCast, error } = useRemotePlayback(videoRef)
  const [showError, setShowError] = useState(false)

  // Don't render if not supported or no devices available
  if (!isSupported || !isAvailable) {
    return null
  }

  const handleClick = async () => {
    setShowError(false)
    await promptCast()
    if (error) {
      setShowError(true)
      setTimeout(() => setShowError(false), 3000)
    }
  }

  const getIcon = () => {
    if (showError && error) {
      return <XCircle size={size} className="text-red-500" />
    }

    switch (state) {
      case 'connecting':
        return <Loader2 size={size} className="animate-spin" />
      case 'connected':
        return <CheckCircle2 size={size} className="text-green-500" />
      default:
        return <Cast size={size} />
    }
  }

  const getLabel = (): string => {
    if (showError && error) return error
    switch (state) {
      case 'connecting':
        return 'Connecting...'
      case 'connected':
        return 'Connected'
      default:
        return 'Cast'
    }
  }

  const getTitle = (): string => {
    if (showError && error) return error
    switch (state) {
      case 'connecting':
        return 'Connecting to device...'
      case 'connected':
        return 'Connected to cast device'
      default:
        return 'Cast to TV'
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'connecting'}
      title={getTitle()}
      className={cn(
        'flex items-center gap-2 rounded-lg p-2 transition-all',
        'hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        state === 'connected' && 'bg-white/10',
        className
      )}
    >
      {getIcon()}
      {showLabel && (
        <span className="text-sm font-medium">{getLabel()}</span>
      )}
    </button>
  )
}

/**
 * Standalone cast icon for use in smaller spaces (like clip cards)
 */
export function CastIcon({
  state,
  size = 16,
  className,
}: {
  state: CastState
  size?: number
  className?: string
}) {
  const getIcon = () => {
    switch (state) {
      case 'connecting':
        return <Loader2 size={size} className="animate-spin" />
      case 'connected':
        return <CheckCircle2 size={size} className="text-green-500" />
      default:
        return <Cast size={size} />
    }
  }

  return (
    <span className={cn('inline-flex items-center', className)}>
      {getIcon()}
    </span>
  )
}
