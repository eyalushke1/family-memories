'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, SkipForward, Play, Pause, Volume2, VolumeX } from 'lucide-react'
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
        p-4 tv:p-6 rounded-full transition-all duration-200
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
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)

  const introVideoRef = useRef<HTMLVideoElement>(null)
  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { goBack } = useTVNavigation()

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

  useEffect(() => {
    if (playState === 'intro' && mainVideoRef.current && clip) {
      mainVideoRef.current.load()
    }
  }, [playState, clip])

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
    }

    setTimeout(() => setPlayState('main'), 300)
  }, [playState, presentationData])

  const handleIntroEnded = () => transitionToMain()
  const handleSkipIntro = () => transitionToMain()

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 5000)
  }, [isPlaying])

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (playState === 'intro' && introVideoRef.current) {
      introVideoRef.current.play().catch(console.error)
    }
  }, [playState])

  useEffect(() => {
    if (playState === 'main' && !introClip && mainVideoRef.current) {
      mainVideoRef.current.play().catch(console.error)
    }
  }, [playState, introClip])

  // Video time update for progress bar
  const handleTimeUpdate = useCallback(() => {
    const video = mainVideoRef.current
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100)
    }
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

      if (playState === 'main') {
        switch (e.key) {
          case ' ':
          case 'k':
          case 'Enter':
            e.preventDefault()
            if (mainVideoRef.current) {
              if (isPlaying) {
                mainVideoRef.current.pause()
              } else {
                mainVideoRef.current.play()
              }
              setIsPlaying(!isPlaying)
            }
            break
          case 'm':
            setIsMuted((m) => !m)
            if (mainVideoRef.current) {
              mainVideoRef.current.muted = !isMuted
            }
            break
          case 'ArrowLeft':
            if (mainVideoRef.current) {
              mainVideoRef.current.currentTime -= 10
            }
            break
          case 'ArrowRight':
            if (mainVideoRef.current) {
              mainVideoRef.current.currentTime += 10
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playState, isPlaying, isMuted, showControlsTemporarily])

  const togglePlayPause = () => {
    if (mainVideoRef.current) {
      if (isPlaying) {
        mainVideoRef.current.pause()
      } else {
        mainVideoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (mainVideoRef.current) {
      mainVideoRef.current.muted = !isMuted
    }
  }

  if (playState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
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
    >
      {/* Back button */}
      {showControls && (
        <button
          onClick={goBack}
          className="absolute left-6 top-6 z-20 flex items-center gap-3 rounded-full bg-black/50 px-5 py-3 text-white transition-colors hover:bg-black/70"
        >
          <ArrowLeft className="h-6 w-6" />
          <span className="text-lg">Back</span>
        </button>
      )}

      {/* Skip intro button */}
      {isPlayingIntro && showControls && (
        <button
          onClick={handleSkipIntro}
          className="absolute right-6 bottom-32 z-20 flex items-center gap-3 rounded border-2 border-white/40 bg-black/80 px-6 py-3 text-white transition-all hover:bg-white hover:text-black"
        >
          <span className="text-lg font-semibold">Skip Intro</span>
          <SkipForward className="h-5 w-5" />
        </button>
      )}

      {/* Videos */}
      <div className="flex min-h-screen items-center justify-center">
        {introVideoUrl && (
          <video
            ref={introVideoRef}
            src={introVideoUrl}
            onEnded={handleIntroEnded}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{
              opacity: showIntroVideo ? 1 : 0,
              zIndex: isTransitioning ? 5 : 10,
              pointerEvents: showIntroVideo ? 'auto' : 'none',
            }}
          />
        )}

        {mainVideoUrl && (
          <video
            ref={mainVideoRef}
            src={mainVideoUrl}
            playsInline
            onTimeUpdate={handleTimeUpdate}
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
          {/* Progress bar */}
          <div className="w-full h-2 bg-white/20 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Title and controls */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl tv:text-4xl font-bold text-white">
                {clip.title}
              </h1>
              {clip.description && (
                <p className="mt-2 text-lg text-white/60 max-w-2xl">
                  {clip.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <TVControlButton
                id="play-pause"
                onClick={togglePlayPause}
                label={isPlaying ? 'Pause' : 'Play'}
                row={1}
                col={0}
              >
                {isPlaying ? <Pause size={32} /> : <Play size={32} />}
              </TVControlButton>

              <TVControlButton
                id="mute"
                onClick={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
                row={1}
                col={1}
              >
                {isMuted ? <VolumeX size={32} /> : <Volume2 size={32} />}
              </TVControlButton>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-4 flex gap-6 text-sm text-white/40">
            <span>Space/Enter: Play/Pause</span>
            <span>Left/Right: Seek 10s</span>
            <span>M: Mute</span>
            <span>Back: Exit</span>
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
