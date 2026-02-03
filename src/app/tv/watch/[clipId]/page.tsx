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

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Intro state
  const [introLoading, setIntroLoading] = useState(true)
  const [introError, setIntroError] = useState(false)

  // Refs
  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const stallRecoveryRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRef = useRef<number>(0)
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { goBack } = useTVNavigation()

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

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

  // Transition from intro to main
  const transitionToMain = useCallback(() => {
    if (playState !== 'intro') return
    console.log('[TV Player] Transitioning from intro to main')
    setPlayState('transitioning')

    if (introVideoRef.current) {
      introVideoRef.current.pause()
    }

    if (presentationData) {
      setTimeout(() => setPlayState('presentation'), 300)
      return
    }

    // Start main video
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
      const playPromise = mainVideoRef.current.play()
      if (playPromise) {
        playPromise
          .then(() => {
            setIsPlaying(true)
            console.log('[TV Player] Main video started after intro')
          })
          .catch((err) => {
            console.error('[TV Player] Failed to start main video:', err)
            // Try muted
            if (mainVideoRef.current) {
              mainVideoRef.current.muted = true
              setIsMuted(true)
              mainVideoRef.current.play().catch(console.error)
            }
          })
      }
    }

    setTimeout(() => setPlayState('main'), 300)
  }, [playState, presentationData])

  // Show controls temporarily
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isBuffering) setShowControls(false)
    }, 5000)
  }, [isPlaying, isBuffering])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
      if (stallRecoveryRef.current) clearTimeout(stallRecoveryRef.current)
      if (stallCheckIntervalRef.current) clearInterval(stallCheckIntervalRef.current)
    }
  }, [])

  // Intro video playback with LG TV compatibility
  useEffect(() => {
    if (playState !== 'intro' || !introVideoRef.current) return

    const video = introVideoRef.current
    setIntroLoading(true)
    setIntroError(false)

    const attemptPlay = async () => {
      console.log('[TV Player] Attempting to play intro')
      try {
        // Start muted for better autoplay compatibility on Smart TVs
        video.muted = true
        await video.play()
        // If successful, try to unmute
        video.muted = false
        setIsMuted(false)
        console.log('[TV Player] Intro playing')
        setIntroLoading(false)
      } catch (err) {
        console.warn('[TV Player] Intro play failed:', err)
        // Keep it muted and try again
        try {
          video.muted = true
          setIsMuted(true)
          await video.play()
          console.log('[TV Player] Intro playing (muted)')
          setIntroLoading(false)
        } catch (err2) {
          console.error('[TV Player] Intro completely failed:', err2)
          setIntroError(true)
          setIntroLoading(false)
          // Skip to main after delay
          setTimeout(() => transitionToMain(), 1500)
        }
      }
    }

    // Wait for metadata to be loaded
    const handleLoadedMetadata = () => {
      console.log('[TV Player] Intro metadata loaded, duration:', video.duration)
      attemptPlay()
    }

    const handleCanPlay = () => {
      if (introLoading) {
        console.log('[TV Player] Intro can play')
        attemptPlay()
      }
    }

    const handleError = () => {
      console.error('[TV Player] Intro error')
      setIntroError(true)
      setIntroLoading(false)
      setTimeout(() => transitionToMain(), 500)
    }

    // Check if already ready
    if (video.readyState >= 1) {
      attemptPlay()
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('canplay', handleCanPlay)
    }
    video.addEventListener('error', handleError)

    // Timeout failsafe
    const timeout = setTimeout(() => {
      if (introLoading) {
        console.warn('[TV Player] Intro load timeout')
        setIntroError(true)
        setIntroLoading(false)
        transitionToMain()
      }
    }, 8000)

    return () => {
      clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
    }
  }, [playState, introLoading, transitionToMain])

  // Main video autoplay (when no intro)
  useEffect(() => {
    if (playState !== 'main' || introClip || !mainVideoRef.current) return

    const video = mainVideoRef.current
    console.log('[TV Player] Starting main video (no intro)')

    const attemptPlay = async () => {
      try {
        // Start muted for autoplay compatibility
        video.muted = true
        await video.play()
        // Try to unmute
        video.muted = false
        setIsMuted(false)
        setIsPlaying(true)
      } catch (err) {
        console.warn('[TV Player] Main autoplay failed:', err)
        try {
          video.muted = true
          setIsMuted(true)
          await video.play()
          setIsPlaying(true)
        } catch (err2) {
          console.error('[TV Player] Main video failed:', err2)
          setIsPlaying(false)
        }
      }
    }

    if (video.readyState >= 1) {
      attemptPlay()
    } else {
      video.addEventListener('loadedmetadata', attemptPlay, { once: true })
    }
  }, [playState, introClip])

  // Stall detection for LG TVs - checks if video time is progressing
  useEffect(() => {
    if (playState !== 'main' || !mainVideoRef.current) return

    const video = mainVideoRef.current
    lastTimeRef.current = video.currentTime

    // Check every 2 seconds if video is actually playing
    stallCheckIntervalRef.current = setInterval(() => {
      if (!video.paused && !video.ended && isPlaying) {
        const currentPos = video.currentTime
        const timeDiff = currentPos - lastTimeRef.current

        // If less than 0.5 seconds of progress in 2 seconds, video might be stalled
        if (timeDiff < 0.5 && currentPos < duration - 1) {
          console.warn('[TV Player] Stall detected - time not progressing')
          setIsBuffering(true)

          // Try to recover by seeking slightly
          if (stallRecoveryRef.current) clearTimeout(stallRecoveryRef.current)
          stallRecoveryRef.current = setTimeout(() => {
            if (video && !video.paused && !video.ended) {
              console.log('[TV Player] Attempting stall recovery')
              const seekTo = Math.min(currentPos + 0.5, duration - 1)
              video.currentTime = seekTo
              video.play().catch(console.error)
            }
          }, 1000)
        }
        lastTimeRef.current = currentPos
      }
    }, 2000)

    return () => {
      if (stallCheckIntervalRef.current) {
        clearInterval(stallCheckIntervalRef.current)
      }
    }
  }, [playState, isPlaying, duration])

  // Video event handlers
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
      console.log('[TV Player] Main video duration:', video.duration)
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
    console.log('[TV Player] Video waiting/buffering')
    setIsBuffering(true)
  }, [])

  const handlePlaying = useCallback(() => {
    console.log('[TV Player] Video playing')
    setIsBuffering(false)
    setIsPlaying(true)
    setVideoError(null)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const handleCanPlayThrough = useCallback(() => {
    console.log('[TV Player] Can play through')
    setIsBuffering(false)
  }, [])

  const handleError = useCallback(() => {
    const video = mainVideoRef.current
    if (video?.error) {
      console.error('[TV Player] Video error:', video.error.code, video.error.message)
      setVideoError(video.error.message || 'Playback error')
    }
    setIsBuffering(false)
  }, [])

  const handleEnded = useCallback(() => {
    const video = mainVideoRef.current
    if (video) {
      const percentPlayed = (video.currentTime / video.duration) * 100
      console.log(`[TV Player] Video ended at ${percentPlayed.toFixed(1)}%`)

      // If ended prematurely (before 90%), try to continue
      if (percentPlayed < 90 && video.duration > 0) {
        console.warn('[TV Player] Premature end, attempting recovery')
        setIsBuffering(true)
        video.currentTime = video.currentTime + 1
        video.play().catch((err) => {
          console.error('[TV Player] Recovery failed:', err)
          setIsBuffering(false)
          goBack()
        })
      } else {
        goBack()
      }
    }
  }, [goBack])

  // Control functions
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      showControlsTemporarily()

      if (playState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        transitionToMain()
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
  }, [playState, isPlaying, isFullscreen, volume, showControlsTemporarily, togglePlayPause, toggleMute, skipBackward, skipForward, toggleFullscreen, handleVolumeChange, goBack, transitionToMain])

  // Render loading state
  if (playState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
      </div>
    )
  }

  // Render error state
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

  // Render presentation
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
    <div
      ref={containerRef}
      className="relative min-h-screen bg-black overflow-hidden"
      onMouseMove={showControlsTemporarily}
      onMouseDown={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Back button */}
      {showControls && (
        <button
          onClick={goBack}
          className="absolute left-6 top-6 z-30 flex items-center gap-3 rounded-full bg-black/70 px-5 py-3 text-white transition-all hover:bg-black/90 cursor-pointer"
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="text-lg">Back</span>
        </button>
      )}

      {/* Skip intro button */}
      {isPlayingIntro && showControls && !introLoading && (
        <button
          onClick={transitionToMain}
          className="absolute right-6 bottom-32 z-30 flex items-center gap-3 rounded border-2 border-white/50 bg-black/80 px-6 py-3 text-white transition-all hover:bg-white hover:text-black cursor-pointer"
        >
          <span className="text-lg font-semibold">Skip Intro</span>
          <SkipForward className="h-5 w-5" />
        </button>
      )}

      {/* Intro loading overlay */}
      {introLoading && isPlayingIntro && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="text-lg text-white/80">Loading intro...</p>
          </div>
        </div>
      )}

      {/* Intro error overlay */}
      {introError && isPlayingIntro && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-white/60">Starting video...</p>
          </div>
        </div>
      )}

      {/* Buffering overlay */}
      {isBuffering && playState === 'main' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 bg-black/50 px-8 py-6 rounded-xl">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
            <p className="text-white/80">Buffering...</p>
          </div>
        </div>
      )}

      {/* Video error overlay */}
      {videoError && playState === 'main' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
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

      {/* Video container */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Intro video */}
        {introVideoUrl && (
          <video
            ref={introVideoRef}
            src={introVideoUrl}
            onEnded={transitionToMain}
            playsInline
            webkit-playsinline="true"
            preload="auto"
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{
              opacity: showIntroVideo ? 1 : 0,
              zIndex: showIntroVideo ? 15 : 5,
              pointerEvents: showIntroVideo ? 'auto' : 'none',
            }}
          />
        )}

        {/* Main video */}
        {mainVideoUrl && (
          <video
            ref={mainVideoRef}
            src={mainVideoUrl}
            playsInline
            webkit-playsinline="true"
            preload="auto"
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
              zIndex: showMainVideo ? 15 : 5,
              pointerEvents: showMainVideo ? 'auto' : 'none',
            }}
          />
        )}
      </div>

      {/* Controls overlay */}
      {showControls && playState === 'main' && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent"
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
                {/* Skip back */}
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

                {/* Play/Pause */}
                <button
                  onClick={togglePlayPause}
                  className="p-4 md:p-5 rounded-full bg-white/20 hover:bg-white/30 transition-all cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
                </button>

                {/* Skip forward */}
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
                {/* Volume control */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>
                  {/* Volume slider - shows on hover */}
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

                {/* Fullscreen */}
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

      {/* Click to toggle play (when controls hidden) */}
      {!showControls && playState === 'main' && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlayPause}
        />
      )}

      {/* Intro badge */}
      {isPlayingIntro && !introLoading && (
        <div className="absolute left-6 bottom-32 z-20 rounded bg-white/10 backdrop-blur-sm px-4 py-2 border border-white/20">
          <span className="text-sm text-white/80 uppercase tracking-widest font-medium">
            Intro
          </span>
        </div>
      )}
    </div>
  )
}
