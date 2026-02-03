'use client'

import { useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { ProfileAvatar } from '@/components/profiles/profile-avatar'
import { ConfirmDialog } from '@/components/admin/shared/confirm-dialog'
import { Pencil, Trash2, EyeOff } from 'lucide-react'
import type { ProfileRow } from '@/types/database'

interface ProfileListProps {
  profiles: ProfileRow[]
  onEdit: (profile: ProfileRow) => void
}

export function ProfileList({ profiles, onEdit }: ProfileListProps) {
  const { removeProfile } = useAdminStore()
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/profiles/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        removeProfile(deleteTarget.id)
        setDeleteTarget(null)
      }
    } catch (error) {
      console.error('Failed to delete profile:', error)
    } finally {
      setDeleting(false)
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        No profiles yet. Create your first profile to get started.
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-4"
          >
            <ProfileAvatar
              name={profile.name}
              avatarPath={profile.avatar_path}
              size="lg"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{profile.name}</h3>
                {profile.is_hidden && (
                  <EyeOff size={16} className="text-text-muted flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-text-muted">
                {profile.is_hidden ? 'Hidden from selection' : 'Visible'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(profile)}
                className="p-2 hover:bg-bg-card-hover rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil size={18} className="text-text-secondary" />
              </button>
              <button
                onClick={() => setDeleteTarget(profile)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={18} className="text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Profile"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
