import type { CSSProperties } from 'react'
import type { OccasionThemeKey } from '@/lib/occasions/themes'
import { WavingKenyaFlag } from './kenya-flag'

/* ===========================================================================
   Poster artwork, one illustration per occasion theme. Plain SVG (no image
   requests, sharp at any size) with motion done by the CSS utilities in
   globals.css ("OCCASION POSTERS"): transform and opacity only.

   Gradient ids are prefixed per piece; only one poster renders on a page.
   ========================================================================= */

const svgProps = { xmlns: 'http://www.w3.org/2000/svg', className: 'h-full w-full overflow-visible', 'aria-hidden': true } as const

function origin(x: number, y: number): CSSProperties {
  return { transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' } as CSSProperties
}

function delay(seconds: number): CSSProperties {
  return { animationDelay: `${seconds}s` }
}

/* ---- Mazingira: a young tree held in cupped hands ------------------------ */

/** Leaves for the crown, placed on a sunflower spiral inside an oval so the
    crown reads as foliage rather than a stack of circles. Lighter towards the
    top, where the light falls. */
function crownLeaves() {
  const leaves: { x: number; y: number; r: number; fill: string }[] = []
  const count = 120
  for (let i = 0; i < count; i++) {
    const t = Math.sqrt((i + 0.5) / count)
    const a = i * 2.39996
    const x = 160 + Math.cos(a) * t * 104
    const y = 96 + Math.sin(a) * t * 74
    const light = (170 - y) / 150 + (Math.cos(a * 3) + 1) * 0.06
    const fill = light > 0.62 ? '#9ee07a' : light > 0.46 ? '#6cc955' : light > 0.32 ? '#43a843' : '#2a7a2e'
    leaves.push({ x, y, r: (a * 57.3) % 180, fill })
  }
  return leaves
}

const CROWN = crownLeaves()

function Hand() {
  return (
    <g>
      <path d="M34 300C40 266 64 242 100 232L150 240C152 258 140 272 114 278C92 284 78 292 74 300Z" fill="url(#mz-skin)" />
      {[0, 1, 2, 3].map((k) => (
        <rect
          key={k}
          x="94"
          y={222 + k * 10}
          width={72 - k * 7}
          height="12.5"
          rx="6.25"
          fill="url(#mz-skin)"
          stroke="#9b6038"
          strokeOpacity="0.45"
          strokeWidth="0.9"
          transform={`rotate(${-5 + k * 7} 94 ${228 + k * 10})`}
        />
      ))}
      <rect
        x="92"
        y="224"
        width="40"
        height="14"
        rx="7"
        fill="url(#mz-skin)"
        stroke="#9b6038"
        strokeOpacity="0.45"
        strokeWidth="0.9"
        transform="rotate(-40 92 231)"
      />
      <path d="M56 288C66 272 80 262 98 258" stroke="#9b6038" strokeOpacity="0.35" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  )
}

function TreeInHands() {
  return (
    <svg {...svgProps} viewBox="0 0 320 300">
      <defs>
        <radialGradient id="mz-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#d9ffb8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#d9ffb8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mz-mass" cx="45%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3f9a3d" />
          <stop offset="100%" stopColor="#123f17" />
        </radialGradient>
        <linearGradient id="mz-trunk" x1="0" x2="1">
          <stop offset="0%" stopColor="#4a2a13" />
          <stop offset="45%" stopColor="#8a5a33" />
          <stop offset="100%" stopColor="#3e220f" />
        </linearGradient>
        <linearGradient id="mz-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e7b083" />
          <stop offset="100%" stopColor="#b0714a" />
        </linearGradient>
        <radialGradient id="mz-soil" cx="50%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#6e4729" />
          <stop offset="100%" stopColor="#2a180c" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="105" r="150" fill="url(#mz-glow)" />
      <g className="animate-art-sway" style={origin(160, 214)}>
        <path
          d="M150 216C153 196 154 180 152 160C146 150 136 142 124 136L128 129C140 135 149 142 155 149C156 137 157 124 159 112L166 113C165 126 164 139 164 151C171 141 182 133 195 127L198 134C186 141 174 151 168 162C167 182 168 200 172 216Z"
          fill="url(#mz-trunk)"
        />
        {[
          [106, 108, 46],
          [214, 104, 48],
          [160, 74, 58],
          [160, 126, 52],
          [124, 66, 40],
          [198, 62, 42],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="url(#mz-mass)" />
        ))}
        {CROWN.map((leaf, i) => (
          <ellipse
            key={i}
            cx={leaf.x.toFixed(1)}
            cy={leaf.y.toFixed(1)}
            rx="12"
            ry="6.5"
            fill={leaf.fill}
            transform={`rotate(${leaf.r.toFixed(0)} ${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)})`}
          />
        ))}
        {[
          [132, 70],
          [182, 60],
          [150, 112],
          [208, 112],
          [108, 120],
          [168, 40],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.6" fill="#f2ffe6" className="animate-art-twinkle" style={{ ...origin(x, y), ...delay(i * 0.4) }} />
        ))}
      </g>
      <path d="M96 222C110 198 210 198 224 222C210 234 110 234 96 222Z" fill="url(#mz-soil)" />
      {[
        [124, 214],
        [150, 208],
        [184, 212],
        [204, 218],
        [140, 222],
        [170, 220],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="#8a6440" opacity="0.85" />
      ))}
      <path d="M150 206C146 198 140 194 131 194" stroke="#62b04b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M131 194C128 198 132 202 137 199" fill="#62b04b" />
      <Hand />
      <g transform="translate(320 0) scale(-1 1)">
        <Hand />
      </g>
    </svg>
  )
}

/* ---- Kenyan national days: the flag, waving, with a soft spotlight -------- */

function KenyaArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.22),transparent_62%)]" />
      <div className="origin-center scale-[0.72] sm:scale-90 lg:scale-100">
        <WavingKenyaFlag width={270} slices={54} />
      </div>
    </div>
  )
}

/* ---- Christmas: a decorated tree with gifts ---------------------------- */

function ChristmasTree() {
  const baubles: [number, number, string][] = [
    [128, 100, '#f6d77f'],
    [172, 108, '#ffffff'],
    [112, 150, '#e0342a'],
    [150, 140, '#3fa7ff'],
    [190, 156, '#f6d77f'],
    [96, 200, '#ffffff'],
    [138, 192, '#f6d77f'],
    [178, 204, '#e0342a'],
    [212, 196, '#3fa7ff'],
  ]
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <linearGradient id="xm-tree" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f9a4c" />
          <stop offset="100%" stopColor="#0b4a22" />
        </linearGradient>
        <radialGradient id="xm-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6c8" />
          <stop offset="100%" stopColor="#f2b707" />
        </radialGradient>
        <radialGradient id="xm-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2b0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fff2b0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="38" r="40" fill="url(#xm-halo)" className="animate-art-pulse" style={origin(150, 38)} />
      <path d="M150 48L210 124Q150 136 90 124Z" fill="url(#xm-tree)" />
      <path d="M150 88L226 176Q150 190 74 176Z" fill="url(#xm-tree)" />
      <path d="M150 134L244 232Q150 248 56 232Z" fill="url(#xm-tree)" />
      <rect x="138" y="236" width="24" height="26" rx="3" fill="#6b3d1e" />
      <g fill="none" stroke="#f6d77f" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round">
        <path d="M100 118Q150 132 200 112" />
        <path d="M86 170Q150 188 214 164" />
        <path d="M70 226Q150 246 230 220" />
      </g>
      {baubles.map(([x, y, color], i) => (
        <g key={i} className="animate-art-twinkle" style={{ ...origin(x, y), ...delay((i % 5) * 0.35) }}>
          <circle cx={x} cy={y} r="8" fill={color} />
          <circle cx={x - 2.5} cy={y - 2.5} r="2.5" fill="#ffffff" opacity="0.75" />
        </g>
      ))}
      <path
        d="M150 18L156 33L172 33L159 43L164 58L150 49L136 58L141 43L128 33L144 33Z"
        fill="url(#xm-star)"
        className="animate-art-pulse"
        style={origin(150, 38)}
      />
      <g>
        <rect x="70" y="244" width="44" height="34" rx="4" fill="#e0342a" />
        <rect x="88" y="244" width="8" height="34" fill="#f6d77f" />
        <rect x="70" y="256" width="44" height="7" fill="#f6d77f" />
        <rect x="186" y="236" width="48" height="42" rx="4" fill="#3fa7ff" />
        <rect x="206" y="236" width="8" height="42" fill="#ffffff" />
        <rect x="186" y="252" width="48" height="7" fill="#ffffff" />
        <path d="M210 236C200 222 192 228 204 236ZM210 236C220 222 228 228 216 236Z" fill="#ffffff" />
      </g>
    </svg>
  )
}

/* ---- New Year: fireworks over the year ---------------------------------- */

function Fireworks({ year }: { year: number }) {
  const bursts: [number, number, number, string, number][] = [
    [80, 80, 46, '#f6d77f', 0],
    [224, 64, 40, '#ff5c7a', 0.8],
    [170, 140, 34, '#5cc8ff', 1.5],
    [60, 170, 28, '#8affc1', 2.1],
  ]
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <linearGradient id="ny-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff4c2" />
          <stop offset="55%" stopColor="#f6c344" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      {bursts.map(([cx, cy, r, color, d], i) => (
        <g key={i} className="animate-art-burst" style={{ ...origin(cx, cy), ...delay(d) }}>
          {Array.from({ length: 14 }, (_, k) => {
            const a = (k / 14) * Math.PI * 2
            return (
              <line
                key={k}
                x1={cx + Math.cos(a) * r * 0.25}
                y1={cy + Math.sin(a) * r * 0.25}
                x2={cx + Math.cos(a) * r}
                y2={cy + Math.sin(a) * r}
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
              />
            )
          })}
          <circle cx={cx} cy={cy} r={r * 0.12} fill="#ffffff" />
        </g>
      ))}
      <text
        x="150"
        y="250"
        textAnchor="middle"
        fontSize="86"
        fontWeight="800"
        letterSpacing="-3"
        fill="url(#ny-gold)"
        style={{ fontFamily: 'var(--font-sans)' }}
        className="animate-art-pulse"
      >
        {year}
      </text>
    </svg>
  )
}

/* ---- Love: a glossy heart --------------------------------------------- */

function BigHeart() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <linearGradient id="lv-heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9ab0" />
          <stop offset="55%" stopColor="#ef2d56" />
          <stop offset="100%" stopColor="#a50d33" />
        </linearGradient>
        <radialGradient id="lv-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd0dc" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffd0dc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="140" fill="url(#lv-glow)" />
      <g className="animate-art-pulse" style={origin(150, 160)}>
        <path d="M150 262C60 202 22 152 42 102C60 58 122 54 150 98C178 54 240 58 258 102C278 152 240 202 150 262Z" fill="url(#lv-heart)" />
        <path d="M78 104C88 82 112 76 128 88" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.55" />
      </g>
      {[
        [54, 54, 16],
        [250, 48, 12],
        [262, 214, 14],
        [36, 214, 10],
      ].map(([x, y, s], i) => (
        <path
          key={i}
          d={`M${x} ${y + s * 0.9}C${x - s} ${y + s * 0.3} ${x - s * 0.9} ${y - s * 0.5} ${x} ${y - s * 0.1}C${x + s * 0.9} ${y - s * 0.5} ${x + s} ${y + s * 0.3} ${x} ${y + s * 0.9}Z`}
          fill="#ffe0e8"
          className="animate-art-float"
          style={delay(i * 0.6)}
        />
      ))}
    </svg>
  )
}

/* ---- Mother's Day and Women's Day: a wrapped bouquet --------------------- */

function Bouquet({ petals, wrap }: { petals: string[]; wrap: string }) {
  const flowers: [number, number, number][] = [
    [150, 70, 30],
    [104, 96, 26],
    [196, 94, 26],
    [128, 136, 24],
    [176, 134, 24],
    [150, 108, 22],
  ]
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <g stroke="#3f8a3a" strokeWidth="4" strokeLinecap="round">
        {flowers.map(([x, y], i) => (
          <line key={i} x1={x} y1={y} x2={150} y2={250} />
        ))}
      </g>
      {[
        [90, 150, -35],
        [210, 150, 35],
        [120, 180, -20],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="22" ry="9" fill="#5cb84a" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <g className="animate-art-sway" style={origin(150, 250)}>
        {flowers.map(([x, y, r], i) => (
          <g key={i}>
            {Array.from({ length: 6 }, (_, k) => {
              const a = (k / 6) * Math.PI * 2
              return (
                <ellipse
                  key={k}
                  cx={x + Math.cos(a) * r * 0.55}
                  cy={y + Math.sin(a) * r * 0.55}
                  rx={r * 0.5}
                  ry={r * 0.36}
                  transform={`rotate(${(a * 180) / Math.PI} ${x + Math.cos(a) * r * 0.55} ${y + Math.sin(a) * r * 0.55})`}
                  fill={petals[i % petals.length]}
                />
              )
            })}
            <circle cx={x} cy={y} r={r * 0.28} fill="#ffd34d" />
          </g>
        ))}
      </g>
      <path d="M96 170L150 290L204 170Q150 190 96 170Z" fill={wrap} />
      <path d="M96 170L150 290L150 182Q120 182 96 170Z" fill="#000000" opacity="0.08" />
      <path d="M136 226C120 214 112 230 134 232M164 226C180 214 188 230 166 232" stroke="#ffffff" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="150" cy="229" r="6" fill="#ffffff" />
    </svg>
  )
}

/* ---- Father's Day: crossed hammer and spanner on a badge ------------------ */

function ToolsBadge() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <radialGradient id="fd-badge" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#3f72b8" />
          <stop offset="100%" stopColor="#10284b" />
        </radialGradient>
        <linearGradient id="fd-steel" x1="0" x2="1">
          <stop offset="0%" stopColor="#9aa3ad" />
          <stop offset="50%" stopColor="#f1f4f7" />
          <stop offset="100%" stopColor="#8a939d" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="150" r="118" fill="url(#fd-badge)" stroke="#ffb066" strokeWidth="6" />
      <circle
        cx="150"
        cy="150"
        r="102"
        fill="none"
        stroke="#ffb066"
        strokeWidth="1.5"
        strokeDasharray="3 6"
        className="animate-art-spin-slow"
        style={origin(150, 150)}
      />
      <g transform="rotate(-45 150 150)">
        <rect x="142" y="92" width="16" height="140" rx="6" fill="#c2702e" />
        <rect x="112" y="70" width="76" height="30" rx="5" fill="url(#fd-steel)" />
        <rect x="182" y="76" width="18" height="18" rx="3" fill="url(#fd-steel)" />
      </g>
      <g transform="rotate(45 150 150)">
        <rect x="143" y="96" width="14" height="128" rx="6" fill="url(#fd-steel)" />
        <path d="M134 70a22 22 0 1 0 32 0l-6 18h-20z" fill="url(#fd-steel)" />
        <circle cx="150" cy="232" r="11" fill="none" stroke="url(#fd-steel)" strokeWidth="7" />
      </g>
      {[
        [64, 70],
        [236, 76],
        [242, 226],
        [58, 222],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 7}L${x + 2} ${y - 2}L${x + 7} ${y}L${x + 2} ${y + 2}L${x} ${y + 7}L${x - 2} ${y + 2}L${x - 7} ${y}L${x - 2} ${y - 2}Z`}
          fill="#ffb066"
          className="animate-art-twinkle"
          style={{ ...origin(x, y), ...delay(i * 0.5) }}
        />
      ))}
    </svg>
  )
}

/* ---- Easter: decorated eggs in a nest ----------------------------------- */

function EasterEggs() {
  const eggs: [number, number, number, string, string][] = [
    [112, 176, -12, '#c4b5fd', '#7c3aed'],
    [150, 160, 0, '#fde68a', '#f59e0b'],
    [190, 178, 12, '#bae6fd', '#0284c7'],
  ]
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        {eggs.map(([, , , ,], i) => (
          <clipPath key={i} id={`ea-clip-${i}`}>
            <ellipse cx={eggs[i][0]} cy={eggs[i][1]} rx="30" ry="40" transform={`rotate(${eggs[i][2]} ${eggs[i][0]} ${eggs[i][1]})`} />
          </clipPath>
        ))}
      </defs>
      {eggs.map(([x, y, r, base, stripe], i) => (
        <g key={i} className="animate-art-float" style={delay(i * 0.5)}>
          <ellipse cx={x} cy={y} rx="30" ry="40" transform={`rotate(${r} ${x} ${y})`} fill={base} />
          <g clipPath={`url(#ea-clip-${i})`}>
            <path d={`M${x - 40} ${y - 6}l10 -10l10 10l10 -10l10 10l10 -10l10 10l10 -10l10 10`} stroke={stripe} strokeWidth="5" fill="none" />
            <rect x={x - 40} y={y + 10} width="80" height="6" fill={stripe} opacity="0.7" />
            {[-14, 0, 14].map((dx) => (
              <circle key={dx} cx={x + dx} cy={y - 22} r="3" fill="#ffffff" />
            ))}
          </g>
          <ellipse cx={x - 10} cy={y - 16} rx="6" ry="10" fill="#ffffff" opacity="0.4" transform={`rotate(${r} ${x} ${y})`} />
        </g>
      ))}
      <path d="M60 200Q150 268 240 200Q236 238 150 250Q64 238 60 200Z" fill="#a0702f" />
      <g stroke="#7a5320" strokeWidth="2.5" fill="none" opacity="0.8">
        <path d="M70 212Q150 254 230 212" />
        <path d="M76 226Q150 260 224 226" />
        <path d="M64 204Q120 236 180 230" />
      </g>
      {[
        [52, 250, '#f9a8d4'],
        [248, 252, '#fde68a'],
        [40, 214, '#c4b5fd'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          {Array.from({ length: 5 }, (_, k) => {
            const a = (k / 5) * Math.PI * 2
            return <circle key={k} cx={(x as number) + Math.cos(a) * 7} cy={(y as number) + Math.sin(a) * 7} r="5.5" fill={c as string} />
          })}
          <circle cx={x as number} cy={y as number} r="4" fill="#facc15" />
        </g>
      ))}
    </svg>
  )
}

/* ---- Eid and Ramadan: crescent moon and swinging lanterns ------------------ */

function Lantern({ x, length, hue, d }: { x: number; length: number; hue: string; d: number }) {
  const y = length
  return (
    <g className="animate-art-swing" style={{ ...origin(x, 0), ...delay(d) }}>
      <line x1={x} y1="0" x2={x} y2={y} stroke="#f2d27a" strokeWidth="1.5" />
      <path d={`M${x - 12} ${y + 12}L${x} ${y}L${x + 12} ${y + 12}Z`} fill="#c99a2e" />
      <rect x={x - 16} y={y + 12} width="32" height="44" rx="8" fill={hue} stroke="#c99a2e" strokeWidth="3" />
      <rect x={x - 8} y={y + 20} width="16" height="28" rx="6" fill="#fff3b0" className="animate-art-flicker" style={origin(x, y + 34)} />
      <path d={`M${x - 12} ${y + 56}L${x + 12} ${y + 56}L${x} ${y + 66}Z`} fill="#c99a2e" />
    </g>
  )
}

function CrescentLanterns() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <radialGradient id="eid-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff1b8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff1b8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="eid-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4c2" />
          <stop offset="100%" stopColor="#e2b23c" />
        </linearGradient>
        <mask id="eid-crescent">
          <rect width="300" height="300" fill="#fff" />
          <circle cx="200" cy="128" r="70" fill="#000" />
        </mask>
      </defs>
      <circle cx="170" cy="150" r="130" fill="url(#eid-glow)" className="animate-art-pulse" style={origin(170, 150)} />
      <circle cx="170" cy="150" r="84" fill="url(#eid-moon)" mask="url(#eid-crescent)" />
      <path
        d="M232 92L237 106L252 106L240 115L245 130L232 121L219 130L224 115L212 106L227 106Z"
        fill="#fff4c2"
        className="animate-art-twinkle"
        style={origin(232, 111)}
      />
      <Lantern x={66} length={70} hue="#0f6b3f" d={0} />
      <Lantern x={112} length={36} hue="#7a1c3a" d={0.6} />
      <Lantern x={262} length={160} hue="#14507a" d={1.1} />
      {[
        [40, 230],
        [140, 262],
        [210, 250],
        [280, 40],
        [24, 120],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#fff4c2" className="animate-art-twinkle" style={{ ...origin(x, y), ...delay(i * 0.3) }} />
      ))}
    </svg>
  )
}

/* ---- Diwali: glowing diyas on a turning rangoli -------------------------- */

function Diya({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y - 10} rx="22" ry="22" fill="#ffcf5c" opacity="0.25" className="animate-art-pulse" style={{ ...origin(x, y - 10), ...delay(d) }} />
      <path
        d={`M${x} ${y - 30}C${x - 9} ${y - 18} ${x - 7} ${y - 6} ${x} ${y - 4}C${x + 7} ${y - 6} ${x + 9} ${y - 18} ${x} ${y - 30}Z`}
        fill="url(#dw-flame)"
        className="animate-art-flicker"
        style={{ ...origin(x, y - 4), ...delay(d) }}
      />
      <path
        d={`M${x - 34} ${y - 4}Q${x} ${y + 30} ${x + 34} ${y - 4}Q${x + 20} ${y + 2} ${x} ${y + 2}Q${x - 20} ${y + 2} ${x - 34} ${y - 4}Z`}
        fill="#b5532a"
      />
      <path d={`M${x - 26} ${y + 4}Q${x} ${y + 18} ${x + 26} ${y + 4}`} stroke="#ffcf5c" strokeWidth="2" fill="none" />
    </g>
  )
}

function DiwaliLamps() {
  const petals = ['#ff9f1c', '#ff4d6d', '#ffcf5c', '#c77dff']
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <linearGradient id="dw-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff7b00" />
          <stop offset="60%" stopColor="#ffcf5c" />
          <stop offset="100%" stopColor="#fffbe6" />
        </linearGradient>
      </defs>
      <g className="animate-art-spin-slow" style={origin(150, 140)} opacity="0.85">
        {[90, 64, 38].map((ring, r) =>
          Array.from({ length: 12 }, (_, k) => {
            const a = (k / 12) * 360 + r * 15
            return (
              <ellipse
                key={`${r}-${k}`}
                cx="150"
                cy={140 - ring}
                rx="9"
                ry="20"
                fill={petals[(k + r) % petals.length]}
                transform={`rotate(${a} 150 140)`}
                opacity="0.8"
              />
            )
          }),
        )}
        <circle cx="150" cy="140" r="16" fill="#ffcf5c" />
      </g>
      <Diya x={80} y={258} d={0} />
      <Diya x={150} y={266} d={0.3} />
      <Diya x={220} y={258} d={0.6} />
    </svg>
  )
}

/* ---- Halloween: a glowing jack-o'-lantern under the moon ------------------ */

function Pumpkin() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <radialGradient id="hw-moon" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="100%" stopColor="#e8d9a8" />
        </radialGradient>
        <radialGradient id="hw-pumpkin" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
      </defs>
      <circle cx="220" cy="80" r="52" fill="url(#hw-moon)" opacity="0.9" />
      <rect x="143" y="96" width="14" height="28" rx="5" fill="#3f6b2a" transform="rotate(10 150 110)" />
      {[
        [96, 196, 54],
        [204, 196, 54],
        [128, 192, 60],
        [172, 192, 60],
        [150, 190, 62],
      ].map(([cx, cy, r], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={r} ry="76" fill="url(#hw-pumpkin)" stroke="#a63a0a" strokeWidth="2" />
      ))}
      <g fill="#ffe066" className="animate-art-flicker" style={origin(150, 200)}>
        <path d="M108 168L132 168L120 148Z" />
        <path d="M168 168L192 168L180 148Z" />
        <path d="M142 184L158 184L150 200Z" />
        <path d="M100 214L120 226L134 214L150 228L166 214L180 226L200 214Q190 250 150 252Q110 250 100 214Z" />
      </g>
    </svg>
  )
}

/* ---- Customer Service Week: headset and happy-customer bubbles ---------- */

function ServiceArt() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <path d="M86 160V140a64 64 0 0 1 128 0v20" stroke="#ffffff" strokeWidth="14" fill="none" strokeLinecap="round" />
      <rect x="66" y="146" width="40" height="64" rx="16" fill="#ffffff" />
      <rect x="194" y="146" width="40" height="64" rx="16" fill="#ffffff" />
      <path d="M214 206Q214 246 166 248" stroke="#ffffff" strokeWidth="8" fill="none" strokeLinecap="round" />
      <rect x="146" y="238" width="26" height="18" rx="9" fill="#ffffff" />
      <g className="animate-art-float">
        <rect x="18" y="40" width="116" height="52" rx="16" fill="#ffffff" />
        <path d="M44 92L40 108L60 92Z" fill="#ffffff" />
        <text x="76" y="74" textAnchor="middle" fontSize="22" fill="#f2b707" style={{ fontFamily: 'var(--font-sans)' }}>
          ★★★★★
        </text>
      </g>
      <g className="animate-art-float" style={delay(0.8)}>
        <rect x="190" y="30" width="92" height="56" rx="16" fill="#fff1e0" />
        <path d="M250 86L262 102L264 86Z" fill="#fff1e0" />
        <path
          d="M236 70C224 62 222 50 230 46C236 43 240 48 236 52C232 48 236 43 242 46C250 50 248 62 236 70Z"
          fill="#ef2d56"
          transform="translate(-8 -6) scale(1.1)"
        />
      </g>
    </svg>
  )
}

/* ---- Back to School: a packed school bag ------------------------------ */

function SchoolBag() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <defs>
        <linearGradient id="sc-bag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#d24f00" />
        </linearGradient>
        <linearGradient id="sc-pocket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e85a00" />
          <stop offset="100%" stopColor="#a63d00" />
        </linearGradient>
        <linearGradient id="sc-pencil" x1="0" x2="1">
          <stop offset="0%" stopColor="#ffc400" />
          <stop offset="50%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#f0a800" />
        </linearGradient>
      </defs>

      {/* Chalk sums drifting behind the bag */}
      {[
        { x: 40, y: 70, t: 'A+', s: 30 },
        { x: 252, y: 64, t: '123', s: 22 },
        { x: 34, y: 214, t: 'abc', s: 22 },
        { x: 262, y: 170, t: 'π', s: 30 },
      ].map(({ x, y, t, s }, i) => (
        <text
          key={t}
          x={x}
          y={y}
          textAnchor="middle"
          fontSize={s}
          fontWeight="800"
          fill="#ffffff"
          opacity="0.85"
          className="animate-art-float"
          style={{ ...delay(i * 0.7), fontFamily: 'var(--font-sans)' }}
        >
          {t}
        </text>
      ))}

      <g className="animate-art-float">
        {/* Ruler and pencil sticking out of the top */}
        <g transform="rotate(14 190 90)">
          <rect x="176" y="34" width="26" height="110" rx="3" fill="#ffd23f" stroke="#c99a00" strokeWidth="1.5" />
          {Array.from({ length: 10 }, (_, k) => (
            <line key={k} x1="176" x2={k % 2 ? 184 : 190} y1={42 + k * 10} y2={42 + k * 10} stroke="#7a5a00" strokeWidth="1.4" />
          ))}
        </g>
        <g transform="rotate(-18 112 92)">
          <rect x="102" y="40" width="20" height="96" fill="url(#sc-pencil)" />
          <rect x="102" y="40" width="20" height="10" rx="2" fill="#ff7aa2" />
          <rect x="102" y="50" width="20" height="7" fill="#c0c6cc" />
        </g>

        {/* Handle, body, front pocket */}
        <path d="M128 98V82a22 22 0 0 1 44 0v16" stroke="#8a3300" strokeWidth="9" fill="none" strokeLinecap="round" />
        <rect x="80" y="94" width="140" height="168" rx="38" fill="url(#sc-bag)" />
        <path d="M92 132Q150 112 208 132" stroke="#ffb27a" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
        <rect x="102" y="176" width="96" height="70" rx="18" fill="url(#sc-pocket)" />
        <line x1="112" y1="194" x2="188" y2="194" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 6" />
        <rect x="174" y="188" width="10" height="16" rx="3" fill="#ffd23f" className="animate-art-swing" style={origin(179, 190)} />
        <path d="M92 150Q86 200 96 246M208 150Q214 200 204 246" stroke="#a63d00" strokeWidth="4" fill="none" opacity="0.5" />

        {/* A badge on the pocket */}
        <circle cx="132" cy="222" r="13" fill="#173a7a" stroke="#ffd23f" strokeWidth="2.5" />
        <path d="M132 213l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6z" fill="#ffd23f" />
      </g>

      {/* Books stacked beside it */}
      <g className="animate-art-float" style={delay(1.1)}>
        <rect x="206" y="236" width="74" height="14" rx="3" fill="#1f9d55" />
        <rect x="212" y="222" width="64" height="14" rx="3" fill="#e0234e" />
        <rect x="204" y="208" width="70" height="14" rx="3" fill="#ffffff" />
        <line x1="210" y1="215" x2="268" y2="215" stroke="#173a7a" strokeWidth="2" />
      </g>

      {[
        [70, 120],
        [236, 120],
        [60, 260],
        [150, 26],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y - 7}L${x + 2} ${y - 2}L${x + 7} ${y}L${x + 2} ${y + 2}L${x} ${y + 7}L${x - 2} ${y + 2}L${x - 7} ${y}L${x - 2} ${y - 2}Z`}
          fill="#ffd23f"
          className="animate-art-twinkle"
          style={{ ...origin(x, y), ...delay(i * 0.45) }}
        />
      ))}
    </svg>
  )
}

/* ---- Anything else: a gift ---------------------------------------------- */

function GiftArt() {
  return (
    <svg {...svgProps} viewBox="0 0 300 300">
      <g className="animate-art-float">
        <rect x="80" y="130" width="140" height="120" rx="10" fill="#ffffff" opacity="0.95" />
        <rect x="70" y="106" width="160" height="34" rx="8" fill="#ffffff" />
        <rect x="140" y="106" width="20" height="144" fill="#1d6fd8" />
        <path d="M150 106C120 70 92 92 120 106ZM150 106C180 70 208 92 180 106Z" fill="#1d6fd8" />
      </g>
    </svg>
  )
}

export function OccasionArt({ theme, year }: { theme: OccasionThemeKey; year: number }) {
  switch (theme) {
    case 'mazingira':
      return <TreeInHands />
    case 'kenya':
      return <KenyaArt />
    case 'christmas':
      return <ChristmasTree />
    case 'new-year':
      return <Fireworks year={year} />
    case 'love':
      return <BigHeart />
    case 'mothers':
      return <Bouquet petals={['#ff8fab', '#ffffff', '#f06292', '#ffc2d1']} wrap="#f7e3c6" />
    case 'womens':
      return <Bouquet petals={['#c77dff', '#e0aaff', '#ffffff', '#9d4edd']} wrap="#f3e8ff" />
    case 'fathers':
      return <ToolsBadge />
    case 'easter':
      return <EasterEggs />
    case 'eid':
      return <CrescentLanterns />
    case 'diwali':
      return <DiwaliLamps />
    case 'halloween':
      return <Pumpkin />
    case 'service':
      return <ServiceArt />
    case 'school':
      return <SchoolBag />
    default:
      return <GiftArt />
  }
}
