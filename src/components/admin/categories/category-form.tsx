'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAdminStore } from '@/stores/admin-store'
import { FormField, Input } from '@/components/admin/shared/form-field'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { X } from 'lucide-react'
import type { CategoryRow } from '@/types/database'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface CategoryFormProps {
  category: CategoryRow | null
  onClose: () => void
}

export function CategoryForm({ category, onClose }: CategoryFormProps) {
  const { addCategory, updateCategory } = useAdminStore()
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [isActive, setIsActive] = useState(category?.is_active ?? true)
  const [autoSlug, setAutoSlug] = useState(!category)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!category

  useEffect(() => {
    if (autoSlug && name) {
      setSlug(slugify(name))
    }
  }, [name, autoSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!slug.trim()) {
      setError('Slug is required')
      return
    }

    setSaving(true)

    try {
      const url = isEditing
        ? `/api/admin/categories/${category.id}`
        : '/api/admin/categories'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          is_active: isActive,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to save category')
        return
      }

      if (isEditing) {
        updateCategory(category.id, data.data)
      } else {
        addCategory(data.data)
      }

      onClose()
    } catch {
      setError('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
      >
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {isEditing ? 'Edit Category' : 'New Category'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-bg-card rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
              label="Name"
              error={error && !name.trim() ? 'Required' : undefined}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer 2024"
                error={!name.trim() && !!error}
              />
            </FormField>

            <FormField label="Slug">
              <div className="flex items-center gap-2">
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value)
                    setAutoSlug(false)
                  }}
                  placeholder="e.g., summer-2024"
                  className="flex-1"
                />
                {!autoSlug && !isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoSlug(true)
                      setSlug(slugify(name))
                    }}
                    className="text-sm text-accent hover:underline whitespace-nowrap"
                  >
                    Auto
                  </button>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1">
                URL-friendly identifier
              </p>
            </FormField>

            <ToggleSwitch
              checked={isActive}
              onChange={setIsActive}
              label={isActive ? 'Active (visible in browse)' : 'Archived'}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
