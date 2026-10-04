import 'server-only'
import { logger } from '@/lib/logger'
import { background, notifyPaymentConfirmed } from '@/lib/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { describeResultCode, parseStkCallback } from './mpesa-result'
import { mockReceipt } from './mock'
import { getMpesaProvider } from './provider'
import { PaymentError } from './types'

// Payment orchestration. The browser only ever *asks* for status; whether an order
// is paid is decided here, from Safaricom's callback or Safaricom's query API,
// and committed by the confirm_payment() database function (idempotent).

type Db = ReturnType<typeof createAdminClient>

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

  // A prompt still in flight must finish (or fail) before another one is sent.
  const { data: inflight } = await db
    .from('payments')
    .select('id, created_at')
    .eq('order_id', orderId)
    .eq('status', 'PROCESSING')
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
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

  try {
    const stk = await provider.initiate({ amount, phone, reference: order.order_number.replace(/^CISS-/, ''), description: 'CISS order' })
    await db
      .from('payments')
      .update({ status: 'PROCESSING', merchant_request_id: stk.merchantRequestId, checkout_request_id: stk.checkoutRequestId })
      .eq('id', payment.id)
    await db.from('orders').update({ payment_status: 'PROCESSING' }).eq('id', orderId).neq('payment_status', 'PAID')
    logger.info('mpesa.stk_sent', { orderNumber: order.order_number, paymentId: payment.id, provider: provider.name })
    return { ok: true, paymentId: payment.id, message: 'Check your phone and enter your M-Pesa PIN to complete payment.' }
  } catch (e) {
    const message = e instanceof PaymentError ? e.customerMessage : 'We could not reach M-Pesa. Please try again.'
    await db.from('payments').update({ status: 'FAILED', result_description: (e as Error).message.slice(0, 500) }).eq('id', payment.id)
    logger.error('mpesa.stk_failed', { orderNumber: order.order_number, error: e })
    return { ok: false, message }
  }
}

export type CallbackOutcome = 'confirmed' | 'already_paid' | 'failed' | 'amount_mismatch' | 'unknown_payment' | 'invalid'

/** Processes a Daraja STK callback. Safe to call repeatedly with the same payload. */
export async function handleStkCallback(payload: unknown): Promise<CallbackOutcome> {
  const result = parseStkCallback(payload)
  if (!result) {
    logger.warn('mpesa.callback_invalid', { payload })
    return 'invalid'
  }
  const db = createAdminClient()
  const { data: payment } = await db
    .from('payments')
    .select('id, order_id, amount, merchant_request_id, transaction_reference, status')
    .eq('checkout_request_id', result.checkoutRequestId)
    .maybeSingle()
  if (!payment) {
    logger.warn('mpesa.callback_unknown_payment', { checkoutRequestId: result.checkoutRequestId })
    return 'unknown_payment'
  }
  if (payment.merchant_request_id && payment.merchant_request_id !== result.merchantRequestId) {
    logger.warn('mpesa.callback_mismatched_request', { paymentId: payment.id })
    return 'invalid'
  }

  if (result.kind === 'failure') {
    await db.rpc('fail_payment', {
      p_payment_id: payment.id,
      p_result_code: result.code,
      p_description: result.description,
      p_raw: payload as never,
    })
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
    return 'invalid'
  }

  return confirm(db, payment.id, payment.order_id, result.receipt, result.amount, payload, payment.transaction_reference)
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
  const { data, error } = await db.rpc('confirm_payment', {
    p_payment_id: paymentId,
    // null (from an STK query) keeps the reference empty until the callback brings it
    p_transaction_reference: receipt as string,
    p_amount: amount,
    p_raw: (raw ?? null) as never,
  })
  if (error) throw new Error(`confirm_payment: ${error.message}`)
  const status = (data as { status: string }).status as CallbackOutcome
  if (status === 'confirmed') {
    logger.info('mpesa.payment_confirmed', { paymentId, receipt })
    background('payment_confirmed', () => notifyPaymentConfirmed(orderId))
  }
  // Confirmed earlier by a status query: record the receipt once the callback brings it.
  if (status === 'already_paid' && receipt && !existingReference) {
    await db.from('payments').update({ transaction_reference: receipt }).eq('id', paymentId).is('transaction_reference', null)
  }
  return status
}

export type PaymentView = {
  orderStatus: string
  paymentStatus: string
  state: 'paid' | 'pending' | 'failed' | 'expired' | 'none'
  message: string | null
}

/**
 * Current payment state for the order page. When a prompt has been pending for a
 * while without a callback, ask Safaricom directly (STK query): still a
 * server-to-server verification, never the browser's word.
 */
export async function refreshPaymentStatus(orderId: string): Promise<PaymentView> {
  const db = createAdminClient()
  await db.rpc('expire_stale_orders')
  const { data: order } = await db.from('orders').select('order_status, payment_status, total').eq('id', orderId).maybeSingle()
  if (!order) return { orderStatus: 'UNKNOWN', paymentStatus: 'UNKNOWN', state: 'none', message: null }

  const { data: latest } = await db
    .from('payments')
    .select('id, status, checkout_request_id, created_at, result_code, result_description, amount, transaction_reference')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (order.payment_status !== 'PAID' && latest?.status === 'PROCESSING' && latest.checkout_request_id) {
    const age = Date.now() - new Date(latest.created_at).getTime()
    if (age > 15_000) {
      try {
        const provider = getMpesaProvider()
        const q = await provider.query(latest.checkout_request_id)
        if (q.state === 'success') {
          const receipt = provider.name === 'mpesa_mock' ? mockReceipt(latest.checkout_request_id) : null
          await confirm(db, latest.id, orderId, receipt, Number(latest.amount), { source: 'stk_query' }, latest.transaction_reference)
        } else if (q.state === 'failed') {
          await db.rpc('fail_payment', { p_payment_id: latest.id, p_result_code: q.code, p_description: q.description, p_raw: { source: 'stk_query' } as never })
        } else if (age > 3 * 60_000) {
          await db.rpc('fail_payment', { p_payment_id: latest.id, p_result_code: '1019', p_description: 'No response from M-Pesa', p_raw: { source: 'timeout' } as never })
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
  const o = order!
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
      message: describeResultCode(latest.result_code ?? '', latest.result_description ?? undefined),
    }
  }
  return { orderStatus: o.order_status, paymentStatus: o.payment_status, state: 'none', message: null }
}

export async function releaseExpiredReservations() {
  const { data, error } = await createAdminClient().rpc('expire_stale_orders')
  if (error) throw new Error(error.message)
  return data ?? 0
}
