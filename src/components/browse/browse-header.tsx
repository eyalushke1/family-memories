'use client'

import { useRouter } from 'next/navigation'
import { ProfileAvatar } from '@/components/profiles/profile-avatar'
import { useProfileStore } from '@/stores/profile-store'

export function BrowseHeader() {
  const router = useRouter()
  const { currentProfile, clearProfile } = useProfileStore()

  function handleSwitchProfile() {
    clearProfile()
    router.push('/')
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-6 tv:h-20 tv:px-12">
      <h1 className="text-xl font-bold text-accent tv:text-2xl">
        Family Memories
      </h1>
      {currentProfile && (
        <button
          onClick={handleSwitchProfile}
          className="flex items-center gap-2 transition-opacity hover:opacity-80 focus-ring"
          title="Switch profile"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">
            {currentProfile.name}
          </span>
          <ProfileAvatar
            name={currentProfile.name}
            avatarPath={currentProfile.avatar_path}
            size="sm"
          />
        </button>
      )}
    </header>
  )
}
