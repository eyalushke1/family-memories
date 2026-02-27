'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { ProfileStats } from '@/types/analytics'

interface ProfileStatsTableProps {
  data: ProfileStats[]
}

type SortKey = 'name' | 'totalViews' | 'totalWatchTimeMinutes' | 'avgCompletionRate' | 'lastActiveAt'
type SortDir = 'asc' | 'desc'

function formatWatchTime(minutes: number): string {
  const hours = minutes / 60
  return hours >= 1 ? `${hours.toFixed(1)} hrs` : `${minutes} min`
}

function formatRelativeTime(isoStr: string): string {
  const now = Date.now()
  const then = new Date(isoStr).getTime()
  const diffMin = Math.floor((now - then) / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitialColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500',
    'bg-orange-500', 'bg-pink-500', 'bg-cyan-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Profile' },
  { key: 'totalViews', label: 'Views' },
  { key: 'totalWatchTimeMinutes', label: 'Watch Time' },
  { key: 'avgCompletionRate', label: 'Avg. Completion' },
  { key: 'lastActiveAt', label: 'Last Active' },
]

export function ProfileStatsTable({ data }: ProfileStatsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalViews')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [data, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Profile Breakdown</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left p-4 text-text-secondary text-sm font-medium cursor-pointer hover:text-text-primary transition-colors select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </span>
                </th>
              ))}
              <th className="text-left p-4 text-text-secondary text-sm font-medium">Favorite Clip</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((profile) => (
              <tr
                key={profile.profileId}
                className="border-b border-border last:border-b-0 hover:bg-bg-card-hover transition-colors"
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                        getInitialColor(profile.name)
                      )}
                    >
                      {profile.name[0]}
                    </div>
                    <span className="text-sm font-medium">{profile.name}</span>
                  </div>
                </td>
                <td className="p-4 text-sm">{profile.totalViews.toLocaleString()}</td>
                <td className="p-4 text-sm text-text-secondary">{formatWatchTime(profile.totalWatchTimeMinutes)}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${profile.avgCompletionRate}%` }}
                      />
                    </div>
                    <span className="text-sm text-text-secondary">{profile.avgCompletionRate}%</span>
                  </div>
                </td>
                <td className="p-4 text-sm text-text-secondary whitespace-nowrap">
                  {formatRelativeTime(profile.lastActiveAt)}
                </td>
                <td className="p-4 text-sm text-text-secondary max-w-[180px] truncate">
                  {profile.favoriteClipTitle}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
