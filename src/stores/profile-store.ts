'use client'

import { create } from 'zustand'
import type { ProfileRow } from '@/types/database'

interface ProfileState {
  currentProfile: ProfileRow | null
  profiles: ProfileRow[]
  setCurrentProfile: (profile: ProfileRow) => void
  clearProfile: () => void
  setProfiles: (profiles: ProfileRow[]) => void
  restoreFromCookie: () => void
}

async function setProfileCookie(profileId: string) {
  // Use server endpoint to set signed cookie
  await fetch('/api/auth/set-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId }),
  })
}

async function clearProfileCookie() {
  await fetch('/api/auth/set-profile', { method: 'DELETE' })
}

function getProfileIdFromCookie(): string | null {
  const match = document.cookie.match(/fm-profile-id=([^;]+)/)
  return match ? match[1] : null
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  currentProfile: null,
  profiles: [],

  setCurrentProfile: (profile) => {
    setProfileCookie(profile.id)
    set({ currentProfile: profile })
  },

  clearProfile: () => {
    clearProfileCookie()
    set({ currentProfile: null })
  },

  setProfiles: (profiles) => {
    set({ profiles })
  },

  restoreFromCookie: () => {
    const profileId = getProfileIdFromCookie()
    if (profileId) {
      const { profiles } = get()
      const found = profiles.find((p) => p.id === profileId)
      if (found) {
        set({ currentProfile: found })
      }
    }
  },
}))
