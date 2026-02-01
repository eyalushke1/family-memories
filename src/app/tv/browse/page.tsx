'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useProfileStore } from '@/stores/profile-store'
import { useTVFocusable } from '@/components/tv/tv-navigation-context'
import { Play, Clock, LogOut, User } from 'lucide-react'
import type { ApiResponse } from '@/types/api'

interface BrowseClip {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  animated_thumbnail_url: string | null
  duration_seconds: number | null
  sort_order: number
}

interface BrowseCategory {
  id: string
  name: string
  slug: string
  clips: BrowseClip[]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Header navigation buttons (row -1, above content)
function TVHeaderButton({
  id,
  onClick,
  children,
  label,
  col,
  isFocusedProp,
}: {
  id: string
  onClick: () => void
  children: React.ReactNode
  label: string
  col: number
  isFocusedProp?: boolean
}) {
  const { ref, isFocused } = useTVFocusable(id, { row: -1, col })
  const focused = isFocusedProp !== undefined ? isFocusedProp : isFocused

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200
        focus:outline-none
        ${focused
          ? 'bg-accent scale-105 ring-2 ring-white/30'
          : 'bg-white/10 hover:bg-white/20'
        }
      `}
      aria-label={label}
    >
      {children}
    </button>
  )
}

function TVClipCard({
  clip,
  categoryIndex,
  clipIndex,
}: {
  clip: BrowseClip
  categoryIndex: number
  clipIndex: number
}) {
  const router = useRouter()
  const { ref, isFocused } = useTVFocusable(`clip-${clip.id}`, {
    row: categoryIndex,
    col: clipIndex,
  })

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={() => router.push(`/tv/watch/${clip.id}`)}
      className={`
        group relative flex-shrink-0 rounded-xl overflow-hidden
        transition-all duration-200 focus:outline-none
        w-80 tv:w-96
        ${isFocused
          ? 'scale-110 ring-4 ring-accent z-10'
          : 'hover:scale-105'
        }
      `}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-bg-secondary relative">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
            <Play size={48} className="text-white/30" />
          </div>
        )}

        {/* Play overlay on focus */}
        {isFocused && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
              <Play size={32} className="text-white ml-1" />
            </div>
          </div>
        )}

        {/* Duration badge */}
        {clip.duration_seconds && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/80 rounded text-sm">
            <Clock size={14} />
            <span>{formatDuration(clip.duration_seconds)}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className={`
        p-4 bg-bg-secondary/80 transition-colors
        ${isFocused ? 'bg-accent/20' : ''}
      `}>
        <h3 className="text-lg tv:text-xl font-medium truncate">
          {clip.title}
        </h3>
        {clip.description && isFocused && (
          <p className="mt-1 text-sm text-white/60 line-clamp-2">
            {clip.description}
          </p>
        )}
      </div>
    </button>
  )
}

function TVCategoryRow({
  category,
  categoryIndex,
}: {
  category: BrowseCategory
  categoryIndex: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl tv:text-3xl font-semibold px-8 tv:px-12">
        {category.name}
      </h2>
      <div className="flex gap-4 tv:gap-6 overflow-x-auto px-8 tv:px-12 pb-4 scrollbar-hide">
        {category.clips.map((clip, index) => (
          <TVClipCard
            key={clip.id}
            clip={clip}
            categoryIndex={categoryIndex}
            clipIndex={index}
          />
        ))}
      </div>
    </div>
  )
}

export default function TVBrowsePage() {
  const router = useRouter()
  const { currentProfile, clearProfile } = useProfileStore()
  const [categories, setCategories] = useState<BrowseCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentProfile) {
      router.push('/tv')
      return
    }

    async function loadBrowseData() {
      try {
        const res = await fetch('/api/browse')
        const json: ApiResponse<BrowseCategory[]> = await res.json()
        if (json.success && json.data) {
          setCategories(json.data)
        }
      } catch (err) {
        console.error('Failed to load browse data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBrowseData()
  }, [currentProfile, router])

  const handleSwitchProfile = () => {
    clearProfile()
    router.push('/tv')
  }

  const handleExit = () => {
    clearProfile()
    router.push('/tv')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size={64} />
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-xl text-white/60">No clips yet.</p>
        <p className="text-white/40">Add content through the admin panel.</p>
        <button
          onClick={handleExit}
          className="mt-4 px-6 py-3 bg-accent rounded-lg text-lg font-medium hover:bg-accent/80 transition-colors"
        >
          Switch Profile
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 tv:py-12">
      {/* Header with navigation */}
      <div className="px-8 tv:px-12 mb-8 tv:mb-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl tv:text-4xl font-bold">Family Memories</h1>

          {/* Header actions - focusable */}
          <div className="flex items-center gap-4">
            {/* Profile button - switch profile */}
            <TVHeaderButton
              id="header-profile"
              onClick={handleSwitchProfile}
              label="Switch Profile"
              col={0}
            >
              <div className="w-10 h-10 tv:w-12 tv:h-12 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center overflow-hidden">
                {currentProfile?.avatar_path ? (
                  <img
                    src={`/api/media/files/${currentProfile.avatar_path}`}
                    alt={currentProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={20} className="text-white/60" />
                )}
              </div>
              <div className="text-left">
                <div className="text-sm text-white/60">Profile</div>
                <div className="font-medium">{currentProfile?.name}</div>
              </div>
            </TVHeaderButton>

            {/* Exit button */}
            <TVHeaderButton
              id="header-exit"
              onClick={handleExit}
              label="Exit to Profile Selection"
              col={1}
            >
              <LogOut size={24} />
              <span className="font-medium">Exit</span>
            </TVHeaderButton>
          </div>
        </div>

        {/* Navigation hint */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm tv:text-base text-white/40">
          <span>Arrow keys: Navigate</span>
          <span>Enter: Select</span>
          <span>Back/Escape: Exit to profiles</span>
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-8 tv:gap-12">
        {categories.map((category, index) => (
          <TVCategoryRow
            key={category.id}
            category={category}
            categoryIndex={index}
          />
        ))}
      </div>
    </div>
  )
}
