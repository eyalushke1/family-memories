'use client'

import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full px-4 py-2 bg-bg-primary border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent transition-colors',
        error ? 'border-red-500' : 'border-border',
        className
      )}
      {...props}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full px-4 py-2 bg-bg-primary border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent transition-colors resize-none',
        error ? 'border-red-500' : 'border-border',
        className
      )}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ className, error, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'w-full px-4 py-2 bg-bg-primary border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors',
        error ? 'border-red-500' : 'border-border',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
