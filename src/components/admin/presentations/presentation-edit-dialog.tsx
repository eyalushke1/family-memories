'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Presentation,
  Loader2,
  Music,
  Volume2,
  VolumeX,
  Check,
  Sparkles,
  Upload,
  Shuffle,
  VideoOff,
  Video,
  GripVertical,
  Clock,
  Trash2,
  Save,
  Type,
  MessageSquare,
  Plus,
  ImagePlus,
} from 'lucide-react'
import { SortableList } from '@/components/admin/shared/sortable-list'
import { SortableItem } from '@/components/admin/shared/sortable-item'
import type { PresentationRow, PresentationSlideRow } from '@/types/database'

interface UploadedMusicFile {
  path: string
  filename: string
  displayName: string
  artist: string | null
  album: string | null
  durationSeconds: number | null
  durationFormatted: string | null
  year: number | null
  genre: string | null
  size: number | null
  uploadedAt: string | null
}

interface NewUploadedMusic {
  name: string
  file: File
  previewUrl: string
}

interface PresentationWithSlides extends PresentationRow {
  slides: PresentationSlideRow[]
}

interface PresentationEditDialogProps {
  presentationId: string
  onClose: () => void
  onSave: () => void
}

const TRANSITION_EFFECTS = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'blur', label: 'Blur' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'flip', label: 'Flip' },
  { value: 'kenburns', label: 'Ken Burns' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'none', label: 'None' },
]

export function PresentationEditDialog({
  presentationId,
  onClose,
  onSave,
}: PresentationEditDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [presentation, setPresentation] = useState<PresentationWithSlides | null>(null)
  const [slides, setSlides] = useState<PresentationSlideRow[]>([])

  // Settings state
  const [slideDurationMs, setSlideDurationMs] = useState(5000)
  const [transitionType, setTransitionType] = useState('fade')
  const [useRandomTransition, setUseRandomTransition] = useState(false)
  const [muteVideoAudio, setMuteVideoAudio] = useState(true)
  const [musicFadeOutMs, setMusicFadeOutMs] = useState(3000)

  // Music state - supports multiple tracks
  const [uploadedMusicFiles, setUploadedMusicFiles] = useState<UploadedMusicFile[]>([])
  const [selectedMusicPaths, setSelectedMusicPaths] = useState<string[]>([])
  const [newUploadedMusicList, setNewUploadedMusicList] = useState<NewUploadedMusic[]>([])
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const [playingMusicPath, setPlayingMusicPath] = useState<string | null>(null)

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Caption editing state
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState('')
  const [savingCaption, setSavingCaption] = useState(false)

  // Add photos state
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [addPhotosStatus, setAddPhotosStatus] = useState('')

  // Thumbnail picker state
  const [thumbnailOptions, setThumbnailOptions] = useState<string[]>([])
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null)
  const [generatingAnimated, setGeneratingAnimated] = useState(false)

  const musicInputRef = useRef<HTMLInputElement>(null)

  // Fetch presentation data
  useEffect(() => {
    async function fetchPresentation() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/presentations/${presentationId}`)
        const data = await res.json()

        if (data.success) {
          const pres = data.data as PresentationWithSlides & { clip?: { id: string; thumbnail_path: string | null } }
          setPresentation(pres)
          setSlides(pres.slides.sort((a, b) => a.sort_order - b.sort_order))
          setSlideDurationMs(pres.slide_duration_ms)
          setTransitionType(pres.transition_type === 'random' ? 'fade' : pres.transition_type)
          setUseRandomTransition(pres.transition_type === 'random')
          setMuteVideoAudio(pres.mute_video_audio)
          setMusicFadeOutMs(pres.music_fade_out_ms)
          // Load multi-track paths, fall back to single path
          const paths = pres.background_music_paths && pres.background_music_paths.length > 0
            ? pres.background_music_paths
            : pres.background_music_path ? [pres.background_music_path] : []
          setSelectedMusicPaths(paths)

          // Generate thumbnail options from random slides
          const sortedSlides = pres.slides.sort((a, b) => a.sort_order - b.sort_order)
          const imageSlides = sortedSlides.filter((s) =>
            !s.image_path.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/)
          )
          if (imageSlides.length > 0) {
            const shuffled = [...imageSlides].sort(() => Math.random() - 0.5)
            const picks = shuffled.slice(0, Math.min(3, shuffled.length))
            setThumbnailOptions(picks.map((s) => s.image_path))
          }
          // Set current thumbnail
          if (pres.clip?.thumbnail_path) {
            setSelectedThumbnail(pres.clip.thumbnail_path)
          }
        } else {
          setError(data.error || 'Failed to load presentation')
        }
      } catch (err) {
        setError('Failed to load presentation')
      } finally {
        setLoading(false)
      }
    }

    fetchPresentation()
  }, [presentationId])

  // Fetch uploaded music
  useEffect(() => {
    async function fetchUploadedMusic() {
      setLoadingMusic(true)
      try {
        const res = await fetch('/api/admin/uploaded-music')
        const data = await res.json()
        if (data.success) {
          setUploadedMusicFiles(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch uploaded music:', err)
      } finally {
        setLoadingMusic(false)
      }
    }
    fetchUploadedMusic()
  }, [])

  // After both presentation data and music library are loaded,
  // filter out stale music paths that no longer exist in storage
  useEffect(() => {
    if (!presentation || loadingMusic) return
    const validPaths = new Set(uploadedMusicFiles.map((m) => m.path))
    setSelectedMusicPaths((prev) => {
      const filtered = prev.filter((p) => validPaths.has(p))
      if (filtered.length !== prev.length) {
        setHasChanges(true)
      }
      return filtered
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation, uploadedMusicFiles, loadingMusic])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause()
        previewAudio.src = ''
      }
      for (const m of newUploadedMusicList) {
        URL.revokeObjectURL(m.previewUrl)
      }
    }
  }, [previewAudio, newUploadedMusicList])

  const toggleMusicPreview = (path: string, newUploadIndex?: number) => {
    const trackId = newUploadIndex !== undefined ? `new-upload-${newUploadIndex}` : path

    if (playingMusicPath === trackId) {
      previewAudio?.pause()
      setPlayingMusicPath(null)
    } else {
      if (previewAudio) {
        previewAudio.pause()
      }
      const audioSrc = newUploadIndex !== undefined
        ? newUploadedMusicList[newUploadIndex].previewUrl
        : `/api/media/files/${path}`
      const audio = new Audio(audioSrc)
      audio.volume = 0.5
      audio.play()
      audio.onended = () => setPlayingMusicPath(null)
      setPreviewAudio(audio)
      setPlayingMusicPath(trackId)
    }
  }

  const toggleExistingMusicPath = (path: string) => {
    setSelectedMusicPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
    setHasChanges(true)
  }

  const getMusicFileByPath = (path: string) =>
    uploadedMusicFiles.find((m) => m.path === path)

  const handleMusicReorder = (reorderedItems: { id: string }[]) => {
    setSelectedMusicPaths(reorderedItems.map((item) => item.id))
    setHasChanges(true)
  }

  const removeNewUpload = (index: number) => {
    setNewUploadedMusicList((prev) => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    setHasChanges(true)
  }

  const deleteUploadedMusic = async (path: string) => {
    try {
      const res = await fetch('/api/admin/uploaded-music', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (res.ok) {
        setUploadedMusicFiles((prev) => prev.filter((m) => m.path !== path))
        setSelectedMusicPaths((prev) => prev.filter((p) => p !== path))
        if (playingMusicPath === path) {
          previewAudio?.pause()
          setPlayingMusicPath(null)
        }
        setHasChanges(true)
      }
    } catch {
      // Silently fail
    }
  }

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (mp3, wav, etc.)')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setNewUploadedMusicList((prev) => [
      ...prev,
      { name: file.name.replace(/\.[^/.]+$/, ''), file, previewUrl },
    ])
    setHasChanges(true)
    setError('')
    if (musicInputRef.current) {
      musicInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newSlides = [...slides]
    const draggedSlide = newSlides[draggedIndex]
    newSlides.splice(draggedIndex, 1)
    newSlides.splice(index, 0, draggedSlide)
    setSlides(newSlides)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Caption editing handlers
  const handleSelectSlide = (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId)
    setSelectedSlideId(slideId)
    setEditingCaption(slide?.caption || '')
  }

  const handleSaveCaption = async () => {
    if (!selectedSlideId || !presentationId) return

    setSavingCaption(true)
    try {
      const res = await fetch(`/api/admin/presentations/${presentationId}/slides`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideId: selectedSlideId,
          caption: editingCaption || null,
        }),
      })
      const data = await res.json()

      if (data.success) {
        // Update local state
        setSlides(slides.map((s) =>
          s.id === selectedSlideId ? { ...s, caption: editingCaption || null } : s
        ))
        setHasChanges(true)
      } else {
        setError(data.error || 'Failed to save caption')
      }
    } catch (err) {
      setError('Failed to save caption')
    } finally {
      setSavingCaption(false)
    }
  }

  const handleDeleteSlide = async (slideId: string) => {
    if (slides.length <= 1) {
      setError('Cannot delete the last slide')
      return
    }

    try {
      const res = await fetch(
        `/api/admin/presentations/${presentationId}/slides?slideId=${slideId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()

      if (data.success) {
        setSlides(slides.filter((s) => s.id !== slideId))
        setHasChanges(true)
      } else {
        setError(data.error || 'Failed to delete slide')
      }
    } catch (err) {
      setError('Failed to delete slide')
    }
  }

  const handleSetThumbnail = async (imagePath: string) => {
    const clipId = (presentation as any)?.clip?.id || presentation?.clip_id
    if (!clipId) return

    setSelectedThumbnail(imagePath)
    setHasChanges(true)

    try {
      await fetch(`/api/admin/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnail_path: imagePath }),
      })
    } catch (err) {
      console.error('Failed to update thumbnail:', err)
      setError('Failed to update thumbnail')
    }
  }

  const handleGenerateAnimatedThumbnail = async () => {
    const clipId = (presentation as any)?.clip?.id || presentation?.clip_id
    if (!clipId || slides.length < 2) return

    setGeneratingAnimated(true)
    setError('')

    try {
      // Pick up to 6 evenly-spaced image slides
      const imageSlides = slides.filter(
        (s) => !s.image_path.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/)
      )
      const step = Math.max(1, Math.floor(imageSlides.length / 6))
      const selectedSlides = imageSlides.filter((_, i) => i % step === 0).slice(0, 6)

      if (selectedSlides.length < 2) {
        setError('Need at least 2 image slides to generate preview')
        return
      }

      // Load images
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = src
        })

      const images = await Promise.all(
        selectedSlides.map((s) => loadImage(`/api/media/files/${s.image_path}`))
      )

      // Create canvas and record animation
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const ctx = canvas.getContext('2d')!

      const stream = canvas.captureStream(10)
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 1000000,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
      })

      recorder.start()

      // Draw each image for ~500ms
      for (const img of images) {
        const aspectRatio = img.naturalWidth / img.naturalHeight
        const canvasAspect = canvas.width / canvas.height

        let drawWidth = canvas.width
        let drawHeight = canvas.height
        let offsetX = 0
        let offsetY = 0

        if (aspectRatio > canvasAspect) {
          drawHeight = canvas.width / aspectRatio
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          drawWidth = canvas.height * aspectRatio
          offsetX = (canvas.width - drawWidth) / 2
        }

        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

        // Wait 500ms per frame
        await new Promise((r) => setTimeout(r, 500))
      }

      recorder.stop()
      const blob = await recordingDone

      // Upload the animated thumbnail
      const formData = new FormData()
      formData.append('file', new File([blob], 'animated-thumbnail.webm', { type: 'video/webm' }))
      formData.append('type', 'animated-thumbnail')
      formData.append('id', clipId)

      const uploadRes = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (uploadData.success) {
        await fetch(`/api/admin/clips/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animated_thumbnail_path: uploadData.data.path }),
        })
      }
    } catch (err) {
      console.error('Failed to generate animated thumbnail:', err)
      setError('Failed to generate animated preview')
    } finally {
      setGeneratingAnimated(false)
    }
  }

  const handleAddPhotos = async () => {
    setAddingPhotos(true)
    setAddPhotosStatus('Opening Google Photos...')
    setError('')

    try {
      // 1. Create picker session
      const sessionRes = await fetch('/api/admin/google-photos/picker/session', { method: 'POST' })
      const sessionData = await sessionRes.json()
      if (!sessionData.success) throw new Error(sessionData.error || 'Failed to create picker session')

      const { sessionId, pickerUri } = sessionData.data
      const pollInterval = sessionData.data.pollingConfig?.pollInterval
        ? parseInt(sessionData.data.pollingConfig.pollInterval.replace('s', '')) * 1000
        : 5000

      // 2. Open picker popup
      const popup = window.open(pickerUri, 'google-photos-picker', 'width=800,height=600,popup=true')
      if (!popup) throw new Error('Failed to open picker window. Please allow popups.')

      setAddPhotosStatus('Waiting for photo selection...')

      // 3. Poll until selection is done
      const pollStart = Date.now()
      const pollTimeout = 30 * 60 * 1000
      while (true) {
        if (Date.now() - pollStart > pollTimeout) throw new Error('Picker session timed out')
        await new Promise((r) => setTimeout(r, pollInterval))

        const checkRes = await fetch(`/api/admin/google-photos/picker/session/${sessionId}`)
        const checkData = await checkRes.json()
        if (checkData.data?.mediaItemsSet) break
      }

      // 4. Fetch selected media items
      setAddPhotosStatus('Fetching selected photos...')
      const allItems: any[] = []
      let pageToken: string | undefined
      do {
        const url = pageToken
          ? `/api/admin/google-photos/picker/media?sessionId=${sessionId}&pageToken=${encodeURIComponent(pageToken)}`
          : `/api/admin/google-photos/picker/media?sessionId=${sessionId}`
        const mediaRes = await fetch(url)
        const mediaData = await mediaRes.json()
        if (!mediaData.success) throw new Error(mediaData.error || 'Failed to fetch media')
        allItems.push(...mediaData.data.items)
        pageToken = mediaData.data.nextPageToken
      } while (pageToken)

      // Cleanup session
      fetch(`/api/admin/google-photos/picker/session/${sessionId}`, { method: 'DELETE' }).catch(() => {})

      if (allItems.length === 0) {
        setAddPhotosStatus('')
        setAddingPhotos(false)
        return
      }

      // 5. Import photos (download only, no presentation creation)
      setAddPhotosStatus(`Importing ${allItems.length} photos...`)
      const importRes = await fetch('/api/admin/google-photos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItems: allItems.map((item: any) => ({
            id: item.id,
            filename: item.filename,
            mimeType: item.mimeType,
            baseUrl: item.baseUrl,
            thumbnailUrl: item.thumbnailUrl,
            downloadUrl: item.downloadUrl,
            createTime: item.createTime,
            width: String(item.width || 0),
            height: String(item.height || 0),
            isVideo: item.isVideo,
          })),
          importOnly: true,
        }),
      })
      const importData = await importRes.json()
      if (!importData.success && importData.data?.completedItems === 0) {
        throw new Error('Failed to import photos')
      }

      // 6. Add imported items as slides
      const imported = importData.data?.imported || []
      setAddPhotosStatus(`Adding ${imported.length} slides...`)

      const currentMaxOrder = slides.length > 0 ? Math.max(...slides.map((s) => s.sort_order)) : -1

      for (let i = 0; i < imported.length; i++) {
        const item = imported[i]
        const isVideo = item.filename.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/)
        const res = await fetch(`/api/admin/presentations/${presentationId}/slides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_path: item.storagePath,
            media_type: isVideo ? 'video' : 'image',
            sort_order: currentMaxOrder + 1 + i,
            google_photos_id: item.googleMediaId,
          }),
        })
        const slideData = await res.json()
        if (slideData.success) {
          setSlides((prev) => [...prev, slideData.data])
        }
      }

      setHasChanges(true)
      setAddPhotosStatus('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add photos')
    } finally {
      setAddingPhotos(false)
      setAddPhotosStatus('')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      const musicPaths: string[] = [...selectedMusicPaths]

      // Upload all new music files
      for (let i = 0; i < newUploadedMusicList.length; i++) {
        const musicFile = newUploadedMusicList[i]
        const formData = new FormData()
        formData.append('file', musicFile.file)

        const uploadRes = await fetch('/api/admin/google-photos/upload-music', {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          const text = await uploadRes.text()
          throw new Error(`Music upload failed (${uploadRes.status}): ${text.substring(0, 100)}`)
        }
        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Failed to upload music')
        }
        musicPaths.push(uploadData.data.path)
      }

      // Update presentation settings
      const res = await fetch(`/api/admin/presentations/${presentationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide_duration_ms: slideDurationMs,
          transition_type: useRandomTransition ? 'random' : transitionType,
          background_music_path: musicPaths[0] || null,
          background_music_paths: musicPaths,
          music_fade_out_ms: musicFadeOutMs,
          mute_video_audio: muteVideoAudio,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to update presentation')
      }

      // Update slide order if changed
      const slideIds = slides.map((s) => s.id)
      await fetch(`/api/admin/presentations/${presentationId}/slides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide_ids: slideIds }),
      })

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const hasMusic = selectedMusicPaths.length > 0 || newUploadedMusicList.length > 0
  const totalMusicCount = selectedMusicPaths.length + newUploadedMusicList.length

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      >
        <div className="flex items-center gap-3 text-white">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading presentation...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
    >
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-accent/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-lg">
              <Presentation size={24} className="text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Edit Presentation</h2>
              <p className="text-sm text-white/60">{slides.length} slides</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Slides Preview */}
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white/80">Slides Order</span>
              <span className="text-xs text-white/40">Drag to reorder, click to edit caption</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleSelectSlide(slide.id)}
                  className={`relative shrink-0 cursor-grab active:cursor-grabbing group ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${selectedSlideId === slide.id ? 'ring-2 ring-accent' : ''}`}
                >
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">
                    {index + 1}
                  </div>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <GripVertical size={14} className="text-white drop-shadow-lg" />
                  </div>
                  {slide.caption && (
                    <div className="absolute bottom-1 left-1 z-10">
                      <MessageSquare size={12} className="text-white drop-shadow-lg" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSlide(slide.id)
                    }}
                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 bg-red-500/80 hover:bg-red-500 rounded"
                  >
                    <Trash2 size={12} className="text-white" />
                  </button>
                  <img
                    src={`/api/media/files/${slide.image_path}`}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover border border-white/10 hover:border-accent transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Add Photos Button */}
            <button
              onClick={handleAddPhotos}
              disabled={addingPhotos || saving}
              className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-white/60 hover:bg-white/5 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
            >
              {addingPhotos ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">{addPhotosStatus || 'Adding photos...'}</span>
                </>
              ) : (
                <>
                  <ImagePlus size={16} />
                  <span className="text-sm">Add Photos from Google</span>
                </>
              )}
            </button>

            {/* Thumbnail Picker */}
            {slides.length >= 1 && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white/80">Clip Thumbnail</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const imageSlides = slides.filter((s) =>
                          !s.image_path.toLowerCase().match(/\.(mp4|mov|avi|webm|mkv)$/)
                        )
                        if (imageSlides.length > 0) {
                          const shuffled = [...imageSlides].sort(() => Math.random() - 0.5)
                          const picks = shuffled.slice(0, Math.min(3, shuffled.length))
                          setThumbnailOptions(picks.map((s) => s.image_path))
                        }
                      }}
                      className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1"
                      title="Show different thumbnail options"
                    >
                      <Shuffle size={12} />
                      Shuffle
                    </button>
                    <button
                      onClick={handleGenerateAnimatedThumbnail}
                      disabled={generatingAnimated || slides.length < 2}
                      className="text-xs px-2 py-1 bg-accent/20 text-accent hover:bg-accent/30 rounded-md disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                      {generatingAnimated ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          Animated Preview
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {thumbnailOptions.length > 0 ? (
                  <div className="flex gap-2">
                    {thumbnailOptions.map((path) => (
                      <button
                        key={path}
                        onClick={() => handleSetThumbnail(path)}
                        className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedThumbnail === path
                            ? 'border-accent'
                            : 'border-transparent hover:border-white/30'
                        }`}
                      >
                        <img
                          src={`/api/media/files/${path}`}
                          alt=""
                          className="w-24 h-16 object-cover"
                        />
                        {selectedThumbnail === path && (
                          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <Check size={16} className="text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">
                    Click &quot;Shuffle&quot; to see thumbnail options from your slides
                  </p>
                )}
                <p className="text-xs text-white/40 mt-2">
                  Select an image to use as the clip thumbnail in the browse view
                </p>
              </div>
            )}

            {/* Caption Editor */}
            {selectedSlideId && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                  <Type size={14} />
                  Slide Caption
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCaption}
                    onChange={(e) => setEditingCaption(e.target.value)}
                    placeholder="Enter caption for this slide..."
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveCaption()
                      if (e.key === 'Escape') setSelectedSlideId(null)
                    }}
                  />
                  <button
                    onClick={handleSaveCaption}
                    disabled={savingCaption}
                    className="px-4 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingCaption ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => setSelectedSlideId(null)}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Caption will be displayed over the slide during playback
                </p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="p-5 space-y-5">
            {/* Slide Duration & Transition */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Slide Duration
                </label>
                <select
                  value={slideDurationMs.toString()}
                  onChange={(e) => {
                    setSlideDurationMs(parseInt(e.target.value))
                    setHasChanges(true)
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.75rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                  }}
                >
                  <option value="3000" className="bg-[#1a1a1a]">3 seconds</option>
                  <option value="5000" className="bg-[#1a1a1a]">5 seconds</option>
                  <option value="7000" className="bg-[#1a1a1a]">7 seconds</option>
                  <option value="10000" className="bg-[#1a1a1a]">10 seconds</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Transition Effect
                </label>
                <div className="flex gap-2">
                  <select
                    value={transitionType}
                    onChange={(e) => {
                      setTransitionType(e.target.value)
                      setHasChanges(true)
                    }}
                    disabled={useRandomTransition}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.75rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                    }}
                  >
                    {TRANSITION_EFFECTS.map((effect) => (
                      <option key={effect.value} value={effect.value} className="bg-[#1a1a1a]">
                        {effect.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setUseRandomTransition(!useRandomTransition)
                      setHasChanges(true)
                    }}
                    className={`px-4 py-3 rounded-xl transition-colors flex items-center gap-2 ${
                      useRandomTransition
                        ? 'bg-accent text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white/60 hover:text-white'
                    }`}
                    title="Random transitions between slides"
                  >
                    <Shuffle size={18} />
                  </button>
                </div>
                {useRandomTransition && (
                  <p className="text-xs text-accent mt-1.5 flex items-center gap-1">
                    <Sparkles size={12} />
                    Random effects will be applied between slides
                  </p>
                )}
              </div>
            </div>

            {/* Video Audio Settings */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  onClick={() => {
                    setMuteVideoAudio(!muteVideoAudio)
                    setHasChanges(true)
                  }}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    muteVideoAudio
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {muteVideoAudio ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <div className="flex-1">
                  <div className="font-medium text-white">Mute Video Audio</div>
                  <div className="text-xs text-white/60">
                    {muteVideoAudio
                      ? 'Video audio will be muted, only background music will play'
                      : 'Video audio will play alongside background music'}
                  </div>
                </div>
              </label>
            </div>

            {/* Background Music */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                <Music size={16} />
                Background Music
                {totalMusicCount > 0 && (
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                    {totalMusicCount} track{totalMusicCount > 1 ? 's' : ''} selected
                  </span>
                )}
              </label>

              <input
                ref={musicInputRef}
                type="file"
                accept="audio/*"
                onChange={handleMusicUpload}
                className="hidden"
              />

              {loadingMusic ? (
                <div className="flex items-center justify-center py-8 bg-white/5 rounded-xl border border-white/10">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                  <span className="ml-2 text-white/40">Loading...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {/* Upload new music option */}
                  <div
                    onClick={() => musicInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed transition-all bg-white/5 border-white/20 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/40 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                      <Upload size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Upload Music</div>
                      <div className="text-xs opacity-60">MP3, WAV, or other audio formats</div>
                    </div>
                    <Plus size={20} className="text-white/40" />
                  </div>

                  {/* Newly uploaded music files */}
                  {newUploadedMusicList.map((music, index) => (
                    <div
                      key={`new-${index}`}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all bg-green-500/20 border-green-500 text-white"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMusicPreview('', index)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          playingMusicPath === `new-upload-${index}`
                            ? 'bg-green-500 text-white'
                            : 'bg-green-500/30 hover:bg-green-500/50'
                        }`}
                      >
                        {playingMusicPath === `new-upload-${index}` ? (
                          <Volume2 size={20} className="animate-pulse" />
                        ) : (
                          <Music size={20} />
                        )}
                      </button>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium truncate">{music.name}</div>
                        <div className="text-xs opacity-60">New upload</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewUpload(index)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  {/* Previously uploaded music files */}
                  {uploadedMusicFiles.length > 0 && (
                    <>
                      <div className="pt-2 pb-1 px-1 text-xs text-white/40 font-medium">
                        Music Library (select multiple)
                      </div>
                      {uploadedMusicFiles.map((music) => {
                        const isSelected = selectedMusicPaths.includes(music.path)
                        return (
                          <div
                            key={music.path}
                            onClick={() => toggleExistingMusicPath(music.path)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-accent/20 border-accent text-white'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMusicPreview(music.path)
                              }}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                playingMusicPath === music.path
                                  ? 'bg-accent text-white'
                                  : isSelected
                                  ? 'bg-accent/30 hover:bg-accent/50'
                                  : 'bg-white/10 hover:bg-white/20'
                              }`}
                            >
                              {playingMusicPath === music.path ? (
                                <Volume2 size={20} className="animate-pulse" />
                              ) : (
                                <Music size={20} />
                              )}
                            </button>
                            <div className="flex-1 text-left min-w-0">
                              <div className="font-medium truncate">
                                {music.displayName || music.filename}
                              </div>
                              <div className="text-xs opacity-60 flex items-center gap-2 flex-wrap">
                                {music.artist && (
                                  <span className="truncate max-w-[120px]">{music.artist}</span>
                                )}
                                {music.album && (
                                  <span className="truncate max-w-[100px]">&bull; {music.album}</span>
                                )}
                                {music.durationFormatted && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {music.durationFormatted}
                                  </span>
                                )}
                                {!music.artist && !music.album && !music.durationFormatted && music.uploadedAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(music.uploadedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check size={20} className="text-accent shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteUploadedMusic(music.path)
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 shrink-0"
                              title="Delete music file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* No music option */}
                  <button
                    onClick={() => {
                      setSelectedMusicPaths([])
                      setNewUploadedMusicList([])
                      setHasChanges(true)
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      !hasMusic
                        ? 'bg-accent/20 border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      !hasMusic ? 'bg-accent/30' : 'bg-white/10'
                    }`}>
                      <VolumeX size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">No Music</div>
                      <div className="text-xs opacity-60">Silent slideshow</div>
                    </div>
                    {!hasMusic && (
                      <Check size={20} className="text-accent" />
                    )}
                  </button>
                </div>
              )}

              {/* Track playback order */}
              {selectedMusicPaths.length >= 2 && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                    <GripVertical size={16} />
                    Track Playback Order
                  </label>
                  <p className="text-xs text-white/50 mb-3">
                    Drag to reorder — tracks play from top to bottom
                  </p>
                  <SortableList
                    items={selectedMusicPaths.map((path) => ({ id: path }))}
                    onReorder={handleMusicReorder}
                  >
                    {selectedMusicPaths.map((path, index) => {
                      const musicFile = getMusicFileByPath(path)
                      return (
                        <SortableItem key={path} id={path}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-accent w-5 text-center shrink-0">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-white truncate">
                                {musicFile?.displayName || musicFile?.filename || path.split('/').pop()}
                              </div>
                              {musicFile?.durationFormatted && (
                                <div className="text-xs text-white/50">{musicFile.durationFormatted}</div>
                              )}
                            </div>
                          </div>
                        </SortableItem>
                      )
                    })}
                  </SortableList>
                </div>
              )}

              {/* Music fade settings */}
              {hasMusic && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Music Fade Out Duration
                  </label>
                  <p className="text-xs text-white/50 mb-3">
                    Tracks will play sequentially and fade out smoothly at the end
                  </p>
                  <select
                    value={musicFadeOutMs.toString()}
                    onChange={(e) => {
                      setMusicFadeOutMs(parseInt(e.target.value))
                      setHasChanges(true)
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.75rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                    }}
                  >
                    <option value="1000" className="bg-[#1a1a1a]">1 second</option>
                    <option value="2000" className="bg-[#1a1a1a]">2 seconds</option>
                    <option value="3000" className="bg-[#1a1a1a]">3 seconds</option>
                    <option value="5000" className="bg-[#1a1a1a]">5 seconds</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-black/20">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:hover:bg-accent"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
