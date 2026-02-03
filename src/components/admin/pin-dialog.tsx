'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import { setAdminAuthenticated } from './admin-auth-guard'

interface PinDialogProps {
  onSuccess: () => void
  onCancel?: () => void
  title?: string
}

export function PinDialog({ onSuccess, onCancel, title = 'Enter Admin PIN' }: PinDialogProps) {
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    setError(null)

    // Move to next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (value && index === 3) {
      const fullPin = [...newPin.slice(0, 3), value.slice(-1)].join('')
      if (fullPin.length === 4) {
        verifyPin(fullPin)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pastedData.length === 4) {
      const newPin = pastedData.split('')
      setPin(newPin)
      verifyPin(pastedData)
    }
  }

  const verifyPin = async (pinCode: string) => {
    setVerifying(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCode }),
      })

      const data = await res.json()

      if (data.success && data.data.valid) {
        // Store auth in session
        setAdminAuthenticated(true)
        onSuccess()
      } else {
        setError('Incorrect PIN')
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('Failed to verify PIN')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-bg-secondary border border-border rounded-2xl p-8 w-full max-w-sm"
      >
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-accent" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="text-sm text-text-muted mt-1">
              Enter the 4-digit admin PIN code
            </p>
          </div>

          <div className="flex gap-3" onPaste={handlePaste}>
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={verifying}
                className="w-14 h-14 text-center text-2xl font-bold bg-bg-card border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {verifying && (
            <p className="text-sm text-text-muted">Verifying...</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
