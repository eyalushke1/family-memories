'use client'

import { useState, useEffect } from 'react'
import { Lock, Check, AlertCircle, Share2, MessageCircle } from 'lucide-react'

export default function SettingsPage() {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Share settings
  const [shareExpiryDays, setShareExpiryDays] = useState('30')
  const [shareLoading, setShareLoading] = useState(true)
  const [shareSaving, setShareSaving] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  // WhatsApp status
  const [waStatus, setWaStatus] = useState<'loading' | 'connected' | 'disconnected' | 'unavailable'>('loading')
  const [waMessage, setWaMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadShareSettings() {
      try {
        const res = await fetch('/api/admin/settings/share-expiry')
        const json = await res.json()
        if (json.success) {
          setShareExpiryDays(json.data.value)
        }
      } catch {
        // Use default
      } finally {
        setShareLoading(false)
      }
    }
    loadShareSettings()

    async function loadWhatsAppStatus() {
      try {
        const res = await fetch('/api/shares/whatsapp-status')
        const json = await res.json()
        if (json.success) {
          setWaStatus(json.data.status)
          setWaMessage(json.data.message || null)
        }
      } catch {
        setWaStatus('unavailable')
      }
    }
    loadWhatsAppStatus()
  }, [])

  const handleShareExpirySave = async () => {
    setShareSaving(true)
    setShareSuccess(false)
    try {
      const res = await fetch('/api/admin/settings/share-expiry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: shareExpiryDays }),
      })
      const json = await res.json()
      if (json.success) setShareSuccess(true)
    } catch {
      // Silently fail
    } finally {
      setShareSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!currentPin) {
      setError('Current PIN is required')
      return
    }

    if (!newPin) {
      setError('New PIN is required')
      return
    }

    if (newPin.length < 4 || newPin.length > 8) {
      setError('PIN must be 4-8 digits')
      return
    }

    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only numbers')
      return
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/admin/pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(true)
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
      } else {
        setError(data.error || 'Failed to update PIN')
      }
    } catch {
      setError('Failed to update PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Change Admin PIN</h2>
            <p className="text-sm text-text-muted">
              Update the PIN code used to access the admin panel
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Current PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter current PIN"
              maxLength={8}
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              New PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter new PIN (4-8 digits)"
              maxLength={8}
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Confirm New PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm new PIN"
              maxLength={8}
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check size={16} />
              PIN updated successfully
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update PIN'}
          </button>
        </form>

        <p className="text-xs text-text-muted mt-4">
          Default PIN: 2312. Keep your PIN secure and don&apos;t share it.
        </p>
      </div>
      {/* Share Link Settings */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Share Link Settings</h2>
            <p className="text-sm text-text-muted">
              Configure default expiry for shared clip links
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Default Link Expiry
            </label>
            <select
              value={shareExpiryDays}
              onChange={(e) => setShareExpiryDays(e.target.value)}
              disabled={shareLoading}
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none cursor-pointer"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="0">Never expire</option>
            </select>
          </div>

          {shareSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check size={16} />
              Share settings updated
            </div>
          )}

          <button
            onClick={handleShareExpirySave}
            disabled={shareSaving || shareLoading}
            className="w-full px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {shareSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <p className="text-xs text-text-muted mt-4">
          New share links will use this expiry. Existing links keep their original expiry.
        </p>
      </div>

      {/* WhatsApp Integration */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">WhatsApp Integration</h2>
            <p className="text-sm text-text-muted">
              Direct WhatsApp messaging via wweb-mcp bridge
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              waStatus === 'connected' ? 'bg-green-500' :
              waStatus === 'disconnected' ? 'bg-yellow-500' :
              waStatus === 'loading' ? 'bg-text-muted animate-pulse' :
              'bg-red-500'
            }`} />
            <span className="text-sm font-medium">
              {waStatus === 'connected' && 'Connected'}
              {waStatus === 'disconnected' && 'Disconnected'}
              {waStatus === 'unavailable' && 'Not Running'}
              {waStatus === 'loading' && 'Checking...'}
            </span>
          </div>

          {waMessage && (
            <p className="text-text-muted text-xs">{waMessage}</p>
          )}

          {waStatus === 'unavailable' && (
            <div className="bg-bg-secondary border border-border rounded-lg p-4 text-sm text-text-secondary space-y-2">
              <p>To enable direct WhatsApp sending:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-text-muted">
                <li>Run <code className="bg-bg-primary px-1 py-0.5 rounded">npm run whatsapp</code></li>
                <li>Scan the QR code with your WhatsApp app</li>
                <li>Session persists for ~20 days</li>
              </ol>
            </div>
          )}

          {waStatus === 'disconnected' && (
            <p className="text-xs text-yellow-400">
              Bridge is running but WhatsApp is disconnected. Re-scan the QR code.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
