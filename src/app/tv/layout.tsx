'use client'

import { useRouter, usePathname } from 'next/navigation'
import { TVNavigationProvider } from '@/components/tv/tv-navigation-context'
import { useProfileStore } from '@/stores/profile-store'

export default function TVLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { clearProfile } = useProfileStore()

  const handleBack = () => {
    // From profile selection page (/tv), don't go back further
    if (pathname === '/tv') {
      return
    }

    // From browse page (/tv/browse), go to profile selection
    if (pathname === '/tv/browse') {
      clearProfile()
      router.push('/tv')
      return
    }

    // From watch page (/tv/watch/...), go back to browse
    if (pathname.startsWith('/tv/watch/')) {
      router.push('/tv/browse')
      return
    }

    // Default: go back
    router.back()
  }

  return (
    <TVNavigationProvider onBack={handleBack}>
      <div className="min-h-screen bg-bg-primary text-white">
        {children}
      </div>
    </TVNavigationProvider>
  )
}
