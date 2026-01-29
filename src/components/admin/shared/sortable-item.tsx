'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableItemProps {
  id: string
  children: React.ReactNode
  className?: string
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 bg-bg-card border border-border rounded-lg p-4 transition-colors',
        isDragging && 'opacity-50 shadow-lg',
        className
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={20} />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  )
}
