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
        <div className="relative overflow-hidden rounded-[2rem] border border-border">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className={cn(
                'grid items-center gap-8 px-6 pb-16 pt-10 transition-opacity duration-700 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:px-14 lg:py-16',
                i === index ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
              )}
              style={{
                background:
                  slide.background ||
                  'radial-gradient(70% 90% at 80% 40%, rgba(22,140,255,.28), transparent 60%), radial-gradient(50% 70% at 10% 90%, rgba(139,92,246,.22), transparent 60%), linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.02))',
              }}
            >
              <div className="relative z-10 max-w-xl">
                {slide.eyebrow ? (
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-light">
                    {slide.eyebrow}
                  </p>
                ) : null}
                {i === 0 ? (
                  <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl xl:text-6xl">
                    {slide.title}
                    {slide.highlight ? <span className="text-gradient mt-1 block">{slide.highlight}</span> : null}
                  </h1>
                ) : (
                  <h2 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl xl:text-6xl">
                    {slide.title}
                    {slide.highlight ? <span className="text-gradient mt-1 block">{slide.highlight}</span> : null}
                  </h2>
                )}
                {slide.subtitle ? <p className="mt-5 max-w-lg text-base text-fg-secondary sm:text-lg">{slide.subtitle}</p> : null}
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
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-md lg:max-w-lg">
                <div className="absolute inset-[12%] rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
                <ProductImage
                  src={slide.imageUrl}
                  alt={slide.imageAlt ?? ''}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="animate-float object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]"
                />
                {slide.product ? (
                  <div className="glass absolute bottom-2 right-0 hidden w-56 sm:block rounded-2xl bg-background/75 p-4 sm:bottom-6 sm:right-2 sm:w-64">
                    <p className="font-bold leading-tight">{slide.product.name}</p>
                    {slide.product.short ? <p className="mt-1 text-xs text-fg-secondary">{slide.product.short}</p> : null}
                    <p className="mt-2 text-xl font-extrabold">{formatKES(slide.product.price)}</p>
                    <Link href={`/p/${slide.product.slug}`} className={buttonClass('primary', 'sm', 'mt-3 w-full')}>
                      View Details
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {count > 1 ? (
            <div className="absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setIndex((index - 1 + count) % count)} className="grid h-9 w-9 place-items-center rounded-full bg-background/50 text-fg-secondary backdrop-blur hover:text-fg" aria-label="Previous slide">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={cn('h-2 rounded-full transition-all', i === index ? 'w-8 bg-primary' : 'w-2 bg-white/30 hover:bg-white/50')}
                />
              ))}
              <button type="button" onClick={() => setIndex((index + 1) % count)} className="grid h-9 w-9 place-items-center rounded-full bg-background/50 text-fg-secondary backdrop-blur hover:text-fg" aria-label="Next slide">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
