import 'server-only'
import { serverEnv } from '@/lib/server-env'
import { createAdminClient } from '@/lib/supabase/admin'
import { posSalePayload } from './payload'

// Website sales in the POS. The POS is a separate Supabase project; the store reaches it
// through two database functions there (register_web_sale, void_web_sale) that accept the
// POS's public key plus a shared secret, so the store can do nothing else in the POS.
// Both are safe to repeat: the POS keeps one sale per order number.

/** Calls a POS function. Returns null when the POS link isn't configured. */
async function posRpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { url, key, secret } = serverEnv.pos
  if (!url || !key || !secret) return null
  const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret, ...args }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  // Thrown errors are retried by the outbox with back-off.
  if (!res.ok) throw new Error(`POS ${fn}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
  return (await res.json()) as T
}

/** Registers a paid order as a sale in the POS. Returns a note for the outbox task. */
export async function registerPosSale(orderId: string): Promise<string> {
  const { data: o } = await createAdminClient()
    .from('orders')
    .select('order_number, customer_name, customer_phone, total, discount, delivery_fee, payment_method, payment_status, paid_at, delivery_zone_name, items:order_items(product_name, variant_name, quantity, unit_price)')
    .eq('id', orderId)
    .maybeSingle()
  if (!o) return 'skipped: no order'
  // Refunded before this task ran: there is nothing to sell.
  if (o.payment_status !== 'PAID') return 'skipped: order is not paid'

  const result = await posRpc<{ receipt_number: string; existing: boolean }>('register_web_sale', {
    p_order: posSalePayload({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      paymentMethod: o.payment_method,
      discount: Number(o.discount),
      deliveryFee: Number(o.delivery_fee),
      total: Number(o.total),
      deliveryZone: o.delivery_zone_name,
      paidAt: o.paid_at,
      items: o.items.map((i) => ({ name: i.product_name, variantName: i.variant_name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
    }),
  })
  if (!result) return 'skipped: POS not configured'
  return `POS receipt ${result.receipt_number}${result.existing ? ' (already registered)' : ''}`
}

/** Voids a refunded order's sale in the POS. Returns a note for the outbox task. */
export async function voidPosSale(orderId: string): Promise<string> {
  const { data: o } = await createAdminClient().from('orders').select('order_number').eq('id', orderId).maybeSingle()
  if (!o) return 'skipped: no order'
  const result = await posRpc<{ found: boolean; receipt_number: string | null }>('void_web_sale', { p_order_number: o.order_number })
  if (!result) return 'skipped: POS not configured'
  return result.found ? `POS receipt ${result.receipt_number} voided` : 'skipped: no POS sale for this order'
}
