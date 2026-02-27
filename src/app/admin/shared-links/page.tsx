'use client'

import { useState, useEffect } from 'react'
import { Share2, Copy, Check, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/admin/shared/confirm-dialog'

interface SharedLink {
  id: string
  clip_id: string
  share_token: string
  created_by_profile_id: string | null
  expires_at: string | null
  is_active: boolean
  view_count: number
  last_viewed_at: string | null
  created_at: string
  clipTitle?: string
  creatorName?: string
}

export default function SharedLinksPage() {
  const [shares, setShares] = useState<SharedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<SharedLink | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    loadShares()
  }, [])

  async function loadShares() {
    setLoading(true)
    try {
      const res = await fetch('/api/shares')
      const json = await res.json()
      if (json.success) {
        const raw = json.data as SharedLink[]

        // Fetch clip titles and creator names
        const [clipsRes, profilesRes] = await Promise.all([
          fetch('/api/clips'),
          fetch('/api/profiles'),
        ])
        const clipsJson = await clipsRes.json()
        const profilesJson = await profilesRes.json()

        const clipMap = new Map<string, string>()
        if (clipsJson.success && clipsJson.data) {
          for (const c of clipsJson.data) clipMap.set(c.id, c.title)
        }
        const profileMap = new Map<string, string>()
        if (profilesJson.success && profilesJson.data) {
          for (const p of profilesJson.data) profileMap.set(p.id, p.name)
        }

        setShares(raw.map(s => ({
          ...s,
          clipTitle: clipMap.get(s.clip_id) || 'Unknown Clip',
          creatorName: s.created_by_profile_id ? profileMap.get(s.created_by_profile_id) || 'Unknown' : 'System',
        })))
      }
    } catch (err) {
      console.error('Failed to load shares:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/shares/${revokeTarget.share_token}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setShares(prev => prev.map(s =>
          s.id === revokeTarget.id ? { ...s, is_active: false } : s
        ))
      }
    } catch (err) {
      console.error('Failed to revoke:', err)
    } finally {
      setRevoking(false)
      setRevokeTarget(null)
    }
  }

  async function handleCopy(shareToken: string, id: string) {
    const url = `${window.location.origin}/share/${shareToken}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  function getExpiryStatus(share: SharedLink) {
    if (!share.is_active) return { label: 'Revoked', className: 'text-red-400' }
    if (share.expires_at) {
      const expires = new Date(share.expires_at)
      if (expires < new Date()) return { label: 'Expired', className: 'text-yellow-400' }
      const days = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return { label: `${days}d left`, className: 'text-green-400' }
    }
    return { label: 'No expiry', className: 'text-text-muted' }
  }

  const activeCount = shares.filter(s => {
    if (!s.is_active) return false
    if (s.expires_at && new Date(s.expires_at) < new Date()) return false
    return true
  }).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Shared Links</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="text-text-muted text-sm">Total Shares</div>
          <div className="text-2xl font-bold mt-1">{loading ? '...' : shares.length}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="text-text-muted text-sm">Active Links</div>
          <div className="text-2xl font-bold mt-1 text-green-400">{loading ? '...' : activeCount}</div>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="text-text-muted text-sm">Total Views</div>
          <div className="text-2xl font-bold mt-1">{loading ? '...' : shares.reduce((sum, s) => sum + s.view_count, 0)}</div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-text-muted" />
          <span className="ml-3 text-text-secondary">Loading shared links...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && shares.length === 0 && (
        <div className="text-center py-20">
          <Share2 size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary text-lg">No shared links yet</p>
          <p className="text-text-muted text-sm mt-1">Share a clip from the watch page to create a link</p>
        </div>
      )}

      {/* Table */}
      {!loading && shares.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-text-muted text-sm text-left">
                  <th className="px-4 py-3 font-medium">Clip</th>
                  <th className="px-4 py-3 font-medium">Shared By</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => {
                  const status = getExpiryStatus(share)
                  return (
                    <tr key={share.id} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary truncate max-w-[200px]">
                          {share.clipTitle}
                        </div>
                        <div className="text-xs text-text-muted font-mono truncate max-w-[200px]">
                          {share.share_token.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm">{share.creatorName}</td>
                      <td className="px-4 py-3 text-text-secondary text-sm">{formatDate(share.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-text-primary text-right font-medium">{share.view_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopy(share.share_token, share.id)}
                            className="p-2 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
                            title="Copy link"
                          >
                            {copiedId === share.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                          </button>
                          <a
                            href={`/share/${share.share_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
                            title="Open link"
                          >
                            <ExternalLink size={16} />
                          </a>
                          {share.is_active && (
                            <button
                              onClick={() => setRevokeTarget(share)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                              title="Revoke link"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Share Link"
        description={`This will permanently disable the share link for "${revokeTarget?.clipTitle}". Anyone with the link will no longer be able to view the clip.`}
        confirmLabel="Revoke"
        variant="danger"
        loading={revoking}
      />
    </div>
  )
}
