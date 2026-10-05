'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { formatKES } from '@/lib/ecommerce/money'
import { cn } from '@/lib/utils'

type Suggestion = {
  id: string
  name: string
  slug: string
  price: number
  image_url: string | null
  brand_name: string | null
  category_name: string | null
}
type Response = { total: number; items: Suggestion[]; categories: { name: string; href: string }[] }

/** Instant product search (ARIA combobox). Enter goes to the full results page. */
export function SearchBar({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const id = useId()
  const [query, setQuery] = useState('')
  const [data, setData] = useState<Response | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (res.ok) {
          setData(await res.json())
          setActive(-1)
        }
      } catch {
        // aborted or offline: keep previous suggestions
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const visible = query.trim().length >= 2 ? data : null
  const items = visible?.items ?? []
  const go = (href: string) => {
    setOpen(false)
    onNavigate?.()
    router.push(href)
  }
  const submit = () => {
    const q = query.trim()
    if (q) go(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && items[active]) go(`/p/${items[active].slug}`)
          else submit()
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Search products
        </label>
        <div className="relative flex">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id={`${id}-input`}
            type="search"
            role="combobox"
            aria-expanded={open && items.length > 0}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="Search printers, parts, ink, model no…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(items.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(-1, a - 1))
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            className="h-11 w-full min-w-0 rounded-l-full border border-r-0 border-white bg-white/75 pl-11 pr-9 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] text-sm text-fg placeholder:text-fg-muted transition-colors focus:border-primary focus:bg-white focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {loading ? <Loader2 className="absolute right-[5.5rem] top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-muted" aria-hidden="true" /> : null}
          <button type="submit" className="h-11 shrink-0 rounded-r-full bg-primary-strong px-5 text-sm font-semibold text-white hover:bg-primary-strong-hover">
            Search
          </button>
        </div>
      </form>

      {open && visible ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 glass-strong overflow-hidden rounded-[var(--radius-card)] bg-white/95!">
          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-fg-secondary">
              No products match “{query.trim()}”. Try a model number like <span className="font-semibold">L3250</span> or a part number.
            </p>
          ) : (
            <>
              <ul id={`${id}-list`} role="listbox" aria-label="Product suggestions" className="max-h-[60vh] overflow-y-auto py-2">
                {items.map((item, i) => (
                  <li key={item.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/p/${item.slug}`}
                      onClick={() => {
                        setOpen(false)
                        onNavigate?.()
                      }}
                      className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface', i === active && 'bg-surface')}
                    >
                      <span className="product-stage relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                        {item.image_url ? <Image src={item.image_url} alt="" fill sizes="48px" className="object-contain p-1" unoptimized={item.image_url.endsWith('.svg')} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
                        <span className="block truncate text-xs text-fg-muted">{[item.brand_name, item.category_name].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="text-sm font-bold">{formatKES(item.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {visible.categories.length ? (
                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  {visible.categories.map((c) => (
                    <Link key={c.href} href={c.href} onClick={() => setOpen(false)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-fg-secondary hover:text-fg">
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              <button type="button" onClick={submit} className="block w-full border-t border-border px-4 py-3 text-left text-sm font-semibold text-primary-light hover:bg-surface">
                View all {visible.total} results →
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
