'use server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { quoteCart, type Quote } from '@/lib/ecommerce/quote'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { cartItemsSchema, type CartItemInput } from '@/lib/validation/cart'

const quoteOptions = z.object({
  county: z.string().max(60).nullish(),
  couponCode: z.string().max(40).nullish(),
})

/** Authoritative prices, stock and totals for the cart (server-side). */
export async function quoteCartAction(items: CartItemInput[], options: z.input<typeof quoteOptions> = {}): Promise<Quote> {
  const parsed = cartItemsSchema.parse(items)
  const opts = quoteOptions.parse(options)
  const user = await getSessionUser()
  return quoteCart(parsed, { ...opts, customer: { userId: user?.id, email: user?.email } })
}

function mergeItems(a: CartItemInput[], b: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, CartItemInput>()
  for (const item of [...a, ...b]) {
    const key = `${item.productId}:${item.variantId ?? ''}`
    const existing = merged.get(key)
    merged.set(key, existing ? { ...item, quantity: Math.min(99, Math.max(existing.quantity, item.quantity)) } : item)
  }
  return [...merged.values()]
}

async function getOrCreateCartId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('carts').select('id').eq('user_id', userId).maybeSingle()
  if (data) return { supabase, cartId: data.id }
  const { data: created, error } = await supabase.from('carts').insert({ user_id: userId }).select('id').single()
  if (error) throw new Error(error.message)
  return { supabase, cartId: created.id }
}

/**
 * Called when the storefront loads for a signed-in user: merges the guest cart
 * (from this browser) into the account cart and returns the merged result.
 * Returns null for guests, who keep using the local cart.
 */
export async function syncCartAction(localItems: CartItemInput[]): Promise<CartItemInput[] | null> {
  const user = await getSessionUser()
  if (!user) return null
  const local = cartItemsSchema.parse(localItems)
  try {
    const { supabase, cartId } = await getOrCreateCartId(user.id)
    const { data: rows } = await supabase.from('cart_items').select('product_id, variant_id, quantity').eq('cart_id', cartId)
    const remote = (rows ?? []).map((r) => ({ productId: r.product_id, variantId: r.variant_id, quantity: r.quantity }))
    const merged = mergeItems(remote, local)
    if (local.length) await writeCart(supabase, cartId, merged)
    return merged
  } catch (error) {
    logger.error('cart.sync_failed', { userId: user.id, error })
    return null
  }
}

async function writeCart(supabase: Awaited<ReturnType<typeof createClient>>, cartId: string, items: CartItemInput[]) {
  await supabase.from('cart_items').delete().eq('cart_id', cartId)
  if (items.length) {
    const { error } = await supabase.from('cart_items').insert(
      items.map((i) => ({ cart_id: cartId, product_id: i.productId, variant_id: i.variantId, quantity: i.quantity })),
    )
    if (error) throw new Error(error.message)
  }
}

/** Persists the signed-in user's cart (no-op for guests). */
export async function saveCartAction(items: CartItemInput[]): Promise<void> {
  const user = await getSessionUser()
  if (!user) return
  const parsed = cartItemsSchema.parse(items)
  try {
    const { supabase, cartId } = await getOrCreateCartId(user.id)
    await writeCart(supabase, cartId, parsed)
  } catch (error) {
    logger.error('cart.save_failed', { userId: user.id, error })
  }
}
