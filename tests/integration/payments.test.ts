import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { loadEnv, supabaseReachable } from './setup'

// Payment callback processing against the real local database: the same code
// path Safaricom's callback takes (minus HTTP). Requires `npx supabase start`.
loadEnv()
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void Promise.resolve().then(fn) }))

const reachable = await supabaseReachable()
const run = reachable ? describe : describe.skip

run('M-Pesa callback processing (integration)', () => {
  let db: Awaited<ReturnType<typeof import('@/lib/supabase/admin')['createAdminClient']>>
  let handleStkCallback: typeof import('@/lib/payments/service')['handleStkCallback']
  let productId: string
  const created: string[] = []

  async function newOrder(total: number, quantity = 1) {
    const { data, error } = await db.rpc('place_order', {
      p_order: {
        customer_name: 'Integration Test', customer_email: 'it@example.com', customer_phone: '254700000009',
        payment_method: 'mpesa', subtotal: total, total, delivery_zone_name: 'Nairobi', delivery_county: 'Nairobi',
        delivery_town: 'CBD', delivery_address: 'Test', reservation_minutes: 30,
        items: [{ product_id: productId, product_name: 'Test item', sku: 'IT', quantity, unit_price: total / quantity }],
      },
    })
    if (error) throw error
    const order = data as { id: string; order_number: string }
    created.push(order.id)
    const checkoutRequestId = `ws_CO_IT_${crypto.randomUUID()}`
    const { data: payment } = await db
      .from('payments')
      .insert({ order_id: order.id, method: 'mpesa', provider: 'mpesa_daraja', status: 'PROCESSING', amount: total, merchant_request_id: 'MR-IT', checkout_request_id: checkoutRequestId })
      .select('id')
      .single()
    return { orderId: order.id, paymentId: payment!.id, checkoutRequestId }
  }

  const success = (checkoutRequestId: string, amount: number, receipt: string) => ({
    Body: {
      stkCallback: {
        MerchantRequestID: 'MR-IT', CheckoutRequestID: checkoutRequestId, ResultCode: 0, ResultDesc: 'Success',
        CallbackMetadata: { Item: [{ Name: 'Amount', Value: amount }, { Name: 'MpesaReceiptNumber', Value: receipt }, { Name: 'PhoneNumber', Value: 254700000009 }] },
      },
    },
  })

  beforeAll(async () => {
    db = (await import('@/lib/supabase/admin')).createAdminClient()
    handleStkCallback = (await import('@/lib/payments/service')).handleStkCallback
    const { data } = await db.from('products').insert({ name: 'Integration product', slug: `it-${Date.now()}`, sku: `IT-${Date.now()}`, price: 1000, stock_quantity: 10, status: 'active' }).select('id').single()
    productId = data!.id
  })

  afterAll(async () => {
    if (created.length) await db.from('orders').delete().in('id', created)
    if (productId) await db.from('products').delete().eq('id', productId)
  })

  it('confirms a valid payment once, deducting reserved stock exactly once', async () => {
    const { orderId, checkoutRequestId } = await newOrder(2000, 2)
    const receipt = `IT${Date.now().toString(36).toUpperCase()}`
    expect(await handleStkCallback(success(checkoutRequestId, 2000, receipt))).toBe('confirmed')
    expect(await handleStkCallback(success(checkoutRequestId, 2000, receipt))).toBe('already_paid')

    const { data: order } = await db.from('orders').select('order_status, payment_status, stock_state').eq('id', orderId).single()
    expect(order).toEqual({ order_status: 'PAID', payment_status: 'PAID', stock_state: 'deducted' })
    const { data: product } = await db.from('products').select('stock_quantity, reserved_quantity').eq('id', productId).single()
    expect(product).toEqual({ stock_quantity: 8, reserved_quantity: 0 })
  })

  it('rejects an underpayment', async () => {
    const { orderId, checkoutRequestId } = await newOrder(1000)
    expect(await handleStkCallback(success(checkoutRequestId, 1, `IT${Date.now().toString(36)}X`))).toBe('amount_mismatch')
    const { data: order } = await db.from('orders').select('payment_status').eq('id', orderId).single()
    expect(order?.payment_status).not.toBe('PAID')
  })

  it('refuses to reuse a receipt for a different payment', async () => {
    const a = await newOrder(1000)
    const b = await newOrder(1000)
    const receipt = `IT${Date.now().toString(36).toUpperCase()}R`
    expect(await handleStkCallback(success(a.checkoutRequestId, 1000, receipt))).toBe('confirmed')
    expect(await handleStkCallback(success(b.checkoutRequestId, 1000, receipt))).toBe('invalid')
    const { data } = await db.from('orders').select('payment_status').eq('id', b.orderId).single()
    expect(data?.payment_status).not.toBe('PAID')
  })

  it('records failures (cancelled by user) without paying the order', async () => {
    const { orderId, paymentId, checkoutRequestId } = await newOrder(1000)
    const failed = { Body: { stkCallback: { MerchantRequestID: 'MR-IT', CheckoutRequestID: checkoutRequestId, ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } }
    expect(await handleStkCallback(failed)).toBe('failed')
    const { data: payment } = await db.from('payments').select('status, result_code').eq('id', paymentId).single()
    expect(payment).toEqual({ status: 'CANCELLED', result_code: '1032' })
    const { data: order } = await db.from('orders').select('order_status, stock_state').eq('id', orderId).single()
    expect(order).toEqual({ order_status: 'PAYMENT_PENDING', stock_state: 'reserved' }) // customer can retry
  })

  it('ignores unknown, mismatched and malformed callbacks', async () => {
    expect(await handleStkCallback(success('ws_CO_does_not_exist', 1000, 'NOPE123'))).toBe('unknown_payment')
    const { checkoutRequestId } = await newOrder(1000)
    const forged = success(checkoutRequestId, 1000, 'FORGED1')
    forged.Body.stkCallback.MerchantRequestID = 'SOMETHING-ELSE'
    expect(await handleStkCallback(forged)).toBe('invalid')
    expect(await handleStkCallback({ hello: 'world' })).toBe('invalid')
  })

  it('cron reconciles a payment whose callback never arrived (STK query)', async () => {
    const { orderId, paymentId } = await newOrder(1000)
    // Mock-format request id from a minute ago; the mock answers "success" for this phone.
    const sentAt = Date.now() - 60_000
    await db
      .from('payments')
      .update({ provider: 'mpesa_mock', checkout_request_id: `ws_CO_MOCK_${sentAt}_254700000009_1000`, created_at: new Date(sentAt).toISOString() })
      .eq('id', paymentId)

    const { releaseExpiredReservations } = await import('@/lib/payments/service')
    const result = await releaseExpiredReservations()
    expect(result.reconciled).toBeGreaterThanOrEqual(1)

    const { data: order } = await db.from('orders').select('order_status, payment_status').eq('id', orderId).single()
    expect(order).toEqual({ order_status: 'PAID', payment_status: 'PAID' })
  })
})
