'use client'

import { useState } from 'react'
import { Lock, Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    </div>
  )
}
