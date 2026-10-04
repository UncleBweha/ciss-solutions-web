'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { SlidersHorizontal, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { Drawer } from '@/components/ui/dialog'
import { activeFilterCount, productTypeLabels, withParams, type SearchParams } from '@/lib/catalog-params'
import { catalogSorts } from '@/types/catalog'
import { cn, param, paramList } from '@/lib/utils'

export type Facets = {
  categories?: { slug: string; name: string; depth: number }[]
  brands?: { slug: string; name: string }[]
  types?: string[]
}

function useNavigate(current: SearchParams) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const go = (overrides: Record<string, string | undefined>) =>
    start(() => router.push(withParams(pathname, current, { ...overrides, page: undefined }), { scroll: false }))
  return { go, pending }
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-border py-5 first:pt-0 last:border-0">
      <legend className="float-left mb-3 w-full text-sm font-bold">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  )
}

export function FilterSidebar({ facets, current, className }: { facets: Facets; current: SearchParams; className?: string }) {
  const { go, pending } = useNavigate(current)
  const brands = paramList(current.brand)
  const types = paramList(current.type)
  const [min, setMin] = useState(param(current.min) ?? '')
  const [max, setMax] = useState(param(current.max) ?? '')
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]).join(',') || undefined

  return (
    <div className={cn('transition-opacity', pending && 'opacity-60', className)} aria-busy={pending}>
      {facets.categories?.length ? (
        <Group title="Category">
          <Select aria-label="Category" value={param(current.category) ?? ''} onChange={(e) => go({ category: e.target.value || undefined })}>
            <option value="">All categories</option>
            {facets.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {'  '.repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </Select>
        </Group>
      ) : null}

      {facets.brands?.length ? (
        <Group title="Brand">
          <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {facets.brands.map((b) => (
              <li key={b.slug}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary hover:text-fg">
                  <Checkbox checked={brands.includes(b.slug)} onChange={() => go({ brand: toggle(brands, b.slug) })} />
                  {b.name}
                </label>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      <Group title="Price (KSh)">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go({ min: min || undefined, max: max || undefined })
          }}
        >
          <Input aria-label="Minimum price" inputMode="numeric" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} className="h-10" />
          <span className="text-fg-muted">–</span>
          <Input aria-label="Maximum price" inputMode="numeric" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} className="h-10" />
          <Button type="submit" size="sm" variant="glass">
            Go
          </Button>
        </form>
      </Group>

      <Group title="Availability">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary hover:text-fg">
            <Checkbox checked={param(current.stock) === '1'} onChange={(e) => go({ stock: e.target.checked ? '1' : undefined })} />
            In stock only
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary hover:text-fg">
            <Checkbox checked={param(current.sale) === '1'} onChange={(e) => go({ sale: e.target.checked ? '1' : undefined })} />
            On sale / discounted
          </label>
        </div>
      </Group>

      {facets.types?.length ? (
        <Group title="Product type">
          <ul className="space-y-2">
            {facets.types.map((t) => (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary hover:text-fg">
                  <Checkbox checked={types.includes(t)} onChange={() => go({ type: toggle(types, t) })} />
                  {productTypeLabels[t as keyof typeof productTypeLabels] ?? t}
                </label>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      <Group title="Rating">
        <div className="space-y-1">
          {[4, 3].map((r) => {
            const active = param(current.rating) === String(r)
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => go({ rating: active ? undefined : String(r) })}
                className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm', active ? 'bg-primary/15 text-fg' : 'text-fg-secondary hover:bg-surface')}
              >
                <span className="flex" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn('h-3.5 w-3.5', i <= r ? 'fill-amber-400 text-amber-400' : 'text-white/20')} />
                  ))}
                </span>
                {r} stars & up
              </button>
            )
          })}
        </div>
      </Group>

      {activeFilterCount(current) ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => go({ brand: undefined, min: undefined, max: undefined, stock: undefined, sale: undefined, type: undefined, rating: undefined, category: undefined })}
        >
          <X className="h-4 w-4" aria-hidden="true" /> Clear all filters
        </Button>
      ) : null}
    </div>
  )
}

export function MobileFilterDrawer({ facets, current }: { facets: Facets; current: SearchParams }) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(current)
  return (
    <>
      <Button variant="glass" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters{count ? ` (${count})` : ''}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Filters" side="left">
        <FilterSidebar facets={facets} current={current} />
      </Drawer>
    </>
  )
}

export function SortSelect({ current, includeRelevance }: { current: SearchParams; includeRelevance?: boolean }) {
  const { go } = useNavigate(current)
  const value = param(current.sort) ?? (includeRelevance ? 'relevance' : 'featured')
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="sr-only whitespace-nowrap text-sm text-fg-muted sm:not-sr-only">
        Sort by
      </label>
      <Select id="sort" value={value} onChange={(e) => go({ sort: e.target.value })} className="h-9 w-48">
        {includeRelevance ? <option value="relevance">Best match</option> : null}
        {Object.entries(catalogSorts).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  )
}
