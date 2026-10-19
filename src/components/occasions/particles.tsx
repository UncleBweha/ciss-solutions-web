import type { CSSProperties, ReactNode } from 'react'
import type { OccasionThemeKey } from '@/lib/occasions/themes'
import { KENYA_COLORS } from './kenya-flag'

/* ===========================================================================
   Ambient motion inside an occasion poster: confetti, snow, bubbles, leaves,
   hearts, embers, bats. Deterministic positions (no Math.random) so the
   server and browser render the same thing, and negative delays so the
   scene is already in motion when the page appears.
   ========================================================================= */

type Kind = 'confetti' | 'snow' | 'bubble' | 'leaf' | 'heart' | 'petal' | 'spark' | 'ember' | 'bat'

interface Layer {
  kind: Kind
  count: number
  colors: string[]
}

const LAYERS: Record<OccasionThemeKey, Layer[]> = {
  mazingira: [
    { kind: 'bubble', count: 9, colors: ['#ffffff'] },
    { kind: 'leaf', count: 8, colors: ['#7fd35a', '#3f9a3d', '#b8f08f', '#e0b04a'] },
  ],
  kenya: [{ kind: 'confetti', count: 26, colors: KENYA_COLORS }],
  christmas: [{ kind: 'snow', count: 28, colors: ['#ffffff'] }],
  'new-year': [
    { kind: 'confetti', count: 22, colors: ['#f6d77f', '#ff5c7a', '#5cc8ff', '#8affc1', '#ffffff'] },
    { kind: 'spark', count: 8, colors: ['#fff4c2'] },
  ],
  love: [{ kind: 'heart', count: 12, colors: ['#ffe0e8', '#ffffff', '#ffb3c6'] }],
  mothers: [{ kind: 'petal', count: 12, colors: ['#ff8fab', '#ffc2d1', '#ffffff'] }],
  womens: [{ kind: 'petal', count: 12, colors: ['#e0aaff', '#c77dff', '#ffffff'] }],
  fathers: [{ kind: 'spark', count: 10, colors: ['#ffb066', '#ffffff'] }],
  easter: [{ kind: 'petal', count: 10, colors: ['#f9a8d4', '#fde68a', '#c4b5fd', '#bae6fd'] }],
  eid: [{ kind: 'spark', count: 14, colors: ['#f2d27a', '#ffffff'] }],
  diwali: [{ kind: 'ember', count: 14, colors: ['#ffcf5c', '#ff9f1c', '#fff1b8'] }],
  halloween: [
    { kind: 'bat', count: 4, colors: ['#0d0716'] },
    { kind: 'spark', count: 8, colors: ['#ff8c1a'] },
  ],
  school: [
    { kind: 'confetti', count: 14, colors: ['#ffd23f', '#ffffff', '#ff8a3d', '#5cc8ff'] },
    { kind: 'spark', count: 8, colors: ['#ffd23f'] },
  ],
  service: [{ kind: 'confetti', count: 16, colors: ['#ffffff', '#ffd6b0', '#1a1a1a'] }],
  celebration: [{ kind: 'confetti', count: 18, colors: ['#ffffff', '#f6d77f', '#ff5c7a'] }],
}

const ANIMATION: Record<Kind, string> = {
  confetti: 'animate-poster-fall',
  snow: 'animate-poster-fall',
  leaf: 'animate-poster-leaf',
  petal: 'animate-poster-leaf',
  bubble: 'animate-poster-rise',
  heart: 'animate-poster-rise',
  ember: 'animate-poster-rise',
  spark: 'animate-art-twinkle',
  bat: 'animate-poster-fly',
}

/** A spread in [0, 1). Each salt uses its own stride, so position, size,
    speed and delay are not tied to each other (one shared stride lined the
    pieces up on a diagonal). */
function at(i: number, salt: number): number {
  const strides = [37, 61, 23, 79, 47, 89, 53, 71, 29, 97, 43, 67]
  const stride = strides[salt % strides.length]
  return ((i * stride + salt * 13) % 101) / 101
}

function shape(kind: Kind, size: number, color: string, i: number): ReactNode {
  switch (kind) {
    case 'confetti':
      return <span className="block rounded-[1px]" style={{ width: size * 0.55, height: size, background: color }} />
    case 'snow':
      return <span className="block rounded-full bg-white" style={{ width: size * 0.6, height: size * 0.6, opacity: 0.85, filter: 'blur(0.3px)' }} />
    case 'bubble':
      return (
        <span
          className="block rounded-full"
          style={{
            width: size * 3,
            height: size * 3,
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0 8%, rgba(255,255,255,0.08) 22%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.35) 100%)',
            boxShadow: 'inset 0 0 6px rgba(255,255,255,0.35)',
          }}
        />
      )
    case 'leaf':
      return (
        <svg width={size * 1.6} height={size * 1.6} viewBox="0 0 20 20" aria-hidden>
          <path d="M2 18C2 8 8 2 18 2C18 12 12 18 2 18Z" fill={color} />
          <path d="M2 18L14 6" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
        </svg>
      )
    case 'petal':
      return <span className="block" style={{ width: size, height: size * 0.7, background: color, borderRadius: '70% 0 70% 0', opacity: 0.9 }} />
    case 'heart':
      return (
        <svg width={size * 1.4} height={size * 1.4} viewBox="0 0 20 20" aria-hidden>
          <path d="M10 18C3 13 0 9 2 5C4 1 8 2 10 5C12 2 16 1 18 5C20 9 17 13 10 18Z" fill={color} />
        </svg>
      )
    case 'ember':
      return <span className="block rounded-full" style={{ width: size * 0.5, height: size * 0.5, background: color, boxShadow: `0 0 8px 2px ${color}` }} />
    case 'spark':
      return (
        <svg width={size * 1.4} height={size * 1.4} viewBox="0 0 20 20" aria-hidden>
          <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill={color} />
        </svg>
      )
    case 'bat':
      return (
        <svg
          width={size * 3.4}
          height={size * 1.8}
          viewBox="0 0 40 20"
          aria-hidden
          className={i % 2 ? 'animate-art-flap' : 'animate-art-flap [animation-delay:-0.2s]'}
        >
          <path
            d="M20 8C18 4 14 2 8 4C10 6 9 8 6 9C4 8 2 9 0 12C6 11 10 13 12 16C14 13 17 13 20 15C23 13 26 13 28 16C30 13 34 11 40 12C38 9 36 8 34 9C31 8 30 6 32 4C26 2 22 4 20 8Z"
            fill={color}
          />
        </svg>
      )
  }
}

export function PosterParticles({ theme, density = 1 }: { theme: OccasionThemeKey; density?: number }) {
  // Fewer pieces early in a build-up (Christmas on the 15th), all on the day.
  const layers = LAYERS[theme].map((layer) => ({ ...layer, count: Math.max(3, Math.round(layer.count * density)) }))
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.map((layer, l) =>
        Array.from({ length: layer.count }, (_, i) => {
          const x = at(i, l + 1)
          const size = 6 + Math.round(at(i, l + 7) * 8)
          const duration = 6 + at(i, l + 3) * 7
          const rising = layer.kind === 'bubble' || layer.kind === 'heart' || layer.kind === 'ember'
          const style = {
            left: `${(x * 100).toFixed(1)}%`,
            top:
              layer.kind === 'spark'
                ? `${(at(i, l + 5) * 90).toFixed(1)}%`
                : layer.kind === 'bat'
                  ? `${(10 + at(i, l + 5) * 45).toFixed(1)}%`
                  : rising
                    ? '100%'
                    : '-12%',
            '--travel': rising ? '-420px' : '460px',
            '--drift': `${Math.round((at(i, l + 9) - 0.5) * 80)}px`,
            '--spin': `${Math.round(180 + at(i, l + 2) * 540)}deg`,
            '--poster-duration': `${duration.toFixed(2)}s`,
            '--twinkle-delay': `${(-at(i, l + 4) * 3).toFixed(2)}s`,
            animationDelay: `${(-at(i, l + 4) * duration).toFixed(2)}s`,
          } as CSSProperties
          return (
            <span key={`${l}-${i}`} className={`absolute block ${ANIMATION[layer.kind]}`} style={style}>
              {shape(layer.kind, size, layer.colors[i % layer.colors.length], i)}
            </span>
          )
        }),
      )}
    </div>
  )
}
