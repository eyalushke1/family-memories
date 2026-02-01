'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Check, X, RefreshCw } from 'lucide-react'
import { PhotosGrid } from './photos-grid'
import { ImportDialog } from './import-dialog'

interface PickedMediaItem {
  id: string
  baseUrl: string
  mimeType: string
  filename: string
  type: string
  createTime: string
  width?: number
  height?: number
  thumbnailUrl: string
  displayUrl: string
  downloadUrl: string
  isVideo: boolean
}

interface PickerSession {
  sessionId: string
  pickerUri: string
  expireTime: string
  pollingConfig?: {
    pollInterval: string
    timeoutIn: string
  }
}

type PickerState = 'idle' | 'opening' | 'waiting' | 'fetching' | 'ready' | 'error'

export function GooglePhotosPicker() {
  const router = useRouter()
  const [state, setState] = useState<PickerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<PickerSession | null>(null)
  const [mediaItems, setMediaItems] = useState<PickedMediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set())
  const [showImportDialog, setShowImportDialog] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const windowRef = useRef<Window | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
      }
      if (session?.sessionId) {
        // Fire and forget cleanup
        fetch(`/api/admin/google-photos/picker/session/${session.sessionId}`, {
          method: 'DELETE',
        }).catch(() => {})
      }
    }
  }, [session?.sessionId])

  const createSession = async (): Promise<PickerSession> => {
    const res = await fetch('/api/admin/google-photos/picker/session', {
      method: 'POST',
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Failed to create session')
    }
    return data.data
  }

  const pollSession = useCallback(async (sessionId: string, pollInterval: number, timeout: number) => {
    const startTime = Date.now()

    const poll = async () => {
      // Check if timeout exceeded
      if (Date.now() - startTime > timeout) {
        setState('error')
        setError('Session timed out. Please try again.')
        return
      }

      try {
        const res = await fetch(`/api/admin/google-photos/picker/session/${sessionId}`)
        const data = await res.json()

        if (!data.success) {
          setState('error')
          setError(data.error || 'Failed to check session')
          return
        }

        if (data.data.mediaItemsSet) {
          // User finished selecting
          setState('fetching')
          await fetchMediaItems(sessionId)
          return
        }

        // Continue polling
        pollingRef.current = setTimeout(poll, pollInterval)
      } catch (err) {
        console.error('Polling error:', err)
        // Don't fail immediately, try again
        pollingRef.current = setTimeout(poll, pollInterval)
      }
    }

    poll()
  }, [])

  const fetchMediaItems = async (sessionId: string) => {
    try {
      const allItems: PickedMediaItem[] = []
      let pageToken: string | undefined

      do {
        const url = pageToken
          ? `/api/admin/google-photos/picker/media?sessionId=${sessionId}&pageToken=${encodeURIComponent(pageToken)}`
          : `/api/admin/google-photos/picker/media?sessionId=${sessionId}`

        const res = await fetch(url)
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch media')
        }

        allItems.push(...data.data.items)
        pageToken = data.data.nextPageToken
      } while (pageToken)

      setMediaItems(allItems)
      setState('ready')

      // Cleanup session
      await fetch(`/api/admin/google-photos/picker/session/${sessionId}`, {
        method: 'DELETE',
      }).catch(() => {})
      setSession(null)
    } catch (err) {
      console.error('Failed to fetch media:', err)
      setState('error')
      setError(err instanceof Error ? err.message : 'Failed to fetch media')
    }
  }

  const handleOpenPicker = async () => {
    setState('opening')
    setError(null)

    try {
      const newSession = await createSession()
      setSession(newSession)

      // Open picker in new window
      windowRef.current = window.open(
        newSession.pickerUri,
        'google-photos-picker',
        'width=800,height=600,popup=true'
      )

      if (!windowRef.current) {
        throw new Error('Failed to open picker window. Please allow popups.')
      }

      setState('waiting')

      // Parse polling config
      const pollInterval = newSession.pollingConfig?.pollInterval
        ? parseInt(newSession.pollingConfig.pollInterval.replace('s', '')) * 1000
        : 5000
      const timeout = newSession.pollingConfig?.timeoutIn
        ? parseInt(newSession.pollingConfig.timeoutIn.replace('s', '')) * 1000
        : 30 * 60 * 1000 // 30 minutes default

      // Start polling
      pollSession(newSession.sessionId, pollInterval, timeout)
    } catch (err) {
      console.error('Failed to open picker:', err)
      setState('error')
      setError(err instanceof Error ? err.message : 'Failed to open picker')
    }
  }

  const handleMediaToggle = (mediaId: string) => {
    setSelectedMedia((prev) => {
      const next = new Set(prev)
      if (next.has(mediaId)) {
        next.delete(mediaId)
      } else {
        next.add(mediaId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedMedia.size === mediaItems.length) {
      setSelectedMedia(new Set())
    } else {
      setSelectedMedia(new Set(mediaItems.map((m) => m.id)))
    }
  }

  const handleImportComplete = (clipId?: string) => {
    setShowImportDialog(false)
    setSelectedMedia(new Set())
    // Navigate to clips page with edit query param to open the edit form
    if (clipId) {
      router.push(`/admin/clips?edit=${clipId}`)
    }
  }

  const handleReset = () => {
    setState('idle')
    setMediaItems([])
    setSelectedMedia(new Set())
    setError(null)
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
    }
  }

  // Transform items for PhotosGrid compatibility
  const gridItems = mediaItems.map((item) => ({
    id: item.id,
    filename: item.filename,
    mimeType: item.mimeType,
    baseUrl: item.baseUrl,
    thumbnailUrl: item.thumbnailUrl,
    width: String(item.width || 0),
    height: String(item.height || 0),
    creationTime: item.createTime,
    isVideo: item.isVideo,
  }))

  // Transform items for ImportDialog compatibility
  const importItems = mediaItems
    .filter((m) => selectedMedia.has(m.id))
    .map((item) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mimeType,
      baseUrl: item.baseUrl,
      thumbnailUrl: item.thumbnailUrl,
      downloadUrl: item.downloadUrl,
      width: String(item.width || 0),
      height: String(item.height || 0),
      createTime: item.createTime,
      isVideo: item.isVideo,
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Select Photos</h2>
          <p className="text-sm text-text-secondary mt-1">
            Choose photos from your Google Photos library to import
          </p>
        </div>

        {state === 'ready' && mediaItems.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <RefreshCw size={18} />
              Select Different Photos
            </button>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {selectedMedia.size === mediaItems.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              disabled={selectedMedia.size === 0}
              onClick={() => setShowImportDialog(true)}
              className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {selectedMedia.size > 0 ? `(${selectedMedia.size})` : ''}
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      {state === 'idle' && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-surface-elevated rounded-xl">
          <ImagePlus size={48} className="text-text-secondary mb-4" />
          <h3 className="text-lg font-medium mb-2">Select Photos from Google Photos</h3>
          <p className="text-sm text-text-secondary mb-6 text-center max-w-md">
            Click the button below to open Google Photos and select the photos you want to import.
          </p>
          <button
            onClick={handleOpenPicker}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            Open Google Photos
          </button>
        </div>
      )}

      {state === 'opening' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={48} className="text-accent animate-spin mb-4" />
          <p className="text-text-secondary">Opening Google Photos...</p>
        </div>
      )}

      {state === 'waiting' && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-accent/30 rounded-xl bg-accent/5">
          <Loader2 size={48} className="text-accent animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">Select your photos</h3>
          <p className="text-sm text-text-secondary text-center max-w-md">
            A Google Photos window has opened. Select the photos you want to import,
            then click &quot;Done&quot; in the Google Photos window.
          </p>
          <button
            onClick={handleReset}
            className="mt-6 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {state === 'fetching' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={48} className="text-accent animate-spin mb-4" />
          <p className="text-text-secondary">Fetching selected photos...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-red-500/30 rounded-xl bg-red-500/5">
          <X size={48} className="text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Something went wrong</h3>
          <p className="text-sm text-text-secondary text-center max-w-md mb-6">
            {error || 'An error occurred while accessing Google Photos.'}
          </p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {state === 'ready' && mediaItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-surface-elevated rounded-xl">
          <Check size={48} className="text-green-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No photos selected</h3>
          <p className="text-sm text-text-secondary mb-6">
            You didn&apos;t select any photos. Try again to select some.
          </p>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            Select Photos
          </button>
        </div>
      )}

      {state === 'ready' && mediaItems.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <span className="text-text-secondary">
              {mediaItems.length} photos selected from Google Photos
            </span>
            {selectedMedia.size > 0 && (
              <span className="text-accent">
                {selectedMedia.size} selected for import
              </span>
            )}
          </div>
          <PhotosGrid
            items={gridItems}
            selectedIds={selectedMedia}
            onToggle={handleMediaToggle}
          />
        </div>
      )}

      {/* Import dialog */}
      {showImportDialog && (
        <ImportDialog
          selectedMediaIds={Array.from(selectedMedia)}
          mediaItems={importItems}
          onClose={() => setShowImportDialog(false)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  )
}
