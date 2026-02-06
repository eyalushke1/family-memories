'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Loader2,
  Maximize,
  Minimize,
} from 'lucide-react'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'
import { useTVNavigation } from '@/components/tv/tv-navigation-context'
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

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function TVWatchPage() {
  const router = useRouter()
  const params = useParams()
  const clipId = params.clipId as string
  const containerRef = useRef<HTMLDivElement>(null)

  // Data state
  const [clip, setClip] = useState<ClipRow | null>(null)
  const [introClip, setIntroClip] = useState<IntroClipRow | null>(null)
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null)
  const [playState, setPlayState] = useState<PlayState>('loading')
  const [introSignedUrl, setIntroSignedUrl] = useState<string | null>(null)
  const [mainSignedUrl, setMainSignedUrl] = useState<string | null>(null)

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Intro state
  const [introReady, setIntroReady] = useState(false)
  const [introFailed, setIntroFailed] = useState(false)

  // Refs
  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const stallCheckRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRef = useRef<number>(0)
  const playStateRef = useRef<PlayState>('loading')
  const bufferDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const { goBack } = useTVNavigation()

  // Keep ref in sync with state for use in callbacks
  playStateRef.current = playState

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

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
        console.error('Failed to load clip:', err)
        setPlayState('error')
      }
    }

    loadClip()
  }, [clipId, fetchSignedUrl])

  // Show controls temporarily
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playStateRef.current === 'main') setShowControls(false)
    }, 5000)
  }, [])

  // === INTRO VIDEO SETUP ===
  // LG WebOS best practice: set src programmatically, then call load(), then play() muted
  useEffect(() => {
    if (playState !== 'intro' || !introClip) return

    const video = introVideoRef.current
    if (!video) return

    // Use signed URL for direct Zadara access, fall back to proxy
    const introUrl = introSignedUrl || `/api/media/files/${introClip.video_path}`
    const loadStart = Date.now()
    console.log('[TV] Setting up intro:', introSignedUrl ? 'direct' : 'proxy')

    // Reset state
    setIntroReady(false)
    setIntroFailed(false)

    // Configure for LG TV autoplay
    video.muted = true
    video.volume = 1
    video.preload = 'auto'

    // Set source and explicitly load (LG WebOS requires explicit load() call)
    video.src = introUrl
    video.load()

    let playAttempted = false
    let hasAnyData = false

    const tryPlay = async () => {
      if (playAttempted) return
      playAttempted = true

      const elapsed = Date.now() - loadStart
      console.log(`[TV] Intro ready (${elapsed}ms), attempting muted play, readyState:`, video.readyState)
      try {
        video.muted = true
        await video.play()
        console.log('[TV] Intro playing (muted)')
        setIsMuted(true)
        setIntroReady(true)
      } catch (err) {
        console.error('[TV] Intro play failed:', err)
        setIntroFailed(true)
      }
    }

    const onCanPlay = () => {
      const elapsed = Date.now() - loadStart
      console.log(`[TV] Intro canplay (${elapsed}ms)`)
      tryPlay()
    }
    const onLoadedData = () => {
      hasAnyData = true
      const elapsed = Date.now() - loadStart
      console.log(`[TV] Intro loadeddata (${elapsed}ms)`)
      tryPlay()
    }
    const onProgress = () => {
      hasAnyData = true
    }
    const onError = () => {
      const error = video.error
      if (error?.message?.includes('Empty src')) return
      console.error('[TV] Intro load error:', error?.code, error?.message)
      setIntroFailed(true)
    }
    const onStalled = () => {
      const elapsed = Date.now() - loadStart
      console.warn(`[TV] Intro stalled (${elapsed}ms)`)
    }

    video.addEventListener('canplaythrough', onCanPlay)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('progress', onProgress)
    video.addEventListener('error', onError)
    video.addEventListener('stalled', onStalled)

    // If already loaded (cached), try immediately
    if (video.readyState >= 3) {
      tryPlay()
    }

    // Smart failsafe: skip quickly if no data, wait longer if loading
    const earlyFailsafe = setTimeout(() => {
      if (!hasAnyData && !playAttempted) {
        console.warn('[TV] Intro early failsafe — no data after 4s, skipping')
        setIntroFailed(true)
      }
    }, 4000)

    const lateFailsafe = setTimeout(() => {
      if (!playAttempted || video.paused) {
        const elapsed = Date.now() - loadStart
        console.warn(`[TV] Intro late failsafe triggered (${elapsed}ms)`)
        setIntroFailed(true)
      }
    }, 12000)

    return () => {
      clearTimeout(earlyFailsafe)
      clearTimeout(lateFailsafe)
      video.removeEventListener('canplaythrough', onCanPlay)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('error', onError)
      video.removeEventListener('stalled', onStalled)
    }
  }, [playState, introClip, introSignedUrl])

  // Auto-skip intro on failure — immediate transition
  useEffect(() => {
    if (!introFailed || playState !== 'intro') return
    console.log('[TV] Intro failed, transitioning to main')
    handleTransitionToMain()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introFailed, playState])

  // === TRANSITION FROM INTRO TO MAIN ===
  const handleTransitionToMain = useCallback(() => {
    if (playStateRef.current !== 'intro' && playStateRef.current !== 'transitioning') {
      // Already transitioned
      if (playStateRef.current === 'main' || playStateRef.current === 'presentation') return
    }

    const transitionStart = Date.now()
    console.log('[TV] Transitioning from intro to main')
    setPlayState('transitioning')
    setIsBuffering(true)

    // Stop and release intro video resources (critical for LG TV — single decoder)
    const introVideo = introVideoRef.current
    if (introVideo) {
      introVideo.pause()
      introVideo.removeAttribute('src')
      introVideo.load() // Forces release of video decoder resources
      console.log('[TV] Intro decoder released')
    }

    if (presentationData) {
      setTimeout(() => setPlayState('presentation'), 300)
      return
    }

    // Wait for decoder to fully release before starting main video
    // WebOS needs a frame to release the hardware decoder
    setTimeout(() => {
      const mainVideo = mainVideoRef.current
      if (!mainVideo) {
        setPlayState('main')
        return
      }

      // React already set src via JSX (playState !== 'intro' now)
      // DON'T call load() — it destroys buffer on WebOS
      mainVideo.preload = 'auto'

      const startMain = async () => {
        const elapsed = Date.now() - transitionStart
        console.log(`[TV] Starting main video (transition took ${elapsed}ms)`)
        try {
          mainVideo.muted = true
          await mainVideo.play()
          console.log('[TV] Main video playing (muted)')
          setIsPlaying(true)
          setIsMuted(true)
          setPlayState('main')
          setIsBuffering(false)
        } catch (err) {
          console.error('[TV] Main video play failed:', err)
          try {
            mainVideo.muted = true
            await mainVideo.play()
            setIsPlaying(true)
            setIsMuted(true)
          } catch (err2) {
            console.error('[TV] Main video completely failed:', err2)
          }
          setPlayState('main')
          setIsBuffering(false)
        }
      }

      // Wait for main video to be ready
      if (mainVideo.readyState >= 3) {
        startMain()
      } else {
        const onReady = () => {
          mainVideo.removeEventListener('canplay', onReady)
          mainVideo.removeEventListener('loadeddata', onReady)
          clearTimeout(failsafeTimer)
          const elapsed = Date.now() - transitionStart
          console.log(`[TV] Main video ready (${elapsed}ms), readyState:`, mainVideo.readyState)
          startMain()
        }
        mainVideo.addEventListener('canplay', onReady)
        mainVideo.addEventListener('loadeddata', onReady)

        // Failsafe: don't wait forever
        const failsafeTimer = setTimeout(() => {
          if (playStateRef.current === 'transitioning') {
            console.warn('[TV] Main video canplay timeout, forcing start')
            mainVideo.removeEventListener('canplay', onReady)
            mainVideo.removeEventListener('loadeddata', onReady)
            startMain()
          }
        }, 8000)
      }
    }, 100) // 100ms delay for decoder release
  }, [presentationData])

  // === MAIN VIDEO AUTOPLAY (when no intro) ===
  useEffect(() => {
    if (playState !== 'main' || introClip || !mainVideoRef.current) return

    const video = mainVideoRef.current
    console.log('[TV] Starting main video (no intro), readyState:', video.readyState)

    // Don't call video.load() — src is already set via JSX, let browser handle loading
    video.preload = 'auto'

    const attemptPlay = async () => {
      try {
        video.muted = true
        await video.play()
        console.log('[TV] Main video playing (muted, no intro)')
        setIsPlaying(true)
        setIsMuted(true)
        // Unmute button will appear — user must tap to unmute (user gesture required)
      } catch (err) {
        console.warn('[TV] Main autoplay failed:', err)
        try {
          video.muted = true
          setIsMuted(true)
          await video.play()
          setIsPlaying(true)
        } catch (err2) {
          console.error('[TV] Main video failed completely:', err2)
          setIsPlaying(false)
        }
      }
    }

    if (video.readyState >= 3) {
      attemptPlay()
    } else {
      video.addEventListener('canplay', () => attemptPlay(), { once: true })
    }
  }, [playState, introClip])

  // === STALL DETECTION (LG TV — no seeks, just pause/play) ===
  // Shaka Player team confirmed that seeks (even small ones) flush the buffer on WebOS,
  // causing infinite stall→seek→buffer-flush→stall loops.
  useEffect(() => {
    if (playState !== 'main' || !mainVideoRef.current) return

    const video = mainVideoRef.current
    lastTimeRef.current = video.currentTime
    let recoveryAttempts = 0

    // Check every 5 seconds if time is progressing (longer interval for slow connections)
    stallCheckRef.current = setInterval(() => {
      if (video.paused || video.ended) return

      const now = video.currentTime
      const diff = now - lastTimeRef.current

      if (diff > 0.3) {
        // Video is progressing — reset recovery counter
        recoveryAttempts = 0
        setIsBuffering(false)
      } else if (now < (video.duration || Infinity) - 2) {
        // Stalled — show buffering but DON'T seek (it destroys buffer on WebOS)
        console.warn('[TV] Stall detected at', now.toFixed(1), 's, recovery attempt', recoveryAttempts + 1)
        setIsBuffering(true)

        if (recoveryAttempts < 3) {
          recoveryAttempts++
          // Gentle recovery: pause then play (no seek!) — gives decoder time to catch up
          video.pause()
          setTimeout(() => {
            if (video && playStateRef.current === 'main') {
              video.play().catch(() => {})
            }
          }, 500)
        }
        // After 3 attempts, just show buffering and let the browser handle it
      }

      lastTimeRef.current = now
    }, 5000)

    return () => {
      if (stallCheckRef.current) clearInterval(stallCheckRef.current)
    }
  }, [playState])

  // === CLEANUP ON UNMOUNT ===
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      if (stallCheckRef.current) clearInterval(stallCheckRef.current)
      if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current)

      // Release video resources on unmount
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

  // === VIDEO EVENT HANDLERS ===
  const handleTimeUpdate = useCallback(() => {
    const video = mainVideoRef.current
    if (video) {
      setCurrentTime(video.currentTime)
      lastTimeRef.current = video.currentTime
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = mainVideoRef.current
    if (video && video.duration && isFinite(video.duration)) {
      console.log('[TV] Main video duration:', video.duration)
      setDuration(video.duration)
    }
  }, [])

  const handleProgress = useCallback(() => {
    const video = mainVideoRef.current
    if (video && video.buffered.length > 0 && video.duration) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      setBufferedPercent((bufferedEnd / video.duration) * 100)
    }
  }, [])

  const handleWaiting = useCallback(() => {
    // Debounce: only show buffering if stalled for 2+ seconds
    // LG WebOS fires 'waiting' frequently during normal playback
    if (bufferDebounceRef.current) clearTimeout(bufferDebounceRef.current)
    bufferDebounceRef.current = setTimeout(() => {
      setIsBuffering(true)
    }, 2000)
  }, [])

  const handlePlaying = useCallback(() => {
    // Cancel any pending buffering indicator
    if (bufferDebounceRef.current) {
      clearTimeout(bufferDebounceRef.current)
      bufferDebounceRef.current = null
    }
    setIsBuffering(false)
    setIsPlaying(true)
    setVideoError(null)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleCanPlayThrough = useCallback(() => {
    if (bufferDebounceRef.current) {
      clearTimeout(bufferDebounceRef.current)
      bufferDebounceRef.current = null
    }
    setIsBuffering(false)
  }, [])

  const handleError = useCallback(() => {
    const video = mainVideoRef.current
    if (video?.error) {
      console.error('[TV] Video error:', video.error.code, video.error.message)
      setVideoError(video.error.message || 'Playback error')
    }
    setIsBuffering(false)
  }, [])

  const handleEnded = useCallback(() => {
    const video = mainVideoRef.current
    if (video) {
      const percentPlayed = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0
      console.log(`[TV] Video ended at ${percentPlayed.toFixed(1)}%`)

      // If ended prematurely (before 85%), try to continue from current position
      if (percentPlayed < 85 && video.duration > 0) {
        console.warn('[TV] Premature end, attempting recovery')
        setIsBuffering(true)
        const resumeAt = Math.min(video.currentTime + 0.5, video.duration - 0.5)
        video.currentTime = resumeAt
        video.play().catch((err) => {
          console.error('[TV] Recovery failed:', err)
          setIsBuffering(false)
          goBack()
        })
      } else {
        goBack()
      }
    }
  }, [goBack])

  // === CONTROL FUNCTIONS ===
  const togglePlayPause = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch(console.error)
    }
    showControlsTemporarily()
  }, [isPlaying, showControlsTemporarily])

  const toggleMute = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
    showControlsTemporarily()
  }, [isMuted, showControlsTemporarily])

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = mainVideoRef.current
    if (!video) return
    video.volume = newVolume
    setVolume(newVolume)
    if (newVolume === 0) {
      video.muted = true
      setIsMuted(true)
    } else if (isMuted) {
      video.muted = false
      setIsMuted(false)
    }
    showControlsTemporarily()
  }, [isMuted, showControlsTemporarily])

  const skipBackward = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime - 15)
    showControlsTemporarily()
  }, [showControlsTemporarily])

  const skipForward = useCallback(() => {
    const video = mainVideoRef.current
    if (!video) return
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 15)
    showControlsTemporarily()
  }, [showControlsTemporarily])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = mainVideoRef.current
    const progressBar = progressRef.current
    if (!video || !progressBar || !duration) return
    const rect = progressBar.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    video.currentTime = percent * duration
    showControlsTemporarily()
  }, [duration, showControlsTemporarily])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
    showControlsTemporarily()
  }, [showControlsTemporarily])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // === KEYBOARD CONTROLS ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      showControlsTemporarily()

      if (playState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        handleTransitionToMain()
        return
      }

      if (playState === 'main') {
        switch (e.key) {
          case ' ':
          case 'k':
          case 'Enter':
            e.preventDefault()
            togglePlayPause()
            break
          case 'm':
            toggleMute()
            break
          case 'ArrowLeft':
            e.preventDefault()
            skipBackward()
            break
          case 'ArrowRight':
            e.preventDefault()
            skipForward()
            break
          case 'ArrowUp':
            e.preventDefault()
            handleVolumeChange(Math.min(1, volume + 0.1))
            break
          case 'ArrowDown':
            e.preventDefault()
            handleVolumeChange(Math.max(0, volume - 0.1))
            break
          case 'f':
            toggleFullscreen()
            break
          case 'Escape':
            if (isFullscreen) {
              document.exitFullscreen().catch(console.error)
            } else {
              goBack()
            }
            break
          case 'Backspace':
            e.preventDefault()
            goBack()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playState, isPlaying, isFullscreen, volume, showControlsTemporarily, togglePlayPause, toggleMute, skipBackward, skipForward, toggleFullscreen, handleVolumeChange, goBack, handleTransitionToMain])

  // === RENDER ===

  if (playState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
      </div>
    )
  }

  if (playState === 'error' || !clip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
        <p className="text-2xl text-white/60">Clip not found</p>
        <button
          onClick={() => router.push('/tv/browse')}
          className="px-6 py-3 bg-accent rounded-lg text-lg font-medium hover:bg-accent/80 transition-colors"
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
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
      style={{ zIndex: 50 }}
      onMouseMove={showControlsTemporarily}
      onMouseDown={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Back button - z-30 */}
      {showControls && (
        <button
          onClick={goBack}
          className="absolute left-6 top-6 flex items-center gap-3 rounded-full bg-black/70 px-5 py-3 text-white transition-all hover:bg-black/90 cursor-pointer"
          style={{ zIndex: 30 }}
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="text-lg">Back</span>
        </button>
      )}

      {/* Skip intro button - z-30 */}
      {isPlayingIntro && showControls && introReady && (
        <button
          onClick={handleTransitionToMain}
          className="absolute right-6 bottom-32 flex items-center gap-3 rounded border-2 border-white/50 bg-black/80 px-6 py-3 text-white transition-all hover:bg-white hover:text-black cursor-pointer"
          style={{ zIndex: 30 }}
        >
          <span className="text-lg font-semibold">Skip Intro</span>
          <SkipForward className="h-5 w-5" />
        </button>
      )}

      {/* Intro loading overlay - z-25 */}
      {!introReady && !introFailed && isPlayingIntro && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="text-lg text-white/80">Loading intro...</p>
          </div>
        </div>
      )}

      {/* Intro error overlay - z-25 */}
      {introFailed && isPlayingIntro && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-white/60">Starting video...</p>
          </div>
        </div>
      )}

      {/* Unmute button — visible when video is muted, user must tap to unmute */}
      {isMuted && playState === 'main' && !videoError && (
        <button
          onClick={() => {
            const video = mainVideoRef.current
            if (!video) return
            video.muted = false
            if (video.paused) {
              video.play().then(() => setIsMuted(false)).catch(() => {
                video.muted = true
                video.play().catch(() => {})
              })
            } else {
              setIsMuted(false)
              console.log('[TV] Unmuted via user gesture')
            }
          }}
          className="absolute left-6 bottom-40 flex items-center gap-3 rounded-full bg-black/70 px-5 py-3 text-white transition-all hover:bg-black/90 cursor-pointer"
          style={{ zIndex: 25 }}
        >
          <VolumeX className="h-6 w-6" />
          <span className="text-lg font-medium">Tap to unmute</span>
        </button>
      )}

      {/* Transition loading overlay - z-25 */}
      {playState === 'transitioning' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="text-lg text-white/80">Starting video...</p>
          </div>
        </div>
      )}

      {/* Buffering overlay - z-20 pointer-events-none */}
      {isBuffering && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 20 }}
        >
          <div className="flex flex-col items-center gap-4 bg-black/50 px-8 py-6 rounded-xl">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
            <p className="text-white/80">Buffering...</p>
          </div>
        </div>
      )}

      {/* Video error overlay - z-25 */}
      {videoError && playState === 'main' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/80"
          style={{ zIndex: 25 }}
        >
          <div className="flex flex-col items-center gap-4 p-8">
            <p className="text-xl text-red-400">Playback Error</p>
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
              className="mt-4 px-6 py-3 bg-accent rounded-lg text-lg font-medium hover:bg-accent/80 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Intro video - z-10 when visible, z-1 when hidden */}
      {introVideoUrl && (
        <video
          ref={introVideoRef}
          muted
          autoPlay
          playsInline
          webkit-playsinline="true"
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

      {/* Main video - z-10 when visible, z-1 when hidden */}
      {/* Don't set src during intro — WebOS has a single hardware decoder */}
      {mainVideoUrl && (
        <video
          ref={mainVideoRef}
          src={!introClip || playState !== 'intro' ? mainVideoUrl : undefined}
          playsInline
          webkit-playsinline="true"
          preload={introClip ? 'none' : 'auto'}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onPause={handlePause}
          onCanPlayThrough={handleCanPlayThrough}
          onError={handleError}
          onEnded={handleEnded}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
          style={{
            opacity: showMainVideo ? 1 : 0,
            zIndex: showMainVideo ? 10 : 1,
            pointerEvents: showMainVideo ? 'auto' : 'none',
          }}
        />
      )}

      {/* Controls overlay - z-15 above video z-10 */}
      {showControls && playState === 'main' && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent"
          style={{ zIndex: 15 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pb-6 pt-20">
            {/* Progress bar - clickable */}
            <div
              ref={progressRef}
              className="relative w-full h-3 bg-white/20 rounded-full cursor-pointer group mb-3"
              onClick={handleSeek}
            >
              {/* Buffered progress */}
              <div
                className="absolute h-full bg-white/30 rounded-full transition-all"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Playback progress */}
              <div
                className="absolute h-full bg-accent rounded-full"
                style={{ width: `${progress}%` }}
              />
              {/* Seek handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>

            {/* Time display */}
            <div className="flex justify-between text-sm text-white/70 mb-4">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-4">
              {/* Left: Title */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
                  {clip.title}
                </h1>
              </div>

              {/* Center: Playback controls */}
              <div className="flex items-center gap-2 md:gap-3">
                <button
                  onClick={skipBackward}
                  className="p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                  title="Skip back 15s"
                >
                  <div className="relative">
                    <RotateCcw size={24} />
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold">15</span>
                  </div>
                </button>

                <button
                  onClick={togglePlayPause}
                  className="p-4 md:p-5 rounded-full bg-white/20 hover:bg-white/30 transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
                </button>

                <button
                  onClick={skipForward}
                  className="p-3 md:p-4 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                  title="Skip forward 15s"
                >
                  <div className="relative">
                    <RotateCw size={24} />
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold">15</span>
                  </div>
                </button>
              </div>

              {/* Right: Volume & Fullscreen */}
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-0 group-hover:w-20 transition-all duration-200 accent-accent cursor-pointer"
                  />
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                </button>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
              <span>Space: Play/Pause</span>
              <span>←/→: Skip 15s</span>
              <span>↑/↓: Volume</span>
              <span>M: Mute</span>
              <span>F: Fullscreen</span>
            </div>
          </div>
        </div>
      )}

      {/* Click to toggle play (when controls hidden) - z-12 above video z-10 */}
      {!showControls && playState === 'main' && (
        <div
          className="absolute inset-0 cursor-pointer"
          style={{ zIndex: 12 }}
          onClick={togglePlayPause}
        />
      )}

      {/* Intro badge - z-15 */}
      {isPlayingIntro && introReady && (
        <div
          className="absolute left-6 bottom-32 rounded bg-white/10 backdrop-blur-sm px-4 py-2 border border-white/20"
          style={{ zIndex: 15 }}
        >
          <span className="text-sm text-white/80 uppercase tracking-widest font-medium">
            Intro
          </span>
        </div>
      )}
    </div>
  )
}
