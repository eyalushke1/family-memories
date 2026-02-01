'use client'

import { Folder, Images } from 'lucide-react'
import type { GooglePhotosAlbum } from '@/types/google-photos'

interface AlbumsListProps {
  albums: GooglePhotosAlbum[]
  selectedAlbum: GooglePhotosAlbum | null
  isAllPhotosSelected: boolean
  loading: boolean
  onSelect: (album: GooglePhotosAlbum | null, isAllPhotos?: boolean) => void
}

export function AlbumsList({ albums, selectedAlbum, isAllPhotosSelected, loading, onSelect }: AlbumsListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-surface-elevated rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* All Photos option - always visible */}
      <div className="text-sm font-medium text-text-secondary mb-3 px-2">
        Library
      </div>
      <button
        onClick={() => onSelect(null, true)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
          isAllPhotosSelected
            ? 'bg-accent/20 text-accent'
            : 'hover:bg-surface-elevated'
        }`}
      >
        <div className="w-10 h-10 rounded bg-surface-elevated flex items-center justify-center">
          <Images size={20} className={isAllPhotosSelected ? 'text-accent' : 'text-text-secondary'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">All Photos</div>
          <div className="text-xs text-text-secondary">
            Browse all your photos
          </div>
        </div>
      </button>

      {/* Albums section */}
      {albums.length > 0 && (
        <>
          <div className="text-sm font-medium text-text-secondary mt-6 mb-3 px-2">
            Albums ({albums.length})
          </div>
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => onSelect(album)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                selectedAlbum?.id === album.id
                  ? 'bg-accent/20 text-accent'
                  : 'hover:bg-surface-elevated'
              }`}
            >
              {album.coverPhotoBaseUrl ? (
                <img
                  src={`${album.coverPhotoBaseUrl}=w80-h80-c`}
                  alt=""
                  className="w-10 h-10 rounded object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-surface-elevated flex items-center justify-center">
                  <Folder size={20} className="text-text-secondary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{album.title}</div>
                <div className="text-xs text-text-secondary">
                  {album.mediaItemsCount} items
                </div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
