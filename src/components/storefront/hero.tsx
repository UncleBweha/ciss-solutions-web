'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductImage } from '@/components/product/product-image'
import { buttonClass } from '@/components/ui/button'
import { formatKES } from '@/lib/ecommerce/money'
import { cn } from '@/lib/utils'

export type HeroSlide = {
  id: string
  eyebrow: string | null
  title: string
  highlight: string | null
  subtitle: string | null
  imageUrl: string | null
  imageAlt: string | null
  ctaText: string | null
  ctaUrl: string | null
  secondaryCtaText: string | null
  secondaryCtaUrl: string | null
  background: string | null
  product: { name: string; slug: string; price: number; short: string | null } | null
}

/** Homepage promo carousel: a compact retail banner, not a full-screen hero. */
export function Hero({ slides, className }: { slides: HeroSlide[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 7000)
    return () => clearInterval(t)
  }, [count, paused])

  if (!count) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Offers"
      className={cn('relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-white', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}`}
          aria-hidden={i !== index}
          inert={i !== index}
          className={cn(
            'grid h-full grid-cols-[minmax(0,1fr)] items-center transition-opacity duration-500 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]',
            i === index ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
          )}
          style={slide.background ? { background: slide.background } : undefined}
        >
          <div className="order-2 px-5 pb-6 pt-2 sm:order-1 sm:py-8 sm:pl-8 sm:pr-2 lg:pl-10">
            {slide.eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-magenta">{slide.eyebrow}</p> : null}
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              {slide.title}
              {slide.highlight ? <span className="text-primary-light"> {slide.highlight}</span> : null}
            </h2>
            {slide.subtitle ? <p className="mt-2 max-w-md text-sm text-fg-secondary sm:text-base">{slide.subtitle}</p> : null}
            {slide.product ? (
              <p className="mt-3 text-sm text-fg-secondary">
                {/* Skip the name when the slide title already is the product. */}
                {slide.product.name.toLowerCase().startsWith(slide.title.toLowerCase()) ? null : <>{slide.product.name} </>}
                <span className="whitespace-nowrap text-xl font-bold text-fg">{formatKES(slide.product.price)}</span>
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              {slide.ctaText && slide.ctaUrl ? (
                <Link href={slide.ctaUrl} className={buttonClass('primary', 'md')}>
                  {slide.ctaText}
                </Link>
              ) : null}
              {slide.secondaryCtaText && slide.secondaryCtaUrl ? (
                <Link href={slide.secondaryCtaUrl} className="text-sm font-semibold text-primary-light hover:underline">
                  {slide.secondaryCtaText}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="relative order-1 aspect-[16/9] sm:order-2 sm:aspect-auto sm:h-full sm:min-h-[18rem]">
            <ProductImage
              src={slide.imageUrl}
              alt={slide.imageAlt ?? ''}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
              className="object-contain p-6 sm:p-8"
            />
          </div>
        </div>
      ))}

      {count > 1 ? (
        <div className="absolute right-3 top-3 flex items-center gap-1 sm:bottom-3 sm:top-auto">
          <button type="button" onClick={() => setIndex((index - 1 + count) % count)} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-white text-fg-secondary hover:text-fg" aria-label="Previous slide">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-1 font-mono text-xs text-fg-muted" aria-live="polite">
            {index + 1}/{count}
          </span>
          <button type="button" onClick={() => setIndex((index + 1) % count)} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-white text-fg-secondary hover:text-fg" aria-label="Next slide">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  )
}
