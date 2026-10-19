'use server'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { tags } from '@/lib/cache'
import { syncOccasionDates, type OccasionSyncResult } from '@/lib/occasions/data'
import { OCCASION_DECORATIONS, OCCASION_KINDS, type ThemeOverrideMode } from '@/lib/occasions/types'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

// Admin, Settings, Occasions: add, edit and delete occasions, and choose what
// the store shows (follow the calendar, force one on, or off). Staff need
// content.manage; RLS checks the same permission in the database.

const month = z.coerce.number().int().min(1).max(12)
const day = z.coerce.number().int().min(1).max(31)

const occasionSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  kind: z.enum(OCCASION_KINDS as [string, ...string[]]),
  startMonth: month,
  startDay: day,
  endMonth: month,
  endDay: day,
  decoration: z.enum(OCCASION_DECORATIONS as [string, ...string[]]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
  bannerHeadline: z.string().trim().min(2, 'Enter the banner headline').max(120),
  bannerSubhead: z.string().trim().max(300).nullable().transform((v) => v || null),
  pickKeyword: z.string().trim().max(60).nullable().transform((v) => v || null),
  isEnabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(-1000).max(1000),
})

export type OccasionInput = z.input<typeof occasionSchema>

function toRow(d: z.output<typeof occasionSchema>) {
  return {
    name: d.name,
    kind: d.kind,
    start_month: d.startMonth,
    start_day: d.startDay,
    end_month: d.endMonth,
    end_day: d.endDay,
    decoration: d.decoration,
    accent_color: d.accentColor,
    banner_headline: d.bannerHeadline,
    banner_subhead: d.bannerSubhead,
    pick_keyword: d.pickKeyword,
    is_enabled: d.isEnabled,
    sort_order: d.sortOrder,
  }
}

function changed() {
  updateTag(tags.occasions)
  revalidatePath('/admin/settings/occasions')
}

/** A day that exists in that month (29 February allowed: it recurs in leap years). */
function realDate(m: number, d: number) {
  return d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

export async function saveOccasionAction(slug: string | null, input: OccasionInput): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const parsed = occasionSchema.safeParse(input)
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
    const d = parsed.data
    if (!realDate(d.startMonth, d.startDay) || !realDate(d.endMonth, d.endDay)) return { ok: false, message: 'That date does not exist. Check the day and month.' }
    const supabase = await createClient()
    const row = toRow(d)
    if (slug) {
      const { error } = await supabase.from('occasions').update(row).eq('slug', slug)
      if (error) return { ok: false, message: dbError(error)! }
      await audit(user, 'occasion.updated', 'occasions', slug, { after: row })
    } else {
      const newSlug = slugify(d.name)
      if (!newSlug) return { ok: false, message: 'Use letters or numbers in the name.' }
      const { error } = await supabase.from('occasions').insert({ ...row, slug: newSlug })
      if (error) return { ok: false, message: error.code === '23505' ? 'An occasion with that name already exists.' : dbError(error)! }
      await audit(user, 'occasion.created', 'occasions', newSlug, { after: row })
    }
    changed()
    return { ok: true, message: slug ? 'Occasion saved.' : 'Occasion added.' }
  })
}

export async function deleteOccasionAction(slug: string): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const supabase = await createClient()
    const { error } = await supabase.from('occasions').delete().eq('slug', z.string().min(1).parse(slug))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'occasion.deleted', 'occasions', slug, {})
    changed()
    return { ok: true, message: 'Occasion deleted.' }
  })
}

export async function setThemeOverrideAction(mode: ThemeOverrideMode, forcedSlug: string | null): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const m = z.enum(['auto', 'forced', 'off']).parse(mode)
    if (m === 'forced' && !forcedSlug) return { ok: false, message: 'Choose the occasion to show.' }
    const supabase = await createClient()
    const { error } = await supabase
      .from('site_theme_override')
      .update({ mode: m, forced_occasion_slug: m === 'forced' ? forcedSlug : null })
      .eq('id', true)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'occasion.mode', 'site_theme_override', 'site', { after: { mode: m, forcedSlug } })
    changed()
    return { ok: true, message: m === 'auto' ? 'The store follows the calendar.' : m === 'off' ? 'Occasions are switched off.' : 'Showing that occasion to every visitor.' }
  })
}

export async function syncOccasionDatesAction(): Promise<ActionResult<OccasionSyncResult[]>> {
  return staffAction('content.manage', async () => {
    const results = await syncOccasionDates()
    changed()
    const updated = results.filter((r) => r.updated)
    return {
      ok: true,
      message: updated.length ? `Updated ${updated.length}: ${updated.map((r) => r.slug).join(', ')}` : 'All dates are already current.',
      data: results,
    }
  })
}
