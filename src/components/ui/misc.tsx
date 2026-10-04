import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} aria-hidden="true" />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('glass-flat mx-auto flex max-w-xl flex-col items-center rounded-[var(--radius-card)] px-6 py-14 text-center', className)}>
      {icon ? <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary-light">{icon}</div> : null}
      <h2 className="text-xl font-bold">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-fg-secondary">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  )
}

export type Crumb = { name: string; href: string }

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-fg-muted', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.href} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="text-fg-secondary">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.href} className="hover:text-fg">
                    {item.name}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function RatingStars({ rating, count, size = 'sm', showValue }: { rating: number; count?: number; size?: 'sm' | 'md'; showValue?: boolean }) {
  const px = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(px, i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-white/10 text-white/20')}
            aria-hidden="true"
          />
        ))}
      </div>
      {showValue ? <span className="text-sm font-semibold">{rating.toFixed(1)}</span> : null}
      {count !== undefined ? <span className="text-xs text-fg-muted">({count} {count === 1 ? 'review' : 'reviews'})</span> : null}
    </div>
  )
}

export function SectionHeading({ title, subtitle, action, id }: { title: string; subtitle?: string | null; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-extrabold sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-fg-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
