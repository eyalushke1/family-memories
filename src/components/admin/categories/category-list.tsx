'use client'

import { useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { SortableList } from '@/components/admin/shared/sortable-list'
import { SortableItem } from '@/components/admin/shared/sortable-item'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { ConfirmDialog } from '@/components/admin/shared/confirm-dialog'
import { Pencil, Trash2 } from 'lucide-react'
import type { CategoryRow } from '@/types/database'

interface CategoryListProps {
  categories: CategoryRow[]
  onEdit: (category: CategoryRow) => void
}

export function CategoryList({ categories, onEdit }: CategoryListProps) {
  const { reorderCategories, updateCategory, removeCategory, clips } =
    useAdminStore()
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleReorder = async (reordered: CategoryRow[]) => {
    reorderCategories(reordered)

    // Save to server
    await fetch('/api/admin/categories/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((c) => c.id) }),
    })
  }

  const handleToggleActive = async (category: CategoryRow) => {
    const newValue = !category.is_active
    updateCategory(category.id, { is_active: newValue })

    await fetch(`/api/admin/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newValue }),
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        removeCategory(deleteTarget.id)
        setDeleteTarget(null)
      } else {
        alert(data.error || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
    } finally {
      setDeleting(false)
    }
  }

  const getClipCount = (categoryId: string) =>
    clips.filter((c) => c.category_id === categoryId).length

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        No categories yet. Create your first category to organize clips.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <SortableList items={categories} onReorder={handleReorder}>
          {categories.map((category) => (
            <SortableItem key={category.id} id={category.id}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-text-muted">
                    /{category.slug} • {getClipCount(category.id)} clips
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <ToggleSwitch
                    checked={category.is_active}
                    onChange={() => handleToggleActive(category)}
                    label={category.is_active ? 'Active' : 'Archived'}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(category)}
                      className="p-2 hover:bg-bg-card-hover rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={18} className="text-text-secondary" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(category)}
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
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? The category must be empty (no clips) to delete.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
