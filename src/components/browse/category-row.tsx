'use client'

import { useRef, useState, useCallback } from 'react'
import { ClipCard } from './clip-card'
import { ScrollControls } from './scroll-controls'

interface BrowseClip {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  animated_thumbnail_url: string | null
  duration_seconds: number | null
}

interface CategoryRowProps {
  category: {
    id: string
    name: string
    clips: BrowseClip[]
  }
}

export function CategoryRow({ category }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  function scrollBy(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const scrollAmount = el.clientWidth - 100 // Overlap by one card peek
    el.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    })
    // Update state after scroll animation
    setTimeout(updateScrollState, 400)
  }

  return (
    <div className="group relative">
      <h2 className="mb-2 px-12 text-lg font-semibold text-white tv:text-2xl">
        {category.name}
      </h2>
      <div className="relative">
        <ScrollControls
          onScrollLeft={() => scrollBy('left')}
          onScrollRight={() => scrollBy('right')}
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
        />
        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth px-12"
          style={{ scrollSnapType: 'x mandatory' }}
          onScroll={updateScrollState}
        >
          {category.clips.map((clip) => (
            <div key={clip.id} style={{ scrollSnapAlign: 'start' }}>
              <ClipCard clip={clip} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
