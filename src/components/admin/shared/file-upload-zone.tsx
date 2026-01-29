'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, X, Loader2 } from 'lucide-react'

interface FileUploadZoneProps {
  accept: string
  onUpload: (file: File) => Promise<void>
  preview?: string | null
  onClear?: () => void
  label?: string
  maxSizeMB?: number
  className?: string
}

export function FileUploadZone({
  accept,
  onUpload,
  preview,
  onClear,
  label = 'Drop file here or click to upload',
  maxSizeMB = 100,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      // Check file size
      const maxBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB`)
        return
      }

      setUploading(true)
      try {
        await onUpload(file)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [maxSizeMB, onUpload]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const isImage = accept.includes('image')
  const isVideo = accept.includes('video')

  return (
    <div className={className}>
      {preview ? (
        <div className="relative">
          {isImage && (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
          )}
          {isVideo && (
            <video
              src={preview}
              className="w-full h-48 object-cover rounded-lg"
              controls
            />
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            isDragging
              ? 'border-accent bg-accent/10'
              : 'border-border hover:border-text-muted',
            uploading && 'opacity-50 pointer-events-none'
          )}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
          ) : (
            <>
              <Upload className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-sm text-text-secondary">{label}</p>
              <p className="text-xs text-text-muted mt-1">
                Max {maxSizeMB}MB
              </p>
            </>
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  )
}
