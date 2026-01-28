'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrollControlsProps {
  onScrollLeft: () => void
  onScrollRight: () => void
  canScrollLeft: boolean
  canScrollRight: boolean
}

export function ScrollControls({
  onScrollLeft,
  onScrollRight,
  canScrollLeft,
  canScrollRight,
}: ScrollControlsProps) {
  return (
    <>
      {canScrollLeft && (
        <button
          onClick={onScrollLeft}
          className={cn(
            'absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center',
            'bg-gradient-to-r from-bg-primary/90 to-transparent',
            'opacity-0 transition-opacity group-hover:opacity-100 tv:opacity-100',
            'focus-ring'
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-8 w-8 text-white" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={onScrollRight}
          className={cn(
            'absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center',
            'bg-gradient-to-l from-bg-primary/90 to-transparent',
            'opacity-0 transition-opacity group-hover:opacity-100 tv:opacity-100',
            'focus-ring'
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-8 w-8 text-white" />
        </button>
      )}
    </>
  )
}
