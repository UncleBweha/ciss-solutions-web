import 'server-only'
import { getSessionUser, can } from '@/lib/auth'
import { safeEqual } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Loads an order for the person viewing it: the owner, staff, or a guest holding
 * the order's access token (from the confirmation link / email).
 */
export async function getOrderForViewer(orderNumber: string, token?: string | null) {
  const db = createAdminClient()
  const { data: order } = await db
    .from('orders')
    .select(
      '*, items:order_items(id, product_id, product_name, variant_name, sku, image_url, quantity, unit_price, total_price), history:order_status_history(status, note, created_at)',
    )
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (!order) return null
  if (token && safeEqual(token, order.access_token)) return order
  const user = await getSessionUser()
  if (user && (order.user_id === user.id || can(user, 'orders.manage'))) return order
  return null
}

export type ViewerOrder = NonNullable<Awaited<ReturnType<typeof getOrderForViewer>>>
