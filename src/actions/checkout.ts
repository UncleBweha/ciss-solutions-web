'use server'
import { getSessionUser } from '@/lib/auth'
import { getSettings } from '@/lib/catalog'
import { quoteCart, type Quote } from '@/lib/ecommerce/quote'
import { logger } from '@/lib/logger'
import { background } from '@/lib/notifications'
import { getOrderForViewer } from '@/lib/orders'
import { runOutbox } from '@/lib/outbox'
import { initiateMpesaPayment } from '@/lib/payments/service'
import { clientIp, rateLimit } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checkoutSchema, type CheckoutInput } from '@/lib/validation/checkout'
import { kenyanPhone } from '@/lib/validation/forms'

export type { CheckoutInput }

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; redirectTo: string; paymentMessage?: string }
  | { ok: false; message: string; errors?: Record<string, string>; quote?: Quote }

const stockMessage = (sqlMessage: string) => {
  const name = sqlMessage.split('INSUFFICIENT_STOCK:')[1]?.split('\n')[0]?.trim()
  return name ? `Sorry, “${name}” just sold out or has less stock than you requested. Please review your cart.` : 'Some items are no longer available.'
}

export async function placeOrderAction(input: CheckoutInput): Promise<PlaceOrderResult> {
  const ip = await clientIp()
  if (!(await rateLimit(`checkout:${ip}`, 10, 600))) {
    return { ok: false, message: 'Too many checkout attempts. Please wait a few minutes and try again.' }
  }

  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
    return { ok: false, message: 'Please check the highlighted fields.', errors }
  }
  const data = parsed.data
  const [settings, user] = await Promise.all([getSettings(), getSessionUser()])

  // Payment method must be enabled (and COD only where offered).
  const method = settings.payment_methods[data.paymentMethod]
  if (!method?.enabled) return { ok: false, message: 'That payment method is not available. Please choose another.' }
  if (data.paymentMethod === 'card') return { ok: false, message: 'Card payments are not available yet. Please choose M-Pesa.' }
  if (data.paymentMethod === 'mpesa_paybill' && !settings.payment_methods.mpesa_paybill.paybill_number) {
    return { ok: false, message: 'That payment method is not available. Please choose another.' }
  }
  if (data.paymentMethod === 'cash_on_delivery') {
    const counties = settings.payment_methods.cash_on_delivery.counties ?? []
    if (counties.length && !counties.includes(data.county)) {
      return { ok: false, message: `Cash on delivery is only available in ${counties.join(', ')}.`, errors: { paymentMethod: 'Not available for your county' } }
    }
  }

  // Prices, discount, delivery and total are all computed here from the database.
  const quote = await quoteCart(data.items, {
    county: data.county,
    couponCode: data.couponCode,
    customer: { userId: user?.id, phone: data.phone, email: data.email },
    maxPerItem: settings.checkout.max_quantity_per_item,
  })
  if (quote.issues.length || !quote.lines.length) {
    return { ok: false, message: 'Some items in your cart changed. Please review your cart before paying.', quote }
  }
  if (data.couponCode && !quote.coupon) {
    return { ok: false, message: quote.couponMessage ?? 'This coupon cannot be applied.', errors: { couponCode: quote.couponMessage ?? 'Invalid coupon' }, quote }
  }
  if (!quote.zone) return { ok: false, message: 'We do not deliver to that location yet. Please contact us.' }

  const reservationMinutes =
    data.paymentMethod === 'mpesa'
      ? settings.checkout.mpesa_reservation_minutes
      : data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'mpesa_paybill'
        ? settings.checkout.bank_transfer_reservation_minutes
        : null

  const db = createAdminClient()
  const { data: placed, error } = await db.rpc('place_order', {
    p_order: {
      user_id: user?.id ?? null,
      customer_name: data.fullName,
      customer_email: data.email,
      customer_phone: data.phone,
      // M-Pesa number for the STK push (stored in the outbox task with the order)
      payment_phone: data.paymentMethod === 'mpesa' && data.mpesaPhone ? kenyanPhone.parse(data.mpesaPhone) : data.phone,
      payment_method: data.paymentMethod,
      subtotal: quote.subtotal,
      discount: quote.discount,
      delivery_fee: quote.deliveryFee,
      total: quote.total,
      coupon_id: quote.coupon?.id ?? null,
      coupon_code: quote.coupon?.code ?? null,
      delivery_zone_id: quote.zone.id,
      delivery_zone_name: quote.zone.name,
      delivery_county: data.county,
      delivery_town: data.town,
      delivery_address: data.address,
      delivery_instructions: data.instructions ?? null,
      customer_notes: data.notes ?? null,
      reservation_minutes: reservationMinutes,
      items: quote.lines.map((l) => ({
        product_id: l.productId,
        variant_id: l.variantId,
        product_name: l.name,
        variant_name: l.variantName,
        sku: l.sku,
        image_url: l.imageUrl,
        quantity: l.quantity,
        unit_price: l.unitPrice,
      })),
    },
  })

  if (error || !placed) {
    const msg = error?.message ?? ''
    if (msg.includes('INSUFFICIENT_STOCK')) return { ok: false, message: stockMessage(msg) }
    if (msg.includes('COUPON_')) return { ok: false, message: 'This coupon is no longer available.', errors: { couponCode: 'Coupon no longer available' } }
    logger.error('checkout.place_order_failed', { error: msg })
    return { ok: false, message: 'We could not place your order. Please try again or contact us.' }
  }

  const order = placed as { id: string; order_number: string; access_token: string }
  logger.info('checkout.order_placed', { orderNumber: order.order_number, method: data.paymentMethod, total: quote.total })
  // Emails were queued in the outbox with the order; send them after the response.
  background('outbox:order_placed', () => runOutbox({ orderId: order.id, kinds: ['order_placed'] }))

  if (user) {
    const supabase = await createClient()
    const { data: cart } = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle()
    if (cart) await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    if (data.saveAddress) {
      await supabase.from('addresses').insert({
        user_id: user.id,
        full_name: data.fullName,
        phone: data.phone,
        county: data.county,
        town: data.town,
        address_line: data.address,
        instructions: data.instructions ?? null,
        label: 'Checkout',
      })
    }
  }

  let paymentMessage: string | undefined
  if (data.paymentMethod === 'mpesa') {
    // The STK push task was committed with the order. Run it now so the prompt reaches
    // the phone immediately; if this fails or the server stops, the cron sweep retries it.
    const results = await runOutbox({ orderId: order.id, kinds: ['mpesa_stk_push'] }).catch((e) => {
      logger.error('checkout.stk_failed', { error: e })
      return []
    })
    const stk = results[0]
    paymentMessage =
      stk?.outcome === 'done' && stk.message
        ? stk.message
        : stk?.outcome === 'retry'
          ? 'We are having trouble reaching M-Pesa and will retry shortly. You can also retry from the next page.'
          : 'Sending the M-Pesa prompt to your phone…'
  }

  return {
    ok: true,
    orderNumber: order.order_number,
    redirectTo: `/order/${encodeURIComponent(order.order_number)}?t=${order.access_token}`,
    paymentMessage,
  }
}

/** Re-sends the STK push for an unpaid M-Pesa order (from the order page). */
export async function retryMpesaPaymentAction(orderNumber: string, token: string | null, phoneInput: string) {
  const ip = await clientIp()
  if (!(await rateLimit(`retry:${ip}`, 10, 600))) return { ok: false, message: 'Too many attempts. Please wait a few minutes.' }
  const order = await getOrderForViewer(orderNumber, token)
  if (!order) return { ok: false, message: 'Order not found.' }
  const phone = kenyanPhone.safeParse(phoneInput)
  if (!phone.success) return { ok: false, message: 'Enter a valid Safaricom number.' }
  return initiateMpesaPayment(order.id, phone.data)
}
