'use client'

import { Check, Play } from 'lucide-react'

interface MediaItem {
  id: string
  filename: string
  mimeType: string
  thumbnailUrl: string
  isVideo: boolean
}

interface PhotosGridProps {
  items: MediaItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

export function PhotosGrid({ items, selectedIds, onToggle }: PhotosGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {items.map((item) => {
        const isSelected = selectedIds.has(item.id)
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`relative aspect-square rounded-lg overflow-hidden group transition-all ${
              isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''
            }`}
          >
            <img
              src={item.thumbnailUrl}
              alt={item.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Video indicator */}
            {item.isVideo && (
              <div className="absolute bottom-2 left-2 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Play size={12} className="fill-white text-white" />
                <span className="text-xs text-white">Video</span>
              </div>
            )}

            {/* Selection indicator */}
            <div
              className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-accent text-white'
                  : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
              }`}
            >
              <Check size={14} />
            </div>

            {/* Hover overlay */}
            <div
              className={`absolute inset-0 transition-colors ${
                isSelected ? 'bg-accent/10' : 'bg-black/0 group-hover:bg-black/20'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
