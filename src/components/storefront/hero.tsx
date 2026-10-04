'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
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

export function Hero({ slides }: { slides: HeroSlide[] }) {
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
      aria-label="Featured"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-panel">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)] items-stretch transition-opacity duration-500 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]',
                i === index ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
              )}
              style={slide.background ? { background: slide.background } : undefined}
            >
              <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
                {slide.eyebrow ? (
                  <p className="label-mono mb-5 flex items-center gap-2 text-primary-light">
                    <span className="reg-mark" aria-hidden="true" />
                    {slide.eyebrow}
                  </p>
                ) : null}
                {i === 0 ? (
                  <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl">
                    {slide.title}
                    {slide.highlight ? <span className="mt-1 block text-primary-light">{slide.highlight}</span> : null}
                  </h1>
                ) : (
                  <h2 className="text-4xl font-bold leading-[1.08] sm:text-5xl">
                    {slide.title}
                    {slide.highlight ? <span className="mt-1 block text-primary-light">{slide.highlight}</span> : null}
                  </h2>
                )}
                {slide.subtitle ? <p className="mt-5 max-w-md text-base text-fg-secondary sm:text-lg">{slide.subtitle}</p> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  {slide.ctaText && slide.ctaUrl ? (
                    <Link href={slide.ctaUrl} className={buttonClass('primary', 'lg')}>
                      {slide.ctaText}
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {slide.secondaryCtaText && slide.secondaryCtaUrl ? (
                    <Link href={slide.secondaryCtaUrl} className={buttonClass('glass', 'lg')}>
                      {slide.secondaryCtaText}
                    </Link>
                  ) : null}
                </div>
                {count > 1 ? (
                  <div className="mt-10 flex items-center gap-1">
                    <button type="button" onClick={() => setIndex((index - 1 + count) % count)} className="grid h-9 w-9 place-items-center rounded-md border border-border text-fg-secondary hover:border-border-strong hover:text-fg" aria-label="Previous slide">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setIndex((index + 1) % count)} className="grid h-9 w-9 place-items-center rounded-md border border-border text-fg-secondary hover:border-border-strong hover:text-fg" aria-label="Next slide">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="label-mono ml-3 text-fg-muted">
                      {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="product-stage relative flex flex-col lg:border-l lg:border-border">
                <div className="relative aspect-[4/3] w-full lg:aspect-auto lg:flex-1">
                  <ProductImage
                    src={slide.imageUrl}
                    alt={slide.imageAlt ?? ''}
                    fill
                    priority={i === 0}
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    className="object-contain p-8 sm:p-12"
                  />
                </div>
                {slide.product ? (
                  <Link
                    href={`/p/${slide.product.slug}`}
                    className="group flex items-center justify-between gap-4 border-t border-black/10 bg-white px-6 py-4 text-background"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{slide.product.name}</span>
                      {slide.product.short ? <span className="block truncate text-sm text-slate-500">{slide.product.short}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-lg font-bold">{formatKES(slide.product.price)}</span>
                      <span className="hidden items-center gap-1 text-sm font-semibold text-primary-strong group-hover:underline sm:flex">
                        View <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ))}

          <div className="ink-stripe absolute inset-x-0 bottom-0 h-1" aria-hidden="true" />

        </div>
      </div>
    </section>
  )
}
