'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, SkipForward } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApiResponse } from '@/types/api'
import type { ClipRow, IntroClipRow } from '@/types/database'

type PlayState = 'loading' | 'intro' | 'transitioning' | 'main' | 'error'

export default function WatchPage() {
  const router = useRouter()
  const params = useParams()
  const clipId = params.clipId as string
  const [clip, setClip] = useState<ClipRow | null>(null)
  const [introClip, setIntroClip] = useState<IntroClipRow | null>(null)
  const [playState, setPlayState] = useState<PlayState>('loading')
  const [showControls, setShowControls] = useState(true)
  const [mainVideoReady, setMainVideoReady] = useState(false)

  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function loadClip() {
      try {
        const res = await fetch(`/api/clips?category_id=`)
        const json: ApiResponse<ClipRow[]> = await res.json()
        if (json.success && json.data) {
          const found = json.data.find((c) => c.id === clipId)
          if (!found) {
            setPlayState('error')
            return
          }
          setClip(found)

          if (found.intro_clip_id) {
            const introRes = await fetch(`/api/intros/${found.intro_clip_id}`)
            const introJson: ApiResponse<IntroClipRow> = await introRes.json()
            if (introJson.success && introJson.data) {
              setIntroClip(introJson.data)
              setPlayState('intro')
            } else {
              setPlayState('main')
            }
          } else {
            setPlayState('main')
          }
        } else {
          setPlayState('error')
        }
      } catch (err) {
        console.error('Failed to load clip:', err)
        setPlayState('error')
      }
    }

    loadClip()
  }, [clipId])

  // Preload main video while intro plays
  useEffect(() => {
    if (playState === 'intro' && mainVideoRef.current && clip) {
      mainVideoRef.current.load()
    }
  }, [playState, clip])

  // Handle smooth transition from intro to main
  const transitionToMain = useCallback(() => {
    if (playState !== 'intro') return

    setPlayState('transitioning')

    // Pause intro
    if (introVideoRef.current) {
      introVideoRef.current.pause()
    }

    // Start main video immediately
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
      mainVideoRef.current.play().catch(console.error)
    }

    // Short delay for crossfade effect, then fully switch
    setTimeout(() => {
      setPlayState('main')
    }, 300)
  }, [playState])

  const handleIntroEnded = () => {
    transitionToMain()
  }

  const handleSkipIntro = () => {
    transitionToMain()
  }

  const handleMainVideoReady = () => {
    setMainVideoReady(true)
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Auto-play intro when ready
  useEffect(() => {
    if (playState === 'intro' && introVideoRef.current) {
      introVideoRef.current.play().catch(console.error)
    }
  }, [playState])

  // Auto-play main when no intro
  useEffect(() => {
    if (playState === 'main' && !introClip && mainVideoRef.current) {
      mainVideoRef.current.play().catch(console.error)
    }
  }, [playState, introClip])

  if (playState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  if (playState === 'error' || !clip) {
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

  const introVideoUrl = introClip ? `/api/media/files/${introClip.video_path}` : null
  const mainVideoUrl = `/api/media/files/${clip.video_path}`
  const isPlayingIntro = playState === 'intro'
  const isTransitioning = playState === 'transitioning'
  const showIntroVideo = isPlayingIntro || isTransitioning
  const showMainVideo = playState === 'main' || isTransitioning

  return (
    <motion.div
      className="relative min-h-screen bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onMouseMove={handleMouseMove}
    >
      {/* Back button */}
      <AnimatePresence>
        {showControls && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => router.push('/browse')}
            className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-white transition-colors hover:bg-black/70 focus-ring"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Skip intro button - Netflix style */}
      <AnimatePresence>
        {isPlayingIntro && showControls && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={handleSkipIntro}
            className="absolute right-4 bottom-24 z-20 flex items-center gap-2 rounded border border-white/40 bg-black/80 px-5 py-2.5 text-white transition-all hover:bg-white hover:text-black hover:border-white"
          >
            <span className="text-sm font-semibold tracking-wide">Skip Intro</span>
            <SkipForward className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Video container - both videos stacked */}
      <div className="flex min-h-screen items-center justify-center">
        {/* Intro video layer */}
        {introVideoUrl && (
          <video
            ref={introVideoRef}
            src={introVideoUrl}
            onEnded={handleIntroEnded}
            onCanPlayThrough={handleMainVideoReady}
            playsInline
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{
              opacity: showIntroVideo ? 1 : 0,
              zIndex: isTransitioning ? 5 : 10,
              pointerEvents: showIntroVideo ? 'auto' : 'none',
            }}
          />
        )}

        {/* Main video layer - preloaded during intro */}
        <video
          ref={mainVideoRef}
          src={mainVideoUrl}
          controls={showMainVideo}
          playsInline
          onCanPlayThrough={handleMainVideoReady}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{
            opacity: showMainVideo ? 1 : 0,
            zIndex: showMainVideo ? 10 : 5,
            pointerEvents: showMainVideo ? 'auto' : 'none',
          }}
        />
      </div>

      {/* Intro indicator badge */}
      <AnimatePresence>
        {isPlayingIntro && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-4 bottom-24 z-20 rounded bg-white/10 backdrop-blur-sm px-3 py-1.5 border border-white/20"
          >
            <span className="text-xs text-white/80 uppercase tracking-widest font-medium">
              Intro
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/60 to-transparent pt-20 pb-6 px-6 z-15"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
              {clip.title}
            </h1>
            {clip.description && (
              <p className="mt-2 text-sm md:text-base text-white/70 max-w-2xl">
                {clip.description}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
