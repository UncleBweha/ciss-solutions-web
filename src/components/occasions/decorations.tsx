import type { CSSProperties } from 'react'
import type { Occasion } from '@/lib/occasions/types'
import { cn } from '@/lib/utils'
import { themeKeyFor, type Level, type OccasionThemeKey } from '@/lib/occasions/themes'
import { KENYA_COLORS, KenyaFlag, WavingKenyaFlag } from './kenya-flag'
import { OccasionArt } from './art'

/* ===========================================================================
   The whole site dressed for an occasion: light strings along the top edge,
   a ribbon under the header (OccasionRibbon), the occasion's figure in the
   corner, and its weather (snow, confetti, leaves, hearts, fireworks).
   Product photos get their own ribbon and ornament from card-decor.ts.

   Everything is drawn (SVG and CSS), never emoji, which look different on
   every phone. Every layer is fixed, pointer-events-none and aria-hidden, so
   nothing ever sits between a shopper and what they tap. Motion is
   transform/opacity only; the reduced-motion rule in globals.css stills it.
   ========================================================================= */

/** A deterministic spread: varied enough not to look like a grid, and the
    same on the server and in the browser. */
function spread(count: number, seedOffset = 0): number[] {
  return Array.from({ length: count }, (_, i) => ((i * 37 + seedOffset * 13) % 100) / 100)
}

/* ---- Light strings ------------------------------------------------------ */

const LIGHTS: Partial<Record<OccasionThemeKey, string[]>> = {
  christmas: ['#ff3b30', '#ffd60a', '#30d158', '#0a84ff', '#ff9f0a'],
  'new-year': ['#fff4c2', '#f6c344', '#ffffff', '#ffd60a'],
  love: ['#ff2d55', '#ffffff', '#ff7aa2', '#ffd1dc'],
  eid: ['#ffd60a', '#fff4c2', '#f2c94c'],
  diwali: ['#ffcf5c', '#ff9f1c', '#ff4d6d', '#ffd60a'],
  halloween: ['#ff8c1a', '#a855f7', '#ff8c1a', '#84cc16'],
  easter: ['#c4b5fd', '#fde68a', '#f9a8d4', '#bae6fd'],
  mothers: ['#ff8fab', '#ffffff', '#ffc2d1'],
  womens: ['#c77dff', '#ffffff', '#e0aaff'],
  fathers: ['#ffb066', '#5cc8ff', '#ffffff'],
  service: ['#ff9f0a', '#ffffff', '#ffd60a'],
  school: ['#ffd23f', '#5cc8ff', '#ff8a3d', '#ffffff'],
  celebration: ['#ff3b30', '#ffd60a', '#30d158', '#0a84ff'],
}

/** A wire draped across the top of the screen with a bulb hanging at the
    bottom of each loop. Each bulb has a socket, a glass body and a halo,
    and they twinkle out of step. Fewer, wider loops on phones. */
function LightString({ colors }: { colors: string[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[30px]" aria-hidden>
      {[
        { loops: 9, className: 'sm:hidden' },
        { loops: 26, className: 'hidden sm:block' },
      ].map(({ loops, className }) => (
        <div key={loops} className={cn('absolute inset-0', className)}>
          <svg className="absolute inset-x-0 top-0 h-[12px] w-full" viewBox={`0 0 ${loops * 20} 12`} preserveAspectRatio="none">
            <path
              d={Array.from({ length: loops }, (_, i) => `${i === 0 ? 'M0 1' : ''} Q${i * 20 + 10} 15 ${i * 20 + 20} 1`).join(' ')}
              fill="none"
              stroke="#3a3a3a"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {Array.from({ length: loops }, (_, i) => {
            const color = colors[i % colors.length]
            return (
              <span
                key={i}
                className="absolute top-[7px] block -translate-x-1/2"
                style={{ left: `${((i + 0.5) / loops) * 100}%`, transform: `translateX(-50%) rotate(${i % 2 ? 10 : -10}deg)` }}
              >
                <span className="mx-auto block h-[4px] w-[4px] rounded-[1px] bg-[#2a2a2a]" />
                <span
                  className="animate-oc-bulb relative block h-[12px] w-[8px] rounded-[50%_50%_45%_45%/40%_40%_60%_60%]"
                  style={
                    {
                      background: `radial-gradient(circle at 35% 30%, #ffffff 0 12%, ${color} 45%, ${color} 100%)`,
                      boxShadow: `0 0 6px 2px ${color}, 0 0 14px 4px ${color}66`,
                      animationDelay: `${-((i * 0.37) % 1.8).toFixed(2)}s`,
                    } as CSSProperties
                  }
                />
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ---- Weather ------------------------------------------------------------ */

function Snowfall({ count }: { count: number }) {
  const flakes = spread(count)
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {flakes.map((p, i) => {
        const size = 8 + (i % 4) * 4
        const style = {
          left: `${p * 100}%`,
          top: 0,
          '--fall-duration': `${9 + (i % 5) * 2}s`,
          '--fall-drift': `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 8)}px`,
          '--fall-opacity': 0.6 + (i % 3) * 0.12,
          animationDelay: `${-(i % 9) * 1.3}s`,
        } as CSSProperties
        return (
          <span key={i} className="animate-occasion-fall absolute block" style={style}>
            <svg width={size} height={size} viewBox="0 0 24 24" className="drop-shadow-[0_0_2px_rgba(0,0,0,0.25)]">
              <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
                {[0, 60, 120].map((a) => (
                  <g key={a} transform={`rotate(${a} 12 12)`}>
                    <line x1="12" y1="2" x2="12" y2="22" />
                    <path d="M12 6l-3-3M12 6l3-3M12 18l-3 3M12 18l3 3" fill="none" />
                  </g>
                ))}
              </g>
            </svg>
          </span>
        )
      })}
    </div>
  )
}

const CONFETTI_COLORS = ['#f6c344', '#ff2d55', '#30d158', '#0a84ff', '#ffffff']

function Confetti() {
  const pieces = spread(24, 5)
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => {
        const style = {
          left: `${p * 100}%`,
          top: 0,
          width: `${5 + (i % 3) * 2}px`,
          height: `${8 + (i % 3) * 3}px`,
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          '--fall-duration': `${6 + (i % 5) * 1.5}s`,
          '--fall-drift': `${(i % 2 === 0 ? 1 : -1) * (24 + (i % 4) * 10)}px`,
          '--fall-spin': `${360 + (i % 3) * 180}deg`,
          '--fall-opacity': 0.85,
          animationDelay: `${-(i % 8) * 1.1}s`,
        } as CSSProperties
        return <span key={i} className="animate-occasion-fall absolute rounded-[1px]" style={style} />
      })}
    </div>
  )
}

/** Bursts across the upper sky, each a ring of rays, staggered. */
function SkyFireworks() {
  const bursts = [
    { left: '14%', top: '20%', delay: 0, color: '#f6c344', r: 46 },
    { left: '48%', top: '12%', delay: 0.9, color: '#ff2d55', r: 54 },
    { left: '82%', top: '22%', delay: 1.6, color: '#30d158', r: 42 },
    { left: '30%', top: '34%', delay: 2.3, color: '#5cc8ff', r: 36 },
    { left: '66%', top: '30%', delay: 3.1, color: '#fff4c2', r: 40 },
  ]
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden>
      {bursts.map((b, i) => (
        <svg
          key={i}
          className="animate-art-burst absolute"
          width={b.r * 2}
          height={b.r * 2}
          viewBox="-50 -50 100 100"
          style={{ left: b.left, top: b.top, animationDelay: `${b.delay}s`, filter: `drop-shadow(0 0 4px ${b.color})` }}
        >
          {Array.from({ length: 16 }, (_, k) => {
            const a = (k / 16) * Math.PI * 2
            return (
              <line
                key={k}
                x1={Math.cos(a) * 12}
                y1={Math.sin(a) * 12}
                x2={Math.cos(a) * 46}
                y2={Math.sin(a) * 46}
                stroke={b.color}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            )
          })}
          <circle r="4" fill="#ffffff" />
        </svg>
      ))}
    </div>
  )
}

function FloatingHearts() {
  const hearts = spread(14, 7)
  const colors = ['#ff2d55', '#ff7aa2', '#e0234e']
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {hearts.map((p, i) => {
        const size = 12 + (i % 3) * 6
        const style = {
          left: `${p * 100}%`,
          bottom: 0,
          '--float-duration': `${9 + (i % 5) * 1.8}s`,
          '--float-opacity': 0.7,
          animationDelay: `${-(i % 7) * 1.4}s`,
        } as CSSProperties
        return (
          <span key={i} className="animate-occasion-float-up absolute block" style={style}>
            <svg width={size} height={size} viewBox="0 0 20 20">
              <path d="M10 18C3 13 0 9 2 5C4 1 8 2 10 5C12 2 16 1 18 5C20 9 17 13 10 18Z" fill={colors[i % colors.length]} />
            </svg>
          </span>
        )
      })}
    </div>
  )
}

function FlyingBats() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[12%] z-30 h-[30vh] overflow-hidden" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-poster-fly absolute block"
          style={{ top: `${i * 30}%`, '--poster-duration': `${10 + i * 3}s`, animationDelay: `${-i * 4}s` } as CSSProperties}
        >
          <svg width="40" height="20" viewBox="0 0 40 20" className="animate-art-flap">
            <path
              d="M20 8C18 4 14 2 8 4C10 6 9 8 6 9C4 8 2 9 0 12C6 11 10 13 12 16C14 13 17 13 20 15C23 13 26 13 28 16C30 13 34 11 40 12C38 9 36 8 34 9C31 8 30 6 32 4C26 2 22 4 20 8Z"
              fill="#1a0b26"
            />
          </svg>
        </span>
      ))}
    </div>
  )
}

/* ---- Kenyan national days ----------------------------------------------- */

/** A string of real Kenyan flags along the top edge, each swaying a little
    out of step, a larger flag rippling on a pole in the corner, and a burst
    of confetti in the flag's colours when the page opens. */
function FlagBunting() {
  const flags = spread(22, 11)
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[18px] w-full overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 top-[1px] h-px bg-white/50" />
        <div className="flex h-full justify-around px-1">
          {flags.map((offset, i) => (
            <span
              key={i}
              // Every other flag on phones, so they hang apart, not overlapping.
              className={cn('animate-occasion-flag-sway mt-[1px] shrink-0', i % 2 ? 'hidden sm:block' : 'block')}
              style={{ '--sway-delay': `${(offset * 2).toFixed(2)}s` } as CSSProperties}
            >
              <KenyaFlag className="h-[14px] w-[21px] shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
            </span>
          ))}
        </div>
      </div>
      <div className="pointer-events-none fixed bottom-[100px] left-3 z-30 lg:bottom-6 lg:left-5" aria-hidden>
        <WavingKenyaFlag width={54} slices={14} />
      </div>
      <ConfettiShower colors={KENYA_COLORS} />
    </>
  )
}

/** One burst of confetti down the whole page when it opens, then gone. */
function ConfettiShower({ colors }: { colors: string[] }) {
  const pieces = spread(36, 5)
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((x, i) => (
        <span
          key={i}
          className="animate-occasion-shower absolute top-0 block rounded-[1px]"
          style={
            {
              left: `${(x * 100).toFixed(1)}%`,
              width: 6 + (i % 3) * 2,
              height: 10 + (i % 4) * 2,
              background: colors[i % colors.length],
              boxShadow: colors[i % colors.length] === '#ffffff' ? '0 0 0 1px rgba(0,0,0,0.08)' : undefined,
              '--drift': `${((i % 7) - 3) * 18}px`,
              '--spin': `${360 + (i % 5) * 120}deg`,
              '--shower-duration': `${3 + (i % 6) * 0.35}s`,
              '--shower-delay': `${(i % 9) * 0.12}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** Mazingira Day: a few leaves drifting down the page. */
function FallingLeaves() {
  const leaves = spread(12, 4)
  const colors = ['#5cb84a', '#2f7d31', '#9be07a', '#d9a441']
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {leaves.map((x, i) => {
        const duration = 11 + (i % 5) * 2.5
        return (
          <span
            key={i}
            className="animate-poster-leaf absolute -top-8 block"
            style={
              {
                left: `${(x * 100).toFixed(1)}%`,
                '--travel': '110vh',
                '--drift': `${((i % 5) - 2) * 26}px`,
                '--poster-duration': `${duration}s`,
                animationDelay: `${(-(i * 1.7) % duration).toFixed(2)}s`,
                opacity: 0.85,
              } as CSSProperties
            }
          >
            <svg width={14 + (i % 3) * 5} height={14 + (i % 3) * 5} viewBox="0 0 20 20">
              <path d="M2 18C2 8 8 2 18 2C18 12 12 18 2 18Z" fill={colors[i % colors.length]} />
              <path d="M2 18L14 6" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
            </svg>
          </span>
        )
      })}
    </div>
  )
}

/* ---- The occasion's figure in the corner -------------------------------- */

const MASCOT: Partial<Record<OccasionThemeKey, OccasionThemeKey>> = {
  christmas: 'christmas',
  love: 'love',
  eid: 'eid',
  diwali: 'diwali',
  halloween: 'halloween',
  easter: 'easter',
  mothers: 'mothers',
  womens: 'womens',
  fathers: 'fathers',
  school: 'school',
}

function CornerMascot({ theme }: { theme: OccasionThemeKey }) {
  const art = MASCOT[theme]
  if (!art) return null
  // Only where the page has empty margins either side of the content:
  // anywhere narrower it would sit over product names. Hidden with visibility, not
  // display: the poster's artwork shares its gradient ids, and Chrome paints no
  // gradient whose definition sits inside a display:none element.
  return (
    <div
      className="pointer-events-none fixed bottom-5 left-4 z-30 invisible h-[110px] w-[110px] drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)] min-[1580px]:visible"
      aria-hidden
    >
      <OccasionArt theme={art} year={new Date().getFullYear()} />
    </div>
  )
}

/* ---- The ribbon under the header ---------------------------------------- */

const RIBBONS: Partial<Record<OccasionThemeKey, { band: string; animated?: boolean }>> = {
  christmas: { band: 'repeating-linear-gradient(135deg,#c3182f 0 12px,#ffffff 12px 24px,#1f7a3a 24px 36px,#ffffff 36px 48px)', animated: true },
  'new-year': { band: 'linear-gradient(90deg,#b8860b,#fff3b0,#e2b23c,#fff3b0,#b8860b)', animated: true },
  kenya: { band: 'linear-gradient(#000 0 30%,#fff 30% 36%,#bb0000 36% 64%,#fff 64% 70%,#006600 70% 100%)' },
  mazingira: { band: 'linear-gradient(#000 0 30%,#fff 30% 36%,#bb0000 36% 64%,#fff 64% 70%,#006600 70% 100%)' },
  love: { band: 'repeating-linear-gradient(135deg,#e0234e 0 12px,#ffd1dc 12px 24px)', animated: true },
  eid: { band: 'repeating-linear-gradient(135deg,#0c4b36 0 10px,#f2c94c 10px 14px)', animated: true },
  diwali: { band: 'repeating-linear-gradient(135deg,#ff9f1c 0 10px,#c2185b 10px 20px,#ffcf5c 20px 30px)', animated: true },
  halloween: { band: 'repeating-linear-gradient(135deg,#ff8c1a 0 12px,#24103a 12px 24px)', animated: true },
  easter: { band: 'repeating-linear-gradient(135deg,#c4b5fd 0 12px,#fde68a 12px 24px,#bae6fd 24px 36px)', animated: true },
  mothers: { band: 'repeating-linear-gradient(135deg,#f06292 0 12px,#ffffff 12px 24px)', animated: true },
  womens: { band: 'repeating-linear-gradient(135deg,#9d4edd 0 12px,#ffffff 12px 24px)', animated: true },
  fathers: { band: 'repeating-linear-gradient(135deg,#173562 0 12px,#ffb066 12px 24px)', animated: true },
  service: { band: 'repeating-linear-gradient(135deg,#1d6fd8 0 12px,#ffffff 12px 24px)', animated: true },
  school: { band: 'repeating-linear-gradient(135deg,#173a7a 0 12px,#ffd23f 12px 24px)', animated: true },
  celebration: { band: 'repeating-linear-gradient(135deg,#1d6fd8 0 12px,#ffffff 12px 24px)', animated: true },
}

/** A festive band right under the header: candy-cane stripes at Christmas,
    gold at New Year, the flag's colours on national days. */
export function OccasionRibbon({ occasion, level = 4 }: { occasion: Occasion | null; level?: Level }) {
  // Christmas builds up: the ribbon joins from the second level.
  if (!occasion || level < 2) return null
  const ribbon = RIBBONS[themeKeyFor(occasion)]
  if (!ribbon) return null
  return (
    <div
      aria-hidden
      className={cn('h-[6px] w-full shadow-[0_1px_3px_rgba(0,0,0,0.15)]', ribbon.animated && 'animate-oc-ribbon')}
      style={{ background: ribbon.band, backgroundSize: ribbon.animated ? '200% 100%' : undefined }}
    />
  )
}

/* ---- The whole set, per occasion ------------------------------------------ */

/** Snowflakes on screen at each level of the build-up. */
const SNOW: Record<Level, number> = { 1: 0, 2: 10, 3: 20, 4: 32 }

/**
 * `level` is how far into the build-up the occasion is (occasionIntensity):
 * Christmas starts with just the lights on the 15th, adds snow, then the
 * tree, and is everything at once on the 25th, then winds down again.
 * Occasions without a big day are always at 4.
 */
export function OccasionDecorations({ occasion, level = 4 }: { occasion: Occasion | null; level?: Level }) {
  if (!occasion) return null
  const theme = themeKeyFor(occasion)
  const lights = LIGHTS[theme]

  return (
    <>
      {lights ? <LightString colors={lights} /> : null}
      {theme === 'kenya' || theme === 'mazingira' ? <FlagBunting /> : null}
      {theme === 'mazingira' ? <FallingLeaves /> : null}
      {theme === 'christmas' && SNOW[level] > 0 ? <Snowfall count={SNOW[level]} /> : null}
      {theme === 'christmas' && level === 4 ? <ConfettiShower colors={['#c3182f', '#1f7a3a', '#f6d77f', '#ffffff']} /> : null}
      {theme === 'new-year' ? (
        <>
          <SkyFireworks />
          <Confetti />
          {level === 4 ? <ConfettiShower colors={CONFETTI_COLORS} /> : null}
        </>
      ) : null}
      {theme === 'love' ? <FloatingHearts /> : null}
      {theme === 'halloween' ? <FlyingBats /> : null}
      {level >= 3 ? <CornerMascot theme={theme} /> : null}
    </>
  )
}
