'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'
import type { ClipRow } from '@/types/database'

interface ClipPreviewModalProps {
  clip: ClipRow
  onClose: () => void
}

export function ClipPreviewModal({ clip, onClose }: ClipPreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [presentationData, setPresentationData] = useState<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const isPresentation = clip.video_path === 'presentation'

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fetch presentation data if needed
  useEffect(() => {
    if (!isPresentation) {
      setLoading(false)
      return
    }

    async function fetchPresentation() {
      try {
        const res = await fetch(`/api/presentations/${clip.id}`)
        const data = await res.json()
        if (data.success) {
          setPresentationData(data.data)
        } else {
          setError(data.error || 'Failed to load presentation')
        }
      } catch {
        setError('Failed to load presentation')
      } finally {
        setLoading(false)
      }
    }

    fetchPresentation()
  }, [clip.id, isPresentation])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        {/* Title */}
        <div className="absolute -top-12 left-0 text-white font-medium truncate max-w-[80%]">
          {clip.title}
        </div>

        {loading ? (
          <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-white/40" />
          </div>
        ) : error ? (
          <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
            <p className="text-red-400">{error}</p>
          </div>
        ) : isPresentation && presentationData ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <SlideshowPlayer presentationData={presentationData} />
          </div>
        ) : !isPresentation ? (
          <video
            ref={videoRef}
            src={`/api/media/files/${clip.video_path}`}
            controls
            autoPlay
            className="w-full aspect-video bg-black rounded-lg"
            onLoadedData={() => setLoading(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
