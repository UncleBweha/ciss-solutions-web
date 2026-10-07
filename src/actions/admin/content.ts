'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { formObject } from '@/lib/admin/form-data'
import { revalidateHomepage, revalidateProducts } from '@/lib/admin/revalidate'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

// ---- Homepage sections ----------------------------------------------------------

export async function saveSectionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const d = z
      .object({
        id: z.string().uuid(),
        title: optional(120),
        subtitle: optional(300),
        isEnabled: z.boolean(),
        limit: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().min(1).max(20).optional()),
        ctaText: optional(60),
        ctaUrl: optional(300),
      })
      .parse(formObject(formData, ['isEnabled']))
    const supabase = await createClient()
    const { data: current } = await supabase.from('homepage_sections').select('config').eq('id', d.id).single()
    const config = { ...((current?.config as object) ?? {}), ...(d.limit ? { limit: d.limit } : {}), ...(d.ctaText ? { cta_text: d.ctaText } : {}), ...(d.ctaUrl ? { cta_url: d.ctaUrl } : {}) }
    const { error } = await supabase.from('homepage_sections').update({ title: d.title, subtitle: d.subtitle, is_enabled: d.isEnabled, config }).eq('id', d.id)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'homepage.section_updated', 'homepage_sections', d.id, { after: d })
    revalidateHomepage()
    revalidatePath('/admin/homepage')
    return { ok: true, message: 'Section saved.' }
  })
}

async function swapOrder(table: 'homepage_sections' | 'homepage_banners', id: string, direction: -1 | 1) {
  const supabase = await createClient()
  const { data: rows } = await supabase.from(table).select('id, sort_order').order('sort_order')
  const list = rows ?? []
  const i = list.findIndex((r) => r.id === id)
  const j = i + direction
  if (i < 0 || j < 0 || j >= list.length) return
  // Renumber so equal sort orders can't get stuck.
  const ordered = [...list]
  ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  for (const [k, row] of ordered.entries()) await supabase.from(table).update({ sort_order: (k + 1) * 10 }).eq('id', row.id)
}

export async function moveSectionAction(id: string, direction: -1 | 1): Promise<ActionResult> {
  return staffAction('content.manage', async () => {
    await swapOrder('homepage_sections', z.string().uuid().parse(id), direction)
    revalidateHomepage()
    revalidatePath('/admin/homepage')
    return { ok: true, message: 'Order updated.' }
  })
}

// ---- Hero slides ----------------------------------------------------------------------

const bannerSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  eyebrow: optional(80),
  title: z.string().trim().min(2).max(80),
  highlight: optional(80),
  subtitle: optional(300),
  imageUrl: optional(500),
  imageAlt: optional(150),
  ctaText: optional(40),
  ctaUrl: optional(300),
  secondaryCtaText: optional(40),
  secondaryCtaUrl: optional(300),
  background: optional(300),
  featuredProductId: z.string().uuid().optional().or(z.literal('')),
  startsAt: z.preprocess((v) => (v ? new Date(String(v)).toISOString() : null), z.string().nullable()),
  endsAt: z.preprocess((v) => (v ? new Date(String(v)).toISOString() : null), z.string().nullable()),
  isActive: z.boolean(),
})

export async function saveBannerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const d = bannerSchema.parse(formObject(formData, ['isActive']))
    const supabase = await createClient()
    let imageUrl = d.imageUrl
    const file = formData.get('image')
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) return { ok: false, message: 'Image must be 8 MB or smaller.' }
      const path = `hero/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase() || 'png'}`
      const { error } = await supabase.storage.from('banners').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      if (error) return { ok: false, message: `Upload failed: ${error.message}` }
      imageUrl = supabase.storage.from('banners').getPublicUrl(path).data.publicUrl
    }
    const row = {
      eyebrow: d.eyebrow,
      title: d.title,
      highlight: d.highlight,
      subtitle: d.subtitle,
      image_url: imageUrl,
      image_alt: d.imageAlt,
      cta_text: d.ctaText,
      cta_url: d.ctaUrl,
      secondary_cta_text: d.secondaryCtaText,
      secondary_cta_url: d.secondaryCtaUrl,
      background: d.background,
      featured_product_id: d.featuredProductId || null,
      starts_at: d.startsAt,
      ends_at: d.endsAt,
      is_active: d.isActive,
    }
    if (d.id) {
      const { error } = await supabase.from('homepage_banners').update(row).eq('id', d.id)
      if (error) return { ok: false, message: dbError(error)! }
    } else {
      const { data: last } = await supabase.from('homepage_banners').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
      const { error } = await supabase.from('homepage_banners').insert({ ...row, sort_order: (last?.sort_order ?? 0) + 10 })
      if (error) return { ok: false, message: dbError(error)! }
    }
    await audit(user, d.id ? 'homepage.slide_updated' : 'homepage.slide_created', 'homepage_banners', d.id || null, { after: row })
    revalidateHomepage()
    revalidatePath('/admin/homepage')
    return { ok: true, message: 'Slide saved.' }
  })
}

export async function moveBannerAction(id: string, direction: -1 | 1): Promise<ActionResult> {
  return staffAction('content.manage', async () => {
    await swapOrder('homepage_banners', z.string().uuid().parse(id), direction)
    revalidateHomepage()
    revalidatePath('/admin/homepage')
    return { ok: true, message: 'Order updated.' }
  })
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  return staffAction('content.manage', async (user) => {
    const supabase = await createClient()
    const { error } = await supabase.from('homepage_banners').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'homepage.slide_deleted', 'homepage_banners', id)
    revalidateHomepage()
    revalidatePath('/admin/homepage')
    return { ok: true, message: 'Slide deleted.' }
  })
}

// ---- Reviews ------------------------------------------------------------------------------

export async function moderateReviewAction(id: string, status: 'approved' | 'rejected', note?: string): Promise<ActionResult> {
  return staffAction('reviews.moderate', async (user) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .update({ status: z.enum(['approved', 'rejected']).parse(status) })
      .eq('id', z.string().uuid().parse(id))
      .select('product:products(slug)')
      .single()
    if (error) return { ok: false, message: dbError(error)! }
    // The moderator's note goes to the audit log, not onto the review: an approved review is a public row.
    await audit(user, `review.${status}`, 'reviews', id, note ? { after: { note: z.string().max(1000).parse(note) } } : undefined)
    revalidateProducts([data?.product?.slug])
    revalidatePath('/admin/reviews')
    return { ok: true, message: `Review ${status}.` }
  })
}

// ---- Support requests ----------------------------------------------------------------------

export async function respondSupportAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('support.manage', async (user) => {
    const d = z
      .object({ id: z.string().uuid(), status: z.enum(['open', 'in_progress', 'resolved', 'closed']), response: optional(4000) })
      .parse(formObject(formData))
    const supabase = await createClient()
    const { error } = await supabase
      .from('support_requests')
      .update({ status: d.status, admin_response: d.response, ...(d.response ? { responded_at: new Date().toISOString(), responded_by: user.id } : {}) })
      .eq('id', d.id)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'support.updated', 'support_requests', d.id, { after: { status: d.status } })
    revalidatePath('/admin/support')
    return { ok: true, message: 'Request updated.' }
  })
}

/** Short-lived signed URL for a private support attachment. */
export async function supportAttachmentUrlAction(path: string): Promise<ActionResult<{ url: string }>> {
  return staffAction('support.manage', async () => {
    const { data, error } = await createAdminClient().storage.from('support-attachments').createSignedUrl(z.string().max(300).parse(path), 300)
    if (error || !data) return { ok: false, message: 'Could not open the attachment.' }
    return { ok: true, data: { url: data.signedUrl } }
  })
}
