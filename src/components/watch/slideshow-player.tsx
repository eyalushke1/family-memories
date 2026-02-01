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

  // Transition phases: 'entering' (fade in), 'visible' (fully shown), 'exiting' (fade out)
  const [slidePhase, setSlidePhase] = useState<'entering' | 'visible' | 'exiting'>('entering')
  const [currentTransition, setCurrentTransition] = useState<Exclude<TransitionType, 'random'>>('fade')

  const audioRef = useRef<HTMLAudioElement | null>(null)
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

  // Handle slide phase transitions
  const startSlidePhases = useCallback(() => {
    const duration = currentSlide?.durationMs || slideDurationMs
    const enterDuration = transitionDurationMs
    const exitDuration = transitionDurationMs

    // Clear any existing timers
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)

    // Start in entering phase
    setSlidePhase('entering')

    // After enter transition, switch to visible
    enterTimerRef.current = setTimeout(() => {
      setSlidePhase('visible')
    }, enterDuration)

    // Before slide ends, start exiting phase
    exitTimerRef.current = setTimeout(() => {
      setSlidePhase('exiting')
    }, duration - exitDuration)
  }, [currentSlide, slideDurationMs, transitionDurationMs])

  // Auto-advance slides
  const goToNext = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      setPreviousIndex(currentIndex)
      setCurrentTransition(getTransitionForSlide(currentIndex + 1))
      setCurrentIndex((prev) => prev + 1)
      setProgress(0)
    } else {
      // End of presentation
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
      return
    }

    const duration = currentSlide?.durationMs || slideDurationMs
    const updateInterval = 50

    // Start slide phases
    startSlidePhases()

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
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [isPlaying, currentIndex, currentSlide, slideDurationMs, goToNext, startSlidePhases])

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0)
    // Clear previous slide after transition completes
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

  // Get transition styles for current slide based on phase
  const getCurrentSlideStyle = (transition: Exclude<TransitionType, 'random'>) => {
    const duration = transitionDurationMs
    const base = { transition: `all ${duration}ms ease-in-out` }

    if (transition === 'none') return {}

    switch (transition) {
      case 'fade':
        return {
          ...base,
          opacity: slidePhase === 'entering' ? 0 : slidePhase === 'exiting' ? 0 : 1,
        }
      case 'zoom':
        // Ken Burns-like effect: slight zoom during display
        return {
          ...base,
          transform: slidePhase === 'entering'
            ? 'scale(1.05)'
            : slidePhase === 'exiting'
            ? 'scale(0.95)'
            : 'scale(1)',
          opacity: slidePhase === 'entering' ? 0 : slidePhase === 'exiting' ? 0 : 1,
        }
      case 'slide':
        return {
          ...base,
          transform: slidePhase === 'entering'
            ? 'translateX(50px)'
            : slidePhase === 'exiting'
            ? 'translateX(-50px)'
            : 'translateX(0)',
          opacity: slidePhase === 'entering' ? 0 : slidePhase === 'exiting' ? 0 : 1,
        }
      case 'blur':
        return {
          ...base,
          filter: slidePhase === 'entering'
            ? 'blur(15px)'
            : slidePhase === 'exiting'
            ? 'blur(15px)'
            : 'blur(0)',
          opacity: slidePhase === 'entering' ? 0 : slidePhase === 'exiting' ? 0 : 1,
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
        return {
          ...base,
          opacity: 0,
        }
      case 'zoom':
        return {
          ...base,
          transform: 'scale(0.9)',
          opacity: 0,
        }
      case 'slide':
        return {
          ...base,
          transform: 'translateX(-100px)',
          opacity: 0,
        }
      case 'blur':
        return {
          ...base,
          filter: 'blur(20px)',
          opacity: 0,
        }
      default:
        return { opacity: 0 }
    }
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
          <img
            src={previousSlide.imageUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            style={getPreviousSlideStyle(currentTransition)}
          />
        </div>
      )}

      {/* Current slide */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <img
          key={currentSlide?.id}
          src={currentSlide?.imageUrl}
          alt=""
          className="max-w-full max-h-full object-contain"
          style={getCurrentSlideStyle(currentTransition)}
        />
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
