import { AdminPageHeader } from '@/components/admin/admin-ui'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { can, requireStaff } from '@/lib/auth'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff()
  const tabs = [
    can(user, 'settings.manage') && { href: '/admin/settings', label: 'Business' },
    can(user, 'payments.settings') && { href: '/admin/settings/payments', label: 'Payments' },
    can(user, 'settings.manage') && { href: '/admin/settings/delivery', label: 'Delivery zones' },
    can(user, 'settings.manage') && { href: '/admin/settings/checkout', label: 'Checkout, SEO & alerts' },
    can(user, 'content.manage') && { href: '/admin/settings/pages', label: 'Content pages' },
    can(user, 'admins.manage') && { href: '/admin/settings/staff', label: 'Staff & roles' },
  ].filter((t): t is { href: string; label: string } => Boolean(t))
  return (
    <div>
      <AdminPageHeader title="Settings" description="Business details, payments, delivery and staff. Nothing here is hard-coded in the storefront." />
      <SettingsTabs tabs={tabs} />
      {children}
    </div>
  )
}
