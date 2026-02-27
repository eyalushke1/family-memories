'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { RecentViewEntry } from '@/types/analytics'

interface ActivityTableProps {
  data: RecentViewEntry[]
}

type SortKey = 'clipTitle' | 'viewerName' | 'watchedAt' | 'durationWatched' | 'completionPercent'
type SortDir = 'asc' | 'desc'

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
  { key: 'clipTitle', label: 'Clip' },
  { key: 'viewerName', label: 'Viewer' },
  { key: 'watchedAt', label: 'Date' },
  { key: 'durationWatched', label: 'Duration' },
  { key: 'completionPercent', label: 'Completion' },
]

export function ActivityTable({ data }: ActivityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('watchedAt')
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
        <h3 className="text-lg font-semibold">Recent Activity</h3>
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
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border last:border-b-0 hover:bg-bg-card-hover transition-colors"
              >
                <td className="p-4 text-sm max-w-[200px] truncate">{entry.clipTitle}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                        getInitialColor(entry.viewerName)
                      )}
                    >
                      {entry.viewerName[0]}
                    </div>
                    <span className="text-sm">{entry.viewerName}</span>
                  </div>
                </td>
                <td className="p-4 text-sm text-text-secondary whitespace-nowrap">
                  {formatRelativeTime(entry.watchedAt)}
                </td>
                <td className="p-4 text-sm text-text-secondary whitespace-nowrap">
                  {formatDuration(entry.durationWatched)} / {formatDuration(entry.clipDuration)}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${entry.completionPercent}%` }}
                      />
                    </div>
                    <span className="text-sm text-text-secondary">{entry.completionPercent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
