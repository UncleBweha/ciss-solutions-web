import 'server-only'
import { cache } from 'react'
import { revalidateTag } from 'next/cache'
import { tags } from '@/lib/cache'
import { isSupabaseConfigured } from '@/lib/env'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { fetchHolidayCalendar, findEventDate, type CalendarEvent } from './calendar'
import { formulaDates, nairobiToday, occasionCovers } from './dates'
import type { Occasion, OccasionCalendarSource, ThemeOverride } from './types'

// Which occasion the store is dressed for, and the daily re-dating of movable ones.
//
// What shows right now (getActiveOccasion):
//   1. site_theme_override.mode "forced": that occasion, for everyone (also how staff preview one);
//   2. "off": nothing;
//   3. "auto" (default): the enabled occasion whose dates cover today in Nairobi,
//      highest sort order first if two overlap.
//
// Reads are cached for five minutes under the "occasions" tag; saving in Admin
// expires the tag at once.

export const OCCASION_COLUMNS =
  'id, slug, name, kind, start_month, start_day, end_month, end_day, decoration, accent_color, banner_headline, banner_subhead, pick_keyword, is_enabled, sort_order, calendar_source, calendar_start_event_name, calendar_end_event_name, date_formula'

type OccasionRow = {
  id: string
  slug: string
  name: string
  kind: Occasion['kind']
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  decoration: Occasion['decoration']
  accent_color: string
  banner_headline: string
  banner_subhead: string | null
  pick_keyword: string | null
  is_enabled: boolean
  sort_order: number
  calendar_source: Occasion['calendarSource']
  calendar_start_event_name: string | null
  calendar_end_event_name: string | null
  date_formula: Occasion['dateFormula']
}

export function mapOccasion(row: OccasionRow): Occasion {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    startMonth: row.start_month,
    startDay: row.start_day,
    endMonth: row.end_month,
    endDay: row.end_day,
    decoration: row.decoration,
    accentColor: row.accent_color,
    bannerHeadline: row.banner_headline,
    bannerSubhead: row.banner_subhead,
    pickKeyword: row.pick_keyword,
    isEnabled: row.is_enabled,
    sortOrder: row.sort_order,
    calendarSource: row.calendar_source,
    calendarStartEventName: row.calendar_start_event_name,
    calendarEndEventName: row.calendar_end_event_name,
    dateFormula: row.date_formula,
  }
}

/**
 * The storefront never fails because of decorations: if the occasions can't be
 * read (or the migration isn't applied yet) the store simply shows no occasion.
 */
async function safely<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured) return fallback
  try {
    return await fn()
  } catch (error) {
    logger.warn('occasions.read_failed', { label, error })
    return fallback
  }
}

/** Enabled occasions, cached (RLS shows the public only enabled rows). */
export const getEnabledOccasions = cache(async (): Promise<Occasion[]> =>
  safely('enabled', [], async () => {
    const { data, error } = await publicClient([tags.occasions], 300)
      .from('occasions')
      .select(OCCASION_COLUMNS)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as unknown as OccasionRow[]).map(mapOccasion)
  }),
)

export const getThemeOverride = cache(async (): Promise<ThemeOverride> =>
  safely('override', { mode: 'auto', forcedOccasionSlug: null } as ThemeOverride, async () => {
    const { data, error } = await publicClient([tags.occasions], 300).from('site_theme_override').select('mode, forced_occasion_slug').eq('id', true).maybeSingle()
    if (error) throw new Error(error.message)
    return { mode: (data?.mode as ThemeOverride['mode']) ?? 'auto', forcedOccasionSlug: data?.forced_occasion_slug ?? null }
  }),
)

/** The occasion the store is dressed for today, or null. */
export const getActiveOccasion = cache(async (): Promise<Occasion | null> => {
  const [override, enabled] = await Promise.all([getThemeOverride(), getEnabledOccasions()])
  if (override.mode === 'off') return null
  if (override.mode === 'forced') return enabled.find((o) => o.slug === override.forcedOccasionSlug) ?? null
  const { month, day } = nairobiToday()
  return enabled.find((o) => occasionCovers(o, month, day)) ?? null
})

/** Every occasion, enabled or not, for the admin page (staff session; RLS allows content.manage). */
export async function getOccasionsForAdmin(): Promise<Occasion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('occasions').select(OCCASION_COLUMNS).order('kind').order('sort_order', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as unknown as OccasionRow[]).map(mapOccasion)
}

/* ---- Movable dates: /api/cron/sync-occasion-dates and Admin "Sync dates now" ---- */

export type OccasionSyncResult = { slug: string; updated: boolean; reason: string }

/**
 * Re-derives every movable occasion's dates for this year and saves any that
 * changed. Idempotent. An occasion the sync can't resolve (feed down, or the
 * calendar hasn't published this year yet) is left as it was, never cleared.
 * Disabled occasions are kept current too, so re-enabling one never shows a stale date.
 */
export async function syncOccasionDates(): Promise<OccasionSyncResult[]> {
  const results: OccasionSyncResult[] = []
  const db = createAdminClient()
  const { data, error } = await db.from('occasions').select(OCCASION_COLUMNS)
  if (error) throw new Error(error.message)
  const syncable = (data as unknown as OccasionRow[]).map(mapOccasion).filter((o) => o.calendarSource || o.dateFormula)
  if (!syncable.length) return results

  const year = nairobiToday().year
  const feeds = new Map<OccasionCalendarSource, CalendarEvent[]>()
  for (const source of ['kenya', 'indian'] as const) {
    if (!syncable.some((o) => o.calendarSource === source)) continue
    try {
      feeds.set(source, await fetchHolidayCalendar(source))
    } catch (e) {
      results.push({ slug: `(${source} calendar)`, updated: false, reason: e instanceof Error ? e.message : 'fetch failed' })
    }
  }

  for (const occasion of syncable) {
    let start: { month: number; day: number } | null = null
    let end: { month: number; day: number } | null = null
    if (occasion.dateFormula) {
      ;({ start, end } = formulaDates(occasion.dateFormula, year))
    } else if (occasion.calendarSource) {
      const events = feeds.get(occasion.calendarSource)
      if (!events) {
        results.push({ slug: occasion.slug, updated: false, reason: 'calendar unavailable' })
        continue
      }
      start = occasion.calendarStartEventName ? findEventDate(events, occasion.calendarStartEventName, year) : null
      end = occasion.calendarEndEventName ? findEventDate(events, occasion.calendarEndEventName, year) : start
    }
    if (!start || !end) {
      results.push({ slug: occasion.slug, updated: false, reason: `no ${year} date found` })
      continue
    }
    if (start.month === occasion.startMonth && start.day === occasion.startDay && end.month === occasion.endMonth && end.day === occasion.endDay) {
      results.push({ slug: occasion.slug, updated: false, reason: 'already current' })
      continue
    }
    const { error: updateError } = await db
      .from('occasions')
      .update({ start_month: start.month, start_day: start.day, end_month: end.month, end_day: end.day })
      .eq('slug', occasion.slug)
    results.push(
      updateError
        ? { slug: occasion.slug, updated: false, reason: updateError.message }
        : { slug: occasion.slug, updated: true, reason: `${occasion.startDay}/${occasion.startMonth} → ${start.day}/${start.month}` },
    )
  }

  if (results.some((r) => r.updated)) revalidateTag(tags.occasions, { expire: 0 })
  return results
}
