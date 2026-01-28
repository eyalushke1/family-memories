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

function setProfileCookie(profileId: string) {
  document.cookie = `fm-profile-id=${profileId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

function clearProfileCookie() {
  document.cookie = 'fm-profile-id=; path=/; max-age=0'
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
