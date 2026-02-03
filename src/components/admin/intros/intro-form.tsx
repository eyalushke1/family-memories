'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { FormField, Input, Textarea } from '@/components/admin/shared/form-field'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { FileUploadZone } from '@/components/admin/shared/file-upload-zone'
import { X } from 'lucide-react'
import type { IntroClipRow } from '@/types/database'

interface IntroFormProps {
  intro: IntroClipRow | null
  onClose: () => void
  onSaved: (intro: IntroClipRow, isNew: boolean) => void
}

export function IntroForm({ intro, onClose, onSaved }: IntroFormProps) {
  const [name, setName] = useState(intro?.name ?? '')
  const [description, setDescription] = useState(intro?.description ?? '')
  const [durationSeconds, setDurationSeconds] = useState(
    intro?.duration_seconds?.toString() ?? ''
  )
  const [isActive, setIsActive] = useState(intro?.is_active ?? true)
  const [videoPreview, setVideoPreview] = useState<string | null>(
    intro?.video_path ? `/api/media/files/${intro.video_path}` : null
  )
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    intro?.thumbnail_path ? `/api/media/files/${intro.thumbnail_path}` : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendingVideoFile = useRef<File | null>(null)
  const pendingThumbnailFile = useRef<File | null>(null)

  const isEditing = !!intro

  const uploadFile = async (
    file: File,
    type: 'intro-video' | 'intro-thumbnail',
    introId: string
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    formData.append('id', introId)

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || `Failed to upload ${type}`)
    }
    return data.data.path
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!isEditing && !pendingVideoFile.current) {
      setError('Video is required')
      return
    }

    setSaving(true)

    try {
      if (isEditing) {
        // Update existing intro
        const res = await fetch(`/api/admin/intros/${intro.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            is_active: isActive,
            duration_seconds: durationSeconds
              ? parseInt(durationSeconds, 10)
              : null,
          }),
        })

        const data = await res.json()
        if (!data.success) {
          setError(data.error || 'Failed to save intro')
          return
        }

        onSaved(data.data, false)
      } else {
        // Create new intro
        // 1. Create intro with placeholder
        const createRes = await fetch('/api/admin/intros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            is_active: isActive,
            duration_seconds: durationSeconds
              ? parseInt(durationSeconds, 10)
              : null,
            video_path: 'pending',
          }),
        })

        const createData = await createRes.json()
        if (!createData.success) {
          setError(createData.error || 'Failed to create intro')
          return
        }

        const newIntroId = createData.data.id

        // 2. Upload video
        const videoPath = await uploadFile(
          pendingVideoFile.current!,
          'intro-video',
          newIntroId
        )

        // 3. Upload thumbnail if selected
        let thumbnailPath: string | null = null
        if (pendingThumbnailFile.current) {
          thumbnailPath = await uploadFile(
            pendingThumbnailFile.current,
            'intro-thumbnail',
            newIntroId
          )
        }

        const updatedIntro = {
          ...createData.data,
          video_path: videoPath,
          thumbnail_path: thumbnailPath,
        }

        onSaved(updatedIntro, true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save intro')
    } finally {
      setSaving(false)
    }
  }

  const handleVideoUpload = async (file: File) => {
    if (!intro?.id) {
      pendingVideoFile.current = file
      setVideoPreview(URL.createObjectURL(file))
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'intro-video')
    formData.append('id', intro.id)

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (data.success) {
      setVideoPreview(data.data.url)
    } else {
      throw new Error(data.error || 'Upload failed')
    }
  }

  const handleThumbnailUpload = async (file: File) => {
    if (!intro?.id) {
      pendingThumbnailFile.current = file
      setThumbnailPreview(URL.createObjectURL(file))
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'intro-thumbnail')
    formData.append('id', intro.id)

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (data.success) {
      setThumbnailPreview(data.data.url)
    } else {
      throw new Error(data.error || 'Upload failed')
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {isEditing ? 'Edit Intro Clip' : 'New Intro Clip'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-bg-card rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Video">
                <FileUploadZone
                  accept="video/*,.avi,.mkv,.m4v"
                  onUpload={handleVideoUpload}
                  preview={videoPreview}
                  onClear={() => {
                    setVideoPreview(null)
                    pendingVideoFile.current = null
                  }}
                  label="Drop intro video here"
                  maxSizeMB={2048}
                />
              </FormField>

              <FormField label="Thumbnail">
                <FileUploadZone
                  accept="image/*,.heic,.heif"
                  onUpload={handleThumbnailUpload}
                  preview={thumbnailPreview}
                  onClear={() => {
                    setThumbnailPreview(null)
                    pendingThumbnailFile.current = null
                  }}
                  label="Drop thumbnail image"
                  maxSizeMB={50}
                />
              </FormField>
            </div>

            <FormField label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Family Memories Intro"
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description (optional)"
                rows={2}
              />
            </FormField>

            <FormField label="Duration (seconds)">
              <Input
                type="number"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                placeholder="e.g., 5"
                min="0"
                className="w-32"
              />
            </FormField>

            <ToggleSwitch
              checked={isActive}
              onChange={setIsActive}
              label={isActive ? 'Active (available for use)' : 'Archived'}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
