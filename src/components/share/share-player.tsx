'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, Play } from 'lucide-react'
import { SlideshowPlayer } from '@/components/watch/slideshow-player'
import { waitForBufferedAhead } from '@/lib/media/buffer'

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

  // Video sources live in state and are rendered as the `src` attribute.
  // They must NOT be assigned onto the refs from the loader — while playState is
  // 'loading' the <video> elements are not mounted yet, so the refs are still null
  // and the assignment is silently dropped, leaving a source-less player.
  const [mainVideoUrl, setMainVideoUrl] = useState<string | null>(null)
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null)
  const [introFailed, setIntroFailed] = useState(false)

  const mainVideoRef = useRef<HTMLVideoElement>(null)
  const introVideoRef = useRef<HTMLVideoElement>(null)
  const usedSignedMainUrlRef = useRef(false)

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
          // Resolve the main video URL — prefer a signed URL for direct storage
          // access, fall back to the media proxy.
          const signedUrl = await fetchSignedUrl(clipData.videoPath)
          usedSignedMainUrlRef.current = !!signedUrl
          setMainVideoUrl(signedUrl || `/api/media/files/${clipData.videoPath}`)

          // Resolve the intro URL if there is one
          if (json.data.introClip) {
            const introData = json.data.introClip as IntroData
            const introUrl = await fetchSignedUrl(introData.videoPath)
            setIntroVideoUrl(introUrl || `/api/media/files/${introData.videoPath}`)
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

  // Whether the intro should be played before the main video
  const playIntroFirst = !!introClip && !!introVideoUrl && !introFailed

  const handleIntroEnded = useCallback(async () => {
    if (clip?.videoPath === 'presentation') {
      setPlayState('presentation')
      return
    }

    const video = mainVideoRef.current
    if (!video) return

    setPlayState('main')
    try {
      await waitForBufferedAhead(video)
      await video.play()
    } catch {
      // Autoplay blocked after the intro — offer the tap-to-play overlay rather
      // than dead-ending the viewer on an error screen.
      setNeedsUserPlay(true)
    }
  }, [clip])

  // Auto-play when ready — only once the source is actually attached to the element
  useEffect(() => {
    if (playState !== 'ready') return

    if (clip?.videoPath === 'presentation') {
      setPlayState('presentation')
      return
    }

    if (!mainVideoUrl) return
    // Wait for the intro URL to resolve before deciding which element to start
    if (introClip && !introVideoUrl && !introFailed) return

    async function startPlayback() {
      const videoToPlay = playIntroFirst ? introVideoRef.current : mainVideoRef.current
      if (!videoToPlay) return

      try {
        await waitForBufferedAhead(videoToPlay)
        await videoToPlay.play()
        setPlayState(playIntroFirst ? 'intro' : 'main')
      } catch {
        setNeedsUserPlay(true)
      }
    }

    startPlayback()
  }, [playState, clip, introClip, mainVideoUrl, introVideoUrl, introFailed, playIntroFirst])

  // Intro failsafe — a share recipient must never be stranded on a black screen
  // because the intro never loaded. Skip to the main video if it hasn't started.
  useEffect(() => {
    if (playState !== 'intro') return

    const timer = setTimeout(() => {
      const video = introVideoRef.current
      if (video && (video.paused || video.readyState < 2)) {
        setIntroFailed(true)
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [playState])

  // Move on to the main video as soon as the intro is marked failed
  useEffect(() => {
    if (!introFailed) return
    if (playState !== 'intro') return
    handleIntroEnded()
  }, [introFailed, playState, handleIntroEnded])

  const handleUserPlay = async () => {
    setNeedsUserPlay(false)
    const videoToPlay = playIntroFirst ? introVideoRef.current : mainVideoRef.current
    if (!videoToPlay) return

    try {
      await videoToPlay.play()
      setPlayState(playIntroFirst ? 'intro' : 'main')
    } catch {
      setPlayState('error')
      setErrorMessage('Unable to play video')
    }
  }

  // If the signed storage URL fails to decode, retry through the media proxy,
  // which serves correct Content-Type headers. Same recovery as the watch page.
  const handleMainError = () => {
    const video = mainVideoRef.current
    if (!video?.error || !clip) return

    if (usedSignedMainUrlRef.current && video.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      console.log('[Share] Signed URL failed, falling back to media proxy')
      usedSignedMainUrlRef.current = false
      setMainVideoUrl(`/api/media/files/${clip.videoPath}`)
      return
    }

    console.error('[Share] Video error:', video.error.code, video.error.message)

    // Only hard-fail if the video never started. Once it is playing, a transient
    // network error should leave the native controls in place to recover from
    // rather than replacing the player with an error screen.
    if (video.currentTime === 0) {
      setPlayState('error')
      setErrorMessage('Unable to play this video')
    }
  }

  const handleIntroError = () => {
    console.warn('[Share] Intro failed to load, skipping to main video')
    setIntroFailed(true)
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
      {introVideoUrl && !introFailed && (
        <video
          ref={introVideoRef}
          src={introVideoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          preload="auto"
          onEnded={handleIntroEnded}
          onError={handleIntroError}
          style={{ display: playState === 'intro' ? 'block' : 'none' }}
        />
      )}

      {/* Main video */}
      {mainVideoUrl && (
        <video
          ref={mainVideoRef}
          src={mainVideoUrl}
          className="w-full h-full max-h-screen object-contain"
          playsInline
          controls
          controlsList="nodownload"
          // Once the intro is actually playing, buffer the main video so the
          // handover is instant rather than stalling while it loads from cold.
          preload={playIntroFirst && playState !== 'intro' ? 'metadata' : 'auto'}
          onEnded={handleMainEnded}
          onError={handleMainError}
          style={{
            display:
              playState === 'main' || (playState === 'ready' && !playIntroFirst)
                ? 'block'
                : 'none',
          }}
        />
      )}

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
