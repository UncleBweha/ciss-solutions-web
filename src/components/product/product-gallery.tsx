'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ProductImage } from './product-image'

type GalleryImage = { url: string; alt: string }

export function ProductGallery({ images, name, activeUrl }: { images: GalleryImage[]; name: string; activeUrl?: string | null }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const list = images.length ? images : [{ url: '', alt: name }]
  // A selected variant's image takes over the main view.
  const variantIndex = activeUrl ? list.findIndex((i) => i.url === activeUrl) : -1
  const current = variantIndex >= 0 && index === 0 ? variantIndex : index
  const image = list[current]
  const go = (delta: number) => setIndex((current + delta + list.length) % list.length)

  return (
    <div className="space-y-3">
      <div
        className="glass-flat group bg-white! relative aspect-square cursor-zoom-in overflow-hidden rounded-[var(--radius-card)]"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
        }}
        onMouseLeave={() => setZoom(null)}
        onClick={() => setFullscreen(true)}
      >
        <ProductImage
          src={image.url || null}
          alt={image.alt}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-contain p-8 transition-transform duration-200 sm:p-12"
          style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setFullscreen(true)
          }}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-white text-fg-secondary shadow-sm hover:text-fg"
          aria-label="View fullscreen"
        >
          <Expand className="h-4 w-4" />
        </button>
        {list.length > 1 ? (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-fg-secondary opacity-100 shadow-sm hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-fg-secondary opacity-100 shadow-sm hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      {list.length > 1 ? (
        <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="Product images">
          {list.map((img, i) => (
            <li key={img.url + i}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === current}
                className={cn('relative block h-20 w-20 bg-white overflow-hidden rounded-md border-2 transition-colors', i === current ? 'border-primary' : 'border-border hover:border-border-strong')}
              >
                <ProductImage src={img.url} alt="" fill sizes="80px" className="object-contain p-2" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={fullscreen} onClose={() => setFullscreen(false)} title={name} className="h-[92dvh] w-[min(64rem,96vw)] max-w-none">
        <div className="relative h-full min-h-[60dvh]">
          <ProductImage src={image.url || null} alt={image.alt} fill sizes="96vw" className="object-contain" />
          {list.length > 1 ? (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-3">
              <button type="button" onClick={() => go(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong" aria-label="Previous image">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="self-center text-sm text-fg-secondary">
                {current + 1} / {list.length}
              </span>
              <button type="button" onClick={() => go(1)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong" aria-label="Next image">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}
