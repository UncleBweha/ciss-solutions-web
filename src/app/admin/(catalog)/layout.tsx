import { AdminTabs } from '@/components/admin/admin-tabs'
import { can, requireStaff } from '@/lib/auth'

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const catalog = can(user, 'catalog.manage')
  const tabs = [
    catalog && { href: '/admin/categories', label: 'Categories' },
    catalog && { href: '/admin/brands', label: 'Brands' },
    (catalog || can(user, 'products.manage')) && { href: '/admin/printer-models', label: 'Printer models' },
  ].filter((t): t is { href: string; label: string } => Boolean(t))
  return (
    <>
      <AdminTabs tabs={tabs} label="Catalog sections" />
      {children}
    </>
  )
}
