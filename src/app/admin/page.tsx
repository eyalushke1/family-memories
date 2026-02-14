'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, FolderOpen, Film, Zap } from 'lucide-react'

interface Stats {
  profiles: number
  categories: number
  clips: number
  keepAliveProjects: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ profiles: 0, categories: 0, clips: 0, keepAliveProjects: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [profilesRes, categoriesRes, clipsRes, keepAliveRes] = await Promise.all([
          fetch('/api/profiles'),
          fetch('/api/admin/categories'),
          fetch('/api/admin/clips'),
          fetch('/api/admin/keepalive/status'),
        ])

        const [profilesData, categoriesData, clipsData, keepAliveData] = await Promise.all([
          profilesRes.json(),
          categoriesRes.json(),
          clipsRes.json(),
          keepAliveRes.json(),
        ])

        setStats({
          profiles: profilesData.data?.length ?? 0,
          categories: categoriesData.data?.length ?? 0,
          clips: clipsData.data?.length ?? 0,
          keepAliveProjects: keepAliveData.data?.projectCount ?? 0,
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards = [
    {
      label: 'Profiles',
      count: stats.profiles,
      href: '/admin/profiles',
      icon: Users,
      color: 'bg-blue-500/20 text-blue-400',
    },
    {
      label: 'Categories',
      count: stats.categories,
      href: '/admin/categories',
      icon: FolderOpen,
      color: 'bg-green-500/20 text-green-400',
    },
    {
      label: 'Clips',
      count: stats.clips,
      href: '/admin/clips',
      icon: Film,
      color: 'bg-purple-500/20 text-purple-400',
    },
    {
      label: 'Keep-Alive',
      count: stats.keepAliveProjects,
      href: '/admin/supabase-keepalive',
      icon: Zap,
      color: 'bg-yellow-500/20 text-yellow-400',
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-bg-card border border-border rounded-xl p-6 hover:bg-bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className="text-text-secondary text-sm">{card.label}</p>
                  <p className="text-3xl font-bold">
                    {loading ? '...' : card.count}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/profiles"
            className="px-4 py-2 bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            Manage Profiles
          </Link>
          <Link
            href="/admin/categories"
            className="px-4 py-2 bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            Manage Categories
          </Link>
          <Link
            href="/admin/clips"
            className="px-4 py-2 bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            Manage Clips
          </Link>
          <Link
            href="/admin/supabase-keepalive"
            className="px-4 py-2 bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover transition-colors"
          >
            Keep-Alive Monitor
          </Link>
        </div>
      </div>
    </div>
  )
}
