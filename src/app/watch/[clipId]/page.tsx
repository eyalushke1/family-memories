'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, SkipForward, Loader2, Play } from 'lucide-react'
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

// MediaError codes for better error messages
const MEDIA_ERROR_MESSAGES: Record<number, string> = {
  1: 'Video loading aborted',
  2: 'Network error while loading video',
  3: 'Video decoding failed',
  4: 'Video format not supported',
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
  const [introSignedUrl, setIntroSignedUrl] = useState<string | null>(null)
  const [mainSignedUrl, setMainSignedUrl] = useState<string | null>(null)

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [introReady, setIntroReady] = useState(false)
  const [introFailed, setIntroFailed] = useState(false)
  const [needsUserPlay, setNeedsUserPlay] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Refs
  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stallCheckRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRef = useRef<number>(0)
  const lastTimeCheckRef = useRef<number>(Date.now())
  const playStateRef = useRef<PlayState>('loading')

  // Keep ref in sync for use in async callbacks
  playStateRef.current = playState

  // Max retries for stall recovery
  const MAX_RETRIES = 3

  // Fetch a signed URL for direct storage access (falls back to proxy URL)
  const fetchSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/media/signed-url/${storagePath}`)
      const json = await res.json()
      if (json.success && json.url) return json.url
    } catch {
      // Signed URL unavailable — will fall back to proxy
    }
    return null
  }, [])

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

          // Fetch signed URL for main video in background
          if (found.video_path && found.video_path !== 'presentation') {
            fetchSignedUrl(found.video_path).then(url => {
              if (url) setMainSignedUrl(url)
            })
          }

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
                  // Fetch signed URL for intro in background
                  fetchSignedUrl(introJson.data.video_path).then(url => {
                    if (url) setIntroSignedUrl(url)
                  })
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
              // Fetch signed URL for intro in background
              fetchSignedUrl(introJson.data.video_path).then(url => {
                if (url) setIntroSignedUrl(url)
              })
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
        console.error('[Player] Failed to load clip:', err)
        setPlayState('error')
      }
    }

    loadClip()
  }, [clipId, fetchSignedUrl])

  // === ROBUST PLAY FUNCTION ===
  // Handles all autoplay policies across browsers
  const attemptPlay = useCallback(async (video: HTMLVideoElement, allowUnmuted = false): Promise<boolean> => {
    // Strategy 1: Try unmuted if allowed (works after user gesture on desktop)
    if (allowUnmuted && !video.muted) {
      try {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          await playPromise
          console.log('[Player] Unmuted play succeeded')
          return true
        }
        return true
      } catch (err) {
        console.log('[Player] Unmuted play failed, trying muted:', (err as Error).name)
      }
    }

    // Strategy 2: Play muted (works on all browsers)
    try {
      video.muted = true
      const playPromise = video.play()
      if (playPromise !== undefined) {
        await playPromise
      }
      console.log('[Player] Muted play succeeded')

      // Strategy 3: Try to unmute after short delay (works on desktop)
      setTimeout(() => {
        if (video && !video.paused && !video.ended) {
          try {
            video.muted = false
            // Browser may synchronously pause when unmuting without user gesture
            if (video.paused) {
              console.log('[Player] Unmute caused pause, re-muting and resuming')
              video.muted = true
              video.play().catch(() => {})
            } else {
              console.log('[Player] Unmuted after playing')
            }
          } catch {
            // Stay muted - mobile browser policy
            video.muted = true
            video.play().catch(() => {})
          }
        }
      }, 500)
      return true
    } catch (err) {
      const error = err as DOMException
      console.error('[Player] Play failed:', error.name, error.message)

      if (error.name === 'NotAllowedError') {
        // Autoplay completely blocked - show play button
        setNeedsUserPlay(true)
        return false
      }
      return false
    }
  }, [])

  // === STALL DETECTION AND RECOVERY ===
  const startStallDetection = useCallback((video: HTMLVideoElement) => {
    // Clear any existing check
    if (stallCheckRef.current) {
      clearInterval(stallCheckRef.current)
    }

    lastTimeRef.current = video.currentTime
    lastTimeCheckRef.current = Date.now()

    // Check every 2 seconds if video is progressing
    stallCheckRef.current = setInterval(() => {
      if (video.paused || video.ended || playStateRef.current !== 'main') {
        return
      }

      const now = Date.now()
      const currentTime = video.currentTime
      const timeDiff = currentTime - lastTimeRef.current
      const realTimeDiff = (now - lastTimeCheckRef.current) / 1000

      // If less than 0.5s of video progress in 2s of real time while not buffering
      if (timeDiff < 0.5 && realTimeDiff >= 2 && !video.seeking) {
        // Check if we have buffered data ahead
        const hasBuffer = video.buffered.length > 0 &&
          video.buffered.end(video.buffered.length - 1) > currentTime + 1

        if (!hasBuffer && video.networkState === HTMLMediaElement.NETWORK_LOADING) {
          // Network is loading but no progress - stall detected
          console.warn('[Player] Stall detected at', currentTime.toFixed(1), 's')
          setIsBuffering(true)

          if (retryCount < MAX_RETRIES) {
            // Recovery: reload from current position
            setTimeout(() => {
              if (video && !video.paused && playStateRef.current === 'main') {
                console.log('[Player] Attempting stall recovery, attempt', retryCount + 1)
                const savedTime = video.currentTime
                video.load()
                video.currentTime = savedTime
                video.play().catch(() => {
                  setVideoError('Playback stalled. Please try again.')
                })
                setRetryCount(prev => prev + 1)
              }
            }, 1000)
          } else {
            setVideoError('Video playback is having issues. Please check your connection.')
          }
        }
      }

      lastTimeRef.current = currentTime
      lastTimeCheckRef.current = now
    }, 2000)
  }, [retryCount])

  // === INTRO VIDEO SETUP ===
  useEffect(() => {
    if (playState !== 'intro' || !introClip) return

    const video = introVideoRef.current
    if (!video) return

    // Use signed URL for direct Zadara access, fall back to proxy
    const introUrl = introSignedUrl || `/api/media/files/${introClip.video_path}`
    const loadStart = Date.now()
    console.log('[Player] Setting up intro:', introSignedUrl ? 'direct' : 'proxy')

    setIntroReady(false)
    setIntroFailed(false)

    // Configure video element
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = introUrl
    video.load()

    let playAttempted = false
    let hasAnyData = false

    const tryPlay = async () => {
      if (playAttempted) return
      playAttempted = true

      const elapsed = Date.now() - loadStart
      console.log('[Player] Intro ready, readyState:', video.readyState, `(${elapsed}ms)`)
      const success = await attemptPlay(video)

      if (success) {
        setIntroReady(true)
        // Start preloading main video now that intro is playing
        const mainVideo = mainVideoRef.current
        if (mainVideo && mainVideo.preload !== 'auto') {
          console.log('[Player] Preloading main video in background')
          mainVideo.preload = 'metadata'
        }
      } else {
        setIntroFailed(true)
      }
    }

    const onCanPlayThrough = () => {
      const elapsed = Date.now() - loadStart
      console.log(`[Player] Intro canplaythrough (${elapsed}ms)`)
      tryPlay()
    }

    // Try playing as soon as we have enough data (readyState >= 3 = HAVE_FUTURE_DATA)
    const onCanPlay = () => {
      const elapsed = Date.now() - loadStart
      console.log(`[Player] Intro canplay (${elapsed}ms)`)
      tryPlay()
    }

    const onLoadedData = () => {
      hasAnyData = true
      const elapsed = Date.now() - loadStart
      console.log(`[Player] Intro loadeddata (${elapsed}ms), readyState:`, video.readyState)
      // Try playing immediately — don't wait for canplaythrough on slow networks
      if (video.readyState >= 3) {
        tryPlay()
      }
    }

    const onProgress = () => {
      hasAnyData = true
    }

    const onError = () => {
      const error = video.error
      if (error?.message?.includes('Empty src')) {
        console.log('[Player] Intro cleanup (expected)')
        return
      }
      console.error('[Player] Intro error:', error?.code, error?.message)
      setIntroFailed(true)
    }

    const onStalled = () => {
      const elapsed = Date.now() - loadStart
      console.warn(`[Player] Intro stalled (${elapsed}ms)`)
    }

    video.addEventListener('canplaythrough', onCanPlayThrough)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('progress', onProgress)
    video.addEventListener('error', onError)
    video.addEventListener('stalled', onStalled)

    // If already cached/ready
    if (video.readyState >= 3) {
      tryPlay()
    }

    // Smart failsafe: skip quickly if no data arrives, wait longer if loading
    const earlyFailsafe = setTimeout(() => {
      if (!hasAnyData && !playAttempted) {
        console.warn('[Player] Intro early failsafe — no data after 3s, skipping')
        setIntroFailed(true)
      }
    }, 3000)

    const lateFailsafe = setTimeout(() => {
      if (!playAttempted || video.paused) {
        const elapsed = Date.now() - loadStart
        console.warn(`[Player] Intro late failsafe triggered (${elapsed}ms)`)
        setIntroFailed(true)
      }
    }, 10000)

    return () => {
      clearTimeout(earlyFailsafe)
      clearTimeout(lateFailsafe)
      video.removeEventListener('canplaythrough', onCanPlayThrough)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('error', onError)
      video.removeEventListener('stalled', onStalled)
    }
  }, [playState, introClip, introSignedUrl, attemptPlay])

  // Auto-skip failed intro — transition immediately, no extra delay
  useEffect(() => {
    if (!introFailed || playState !== 'intro') return
    console.log('[Player] Intro failed, transitioning to main')
    handleTransitionToMain()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introFailed, playState])

  // === TRANSITION FROM INTRO TO MAIN ===
  const handleTransitionToMain = useCallback(() => {
    if (playStateRef.current !== 'intro' && playStateRef.current !== 'transitioning') {
      if (playStateRef.current === 'main' || playStateRef.current === 'presentation') return
    }

    const transitionStart = Date.now()
    console.log('[Player] Transitioning from intro to main')
    setPlayState('transitioning')
    setRetryCount(0)
    // Don't show buffering spinner during transition — show a clean loading state instead
    setIsBuffering(false)

    // Cleanup intro video properly (MDN best practice)
    const introVideo = introVideoRef.current
    if (introVideo) {
      introVideo.pause()
      introVideo.src = ''
      introVideo.load()
    }

    if (presentationData) {
      setTimeout(() => setPlayState('presentation'), 300)
      return
    }

    const mainVideo = mainVideoRef.current
    if (mainVideo) {
      // Start loading main video aggressively
      mainVideo.preload = 'auto'

      // Only call load() if src is not already set or video has no data
      if (mainVideo.readyState < 2) {
        mainVideo.load()
      }

      const startMain = async () => {
        const elapsed = Date.now() - transitionStart
        console.log(`[Player] Starting main video playback (transition took ${elapsed}ms)`)
        setPlayState('main')
        // Only show buffering if we had to wait for data
        if (elapsed > 1000) {
          setIsBuffering(true)
        }

        const success = await attemptPlay(mainVideo)
        console.log('[Player] Main play result:', success)

        if (success) {
          // Clear buffering once video actually progresses
          const checkPlaying = () => {
            if (mainVideo && !mainVideo.paused && mainVideo.currentTime > 0) {
              setIsBuffering(false)
            } else {
              setTimeout(checkPlaying, 300)
            }
          }
          setTimeout(checkPlaying, 300)
          startStallDetection(mainVideo)
        } else {
          setIsBuffering(false)
        }
      }

      // Wait for video to be ready, but don't wait forever
      if (mainVideo.readyState >= 2) {
        startMain()
      } else {
        const onReady = () => {
          mainVideo.removeEventListener('loadeddata', onReady)
          mainVideo.removeEventListener('canplay', onReady)
          clearTimeout(failsafeTimer)
          const elapsed = Date.now() - transitionStart
          console.log(`[Player] Main video ready (${elapsed}ms), readyState:`, mainVideo.readyState)
          startMain()
        }
        mainVideo.addEventListener('loadeddata', onReady)
        mainVideo.addEventListener('canplay', onReady)

        // Show buffering after 2s of waiting (not immediately)
        const bufferTimer = setTimeout(() => {
          if (playStateRef.current === 'transitioning') {
            setIsBuffering(true)
          }
        }, 2000)

        // Failsafe: try to play anyway after 6s
        const failsafeTimer = setTimeout(() => {
          clearTimeout(bufferTimer)
          if (playStateRef.current === 'transitioning') {
            console.warn('[Player] Main video canplay timeout, attempting play anyway')
            mainVideo.removeEventListener('loadeddata', onReady)
            mainVideo.removeEventListener('canplay', onReady)
            startMain()
          }
        }, 6000)
      }
    } else {
      setPlayState('main')
    }
  }, [presentationData, attemptPlay, startStallDetection])

  // === MAIN VIDEO AUTOPLAY (when no intro) ===
  useEffect(() => {
    if (playState !== 'main' || introClip || !mainVideoRef.current) return

    const video = mainVideoRef.current
    const loadStart = Date.now()
    console.log('[Player] Starting main video (no intro), readyState:', video.readyState)

    // Clear any stuck buffering state
    setIsBuffering(true)
    setNeedsUserPlay(false)

    const startPlayback = async () => {
      const elapsed = Date.now() - loadStart
      console.log(`[Player] Starting playback (${elapsed}ms), readyState:`, video.readyState)

      // Try unmuted first (may work if user clicked to get here)
      const success = await attemptPlay(video, true)
      console.log('[Player] attemptPlay result:', success)

      if (success) {
        // Clear buffering once video actually progresses
        const checkPlaying = () => {
          if (video && !video.paused && video.currentTime > 0) {
            setIsBuffering(false)
          } else {
            setTimeout(checkPlaying, 300)
          }
        }
        setTimeout(checkPlaying, 300)
        startStallDetection(video)
      } else {
        setIsBuffering(false)
      }
    }

    // Force reload to ensure clean state
    if (video.src && video.readyState >= 2) {
      // Video already has some data
      startPlayback()
    } else {
      // Need to load first
      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay)
        startPlayback()
      }
      video.addEventListener('canplay', onCanPlay)

      // Failsafe: try to play anyway after 5s
      const failsafe = setTimeout(() => {
        video.removeEventListener('canplay', onCanPlay)
        if (playStateRef.current === 'main' && video.paused) {
          console.warn('[Player] Failsafe triggered, attempting play')
          startPlayback()
        }
      }, 5000)

      return () => {
        clearTimeout(failsafe)
        video.removeEventListener('canplay', onCanPlay)
      }
    }
  }, [playState, introClip, attemptPlay, startStallDetection])

  // === USER-INITIATED PLAY ===
  const handleUserPlay = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return

    setNeedsUserPlay(false)
    setIsBuffering(true)

    video.play()
      .then(() => {
        setIsBuffering(false)
        startStallDetection(video)
      })
      .catch((err) => {
        console.error('[Player] User play failed:', err)
        setVideoError('Unable to play video')
        setIsBuffering(false)
      })
  }, [startStallDetection])

  // === MAIN VIDEO EVENT HANDLERS ===
  const handleMainWaiting = useCallback(() => {
    console.log('[Player] Video waiting/buffering')
    // Only show buffering if video has been playing
    const video = mainVideoRef.current
    if (video && video.currentTime > 0) {
      setIsBuffering(true)
    }
  }, [])

  const handleMainPlaying = useCallback(() => {
    console.log('[Player] Video playing')
    setIsBuffering(false)
    setVideoError(null)
    setNeedsUserPlay(false)
  }, [])

  const handleMainCanPlayThrough = useCallback(() => {
    console.log('[Player] Video canplaythrough')
    setIsBuffering(false)
  }, [])

  const handleMainTimeUpdate = useCallback(() => {
    // If video is progressing, definitely not buffering
    const video = mainVideoRef.current
    if (video && video.currentTime > 0 && !video.paused) {
      setIsBuffering(false)
    }
  }, [])

  const handleMainProgress = useCallback(() => {
    // Reset retry count on successful progress
    if (retryCount > 0) {
      const video = mainVideoRef.current
      if (video && video.buffered.length > 0) {
        setRetryCount(0)
      }
    }
  }, [retryCount])

  const handleMainError = useCallback(() => {
    const video = mainVideoRef.current
    if (video?.error) {
      const errorCode = video.error.code
      const errorMessage = MEDIA_ERROR_MESSAGES[errorCode] || video.error.message || 'Unknown playback error'
      console.error('[Player] Video error:', errorCode, errorMessage)
      setVideoError(errorMessage)
    }
    setIsBuffering(false)
  }, [])

  const handleMainEnded = useCallback(() => {
    console.log('[Player] Video ended')
    router.push('/browse')
  }, [router])

  const handleMainStalled = useCallback(() => {
    console.warn('[Player] Video stalled event')
    // Don't immediately show buffering - let stall detection handle it
  }, [])

  // === RETRY HANDLER ===
  const handleRetry = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return

    console.log('[Player] User-initiated retry')
    setVideoError(null)
    setIsBuffering(true)
    setRetryCount(0)

    const currentTime = video.currentTime

    // Full reload
    video.src = video.src
    video.load()

    video.addEventListener('canplay', () => {
      video.currentTime = currentTime
      video.play().catch(() => {
        setVideoError('Playback failed. Please try again.')
        setIsBuffering(false)
      })
    }, { once: true })
  }, [])

  // Controls auto-hide
  const handleInteraction = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playStateRef.current === 'main' && !needsUserPlay) {
        setShowControls(false)
      }
    }, 4000)
  }, [needsUserPlay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      if (stallCheckRef.current) clearInterval(stallCheckRef.current)

      // Proper cleanup (MDN best practice)
      if (introVideoRef.current) {
        introVideoRef.current.pause()
        introVideoRef.current.src = ''
        introVideoRef.current.load()
      }
      if (mainVideoRef.current) {
        mainVideoRef.current.pause()
        mainVideoRef.current.src = ''
        mainVideoRef.current.load()
      }
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (playState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleTransitionToMain()
      }
      if (playState === 'main' && needsUserPlay && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleUserPlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playState, handleTransitionToMain, needsUserPlay, handleUserPlay])

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

  // Use signed URLs for direct storage access, fall back to proxy
  const introVideoUrl = introClip
    ? (introSignedUrl || `/api/media/files/${introClip.video_path}`)
    : null
  const mainVideoUrl = clip.video_path !== 'presentation'
    ? (mainSignedUrl || `/api/media/files/${clip.video_path}`)
    : null
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
      onClick={handleInteraction}
    >
      {/* Back button */}
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

      {/* Cast button */}
      <AnimatePresence>
        {showControls && mainVideoRef.current && playState === 'main' && !needsUserPlay && (
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

      {/* Skip intro button */}
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

      {/* Loading overlay — shown during intro load, intro failure, and transition */}
      {((isPlayingIntro && !introReady) || isTransitioning) && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
            <p className="text-sm text-white/70">
              {isTransitioning ? 'Starting video...' : 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {/* User play required overlay (autoplay blocked) */}
      {needsUserPlay && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/60"
          style={{ zIndex: 25 }}
        >
          <button
            onClick={handleUserPlay}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
          >
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="h-10 w-10 text-white ml-1" />
            </div>
            <p className="text-white font-medium">Tap to play</p>
          </button>
        </div>
      )}

      {/* Buffering overlay */}
      {isBuffering && playState === 'main' && !needsUserPlay && (
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

      {/* Video error overlay */}
      {videoError && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4 p-6 max-w-sm">
            <p className="text-lg text-red-400">Playback Error</p>
            <p className="text-sm text-white/60 text-center">{videoError}</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-accent rounded-lg text-sm font-medium hover:bg-accent/80 transition-colors cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={() => router.push('/browse')}
                className="px-5 py-2.5 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors cursor-pointer"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro video */}
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

      {/* Main video with native controls */}
      {mainVideoUrl && (
        <video
          ref={mainVideoRef}
          src={mainVideoUrl}
          controls={showMainVideo && !needsUserPlay}
          controlsList="nodownload"
          playsInline
          preload={introClip ? 'none' : 'metadata'}
          onWaiting={handleMainWaiting}
          onPlaying={handleMainPlaying}
          onCanPlayThrough={handleMainCanPlayThrough}
          onTimeUpdate={handleMainTimeUpdate}
          onProgress={handleMainProgress}
          onError={handleMainError}
          onEnded={handleMainEnded}
          onStalled={handleMainStalled}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{
            opacity: showMainVideo ? 1 : 0,
            zIndex: showMainVideo ? 10 : 1,
            pointerEvents: showMainVideo ? 'auto' : 'none',
          }}
        />
      )}

      {/* Intro badge */}
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

      {/* Title during intro */}
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
