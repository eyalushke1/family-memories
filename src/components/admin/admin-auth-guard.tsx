'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PinDialog } from './pin-dialog'

interface AdminAuthGuardProps {
  children: React.ReactNode
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check session storage for auth
    const auth = sessionStorage.getItem('admin-auth')
    setIsAuthenticated(auth === 'true')
  }, [])

  const handleSuccess = () => {
    setIsAuthenticated(true)
  }

  const handleCancel = () => {
    router.push('/browse')
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
