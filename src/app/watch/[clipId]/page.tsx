'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, SkipForward, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'
import { CastButton } from '@/components/cast/cast-button'
import type { ApiResponse } from '@/types/api'
import type { ClipRow, IntroClipRow } from '@/types/database'

type PlayState = 'loading' | 'intro' | 'transitioning' | 'main' | 'presentation' | 'error'

interface PresentationData {
  id: string
  slideDurationMs: number
  transitionType: 'fade' | 'slide' | 'zoom' | 'blur' | 'wipe' | 'flip' | 'kenburns' | 'dissolve' | 'none' | 'random'
  transitionDurationMs: number
  backgroundMusicUrl?: string | null
  musicFadeOutMs?: number
  muteVideoAudio?: boolean
  slides: {
    id: string
    mediaUrl: string
    mediaType?: 'image' | 'video'
    caption?: string
    durationMs?: number
  }[]
}

export default function WatchPage() {
  const router = useRouter()
  const params = useParams()
  const clipId = params.clipId as string

  // Data state
  const [clip, setClip] = useState<ClipRow | null>(null)
  const [introClip, setIntroClip] = useState<IntroClipRow | null>(null)
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null)
  const [playState, setPlayState] = useState<PlayState>('loading')

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [introReady, setIntroReady] = useState(false)
  const [introFailed, setIntroFailed] = useState(false)

  // Refs
  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const playStateRef = useRef<PlayState>('loading')

  // Keep ref in sync for use in async callbacks
  playStateRef.current = playState

  // Load clip data
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

          if (found.video_path === 'presentation') {
            const presRes = await fetch(`/api/presentations/${clipId}`)
            const presJson: ApiResponse<PresentationData> = await presRes.json()
            if (presJson.success && presJson.data) {
              setPresentationData(presJson.data)
              if (found.intro_clip_id) {
                const introRes = await fetch(`/api/intros/${found.intro_clip_id}`)
                const introJson: ApiResponse<IntroClipRow> = await introRes.json()
                if (introJson.success && introJson.data) {
                  setIntroClip(introJson.data)
                  setPlayState('intro')
                } else {
                  setPlayState('presentation')
                }
              } else {
                setPlayState('presentation')
              }
            } else {
              setPlayState('error')
            }
            return
          }

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

  // === INTRO VIDEO SETUP ===
  useEffect(() => {
    if (playState !== 'intro' || !introClip) return

    const video = introVideoRef.current
    if (!video) return

    const introUrl = `/api/media/files/${introClip.video_path}`

    setIntroReady(false)
    setIntroFailed(false)

    video.muted = true
    video.preload = 'auto'
    video.src = introUrl
    video.load()

    let playAttempted = false

    const tryPlay = async () => {
      if (playAttempted) return
      playAttempted = true

      try {
        video.muted = true
        await video.play()
        setIntroReady(true)

        setTimeout(() => {
          if (video && !video.paused && !video.ended) {
            try {
              video.muted = false
            } catch {
              // Stay muted on mobile
            }
          }
        }, 600)
      } catch (err) {
        console.error('[Player] Intro play failed:', err)
        setIntroFailed(true)
      }
    }

    const onCanPlay = () => tryPlay()
    const onLoadedData = () => tryPlay()
    const onError = () => {
      setIntroFailed(true)
    }

    video.addEventListener('canplaythrough', onCanPlay)
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('error', onError)

    if (video.readyState >= 3) {
      tryPlay()
    }

    const failsafe = setTimeout(() => {
      if (!playAttempted || video.paused) {
        setIntroFailed(true)
      }
    }, 10000)

    return () => {
      clearTimeout(failsafe)
      video.removeEventListener('canplaythrough', onCanPlay)
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('error', onError)
    }
  }, [playState, introClip])

  // Auto-skip failed intro
  useEffect(() => {
    if (!introFailed || playState !== 'intro') return
    const timer = setTimeout(() => {
      if (playStateRef.current === 'intro') {
        handleTransitionToMain()
      }
    }, 1000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introFailed, playState])

  // === TRANSITION FROM INTRO TO MAIN ===
  const handleTransitionToMain = useCallback(() => {
    if (playStateRef.current !== 'intro' && playStateRef.current !== 'transitioning') {
      if (playStateRef.current === 'main' || playStateRef.current === 'presentation') return
    }

    setPlayState('transitioning')

    const introVideo = introVideoRef.current
    if (introVideo) {
      introVideo.pause()
      introVideo.removeAttribute('src')
      introVideo.load()
    }

    if (presentationData) {
      setTimeout(() => setPlayState('presentation'), 300)
      return
    }

    const mainVideo = mainVideoRef.current
    if (mainVideo) {
      mainVideo.preload = 'auto'
      mainVideo.load()

      const startMain = async () => {
        try {
          mainVideo.muted = true
          mainVideo.currentTime = 0
          await mainVideo.play()
          setPlayState('main')

          setTimeout(() => {
            if (mainVideo && !mainVideo.paused) {
              mainVideo.muted = false
            }
          }, 300)
        } catch {
          mainVideo.muted = true
          mainVideo.play().catch(console.error)
          setPlayState('main')
        }
      }

      if (mainVideo.readyState >= 3) {
        startMain()
      } else {
        mainVideo.addEventListener('canplay', startMain, { once: true })
        setTimeout(() => {
          if (playStateRef.current === 'transitioning') {
            startMain()
          }
        }, 5000)
      }
    } else {
      setPlayState('main')
    }
  }, [presentationData])

  // === MAIN VIDEO AUTOPLAY (when no intro) ===
  useEffect(() => {
    if (playState !== 'main' || introClip || !mainVideoRef.current) return

    const video = mainVideoRef.current

    video.preload = 'auto'
    video.load()

    const attemptPlay = async () => {
      try {
        await video.play()
      } catch {
        try {
          video.muted = true
          await video.play()
          setTimeout(() => {
            if (video && !video.paused) {
              video.muted = false
            }
          }, 300)
        } catch {
          // User will use native controls to play
        }
      }
    }

    if (video.readyState >= 3) {
      attemptPlay()
    } else {
      video.addEventListener('canplay', () => attemptPlay(), { once: true })
    }
  }, [playState, introClip])

  // === MAIN VIDEO EVENT HANDLERS ===
  const handleMainWaiting = useCallback(() => {
    setIsBuffering(true)
  }, [])

  const handleMainPlaying = useCallback(() => {
    setIsBuffering(false)
    setVideoError(null)
  }, [])

  const handleMainCanPlayThrough = useCallback(() => {
    setIsBuffering(false)
  }, [])

  const handleMainError = useCallback(() => {
    const video = mainVideoRef.current
    if (video?.error) {
      setVideoError(video.error.message || 'Playback error')
    }
    setIsBuffering(false)
  }, [])

  const handleMainEnded = useCallback(() => {
    router.push('/browse')
  }, [router])

  // Controls auto-hide
  const handleInteraction = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playStateRef.current === 'main') setShowControls(false)
    }, 4000)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      if (introVideoRef.current) {
        introVideoRef.current.pause()
        introVideoRef.current.removeAttribute('src')
        introVideoRef.current.load()
      }
      if (mainVideoRef.current) {
        mainVideoRef.current.pause()
        mainVideoRef.current.removeAttribute('src')
        mainVideoRef.current.load()
      }
    }
  }, [])

  // Keyboard shortcut to skip intro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (playState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleTransitionToMain()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playState, handleTransitionToMain])

  // === RENDER ===

  if (playState === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
    )
  }

  if (playState === 'error' || !clip) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black">
        <p className="text-text-secondary">Clip not found</p>
        <button
          onClick={() => router.push('/browse')}
          className="text-sm text-accent hover:underline cursor-pointer"
        >
          Back to browse
        </button>
      </div>
    )
  }

  if (playState === 'presentation' && presentationData) {
    return <SlideshowPlayer presentationData={presentationData} />
  }

  const introVideoUrl = introClip ? `/api/media/files/${introClip.video_path}` : null
  const mainVideoUrl = clip.video_path !== 'presentation' ? `/api/media/files/${clip.video_path}` : null
  const isPlayingIntro = playState === 'intro'
  const isTransitioning = playState === 'transitioning'
  const showIntroVideo = isPlayingIntro || isTransitioning
  const showMainVideo = playState === 'main' || isTransitioning

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Back button - z-[30] above everything */}
      <AnimatePresence>
        {showControls && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => router.push('/browse')}
            className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-white transition-colors hover:bg-black/70 cursor-pointer"
            style={{ zIndex: 30 }}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cast button - z-[30] */}
      <AnimatePresence>
        {showControls && mainVideoRef.current && playState === 'main' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-4 top-4"
            style={{ zIndex: 30 }}
          >
            <CastButton
              videoRef={mainVideoRef}
              className="bg-black/50 hover:bg-black/70 text-white"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip intro button - z-[30] */}
      <AnimatePresence>
        {isPlayingIntro && showControls && introReady && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={handleTransitionToMain}
            className="absolute right-4 bottom-24 flex items-center gap-2 rounded border border-white/40 bg-black/80 px-5 py-2.5 text-white transition-all hover:bg-white hover:text-black hover:border-white cursor-pointer"
            style={{ zIndex: 30 }}
          >
            <span className="text-sm font-semibold tracking-wide">Skip Intro</span>
            <SkipForward className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Intro loading overlay - z-[25] */}
      {!introReady && !introFailed && isPlayingIntro && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
            <p className="text-sm text-white/70">Loading intro...</p>
          </div>
        </div>
      )}

      {/* Intro error overlay - z-[25] */}
      {introFailed && isPlayingIntro && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-white/50" />
            <p className="text-sm text-white/60">Starting video...</p>
          </div>
        </div>
      )}

      {/* Buffering overlay - z-[20] pointer-events-none */}
      {isBuffering && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 20 }}
        >
          <div className="flex flex-col items-center gap-3 bg-black/40 px-6 py-4 rounded-xl">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="text-sm text-white/70">Buffering...</p>
          </div>
        </div>
      )}

      {/* Video error overlay - z-[25] */}
      {videoError && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4 p-6">
            <p className="text-lg text-red-400">Playback Error</p>
            <p className="text-sm text-white/60 max-w-md text-center">{videoError}</p>
            <button
              onClick={() => {
                setVideoError(null)
                setIsBuffering(true)
                if (mainVideoRef.current) {
                  mainVideoRef.current.load()
                  mainVideoRef.current.play().catch(console.error)
                }
              }}
              className="mt-2 px-5 py-2.5 bg-accent rounded-lg text-sm font-medium hover:bg-accent/80 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/*
        Intro video - z-[10] when visible, z-[1] when hidden.
        src set programmatically in useEffect.
      */}
      {introVideoUrl && (
        <video
          ref={introVideoRef}
          muted
          autoPlay
          playsInline
          preload="auto"
          onEnded={handleTransitionToMain}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{
            opacity: showIntroVideo ? 1 : 0,
            zIndex: showIntroVideo ? 10 : 1,
            pointerEvents: showIntroVideo ? 'auto' : 'none',
          }}
        />
      )}

      {/*
        Main video - z-[10] when visible.
        Uses native browser controls for play/pause, volume, seek, fullscreen.
        preload="none" when intro exists to avoid double-buffering.
      */}
      {mainVideoUrl && (
        <video
          ref={mainVideoRef}
          src={mainVideoUrl}
          controls={showMainVideo}
          playsInline
          preload={introClip ? 'none' : 'auto'}
          onWaiting={handleMainWaiting}
          onPlaying={handleMainPlaying}
          onCanPlayThrough={handleMainCanPlayThrough}
          onError={handleMainError}
          onEnded={handleMainEnded}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{
            opacity: showMainVideo ? 1 : 0,
            zIndex: showMainVideo ? 10 : 1,
            pointerEvents: showMainVideo ? 'auto' : 'none',
          }}
        />
      )}

      {/* Intro badge - z-[15] above video but below buttons */}
      <AnimatePresence>
        {isPlayingIntro && introReady && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-4 bottom-24 rounded bg-white/10 backdrop-blur-sm px-3 py-1.5 border border-white/20"
            style={{ zIndex: 15 }}
          >
            <span className="text-xs text-white/80 uppercase tracking-widest font-medium">
              Intro
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Title overlay - z-[5] BELOW video so it never blocks native controls.
        Only visible during intro (when main video is transparent).
        During main playback, native controls handle everything.
      */}
      <AnimatePresence>
        {showControls && isPlayingIntro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-4 left-16 right-16 pointer-events-none"
            style={{ zIndex: 15 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg text-center">
              {clip.title}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
