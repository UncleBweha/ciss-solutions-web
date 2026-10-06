import { AdminTabs } from '@/components/admin/admin-tabs'
import { can, requireStaff } from '@/lib/auth'

export default async function OverviewLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const tabs = [{ href: '/admin', label: 'Overview' }, ...(can(user, 'reports.view') ? [{ href: '/admin/reports', label: 'Reports' }] : [])]
  return (
    <>
      <AdminTabs tabs={tabs} label="Dashboard sections" />
      {children}
    </>
  )
}
