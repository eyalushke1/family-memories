'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CategoryRow } from './category-row'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useProfileStore } from '@/stores/profile-store'
import type { ApiResponse } from '@/types/api'

interface BrowseClip {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  animated_thumbnail_url: string | null
  duration_seconds: number | null
  sort_order: number
}

interface BrowseCategory {
  id: string
  name: string
  slug: string
  clips: BrowseClip[]
}

export function BrowseContent() {
  const router = useRouter()
  const { currentProfile } = useProfileStore()
  const [categories, setCategories] = useState<BrowseCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentProfile) {
      router.push('/')
      return
    }

    async function loadBrowseData() {
      try {
        const res = await fetch('/api/browse')
        const json: ApiResponse<BrowseCategory[]> = await res.json()
        if (json.success && json.data) {
          setCategories(json.data)
        }
      } catch (err) {
        console.error('Failed to load browse data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBrowseData()
  }, [currentProfile, router])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-text-secondary">No clips yet. Add content through the admin panel.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 tv:gap-12">
      {categories.map((category, index) => (
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          <CategoryRow category={category} />
        </motion.div>
      ))}
    </div>
  )
}
