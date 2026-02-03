'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAdminStore } from '@/stores/admin-store'
import { FormField, Input } from '@/components/admin/shared/form-field'
import { ToggleSwitch } from '@/components/admin/shared/toggle-switch'
import { FileUploadZone } from '@/components/admin/shared/file-upload-zone'
import { X } from 'lucide-react'
import type { ProfileRow } from '@/types/database'

interface ProfileFormProps {
  profile: ProfileRow | null
  onClose: () => void
}

export function ProfileForm({ profile, onClose }: ProfileFormProps) {
  const { addProfile, updateProfile } = useAdminStore()
  const [name, setName] = useState(profile?.name ?? '')
  const [isAdmin, setIsAdmin] = useState(profile?.is_admin ?? false)
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path ?? null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_path ? `/api/media/files/${profile.avatar_path}` : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!profile

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)

    try {
      const url = isEditing ? `/api/profiles/${profile.id}` : '/api/profiles'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          is_admin: isAdmin,
          avatar_path: avatarPath,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to save profile')
        return
      }

      if (isEditing) {
        updateProfile(profile.id, data.data)
      } else {
        addProfile(data.data)
      }

      onClose()
    } catch {
      setError('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!profile?.id) {
      // For new profiles, just show preview
      setAvatarPreview(URL.createObjectURL(file))
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'avatar')
    formData.append('id', profile.id)

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (data.success) {
      setAvatarPath(data.data.path)
      setAvatarPreview(data.data.url)
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
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
      >
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">
              {isEditing ? 'Edit Profile' : 'New Profile'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-bg-card rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FormField label="Avatar">
              <FileUploadZone
                accept="image/*,.heic,.heif"
                onUpload={handleAvatarUpload}
                preview={avatarPreview}
                onClear={() => {
                  setAvatarPath(null)
                  setAvatarPreview(null)
                }}
                label="Drop avatar image here"
                maxSizeMB={20}
              />
              {!isEditing && avatarPreview && (
                <p className="text-xs text-text-muted mt-1">
                  Avatar will be uploaded after saving
                </p>
              )}
            </FormField>

            <FormField label="Name" error={error && !name.trim() ? 'Required' : undefined}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter profile name"
                error={!name.trim() && !!error}
              />
            </FormField>

            <ToggleSwitch
              checked={isAdmin}
              onChange={setIsAdmin}
              label="Admin privileges"
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
