import type { ReactNode } from 'react'
import type { Tone } from '@/lib/ecommerce/orders'
import { cn } from '@/lib/utils'

const tones: Record<Tone | 'primary' | 'accent', string> = {
  neutral: 'bg-white/10 text-fg-secondary ring-white/15',
  info: 'bg-primary/15 text-primary-light ring-primary/30',
  success: 'bg-success/15 text-green-300 ring-success/30',
  warning: 'bg-warning/15 text-amber-300 ring-warning/30',
  danger: 'bg-danger/15 text-red-300 ring-danger/30',
  primary: 'bg-primary text-white ring-primary',
  accent: 'bg-accent text-white ring-accent',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: keyof typeof tones; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  )
}
