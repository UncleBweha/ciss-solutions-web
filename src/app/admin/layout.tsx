import type { Metadata } from 'next'
import { AdminShell, type AdminNavItem } from '@/components/admin/admin-shell'
import { can, requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | CISS Admin' }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const supabase = await createClient()
  const [{ count: unread }, { count: pendingReviews }, { count: openSupport }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('channel', 'admin').is('read_at', null),
    can(user, 'reviews.moderate') ? supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending') : Promise.resolve({ count: 0 }),
    can(user, 'support.manage') ? supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open') : Promise.resolve({ count: 0 }),
  ])

  const all: (AdminNavItem & { allowed: boolean })[] = [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard', allowed: true },
    { href: '/admin/orders', label: 'Orders', icon: 'orders', allowed: can(user, 'orders.manage') },
    { href: '/admin/products', label: 'Products', icon: 'products', allowed: can(user, 'products.manage') },
    { href: '/admin/inventory', label: 'Inventory', icon: 'inventory', allowed: can(user, 'inventory.manage') },
    { href: '/admin/categories', label: 'Categories', icon: 'categories', allowed: can(user, 'catalog.manage') },
    { href: '/admin/brands', label: 'Brands', icon: 'brands', allowed: can(user, 'catalog.manage') },
    { href: '/admin/printer-models', label: 'Printer models', icon: 'printers', allowed: can(user, 'catalog.manage') || can(user, 'products.manage') },
    { href: '/admin/customers', label: 'Customers', icon: 'customers', allowed: can(user, 'customers.view') },
    { href: '/admin/coupons', label: 'Coupons', icon: 'coupons', allowed: can(user, 'coupons.manage') },
    { href: '/admin/homepage', label: 'Homepage', icon: 'homepage', allowed: can(user, 'content.manage') },
    { href: '/admin/reviews', label: 'Reviews', icon: 'reviews', allowed: can(user, 'reviews.moderate'), badge: pendingReviews ?? 0 },
    { href: '/admin/support', label: 'Support requests', icon: 'support', allowed: can(user, 'support.manage'), badge: openSupport ?? 0 },
    { href: '/admin/reports', label: 'Reports', icon: 'reports', allowed: can(user, 'reports.view') },
    {
      href: '/admin/settings',
      label: 'Settings',
      icon: 'settings',
      allowed: can(user, 'settings.manage') || can(user, 'payments.settings') || can(user, 'admins.manage') || can(user, 'content.manage'),
    },
  ]
  return (
    <AdminShell nav={all.filter((i) => i.allowed).map(({ allowed: _a, ...i }) => (void _a, i))} user={{ name: user.fullName ?? user.email ?? 'Staff', role: user.role }} unread={unread ?? 0}>
      {children}
    </AdminShell>
  )
}
