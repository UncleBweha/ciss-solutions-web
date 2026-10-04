import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

// Makes repeated local runs independent: clears rate-limit counters (the app's
// own abuse protection), the demo customer's wishlist and saved cart, and the
// stock of the products the tests buy.
export default async function globalSetup() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
  )
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  const db = createClient<Database>(url, key)
  await db.from('rate_limits').delete().neq('key', '')
  for (const customer of ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']) {
    const { data: wishlist } = await db.from('wishlists').select('id').eq('user_id', customer).maybeSingle()
    if (wishlist) await db.from('wishlist_items').delete().eq('wishlist_id', wishlist.id)
    const { data: cart } = await db.from('carts').select('id').eq('user_id', customer).maybeSingle()
    if (cart) await db.from('cart_items').delete().eq('cart_id', cart.id)
  }
  // Every checkout run buys stock; top up the products the tests purchase.
  await db.from('products').update({ stock_quantity: 50 }).in('sku', ['EPS-L3250', 'SP-RM2-5452', 'BRO-TN2420'])

  // The admin fulfilment test needs a paid order to process; create one on a fresh database.
  const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('order_status', 'PAID')
  if (!count) await createPaidOrder(db)
}

async function createPaidOrder(db: SupabaseClient<Database>) {
  const { data: product } = await db.from('products').select('id, name, sku, price').eq('sku', 'BRO-TN2420').single()
  if (!product) return
  const { data, error } = await db.rpc('place_order', {
    p_order: {
      customer_name: 'E2E Paid Order', customer_email: 'e2e@example.com', customer_phone: '254700000009',
      payment_method: 'mpesa', subtotal: product.price, total: product.price, delivery_zone_name: 'Nairobi',
      delivery_county: 'Nairobi', delivery_town: 'CBD', delivery_address: 'E2E fixture', reservation_minutes: 30,
      items: [{ product_id: product.id, product_name: product.name, sku: product.sku, quantity: 1, unit_price: product.price }],
    },
  })
  if (error) throw error
  const orderId = (data as { id: string }).id
  const { data: order } = await db.from('orders').select('total').eq('id', orderId).single()
  const { data: payment } = await db
    .from('payments')
    .insert({ order_id: orderId, method: 'mpesa', provider: 'mpesa_mock', status: 'PROCESSING', amount: order!.total, checkout_request_id: `ws_CO_E2E_${crypto.randomUUID()}` })
    .select('id')
    .single()
  await db.rpc('confirm_payment', { p_payment_id: payment!.id, p_transaction_reference: `E2E${Date.now().toString(36).toUpperCase()}`, p_amount: order!.total, p_raw: { source: 'e2e-setup' } })
}
