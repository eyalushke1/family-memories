'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Loader2, Mail, MessageCircle, Send, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { SHARE_EXPIRY_DAY_OPTIONS, DEFAULT_SHARE_EXPIRY_DAYS } from '@/lib/shares/expiry'

interface ShareDialogProps {
  clipId: string
  clipTitle: string
  open: boolean
  onClose: () => void
}

type WhatsAppState = 'idle' | 'input' | 'sending' | 'sent' | 'opened' | 'error'

export function ShareDialog({ clipId, clipTitle, open, onClose }: ShareDialogProps) {
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [expiryDays, setExpiryDays] = useState(DEFAULT_SHARE_EXPIRY_DAYS)
  const [updatingExpiry, setUpdatingExpiry] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // WhatsApp state
  const [waState, setWaState] = useState<WhatsAppState>('idle')
  const [waDirectAvailable, setWaDirectAvailable] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [waError, setWaError] = useState<string | null>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  // Check WhatsApp service availability + create share link when dialog opens
  useEffect(() => {
    if (!open) {
      setShareUrl(null)
      setShareToken(null)
      setExpiresAt(null)
      setExpiryDays(DEFAULT_SHARE_EXPIRY_DAYS)
      setUpdatingExpiry(false)
      setCopied(false)
      setError(null)
      setWaState('idle')
      setPhoneNumber('')
      setWaError(null)
      return
    }

    async function createShare() {
      setLoading(true)
      setError(null)

      try {
        const profileMatch = document.cookie.match(/fm-profile-id=([^;]+)/)
        const profileId = profileMatch ? profileMatch[1] : null

        const res = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipId, profileId, expiryDays: DEFAULT_SHARE_EXPIRY_DAYS }),
        })
        const json = await res.json()

        if (json.success) {
          setShareUrl(json.data.shareUrl)
          setShareToken(json.data.shareToken)
          setExpiresAt(json.data.expiresAt)
        } else {
          setError(json.error || 'Failed to create share link')
        }
      } catch {
        setError('Failed to create share link')
      } finally {
        setLoading(false)
      }
    }

    async function checkWhatsAppStatus() {
      try {
        const res = await fetch('/api/shares/whatsapp-status')
        const json = await res.json()
        setWaDirectAvailable(json.success && json.data?.status === 'connected')
      } catch {
        setWaDirectAvailable(false)
      }
    }

    createShare()
    checkWhatsAppStatus()
  }, [open, clipId])

  // Focus phone input when WhatsApp input mode activates
  useEffect(() => {
    if (waState === 'input') {
      setTimeout(() => phoneInputRef.current?.focus(), 100)
    }
  }, [waState])

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Change how long the link stays valid. Updates the existing share row, so the
  // URL never changes — a link already copied or sent stays valid.
  const handleExpiryChange = async (days: number) => {
    if (!shareToken || days === expiryDays || updatingExpiry) return

    const previousDays = expiryDays
    setExpiryDays(days)
    setUpdatingExpiry(true)
    setError(null)

    try {
      const res = await fetch(`/api/shares/${shareToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryDays: days }),
      })
      const json = await res.json()

      if (json.success) {
        setExpiresAt(json.data.expiresAt)
      } else {
        setExpiryDays(previousDays)
        setError(json.error || 'Failed to update link expiry')
      }
    } catch {
      setExpiryDays(previousDays)
      setError('Failed to update link expiry')
    } finally {
      setUpdatingExpiry(false)
    }
  }

  const handleWhatsAppClick = () => {
    setWaState('input')
    setWaError(null)
  }

  const normalizePhone = (phone: string) => {
    let num = phone.replace(/[\s\-()]/g, '')
    if (num.startsWith('+')) num = num.slice(1)
    if (num.startsWith('0')) num = '972' + num.slice(1)
    return num
  }

  const openWhatsAppWeb = (phone?: string) => {
    if (!shareUrl) return
    const text = encodeURIComponent(`${clipTitle}\n${shareUrl}`)
    const num = phone ? normalizePhone(phone) : ''
    const url = num
      ? `https://wa.me/${num}?text=${text}`
      : `https://wa.me/?text=${text}`
    window.open(url, '_blank')
  }

  const handleWhatsAppSend = async () => {
    if (!shareUrl || !phoneNumber.trim()) return

    // If direct send not available, go straight to wa.me
    if (!waDirectAvailable) {
      openWhatsAppWeb(phoneNumber.trim())
      setWaState('opened')
      return
    }

    setWaState('sending')
    setWaError(null)

    try {
      const res = await fetch('/api/shares/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          shareUrl,
          clipTitle,
        }),
      })
      const json = await res.json()

      if (json.success) {
        setWaState('sent')
      } else {
        // Direct send failed — fall back to wa.me
        openWhatsAppWeb(phoneNumber.trim())
        setWaState('opened')
      }
    } catch {
      // Service unavailable — fall back to wa.me
      openWhatsAppWeb(phoneNumber.trim())
      setWaState('opened')
    }
  }

  const handleEmail = () => {
    if (!shareUrl) return
    const subject = encodeURIComponent(clipTitle)
    const body = encodeURIComponent(`Check out this clip:\n\n${clipTitle}\n${shareUrl}`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const formatExpiry = (iso: string) => {
    const d = new Date(iso)
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Expires soon'
    if (days === 1) return 'Expires in 1 day'
    return `Expires in ${days} days`
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />

          {/* Dialog */}
          <motion.div
            className="relative bg-bg-secondary border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-text-primary mb-1">Share Clip</h2>
            <p className="text-text-secondary text-sm mb-6 truncate">{clipTitle}</p>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-text-muted" />
                <span className="ml-3 text-text-secondary">Creating share link...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-red-400 text-sm text-center py-4">{error}</div>
            )}

            {/* Share link and actions */}
            {shareUrl && !loading && (
              <>
                {/* URL field + copy */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-secondary truncate font-mono">
                    {shareUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      copied
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-accent hover:bg-accent-hover text-white'
                    }`}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>

                {/* Link duration picker */}
                <div className="mb-4">
                  <p className="text-text-secondary text-xs mb-2">Link active for</p>
                  <div className="flex gap-2">
                    {SHARE_EXPIRY_DAY_OPTIONS.map((days) => (
                      <button
                        key={days}
                        onClick={() => handleExpiryChange(days)}
                        disabled={updatingExpiry}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          expiryDays === days
                            ? 'bg-accent border-accent text-white'
                            : 'bg-bg-primary border-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {days === 1 ? '1 day' : `${days} days`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry info */}
                {expiresAt && (
                  <p className="text-text-muted text-xs mb-4 flex items-center gap-1.5">
                    {updatingExpiry && <Loader2 size={12} className="animate-spin" />}
                    {formatExpiry(expiresAt)}
                  </p>
                )}

                {/* Action buttons (idle state) */}
                {waState === 'idle' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleWhatsAppClick}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] font-medium text-sm transition-colors"
                    >
                      <MessageCircle size={18} />
                      WhatsApp
                    </button>
                    <button
                      onClick={handleEmail}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium text-sm transition-colors"
                    >
                      <Mail size={18} />
                      Email
                    </button>
                  </div>
                )}

                {/* WhatsApp phone input */}
                {(waState === 'input' || waState === 'sending' || waState === 'error') && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 bg-bg-primary border border-border rounded-lg overflow-hidden">
                        <span className="pl-3 text-sm text-text-muted shrink-0">+</span>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleWhatsAppSend() }}
                          placeholder="972501234567"
                          className="flex-1 bg-transparent px-1 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
                          disabled={waState === 'sending'}
                        />
                      </div>
                      <button
                        onClick={handleWhatsAppSend}
                        disabled={waState === 'sending' || !phoneNumber.trim()}
                        className="shrink-0 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#25D366]/80 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {waState === 'sending' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : waDirectAvailable ? (
                          <Send size={16} />
                        ) : (
                          <ExternalLink size={16} />
                        )}
                      </button>
                    </div>

                    {!waDirectAvailable && (
                      <p className="text-text-muted text-xs">
                        Opens WhatsApp with the message ready to send
                      </p>
                    )}

                    {waError && (
                      <p className="text-red-400 text-xs">{waError}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => openWhatsAppWeb()}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        Open WhatsApp without number
                      </button>
                      <button
                        onClick={handleEmail}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors flex items-center gap-1"
                      >
                        <Mail size={12} />
                        Email
                      </button>
                    </div>
                  </div>
                )}

                {/* Direct send success */}
                {waState === 'sent' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/20 text-[#25D366]">
                      <Check size={18} />
                      <span className="font-medium text-sm">Sent via WhatsApp!</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { setWaState('input'); setPhoneNumber('') }}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors"
                      >
                        Send to another number
                      </button>
                      <button
                        onClick={handleEmail}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors flex items-center gap-1"
                      >
                        <Mail size={12} />
                        Email
                      </button>
                    </div>
                  </div>
                )}

                {/* Opened in WhatsApp (fallback) */}
                {waState === 'opened' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/20 text-[#25D366]">
                      <ExternalLink size={18} />
                      <span className="font-medium text-sm">Opened in WhatsApp</span>
                    </div>
                    <p className="text-text-muted text-xs text-center">
                      Press Send in WhatsApp to deliver the message
                    </p>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { setWaState('input'); setPhoneNumber('') }}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors"
                      >
                        Try another number
                      </button>
                      <button
                        onClick={handleEmail}
                        className="text-text-muted text-xs hover:text-text-secondary transition-colors flex items-center gap-1"
                      >
                        <Mail size={12} />
                        Email
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-text-muted text-xs text-center mt-4">
                  Anyone with this link can view this clip only
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
