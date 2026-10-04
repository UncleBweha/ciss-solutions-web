import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded-md border border-border-strong bg-white px-3.5 text-sm text-fg placeholder:text-fg-muted transition-colors hover:border-border-strong focus:border-primary-light focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 aria-[invalid=true]:border-danger'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-11', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(control, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235b6472%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[position:right_0.75rem_center] bg-no-repeat pr-9', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-28 py-3', className)} {...props} />
}

export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return <input type="checkbox" className={cn('h-4 w-4 rounded border-border accent-[var(--primary)]', className)} {...props} />
}

type FieldProps = {
  label: ReactNode
  htmlFor: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}

/** Label + control + accessible error/hint wiring. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg-secondary">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function FormMessage({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  if (!children) return null
  const styles = {
    error: 'border-danger/40 bg-danger/10 text-danger',
    success: 'border-success/40 bg-success/10 text-success',
    info: 'border-primary/40 bg-primary/10 text-primary-light',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-sm', styles[tone])}>
      {children}
    </div>
  )
}
