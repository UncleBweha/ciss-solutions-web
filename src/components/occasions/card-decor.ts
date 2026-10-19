import type { CSSProperties } from 'react'
import type { OccasionThemeKey } from '@/lib/occasions/themes'

/* ===========================================================================
   What every product photo wears during an occasion: a ribbon across its
   top-right corner and an ornament on it (a bow at Christmas, a gold star at
   New Year, a heart for Valentine's...).

   Drawn by CSS (.occasion-media::before/::after in globals.css) from the
   custom properties returned here, set once on the site layout. So product
   cards need no props, no client code, and every grid on the site picks it
   up, including cached pages.
   ========================================================================= */

function svg(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${markup}</svg>`)}")`
}

function bow(light: string, dark: string, knot: string, edge: string): string {
  return svg(
    `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>` +
      `<path d="M21 25L13 44L18 40L20 46L25 27Z" fill="${dark}"/><path d="M27 25L35 44L30 40L28 46L23 27Z" fill="${dark}"/>` +
      `<path d="M24 23C14 7 3 11 7 20C10 27 18 26 24 23Z" fill="url(#b)"/><path d="M24 23C34 7 45 11 41 20C38 27 30 26 24 23Z" fill="url(#b)"/>` +
      `<path d="M11 15C14 12 18 14 20 18M37 15C34 12 30 14 28 18" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<circle cx="24" cy="23" r="4.6" fill="${knot}" stroke="${edge}" stroke-width="1.2"/>`,
  )
}

const STAR = svg(
  `<defs><radialGradient id="g"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#e2a922"/></radialGradient></defs>` +
    `<path d="M24 6L28.5 18.5L42 19L31.5 27L35.5 40L24 32.5L12.5 40L16.5 27L6 19L19.5 18.5Z" fill="url(#g)" stroke="#b8860b" stroke-width="1"/>` +
    `<path d="M40 6l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM8 32l.8 2.2 2.2.8-2.2.8L8 38l-.8-2.2L5 35l2.2-.8z" fill="#fff4c2"/>`,
)

const HEART = svg(
  `<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ab0"/><stop offset="1" stop-color="#c2163f"/></linearGradient></defs>` +
    `<path d="M24 41C10 32 5 24 8 17C11 10 20 10 24 17C28 10 37 10 40 17C43 24 38 32 24 41Z" fill="url(#h)"/>` +
    `<path d="M13 17C15 14 18 13 20 15" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
)

const SHIELD = svg(
  `<g stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="14" y1="42" x2="34" y2="6"/><line x1="34" y1="42" x2="14" y2="6"/></g>` +
    `<path d="M24 5C33 13 33 35 24 43C15 35 15 13 24 5Z" fill="#000"/><path d="M24 9C29 16 29 32 24 39C19 32 19 16 24 9Z" fill="#bb0000"/>` +
    `<ellipse cx="24" cy="24" rx="1.6" ry="4" fill="#fff"/>`,
)

const LEAVES = svg(
  `<path d="M24 44C25 32 27 22 34 12" stroke="#5b3a1e" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M33 13C33 5 41 3 46 4C45 11 40 16 33 13Z" fill="#5cb84a"/><path d="M29 22C22 18 18 10 20 5C27 7 31 14 29 22Z" fill="#3f9a3d"/>` +
    `<path d="M27 30C35 28 41 31 44 36C37 39 30 37 27 30Z" fill="#7fd35a"/>`,
)

const CRESCENT = svg(
  `<line x1="24" y1="0" x2="24" y2="12" stroke="#c99a2e" stroke-width="1.4"/>` +
    `<defs><mask id="m"><rect width="48" height="48" fill="#fff"/><circle cx="31" cy="24" r="12" fill="#000"/></mask></defs>` +
    `<circle cx="24" cy="27" r="14" fill="#f2c94c" mask="url(#m)"/><path d="M36 20l1.6 3.6 3.9.3-3 2.5.9 3.8-3.4-2-3.4 2 .9-3.8-3-2.5 3.9-.3z" fill="#fff4c2"/>`,
)

const DIYA = svg(
  `<defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7b00"/><stop offset=".6" stop-color="#ffcf5c"/><stop offset="1" stop-color="#fffbe6"/></linearGradient></defs>` +
    `<circle cx="24" cy="20" r="11" fill="#ffcf5c" opacity=".35"/><path d="M24 8C19 15 20 22 24 24C28 22 29 15 24 8Z" fill="url(#f)"/>` +
    `<path d="M6 27Q24 50 42 27Q33 31 24 31Q15 31 6 27Z" fill="#b5532a"/><path d="M11 33Q24 42 37 33" stroke="#ffcf5c" stroke-width="1.6" fill="none"/>`,
)

const SPIDER = svg(
  `<line x1="24" y1="0" x2="24" y2="20" stroke="#cfcfcf" stroke-width="1"/>` +
    `<g stroke="#1a1a1a" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M20 26L11 20M20 29L9 29M20 32L11 38M28 26L37 20M28 29L39 29M28 32L37 38"/></g>` +
    `<ellipse cx="24" cy="29" rx="6" ry="7" fill="#1a1a1a"/><circle cx="24" cy="21.5" r="3.6" fill="#1a1a1a"/>` +
    `<circle cx="22.6" cy="21" r=".9" fill="#ff8c1a"/><circle cx="25.4" cy="21" r=".9" fill="#ff8c1a"/>`,
)

const EGG = svg(
  `<defs><clipPath id="c"><ellipse cx="24" cy="26" rx="13" ry="17"/></clipPath></defs>` +
    `<ellipse cx="24" cy="26" rx="13" ry="17" fill="#c4b5fd"/>` +
    `<g clip-path="url(#c)"><path d="M8 24l4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4" stroke="#7c3aed" stroke-width="2.4" fill="none"/><rect x="8" y="31" width="32" height="3" fill="#f59e0b"/></g>` +
    `<ellipse cx="19" cy="18" rx="3" ry="5" fill="#fff" opacity=".45"/>`,
)

function flower(petal: string): string {
  const petals = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * 360
    return `<ellipse cx="24" cy="13" rx="6" ry="9" fill="${petal}" transform="rotate(${a} 24 24)"/>`
  }).join('')
  return svg(`${petals}<circle cx="24" cy="24" r="5.5" fill="#ffd34d"/>`)
}

const PENCIL = svg(
  `<g transform="rotate(-40 24 24)"><rect x="19" y="4" width="10" height="30" fill="#ffd23f" stroke="#c99a00" stroke-width="1"/>` +
    `<rect x="19" y="4" width="10" height="5" rx="1.5" fill="#ff7aa2"/><rect x="19" y="9" width="10" height="3" fill="#c0c6cc"/>` +
    `<path d="M19 34L24 44L29 34Z" fill="#f2d2a0"/><path d="M22.4 40.8L24 44L25.6 40.8Z" fill="#333"/>` +
    `<line x1="24" y1="12" x2="24" y2="34" stroke="#f0a800" stroke-width="1"/></g>`,
)

const SPANNER = svg(
  `<defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#9aa3ad"/><stop offset=".5" stop-color="#f1f4f7"/><stop offset="1" stop-color="#8a939d"/></linearGradient></defs>` +
    `<g transform="rotate(45 24 24)"><rect x="21" y="14" width="6" height="30" rx="3" fill="url(#s)"/><path d="M16 4a9 9 0 1 0 16 0l-3 6h-10z" fill="url(#s)"/></g>`,
)

type Decor = { band: string | null; ornament: string; hang?: boolean }

const DECOR: Record<OccasionThemeKey, Decor> = {
  christmas: {
    band: 'linear-gradient(#f6d77f 0 2px, #c3182f 2px 12px, #f6d77f 12px 14px)',
    ornament: bow('#ff5c6c', '#a50d1f', '#d4192e', '#f6d77f'),
  },
  'new-year': {
    band: 'linear-gradient(#fff3b0 0 2px, #e2b23c 2px 12px, #b8860b 12px 14px)',
    ornament: STAR,
  },
  love: {
    band: 'linear-gradient(#ffd1dc 0 2px, #e0234e 2px 12px, #ffd1dc 12px 14px)',
    ornament: HEART,
  },
  kenya: {
    band: 'linear-gradient(#000 0 3px, #fff 3px 4px, #bb0000 4px 10px, #fff 10px 11px, #006600 11px 14px)',
    ornament: SHIELD,
  },
  mazingira: { band: null, ornament: LEAVES },
  eid: { band: null, ornament: CRESCENT, hang: true },
  diwali: { band: null, ornament: DIYA },
  halloween: { band: null, ornament: SPIDER, hang: true },
  easter: {
    band: 'linear-gradient(#fde68a 0 2px, #a78bfa 2px 12px, #fde68a 12px 14px)',
    ornament: EGG,
  },
  mothers: {
    band: 'linear-gradient(#ffffff 0 2px, #f06292 2px 12px, #ffffff 12px 14px)',
    ornament: flower('#ff8fab'),
  },
  womens: {
    band: 'linear-gradient(#ffffff 0 2px, #9d4edd 2px 12px, #ffffff 12px 14px)',
    ornament: flower('#c77dff'),
  },
  fathers: {
    band: 'linear-gradient(#ffb066 0 2px, #173562 2px 12px, #ffb066 12px 14px)',
    ornament: SPANNER,
  },
  service: {
    band: 'linear-gradient(#ffffff 0 2px, #1d6fd8 2px 12px, #ffffff 12px 14px)',
    ornament: STAR,
  },
  school: {
    band: 'linear-gradient(#ffd23f 0 2px, #173a7a 2px 12px, #ffd23f 12px 14px)',
    ornament: PENCIL,
  },
  celebration: {
    band: 'linear-gradient(#ffffff 0 2px, #1d6fd8 2px 12px, #ffffff 12px 14px)',
    ornament: bow('#ffffff', '#e6e6e6', '#1d6fd8', '#ffffff'),
  },
}

/** CSS custom properties for the site layout's wrapper. */
export function occasionCardVars(theme: OccasionThemeKey): CSSProperties {
  const decor = DECOR[theme]
  return {
    '--oc-band': decor.band ?? 'none',
    '--oc-band-display': decor.band ? 'block' : 'none',
    '--oc-ornament': decor.ornament,
    '--oc-ornament-animation': decor.hang ? 'oc-ornament-swing' : 'oc-ornament-bob',
    '--oc-ornament-origin': decor.hang ? '50% 0%' : '50% 60%',
    '--oc-ornament-top': decor.hang ? '0px' : '2px',
  } as CSSProperties
}
