'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Pause, Play, ChevronLeft, ChevronRight, Volume2, VolumeX, Cast } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRemotePlayback } from '@/hooks/use-remote-playback'

interface Slide {
  id: string
  mediaUrl: string
  mediaType?: 'image' | 'video'
  // Legacy support
  imageUrl?: string
  caption?: string
  durationMs?: number
}

type TransitionType = 'fade' | 'slide' | 'zoom' | 'blur' | 'wipe' | 'flip' | 'kenburns' | 'dissolve' | 'none' | 'random'

interface PresentationData {
  id: string
  slideDurationMs: number
  transitionType: TransitionType
  transitionDurationMs: number
  backgroundMusicUrl?: string | null
  musicFadeOutMs?: number
  muteVideoAudio?: boolean
  slides: Slide[]
}

interface SlideshowPlayerProps {
  presentationData: PresentationData
}

// All available transition effects (excluding random and none)
const TRANSITION_TYPES: Exclude<TransitionType, 'random' | 'none'>[] = [
  'fade', 'slide', 'zoom', 'blur', 'wipe', 'flip', 'kenburns', 'dissolve'
]

export function SlideshowPlayer({ presentationData }: SlideshowPlayerProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previousIndex, setPreviousIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preloadedMedia, setPreloadedMedia] = useState<Set<number>>(new Set([0]))

  // Transition phases: 'entering' (fade in), 'visible' (fully shown), 'exiting' (fade out)
  const [slidePhase, setSlidePhase] = useState<'entering' | 'visible' | 'exiting'>('entering')
  const [currentTransition, setCurrentTransition] = useState<Exclude<TransitionType, 'random'>>('fade')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previousVideoRef = useRef<HTMLVideoElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const enterTimerRef = useRef<NodeJS.Timeout | null>(null)
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    slides,
    slideDurationMs,
    transitionType,
    transitionDurationMs,
    backgroundMusicUrl,
    musicFadeOutMs = 3000,
    muteVideoAudio = true
  } = presentationData

  // Normalize slides to use mediaUrl (handle legacy imageUrl)
  const normalizedSlides = useMemo(() =>
    slides.map(slide => ({
      ...slide,
      mediaUrl: slide.mediaUrl || slide.imageUrl || '',
      mediaType: slide.mediaType || 'image' as const
    }))
  , [slides])

  const currentSlide = normalizedSlides[currentIndex]
  const previousSlide = previousIndex !== null ? normalizedSlides[previousIndex] : null
  const totalSlides = normalizedSlides.length
  const isCurrentVideo = currentSlide?.mediaType === 'video'

  // Remote playback for casting videos
  const { state: castState, isAvailable: castAvailable, isSupported: castSupported, promptCast } = useRemotePlayback(videoRef)

  // Generate random transitions for each slide if using random mode
  const slideTransitions = useMemo(() => {
    if (transitionType !== 'random') return []
    return normalizedSlides.map(() => TRANSITION_TYPES[Math.floor(Math.random() * TRANSITION_TYPES.length)])
  }, [normalizedSlides, transitionType])

  // Get the transition to use for the current slide
  const getTransitionForSlide = useCallback((index: number): Exclude<TransitionType, 'random'> => {
    if (transitionType === 'random') {
      return slideTransitions[index] || 'fade'
    }
    if (transitionType === 'none') {
      return 'none'
    }
    return transitionType as Exclude<TransitionType, 'random'>
  }, [transitionType, slideTransitions])

  // Preload next media
  useEffect(() => {
    const toPreload = [currentIndex, currentIndex + 1, currentIndex + 2]
      .filter((i) => i < totalSlides && !preloadedMedia.has(i))

    if (toPreload.length > 0) {
      toPreload.forEach((i) => {
        const slide = normalizedSlides[i]
        if (slide.mediaType === 'video') {
          // Preload video by creating a video element
          const video = document.createElement('video')
          video.preload = 'metadata'
          video.src = slide.mediaUrl
        } else {
          // Preload image
          const img = new Image()
          img.src = slide.mediaUrl
        }
      })
      setPreloadedMedia((prev) => {
        const next = new Set(prev)
        toPreload.forEach((i) => next.add(i))
        return next
      })
    }
  }, [currentIndex, normalizedSlides, totalSlides, preloadedMedia])

  // Music fade out when approaching end
  useEffect(() => {
    if (!audioRef.current || !isPlaying || isMuted) return

    const totalDuration = normalizedSlides.reduce((acc, slide) => acc + (slide.durationMs || slideDurationMs), 0)
    const currentTime = normalizedSlides.slice(0, currentIndex).reduce((acc, slide) => acc + (slide.durationMs || slideDurationMs), 0) +
      (progress / 100) * (currentSlide?.durationMs || slideDurationMs)

    const timeRemaining = totalDuration - currentTime

    if (timeRemaining <= musicFadeOutMs && currentIndex === totalSlides - 1) {
      const targetVolume = Math.max(0, (timeRemaining / musicFadeOutMs) * 0.5)
      audioRef.current.volume = targetVolume
    } else if (audioRef.current.volume < 0.5) {
      audioRef.current.volume = 0.5
    }
  }, [currentIndex, progress, normalizedSlides, slideDurationMs, currentSlide, musicFadeOutMs, totalSlides, isPlaying, isMuted])

  // Handle slide phase transitions
  const startSlidePhases = useCallback(() => {
    const duration = currentSlide?.durationMs || slideDurationMs
    const enterDuration = transitionDurationMs
    const exitDuration = transitionDurationMs

    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)

    setSlidePhase('entering')

    enterTimerRef.current = setTimeout(() => {
      setSlidePhase('visible')
    }, enterDuration)

    // Only set exit timer for images (videos handle their own timing)
    if (!isCurrentVideo) {
      exitTimerRef.current = setTimeout(() => {
        setSlidePhase('exiting')
      }, duration - exitDuration)
    }
  }, [currentSlide, slideDurationMs, transitionDurationMs, isCurrentVideo])

  // Auto-advance slides
  const goToNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setPreviousIndex(currentIndex)
      setCurrentTransition(getTransitionForSlide(currentIndex + 1))
      setCurrentIndex((prev) => prev + 1)
      setProgress(0)
    } else {
      setIsPlaying(false)
    }
  }, [currentIndex, totalSlides, getTransitionForSlide])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setPreviousIndex(currentIndex)
      setCurrentTransition(getTransitionForSlide(currentIndex - 1))
      setCurrentIndex((prev) => prev - 1)
      setProgress(0)
    }
  }, [currentIndex, getTransitionForSlide])

  const goToSlide = useCallback((index: number) => {
    if (index !== currentIndex && index >= 0 && index < totalSlides) {
      setPreviousIndex(currentIndex)
      setCurrentTransition(getTransitionForSlide(index))
      setCurrentIndex(index)
      setProgress(0)
    }
  }, [currentIndex, totalSlides, getTransitionForSlide])

  // Handle video events
  const handleVideoEnded = useCallback(() => {
    setSlidePhase('exiting')
    // Advance after exit transition
    setTimeout(goToNext, transitionDurationMs)
  }, [goToNext, transitionDurationMs])

  const handleVideoTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    if (video.duration) {
      const percent = (video.currentTime / video.duration) * 100
      setProgress(percent)

      // Start exit transition before video ends
      if (video.duration - video.currentTime <= transitionDurationMs / 1000 && slidePhase !== 'exiting') {
        setSlidePhase('exiting')
      }
    }
  }, [transitionDurationMs, slidePhase])

  // Handle slide timing and phases
  useEffect(() => {
    if (!isPlaying) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current)
        slideTimerRef.current = null
      }
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      // Pause video if playing
      if (videoRef.current) {
        videoRef.current.pause()
      }
      return
    }

    // Start slide phases
    startSlidePhases()

    // For videos, let the video control timing
    if (isCurrentVideo) {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {})
      }
      return
    }

    // For images, use timer-based progression
    const duration = currentSlide?.durationMs || slideDurationMs
    const updateInterval = 50

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (updateInterval / duration) * 100
        return Math.min(next, 100)
      })
    }, updateInterval)

    slideTimerRef.current = setTimeout(goToNext, duration)

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [isPlaying, currentIndex, currentSlide, slideDurationMs, goToNext, startSlidePhases, isCurrentVideo])

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0)
    const timer = setTimeout(() => {
      setPreviousIndex(null)
    }, transitionDurationMs)
    return () => clearTimeout(timer)
  }, [currentIndex, transitionDurationMs])

  // Background music
  useEffect(() => {
    if (backgroundMusicUrl && !audioRef.current) {
      audioRef.current = new Audio(backgroundMusicUrl)
      audioRef.current.loop = false
      audioRef.current.volume = 0.5
    }

    if (audioRef.current) {
      audioRef.current.muted = isMuted
      if (isPlaying) {
        audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [backgroundMusicUrl, isPlaying, isMuted])

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying])

  useEffect(() => {
    showControlsTemporarily()
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current)
      }
    }
  }, [showControlsTemporarily])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          setIsPlaying((p) => !p)
          showControlsTemporarily()
          break
        case 'ArrowLeft':
          goToPrevious()
          showControlsTemporarily()
          break
        case 'ArrowRight':
          goToNext()
          showControlsTemporarily()
          break
        case 'Escape':
          router.back()
          break
        case 'm':
          setIsMuted((m) => !m)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrevious, showControlsTemporarily, router])

  const handleClose = () => {
    router.back()
  }

  const togglePlay = () => {
    setIsPlaying((p) => !p)
    showControlsTemporarily()
  }

  // Get transition styles for current slide based on phase
  const getCurrentSlideStyle = (transition: Exclude<TransitionType, 'random'>) => {
    const duration = transitionDurationMs
    const base = { transition: `all ${duration}ms ease-in-out` }

    if (transition === 'none') return {}

    const isEntering = slidePhase === 'entering'
    const isExiting = slidePhase === 'exiting'

    switch (transition) {
      case 'fade':
        return {
          ...base,
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'zoom':
        return {
          ...base,
          transform: isEntering ? 'scale(1.05)' : isExiting ? 'scale(0.95)' : 'scale(1)',
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'slide':
        return {
          ...base,
          transform: isEntering ? 'translateX(50px)' : isExiting ? 'translateX(-50px)' : 'translateX(0)',
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'blur':
        return {
          ...base,
          filter: isEntering ? 'blur(15px)' : isExiting ? 'blur(15px)' : 'blur(0)',
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'wipe':
        return {
          ...base,
          clipPath: isEntering
            ? 'inset(0 100% 0 0)'
            : isExiting
            ? 'inset(0 0 0 100%)'
            : 'inset(0 0 0 0)',
        }
      case 'flip':
        return {
          ...base,
          transform: isEntering
            ? 'perspective(1000px) rotateY(-90deg)'
            : isExiting
            ? 'perspective(1000px) rotateY(90deg)'
            : 'perspective(1000px) rotateY(0deg)',
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'kenburns':
        // Ken Burns: subtle slow zoom throughout display
        return {
          ...base,
          transition: `all ${slideDurationMs}ms ease-in-out`,
          transform: isEntering ? 'scale(1)' : isExiting ? 'scale(1.1)' : 'scale(1.05)',
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
        }
      case 'dissolve':
        // Dissolve: combination of fade and slight blur
        return {
          ...base,
          opacity: isEntering ? 0 : isExiting ? 0 : 1,
          filter: isEntering ? 'brightness(1.5) saturate(0.5)' : isExiting ? 'brightness(1.5) saturate(0.5)' : 'brightness(1) saturate(1)',
        }
      default:
        return {}
    }
  }

  // Get transition styles for exiting slide (previous slide during crossfade)
  const getPreviousSlideStyle = (transition: Exclude<TransitionType, 'random'>) => {
    const duration = transitionDurationMs
    const base = { transition: `all ${duration}ms ease-in-out` }

    if (transition === 'none') return { opacity: 0 }

    switch (transition) {
      case 'fade':
        return { ...base, opacity: 0 }
      case 'zoom':
        return { ...base, transform: 'scale(0.9)', opacity: 0 }
      case 'slide':
        return { ...base, transform: 'translateX(-100px)', opacity: 0 }
      case 'blur':
        return { ...base, filter: 'blur(20px)', opacity: 0 }
      case 'wipe':
        return { ...base, clipPath: 'inset(0 0 0 100%)' }
      case 'flip':
        return { ...base, transform: 'perspective(1000px) rotateY(90deg)', opacity: 0 }
      case 'kenburns':
        return { ...base, transform: 'scale(1.1)', opacity: 0 }
      case 'dissolve':
        return { ...base, opacity: 0, filter: 'brightness(1.5) saturate(0.5)' }
      default:
        return { opacity: 0 }
    }
  }

  // Render media element (image or video)
  const renderMedia = (slide: typeof currentSlide, isCurrent: boolean, style: React.CSSProperties) => {
    if (!slide) return null

    if (slide.mediaType === 'video') {
      return (
        <video
          ref={isCurrent ? videoRef : previousVideoRef}
          key={slide.id}
          src={slide.mediaUrl}
          className="max-w-full max-h-full object-contain"
          style={style}
          autoPlay={isCurrent && isPlaying}
          muted={muteVideoAudio || isMuted}
          playsInline
          onEnded={isCurrent ? handleVideoEnded : undefined}
          onTimeUpdate={isCurrent ? handleVideoTimeUpdate : undefined}
        />
      )
    }

    return (
      <img
        key={slide.id}
        src={slide.mediaUrl}
        alt=""
        className="max-w-full max-h-full object-contain"
        style={style}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={showControlsTemporarily}
      onClick={togglePlay}
    >
      {/* Previous slide (for crossfade during transition) */}
      {previousSlide && (
        <div className="absolute inset-0 flex items-center justify-center z-0">
          {renderMedia(previousSlide, false, getPreviousSlideStyle(currentTransition))}
        </div>
      )}

      {/* Current slide */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        {renderMedia(currentSlide, true, getCurrentSlideStyle(currentTransition))}
      </div>

      {/* Caption */}
      {currentSlide?.caption && (
        <div
          className={`absolute bottom-24 left-0 right-0 text-center transition-opacity duration-300 z-20 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="inline-block px-6 py-3 bg-black/70 rounded-lg text-white text-lg">
            {currentSlide.caption}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div
          className="h-full bg-accent transition-all duration-50"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide indicators */}
      <div
        className={`absolute top-4 left-0 right-0 flex justify-center gap-1 transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {normalizedSlides.map((slide, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation()
              goToSlide(index)
            }}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-accent' : 'bg-white/50 hover:bg-white/70'
            } ${slide.mediaType === 'video' ? 'ring-1 ring-white/30' : ''}`}
            title={slide.mediaType === 'video' ? 'Video' : 'Image'}
          />
        ))}
      </div>

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Left controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === totalSlides - 1}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Center - slide count and type indicator */}
          <div className="text-sm text-white/70 flex items-center gap-2">
            <span>{currentIndex + 1} / {totalSlides}</span>
            {isCurrentVideo && (
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs">Video</span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4">
            {/* Cast button - shows when casting is available and on video slide */}
            {castSupported && castAvailable && isCurrentVideo && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  promptCast()
                }}
                className={`p-2 hover:bg-white/10 rounded-full transition-colors ${
                  castState === 'connected' ? 'text-green-500' : ''
                }`}
                title={castState === 'connected' ? 'Connected to cast device' : 'Cast to TV'}
              >
                <Cast size={20} />
              </button>
            )}
            {(backgroundMusicUrl || isCurrentVideo) && (
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows (larger hit area) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          goToPrevious()
        }}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/50 hover:bg-black/70 transition-all disabled:opacity-0 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ChevronLeft size={32} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          goToNext()
        }}
        disabled={currentIndex === totalSlides - 1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/50 hover:bg-black/70 transition-all disabled:opacity-0 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ChevronRight size={32} />
      </button>
    </div>
  )
}
