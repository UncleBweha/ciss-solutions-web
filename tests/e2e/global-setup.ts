import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
  const db = createClient(url, key)
  await db.from('rate_limits').delete().neq('key', '')
  for (const customer of ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']) {
    const { data: wishlist } = await db.from('wishlists').select('id').eq('user_id', customer).maybeSingle()
    if (wishlist) await db.from('wishlist_items').delete().eq('wishlist_id', wishlist.id)
    const { data: cart } = await db.from('carts').select('id').eq('user_id', customer).maybeSingle()
    if (cart) await db.from('cart_items').delete().eq('cart_id', cart.id)
  }
  // Every checkout run buys stock; top up the products the tests purchase.
  await db.from('products').update({ stock_quantity: 50 }).in('sku', ['EPS-L3250', 'SP-RM2-5452', 'BRO-TN2420'])
}
