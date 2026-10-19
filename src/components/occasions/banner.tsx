import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { ProductCardData } from '@/types/catalog'
import type { Occasion } from '@/lib/occasions/types'
import { NewYearCountdown } from './new-year-countdown'
import { ProductRail } from '@/components/product/product-card'
import { OccasionArt } from './art'
import { PosterParticles } from './particles'
import { WavingKenyaFlag } from './kenya-flag'
import { scriptFont } from './script-font'
import { nairobiToday, occasionDateLabel, occasionIntensity, peakCountdown, posterMessage, splitHeadline, themeFor } from '@/lib/occasions/themes'
import { siteUrl } from '@/lib/env'
import { cn } from '@/lib/utils'

/* ===========================================================================
   The occasion poster at the top of the home page: script greeting over a
   bold title, a short message, the date, and an illustration for the
   occasion, with its own ambient motion (src/components/occasions/).

   The headline and message come from Admin -> Occasions; the look comes
   from the occasion's theme (src/lib/occasion-themes.ts).
   ========================================================================= */

function enter(order: number): CSSProperties {
  return { animationDelay: `${0.1 + order * 0.12}s` }
}

export function OccasionBanner({
  occasion,
  products,
  picksHref = null,
}: {
  occasion: Occasion
  products: ProductCardData[]
  /** Where "Shop the picks" goes; no button when null. */
  picksHref?: string | null
}) {
  const theme = themeFor(occasion)
  const today = nairobiToday()
  // Christmas builds up to the 25th: fewer snowflakes early on, a countdown.
  const level = occasionIntensity(occasion, today)
  const countdown = peakCountdown(occasion, today)
  const { script, title, tagline } = splitHeadline(occasion.bannerHeadline)
  const message = posterMessage(occasion.bannerSubhead, theme)
  const year = theme.key === 'new-year' && today.month === 12 ? today.year + 1 : today.year
  const national = occasion.kind === 'kenyan_national'
  const longTitle = title.length > 18
  // Pale posters (Mother's Day, Easter) carry dark text.
  const light = theme.text !== '#ffffff'

  return (
    <section className="mt-3 sm:mt-4" aria-label={occasion.name}>
      <div
        className="relative isolate overflow-hidden rounded-[22px] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] sm:rounded-[26px]"
        style={{ background: theme.background, color: theme.text }}
      >
        {theme.rays ? (
          <div aria-hidden className="pointer-events-none absolute -right-1/4 top-1/2 -z-10 aspect-square w-[130%] -translate-y-1/2 sm:-right-[10%] sm:w-[80%]">
            <div className="animate-poster-rays h-full w-full rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.11)_0deg_7deg,transparent_7deg_18deg)] [mask-image:radial-gradient(circle,black_10%,transparent_68%)]" />
          </div>
        ) : null}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <PosterParticles theme={theme.key} density={[0.35, 0.6, 0.8, 1][level - 1]} />

        {national && theme.key !== 'kenya' ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10 sm:right-5 sm:top-4">
            <WavingKenyaFlag width={58} slices={14} />
          </div>
        ) : null}

        <div className="relative grid items-center md:grid-cols-[1.1fr_1fr]">
          <div className="relative z-10 px-6 pb-6 pt-2 sm:px-10 sm:pb-9 md:py-10">
            {script ? (
              <p
                className={cn(scriptFont.className, 'animate-poster-enter text-[46px] leading-[0.9] sm:text-[66px]')}
                style={{ color: theme.script, ...enter(0) }}
              >
                {script}
              </p>
            ) : null}
            <h2
              className={cn(
                'animate-poster-enter font-extrabold uppercase leading-[0.92] tracking-[-0.02em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
                longTitle ? 'text-[30px] sm:text-[42px] lg:text-[48px]' : 'text-[40px] sm:text-[58px] lg:text-[64px]',
              )}
              style={enter(1)}
            >
              {title}
            </h2>
            {tagline ? (
              <p className="animate-poster-enter mt-2 text-[16px] font-bold sm:text-[19px]" style={enter(2)}>
                {tagline.charAt(0).toUpperCase() + tagline.slice(1)}
              </p>
            ) : null}

            <div className="animate-poster-enter mt-4 flex items-center gap-3" style={{ ...enter(2), color: theme.ornament }} aria-hidden>
              <span className="text-[13px] tracking-[0.35em]">✦✦✦</span>
              <span className="h-px max-w-[220px] flex-1 opacity-60" style={{ background: theme.ornament }} />
            </div>

            <p className="animate-poster-enter mt-3 max-w-[440px] text-[14.5px] leading-relaxed opacity-95 sm:text-[16px]" style={enter(3)}>
              {message}
            </p>

            <div className="animate-poster-enter mt-5 flex flex-wrap items-center gap-2.5" style={enter(4)}>
              <p
                className="inline-flex rounded-md px-4 py-2 text-[12.5px] font-extrabold uppercase tracking-[0.08em] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] sm:text-[14px]"
                style={{ background: theme.pill.background, color: theme.pill.text }}
              >
                {occasionDateLabel(occasion, today)}
              </p>
              {countdown ? (
                <p
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold sm:text-[13.5px]',
                    level === 4 && 'animate-art-pulse',
                  )}
                  style={{ borderColor: theme.ornament, color: theme.ornament }}
                >
                  <span aria-hidden>✦</span>
                  {countdown}
                </p>
              ) : null}
              {picksHref ? (
                <Link
                  href={picksHref}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-strong px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] hover:bg-primary-strong-hover sm:text-[14px]"
                >
                  Shop {occasion.name} picks
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>

            {theme.key === 'new-year' ? <NewYearCountdown /> : null}
          </div>

          <div className="relative order-first h-[210px] sm:h-[260px] md:order-none md:h-[340px]">
            <div className="animate-poster-art absolute inset-0 flex items-center justify-center px-6 pt-4 md:p-6">
              <OccasionArt theme={theme.key} year={year} />
            </div>
          </div>
        </div>

        <div
          className={cn(
            'relative z-10 flex items-center justify-between gap-3 px-6 py-2.5 text-[11.5px] font-semibold backdrop-blur-sm sm:px-10 sm:text-[12.5px]',
            light ? 'bg-white/45' : 'bg-black/25',
          )}
        >
          <span className="truncate">From all of us at CISS Solutions</span>
          <span className="shrink-0 opacity-90">{siteUrl.replace(/^https?:\/\//, '')}</span>
        </div>
      </div>

      {products.length > 0 ? (
        <div className="mt-4">
          <ProductRail products={products} label={`${occasion.name} picks`} />
        </div>
      ) : null}
    </section>
  )
}
