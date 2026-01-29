'use client'

import { useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { SortableList } from '@/components/admin/shared/sortable-list'
import { SortableItem } from '@/components/admin/shared/sortable-item'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { ConfirmDialog } from '@/components/admin/shared/confirm-dialog'
import { MediaImage } from '@/components/shared/media-image'
import { Pencil, Trash2, Clock } from 'lucide-react'
import type { ClipRow, CategoryRow } from '@/types/database'

interface ClipListProps {
  clips: ClipRow[]
  categories: CategoryRow[]
  selectedCategory: string
  onEdit: (clip: ClipRow) => void
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ClipList({
  clips,
  categories,
  selectedCategory,
  onEdit,
}: ClipListProps) {
  const { reorderClips, updateClip, removeClip } = useAdminStore()
  const [deleteTarget, setDeleteTarget] = useState<ClipRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleReorder = async (reordered: ClipRow[]) => {
    if (!selectedCategory) return

    reorderClips(selectedCategory, reordered)

    // Save to server
    await fetch('/api/admin/clips/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: selectedCategory,
        ids: reordered.map((c) => c.id),
      }),
    })
  }

  const handleToggleActive = async (clip: ClipRow) => {
    const newValue = !clip.is_active
    updateClip(clip.id, { is_active: newValue })

    await fetch(`/api/admin/clips/${clip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newValue }),
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/clips/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        removeClip(deleteTarget.id)
        setDeleteTarget(null)
      }
    } catch (error) {
      console.error('Failed to delete clip:', error)
    } finally {
      setDeleting(false)
    }
  }

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? 'Unknown'

  if (clips.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        {selectedCategory
          ? 'No clips in this category yet.'
          : 'No clips yet. Create your first clip to get started.'}
      </div>
    )
  }

  // Group by category if no filter
  if (!selectedCategory) {
    const grouped = clips.reduce(
      (acc, clip) => {
        if (!acc[clip.category_id]) {
          acc[clip.category_id] = []
        }
        acc[clip.category_id].push(clip)
        return acc
      },
      {} as Record<string, ClipRow[]>
    )

    return (
      <>
        {Object.entries(grouped).map(([categoryId, categoryClips]) => (
          <div key={categoryId} className="mb-8">
            <h2 className="text-lg font-semibold mb-4">
              {getCategoryName(categoryId)}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onEdit={onEdit}
                  onDelete={setDeleteTarget}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          </div>
        ))}
        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Clip"
          description={`Are you sure you want to delete "${deleteTarget?.title}"? This will also delete the associated media files.`}
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
        />
      </>
    )
  }

  // Sortable list for single category
  return (
    <>
      <div className="space-y-2">
        <SortableList items={clips} onReorder={handleReorder}>
          {clips.map((clip) => (
            <SortableItem key={clip.id} id={clip.id}>
              <div className="flex items-center gap-4">
                <div className="w-32 h-18 flex-shrink-0">
                  <MediaImage
                    src={
                      clip.thumbnail_path
                        ? `/api/media/files/${clip.thumbnail_path}`
                        : null
                    }
                    alt={clip.title}
                    className="w-full h-full object-cover rounded"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{clip.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Clock size={14} />
                    <span>{formatDuration(clip.duration_seconds)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <ToggleSwitch
                    checked={clip.is_active}
                    onChange={() => handleToggleActive(clip)}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(clip)}
                      className="p-2 hover:bg-bg-card-hover rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={18} className="text-text-secondary" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(clip)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </SortableItem>
          ))}
        </SortableList>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Clip"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This will also delete the associated media files.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}

interface ClipCardProps {
  clip: ClipRow
  onEdit: (clip: ClipRow) => void
  onDelete: (clip: ClipRow) => void
  onToggleActive: (clip: ClipRow) => void
}

function ClipCard({ clip, onEdit, onDelete, onToggleActive }: ClipCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="aspect-video relative">
        <MediaImage
          src={
            clip.thumbnail_path
              ? `/api/media/files/${clip.thumbnail_path}`
              : null
          }
          alt={clip.title}
          className="w-full h-full object-cover"
        />
        {clip.duration_seconds && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs">
            {formatDuration(clip.duration_seconds)}
          </div>
        )}
        {!clip.is_active && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-sm text-text-muted">Archived</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-medium truncate">{clip.title}</h3>
        {clip.description && (
          <p className="text-sm text-text-muted truncate mt-1">
            {clip.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <ToggleSwitch
            checked={clip.is_active}
            onChange={() => onToggleActive(clip)}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(clip)}
              className="p-2 hover:bg-bg-card-hover rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil size={18} className="text-text-secondary" />
            </button>
            <button
              onClick={() => onDelete(clip)}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={18} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
