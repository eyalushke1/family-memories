'use client'

import { useState, useEffect, useCallback } from 'react'
import { Zap, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Power, Eye, EyeOff } from 'lucide-react'
import type { KeepAliveProjectSafe, PingResult, SchedulerStatus } from '@/lib/keepalive/types'

export default function KeepAlivePage() {
  const [projects, setProjects] = useState<KeepAliveProjectSafe[]>([])
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinging, setPinging] = useState(false)
  const [pingResults, setPingResults] = useState<PingResult[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [projectsRes, statusRes] = await Promise.all([
        fetch('/api/admin/keepalive'),
        fetch('/api/admin/keepalive/status'),
      ])
      const projectsData = await projectsRes.json()
      const statusData = await statusRes.json()

      if (projectsData.success) setProjects(projectsData.data)
      if (statusData.success) setSchedulerStatus(statusData.data)
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handlePingAll = async () => {
    setPinging(true)
    setPingResults(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/keepalive/ping', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPingResults(data.data)
        await fetchData()
      } else {
        setError(data.error || 'Ping failed')
      }
    } catch {
      setError('Failed to ping projects')
    } finally {
      setPinging(false)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/keepalive/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      const data = await res.json()
      if (data.success) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, is_active: !isActive } : p))
      }
    } catch {
      setError('Failed to update project')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/keepalive/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setProjects(prev => prev.filter(p => p.id !== id))
      }
    } catch {
      setError('Failed to delete project')
    }
  }

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor(diff / 60000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Supabase Keep-Alive</h1>
        <div className="flex gap-3">
          <button
            onClick={handlePingAll}
            disabled={pinging}
            className="flex items-center gap-2 px-4 py-2 bg-bg-card border border-border rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={pinging ? 'animate-spin' : ''} />
            {pinging ? 'Pinging...' : 'Ping All Now'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Project
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Scheduler Status */}
      {schedulerStatus && (
        <div className="mb-6 bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Scheduler</h2>
              <p className="text-sm text-text-muted">
                Pings every {schedulerStatus.intervalMs / 3600000} hours to prevent project suspension
              </p>
            </div>
            <div className="ml-auto">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                schedulerStatus.schedulerRunning
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  schedulerStatus.schedulerRunning ? 'bg-green-400' : 'bg-yellow-400'
                }`} />
                {schedulerStatus.schedulerRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-text-muted">Last run:</span>{' '}
              <span className="text-text-primary">{formatTimeAgo(schedulerStatus.lastRunAt)}</span>
            </div>
            <div>
              <span className="text-text-muted">Next run:</span>{' '}
              <span className="text-text-primary">{schedulerStatus.nextRunAt ? formatTimeAgo(schedulerStatus.nextRunAt) : 'Pending'}</span>
            </div>
            <div>
              <span className="text-text-muted">Active projects:</span>{' '}
              <span className="text-text-primary">{schedulerStatus.projectCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ping Results */}
      {pingResults && (
        <div className="mb-6 bg-bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Ping Results</h3>
          <div className="space-y-2">
            {pingResults.map((result) => (
              <div key={result.id} className="flex items-center gap-3 text-sm">
                {result.status === 'success' ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
                <span className="text-text-primary">{result.name}</span>
                <span className="text-text-muted">{result.responseTimeMs}ms</span>
                {result.error && (
                  <span className="text-red-400 text-xs">{result.error}</span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setPingResults(null)}
            className="mt-3 text-xs text-text-muted hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-text-muted mb-2">No projects added yet</p>
            <p className="text-sm text-text-muted">
              Your app&apos;s own Supabase is always pinged automatically via environment variables.
              Add external Supabase projects here to keep them alive too.
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="bg-bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-text-primary truncate">{project.name}</h3>
                    <StatusBadge status={project.last_ping_status} />
                  </div>
                  <p className="text-sm text-text-muted mt-1 truncate">{project.supabase_url}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Last ping: {formatTimeAgo(project.last_ping_at)}
                    </span>
                    {project.last_ping_error && (
                      <span className="text-red-400">{project.last_ping_error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(project.id, project.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      project.is_active
                        ? 'text-green-400 hover:bg-green-500/10'
                        : 'text-text-muted hover:bg-bg-secondary'
                    }`}
                    title={project.is_active ? 'Active - click to disable' : 'Inactive - click to enable'}
                  >
                    <Power size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-text-muted mt-6">
        Your app&apos;s own Supabase project is always pinged automatically using environment variables (no configuration needed).
        Add additional Supabase projects above to keep them alive. Supabase free-tier projects pause after 7 days of inactivity.
      </p>

      {/* Add Project Modal */}
      {showForm && (
        <AddProjectForm
          onClose={() => setShowForm(false)}
          onAdded={(project) => {
            setProjects(prev => [...prev, project])
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Healthy
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Never pinged
    </span>
  )
}

function AddProjectForm({
  onClose,
  onAdded,
}: {
  onClose: () => void
  onAdded: (project: KeepAliveProjectSafe) => void
}) {
  const [name, setName] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [serviceKey, setServiceKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Name is required'); return }
    if (!supabaseUrl.trim()) { setError('Supabase URL is required'); return }
    if (!serviceKey.trim()) { setError('Service key is required'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/keepalive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          supabase_url: supabaseUrl.trim(),
          service_key: serviceKey.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        onAdded(data.data)
      } else {
        setError(data.error || 'Failed to add project')
      }
    } catch {
      setError('Failed to add project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Add Supabase Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Side Project"
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Supabase URL
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full px-4 py-2 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Service Role Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="w-full px-4 py-2 pr-10 bg-bg-secondary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Found in Supabase Dashboard &gt; Settings &gt; API &gt; service_role key.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
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
              {saving ? 'Adding...' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
