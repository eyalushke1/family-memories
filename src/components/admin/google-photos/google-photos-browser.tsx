'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlbumsList } from './albums-list'
import { PhotosGrid } from './photos-grid'
import { ImportDialog } from './import-dialog'
import type { GooglePhotosAlbum } from '@/types/google-photos'

// Special identifier for "All Photos" view
const ALL_PHOTOS_ID = '__all_photos__'

interface MediaItem {
  id: string
  filename: string
  mimeType: string
  baseUrl: string
  thumbnailUrl: string
  width: string
  height: string
  creationTime: string
  isVideo: boolean
}

export function GooglePhotosBrowser() {
  const [albums, setAlbums] = useState<GooglePhotosAlbum[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<GooglePhotosAlbum | null>(null)
  const [isAllPhotosSelected, setIsAllPhotosSelected] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set())
  const [loadingAlbums, setLoadingAlbums] = useState(true)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)

  // Fetch albums on mount
  useEffect(() => {
    async function fetchAlbums() {
      try {
        const res = await fetch('/api/admin/google-photos/albums')
        const data = await res.json()
        if (data.success) {
          setAlbums(data.data)
        }
      } catch (err) {
        console.error('Failed to fetch albums:', err)
      } finally {
        setLoadingAlbums(false)
      }
    }

    fetchAlbums()
  }, [])

  // Fetch all photos (not album-specific)
  const fetchAllPhotos = useCallback(async (pageToken?: string) => {
    const isLoadingMore = !!pageToken
    if (isLoadingMore) {
      setLoadingMore(true)
    } else {
      setLoadingMedia(true)
      setSelectedMedia(new Set())
      setMediaItems([])
    }

    try {
      const url = pageToken
        ? `/api/admin/google-photos/media?pageToken=${encodeURIComponent(pageToken)}`
        : '/api/admin/google-photos/media'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        if (isLoadingMore) {
          setMediaItems((prev) => [...prev, ...data.data.items])
        } else {
          setMediaItems(data.data.items)
        }
        setNextPageToken(data.data.nextPageToken || null)
      }
    } catch (err) {
      console.error('Failed to fetch all photos:', err)
    } finally {
      setLoadingMedia(false)
      setLoadingMore(false)
    }
  }, [])

  // Fetch media when album is selected
  useEffect(() => {
    if (isAllPhotosSelected) {
      fetchAllPhotos()
      return
    }

    if (!selectedAlbum) {
      setMediaItems([])
      setNextPageToken(null)
      return
    }

    async function fetchMedia() {
      setLoadingMedia(true)
      setSelectedMedia(new Set())
      try {
        const res = await fetch(`/api/admin/google-photos/albums/${selectedAlbum!.id}/media`)
        const data = await res.json()
        if (data.success) {
          setMediaItems(data.data)
        }
        setNextPageToken(null) // Album media doesn't support pagination in current implementation
      } catch (err) {
        console.error('Failed to fetch media:', err)
      } finally {
        setLoadingMedia(false)
      }
    }

    fetchMedia()
  }, [selectedAlbum, isAllPhotosSelected, fetchAllPhotos])

  const handleAlbumSelect = (album: GooglePhotosAlbum | null, isAllPhotos?: boolean) => {
    if (isAllPhotos) {
      setIsAllPhotosSelected(true)
      setSelectedAlbum(null)
    } else {
      setIsAllPhotosSelected(false)
      setSelectedAlbum(album)
    }
  }

  const handleLoadMore = () => {
    if (nextPageToken && !loadingMore) {
      fetchAllPhotos(nextPageToken)
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

  const handleImportComplete = () => {
    setShowImportDialog(false)
    setSelectedMedia(new Set())
  }

  const currentTitle = isAllPhotosSelected ? 'All Photos' : selectedAlbum?.title
  const hasSelection = isAllPhotosSelected || selectedAlbum

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Albums sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto">
        <AlbumsList
          albums={albums}
          selectedAlbum={selectedAlbum}
          isAllPhotosSelected={isAllPhotosSelected}
          loading={loadingAlbums}
          onSelect={handleAlbumSelect}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        {hasSelection && (
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">{currentTitle}</h2>
              <span className="text-text-secondary">
                {mediaItems.length} items{nextPageToken ? '+' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {mediaItems.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  {selectedMedia.size === mediaItems.length ? 'Clear All' : 'Select All'}
                </button>
              )}
              {selectedMedia.size > 0 && (
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                  Import {selectedMedia.size} item{selectedMedia.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Photos grid */}
        <div className="flex-1 overflow-y-auto">
          {!hasSelection ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              Select &quot;All Photos&quot; or an album to browse
            </div>
          ) : loadingMedia ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              Loading photos...
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No photos found
            </div>
          ) : (
            <>
              <PhotosGrid
                items={mediaItems}
                selectedIds={selectedMedia}
                onToggle={handleMediaToggle}
              />
              {/* Load More button for All Photos view */}
              {isAllPhotosSelected && nextPageToken && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 bg-surface-elevated hover:bg-surface-hover text-text-primary rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More Photos'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Import dialog */}
      {showImportDialog && (
        <ImportDialog
          selectedMediaIds={Array.from(selectedMedia)}
          mediaItems={mediaItems.filter((m) => selectedMedia.has(m.id))}
          onClose={() => setShowImportDialog(false)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  )
}
