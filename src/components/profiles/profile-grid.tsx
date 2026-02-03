'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Eye, EyeOff, X, LogIn } from 'lucide-react'
import { ProfileCard } from './profile-card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { PinDialog } from '@/components/admin/pin-dialog'
import { useProfileStore } from '@/stores/profile-store'
import type { ProfileRow } from '@/types/database'
import type { ApiResponse } from '@/types/api'

const HIDDEN_PROFILES_KEY = 'fm-hidden-profiles'

function getHiddenProfiles(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(HIDDEN_PROFILES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setHiddenProfiles(ids: string[]) {
  localStorage.setItem(HIDDEN_PROFILES_KEY, JSON.stringify(ids))
}

export function ProfileGrid() {
  const router = useRouter()
  const { profiles, setProfiles, setCurrentProfile, restoreFromCookie, currentProfile } = useProfileStore()
  const [loading, setLoading] = useState(true)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [hiddenProfileIds, setHiddenProfileIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setHiddenProfileIds(new Set(getHiddenProfiles()))
  }, [])

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
    if (isAdminMode) return // Don't select in admin mode
    setCurrentProfile(profile)
    router.push('/browse')
  }, [isAdminMode, setCurrentProfile, router])

  const handleToggleVisibility = useCallback((profileId: string) => {
    setHiddenProfileIds(prev => {
      const next = new Set(prev)
      if (next.has(profileId)) {
        next.delete(profileId)
      } else {
        next.add(profileId)
      }
      setHiddenProfiles(Array.from(next))
      return next
    })
  }, [])

  const handlePinSuccess = useCallback(() => {
    setShowPinDialog(false)
    setIsAdminMode(true)
  }, [])

  const visibleProfiles = isAdminMode
    ? profiles
    : profiles.filter(p => !hiddenProfileIds.has(p.id))

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
          onClick={() => isAdminMode ? setIsAdminMode(false) : setShowPinDialog(true)}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title={isAdminMode ? 'Exit admin mode' : 'Admin settings'}
        >
          {isAdminMode ? <X size={24} /> : <Settings size={24} />}
        </button>

        {/* Admin mode indicator */}
        {isAdminMode && (
          <div className="absolute top-6 left-6 flex items-center gap-4">
            <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium">
              Admin Mode
            </span>
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-colors"
            >
              <LogIn size={16} />
              Go to Admin Panel
            </button>
          </div>
        )}

        <h1 className="text-3xl font-medium text-white tv:text-5xl">
          {isAdminMode ? 'Manage Profiles' : "Who's watching?"}
        </h1>

        {isAdminMode && (
          <p className="text-text-muted text-sm -mt-4">
            Click the eye icon to show/hide profiles from the main screen
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-6 tv:gap-10">
          {visibleProfiles.map((profile) => (
            <div key={profile.id} className="relative">
              <ProfileCard
                profile={profile}
                onSelect={handleSelect}
                disabled={isAdminMode}
                dimmed={isAdminMode && hiddenProfileIds.has(profile.id)}
              />
              {isAdminMode && (
                <button
                  onClick={() => handleToggleVisibility(profile.id)}
                  className={`absolute -top-2 -right-2 p-2 rounded-full transition-colors ${
                    hiddenProfileIds.has(profile.id)
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                  }`}
                  title={hiddenProfileIds.has(profile.id) ? 'Show profile' : 'Hide profile'}
                >
                  {hiddenProfileIds.has(profile.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          ))}
        </div>

        {visibleProfiles.length === 0 && !isAdminMode && (
          <p className="text-text-secondary">
            No profiles found. Add profiles through the admin panel.
          </p>
        )}

        {visibleProfiles.length === 0 && isAdminMode && (
          <p className="text-text-secondary">
            No profiles exist. Go to admin panel to create profiles.
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
