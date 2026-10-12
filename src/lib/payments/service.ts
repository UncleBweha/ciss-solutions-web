import 'server-only'
import { logger } from '@/lib/logger'
import { background, notifyPaymentConfirmed } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { describeResultCode, parseStkCallback } from './mpesa-result'
import { mockReceipt } from './mock'
import { getMpesaProvider } from './provider'
import { PaymentError } from './types'
import type { Database } from '@/types/database'

// Payment orchestration. The browser only ever *asks* for status; whether an order
// is paid is decided here, from the provider's callback (or the mock's status query),
// and committed by the confirm_payment() database function (idempotent).

type Db = ReturnType<typeof createAdminClient>

/** An entry in Admin → Notifications. If it cannot be saved, the log is the only record: say so loudly. */
async function alertStaff(db: Db, alert: Database['public']['Functions']['notify_admin']['Args']) {
  const { error } = await db.rpc('notify_admin', alert)
  if (error) logger.error('mpesa.alert_not_saved', { kind: alert.p_kind, subject: alert.p_subject, error: error.message })
}

/** What confirm_payment() can answer. Anything else means the database and this code are out of step. */
const CONFIRM_STATUSES = ['confirmed', 'already_paid', 'amount_mismatch'] as const

async function loadPayableOrder(db: Db, orderId: string) {
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, total, payment_method, payment_status, order_status, stock_state, reservation_expires_at')
    .eq('id', orderId)
    .maybeSingle()
  return order
}

export type InitiateResult =
  | { ok: true; paymentId: string; message: string }
  | { ok: false; message: string }

/** Sends an STK push for an order that is awaiting M-Pesa payment. */
export async function initiateMpesaPayment(orderId: string, phone: string): Promise<InitiateResult> {
  const db = createAdminClient()
  const order = await loadPayableOrder(db, orderId)
  if (!order) return { ok: false, message: 'Order not found.' }
  if (order.payment_method !== 'mpesa') return { ok: false, message: 'This order is not paid by M-Pesa.' }
  if (order.payment_status === 'PAID') return { ok: false, message: 'This order is already paid.' }
  if (order.order_status !== 'PAYMENT_PENDING' || order.stock_state !== 'reserved') {
    return { ok: false, message: 'This order can no longer be paid. Please place a new order.' }
  }
  if (order.reservation_expires_at && new Date(order.reservation_expires_at) < new Date()) {
    return { ok: false, message: 'The payment window for this order has expired. Please place a new order.' }
  }

  // At most 5 prompts per order per 10 minutes.
  const { data: allowed } = await db.rpc('check_rate_limit', { p_key: `stk:${orderId}`, p_max: 5, p_window_seconds: 600 })
  if (allowed === false) return { ok: false, message: 'Too many payment attempts. Please wait a few minutes and try again.' }

  // Two requests arriving together (a double tap, or checkout and the cron retry) would both
  // pass the check below before either had saved its payment: one per order every 5 seconds.
  const { data: free } = await db.rpc('check_rate_limit', { p_key: `stk-sending:${orderId}`, p_max: 1, p_window_seconds: 5 })
  if (free === false) return { ok: false, message: 'A payment request was just sent to your phone. Check your phone or wait a minute to retry.' }

  // A prompt still in flight (or being sent right now) must finish before another one is sent.
  const { data: inflight } = await db
    .from('payments')
    .select('id, created_at')
    .eq('order_id', orderId)
    .in('status', ['PENDING', 'PROCESSING'])
    .gte('created_at', new Date(Date.now() - IN_FLIGHT_MS).toISOString())
    .limit(1)
  if (inflight?.length) return { ok: false, message: 'A payment request was just sent to your phone. Check your phone or wait a minute to retry.' }

  const provider = getMpesaProvider()
  const amount = Math.ceil(Number(order.total))
  const { data: payment, error } = await db
    .from('payments')
    .insert({ order_id: orderId, method: 'mpesa', provider: provider.name, status: 'PENDING', amount, phone_number: phone })
    .select('id')
    .single()
  if (error || !payment) throw new Error(`payment insert failed: ${error?.message}`)

  let stk
  try {
    stk = await provider.initiate({ amount, phone, reference: order.order_number.replace(/^CISS-/, ''), description: 'CISS order' })
  } catch (e) {
    // No answer from the provider: the prompt may still have reached the phone.
    const unknown = e instanceof PaymentError && e.outcomeUnknown
    const message = unknown
      ? 'We could not confirm that the request reached M-Pesa. If a prompt appears on your phone you can complete it; otherwise wait a minute and try again.'
      : e instanceof PaymentError ? e.customerMessage : 'We could not reach M-Pesa. Please try again.'
    const detail = (e instanceof Error ? e.message : String(e)).slice(0, 500)
    const { error: failError } = await db.from('payments').update({ status: 'FAILED', result_description: detail }).eq('id', payment.id)
    logger.error('mpesa.stk_failed', { orderNumber: order.order_number, paymentId: payment.id, outcomeUnknown: unknown, error: e, failError })
    return { ok: false, message }
  }

  // The callback finds the payment by these ids, so a lost write here loses the payment.
  const ids = { status: 'PROCESSING' as const, merchant_request_id: stk.merchantRequestId, checkout_request_id: stk.checkoutRequestId }
  let { error: saveError } = await db.from('payments').update(ids).eq('id', payment.id)
  if (saveError) ({ error: saveError } = await db.from('payments').update(ids).eq('id', payment.id))
  if (saveError) {
    logger.error('mpesa.stk_ids_not_saved', { orderNumber: order.order_number, paymentId: payment.id, ...ids, error: saveError })
  }
  const { error: orderError } = await db.from('orders').update({ payment_status: 'PROCESSING' }).eq('id', orderId).neq('payment_status', 'PAID')
  if (orderError) logger.warn('mpesa.order_status_not_saved', { orderNumber: order.order_number, error: orderError })
  logger.info('mpesa.stk_sent', { orderNumber: order.order_number, paymentId: payment.id, provider: provider.name })
  return { ok: true, paymentId: payment.id, message: 'Check your phone and enter your M-Pesa PIN to complete payment.' }
}

export type CallbackOutcome = 'confirmed' | 'already_paid' | 'failed' | 'amount_mismatch' | 'unknown_payment' | 'invalid'

/** Processes an M-Pesa STK callback. Safe to call repeatedly with the same payload. */
export async function handleStkCallback(payload: unknown): Promise<CallbackOutcome> {
  const result = parseStkCallback(payload)
  if (!result) {
    logger.warn('mpesa.callback_invalid', { payload })
    return 'invalid'
  }
  const db = createAdminClient()
  const find = async () => {
    const { data, error } = await db
      .from('payments')
      .select('id, order_id, amount, merchant_request_id, transaction_reference, status')
      .eq('checkout_request_id', result.checkoutRequestId)
      .maybeSingle()
    if (error) throw new Error(`payment lookup: ${error.message}`)
    return data
  }
  let payment = await find()
  // A fast callback can beat the write that stores the checkout id; give it a moment.
  for (let attempt = 0; !payment && attempt < 2; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    payment = await find()
  }
  if (!payment) {
    if (result.kind === 'success') {
      // Money was received that no order can be matched to: staff must reconcile it.
      logger.error('mpesa.callback_unmatched_payment', { checkoutRequestId: result.checkoutRequestId, receipt: result.receipt, amount: result.amount })
      await alertStaff(db, {
        p_kind: 'payment_unmatched',
        p_subject: `M-Pesa payment ${result.receipt} could not be matched to an order`,
        p_payload: { receipt: result.receipt, amount: result.amount, phone: result.phone, checkout_request_id: result.checkoutRequestId },
      })
    } else {
      logger.warn('mpesa.callback_unknown_payment', { checkoutRequestId: result.checkoutRequestId })
    }
    return 'unknown_payment'
  }
  if (payment.merchant_request_id && payment.merchant_request_id !== result.merchantRequestId) {
    logger.warn('mpesa.callback_mismatched_request', { paymentId: payment.id })
    if (result.kind === 'success') await alertRejected(db, payment, result, 'its request id does not match the prompt we sent')
    return 'invalid'
  }

  if (result.kind === 'failure') {
    const { error } = await db.rpc('fail_payment', {
      p_payment_id: payment.id,
      p_result_code: result.code,
      p_description: result.description,
      p_raw: payload as never,
    })
    if (error) throw new Error(`fail_payment: ${error.message}`)
    logger.info('mpesa.payment_failed', { paymentId: payment.id, code: result.code })
    return 'failed'
  }

  // A receipt can only ever confirm one payment.
  const { data: reused } = await db
    .from('payments')
    .select('id')
    .eq('transaction_reference', result.receipt)
    .neq('id', payment.id)
    .maybeSingle()
  if (reused) {
    logger.warn('mpesa.receipt_reused', { paymentId: payment.id, receipt: result.receipt })
    await alertRejected(db, payment, result, 'that receipt already paid another order')
    return 'invalid'
  }

  return confirm(db, payment.id, payment.order_id, result.receipt, result.amount, payload, payment.transaction_reference)
}

/**
 * A callback that reports money received but that we will not accept. The sender is told
 * "accepted" (so it does not retry) and the attempt later times out as failed: without
 * this, nobody would know a customer may have been charged.
 */
async function alertRejected(
  db: Db,
  payment: { id: string; order_id: string },
  result: { receipt: string; amount: number; phone: string | null; checkoutRequestId: string },
  why: string,
) {
  logger.error('mpesa.callback_rejected_payment', { paymentId: payment.id, receipt: result.receipt, amount: result.amount, why })
  await alertStaff(db, {
    p_kind: 'payment_unmatched',
    p_subject: `M-Pesa payment ${result.receipt} was not accepted: ${why}. Check the till before the order is cancelled`,
    p_payload: { receipt: result.receipt, amount: result.amount, phone: result.phone, checkout_request_id: result.checkoutRequestId, payment_id: payment.id },
    p_order_id: payment.order_id,
  })
}

async function confirm(
  db: Db,
  paymentId: string,
  orderId: string,
  receipt: string | null,
  amount: number,
  raw: unknown,
  existingReference: string | null,
): Promise<CallbackOutcome> {
  const { data: before } = await db.from('orders').select('order_number, payment_status').eq('id', orderId).maybeSingle()
  const { data, error } = await db.rpc('confirm_payment', {
    p_payment_id: paymentId,
    // null (from an STK query) keeps the reference empty until the callback brings it
    p_transaction_reference: receipt as string,
    p_amount: amount,
    p_raw: (raw ?? null) as never,
  })
  if (error) throw new Error(`confirm_payment: ${error.message}`)
  const answer = (data as { status?: unknown } | null)?.status
  const status = CONFIRM_STATUSES.find((s) => s === answer)
  if (!status) throw new Error(`confirm_payment answered ${JSON.stringify(answer)}`)
  // The database says so itself (duplicate), decided under its lock. `before` covers a
  // database that has not had that migration yet.
  const duplicate = (data as { duplicate?: unknown }).duplicate === true || before?.payment_status === 'PAID'
  if (status === 'confirmed' && duplicate && before) {
    // The order was already paid by another attempt: the customer has paid twice.
    logger.error('mpesa.duplicate_payment', { paymentId, orderId, receipt, amount })
    await alertStaff(db, {
      p_kind: 'duplicate_payment',
      p_subject: `${before.order_number} was paid twice: refund ${receipt ?? 'the second payment'}`,
      p_payload: { order_number: before.order_number, receipt, amount },
      p_order_id: orderId,
    })
    return status
  }
  if (status === 'confirmed') {
    logger.info('mpesa.payment_confirmed', { paymentId, receipt })
    // confirm_payment() queued the receipt emails and the POS sale in the outbox; run them
    // after the response. (Dynamic import: the outbox worker itself imports this module
    // for the STK push.)
    background('outbox:payment_confirmed', async () => {
      const { runOutbox, runTaskNow } = await import('@/lib/outbox')
      await runTaskNow(orderId, 'payment_confirmed', () => notifyPaymentConfirmed(orderId))
      await runOutbox({ orderId, kinds: ['pos_sale'] })
    })
  }
  // Confirmed earlier by a status query: record the receipt once the callback brings it.
  if (status === 'already_paid' && receipt && !existingReference) {
    await db.from('payments').update({ transaction_reference: receipt }).eq('id', paymentId).is('transaction_reference', null)
  }
  return status
}

const IN_FLIGHT_MS = 90_000
const ATTEMPT_TIMEOUT_MS = 3 * 60_000
const EXPIRY_SWEEP_MS = 30_000
let lastExpirySweep = 0

export type PaymentView = {
  orderStatus: string
  paymentStatus: string
  state: 'paid' | 'pending' | 'failed' | 'expired' | 'none'
  message: string | null
}

/**
 * Current payment state for the order page. When a prompt has been pending for a
 * while without a callback, ask the provider (KCB has no status query and always
 * answers pending, so there the attempt simply times out after 3 minutes): still a
 * server-to-server verification, never the browser's word.
 */
export async function refreshPaymentStatus(orderId: string): Promise<PaymentView> {
  const db = createAdminClient()
  // Every open order page polls this; sweep expired orders at most once per interval
  // per server instead of once per poll (cron does the same sweep regardless).
  if (Date.now() - lastExpirySweep > EXPIRY_SWEEP_MS) {
    lastExpirySweep = Date.now()
    await db.rpc('expire_stale_orders')
  }
  const { data: order } = await db.from('orders').select('order_number, order_status, payment_status, total').eq('id', orderId).maybeSingle()
  if (!order) return { orderStatus: 'UNKNOWN', paymentStatus: 'UNKNOWN', state: 'none', message: null }

  const { data: latest } = await db
    .from('payments')
    .select('id, status, checkout_request_id, created_at, result_code, result_description, amount, transaction_reference')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  /** True when this call is the one that timed the attempt out (not one that found it already settled). */
  const timeOut = async (paymentId: string) => {
    const { data, error } = await db.rpc('fail_payment', { p_payment_id: paymentId, p_result_code: 'TIMEOUT', p_description: 'No response from M-Pesa', p_raw: { source: 'timeout' } as never })
    if (error) throw new Error(`fail_payment: ${error.message}`)
    return (data as { status?: unknown } | null)?.status === 'failed'
  }
  const age = latest ? Date.now() - new Date(latest.created_at).getTime() : 0
  // An attempt whose ids were never saved has no callback to wait for.
  if (order.payment_status !== 'PAID' && latest?.status === 'PENDING' && age > ATTEMPT_TIMEOUT_MS) {
    try {
      await timeOut(latest.id)
    } catch (error) {
      logger.warn('mpesa.timeout_failed', { paymentId: latest.id, error })
    }
  }
  if (order.payment_status !== 'PAID' && latest?.status === 'PROCESSING' && latest.checkout_request_id) {
    if (age > 15_000) {
      try {
        const provider = getMpesaProvider()
        const q = await provider.query(latest.checkout_request_id)
        if (q.state === 'success') {
          const receipt = provider.name === 'mpesa_mock' ? mockReceipt(latest.checkout_request_id) : null
          await confirm(db, latest.id, orderId, receipt, Number(latest.amount), { source: 'stk_query' }, latest.transaction_reference)
        } else if (q.state === 'failed') {
          const { error } = await db.rpc('fail_payment', { p_payment_id: latest.id, p_result_code: q.code, p_description: q.description, p_raw: { source: 'stk_query' } as never })
          if (error) throw new Error(`fail_payment: ${error.message}`)
        } else if (age > ATTEMPT_TIMEOUT_MS && (await timeOut(latest.id))) {
          // The prompt went out and no result ever came back, so the customer may have paid.
          // A cancelled prompt is ordinary; this needs someone to look at the till.
          logger.error('mpesa.no_callback', { paymentId: latest.id, orderNumber: order.order_number })
          await alertStaff(db, {
            p_kind: 'payment_no_callback',
            p_subject: `No answer from M-Pesa for ${order.order_number}: check the till before the order is cancelled`,
            p_payload: { order_number: order.order_number, amount: latest.amount, checkout_request_id: latest.checkout_request_id },
            p_order_id: orderId,
          })
        }
      } catch (error) {
        logger.warn('mpesa.query_failed', { paymentId: latest.id, error })
      }
      return refreshView(db, orderId)
    }
  }
  return refreshView(db, orderId)
}

async function refreshView(db: Db, orderId: string): Promise<PaymentView> {
  const [{ data: order }, { data: latest }] = await Promise.all([
    db.from('orders').select('order_status, payment_status').eq('id', orderId).single(),
    db.from('payments').select('status, result_code, result_description').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const o = order
  if (!o) return { orderStatus: 'UNKNOWN', paymentStatus: 'UNKNOWN', state: 'none', message: null }
  if (o.payment_status === 'PAID') return { orderStatus: o.order_status, paymentStatus: o.payment_status, state: 'paid', message: 'Payment received.' }
  if (o.order_status === 'FAILED' || o.order_status === 'CANCELLED') {
    return { orderStatus: o.order_status, paymentStatus: o.payment_status, state: 'expired', message: 'This order was not paid in time and has been cancelled.' }
  }
  if (latest?.status === 'PROCESSING' || latest?.status === 'PENDING') {
    return { orderStatus: o.order_status, paymentStatus: o.payment_status, state: 'pending', message: 'Waiting for you to enter your M-Pesa PIN…' }
  }
  if (latest?.status === 'FAILED' || latest?.status === 'CANCELLED') {
    return {
      orderStatus: o.order_status,
      paymentStatus: o.payment_status,
      state: 'failed',
      // Without a result code the description is our own error text, not for customers.
      message: describeResultCode(latest.result_code ?? '', latest.result_code ? (latest.result_description ?? undefined) : undefined),
    }
  }
  return { orderStatus: o.order_status, paymentStatus: o.payment_status, state: 'none', message: null }
}

/**
 * Cron: first settle STK pushes still awaiting a result (up to 25 a run; one older than
 * 3 minutes is timed out, for when nobody has the order page open), then mark unpaid orders
 * whose payment window has passed Failed and release their stock.
 */
export async function releaseExpiredReservations() {
  const db = createAdminClient()
  const { data: inFlight } = await db
    .from('payments')
    .select('order_id')
    .in('status', ['PENDING', 'PROCESSING'])
    .lt('created_at', new Date(Date.now() - 30_000).toISOString())
    .order('created_at')
    .limit(25)
  let reconciled = 0
  for (const orderId of new Set((inFlight ?? []).map((p) => p.order_id))) {
    try {
      await refreshPaymentStatus(orderId)
      reconciled++
    } catch (error) {
      logger.warn('mpesa.reconcile_failed', { orderId, error })
    }
  }
  const { data, error } = await db.rpc('expire_stale_orders')
  if (error) throw new Error(error.message)
  return { released: data ?? 0, reconciled }
}
