import type { Metadata } from 'next'
import { AdminShell, type AdminNavItem } from '@/components/admin/admin-shell'
import { can, requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | CISS Admin' }, robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const supabase = await createClient()
  const [{ count: unread }, { count: openSupport }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('channel', 'admin').is('read_at', null),
    can(user, 'support.manage') ? supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open') : Promise.resolve({ count: 0 }),
  ])

  const products = can(user, 'products.manage')
  const catalog = can(user, 'catalog.manage')
  const settingsHref =
    (can(user, 'settings.manage') && '/admin/settings') ||
    (can(user, 'payments.settings') && '/admin/settings/payments') ||
    (can(user, 'content.manage') && '/admin/homepage') ||
    '/admin/settings/staff'
  // One entry per area; related pages are tabs inside it (see the route-group layouts).
  const all: (AdminNavItem & { allowed: boolean })[] = [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard', match: ['/admin/reports'], allowed: true },
    { href: '/admin/orders', label: 'Orders', icon: 'orders', allowed: can(user, 'orders.manage') },
    {
      href: products ? '/admin/products' : '/admin/inventory',
      label: 'Products',
      icon: 'products',
      match: ['/admin/products', '/admin/inventory'],
      allowed: products || can(user, 'inventory.manage'),
    },
    {
      href: catalog ? '/admin/categories' : '/admin/printer-models',
      label: 'Catalog',
      icon: 'categories',
      match: ['/admin/categories', '/admin/brands', '/admin/printer-models'],
      allowed: catalog || products,
    },
    { href: '/admin/customers', label: 'Customers', icon: 'customers', allowed: can(user, 'customers.view') },
    { href: '/admin/support', label: 'Support requests', icon: 'support', allowed: can(user, 'support.manage'), badge: openSupport ?? 0 },
    {
      href: settingsHref,
      label: 'Settings',
      icon: 'settings',
      match: ['/admin/settings', '/admin/homepage'],
      allowed: can(user, 'settings.manage') || can(user, 'payments.settings') || can(user, 'admins.manage') || can(user, 'content.manage'),
    },
  ]
  return (
    <AdminShell nav={all.filter((i) => i.allowed).map(({ allowed: _a, ...i }) => (void _a, i))} user={{ name: user.fullName ?? user.email ?? 'Staff', role: user.role }} unread={unread ?? 0}>
      {children}
    </AdminShell>
  )
}
