// Occasions: the store dressed for national days, holidays and seasons.
// Rows live in public.occasions (supabase/migrations/20261019000100_occasions.sql).

export type OccasionKind = 'kenyan_national' | 'international' | 'religious'

export type OccasionDecoration =
  | 'snow_lights_tree'
  | 'fireworks_confetti'
  | 'flag_bunting'
  | 'hearts'
  | 'flowers_hearts'
  | 'crescent_lanterns'
  | 'diwali_lights'
  | 'none'

export type OccasionCalendarSource = 'kenya' | 'indian'
export type OccasionDateFormula = 'mothers_day' | 'fathers_day' | 'customer_service_week'

/** Dates recur every year (month and day, no year). */
export type Occasion = {
  id: string
  slug: string
  name: string
  kind: OccasionKind
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  decoration: OccasionDecoration
  accentColor: string
  bannerHeadline: string
  bannerSubhead: string | null
  /** Products whose name or category contains this come first among the picks. */
  pickKeyword: string | null
  isEnabled: boolean
  sortOrder: number
  calendarSource: OccasionCalendarSource | null
  calendarStartEventName: string | null
  calendarEndEventName: string | null
  dateFormula: OccasionDateFormula | null
}

export type ThemeOverrideMode = 'auto' | 'forced' | 'off'

export type ThemeOverride = { mode: ThemeOverrideMode; forcedOccasionSlug: string | null }

export const OCCASION_KINDS: OccasionKind[] = ['kenyan_national', 'international', 'religious']
export const OCCASION_DECORATIONS: OccasionDecoration[] = [
  'snow_lights_tree',
  'fireworks_confetti',
  'flag_bunting',
  'hearts',
  'flowers_hearts',
  'crescent_lanterns',
  'diwali_lights',
  'none',
]
