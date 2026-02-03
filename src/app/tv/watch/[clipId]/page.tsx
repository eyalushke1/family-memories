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
} from 'lucide-react'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'
import { useTVFocusable, useTVNavigation } from '@/components/tv/tv-navigation-context'
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
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function TVControlButton({
  id,
  onClick,
  children,
  label,
  row,
  col,
}: {
  id: string
  onClick: () => void
  children: React.ReactNode
  label: string
  row: number
  col: number
}) {
  const { ref, isFocused } = useTVFocusable(id, { row, col })

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      className={`
        p-4 tv:p-5 rounded-full transition-all duration-200
        focus:outline-none
        ${isFocused
          ? 'bg-accent scale-110 ring-4 ring-white/30'
          : 'bg-white/10 hover:bg-white/20'
        }
      `}
      aria-label={label}
    >
      {children}
    </button>
  )
}

export default function TVWatchPage() {
  const router = useRouter()
  const params = useParams()
  const clipId = params.clipId as string
  const [clip, setClip] = useState<ClipRow | null>(null)
  const [introClip, setIntroClip] = useState<IntroClipRow | null>(null)
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null)
  const [playState, setPlayState] = useState<PlayState>('loading')
  const [showControls, setShowControls] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const [bufferedPercent, setBufferedPercent] = useState(0)

  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { goBack } = useTVNavigation()

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

  // Preload main video while intro plays
  useEffect(() => {
    if (playState === 'intro' && mainVideoRef.current && clip) {
      mainVideoRef.current.load()
    }
  }, [playState, clip])

  // Transition from intro to main
  const transitionToMain = useCallback(() => {
    if (playState !== 'intro') return
    setPlayState('transitioning')

    if (introVideoRef.current) {
      introVideoRef.current.pause()
    }

    if (presentationData) {
      setTimeout(() => setPlayState('presentation'), 300)
      return
    }

    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
      mainVideoRef.current.play().catch(console.error)
      setIsPlaying(true)
    }

    setTimeout(() => setPlayState('main'), 300)
  }, [playState, presentationData])

  const handleIntroEnded = () => transitionToMain()
  const handleSkipIntro = () => transitionToMain()

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

  // Cleanup timeout on unmount
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
      const playIntro = async () => {
        try {
          // Set muted first to ensure autoplay works (browser policy)
          introVideoRef.current!.muted = false
          await introVideoRef.current!.play()
        } catch (err) {
          console.error('Intro autoplay failed, trying muted:', err)
          // If autoplay fails, try muted
          try {
            introVideoRef.current!.muted = true
            await introVideoRef.current!.play()
          } catch (err2) {
            console.error('Muted autoplay also failed:', err2)
          }
        }
      }
      playIntro()
    }
  }, [playState])

  // Auto-play main when no intro
  useEffect(() => {
    if (playState === 'main' && !introClip && mainVideoRef.current) {
      const playMain = async () => {
        try {
          await mainVideoRef.current!.play()
          setIsPlaying(true)
        } catch (err) {
          console.error('Main video autoplay failed:', err)
          setIsPlaying(false)
        }
      }
      playMain()
    }
  }, [playState, introClip])

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const video = mainVideoRef.current
    if (video && video.duration) {
      setCurrentTime(video.currentTime)
      setProgress((video.currentTime / video.duration) * 100)
    }
  }, [])

  const handleDurationChange = useCallback(() => {
    const video = mainVideoRef.current
    if (video && video.duration && isFinite(video.duration)) {
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
    setIsBuffering(true)
    setShowControls(true)
  }, [])

  const handlePlaying = useCallback(() => {
    setIsBuffering(false)
    setIsPlaying(true)
  }, [])

  const handlePause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      showControlsTemporarily()

      if (playState === 'intro' && e.key === 'Enter') {
        handleSkipIntro()
        e.preventDefault()
        return
      }

      if (playState === 'main' && mainVideoRef.current) {
        switch (e.key) {
          case ' ':
          case 'k':
          case 'Enter':
            e.preventDefault()
            if (isPlaying) {
              mainVideoRef.current.pause()
            } else {
              mainVideoRef.current.play()
            }
            break
          case 'm':
            setIsMuted((m) => {
              mainVideoRef.current!.muted = !m
              return !m
            })
            break
          case 'ArrowLeft':
            e.preventDefault()
            mainVideoRef.current.currentTime = Math.max(0, mainVideoRef.current.currentTime - 15)
            break
          case 'ArrowRight':
            e.preventDefault()
            mainVideoRef.current.currentTime = Math.min(
              mainVideoRef.current.duration || 0,
              mainVideoRef.current.currentTime + 15
            )
            break
          case 'Escape':
          case 'Backspace':
            e.preventDefault()
            goBack()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playState, isPlaying, showControlsTemporarily, goBack])

  // Control functions
  const togglePlayPause = () => {
    if (mainVideoRef.current) {
      if (isPlaying) {
        mainVideoRef.current.pause()
      } else {
        mainVideoRef.current.play()
      }
    }
  }

  const toggleMute = () => {
    if (mainVideoRef.current) {
      mainVideoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const skipBackward = () => {
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = Math.max(0, mainVideoRef.current.currentTime - 15)
    }
  }

  const skipForward = () => {
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = Math.min(
        mainVideoRef.current.duration || 0,
        mainVideoRef.current.currentTime + 15
      )
    }
  }

  // Render states
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

  const introVideoUrl = introClip ? `/api/media/files/${introClip.video_path}` : null
  const mainVideoUrl = clip.video_path !== 'presentation' ? `/api/media/files/${clip.video_path}` : null
  const isPlayingIntro = playState === 'intro'
  const isTransitioning = playState === 'transitioning'
  const showIntroVideo = isPlayingIntro || isTransitioning
  const showMainVideo = playState === 'main' || isTransitioning

  return (
    <div
      className="relative min-h-screen bg-black overflow-hidden"
      onMouseMove={showControlsTemporarily}
      onClick={showControlsTemporarily}
    >
      {/* Back button */}
      {showControls && (
        <button
          onClick={goBack}
          className="absolute left-6 top-6 z-30 flex items-center gap-3 rounded-full bg-black/60 px-5 py-3 text-white transition-colors hover:bg-black/80"
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="text-lg">Back</span>
        </button>
      )}

      {/* Skip intro button */}
      {isPlayingIntro && showControls && (
        <button
          onClick={handleSkipIntro}
          className="absolute right-6 bottom-32 z-30 flex items-center gap-3 rounded border-2 border-white/40 bg-black/80 px-6 py-3 text-white transition-all hover:bg-white hover:text-black"
        >
          <span className="text-lg font-semibold">Skip Intro</span>
          <SkipForward className="h-5 w-5" />
        </button>
      )}

      {/* Buffering indicator */}
      {isBuffering && playState === 'main' && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 animate-spin text-white" />
            <p className="text-lg text-white/80">Buffering...</p>
          </div>
        </div>
      )}

      {/* Videos */}
      <div className="flex min-h-screen items-center justify-center">
        {/* Intro video */}
        {introVideoUrl && (
          <video
            ref={introVideoRef}
            src={introVideoUrl}
            onEnded={handleIntroEnded}
            onCanPlay={() => {
              // Try to play when ready
              if (playState === 'intro' && introVideoRef.current) {
                introVideoRef.current.play().catch(console.error)
              }
            }}
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{
              opacity: showIntroVideo ? 1 : 0,
              zIndex: isTransitioning ? 5 : 10,
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
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onProgress={handleProgress}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onCanPlay={() => setIsBuffering(false)}
            muted={isMuted}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{
              opacity: showMainVideo ? 1 : 0,
              zIndex: showMainVideo ? 10 : 5,
              pointerEvents: showMainVideo ? 'auto' : 'none',
            }}
          />
        )}
      </div>

      {/* TV-optimized controls */}
      {showControls && playState === 'main' && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 pb-8 px-8 z-20">
          {/* Progress bar with buffer indicator */}
          <div className="relative w-full h-2 bg-white/20 rounded-full mb-4 overflow-hidden">
            {/* Buffered progress */}
            <div
              className="absolute h-full bg-white/30 transition-all duration-300"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Playback progress */}
            <div
              className="absolute h-full bg-accent transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between text-sm text-white/60 mb-4">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Title and controls */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl tv:text-4xl font-bold text-white">
                {clip.title}
              </h1>
              {clip.description && (
                <p className="mt-2 text-lg text-white/60 max-w-2xl line-clamp-2">
                  {clip.description}
                </p>
              )}
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-3">
              {/* Skip back 15s */}
              <TVControlButton
                id="skip-back"
                onClick={skipBackward}
                label="Skip back 15 seconds"
                row={1}
                col={0}
              >
                <div className="relative">
                  <RotateCcw size={28} />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold">15</span>
                </div>
              </TVControlButton>

              {/* Play/Pause */}
              <TVControlButton
                id="play-pause"
                onClick={togglePlayPause}
                label={isPlaying ? 'Pause' : 'Play'}
                row={1}
                col={1}
              >
                {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </TVControlButton>

              {/* Skip forward 15s */}
              <TVControlButton
                id="skip-forward"
                onClick={skipForward}
                label="Skip forward 15 seconds"
                row={1}
                col={2}
              >
                <div className="relative">
                  <RotateCw size={28} />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold">15</span>
                </div>
              </TVControlButton>

              {/* Mute */}
              <TVControlButton
                id="mute"
                onClick={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
                row={1}
                col={3}
              >
                {isMuted ? <VolumeX size={28} /> : <Volume2 size={28} />}
              </TVControlButton>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/40">
            <span>Space/Enter: Play/Pause</span>
            <span>←/→: Skip 15s</span>
            <span>M: Mute</span>
            <span>Back/Esc: Exit</span>
          </div>
        </div>
      )}

      {/* Intro badge */}
      {isPlayingIntro && (
        <div className="absolute left-6 bottom-32 z-20 rounded bg-white/10 backdrop-blur-sm px-4 py-2 border border-white/20">
          <span className="text-sm text-white/80 uppercase tracking-widest font-medium">
            Intro
          </span>
        </div>
      )}
    </div>
  )
}
