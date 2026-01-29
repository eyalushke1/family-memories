'use client'

import { useEffect, useState } from 'react'
import { IntroList } from '@/components/admin/intros/intro-list'
import { IntroForm } from '@/components/admin/intros/intro-form'
import { Plus } from 'lucide-react'
import type { IntroClipRow } from '@/types/database'

export default function IntrosAdminPage() {
  const [intros, setIntros] = useState<IntroClipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingIntro, setEditingIntro] = useState<IntroClipRow | null>(null)

  const fetchIntros = async () => {
    try {
      const res = await fetch('/api/admin/intros')
      const data = await res.json()
      if (data.success) {
        setIntros(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch intros:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntros()
  }, [])

  const handleEdit = (intro: IntroClipRow) => {
    setEditingIntro(intro)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingIntro(null)
  }

  const handleSaved = (intro: IntroClipRow, isNew: boolean) => {
    if (isNew) {
      setIntros((prev) => [intro, ...prev])
    } else {
      setIntros((prev) =>
        prev.map((i) => (i.id === intro.id ? intro : i))
      )
    }
    handleClose()
  }

  const handleDeleted = (id: string) => {
    setIntros((prev) => prev.filter((i) => i.id !== id))
  }

  const handleToggleActive = (id: string, isActive: boolean) => {
    setIntros((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_active: isActive } : i))
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Intro Clips</h1>
          <p className="text-text-secondary mt-1">
            Manage intro clips that play before main clips
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Intro
        </button>
      </div>

      {loading ? (
        <div className="text-text-secondary">Loading...</div>
      ) : (
        <IntroList
          intros={intros}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
          onToggleActive={handleToggleActive}
        />
      )}

      {showForm && (
        <IntroForm
          intro={editingIntro}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
