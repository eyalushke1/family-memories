'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { toggleTheme, type Theme } from './theme-provider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const currentProfile = useProfileStore((s) => s.currentProfile)

  useEffect(() => {
    const stored = localStorage.getItem('fm-theme')
    setTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  const handleToggle = async () => {
    const newTheme = toggleTheme()
    setTheme(newTheme)

    // Persist to profile if logged in
    if (currentProfile) {
      try {
        await fetch(`/api/profiles/${currentProfile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: newTheme }),
        })
      } catch {
        // Silently fail — localStorage already saved
      }
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-lg transition-colors hover:bg-bg-card-hover ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun size={20} className="text-text-secondary" />
      ) : (
        <Moon size={20} className="text-text-secondary" />
      )}
    </button>
  )
}
