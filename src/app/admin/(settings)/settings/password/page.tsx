import { changeOwnPasswordAction } from '@/actions/admin/account'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { Field, Input } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'

export const metadata = { title: 'My password' }

export default async function PasswordSettings() {
  const user = await requireStaff()
  return (
    <div className="max-w-xl">
      <Panel title="Change your password">
        <p className="mb-4 text-sm text-fg-secondary">
          Signed in as <strong className="text-fg">{user.email}</strong>. You stay signed in on this device after changing it.
        </p>
        <AdminForm action={changeOwnPasswordAction} className="space-y-4" submitLabel="Change password" resetOnSuccess>
          <Field label="Current password" htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" htmlFor="password" hint="At least 8 characters">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
        </AdminForm>
      </Panel>
    </div>
  )
}
