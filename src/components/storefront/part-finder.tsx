'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Search, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { cn } from '@/lib/utils'

export type FinderModel = { id: string; slug: string; name: string; model_number: string; brand_slug: string; brand_name: string }
export type FinderPartType = { slug: string; name: string }

/** "Find the right part": printer brand → model → part type, or part number search. */
export function PartFinder({
  models,
  partTypes,
  initial,
  className,
  compact,
}: {
  models: FinderModel[]
  partTypes: FinderPartType[]
  initial?: { brand?: string; model?: string; type?: string }
  className?: string
  compact?: boolean
}) {
  const router = useRouter()
  const brands = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of models) map.set(m.brand_slug, m.brand_name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [models])
  const initialModel = models.find((m) => m.slug === initial?.model)
  const [brand, setBrand] = useState(initial?.brand ?? initialModel?.brand_slug ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [type, setType] = useState(initial?.type ?? '')
  const [partNumber, setPartNumber] = useState('')
  const brandModels = models.filter((m) => !brand || m.brand_slug === brand)

  return (
    <div className={cn('grid gap-6', !compact && 'lg:grid-cols-[1.6fr_1fr]', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const params = new URLSearchParams()
          if (model) params.set('model', model)
          else if (brand) params.set('brand', brand)
          if (type) params.set('type', type)
          router.push(`/parts-finder?${params.toString()}`)
        }}
        className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6"
        aria-labelledby="finder-title"
      >
        <h3 id="finder-title" className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Wrench className="h-5 w-5 text-primary-light" aria-hidden="true" />
          Find a compatible spare part
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="finder-brand" className="mb-1.5 block text-xs font-semibold text-fg-secondary">
              Printer brand
            </label>
            <Select
              id="finder-brand"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value)
                setModel('')
              }}
            >
              <option value="">Any brand</option>
              {brands.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="finder-model" className="mb-1.5 block text-xs font-semibold text-fg-secondary">
              Printer model
            </label>
            <Select id="finder-model" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Select model</option>
              {brandModels.map((m) => (
                <option key={m.id} value={m.slug}>
                  {brand ? m.model_number : m.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="finder-type" className="mb-1.5 block text-xs font-semibold text-fg-secondary">
              Part type
            </label>
            <Select id="finder-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any part or supply</option>
              {partTypes.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={!brand && !model}>
          Find Compatible Parts
        </Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (partNumber.trim()) router.push(`/search?q=${encodeURIComponent(partNumber.trim())}`)
        }}
        className="glass-flat flex flex-col rounded-[var(--radius-card)] p-5 sm:p-6"
      >
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Search className="h-5 w-5 text-primary-light" aria-hidden="true" />
          Search by part number
        </h3>
        <label htmlFor="finder-part-number" className="sr-only">
          Part number
        </label>
        <Input id="finder-part-number" placeholder="e.g. RM2-5452, CF259A, FA04010" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
        <Button type="submit" variant="glass" className="mt-4" disabled={!partNumber.trim()}>
          Search
        </Button>
      </form>
    </div>
  )
}

/** Compact "parts for your printer" box for the homepage hero column. */
export function PartFinderPanel({ models, className }: { models: FinderModel[]; className?: string }) {
  const router = useRouter()
  const brands = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of models) map.set(m.brand_slug, m.brand_name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [models])
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const brandModels = models.filter((m) => !brand || m.brand_slug === brand)

  return (
    <div className={cn('flex flex-col rounded-[var(--radius-card)] border border-border bg-white', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const params = new URLSearchParams()
          if (model) params.set('model', model)
          else if (brand) params.set('brand', brand)
          router.push(`/parts-finder?${params.toString()}`)
        }}
        className="p-4 sm:p-5"
        aria-labelledby="panel-finder-title"
      >
        <h2 id="panel-finder-title" className="flex items-center gap-2 text-base font-bold">
          <span className="reg-mark text-ink-magenta" aria-hidden="true" />
          Parts &amp; ink for your printer
        </h2>
        <p className="mt-1 text-sm text-fg-muted">Pick your printer to see only what fits it.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="panel-brand" className="mb-1 block text-xs font-semibold text-fg-secondary">
              Printer brand
            </label>
            <Select
              id="panel-brand"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value)
                setModel('')
              }}
            >
              <option value="">Choose brand</option>
              {brands.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="panel-model" className="mb-1 block text-xs font-semibold text-fg-secondary">
              Printer model
            </label>
            <Select id="panel-model" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">{brand ? 'Choose model' : 'Choose a brand first'}</option>
              {brandModels.map((m) => (
                <option key={m.id} value={m.slug}>
                  {brand ? m.model_number : m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" className="mt-4 w-full" disabled={!brand && !model}>
          Show compatible parts
        </Button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (partNumber.trim()) router.push(`/search?q=${encodeURIComponent(partNumber.trim())}`)
        }}
        className="mt-auto border-t border-border bg-surface/60 p-4 sm:px-5"
      >
        <label htmlFor="panel-part-number" className="mb-1 block text-xs font-semibold text-fg-secondary">
          Know the part number?
        </label>
        <div className="flex gap-2">
          <Input id="panel-part-number" placeholder="e.g. RM2-5452" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className="h-10" />
          <Button type="submit" variant="glass" className="h-10 shrink-0" disabled={!partNumber.trim()}>
            Go
          </Button>
        </div>
      </form>
    </div>
  )
}
