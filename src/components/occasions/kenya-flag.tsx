import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/* ===========================================================================
   The Kenyan flag, drawn to the real design: black, red and green bands
   separated by white (6:1:6:1:6), the Maasai shield over two crossed white
   spears, 3:2.

   KenyaFlag is the flat flag. WavingKenyaFlag cuts the same image into thin
   vertical strips that rise and fall out of step, with shadow and highlight
   passing across them, so the cloth ripples from the pole outwards the way a
   real flag does. Transform and opacity only, so it stays smooth on phones.
   ========================================================================= */

const FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" preserveAspectRatio="none"><rect width="60" height="40" fill="#000"/><rect y="12" width="60" height="16" fill="#fff"/><rect y="14" width="60" height="12" fill="#bb0000"/><rect y="28" width="60" height="12" fill="#006600"/><g stroke="#fff" stroke-width="1.3" stroke-linecap="round"><line x1="19.5" y1="35" x2="40.5" y2="5"/><line x1="40.5" y1="35" x2="19.5" y2="5"/></g><ellipse cx="40.2" cy="5.6" rx="1.5" ry="3.4" fill="#fff" transform="rotate(35 40.2 5.6)"/><ellipse cx="19.8" cy="5.6" rx="1.5" ry="3.4" fill="#fff" transform="rotate(-35 19.8 5.6)"/><path d="M30 4C37.5 10 37.5 30 30 36C22.5 30 22.5 10 30 4Z" fill="#000"/><path d="M30 6.5C34 12 34 28 30 33.5C26 28 26 12 30 6.5Z" fill="#bb0000"/><g fill="none" stroke="#fff" stroke-width=".8"><path d="M27.4 12C26.6 17 26.6 23 27.4 28"/><path d="M32.6 12C33.4 17 33.4 23 32.6 28"/></g><ellipse cx="30" cy="20" rx="1" ry="2.6" fill="#fff"/><ellipse cx="30" cy="13.2" rx=".7" ry="1.4" fill="#fff"/><ellipse cx="30" cy="26.8" rx=".7" ry="1.4" fill="#fff"/></svg>`

export const KENYA_FLAG_URL = `url("data:image/svg+xml,${encodeURIComponent(FLAG_SVG)}")`

export const KENYA_COLORS = ['#000000', '#bb0000', '#006600', '#ffffff']

export function KenyaFlag({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cn('block bg-no-repeat', className)} style={{ backgroundImage: KENYA_FLAG_URL, backgroundSize: '100% 100%', ...style }} />
}

export function WavingKenyaFlag({
  width,
  slices = 24,
  amplitude,
  duration = 2.6,
  pole = true,
  className,
}: {
  /** Width of the cloth in px; height follows the flag's 3:2. */
  width: number
  slices?: number
  /** Largest rise and fall at the free end, px. */
  amplitude?: number
  duration?: number
  pole?: boolean
  className?: string
}) {
  const height = Math.round((width * 2) / 3)
  const amp = amplitude ?? Math.max(2, width / 22)
  const strip = width / slices

  return (
    <div aria-hidden className={cn('relative flex items-start', className)}>
      {pole ? (
        <span
          className="relative z-10 block w-[5px] shrink-0 rounded-full shadow-[1px_0_2px_rgba(0,0,0,0.35)]"
          style={{
            height: height * 2.1,
            background: 'linear-gradient(90deg,#8d8d8d,#f4f4f4 45%,#9a9a9a)',
          }}
        >
          <span className="absolute -left-[3px] -top-[6px] block h-[11px] w-[11px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff6c8,#d4a017_60%,#8a6400)]" />
        </span>
      ) : null}
      <div className="relative" style={{ width, height: height + amp * 2, marginTop: pole ? 4 : 0 }}>
        {Array.from({ length: slices }, (_, i) => {
          // The cloth barely moves at the pole and most at the free end.
          const reach = 0.15 + 0.85 * (i / (slices - 1))
          const style = {
            left: i * strip,
            top: amp,
            width: strip + 0.6,
            height,
            backgroundImage: KENYA_FLAG_URL,
            backgroundSize: `${width}px ${height}px`,
            backgroundPosition: `${-i * strip}px 0`,
            '--wave-amp': `${(amp * reach).toFixed(2)}px`,
            '--wave-duration': `${duration}s`,
            animationDelay: `${(-i * (duration / slices) * 1.1).toFixed(3)}s`,
          } as CSSProperties
          return (
            <span key={i} className="animate-flag-ripple absolute block" style={style}>
              <span className="animate-flag-shade absolute inset-0 block bg-black" style={{ animationDelay: style.animationDelay } as CSSProperties} />
              <span className="animate-flag-shine absolute inset-0 block bg-white" style={{ animationDelay: style.animationDelay } as CSSProperties} />
            </span>
          )
        })}
      </div>
    </div>
  )
}
