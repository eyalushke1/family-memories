'use client'

import { cn } from '@/lib/utils'

interface ProfileAvatarProps {
  name: string
  avatarPath: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-10 h-10 text-sm',
  md: 'w-20 h-20 text-xl',
  lg: 'w-28 h-28 text-3xl tv:w-36 tv:h-36 tv:text-4xl',
}

const AVATAR_COLORS = [
  'bg-red-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-yellow-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-orange-600',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function ProfileAvatar({ name, avatarPath, size = 'lg', className }: ProfileAvatarProps) {
  const proxyUrl = avatarPath ? `/api/media/files/${avatarPath}` : null

  if (proxyUrl) {
    return (
      <img
        src={proxyUrl}
        alt={name}
        className={cn(
          'rounded-md object-cover',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md font-bold text-white',
        sizeClasses[size],
        getAvatarColor(name),
        className
      )}
      aria-label={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
