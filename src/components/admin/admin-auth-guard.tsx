'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PinDialog } from './pin-dialog'

interface AdminAuthGuardProps {
  children: React.ReactNode
}

// Shared auth check function that can be used elsewhere
export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('admin-auth') === 'true'
}

export function setAdminAuthenticated(value: boolean) {
  if (typeof window === 'undefined') return
  if (value) {
    sessionStorage.setItem('admin-auth', 'true')
  } else {
    sessionStorage.removeItem('admin-auth')
  }
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const checkAuth = useCallback(() => {
    const auth = isAdminAuthenticated()
    setIsAuthenticated(auth)
  }, [])

  useEffect(() => {
    // Check immediately
    checkAuth()

    // Also listen for storage events (in case auth changes in another tab)
    const handleStorage = () => checkAuth()
    window.addEventListener('storage', handleStorage)

    // Check periodically in case it was set just before navigation
    const interval = setInterval(checkAuth, 100)

    // Clear interval after first successful check
    const timeout = setTimeout(() => clearInterval(interval), 1000)

    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [checkAuth])

  const handleSuccess = () => {
    setAdminAuthenticated(true)
    setIsAuthenticated(true)
  }

  const handleCancel = () => {
    router.push('/')
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  // Show PIN dialog if not authenticated
  if (!isAuthenticated) {
    return <PinDialog onSuccess={handleSuccess} onCancel={handleCancel} />
  }

  return <>{children}</>
}
