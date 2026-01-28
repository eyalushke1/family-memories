'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ClipCardProps {
  clip: {
    id: string
    title: string
    description: string | null
    thumbnail_url: string | null
    animated_thumbnail_url: string | null
    duration_seconds: number | null
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ClipCard({ clip }: ClipCardProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true)
    }, 300) // 300ms delay to prevent flicker
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setIsHovered(false)
  }, [])

  function handleClick() {
    router.push(`/watch/${clip.id}`)
  }

  const thumbnailSrc = isHovered && clip.animated_thumbnail_url
    ? clip.animated_thumbnail_url
    : clip.thumbnail_url

  return (
    <motion.button
      className={cn(
        'relative flex-shrink-0 cursor-pointer overflow-hidden rounded-md focus-ring',
        'w-[200px] sm:w-[250px] md:w-[300px] tv:w-[400px]'
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      animate={{
        scale: isHovered ? 1.3 : 1,
        zIndex: isHovered ? 20 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-video w-full bg-bg-card">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={clip.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <span className="text-sm">{clip.title.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Duration badge */}
      {clip.duration_seconds && (
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {formatDuration(clip.duration_seconds)}
        </span>
      )}

      {/* Hover info overlay */}
      {isHovered && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-sm font-medium text-white">{clip.title}</p>
          {clip.description && (
            <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
              {clip.description}
            </p>
          )}
        </motion.div>
      )}

      {/* Non-hover title */}
      {!isHovered && (
        <div className="p-2">
          <p className="truncate text-sm text-text-secondary">{clip.title}</p>
        </div>
      )}
    </motion.button>
  )
}
