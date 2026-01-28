'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MediaImageProps {
  src: string | null
  alt: string
  className?: string
  fallbackClassName?: string
}

export function MediaImage({ src, alt, className, fallbackClassName }: MediaImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-bg-card text-text-muted',
          fallbackClassName ?? className
        )}
        aria-label={alt}
      >
        <span className="text-sm">{alt.charAt(0).toUpperCase()}</span>
      </div>
    )
  }

  return (
    <>
      {!loaded && (
        <div
          className={cn('animate-pulse bg-bg-card', className)}
          aria-hidden
        />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, !loaded && 'hidden')}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  )
}
