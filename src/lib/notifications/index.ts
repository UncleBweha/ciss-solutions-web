import 'server-only'
import { after } from 'next/server'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailProvider } from './email'
import {
  adminNewOrderEmail,
  orderConfirmationEmail,
  orderStatusEmail,
  paymentConfirmationEmail,
  staffAlertsEmail,
  type OrderEmailData,
} from './templates'
import type { OrderStatus } from '@/lib/ecommerce/orders'

/**
 * Notification dispatch. Every message is recorded in the notifications table
 * (channel, status, error) so staff can audit what was sent. SMS and WhatsApp
 * channels can be added by implementing a provider and calling record() with
 * channel 'sms' / 'whatsapp'.
 */
async function deliver(kind: string, to: string | string[], message: { subject: string; html: string; text: string }, orderId?: string) {
  const db = createAdminClient()
  const recipients = Array.isArray(to) ? to : [to]
  if (!recipients.length) return
  // Idempotent per order: outbox tasks can be retried, so never send the same email twice.
  if (orderId) {
    const { data: sent } = await db
      .from('notifications')
      .select('id')
      .eq('channel', 'email')
      .eq('kind', kind)
      .eq('order_id', orderId)
      .eq('status', 'sent')
      .limit(1)
    if (sent?.length) return
  }
  let status: 'sent' | 'failed' = 'sent'
  let error: string | null = null
  try {
    await getEmailProvider().send({ to: recipients, ...message })
  } catch (e) {
    status = 'failed'
    error = (e as Error).message
    logger.error('notification.email_failed', { kind, error })
  }
  await db.from('notifications').insert({
    channel: 'email',
    kind,
    recipient: recipients.join(','),
    subject: message.subject,
    body: message.text,
    status,
    error,
    order_id: orderId ?? null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  })
  // Surface the failure so the outbox task is retried with back-off.
  if (status === 'failed') throw new Error(`email ${kind} failed: ${error}`)
}

/** Loads what an order email needs. */
export async function loadOrderEmailData(orderId: string): Promise<(OrderEmailData & { email: string; id: string }) | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('orders')
    .select('id, order_number, access_token, customer_name, customer_email, customer_phone, total, subtotal, discount, delivery_fee, payment_method, delivery_zone_name, delivery_address, delivery_town, delivery_county, order_status, items:order_items(product_name, variant_name, sku, quantity, total_price), payments(transaction_reference, status)')
    .eq('id', orderId)
    .maybeSingle()
  // A failed read is not a missing order: throw, so the outbox retries instead of marking the email done.
  if (error) throw new Error(`order for email: ${error.message}`)
  if (!data) return null
  return {
    id: data.id,
    email: data.customer_email,
    orderNumber: data.order_number,
    accessToken: data.access_token,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    total: Number(data.total),
    subtotal: Number(data.subtotal),
    discount: Number(data.discount),
    deliveryFee: Number(data.delivery_fee),
    paymentMethod: data.payment_method,
    deliveryZone: data.delivery_zone_name,
    deliveryAddress: [data.delivery_address, data.delivery_town, data.delivery_county].filter(Boolean).join(', '),
    items: data.items.map((i) => ({ name: i.variant_name ? `${i.product_name} (${i.variant_name})` : i.product_name, sku: i.sku, quantity: i.quantity, total: Number(i.total_price) })),
    status: data.order_status,
    receipt: data.payments.find((p) => p.status === 'PAID')?.transaction_reference ?? null,
  }
}

/** Staff alert recipients: the orders mailbox, ADMIN_ALERT_EMAILS and the addresses saved in Admin settings. */
async function staffAlertRecipients(): Promise<string[]> {
  const { data } = await createAdminClient().from('settings').select('value').eq('key', 'notifications').maybeSingle()
  const saved = (data?.value as { admin_emails?: unknown } | null)?.admin_emails
  const fromSettings = Array.isArray(saved) ? saved.filter((e): e is string => typeof e === 'string' && e.includes('@')) : []
  return [...new Set([serverEnv.email.orders, ...serverEnv.email.adminAlerts, ...fromSettings].map((e) => e.trim().toLowerCase()))]
}

export async function notifyOrderPlaced(orderId: string) {
  const o = await loadOrderEmailData(orderId)
  if (!o) return
  // M-Pesa orders are emailed once, when the payment clears (notifyPaymentConfirmed).
  if (o.paymentMethod === 'mpesa') return
  await deliver('order_confirmation', o.email, orderConfirmationEmail(o), o.id)
  await deliver('admin_new_order', await staffAlertRecipients(), adminNewOrderEmail(o, 'placed'), o.id)
}

/**
 * Payment confirmed. For an M-Pesa order these are its only emails: one to the customer
 * (order and payment together) and one to staff, once Safaricom confirms. For Paybill and
 * bank transfer they follow the "awaiting payment confirmation" emails sent at placement,
 * once staff have checked the money and marked the order Paid.
 */
export async function notifyPaymentConfirmed(orderId: string) {
  const o = await loadOrderEmailData(orderId)
  if (!o) return
  await deliver('payment_confirmation', o.email, paymentConfirmationEmail(o), o.id)
  await deliver('admin_payment_received', await staffAlertRecipients(), adminNewOrderEmail(o, 'paid'), o.id)
}

export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  if (!['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'READY_FOR_DISPATCH'].includes(status)) return
  const o = await loadOrderEmailData(orderId)
  if (!o) return
  await deliver(`order_${status.toLowerCase()}`, o.email, orderStatusEmail({ ...o, status }), o.id)
}

/** Admin notifications that mean money or stock needs a person now. */
const URGENT_KINDS = ['payment_unmatched', 'duplicate_payment', 'payment_no_callback', 'stock_shortage', 'outbox_dead']
/** Shares its kind (payment_failed) with every prompt a customer cancels; only this one is urgent. */
const AMOUNT_MISMATCH = 'Payment amount mismatch'

/**
 * Emails staff the urgent entries of Admin → Notifications that have not been emailed yet
 * (cron). Most of them are written by the database, which cannot send email, and in the
 * list they sit among a "payment failed" entry for every cancelled prompt.
 */
export async function emailUrgentAlerts(): Promise<number> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('notifications')
    .select('id, kind, subject, payload, created_at')
    .eq('channel', 'admin')
    .in('kind', [...URGENT_KINDS, 'payment_failed'])
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .is('payload->>emailed_at', null)
    .order('created_at')
    .limit(500)
  if (error) throw new Error(`urgent alerts: ${error.message}`)
  const urgent = data.filter((n) => n.kind !== 'payment_failed' || n.subject?.startsWith(AMOUNT_MISMATCH)).slice(0, 30)
  if (!urgent.length) return 0

  const when = (iso: string) => new Date(iso).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })
  await deliver('staff_alerts', await staffAlertRecipients(), staffAlertsEmail(urgent.map((n) => ({ subject: n.subject ?? n.kind, at: when(n.created_at) }))))
  // Marked only once the email has gone: a failed send is tried again on the next run.
  const emailedAt = new Date().toISOString()
  for (const n of urgent) {
    const payload = n.payload && typeof n.payload === 'object' && !Array.isArray(n.payload) ? n.payload : {}
    const { error: markError } = await db.from('notifications').update({ payload: { ...payload, emailed_at: emailedAt } }).eq('id', n.id)
    if (markError) logger.error('notification.alert_not_marked', { id: n.id, error: markError.message })
  }
  return urgent.length
}

/**
 * Runs notification work after the response is sent (Next's after()), so emails
 * never slow down or break checkout and payment callbacks.
 */
export function background(label: string, task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task()
    } catch (error) {
      logger.error('notification.failed', { label, error })
    }
  })
}
