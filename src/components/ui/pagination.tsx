import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Link-based pagination: works without JavaScript and is crawlable. */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount))
  const sorted = [...pages].sort((a, b) => a - b)
  const item = 'grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-semibold transition-colors'
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, 'glass-flat hover:bg-surface-hover')} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1] > 1 ? <span className="px-1 text-fg-muted">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(item, p === page ? 'bg-primary-strong text-white' : 'glass-flat hover:bg-surface-hover')}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(item, 'glass-flat hover:bg-surface-hover')} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  )
}
