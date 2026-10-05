import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, MapPin, Package } from 'lucide-react'
import { OrderList, type AccountOrder } from '@/components/account/order-list'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My account', robots: { index: false } }

export default async function AccountPage() {
  const user = await requireUser()
  // Staff have no orders of their own; their home is the admin dashboard.
  if (user && user.role !== 'customer') redirect('/admin')
  const supabase = await createClient()
  const [{ data: orders, count }, { count: wishCount }, { count: addressCount }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, created_at, total, order_status, payment_status, items:order_items(product_id, variant_id, product_name, quantity)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase.from('wishlist_items').select('id, wishlists!inner(user_id)', { count: 'exact', head: true }).eq('wishlists.user_id', user.id),
    supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])
  const stats = [
    { label: 'Orders', value: count ?? 0, href: '/account/orders', icon: Package },
    { label: 'Wishlist', value: wishCount ?? 0, href: '/account/wishlist', icon: Heart },
    { label: 'Addresses', value: addressCount ?? 0, href: '/account/addresses', icon: MapPin },
  ]
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Hello{user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="glass-flat flex items-center gap-4 rounded-[var(--radius-card)] p-5 hover:border-primary/50">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-primary/15 text-primary-light">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-bold">{value}</span>
              <span className="text-sm text-fg-muted">{label}</span>
            </span>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm font-semibold text-primary-light">
            All orders →
          </Link>
        </div>
        <OrderList orders={(orders ?? []).map((o) => ({ ...o, total: Number(o.total) })) as AccountOrder[]} />
      </section>
    </div>
  )
}
