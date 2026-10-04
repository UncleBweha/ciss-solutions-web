import type { Metadata } from 'next'
import { OrderList, type AccountOrder } from '@/components/account/order-list'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My orders', robots: { index: false } }

export default async function AccountOrdersPage() {
  const user = await requireUser('/account/orders')
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, created_at, total, order_status, payment_status, items:order_items(product_id, variant_id, product_name, quantity)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">My orders</h1>
      <OrderList orders={(data ?? []).map((o) => ({ ...o, total: Number(o.total) })) as AccountOrder[]} />
    </div>
  )
}
