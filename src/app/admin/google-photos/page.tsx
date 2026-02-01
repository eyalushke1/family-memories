'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GooglePhotosConnect } from '@/components/admin/google-photos/google-photos-connect'
import { GooglePhotosPicker } from '@/components/admin/google-photos/google-photos-picker'

function GooglePhotosContent() {
  const searchParams = useSearchParams()
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // Check URL params for connection status
  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/auth/google/status')
        const data = await res.json()
        setIsConnected(data.success && data.data.connected)
      } catch {
        setIsConnected(false)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
  }, [connected])

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setIsConnected(false)
      }
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Google Photos</h1>
        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Show error messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error === 'access_denied' && 'Access was denied. Please try connecting again.'}
          {error === 'invalid_request' && 'Invalid request. Please try again.'}
          {error === 'invalid_state' && 'Security validation failed. Please try again.'}
          {error === 'token_exchange_failed' && 'Failed to complete authorization. Please try again.'}
        </div>
      )}

      {/* Show success message */}
      {connected === 'true' && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          Successfully connected to Google Photos!
        </div>
      )}

      {/* Reconnection notice for existing connections with old scope */}
      {isConnected && !connected && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
          <strong>Important:</strong> Google Photos API has changed. If you see errors, please click
          &quot;Disconnect&quot; above and reconnect to get updated permissions.
        </div>
      )}

      {loading ? (
        <div className="text-text-secondary">Checking connection status...</div>
      ) : isConnected ? (
        <GooglePhotosPicker />
      ) : (
        <GooglePhotosConnect />
      )}
    </div>
  )
}

export default function GooglePhotosPage() {
  return (
    <Suspense fallback={<div className="text-text-secondary">Loading...</div>}>
      <GooglePhotosContent />
    </Suspense>
  )
}
