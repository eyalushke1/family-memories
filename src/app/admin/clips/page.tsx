'use client'

import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { ClipList } from '@/components/admin/clips/clip-list'
import { ClipForm } from '@/components/admin/clips/clip-form'
import { Select } from '@/components/admin/shared/form-field'
import { Plus } from 'lucide-react'
import type { ClipRow, IntroClipRow, ProfileRow } from '@/types/database'

export default function ClipsAdminPage() {
  const {
    clips,
    setClips,
    categories,
    setCategories,
    loadingClips,
    setLoadingClips,
  } = useAdminStore()
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingClip, setEditingClip] = useState<ClipRow | null>(null)
  const [introClips, setIntroClips] = useState<IntroClipRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])

  useEffect(() => {
    async function fetchData() {
      setLoadingClips(true)
      try {
        const [clipsRes, categoriesRes, introsRes, profilesRes] = await Promise.all([
          fetch('/api/admin/clips'),
          fetch('/api/admin/categories'),
          fetch('/api/admin/intros'),
          fetch('/api/profiles'),
        ])

        const [clipsData, categoriesData, introsData, profilesData] = await Promise.all([
          clipsRes.json(),
          categoriesRes.json(),
          introsRes.json(),
          profilesRes.json(),
        ])

        if (clipsData.success) {
          setClips(clipsData.data)
        }
        if (categoriesData.success) {
          setCategories(categoriesData.data)
        }
        if (introsData.success) {
          setIntroClips(introsData.data)
        }
        if (profilesData.success) {
          setProfiles(profilesData.data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoadingClips(false)
      }
    }

    fetchData()
  }, [setClips, setCategories, setLoadingClips])

  const handleEdit = (clip: ClipRow) => {
    setEditingClip(clip)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingClip(null)
  }

  const handleNew = () => {
    setEditingClip(null)
    setShowForm(true)
  }

  const filteredClips = selectedCategory
    ? clips.filter((c) => c.category_id === selectedCategory)
    : clips

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Clips</h1>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Clip
        </button>
      </div>

      <div className="mb-6">
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-64"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {!category.is_active && ' (archived)'}
            </option>
          ))}
        </Select>
      </div>

      {loadingClips ? (
        <div className="text-text-secondary">Loading...</div>
      ) : (
        <ClipList
          clips={filteredClips}
          categories={categories}
          selectedCategory={selectedCategory}
          onEdit={handleEdit}
        />
      )}

      {showForm && (
        <ClipForm
          clip={editingClip}
          categories={categories}
          introClips={introClips}
          profiles={profiles}
          defaultCategoryId={selectedCategory}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
