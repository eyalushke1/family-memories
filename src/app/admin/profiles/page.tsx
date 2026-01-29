'use client'

import { useEffect, useState } from 'react'
import { useAdminStore } from '@/stores/admin-store'
import { ProfileList } from '@/components/admin/profiles/profile-list'
import { ProfileForm } from '@/components/admin/profiles/profile-form'
import { Plus } from 'lucide-react'
import type { ProfileRow } from '@/types/database'

export default function ProfilesAdminPage() {
  const { profiles, setProfiles, setLoadingProfiles, loadingProfiles } =
    useAdminStore()
  const [showForm, setShowForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ProfileRow | null>(null)

  useEffect(() => {
    async function fetchProfiles() {
      setLoadingProfiles(true)
      try {
        const res = await fetch('/api/profiles')
        const data = await res.json()
        if (data.success) {
          setProfiles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch profiles:', error)
      } finally {
        setLoadingProfiles(false)
      }
    }

    fetchProfiles()
  }, [setProfiles, setLoadingProfiles])

  const handleEdit = (profile: ProfileRow) => {
    setEditingProfile(profile)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingProfile(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Profiles</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Profile
        </button>
      </div>

      {loadingProfiles ? (
        <div className="text-text-secondary">Loading...</div>
      ) : (
        <ProfileList profiles={profiles} onEdit={handleEdit} />
      )}

      {showForm && (
        <ProfileForm profile={editingProfile} onClose={handleClose} />
      )}
    </div>
  )
}
