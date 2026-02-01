'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Presentation, Loader2, Music, Volume2, VolumeX, Check, Sparkles, Plus, Upload, Shuffle, VideoOff, Video, ArrowUpDown, Calendar, GripVertical, Clock } from 'lucide-react'
import type { CategoryRow } from '@/types/database'

type SortOrder = 'date-asc' | 'date-desc' | 'custom'

interface MediaItem {
  id: string
  filename: string
  mimeType: string
  baseUrl: string
  thumbnailUrl: string
  downloadUrl?: string
  createTime?: string
  creationTime?: string
  width: string
  height: string
  isVideo: boolean
}

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

interface ImportDialogProps {
  selectedMediaIds: string[]
  mediaItems: MediaItem[]
  onClose: () => void
  onComplete: (clipId?: string) => void
}

// Available transition effects
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

export function ImportDialog({
  selectedMediaIds,
  mediaItems,
  onClose,
  onComplete,
}: ImportDialogProps) {
  const [presentationTitle, setPresentationTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [slideDurationMs, setSlideDurationMs] = useState(5000)
  const [transitionType, setTransitionType] = useState('fade')
  const [useRandomTransition, setUseRandomTransition] = useState(false)
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [muteVideoAudio, setMuteVideoAudio] = useState(true)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  // Music state - simplified
  const [uploadedMusicFiles, setUploadedMusicFiles] = useState<UploadedMusicFile[]>([])
  const [selectedMusicPath, setSelectedMusicPath] = useState<string | null>(null)
  const [newUploadedMusic, setNewUploadedMusic] = useState<NewUploadedMusic | null>(null)
  const [musicFadeOutMs, setMusicFadeOutMs] = useState(3000)
  const [loadingMusic, setLoadingMusic] = useState(false)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const [playingMusicPath, setPlayingMusicPath] = useState<string | null>(null)

  // New category creation
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  // Sorting and ordering
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-asc')
  const [orderedItems, setOrderedItems] = useState<MediaItem[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const musicInputRef = useRef<HTMLInputElement>(null)

  // Helper to get date from either createTime or creationTime
  const getItemDate = (item: MediaItem): number => {
    const dateStr = item.createTime || item.creationTime
    return dateStr ? new Date(dateStr).getTime() : 0
  }

  // Initialize ordered items when mediaItems change
  useEffect(() => {
    const filtered = mediaItems.filter((m) => selectedMediaIds.includes(m.id))
    const sorted = [...filtered].sort((a, b) => getItemDate(a) - getItemDate(b))
    setOrderedItems(sorted)
  }, [mediaItems, selectedMediaIds])

  // Sort items when sort order changes
  const handleSortChange = (newOrder: SortOrder) => {
    setSortOrder(newOrder)
    if (newOrder === 'custom') return

    const sorted = [...orderedItems].sort((a, b) => {
      const dateA = getItemDate(a)
      const dateB = getItemDate(b)
      return newOrder === 'date-asc' ? dateA - dateB : dateB - dateA
    })
    setOrderedItems(sorted)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
    setSortOrder('custom')
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...orderedItems]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)
    setOrderedItems(newItems)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/admin/categories')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data.filter((c: CategoryRow) => c.is_active))
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Fetch previously uploaded music files
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

  const imageCount = orderedItems.filter((m) => !m.isVideo).length
  const videoCount = orderedItems.filter((m) => m.isVideo).length

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
    setError('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    setCreatingCategory(true)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setCategories([...categories, data.data])
        setCategoryId(data.data.id)
        setNewCategoryName('')
        setShowNewCategory(false)
      } else {
        setError(data.error || 'Failed to create category')
      }
    } catch (err) {
      setError('Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  const handleImport = async () => {
    if (!categoryId) {
      setError('Please select a category')
      return
    }

    setImporting(true)
    setError('')
    setProgress('Starting import...')

    try {
      const selectedItems = orderedItems
      let musicPath: string | null = null

      // If user uploaded new music, upload it first
      if (newUploadedMusic) {
        setProgress('Uploading music...')
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
      } else if (selectedMusicPath) {
        musicPath = selectedMusicPath
      }

      setProgress('Creating presentation...')

      const res = await fetch('/api/admin/google-photos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaItems: selectedItems,
          createPresentation: true,
          presentationTitle: presentationTitle || 'Photo Slideshow',
          categoryId,
          slideDurationMs,
          transitionType: useRandomTransition ? 'random' : transitionType,
          backgroundMusicPath: musicPath,
          musicFadeOutMs,
          muteVideoAudio,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Import failed')
      }

      setProgress(`Successfully imported ${data.data.completedItems} items!`)

      setTimeout(() => {
        onComplete(data.data.clipId)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setImporting(false)
    }
  }

  const hasMusic = selectedMusicPath || newUploadedMusic

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
              <h2 className="text-xl font-semibold text-white">Create Presentation</h2>
              <p className="text-sm text-white/60">Import photos and create a slideshow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Photo Preview with Sorting */}
          <div className="p-5 border-b border-white/10">
            {/* Sort controls */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/60">Order:</span>
                <button
                  onClick={() => handleSortChange('date-asc')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    sortOrder === 'date-asc'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  Oldest First
                </button>
                <button
                  onClick={() => handleSortChange('date-desc')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    sortOrder === 'date-desc'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  Newest First
                </button>
                {sortOrder === 'custom' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
                    <ArrowUpDown size={14} />
                    Custom Order
                  </span>
                )}
              </div>
            </div>

            {/* Draggable items */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {orderedItems.map((item, index) => (
                <div
                  key={item.id}
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
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <GripVertical size={14} className="text-white drop-shadow-lg" />
                  </div>
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-white/10 hover:border-accent transition-colors"
                  />
                  {item.isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-white/80">{orderedItems.length} items selected</span>
              {imageCount > 0 && (
                <span className="text-accent">{imageCount} photos</span>
              )}
              {videoCount > 0 && (
                <span className="text-blue-400">{videoCount} videos</span>
              )}
              <span className="text-white/40 text-xs">Drag to reorder</span>
            </div>
          </div>

          {/* Form */}
          <div className="p-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Presentation Title
              </label>
              <input
                type="text"
                value={presentationTitle}
                onChange={(e) => setPresentationTitle(e.target.value)}
                placeholder="My Photo Slideshow"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Category <span className="text-red-400">*</span>
              </label>

              {showNewCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    autoFocus
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory()
                      if (e.key === 'Escape') {
                        setShowNewCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="px-4 py-3 bg-accent hover:bg-accent/80 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {creatingCategory ? <Loader2 size={18} className="animate-spin" /> : 'Add'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewCategory(false)
                      setNewCategoryName('')
                    }}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    <option value="" className="bg-[#1a1a1a]">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-[#1a1a1a]">
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewCategory(true)}
                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors flex items-center gap-2"
                    title="Add new category"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Slide Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Slide Duration
                </label>
                <select
                  value={slideDurationMs.toString()}
                  onChange={(e) => setSlideDurationMs(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
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
                    onChange={(e) => setTransitionType(e.target.value)}
                    disabled={useRandomTransition}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer disabled:opacity-50"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
                  >
                    {TRANSITION_EFFECTS.map((effect) => (
                      <option key={effect.value} value={effect.value} className="bg-[#1a1a1a]">
                        {effect.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseRandomTransition(!useRandomTransition)}
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

            {/* Video Audio Settings (only show if there are videos) */}
            {videoCount > 0 && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => setMuteVideoAudio(!muteVideoAudio)}
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
            )}

            {/* Background Music - Simplified */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-3">
                <Music size={16} />
                Background Music
              </label>

              {/* Upload music button */}
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
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      !selectedMusicPath && !newUploadedMusic
                        ? 'bg-accent/20 border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      !selectedMusicPath && !newUploadedMusic ? 'bg-accent/30' : 'bg-white/10'
                    }`}>
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

              {/* Music fade settings (only show if music is selected) */}
              {hasMusic && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Music Fade Out Duration
                  </label>
                  <p className="text-xs text-white/50 mb-3">
                    Music will start from the beginning and fade out smoothly at the end
                  </p>
                  <select
                    value={musicFadeOutMs.toString()}
                    onChange={(e) => setMusicFadeOutMs(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
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

          {importing && progress && (
            <div className="mb-4 p-3 bg-accent/20 border border-accent/30 rounded-xl text-accent text-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              {progress}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-5 py-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !categoryId}
              className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:hover:bg-accent"
            >
              {importing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Presentation size={18} />
              )}
              {importing ? 'Creating...' : 'Create Presentation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
