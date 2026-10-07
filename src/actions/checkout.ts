'use server'
import { getSessionUser } from '@/lib/auth'
import { getSettings } from '@/lib/catalog'
import { PARCEL_DELIVERY, STORE_PICKUP } from '@/lib/ecommerce/delivery'
import { quoteCart, type Quote } from '@/lib/ecommerce/quote'
import { logger } from '@/lib/logger'
import { background, notifyOrderPlaced } from '@/lib/notifications'
import { getOrderForViewer } from '@/lib/orders'
import { runTaskNow } from '@/lib/outbox'
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

/** Unpaid Paybill / bank transfer / cash orders one phone number or email may have open at once. */
const MAX_UNPAID_ORDERS = 3
/** M-Pesa prompts one number may receive per hour, across all orders and whoever asks. */
const STK_PER_NUMBER = 8
const stkLimitKey = (phone: string) => `stk-number:${phone}`

const stockMessage = (sqlMessage: string) => {
  const name = sqlMessage.split('INSUFFICIENT_STOCK:')[1]?.split('\n')[0]?.trim()
  return name ? `Sorry, “${name}” just sold out or has less stock than you requested. Please review your cart.` : 'Some items are no longer available.'
}

export async function placeOrderAction(input: CheckoutInput): Promise<PlaceOrderResult> {
  const ip = await clientIp()
  const tooMany = { ok: false as const, message: 'Too many checkout attempts. Please wait a few minutes and try again.' }
  if (!(await rateLimit(`checkout:${ip}`, 200, 600))) return tooMany

  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
    return { ok: false, message: 'Please check the highlighted fields.', errors }
  }
  const data = parsed.data
  const [settings, user] = await Promise.all([getSettings(), getSessionUser()])
  if (user && user.role !== 'customer') return { ok: false, message: 'Staff accounts cannot place orders. Sign in with a customer account to buy.' }
  if (!(await rateLimit(`checkout-phone:${data.phone}`, 10, 600))) return tooMany
  // An M-Pesa prompt lands on the number typed here, which need not be the buyer's own:
  // limit how often any one number can be prompted, whoever is asking.
  if (data.paymentMethod === 'mpesa' && !(await rateLimit(stkLimitKey(data.mpesaPhone ? kenyanPhone.parse(data.mpesaPhone) : data.phone), STK_PER_NUMBER, 3600))) {
    return { ok: false, message: 'Too many M-Pesa prompts have been sent to that number. Please wait an hour, or pay with another method.' }
  }

  // Payment method must be enabled (and COD only where offered).
  const method = settings.payment_methods[data.paymentMethod]
  if (!method?.enabled) return { ok: false, message: 'That payment method is not available. Please choose another.' }
  if (data.paymentMethod === 'card') return { ok: false, message: 'Card payments are not available yet. Please choose M-Pesa.' }
  if (data.paymentMethod === 'mpesa_paybill' && !(settings.payment_methods.mpesa_paybill.paybill_number && settings.payment_methods.mpesa_paybill.account_number)) {
    return { ok: false, message: 'That payment method is not available. Please choose another.' }
  }
  const pickup = data.deliveryMethod === 'pickup'
  // Cash is always accepted over the counter; for deliveries only in the listed counties.
  if (data.paymentMethod === 'cash_on_delivery' && !pickup) {
    const counties = settings.payment_methods.cash_on_delivery.counties ?? []
    if (counties.length && !counties.includes(data.county)) {
      return { ok: false, message: `Cash on delivery is only available in ${counties.join(', ')}.`, errors: { paymentMethod: 'Not available for your county' } }
    }
  }

  // Prices, discount and total are all computed here from the database. Delivery is
  // not charged at checkout: pickup is free, courier costs are agreed by phone.
  const quote = await quoteCart(data.items, {
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

  // Pickup orders carry the shop's own address so staff and emails show where to collect.
  const shop = settings.business
  const destination = pickup
    ? { county: 'Nairobi', town: shop.location || 'Nairobi', address: shop.address || shop.location || 'CISS Solutions shop', instructions: null }
    : { county: data.county, town: data.town, address: data.address, instructions: data.instructions ?? null }

  const reservationMinutes =
    data.paymentMethod === 'mpesa'
      ? settings.checkout.mpesa_reservation_minutes
      : data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'mpesa_paybill'
        ? settings.checkout.bank_transfer_reservation_minutes
        : null

  const db = createAdminClient()
  // Every order holds stock until it is paid or expires, and nothing is paid when an order
  // is placed: without a cap, fake orders could make the whole shop look sold out.
  if (data.paymentMethod !== 'mpesa') {
    const unpaid = () => db.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'PENDING').eq('order_status', 'PENDING')
    const [byPhone, byEmail] = await Promise.all([unpaid().eq('customer_phone', data.phone), unpaid().eq('customer_email', data.email.toLowerCase())])
    if (Math.max(byPhone.count ?? 0, byEmail.count ?? 0) >= MAX_UNPAID_ORDERS) {
      return { ok: false, message: `You already have ${MAX_UNPAID_ORDERS} orders waiting for payment. Please pay for those first, or contact us and we will help.` }
    }
  }
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
      delivery_zone_id: null,
      delivery_zone_name: pickup ? STORE_PICKUP : PARCEL_DELIVERY,
      delivery_county: destination.county,
      delivery_town: destination.town,
      delivery_address: destination.address,
      delivery_instructions: destination.instructions,
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
  background('outbox:order_placed', () => runTaskNow(order.id, 'order_placed', () => notifyOrderPlaced(order.id)))

  if (user) {
    const supabase = await createClient()
    const { data: cart } = await supabase.from('carts').select('id').eq('user_id', user.id).maybeSingle()
    if (cart) await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    if (data.saveAddress && !pickup) {
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
    const phone = data.mpesaPhone ? kenyanPhone.parse(data.mpesaPhone) : data.phone
    const stk = await runTaskNow(order.id, 'mpesa_stk_push', () => initiateMpesaPayment(order.id, phone)).catch((e) => {
      logger.error('checkout.stk_failed', { error: e })
      return undefined
    })
    paymentMessage = !stk
      ? 'We could not send the M-Pesa prompt. You can retry from the next page.'
      : stk.outcome === 'retry'
        ? 'We are having trouble reaching M-Pesa and will retry shortly. You can also retry from the next page.'
        : (stk.message ?? 'Sending the M-Pesa prompt to your phone…')
  }

  return {
    ok: true,
    orderNumber: order.order_number,
    redirectTo: `/order/${encodeURIComponent(order.order_number)}?t=${order.access_token}&placed=1`,
    paymentMessage,
  }
}

/** Re-sends the STK push for an unpaid M-Pesa order (from the order page). */
export async function retryMpesaPaymentAction(orderNumber: string, token: string | null, phoneInput: string) {
  const ip = await clientIp()
  // Loose per-address ceiling; initiateMpesaPayment limits prompts per order.
  if (!(await rateLimit(`retry:${ip}`, 200, 600))) return { ok: false, message: 'Too many attempts. Please wait a few minutes.' }
  const order = await getOrderForViewer(orderNumber, token)
  if (!order) return { ok: false, message: 'Order not found.' }
  const phone = kenyanPhone.safeParse(phoneInput)
  if (!phone.success) return { ok: false, message: 'Enter a valid Safaricom number.' }
  if (!(await rateLimit(stkLimitKey(phone.data), STK_PER_NUMBER, 3600))) return { ok: false, message: 'Too many M-Pesa prompts have been sent to that number. Please wait an hour.' }
  return initiateMpesaPayment(order.id, phone.data)
}
