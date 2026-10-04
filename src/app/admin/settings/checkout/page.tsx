import { saveCheckoutAction, saveNotificationSettingsAction } from '@/actions/admin/settings'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { Field, Input, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { readSettings } from '@/lib/admin/settings'

export const metadata = { title: 'Checkout settings' }

export default async function CheckoutSettings() {
  await requireStaff('settings.manage')
  const s = await readSettings<Record<string, unknown>>(['checkout', 'seo', 'notifications'])
  const c = (s.checkout ?? {}) as Record<string, number>
  const seo = (s.seo ?? {}) as Record<string, string>
  const n = (s.notifications ?? {}) as { admin_emails?: string[] }
  return (
    <div className="grid max-w-5xl gap-4 xl:grid-cols-2">
      <Panel title="Checkout & SEO defaults">
        <AdminForm action={saveCheckoutAction} className="space-y-3">
          <Field label="M-Pesa payment window (minutes)" htmlFor="mpesa_reservation_minutes" hint="Stock is reserved this long while the customer pays">
            <Input id="mpesa_reservation_minutes" name="mpesa_reservation_minutes" type="number" defaultValue={c.mpesa_reservation_minutes ?? 30} />
          </Field>
          <Field label="Bank transfer reservation (minutes)" htmlFor="bank_transfer_reservation_minutes">
            <Input id="bank_transfer_reservation_minutes" name="bank_transfer_reservation_minutes" type="number" defaultValue={c.bank_transfer_reservation_minutes ?? 2880} />
          </Field>
          <Field label="Max quantity per item" htmlFor="max_quantity_per_item"><Input id="max_quantity_per_item" name="max_quantity_per_item" type="number" defaultValue={c.max_quantity_per_item ?? 20} /></Field>
          <Field label="Default page title" htmlFor="default_title"><Input id="default_title" name="default_title" defaultValue={seo.default_title} maxLength={70} /></Field>
          <Field label="Default meta description" htmlFor="default_description"><Textarea id="default_description" name="default_description" rows={2} className="min-h-0" defaultValue={seo.default_description} maxLength={170} /></Field>
        </AdminForm>
      </Panel>
      <Panel title="Staff email alerts">
        <AdminForm action={saveNotificationSettingsAction} className="space-y-3">
          <Field label="Admin alert emails" htmlFor="admin_emails" hint="New orders and payments. Comma-separated. (ADMIN_ALERT_EMAILS in the environment is used for delivery.)">
            <Textarea id="admin_emails" name="admin_emails" rows={3} defaultValue={(n.admin_emails ?? []).join(', ')} />
          </Field>
        </AdminForm>
      </Panel>
    </div>
  )
}
