'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useProfileStore } from '@/stores/profile-store'
import { useTVFocusable } from '@/components/tv/tv-navigation-context'
import type { ProfileRow } from '@/types/database'
import type { ApiResponse } from '@/types/api'

function TVProfileCard({
  profile,
  index,
  onSelect,
}: {
  profile: ProfileRow
  index: number
  onSelect: (profile: ProfileRow) => void
}) {
  const { ref, isFocused } = useTVFocusable(`profile-${profile.id}`, {
    row: 0,
    col: index,
  })

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={() => onSelect(profile)}
      className={`
        flex flex-col items-center gap-4 p-4 rounded-xl transition-all duration-200
        focus:outline-none
        ${isFocused
          ? 'scale-110 ring-4 ring-accent bg-white/10'
          : 'hover:scale-105 hover:bg-white/5'
        }
      `}
    >
      <div
        className={`
          w-32 h-32 tv:w-48 tv:h-48 rounded-full overflow-hidden
          bg-gradient-to-br from-accent/30 to-accent/10
          flex items-center justify-center
          ${isFocused ? 'ring-4 ring-accent' : ''}
        `}
      >
        {profile.avatar_path ? (
          <img
            src={`/api/media/files/${profile.avatar_path}`}
            alt={profile.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl tv:text-6xl font-bold text-white/60">
            {profile.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-xl tv:text-2xl font-medium text-white">
        {profile.name}
      </span>
    </button>
  )
}

export default function TVHomePage() {
  const router = useRouter()
  const { profiles, setProfiles, setCurrentProfile, clearProfile } = useProfileStore()
  const [loading, setLoading] = useState(true)

  // Always clear profile when entering TV mode - start fresh with profile selection
  useEffect(() => {
    clearProfile()
  }, [clearProfile])

  useEffect(() => {
    async function loadProfiles() {
      try {
        const res = await fetch('/api/profiles')
        const json: ApiResponse<ProfileRow[]> = await res.json()
        if (json.success && json.data) {
          setProfiles(json.data)
        }
      } catch (err) {
        console.error('Failed to load profiles:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfiles()
  }, [setProfiles])

  function handleSelect(profile: ProfileRow) {
    setCurrentProfile(profile)
    router.push('/tv/browse')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size={64} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-8">
      <h1 className="text-4xl tv:text-6xl font-medium text-white">
        Who&apos;s watching?
      </h1>
      <p className="text-lg tv:text-xl text-white/60">
        Use arrow keys to navigate, Enter to select
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 tv:gap-12">
        {profiles.map((profile, index) => (
          <TVProfileCard
            key={profile.id}
            profile={profile}
            index={index}
            onSelect={handleSelect}
          />
        ))}
      </div>
      {profiles.length === 0 && (
        <p className="text-white/60 text-xl">
          No profiles found. Add profiles through the admin panel.
        </p>
      )}
    </div>
  )
}
