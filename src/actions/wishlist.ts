'use server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const ids = z.array(z.string().uuid()).max(200)

async function wishlistId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('wishlists').select('id').eq('user_id', userId).maybeSingle()
  if (data) return { supabase, id: data.id }
  const { data: created, error } = await supabase.from('wishlists').insert({ user_id: userId }).select('id').single()
  if (error) throw new Error(error.message)
  return { supabase, id: created.id }
}

/** Merges this browser's saved items into the account wishlist; null for guests. */
export async function syncWishlistAction(localIds: string[]): Promise<string[] | null> {
  const user = await getSessionUser()
  if (!user) return null
  const local = ids.parse(localIds)
  const { supabase, id } = await wishlistId(user.id)
  if (local.length) {
    await supabase
      .from('wishlist_items')
      .upsert(local.map((product_id) => ({ wishlist_id: id, product_id })), { onConflict: 'wishlist_id,product_id', ignoreDuplicates: true })
  }
  const { data } = await supabase.from('wishlist_items').select('product_id').eq('wishlist_id', id)
  return (data ?? []).map((r) => r.product_id)
}

/** Idempotent: sets whether the product is in the wishlist (safe with stale client state). */
export async function setWishlistAction(productId: string, saved: boolean): Promise<{ saved: boolean } | { error: 'auth' }> {
  const user = await getSessionUser()
  if (!user) return { error: 'auth' }
  const pid = z.string().uuid().parse(productId)
  const { supabase, id } = await wishlistId(user.id)
  if (saved) {
    await supabase.from('wishlist_items').upsert({ wishlist_id: id, product_id: pid }, { onConflict: 'wishlist_id,product_id', ignoreDuplicates: true })
  } else {
    await supabase.from('wishlist_items').delete().eq('wishlist_id', id).eq('product_id', pid)
  }
  return { saved }
}
