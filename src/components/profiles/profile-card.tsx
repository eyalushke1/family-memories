'use client'

import { motion } from 'framer-motion'
import { ProfileAvatar } from './profile-avatar'
import type { ProfileRow } from '@/types/database'

interface ProfileCardProps {
  profile: ProfileRow
  onSelect: (profile: ProfileRow) => void
  disabled?: boolean
  dimmed?: boolean
}

export function ProfileCard({ profile, onSelect, disabled, dimmed }: ProfileCardProps) {
  return (
    <motion.button
      className={`group flex flex-col items-center gap-3 focus-ring ${disabled ? 'cursor-default' : ''} ${dimmed ? 'opacity-50' : ''}`}
      onClick={() => !disabled && onSelect(profile)}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      <div className={`relative overflow-hidden rounded-md ring-2 ring-transparent transition-all ${!disabled ? 'group-hover:ring-white' : ''} group-focus-visible:ring-accent`}>
        <ProfileAvatar
          name={profile.name}
          avatarPath={profile.avatar_path}
          size="lg"
        />
      </div>
      <span className={`text-sm text-text-secondary transition-colors ${!disabled ? 'group-hover:text-white' : ''} tv:text-base`}>
        {profile.name}
      </span>
    </motion.button>
  )
}
