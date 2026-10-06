import type { Metadata } from 'next'
import { AvatarForm } from '@/components/account/avatar-form'
import { ProfileForm } from '@/components/account/profile-form'
import { UpdatePasswordForm } from '@/components/account/auth-forms'
import { requireUser } from '@/lib/auth'
import { localKenyanPhone } from '@/lib/ecommerce/kenya'

export const metadata: Metadata = { title: 'Profile', robots: { index: false } }

export default async function ProfilePage() {
  const user = await requireUser('/account/profile')
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Profile & password</h1>
      <section className="glass-flat max-w-xl rounded-[var(--radius-card)] p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Your details</h2>
        <AvatarForm avatarUrl={user.avatarUrl} name={user.fullName ?? user.email ?? ''} uploaded={user.hasUploadedAvatar} />
        <p className="mb-4 text-sm text-fg-muted">Email: {user.email}</p>
        <ProfileForm fullName={user.fullName ?? ''} phone={user.phone ? localKenyanPhone(user.phone) : ''} />
      </section>
      <section className="glass-flat max-w-xl rounded-[var(--radius-card)] p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Change password</h2>
        <UpdatePasswordForm />
      </section>
    </div>
  )
}
