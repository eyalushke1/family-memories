'use client'

import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { CategoryList } from '@/components/admin/categories/category-list'
import { CategoryForm } from '@/components/admin/categories/category-form'
import { Plus } from 'lucide-react'
import type { CategoryRow } from '@/types/database'

export default function CategoriesAdminPage() {
  const {
    categories,
    setCategories,
    setLoadingCategories,
    loadingCategories,
  } = useAdminStore()
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(
    null
  )

  useEffect(() => {
    async function fetchCategories() {
      setLoadingCategories(true)
      try {
        const res = await fetch('/api/admin/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [setCategories, setLoadingCategories])

  const handleEdit = (category: CategoryRow) => {
    setEditingCategory(category)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingCategory(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Categories</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Category
        </button>
      </div>

      {loadingCategories ? (
        <div className="text-text-secondary">Loading...</div>
      ) : (
        <CategoryList categories={categories} onEdit={handleEdit} />
      )}

      {showForm && (
        <CategoryForm category={editingCategory} onClose={handleClose} />
      )}
    </div>
  )
}
