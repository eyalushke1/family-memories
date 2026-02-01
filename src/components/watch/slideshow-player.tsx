'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Pause, Play, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Slide {
  id: string
  imageUrl: string
  caption?: string
  durationMs?: number
}

type TransitionType = 'fade' | 'slide' | 'zoom' | 'blur' | 'none' | 'random'

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

const TRANSITION_TYPES: Exclude<TransitionType, 'random' | 'none'>[] = ['fade', 'slide', 'zoom', 'blur']

export function SlideshowPlayer({ presentationData }: SlideshowPlayerProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previousIndex, setPreviousIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set([0]))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [currentTransition, setCurrentTransition] = useState<Exclude<TransitionType, 'random'>>('fade')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const {
    slides,
    slideDurationMs,
    transitionType,
    transitionDurationMs,
    backgroundMusicUrl,
    musicFadeOutMs = 3000
  } = presentationData

  const currentSlide = slides[currentIndex]
  const previousSlide = previousIndex !== null ? slides[previousIndex] : null
  const totalSlides = slides.length

  // Generate random transitions for each slide if using random mode
  const slideTransitions = useMemo(() => {
    if (transitionType !== 'random') return []
    return slides.map(() => TRANSITION_TYPES[Math.floor(Math.random() * TRANSITION_TYPES.length)])
  }, [slides, transitionType])

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

  // Preload next images
  useEffect(() => {
    const toPreload = [currentIndex, currentIndex + 1, currentIndex + 2]
      .filter((i) => i < totalSlides && !preloadedImages.has(i))

    if (toPreload.length > 0) {
      toPreload.forEach((i) => {
        const img = new Image()
        img.src = slides[i].imageUrl
      })
      setPreloadedImages((prev) => {
        const next = new Set(prev)
        toPreload.forEach((i) => next.add(i))
        return next
      })
    }
  }, [currentIndex, slides, totalSlides, preloadedImages])

  // Music fade out when approaching end
  useEffect(() => {
    if (!audioRef.current || !isPlaying || isMuted) return

    // Calculate total presentation duration
    const totalDuration = slides.reduce((acc, slide) => acc + (slide.durationMs || slideDurationMs), 0)
    const currentTime = slides.slice(0, currentIndex).reduce((acc, slide) => acc + (slide.durationMs || slideDurationMs), 0) +
      (progress / 100) * (currentSlide?.durationMs || slideDurationMs)

    const timeRemaining = totalDuration - currentTime

    // Start fade out when we're within musicFadeOutMs of the end
    if (timeRemaining <= musicFadeOutMs && currentIndex === totalSlides - 1) {
      const targetVolume = Math.max(0, (timeRemaining / musicFadeOutMs) * 0.5)
      audioRef.current.volume = targetVolume
    } else if (audioRef.current.volume < 0.5) {
      audioRef.current.volume = 0.5
    }
  }, [currentIndex, progress, slides, slideDurationMs, currentSlide, musicFadeOutMs, totalSlides, isPlaying, isMuted])

  // Auto-advance slides
  const goToNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setPreviousIndex(currentIndex)
      setIsTransitioning(true)
      setCurrentTransition(getTransitionForSlide(currentIndex + 1))
      setCurrentIndex((prev) => prev + 1)
      setProgress(0)

      // End transition after duration
      setTimeout(() => {
        setIsTransitioning(false)
        setPreviousIndex(null)
      }, transitionDurationMs)
    } else {
      // End of presentation
      setIsPlaying(false)
    }
  }, [currentIndex, totalSlides, transitionDurationMs, getTransitionForSlide])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setPreviousIndex(currentIndex)
      setIsTransitioning(true)
      setCurrentTransition(getTransitionForSlide(currentIndex - 1))
      setCurrentIndex((prev) => prev - 1)
      setProgress(0)

      setTimeout(() => {
        setIsTransitioning(false)
        setPreviousIndex(null)
      }, transitionDurationMs)
    }
  }, [currentIndex, transitionDurationMs, getTransitionForSlide])

  const goToSlide = useCallback((index: number) => {
    if (index !== currentIndex && index >= 0 && index < totalSlides) {
      setPreviousIndex(currentIndex)
      setIsTransitioning(true)
      setCurrentTransition(getTransitionForSlide(index))
      setCurrentIndex(index)
      setProgress(0)

      setTimeout(() => {
        setIsTransitioning(false)
        setPreviousIndex(null)
      }, transitionDurationMs)
    }
  }, [currentIndex, totalSlides, transitionDurationMs, getTransitionForSlide])

  // Handle slide timing
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
      return
    }

    const duration = currentSlide?.durationMs || slideDurationMs
    const updateInterval = 50

    // Progress bar update
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (updateInterval / duration) * 100
        return Math.min(next, 100)
      })
    }, updateInterval)

    // Slide advance
    slideTimerRef.current = setTimeout(goToNext, duration)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current)
      }
    }
  }, [isPlaying, currentIndex, currentSlide, slideDurationMs, goToNext])

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0)
  }, [currentIndex])

  // Background music
  useEffect(() => {
    if (backgroundMusicUrl && !audioRef.current) {
      audioRef.current = new Audio(backgroundMusicUrl)
      audioRef.current.loop = false // Don't loop - we'll handle fade out
      audioRef.current.volume = 0.5
    }

    if (audioRef.current) {
      audioRef.current.muted = isMuted
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // Autoplay might be blocked
        })
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

  // Get transition styles for entering slide
  const getEnterStyle = (transition: Exclude<TransitionType, 'random'>) => {
    const duration = transitionDurationMs
    const base = { transition: `all ${duration}ms ease-in-out` }

    switch (transition) {
      case 'fade':
        return {
          ...base,
          opacity: isTransitioning ? 0 : 1,
        }
      case 'zoom':
        return {
          ...base,
          transform: isTransitioning ? 'scale(1.1)' : 'scale(1)',
          opacity: isTransitioning ? 0 : 1,
        }
      case 'slide':
        return {
          ...base,
          transform: isTransitioning ? 'translateX(100%)' : 'translateX(0)',
        }
      case 'blur':
        return {
          ...base,
          filter: isTransitioning ? 'blur(20px)' : 'blur(0)',
          opacity: isTransitioning ? 0 : 1,
        }
      case 'none':
      default:
        return {}
    }
  }

  // Get transition styles for exiting slide
  const getExitStyle = (transition: Exclude<TransitionType, 'random'>) => {
    const duration = transitionDurationMs
    const base = { transition: `all ${duration}ms ease-in-out` }

    switch (transition) {
      case 'fade':
        return {
          ...base,
          opacity: isTransitioning ? 0 : 1,
        }
      case 'zoom':
        return {
          ...base,
          transform: isTransitioning ? 'scale(0.9)' : 'scale(1)',
          opacity: isTransitioning ? 0 : 1,
        }
      case 'slide':
        return {
          ...base,
          transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)',
        }
      case 'blur':
        return {
          ...base,
          filter: isTransitioning ? 'blur(20px)' : 'blur(0)',
          opacity: isTransitioning ? 0 : 1,
        }
      case 'none':
      default:
        return {}
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={showControlsTemporarily}
      onClick={togglePlay}
    >
      {/* Previous slide (for transition) */}
      {isTransitioning && previousSlide && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={previousSlide.imageUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={getExitStyle(currentTransition)}
          />
        </div>
      )}

      {/* Current slide */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          key={currentSlide?.id}
          src={currentSlide?.imageUrl}
          alt=""
          className="max-w-full max-h-full object-contain"
          style={getEnterStyle(currentTransition)}
        />
      </div>

      {/* Caption */}
      {currentSlide?.caption && (
        <div
          className={`absolute bottom-24 left-0 right-0 text-center transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="inline-block px-6 py-3 bg-black/70 rounded-lg text-white text-lg">
            {currentSlide.caption}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
        <div
          className="h-full bg-accent transition-all duration-50"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide indicators */}
      <div
        className={`absolute top-4 left-0 right-0 flex justify-center gap-1 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation()
              goToSlide(index)
            }}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-accent' : 'bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
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

          {/* Center - slide count */}
          <div className="text-sm text-white/70">
            {currentIndex + 1} / {totalSlides}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-4">
            {backgroundMusicUrl && (
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
        className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/50 hover:bg-black/70 transition-all disabled:opacity-0 ${
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
        className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/50 hover:bg-black/70 transition-all disabled:opacity-0 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ChevronRight size={32} />
      </button>
    </div>
  )
}
