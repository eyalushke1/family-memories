'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAdminStore } from '@/stores/admin-store'
import { ClipList } from '@/components/admin/clips/clip-list'
import { ClipForm } from '@/components/admin/clips/clip-form'
import { Select } from '@/components/admin/shared/form-field'
import { Plus, Loader2, RefreshCw } from 'lucide-react'
import type { ClipRow, IntroClipRow, ProfileRow } from '@/types/database'

function ClipsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editClipId = searchParams.get('edit')

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
  const [converting, setConverting] = useState(false)
  const [convertResult, setConvertResult] = useState<string | null>(null)

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

  // Handle edit query param - open the form when clip data is loaded
  useEffect(() => {
    if (editClipId && clips.length > 0 && !showForm) {
      const clipToEdit = clips.find((c) => c.id === editClipId)
      if (clipToEdit) {
        setEditingClip(clipToEdit)
        setShowForm(true)
        // Clear the URL param to prevent reopening on refresh
        router.replace('/admin/clips', { scroll: false })
      }
    }
  }, [editClipId, clips, showForm, router])

  const handleConvertAll = async () => {
    setConverting(true)
    setConvertResult(null)
    try {
      const res = await fetch('/api/admin/convert-clips', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const msg = json.converted > 0
          ? `Converted ${json.converted} clip(s) to MP4${json.failed > 0 ? `, ${json.failed} failed` : ''}`
          : 'All clips are already in MP4 format'
        setConvertResult(msg)
        // Refresh clips list if any were converted
        if (json.converted > 0) {
          const clipsRes = await fetch('/api/admin/clips')
          const clipsData = await clipsRes.json()
          if (clipsData.success) setClips(clipsData.data)
        }
      } else {
        setConvertResult(`Error: ${json.error}`)
      }
    } catch (err) {
      setConvertResult('Failed to run conversion')
    } finally {
      setConverting(false)
      setTimeout(() => setConvertResult(null), 8000)
    }
  }

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
        <div className="flex items-center gap-3">
          <button
            onClick={handleConvertAll}
            disabled={converting}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={converting ? 'animate-spin' : ''} />
            {converting ? 'Converting...' : 'Convert Videos'}
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            Add Clip
          </button>
        </div>
      </div>

      {convertResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          convertResult.startsWith('Error') || convertResult.startsWith('Failed')
            ? 'bg-red-500/20 text-red-300'
            : 'bg-green-500/20 text-green-300'
        }`}>
          {convertResult}
        </div>
      )}

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

export default function ClipsAdminPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    }>
      <ClipsContent />
    </Suspense>
  )
}
