import { saveBusinessAction } from '@/actions/admin/settings'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { Field, Input } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { readSettings } from '@/lib/admin/settings'

export const metadata = { title: 'Business settings' }

export default async function BusinessSettings() {
  await requireStaff('settings.manage')
  const { business = {} } = await readSettings<Record<string, string> & { socials?: Record<string, string> }>(['business'])
  const b = business as Record<string, string> & { socials?: Record<string, string> }
  const f = (name: string, label: string, hint?: string, type = 'text') => (
    <Field label={label} htmlFor={name} hint={hint}><Input id={name} name={name} type={type} defaultValue={b[name] ?? ''} /></Field>
  )
  return (
    <Panel title="Business information" className="max-w-4xl">
      <AdminForm action={saveBusinessAction} className="grid gap-4 sm:grid-cols-2" submitLabel="Save business details">
        {f('name', 'Business name')}
        {f('tagline', 'Tagline')}
        {f('phone', 'Phone', 'Shown in the footer and contact page')}
        {f('whatsapp', 'WhatsApp number', 'Digits with country code, e.g. 254712345678')}
        {f('email', 'Email', undefined, 'email')}
        {f('business_hours', 'Business hours')}
        {f('location', 'Location (town)')}
        {f('address', 'Physical address')}
        {f('mpesa_paybill', 'M-Pesa Paybill / Till (display only)', 'The STK push uses the server configuration')}
        {f('mpesa_account_hint', 'M-Pesa account reference hint')}
        <Field label="Instagram URL" htmlFor="instagram"><Input id="instagram" name="instagram" defaultValue={b.socials?.instagram ?? ''} /></Field>
        <Field label="Facebook URL" htmlFor="facebook"><Input id="facebook" name="facebook" defaultValue={b.socials?.facebook ?? ''} /></Field>
        <Field label="TikTok URL" htmlFor="tiktok"><Input id="tiktok" name="tiktok" defaultValue={b.socials?.tiktok ?? ''} /></Field>
        <Field label="YouTube URL" htmlFor="youtube"><Input id="youtube" name="youtube" defaultValue={b.socials?.youtube ?? ''} /></Field>
      </AdminForm>
    </Panel>
  )
}
