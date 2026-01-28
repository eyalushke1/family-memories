'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ProfileCard } from './profile-card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useProfileStore } from '@/stores/profile-store'
import type { ProfileRow } from '@/types/database'
import type { ApiResponse } from '@/types/api'

export function ProfileGrid() {
  const router = useRouter()
  const { profiles, setProfiles, setCurrentProfile, restoreFromCookie, currentProfile } = useProfileStore()
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    if (profiles.length > 0) {
      restoreFromCookie()
    }
  }, [profiles, restoreFromCookie])

  useEffect(() => {
    if (currentProfile) {
      router.push('/browse')
    }
  }, [currentProfile, router])

  function handleSelect(profile: ProfileRow) {
    setCurrentProfile(profile)
    router.push('/browse')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <motion.div
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-3xl font-medium text-white tv:text-5xl">
        Who&apos;s watching?
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-6 tv:gap-10">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onSelect={handleSelect}
          />
        ))}
      </div>
      {profiles.length === 0 && (
        <p className="text-text-secondary">
          No profiles found. Add profiles through the admin panel.
        </p>
      )}
    </motion.div>
  )
}
