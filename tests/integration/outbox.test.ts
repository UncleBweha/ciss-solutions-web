import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { loadEnv, supabaseReachable } from './setup'

// Outbox worker against the local database: tasks committed by place_order() are
// run once, and emails are not duplicated on retry. Requires `npx supabase start`.
loadEnv()
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void Promise.resolve().then(fn) }))

const reachable = await supabaseReachable()
const run = reachable ? describe : describe.skip

run('outbox worker (integration)', () => {
  let db: Awaited<ReturnType<typeof import('@/lib/supabase/admin')['createAdminClient']>>
  let runOutbox: typeof import('@/lib/outbox')['runOutbox']
  let productId: string
  const created: string[] = []

  async function placeOrder(method: 'bank_transfer' | 'cash_on_delivery') {
    const { data, error } = await db.rpc('place_order', {
      p_order: {
        customer_name: 'Outbox IT', customer_email: 'outbox-it@example.com', customer_phone: '254700000009',
        payment_method: method, subtotal: 1000, total: 1000,
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

  it('the sweep picks up tasks nobody ran', async () => {
    const orderId = await placeOrder('bank_transfer')
    const results = await runOutbox({ limit: 50 })
    expect(results.some((r) => r.orderId === orderId && r.kind === 'order_placed' && r.outcome === 'done')).toBe(true)
  })
})
