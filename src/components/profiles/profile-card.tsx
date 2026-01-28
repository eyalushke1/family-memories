'use client'

import { motion } from 'framer-motion'
import { ProfileAvatar } from './profile-avatar'
import type { ProfileRow } from '@/types/database'

interface ProfileCardProps {
  profile: ProfileRow
  onSelect: (profile: ProfileRow) => void
}

export function ProfileCard({ profile, onSelect }: ProfileCardProps) {
  return (
    <motion.button
      className="group flex flex-col items-center gap-3 focus-ring"
      onClick={() => onSelect(profile)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative overflow-hidden rounded-md ring-2 ring-transparent transition-all group-hover:ring-white group-focus-visible:ring-accent">
        <ProfileAvatar
          name={profile.name}
          avatarPath={profile.avatar_path}
          size="lg"
        />
      </div>
      <span className="text-sm text-text-secondary transition-colors group-hover:text-white tv:text-base">
        {profile.name}
      </span>
    </motion.button>
  )
}
