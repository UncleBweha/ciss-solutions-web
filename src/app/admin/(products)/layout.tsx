import { AdminTabs } from '@/components/admin/admin-tabs'
import { can, requireStaff } from '@/lib/auth'

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const tabs = [
    can(user, 'products.manage') && { href: '/admin/products', label: 'Products' },
    can(user, 'inventory.manage') && { href: '/admin/inventory', label: 'Stock' },
  ].filter((t): t is { href: string; label: string } => Boolean(t))
  return (
    <>
      <AdminTabs tabs={tabs} label="Product sections" />
      {children}
    </>
  )
}
