import type { Occasion } from './types'

export { nairobiToday } from './dates'

/* ===========================================================================
   How each occasion looks: the poster on the home page and the decorations
   around the site. An occasion is matched to a theme by what it is (its slug
   and name first, then its kind and decoration), so an occasion an admin
   adds later still gets a fitting look.
   ========================================================================= */

export type OccasionThemeKey =
  | 'mazingira'
  | 'kenya'
  | 'christmas'
  | 'new-year'
  | 'love'
  | 'mothers'
  | 'fathers'
  | 'womens'
  | 'easter'
  | 'eid'
  | 'diwali'
  | 'halloween'
  | 'service'
  | 'school'
  | 'celebration'

export interface OccasionTheme {
  key: OccasionThemeKey
  /** CSS background of the poster. */
  background: string
  text: string
  /** The script word ("Happy", "Merry"). */
  script: string
  pill: { background: string; text: string }
  /** Small stars and rules. */
  ornament: string
  /** The poster's message when the admin has not written their own. */
  message: string
  /** Light rays turning behind the art. */
  rays: boolean
}

type ThemeMatch = Pick<Occasion, 'slug' | 'name' | 'kind' | 'decoration'>

export function themeKeyFor(occasion: ThemeMatch): OccasionThemeKey {
  const id = `${occasion.slug} ${occasion.name}`.toLowerCase()
  if (/mazingira|utamaduni|environment|tree/.test(id)) return 'mazingira'
  if (/christmas/.test(id)) return 'christmas'
  if (/new-year|new year/.test(id)) return 'new-year'
  if (/valentine|girlfriend|boyfriend|love/.test(id)) return 'love'
  if (/mother/.test(id)) return 'mothers'
  if (/father/.test(id)) return 'fathers'
  if (/women/.test(id)) return 'womens'
  if (/easter/.test(id)) return 'easter'
  if (/eid|ramadan|idd/.test(id)) return 'eid'
  if (/diwali|deepavali/.test(id)) return 'diwali'
  if (/halloween/.test(id)) return 'halloween'
  if (/customer-service|customer service/.test(id)) return 'service'
  if (/school/.test(id)) return 'school'
  if (occasion.kind === 'kenyan_national' || occasion.decoration === 'flag_bunting') return 'kenya'
  switch (occasion.decoration) {
    case 'snow_lights_tree':
      return 'christmas'
    case 'fireworks_confetti':
      return 'new-year'
    case 'hearts':
      return 'love'
    case 'flowers_hearts':
      return 'mothers'
    case 'crescent_lanterns':
      return 'eid'
    case 'diwali_lights':
      return 'diwali'
    default:
      return 'celebration'
  }
}

const THEMES: Record<Exclude<OccasionThemeKey, 'celebration'>, Omit<OccasionTheme, 'key'>> = {
  mazingira: {
    background: 'radial-gradient(120% 90% at 78% 30%, #4f9a3c 0%, #1f5a24 38%, #0d2a12 72%, #071a0b 100%)',
    text: '#ffffff',
    script: '#a6e07d',
    pill: { background: '#d62828', text: '#ffffff' },
    ornament: '#ffffff',
    message: "Let's come together to honour and safeguard the environment that sustains us all.",
    rays: false,
  },
  kenya: {
    background: 'radial-gradient(110% 120% at 70% 20%, #3a3a3a 0%, #1b1b1b 45%, #0b0b0b 100%)',
    text: '#ffffff',
    script: '#f2f2f2',
    pill: { background: '#bb0000', text: '#ffffff' },
    ornament: '#ffffff',
    message: 'Proudly Kenyan. Celebrating the people and the spirit that build this nation.',
    rays: true,
  },
  christmas: {
    background: 'radial-gradient(120% 100% at 75% 25%, #c3182f 0%, #8a0d1d 45%, #4d0610 100%)',
    text: '#ffffff',
    script: '#f6d77f',
    pill: { background: '#f6d77f', text: '#4d0610' },
    ornament: '#f6d77f',
    message: 'Wishing you joy, peace and a printer that never runs out of ink this festive season.',
    rays: true,
  },
  'new-year': {
    background: 'radial-gradient(120% 110% at 70% 20%, #2a3a8f 0%, #141c4f 45%, #070b24 100%)',
    text: '#ffffff',
    script: '#f6d77f',
    pill: { background: '#f6d77f', text: '#141c4f' },
    ornament: '#f6d77f',
    message: "Here's to a fresh start: a new year of sharp prints, smooth running printers and getting things done.",
    rays: false,
  },
  love: {
    background: 'radial-gradient(120% 110% at 72% 28%, #ff5c7a 0%, #d61f4b 42%, #7d0b2a 100%)',
    text: '#ffffff',
    script: '#ffe0e8',
    pill: { background: '#ffffff', text: '#c2163f' },
    ornament: '#ffe0e8',
    message: 'Print the moments that matter: photos, cards and keepsakes for the one you love.',
    rays: false,
  },
  mothers: {
    background: 'radial-gradient(120% 110% at 75% 25%, #fff1f4 0%, #fbd3dd 50%, #f4a9bd 100%)',
    text: '#4a1424',
    script: '#c2185b',
    pill: { background: '#c2185b', text: '#ffffff' },
    ornament: '#c2185b',
    message: 'For the one who holds it all together. Thank you, Mum.',
    rays: false,
  },
  fathers: {
    background: 'radial-gradient(120% 110% at 75% 25%, #2d5a96 0%, #173562 48%, #0b1c37 100%)',
    text: '#ffffff',
    script: '#ffb066',
    pill: { background: '#c24e00', text: '#ffffff' },
    ornament: '#ffb066',
    message: 'For the dad who keeps the home office running. Thank you, Dad.',
    rays: true,
  },
  womens: {
    background: 'radial-gradient(120% 110% at 75% 25%, #9b4dd6 0%, #5f1f94 48%, #300b52 100%)',
    text: '#ffffff',
    script: '#f0c8ff',
    pill: { background: '#f0c8ff', text: '#3b0a57' },
    ornament: '#f0c8ff',
    message: 'Celebrating the women who build, lead and inspire.',
    rays: false,
  },
  easter: {
    background: 'radial-gradient(120% 110% at 75% 25%, #fffbea 0%, #f3e8ff 50%, #d9ecff 100%)',
    text: '#3b1d5a',
    script: '#7c3aed',
    pill: { background: '#7c3aed', text: '#ffffff' },
    ornament: '#7c3aed',
    message: 'Wishing you a joyful Easter, filled with hope and new beginnings.',
    rays: true,
  },
  eid: {
    background: 'radial-gradient(120% 110% at 75% 22%, #1d7a5a 0%, #0c4b36 45%, #04241a 100%)',
    text: '#ffffff',
    script: '#f2d27a',
    pill: { background: '#f2d27a', text: '#0c4b36' },
    ornament: '#f2d27a',
    message: 'Peace, blessings and togetherness to you and your family.',
    rays: false,
  },
  diwali: {
    background: 'radial-gradient(120% 110% at 72% 30%, #7a1c66 0%, #45103f 45%, #1d061b 100%)',
    text: '#ffffff',
    script: '#ffcf5c',
    pill: { background: '#ff9f1c', text: '#2a0a2e' },
    ornament: '#ffcf5c',
    message: 'May the festival of lights brighten your home and your year.',
    rays: false,
  },
  halloween: {
    background: 'radial-gradient(120% 110% at 75% 25%, #4a1d6b 0%, #24103a 45%, #0d0716 100%)',
    text: '#ffffff',
    script: '#ff8c1a',
    pill: { background: '#ff8c1a', text: '#1a0b26' },
    ornament: '#ff8c1a',
    message: 'Spooky season is here. Nothing scarier than an empty ink tank.',
    rays: false,
  },
  service: {
    background: 'radial-gradient(120% 110% at 75% 25%, #5aa2f0 0%, #1d6fd8 45%, #0b3d82 100%)',
    text: '#ffffff',
    script: '#e3f0ff',
    pill: { background: '#ffffff', text: '#0b3d82' },
    ornament: '#ffffff',
    message: 'Thank you for choosing CISS Solutions. Questions about a printer, a part or an order? We are a WhatsApp message away.',
    rays: true,
  },
  school: {
    background: 'radial-gradient(120% 110% at 75% 25%, #2f5fb3 0%, #173a7a 46%, #0a1c40 100%)',
    text: '#ffffff',
    script: '#ffd23f',
    pill: { background: '#ffd23f', text: '#0a1c40' },
    ornament: '#ffd23f',
    message: 'A new term, a fresh start. Printers, ink and paper for homework and school runs, ready to collect or deliver.',
    rays: true,
  },
}

export function themeFor(occasion: ThemeMatch & Pick<Occasion, 'accentColor'>): OccasionTheme {
  const key = themeKeyFor(occasion)
  if (key === 'celebration') {
    const accent = occasion.accentColor || '#1d6fd8'
    return {
      key,
      background: `radial-gradient(120% 110% at 75% 25%, ${accent} 0%, ${accent}cc 50%, #1a1a1a 100%)`,
      text: '#ffffff',
      script: '#ffffff',
      pill: { background: '#ffffff', text: '#1a1a1a' },
      ornament: '#ffffff',
      message: 'Celebrating with you. Thank you for shopping with CISS Solutions.',
      rays: true,
    }
  }
  return { key, ...THEMES[key] }
}

/* ---- Wording ------------------------------------------------------------ */

const SCRIPT_WORDS = /^(happy|merry|blessed|joyful|welcome)\s+(.+)$/i

/**
 * "Happy Mazingira Day" becomes a script "Happy" over a bold "Mazingira Day".
 * "Customer Service Week: thank you..." keeps the part before the colon as
 * the title and the rest as a tagline.
 */
export function splitHeadline(headline: string): { script: string | null; title: string; tagline: string | null } {
  const [head, ...rest] = headline.split(':')
  const tagline = rest.join(':').trim() || null
  const words = head.trim().replace(/!+$/, '')
  const match = words.match(SCRIPT_WORDS)
  if (match) return { script: match[1], title: match[2], tagline }
  return { script: null, title: words, tagline }
}

/** Subheads the occasions were seeded with: admin notes about dates, or a
    short placeholder. The theme's own message reads better on a poster. */
const SEED_SUBHEADS = new Set([
  "honouring kenya's workers.",
  'celebrating self-governance.',
  "celebrating kenya's environment.",
  "honouring kenya's heroes.",
  "celebrating kenya's independence.",
  'fresh year, fresh toolkit.',
  'festival of lights.',
])

export function posterMessage(subhead: string | null, theme: OccasionTheme): string {
  const text = subhead?.trim() ?? ''
  if (!text) return theme.message
  if (/automatically|synced|computed|calendar/i.test(text)) return theme.message
  if (SEED_SUBHEADS.has(text.toLowerCase())) return theme.message
  return text
}

/* ---- Dates -------------------------------------------------------------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "10 October 2026", "5 to 9 October 2026", "30 December to 2 January". */
export function occasionDateLabel(occasion: Pick<Occasion, 'startMonth' | 'startDay' | 'endMonth' | 'endDay'>, today: { year: number; month: number }): string {
  const { startMonth, startDay, endMonth, endDay } = occasion
  const crossesYear = endMonth < startMonth
  if (startMonth === endMonth && startDay === endDay) {
    return `${startDay} ${MONTHS[startMonth - 1]} ${today.year}`
  }
  if (crossesYear) {
    return `${startDay} ${MONTHS[startMonth - 1]} to ${endDay} ${MONTHS[endMonth - 1]}`
  }
  if (startMonth === endMonth) {
    return `${startDay} to ${endDay} ${MONTHS[startMonth - 1]} ${today.year}`
  }
  return `${startDay} ${MONTHS[startMonth - 1]} to ${endDay} ${MONTHS[endMonth - 1]} ${today.year}`
}

/* ---- Build-up to the big day -------------------------------------------- */

/**
 * Occasions that build up to a big day and wind down after it. `from` is
 * the level on the first and last days: Christmas starts simple (1);
 * New Year's Eve is already a party (3).
 */
const PEAKS: Partial<Record<OccasionThemeKey, { month: number; day: number; from: Level; name: string }>> = {
  christmas: { month: 12, day: 25, from: 1, name: 'Christmas' },
  'new-year': { month: 1, day: 1, from: 3, name: 'New Year' },
}

export type Level = 1 | 2 | 3 | 4

/** Day number within the occasion's run, so a run across New Year counts on. */
function ordinal(month: number, day: number, wraps: boolean, startMonth: number): number {
  const shifted = wraps && month < startMonth ? month + 12 : month
  return shifted * 31 + day
}

/**
 * How dressed up the site is today, 1 (a touch) to 4 (everything). Rises
 * from the occasion's first day to its big day, then falls back to its last.
 * Occasions without a big day are at 4 throughout.
 *
 *   Christmas, 15-30 Dec:  15-18 → 1, 19-21 → 2, 22-24 → 3, 25 → 4,
 *                          26 → 3, 27-28 → 2, 29-30 → 1
 *   New Year, 31 Dec-2 Jan: 31 → 3, 1 Jan → 4, 2 Jan → 3
 */
export function occasionIntensity(
  occasion: ThemeMatch & Pick<Occasion, 'startMonth' | 'startDay' | 'endMonth' | 'endDay'>,
  today: { month: number; day: number },
): Level {
  const peak = PEAKS[themeKeyFor(occasion)]
  if (!peak) return 4
  const wraps = occasion.endMonth < occasion.startMonth
  const at = (m: number, d: number) => ordinal(m, d, wraps, occasion.startMonth)
  const start = at(occasion.startMonth, occasion.startDay)
  const end = at(occasion.endMonth, occasion.endDay)
  const top = at(peak.month, peak.day)
  const now = at(today.month, today.day)
  if (top < start || top > end || now < start || now > end) return 4

  const span = now <= top ? top - start : end - top
  if (span === 0 || now === top) return 4
  const closeness = 1 - Math.abs(top - now) / span
  return Math.min(4, peak.from + Math.floor(closeness * (4 - peak.from))) as Level
}

/** "10 days to Christmas", "Christmas Eve", "Merry Christmas, today!" */
export function peakCountdown(occasion: ThemeMatch & Pick<Occasion, 'startMonth'>, today: { month: number; day: number }): string | null {
  const key = themeKeyFor(occasion)
  const peak = PEAKS[key]
  if (!peak || key !== 'christmas') return null
  if (today.month !== peak.month) return null
  const days = peak.day - today.day
  if (days > 1) return `${days} days to ${peak.name}`
  if (days === 1) return `${peak.name} Eve`
  if (days === 0) return `It's ${peak.name}!`
  return null
}
