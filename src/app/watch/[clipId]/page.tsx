'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ApiResponse } from '@/types/api'
import type { ClipRow } from '@/types/database'

export default function WatchPage() {
  const router = useRouter()
  const params = useParams()
  const clipId = params.clipId as string
  const [clip, setClip] = useState<ClipRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClip() {
      try {
        const res = await fetch(`/api/clips?category_id=`)
        const json: ApiResponse<ClipRow[]> = await res.json()
        if (json.success && json.data) {
          const found = json.data.find((c) => c.id === clipId)
          setClip(found ?? null)
        }
      } catch (err) {
        console.error('Failed to load clip:', err)
      } finally {
        setLoading(false)
      }
    }

    loadClip()
  }, [clipId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  if (!clip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black">
        <p className="text-text-secondary">Clip not found</p>
        <button
          onClick={() => router.push('/browse')}
          className="text-sm text-accent hover:underline"
        >
          Back to browse
        </button>
      </div>
    )
  }

  const videoUrl = `/api/media/files/${clip.video_path}`

  return (
    <motion.div
      className="relative min-h-screen bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back button */}
      <button
        onClick={() => router.push('/browse')}
        className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-white transition-colors hover:bg-black/70 focus-ring"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Back</span>
      </button>

      {/* Video player */}
      <div className="flex min-h-screen items-center justify-center">
        <video
          src={videoUrl}
          controls
          autoPlay
          className="max-h-screen w-full"
          style={{ maxWidth: '100vw' }}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <h1 className="text-2xl font-bold text-white">{clip.title}</h1>
        {clip.description && (
          <p className="mt-1 text-sm text-text-secondary">{clip.description}</p>
        )}
      </div>
    </motion.div>
  )
}
