'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings } from 'lucide-react'
import { ProfileCard } from './profile-card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { PinDialog } from '@/components/admin/pin-dialog'
import { useProfileStore } from '@/stores/profile-store'
import type { ProfileRow } from '@/types/database'
import type { ApiResponse } from '@/types/api'

export function ProfileGrid() {
  const router = useRouter()
  const { profiles, setProfiles, setCurrentProfile, restoreFromCookie, currentProfile } = useProfileStore()
  const [loading, setLoading] = useState(true)
  const [showPinDialog, setShowPinDialog] = useState(false)

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

  const handleSelect = useCallback((profile: ProfileRow) => {
    setCurrentProfile(profile)
    router.push('/browse')
  }, [setCurrentProfile, router])

  const handlePinSuccess = useCallback(() => {
    setShowPinDialog(false)
    // Go directly to admin panel after successful PIN
    window.location.href = '/admin'
  }, [])

  // Filter hidden profiles
  const visibleProfiles = profiles.filter(p => !p.is_hidden)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  return (
    <>
      <motion.div
        className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Admin Settings Button */}
        <button
          onClick={() => setShowPinDialog(true)}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title="Admin Panel"
        >
          <Settings size={24} />
        </button>

        <h1 className="text-3xl font-medium text-white tv:text-5xl">
          Who's watching?
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-6 tv:gap-10">
          {visibleProfiles.map((profile) => (
            <div key={profile.id} className="relative">
              <ProfileCard
                profile={profile}
                onSelect={handleSelect}
              />
            </div>
          ))}
        </div>

        {visibleProfiles.length === 0 && (
          <p className="text-text-secondary">
            No profiles found. Add profiles through the admin panel.
          </p>
        )}
      </motion.div>

      {/* PIN Dialog */}
      <AnimatePresence>
        {showPinDialog && (
          <PinDialog
            onSuccess={handlePinSuccess}
            onCancel={() => setShowPinDialog(false)}
            title="Admin Access"
          />
        )}
      </AnimatePresence>
    </>
  )
}
