import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { loadEnv, supabaseReachable } from './setup'

// Outbox worker against the local database: tasks committed by place_order() are
// run once, emails are not duplicated on retry, and the STK push never repeats.
// Requires `npx supabase start` and MPESA_ENV=mock (the default in .env.local).
loadEnv()
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void Promise.resolve().then(fn) }))

const reachable = await supabaseReachable()
const run = reachable ? describe : describe.skip

run('outbox worker (integration)', () => {
  let db: Awaited<ReturnType<typeof import('@/lib/supabase/admin')['createAdminClient']>>
  let runOutbox: typeof import('@/lib/outbox')['runOutbox']
  let productId: string
  const created: string[] = []

  async function placeOrder(method: 'mpesa' | 'bank_transfer') {
    const { data, error } = await db.rpc('place_order', {
      p_order: {
        customer_name: 'Outbox IT', customer_email: 'outbox-it@example.com', customer_phone: '254700000009',
        payment_phone: '254700000008', payment_method: method, subtotal: 1000, total: 1000,
        delivery_zone_name: 'Nairobi', delivery_county: 'Nairobi', delivery_town: 'CBD', delivery_address: 'Test',
        reservation_minutes: 30,
        items: [{ product_id: productId, product_name: 'Outbox item', sku: 'OBX', quantity: 1, unit_price: 1000 }],
      },
    })
    if (error) throw error
    const id = (data as { id: string }).id
    created.push(id)
    return id
  }

  const sentEmails = async (orderId: string, kind: string) =>
    (await db.from('notifications').select('id').eq('order_id', orderId).eq('kind', kind).eq('status', 'sent')).data?.length ?? 0

  beforeAll(async () => {
    db = (await import('@/lib/supabase/admin')).createAdminClient()
    runOutbox = (await import('@/lib/outbox')).runOutbox
    const { data } = await db
      .from('products')
      .insert({ name: 'Outbox product', slug: `obx-${Date.now()}`, sku: `OBX-${Date.now()}`, price: 1000, stock_quantity: 10, status: 'active' })
      .select('id')
      .single()
    productId = data!.id
  })

  afterAll(async () => {
    if (created.length) await db.from('orders').delete().in('id', created)
    if (productId) await db.from('products').delete().eq('id', productId)
  })

  it('sends the order emails once, even if the task is run again', async () => {
    const orderId = await placeOrder('bank_transfer')
    const results = await runOutbox({ orderId, kinds: ['order_placed'] })
    expect(results).toEqual([expect.objectContaining({ kind: 'order_placed', outcome: 'done' })])
    expect(await sentEmails(orderId, 'order_confirmation')).toBe(1)

    // Simulate a crash after sending but before the task was marked done.
    await db.from('outbox').update({ status: 'pending', next_attempt_at: new Date().toISOString() }).eq('order_id', orderId)
    await runOutbox({ orderId, kinds: ['order_placed'] })
    expect(await sentEmails(orderId, 'order_confirmation')).toBe(1)
  })

  it('sends the STK push to the checkout M-Pesa number, and never twice', async () => {
    const orderId = await placeOrder('mpesa')
    const [stk] = await runOutbox({ orderId, kinds: ['mpesa_stk_push'] })
    expect(stk).toMatchObject({ kind: 'mpesa_stk_push', outcome: 'done' })
    expect(stk.message).toMatch(/check your phone/i)
    const { data: payments } = await db.from('payments').select('phone_number, status').eq('order_id', orderId)
    expect(payments).toEqual([{ phone_number: '254700000008', status: 'PROCESSING' }])

    // Re-running the task (e.g. the cron sweep after a crash) must not prompt again.
    await db.from('outbox').update({ status: 'pending', next_attempt_at: new Date().toISOString() }).eq('order_id', orderId).eq('kind', 'mpesa_stk_push')
    await runOutbox({ orderId, kinds: ['mpesa_stk_push'] })
    const { count } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    expect(count).toBe(1)
    const { data: task } = await db.from('outbox').select('status, last_error').eq('order_id', orderId).eq('kind', 'mpesa_stk_push').single()
    expect(task).toEqual({ status: 'done', last_error: 'skipped: payment already attempted' })
  })

  it('does not prompt for an STK push that is too old', async () => {
    const orderId = await placeOrder('mpesa')
    await db.from('outbox').update({ created_at: new Date(Date.now() - 15 * 60_000).toISOString() }).eq('order_id', orderId).eq('kind', 'mpesa_stk_push')
    await runOutbox({ orderId, kinds: ['mpesa_stk_push'] })
    const { count } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    expect(count).toBe(0)
  })

  it('the sweep picks up tasks nobody ran', async () => {
    const orderId = await placeOrder('bank_transfer')
    const results = await runOutbox({ limit: 50 })
    expect(results.some((r) => r.orderId === orderId && r.kind === 'order_placed' && r.outcome === 'done')).toBe(true)
  })
})
