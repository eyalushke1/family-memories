'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  trend: number
  trendLabel: string
  icon: LucideIcon
  iconColor: string
}

export function MetricCard({ label, value, trend, trendLabel, icon: Icon, iconColor }: MetricCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-lg', iconColor)}>
          <Icon size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-text-secondary text-sm">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-sm font-medium',
                trend >= 0 ? 'text-green-400' : 'text-red-400'
              )}
            >
              {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend)}%
            </span>
            <span className="text-text-muted text-xs">{trendLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
