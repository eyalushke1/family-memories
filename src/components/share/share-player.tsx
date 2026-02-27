'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, Play } from 'lucide-react'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'

interface ClipData {
  id: string
  title: string
  description: string | null
  videoPath: string
  thumbnailPath: string | null
  durationSeconds: number | null
}

interface IntroData {
  id: string
  videoPath: string
  durationSeconds: number | null
}

interface PresentationData {
  id: string
  slideDurationMs: number
  transitionType: string
  transitionDurationMs: number
  backgroundMusicUrl?: string | null
  backgroundMusicUrls?: string[]
  musicFadeOutMs?: number
  muteVideoAudio?: boolean
  slides: Array<{
    id: string
    mediaUrl: string
    mediaType?: 'image' | 'video'
    caption?: string
    durationMs?: number
  }>
}

interface SharePlayerProps {
  shareToken: string
}

type PlayState = 'loading' | 'ready' | 'intro' | 'main' | 'presentation' | 'expired' | 'error'

export function SharePlayer({ shareToken }: SharePlayerProps) {
  const [playState, setPlayState] = useState<PlayState>('loading')
  const [clip, setClip] = useState<ClipData | null>(null)
  const [introClip, setIntroClip] = useState<IntroData | null>(null)
  const [presentation, setPresentation] = useState<PresentationData | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [needsUserPlay, setNeedsUserPlay] = useState(false)

  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const introVideoRef = useRef<HTMLVideoElement>(null)

  const fetchSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/media/signed-url/${storagePath}`)
      const json = await res.json()
      if (json.success && json.url) return json.url
    } catch {
      // Fall back to proxy
    }
    return null
  }, [])

  // Load share data
  useEffect(() => {
    async function loadShare() {
      try {
        const res = await fetch(`/api/shares/${shareToken}`)
        const json = await res.json()

        if (!json.success) {
          if (res.status === 410) {
            setPlayState('expired')
            setErrorMessage(json.error || 'This share link has expired')
          } else {
            setPlayState('error')
            setErrorMessage(json.error || 'Failed to load shared clip')
          }
          return
        }

        setClip(json.data.clip)
        setIntroClip(json.data.introClip)

        // Load video source
        const clipData = json.data.clip as ClipData
        if (clipData.videoPath === 'presentation') {
          // Fetch presentation data from the presentations API (resolves media URLs)
          const presRes = await fetch(`/api/presentations/${clipData.id}`)
          const presJson = await presRes.json()
          if (presJson.success && presJson.data) {
            setPresentation(presJson.data)
          }
          setPlayState('ready')
        } else {
          // Load video URL
          const signedUrl = await fetchSignedUrl(clipData.videoPath)
          const videoUrl = signedUrl || `/api/media/files/${clipData.videoPath}`

          // Load intro if exists
          if (json.data.introClip) {
            const introData = json.data.introClip as IntroData
            const introUrl = await fetchSignedUrl(introData.videoPath)
            if (introVideoRef.current) {
              introVideoRef.current.src = introUrl || `/api/media/files/${introData.videoPath}`
            }
          }

          if (mainVideoRef.current) {
            mainVideoRef.current.src = videoUrl
          }

          setPlayState('ready')
        }
      } catch (err) {
        console.error('[Share] Failed to load:', err)
        setPlayState('error')
        setErrorMessage('Failed to load shared clip')
      }
    }

    loadShare()
  }, [shareToken, fetchSignedUrl])

  // Auto-play when ready
  useEffect(() => {
    if (playState !== 'ready') return

    async function startPlayback() {
      if (clip?.videoPath === 'presentation') {
        setPlayState('presentation')
        return
      }

      const videoToPlay = introClip ? introVideoRef.current : mainVideoRef.current
      if (!videoToPlay) return

      try {
        await videoToPlay.play()
        setPlayState(introClip ? 'intro' : 'main')
      } catch {
        setNeedsUserPlay(true)
      }
    }

    startPlayback()
  }, [playState, clip, introClip])

  const handleUserPlay = async () => {
    setNeedsUserPlay(false)
    const videoToPlay = introClip ? introVideoRef.current : mainVideoRef.current
    if (!videoToPlay) return

    try {
      await videoToPlay.play()
      setPlayState(introClip ? 'intro' : 'main')
    } catch {
      setPlayState('error')
      setErrorMessage('Unable to play video')
    }
  }

  const handleIntroEnded = async () => {
    if (introVideoRef.current) {
      introVideoRef.current.style.display = 'none'
    }

    if (clip?.videoPath === 'presentation') {
      setPlayState('presentation')
      return
    }

    if (mainVideoRef.current) {
      try {
        await mainVideoRef.current.play()
        setPlayState('main')
      } catch {
        setPlayState('error')
      }
    }
  }

  const handleMainEnded = () => {
    // Just show replay option or stay on last frame
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = 0
    }
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Family Memories'

  // ── Expired state ──
  if (playState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
          <p className="text-white/60">{errorMessage}</p>
          <p className="text-white/40 text-sm mt-4">
            Contact the person who shared this clip for a new link.
          </p>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (playState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Unable to Play</h1>
          <p className="text-white/60">{errorMessage}</p>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (playState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin mx-auto mb-4 text-white/60" />
          <p className="text-white/60">Loading shared clip...</p>
        </div>
      </div>
    )
  }

  // ── Presentation playback ──
  if (playState === 'presentation' && presentation && clip) {
    return (
      <div className="min-h-screen bg-black relative">
        {/* Title overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <h1 className="text-white text-lg font-medium">{clip.title}</h1>
          <p className="text-white/40 text-xs mt-1">Shared from {appName}</p>
        </div>
        <SlideshowPlayer presentationData={presentation as React.ComponentProps<typeof SlideshowPlayer>['presentationData']} />
      </div>
    )
  }

  // ── Video playback ──
  return (
    <div className="min-h-screen bg-black relative flex items-center justify-center">
      {/* Title overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <h1 className="text-white text-lg font-medium">{clip?.title}</h1>
        <p className="text-white/40 text-xs mt-1">Shared from {appName}</p>
      </div>

      {/* Intro video (hidden when not playing) */}
      {introClip && (
        <video
          ref={introVideoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          onEnded={handleIntroEnded}
          style={{ display: playState === 'intro' ? 'block' : 'none' }}
        />
      )}

      {/* Main video */}
      <video
        ref={mainVideoRef}
        className="w-full h-full max-h-screen object-contain"
        playsInline
        controls
        controlsList="nodownload"
        onEnded={handleMainEnded}
        style={{ display: playState === 'main' || playState === 'ready' ? 'block' : 'none' }}
      />

      {/* Tap to play overlay */}
      {needsUserPlay && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer z-20"
          onClick={handleUserPlay}
        >
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Play size={36} className="text-white ml-1" />
            </div>
            <p className="text-white text-lg font-medium">{clip?.title}</p>
            <p className="text-white/60 text-sm mt-1">Tap to play</p>
          </div>
        </div>
      )}
    </div>
  )
}
