import { AccountNav } from '@/components/account/account-nav'
import { requireUser, isStaff } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/account')
  return (
    <div className="container-page py-8">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <AccountNav name={user.fullName ?? user.email ?? 'Account'} staff={isStaff(user)} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
