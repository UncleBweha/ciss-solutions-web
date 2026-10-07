'use server'
import { revalidatePath } from 'next/cache'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { formObject, list } from '@/lib/admin/form-data'
import { revalidateSettings } from '@/lib/admin/revalidate'
import { isCounty } from '@/lib/ecommerce/kenya'
import { createClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/auth'

const text = (max: number) => z.string().trim().max(max).default('')

async function saveSetting(key: string, value: Record<string, unknown>, permission: Permission, isPublic = true): Promise<ActionResult> {
  return staffAction(permission, async (user) => {
    const supabase = await createClient()
    const { data: before } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
    const merged = { ...((before?.value as object) ?? {}), ...value }
    const { error } = await supabase.from('settings').upsert({ key, value: merged as never, is_public: isPublic, updated_by: user.id })
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, `settings.${key}_updated`, 'settings', key, { before: before?.value, after: merged })
    revalidateSettings()
    if (key.startsWith('page:')) updateTag(key)
    revalidatePath('/admin/settings', 'layout')
    return { ok: true, message: 'Settings saved.' }
  })
}

export async function saveBusinessAction(_prev: ActionResult | null, formData: FormData) {
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      tagline: text(160),
      phone: text(40),
      whatsapp: z.string().trim().max(20).transform((v) => v.replace(/\D/g, '')),
      email: z.union([z.literal(''), z.string().trim().email()]),
      location: text(120),
      address: text(200),
      business_hours: text(160),
      mpesa_paybill: text(20),
      mpesa_account_hint: text(80),
      instagram: text(200),
      facebook: text(200),
      tiktok: text(200),
      youtube: text(200),
    })
    .safeParse(formObject(formData))
  if (!d.success) return { ok: false as const, message: d.error.issues[0].message }
  const { instagram, facebook, tiktok, youtube, ...rest } = d.data
  return saveSetting('business', { ...rest, socials: { instagram, facebook, tiktok, youtube } }, 'settings.manage')
}

export async function savePaymentsAction(_prev: ActionResult | null, formData: FormData) {
  const raw = formObject(formData, ['mpesa', 'mpesa_paybill', 'bank_transfer', 'cash_on_delivery'])
  const d = z
    .object({
      mpesa: z.boolean(),
      mpesa_paybill: z.boolean(),
      paybill_number: z.string().trim().regex(/^\d{0,10}$/, 'The Paybill number is digits only'),
      paybill_account: text(40),
      paybill_instructions: text(500),
      bank_transfer: z.boolean(),
      cash_on_delivery: z.boolean(),
      bank_name: text(80),
      account_name: text(120),
      account_number: text(40),
      branch: text(80),
      instructions: text(500),
      cod_counties: z.array(z.string().refine(isCounty)),
    })
    .safeParse({ ...raw, cod_counties: list(raw.cod_counties) })
  if (!d.success) return { ok: false as const, message: d.error.issues[0].message }
  if (d.data.mpesa_paybill && !d.data.paybill_number) return { ok: false as const, message: 'Enter the Paybill number, or untick M-Pesa Paybill.' }
  if (d.data.mpesa_paybill && !d.data.paybill_account) return { ok: false as const, message: 'Enter the Paybill account number, or untick M-Pesa Paybill.' }
  if (!d.data.mpesa && !d.data.mpesa_paybill && !d.data.bank_transfer && !d.data.cash_on_delivery) return { ok: false as const, message: 'Keep at least one payment method enabled.' }
  return saveSetting(
    'payment_methods',
    {
      mpesa: { enabled: d.data.mpesa, label: 'M-Pesa' },
      card: { enabled: false, label: 'Card' },
      bank_transfer: {
        enabled: d.data.bank_transfer,
        label: 'Bank transfer',
        bank_name: d.data.bank_name,
        account_name: d.data.account_name,
        account_number: d.data.account_number,
        branch: d.data.branch,
        instructions: d.data.instructions,
      },
      cash_on_delivery: { enabled: d.data.cash_on_delivery, label: 'Cash on delivery', counties: d.data.cod_counties },
      mpesa_paybill: { enabled: d.data.mpesa_paybill, label: 'M-Pesa Paybill', paybill_number: d.data.paybill_number, account_number: d.data.paybill_account, instructions: d.data.paybill_instructions },
    },
    'payments.settings',
  )
}

export async function saveCheckoutAction(_prev: ActionResult | null, formData: FormData) {
  const d = z
    .object({
      mpesa_reservation_minutes: z.coerce.number().int().min(5).max(1440),
      bank_transfer_reservation_minutes: z.coerce.number().int().min(60).max(20160),
      max_quantity_per_item: z.coerce.number().int().min(1).max(99),
      default_title: text(70),
      default_description: text(170),
    })
    .safeParse(formObject(formData))
  if (!d.success) return { ok: false as const, message: d.error.issues[0].message }
  const { default_title, default_description, ...checkout } = d.data
  const r = await saveSetting('checkout', checkout, 'settings.manage')
  if (!r.ok) return r
  return saveSetting('seo', { default_title, default_description }, 'settings.manage')
}

export async function saveNotificationSettingsAction(_prev: ActionResult | null, formData: FormData) {
  const emails = String(formData.get('admin_emails') ?? '')
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter(Boolean)
  if (emails.some((e) => !z.string().email().safeParse(e).success)) return { ok: false as const, message: 'Enter valid email addresses separated by commas.' }
  return saveSetting('notifications', { admin_emails: emails }, 'settings.manage', false)
}

export async function saveContentPageAction(_prev: ActionResult | null, formData: FormData) {
  const d = z
    .object({
      slug: z.enum(['about', 'faqs', 'privacy', 'terms', 'refund-policy', 'shipping-policy', 'warranty']),
      title: z.string().trim().min(2).max(120),
      description: text(200),
      body: z.string().max(50000),
      reviewed: z.boolean(),
    })
    .safeParse(formObject(formData, ['reviewed']))
  if (!d.success) return { ok: false as const, message: d.error.issues[0].message }
  const { slug, ...value } = d.data
  return saveSetting(`page:${slug}`, value, 'content.manage')
}

// ---- Delivery zones -----------------------------------------------------------------

export async function saveZoneAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('settings.manage', async (user) => {
    const raw = formObject(formData, ['isDefault', 'isActive'])
    const d = z
      .object({
        id: z.string().uuid().optional().or(z.literal('')),
        name: z.string().trim().min(2).max(60),
        counties: z.array(z.string().refine(isCounty, 'Unknown county')),
        fee: z.coerce.number().min(0),
        freeOver: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(0).nullable()),
        daysMin: z.coerce.number().int().min(0).max(30),
        daysMax: z.coerce.number().int().min(0).max(60),
        label: z.string().trim().max(60).optional(),
        isDefault: z.boolean(),
        isActive: z.boolean(),
        sortOrder: z.coerce.number().int().default(0),
      })
      .parse({ ...raw, counties: list(raw.counties) })
    if (d.daysMax < d.daysMin) return { ok: false, message: 'Maximum days must be at least the minimum.' }
    const supabase = await createClient()
    if (d.isDefault) await supabase.from('delivery_zones').update({ is_default: false }).neq('id', d.id || '00000000-0000-0000-0000-000000000000')
    const row = {
      name: d.name,
      counties: d.counties,
      fee: d.fee,
      free_delivery_threshold: d.freeOver,
      estimated_days_min: d.daysMin,
      estimated_days_max: d.daysMax,
      estimate_label: d.label || null,
      is_default: d.isDefault,
      is_active: d.isActive,
      sort_order: d.sortOrder,
    }
    const { error } = d.id ? await supabase.from('delivery_zones').update(row).eq('id', d.id) : await supabase.from('delivery_zones').insert(row)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, d.id ? 'delivery_zone.updated' : 'delivery_zone.created', 'delivery_zones', d.id || d.name, { after: row })
    revalidateSettings()
    revalidatePath('/admin/settings/delivery')
    return { ok: true, message: 'Delivery zone saved.' }
  })
}

export async function deleteZoneAction(id: string): Promise<ActionResult> {
  return staffAction('settings.manage', async (user) => {
    const supabase = await createClient()
    const { error } = await supabase.from('delivery_zones').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'delivery_zone.deleted', 'delivery_zones', id)
    revalidateSettings()
    revalidatePath('/admin/settings/delivery')
    return { ok: true, message: 'Zone deleted.' }
  })
}

// ---- Staff ----------------------------------------------------------------------------

const roles = ['customer', 'super_admin', 'admin', 'manager', 'inventory_manager', 'order_manager', 'content_manager', 'support_agent'] as const

export async function setStaffRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('admins.manage', async (user) => {
    const d = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(roles) }).parse(formObject(formData))
    const supabase = await createClient()
    const { data: profile } = await supabase.from('profiles').select('id, role, email').ilike('email', d.email).maybeSingle()
    if (!profile) return { ok: false, message: 'No account with that email. Ask them to create an account first.' }
    if (profile.id === user.id) return { ok: false, message: 'You cannot change your own role.' }
    const { error } = await supabase.from('profiles').update({ role: d.role }).eq('id', profile.id)
    if (error) return { ok: false, message: error.message.includes('super admin') ? 'Only a super admin can grant or remove super admin.' : dbError(error)! }
    await audit(user, d.role === 'customer' ? 'admin.removed' : profile.role === 'customer' ? 'admin.created' : 'admin.role_changed', 'profiles', profile.id, {
      before: { role: profile.role },
      after: { role: d.role, email: d.email },
    })
    revalidatePath('/admin/settings/staff')
    return { ok: true, message: `${d.email} is now ${d.role.replace(/_/g, ' ')}.` }
  })
}
