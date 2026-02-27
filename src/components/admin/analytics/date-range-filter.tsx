'use client'

import { cn } from '@/lib/utils'
import type { DateRange } from '@/types/analytics'

const ranges: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-2">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm transition-colors',
            value === r.value
              ? 'bg-accent text-white'
              : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
