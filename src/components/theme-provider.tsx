'use client'

import { useEffect } from 'react'
import { useProfileStore } from '@/stores/profile-store'

export type Theme = 'dark' | 'light'

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('fm-theme')
  return stored === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove('dark', 'light')
  html.classList.add(theme)
  localStorage.setItem('fm-theme', theme)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentProfile = useProfileStore((s) => s.currentProfile)

  // Apply theme from localStorage immediately on mount
  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  // Sync theme when profile changes
  useEffect(() => {
    if (currentProfile?.theme) {
      const theme = currentProfile.theme === 'light' ? 'light' : 'dark'
      applyTheme(theme)
    }
  }, [currentProfile?.theme])

  return <>{children}</>
}

export function toggleTheme(): Theme {
  const current = getStoredTheme()
  const next: Theme = current === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
