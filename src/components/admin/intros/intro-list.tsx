'use client'

import { useState } from 'react'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { ConfirmDialog } from '@/components/admin/shared/confirm-dialog'
import { MediaImage } from '@/components/shared/media-image'
import { Pencil, Trash2, Clock, Play, X } from 'lucide-react'
import type { IntroClipRow } from '@/types/database'

interface IntroListProps {
  intros: IntroClipRow[]
  onEdit: (intro: IntroClipRow) => void
  onDeleted: (id: string) => void
  onToggleActive: (id: string, isActive: boolean) => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function IntroList({
  intros,
  onEdit,
  onDeleted,
  onToggleActive,
}: IntroListProps) {
  const [deleteTarget, setDeleteTarget] = useState<IntroClipRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [previewIntro, setPreviewIntro] = useState<IntroClipRow | null>(null)

  const handleToggleActive = async (intro: IntroClipRow) => {
    const newValue = !intro.is_active
    onToggleActive(intro.id, newValue)

    await fetch(`/api/admin/intros/${intro.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newValue }),
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/admin/intros/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        onDeleted(deleteTarget.id)
        setDeleteTarget(null)
      } else {
        setDeleteError(data.error || 'Failed to delete')
      }
    } catch (error) {
      console.error('Failed to delete intro:', error)
      setDeleteError('Failed to delete intro')
    } finally {
      setDeleting(false)
    }
  }

  if (intros.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        No intro clips yet. Create your first intro clip to use with your videos.
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {intros.map((intro) => (
          <div
            key={intro.id}
            className="bg-bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="aspect-video relative group cursor-pointer" onClick={() => setPreviewIntro(intro)}>
              <MediaImage
                src={
                  intro.thumbnail_path
                    ? `/api/media/files/${intro.thumbnail_path}`
                    : null
                }
                alt={intro.name}
                className="w-full h-full object-cover"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                  <Play size={32} className="text-black ml-1" />
                </div>
              </div>
              {intro.duration_seconds && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs flex items-center gap-1">
                  <Clock size={12} />
                  {formatDuration(intro.duration_seconds)}
                </div>
              )}
              {!intro.is_active && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <span className="text-sm text-text-muted">Archived</span>
                </div>
              )}
            </div>

            <div className="p-4">
              <h3 className="font-medium">{intro.name}</h3>
              {intro.description && (
                <p className="text-sm text-text-muted truncate mt-1">
                  {intro.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-4">
                <ToggleSwitch
                  checked={intro.is_active}
                  onChange={() => handleToggleActive(intro)}
                  label={intro.is_active ? 'Active' : 'Archived'}
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(intro)}
                    className="p-2 hover:bg-bg-card-hover rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={18} className="text-text-secondary" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(intro)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
        onConfirm={handleDelete}
        title="Delete Intro Clip"
        description={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${deleteTarget?.name}"? This will also delete the associated media files.`
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Video Preview Modal */}
      {previewIntro && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewIntro(null)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewIntro(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
            <div className="bg-bg-card rounded-xl overflow-hidden">
              <video
                src={`/api/media/files/${previewIntro.video_path}`}
                controls
                autoPlay
                className="w-full aspect-video"
              />
              <div className="p-4">
                <h3 className="font-medium text-lg">{previewIntro.name}</h3>
                {previewIntro.description && (
                  <p className="text-sm text-text-muted mt-1">{previewIntro.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
