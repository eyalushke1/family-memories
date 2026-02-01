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
} from 'lucide-react'
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

  // Music state
  const [uploadedMusicFiles, setUploadedMusicFiles] = useState<UploadedMusicFile[]>([])
  const [selectedMusicPath, setSelectedMusicPath] = useState<string | null>(null)
  const [newUploadedMusic, setNewUploadedMusic] = useState<NewUploadedMusic | null>(null)
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const [playingMusicPath, setPlayingMusicPath] = useState<string | null>(null)

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const musicInputRef = useRef<HTMLInputElement>(null)

  // Fetch presentation data
  useEffect(() => {
    async function fetchPresentation() {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/presentations/${presentationId}`)
        const data = await res.json()

        if (data.success) {
          const pres = data.data as PresentationWithSlides
          setPresentation(pres)
          setSlides(pres.slides.sort((a, b) => a.sort_order - b.sort_order))
          setSlideDurationMs(pres.slide_duration_ms)
          setTransitionType(pres.transition_type === 'random' ? 'fade' : pres.transition_type)
          setUseRandomTransition(pres.transition_type === 'random')
          setMuteVideoAudio(pres.mute_video_audio)
          setMusicFadeOutMs(pres.music_fade_out_ms)
          setSelectedMusicPath(pres.background_music_path)
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause()
        previewAudio.src = ''
      }
      if (newUploadedMusic?.previewUrl) {
        URL.revokeObjectURL(newUploadedMusic.previewUrl)
      }
    }
  }, [previewAudio, newUploadedMusic])

  const toggleMusicPreview = (path: string, isNew = false) => {
    const trackId = isNew ? 'new-upload' : path

    if (playingMusicPath === trackId) {
      previewAudio?.pause()
      setPlayingMusicPath(null)
    } else {
      if (previewAudio) {
        previewAudio.pause()
      }
      const audioSrc = isNew ? newUploadedMusic!.previewUrl : `/api/media/files/${path}`
      const audio = new Audio(audioSrc)
      audio.volume = 0.5
      audio.play()
      audio.onended = () => setPlayingMusicPath(null)
      setPreviewAudio(audio)
      setPlayingMusicPath(trackId)
    }
  }

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (mp3, wav, etc.)')
      return
    }

    if (newUploadedMusic?.previewUrl) {
      URL.revokeObjectURL(newUploadedMusic.previewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    setNewUploadedMusic({
      name: file.name.replace(/\.[^/.]+$/, ''),
      file,
      previewUrl,
    })
    setSelectedMusicPath(null)
    setHasChanges(true)
    setError('')
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

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      let musicPath: string | null = selectedMusicPath

      // If user uploaded new music, upload it first
      if (newUploadedMusic) {
        const formData = new FormData()
        formData.append('file', newUploadedMusic.file)

        const uploadRes = await fetch('/api/admin/google-photos/upload-music', {
          method: 'POST',
          body: formData,
        })
        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Failed to upload music')
        }
        musicPath = uploadData.data.path
      }

      // Update presentation settings
      const res = await fetch(`/api/admin/presentations/${presentationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide_duration_ms: slideDurationMs,
          transition_type: useRandomTransition ? 'random' : transitionType,
          background_music_path: musicPath,
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

  const hasMusic = selectedMusicPath || newUploadedMusic

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
              <span className="text-xs text-white/40">Drag to reorder</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative shrink-0 cursor-grab active:cursor-grabbing group ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  <div className="absolute -top-1 -left-1 w-5 h-5 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">
                    {index + 1}
                  </div>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <GripVertical size={14} className="text-white drop-shadow-lg" />
                  </div>
                  <button
                    onClick={() => handleDeleteSlide(slide.id)}
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
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* Upload new music option */}
                  <div
                    onClick={() => !newUploadedMusic && musicInputRef.current?.click()}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border border-dashed transition-all ${
                      newUploadedMusic
                        ? 'bg-green-500/20 border-green-500 text-white'
                        : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/40 cursor-pointer'
                    }`}
                  >
                    <div
                      onClick={(e) => {
                        if (newUploadedMusic) {
                          e.stopPropagation()
                          musicInputRef.current?.click()
                        }
                      }}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        newUploadedMusic ? 'bg-green-500/30 cursor-pointer hover:bg-green-500/40' : 'bg-white/10'
                      }`}
                    >
                      <Upload size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">
                        {newUploadedMusic ? newUploadedMusic.name : 'Upload New Music'}
                      </div>
                      <div className="text-xs opacity-60">
                        {newUploadedMusic ? 'Click to change' : 'MP3, WAV, or other audio formats'}
                      </div>
                    </div>
                    {newUploadedMusic && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleMusicPreview('', true)
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            playingMusicPath === 'new-upload'
                              ? 'bg-green-500 text-white'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {playingMusicPath === 'new-upload' ? (
                            <Volume2 size={16} className="animate-pulse" />
                          ) : (
                            <Music size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (newUploadedMusic.previewUrl) {
                              URL.revokeObjectURL(newUploadedMusic.previewUrl)
                            }
                            setNewUploadedMusic(null)
                            if (musicInputRef.current) {
                              musicInputRef.current.value = ''
                            }
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* No music option */}
                  <button
                    onClick={() => {
                      setSelectedMusicPath(null)
                      setNewUploadedMusic(null)
                      setHasChanges(true)
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      !selectedMusicPath && !newUploadedMusic
                        ? 'bg-accent/20 border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        !selectedMusicPath && !newUploadedMusic ? 'bg-accent/30' : 'bg-white/10'
                      }`}
                    >
                      <VolumeX size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">No Music</div>
                      <div className="text-xs opacity-60">Silent slideshow</div>
                    </div>
                    {!selectedMusicPath && !newUploadedMusic && (
                      <Check size={20} className="text-accent" />
                    )}
                  </button>

                  {/* Previously uploaded music files */}
                  {uploadedMusicFiles.length > 0 && (
                    <>
                      <div className="pt-2 pb-1 px-1 text-xs text-white/40 font-medium">
                        Previously Uploaded
                      </div>
                      {uploadedMusicFiles.map((music) => (
                        <div
                          key={music.path}
                          onClick={() => {
                            setSelectedMusicPath(music.path)
                            setNewUploadedMusic(null)
                            setHasChanges(true)
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedMusicPath === music.path && !newUploadedMusic
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
                                : selectedMusicPath === music.path
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
                                <span className="truncate max-w-[100px]">• {music.album}</span>
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
                          {selectedMusicPath === music.path && !newUploadedMusic && (
                            <Check size={20} className="text-accent shrink-0" />
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Music fade settings */}
              {hasMusic && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Music Fade Out Duration
                  </label>
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
