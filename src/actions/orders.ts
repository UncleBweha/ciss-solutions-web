'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { normalizeKenyanPhone } from '@/lib/ecommerce/kenya'
import { clientIp, rateLimit } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FormState } from '@/lib/validation/forms'

const trackSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().min(6, 'Enter your order number').max(40),
  phone: z.string().trim().min(9, 'Enter the phone number used for the order'),
})

/** Order lookup by number + phone (guest tracking). Rate limited against guessing. */
export async function trackOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp()
  if (!(await rateLimit(`track:${ip}`, 150, 900))) return { message: 'Too many attempts. Please try again in 15 minutes.' }
  const parsed = trackSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { message: parsed.error.issues[0].message }

  const orderNumber = parsed.data.orderNumber.startsWith('CISS-') ? parsed.data.orderNumber : `CISS-${parsed.data.orderNumber}`
  // Guessing the phone for one order is what needs the tight limit.
  if (!(await rateLimit(`track-order:${orderNumber}`, 10, 900))) return { message: 'Too many attempts. Please try again in 15 minutes.' }
  const phone = normalizeKenyanPhone(parsed.data.phone)
  const { data } = await createAdminClient()
    .from('orders')
    .select('order_number, access_token, customer_phone')
    .eq('order_number', orderNumber)
    .maybeSingle()
  // Same message whether the order or the phone is wrong.
  if (!data || !phone || data.customer_phone !== phone) {
    return { message: 'We could not find an order with that number and phone. Check both and try again.' }
  }
  redirect(`/order/${encodeURIComponent(data.order_number)}?t=${data.access_token}`)
}
