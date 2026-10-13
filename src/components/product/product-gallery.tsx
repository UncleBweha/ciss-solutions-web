'use client'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ProductImage } from './product-image'

type GalleryImage = { url: string; alt: string }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Product pictures. The main view is a strip the browser scrolls itself: a swipe (or an
 * arrow, or a thumbnail) slides to the next picture instead of swapping it. Zooming happens
 * on the picture only, never on the page: hover on a computer, pinch in the fullscreen view.
 */
export function ProductGallery({ images, name, activeUrl }: { images: GalleryImage[]; name: string; activeUrl?: string | null }) {
  const list = images.length ? images : [{ url: '', alt: name }]
  // A selected variant's image opens first (the gallery is remounted when the variant changes).
  const start = Math.max(0, activeUrl ? list.findIndex((i) => i.url === activeUrl) : 0)
  const [current, setCurrent] = useState(start)
  const [fullscreen, setFullscreen] = useState(false)
  const strip = useRef<HTMLDivElement>(null)
  // Where an arrow or thumbnail is sliding to: the pictures passed on the way are not "current".
  const target = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = strip.current
    if (el && start) el.scrollLeft = start * el.clientWidth
  }, [start])

  const show = (i: number, slide = true) => {
    const el = strip.current
    const next = (i + list.length) % list.length
    setCurrent(next)
    if (!el) return
    const smooth = slide && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.current = smooth ? next : null
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') show(current - 1, false)
      if (e.key === 'ArrowRight') show(current + 1, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, current])

  const arrow = 'absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white text-fg-secondary opacity-100 shadow-sm hover:text-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'

  return (
    <div className="min-w-0 space-y-3">
      <div className="glass-flat group bg-white! relative aspect-square overflow-hidden rounded-[var(--radius-card)]">
        <div
          ref={strip}
          // pan-x pan-y: a pinch here does not zoom the whole page; a tap opens the zoomable view.
          className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y"
          onPointerDown={() => {
            target.current = null
          }}
          onScroll={(e) => {
            const el = e.currentTarget
            const i = clamp(Math.round(el.scrollLeft / el.clientWidth), 0, list.length - 1)
            if (target.current !== null) {
              if (i === target.current) target.current = null
              return
            }
            if (i !== current) setCurrent(i)
          }}
        >
          {list.map((img, i) => (
            <div
              key={img.url + i}
              className="group/slide relative h-full w-full shrink-0 cursor-zoom-in snap-center snap-always"
              // Hover zoom, written straight to the element: no re-render per mouse move.
              onPointerMove={(e) => {
                if (e.pointerType !== 'mouse') return
                const r = e.currentTarget.getBoundingClientRect()
                e.currentTarget.style.setProperty('--zoom-x', `${((e.clientX - r.left) / r.width) * 100}%`)
                e.currentTarget.style.setProperty('--zoom-y', `${((e.clientY - r.top) / r.height) * 100}%`)
                e.currentTarget.dataset.zoom = ''
              }}
              onPointerLeave={(e) => {
                delete e.currentTarget.dataset.zoom
              }}
              onClick={() => setFullscreen(true)}
            >
              <ProductImage
                src={img.url || null}
                alt={img.alt}
                fill
                priority={i === start}
                draggable={false}
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-contain p-8 transition-transform duration-200 group-data-[zoom]/slide:scale-[1.8] sm:p-12"
                style={{ transformOrigin: 'var(--zoom-x, 50%) var(--zoom-y, 50%)' }}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-white text-fg-secondary shadow-sm hover:text-fg"
          aria-label="View fullscreen"
        >
          <Expand className="h-4 w-4" />
        </button>
        {list.length > 1 ? (
          <>
            <button type="button" onClick={() => show(current - 1)} className={cn(arrow, 'left-3')} aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => show(current + 1)} className={cn(arrow, 'right-3')} aria-label="Next image">
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
                onClick={() => show(i)}
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
        <div className="flex h-full min-h-[60dvh] flex-col gap-3">
          {fullscreen ? <ZoomableImage key={current} image={list[current]} onSwipe={list.length > 1 ? (delta) => show(current + delta, false) : undefined} /> : null}
          {list.length > 1 ? (
            <div className="flex shrink-0 justify-center gap-3">
              <button type="button" onClick={() => show(current - 1, false)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong" aria-label="Previous image">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="self-center text-sm text-fg-secondary">
                {current + 1} / {list.length}
              </span>
              <button type="button" onClick={() => show(current + 1, false)} className="grid h-11 w-11 place-items-center rounded-full bg-surface-strong" aria-label="Next image">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}

const MAX_ZOOM = 4
const TAP_ZOOM = 2.5

/**
 * The fullscreen picture: pinch, double-tap or scroll to zoom, drag to move around, swipe
 * to change picture. touch-action is off here, so the browser never zooms the page instead;
 * the picture moves with a GPU transform written straight to the element.
 */
function ZoomableImage({ image, onSwipe }: { image: GalleryImage; onSwipe?: (delta: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const view = useRef({ scale: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ startX: 0, startY: 0, pinchDistance: 0, pinchScale: 1, pinched: false, moved: false, lastTap: 0 })

  const apply = (scale: number, x: number, y: number, animate: boolean) => {
    const el = box.current
    if (!el || !layer.current) return
    const s = clamp(scale, 1, MAX_ZOOM)
    // The picture can be dragged only as far as its own edges.
    const maxX = ((s - 1) * el.clientWidth) / 2
    const maxY = ((s - 1) * el.clientHeight) / 2
    view.current = { scale: s, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) }
    layer.current.style.transition = animate ? 'transform 0.2s ease-out' : 'none'
    layer.current.style.transform = `translate3d(${view.current.x}px, ${view.current.y}px, 0) scale(${s})`
    el.style.cursor = s > 1 ? 'grab' : 'zoom-in'
  }

  /** Zooms so the point under the finger or cursor stays where it is. */
  const zoomAt = (scale: number, clientX: number, clientY: number, animate: boolean) => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = clientX - (r.left + r.width / 2)
    const py = clientY - (r.top + r.height / 2)
    const { scale: from, x, y } = view.current
    const to = clamp(scale, 1, MAX_ZOOM)
    apply(to, px - ((px - x) * to) / from, py - ((py - y) * to) / from, animate)
  }

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y) || 1
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size === 1) Object.assign(g, { startX: e.clientX, startY: e.clientY, pinched: false, moved: false })
    if (pointers.current.size === 2) Object.assign(g, { pinchDistance: pinchDistance(), pinchScale: view.current.scale, pinched: true })
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(e.pointerId)
    if (!previous) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      zoomAt((g.pinchScale * pinchDistance()) / g.pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2, false)
    } else if (pointers.current.size === 1) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 8) g.moved = true
      const { scale, x, y } = view.current
      if (scale > 1) apply(scale, x + e.clientX - previous.x, y + e.clientY - previous.y, false)
    }
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId) || pointers.current.size) return
    const g = gesture.current
    const { scale } = view.current
    if (g.pinched) {
      // Almost back to normal: settle on exactly normal.
      if (scale < 1.1) apply(1, 0, 0, true)
      return
    }
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (scale === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipe?.(dx < 0 ? 1 : -1)
    } else if (!g.moved && e.type === 'pointerup') {
      if (e.timeStamp - g.lastTap < 320) {
        g.lastTap = 0
        if (scale > 1) apply(1, 0, 0, true)
        else zoomAt(TAP_ZOOM, e.clientX, e.clientY, true)
      } else g.lastTap = e.timeStamp
    }
  }

  return (
    <div
      ref={box}
      className="relative min-h-0 flex-1 cursor-zoom-in touch-none select-none overflow-hidden rounded-lg"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={(e) => zoomAt(view.current.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY, true)}
    >
      <div ref={layer} className="absolute inset-0 will-change-transform">
        <ProductImage src={image.url || null} alt={image.alt} fill sizes="96vw" draggable={false} className="object-contain" />
      </div>
      <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs text-fg-muted sm:hidden">Pinch or double-tap to zoom</p>
    </div>
  )
}
