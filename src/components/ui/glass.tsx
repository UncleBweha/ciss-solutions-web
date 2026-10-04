import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Frosted card with backdrop blur. Use for a handful of hero/summary surfaces. */
export function GlassCard({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('glass rounded-[var(--radius-card)]', className)} {...props} />
}

/** Glass-look panel without blur: cheap enough for lists, grids and forms. */
export function GlassPanel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('glass-flat rounded-[var(--radius-card)]', className)} {...props} />
}
