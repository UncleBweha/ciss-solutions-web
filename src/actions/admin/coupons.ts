'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { formObject, list } from '@/lib/admin/form-data'
import { createClient } from '@/lib/supabase/server'

const num = z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(0).nullable())
const int = z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().min(1).nullable())
const date = z.preprocess((v) => (v === '' || v == null ? null : new Date(`${v}T00:00:00+03:00`).toISOString()), z.string().nullable())

const schema = z
  .object({
    id: z.string().uuid().optional().or(z.literal('')),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, '3–30 letters, numbers, - or _'),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(['percentage', 'fixed']),
    value: z.coerce.number().positive('Enter a value above 0'),
    minimumOrder: num,
    maximumDiscount: num,
    startsAt: date,
    expiresAt: date,
    usageLimit: int,
    perCustomerLimit: int,
    productIds: z.array(z.string().uuid()),
    categoryIds: z.array(z.string().uuid()),
    isActive: z.boolean(),
  })
  .refine((v) => v.discountType !== 'percentage' || v.value <= 100, { path: ['value'], message: 'A percentage cannot exceed 100' })

export async function saveCouponAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('coupons.manage', async (user) => {
    const raw = formObject(formData, ['isActive'])
    const d = schema.parse({ ...raw, productIds: list(raw.productIds), categoryIds: list(raw.categoryIds) })
    const supabase = await createClient()
    const row = {
      code: d.code,
      description: d.description || null,
      discount_type: d.discountType,
      value: d.value,
      minimum_order: d.minimumOrder ?? 0,
      maximum_discount: d.maximumDiscount,
      starts_at: d.startsAt,
      expires_at: d.expiresAt,
      usage_limit: d.usageLimit,
      per_customer_limit: d.perCustomerLimit,
      applicable_product_ids: d.productIds,
      applicable_category_ids: d.categoryIds,
      is_active: d.isActive,
    }
    const { error } = d.id ? await supabase.from('coupons').update(row).eq('id', d.id) : await supabase.from('coupons').insert(row)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, d.id ? 'coupon.updated' : 'coupon.created', 'coupons', d.id || d.code, { after: row })
    revalidatePath('/admin/coupons')
    return { ok: true, message: `Coupon ${d.code} saved.` }
  })
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  return staffAction('coupons.manage', async (user) => {
    const supabase = await createClient()
    const { count } = await supabase.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', id)
    if (count) {
      await supabase.from('coupons').update({ is_active: false }).eq('id', id)
      await audit(user, 'coupon.deactivated', 'coupons', id)
      revalidatePath('/admin/coupons')
      return { ok: true, message: 'This coupon has been used, so it was deactivated instead of deleted.' }
    }
    const { error } = await supabase.from('coupons').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'coupon.deleted', 'coupons', id)
    revalidatePath('/admin/coupons')
    return { ok: true, message: 'Coupon deleted.' }
  })
}
