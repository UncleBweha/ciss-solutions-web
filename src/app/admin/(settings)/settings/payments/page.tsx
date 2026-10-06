import { savePaymentsAction } from '@/actions/admin/settings'
import { AdminForm } from '@/components/admin/admin-form'
import { Panel } from '@/components/admin/admin-ui'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { readSettings } from '@/lib/admin/settings'
import { KENYA_COUNTIES } from '@/lib/ecommerce/kenya'
import { serverEnv } from '@/lib/server-env'
import type { PaymentMethodsSettings } from '@/types/catalog'

export const metadata = { title: 'Payment settings' }

export default async function PaymentSettings() {
  await requireStaff('payments.settings')
  const { payment_methods } = await readSettings<PaymentMethodsSettings>(['payment_methods'])
  const pm = payment_methods as unknown as PaymentMethodsSettings
  const m = serverEnv.mpesa
  return (
    <div className="grid max-w-5xl gap-4 xl:grid-cols-[1fr_20rem]">
      <Panel title="Payment methods">
        <AdminForm action={savePaymentsAction} className="space-y-5" submitLabel="Save payment settings">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Enabled at checkout</legend>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="mpesa" defaultChecked={pm?.mpesa?.enabled} /> M-Pesa (STK push)</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="mpesa_paybill" defaultChecked={pm?.mpesa_paybill?.enabled} /> M-Pesa Paybill (customer pays manually, staff mark the order paid)</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="bank_transfer" defaultChecked={pm?.bank_transfer?.enabled} /> Bank transfer</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="cash_on_delivery" defaultChecked={pm?.cash_on_delivery?.enabled} /> Cash on delivery</label>
            <p className="text-xs text-fg-muted">Card payments need a card gateway integration (e.g. Pesapal, Flutterwave) and are not enabled.</p>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold">M-Pesa Paybill details (shown at checkout and after ordering)</legend>
            <Field label="Paybill number" htmlFor="paybill_number" hint="Customers use their order number as the account number"><Input id="paybill_number" name="paybill_number" inputMode="numeric" defaultValue={pm?.mpesa_paybill?.paybill_number} /></Field>
            <Field label="Instructions" htmlFor="paybill_instructions" className="sm:col-span-2"><Textarea id="paybill_instructions" name="paybill_instructions" rows={2} className="min-h-0" defaultValue={pm?.mpesa_paybill?.instructions} /></Field>
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-semibold">Bank transfer details (shown after ordering)</legend>
            <Field label="Bank" htmlFor="bank_name"><Input id="bank_name" name="bank_name" defaultValue={pm?.bank_transfer?.bank_name} /></Field>
            <Field label="Branch" htmlFor="branch"><Input id="branch" name="branch" defaultValue={pm?.bank_transfer?.branch} /></Field>
            <Field label="Account name" htmlFor="account_name"><Input id="account_name" name="account_name" defaultValue={pm?.bank_transfer?.account_name} /></Field>
            <Field label="Account number" htmlFor="account_number"><Input id="account_number" name="account_number" defaultValue={pm?.bank_transfer?.account_number} /></Field>
            <Field label="Instructions" htmlFor="instructions" className="sm:col-span-2"><Textarea id="instructions" name="instructions" rows={2} className="min-h-0" defaultValue={pm?.bank_transfer?.instructions} /></Field>
          </fieldset>
          <Field label="Cash on delivery counties" htmlFor="cod_counties" hint="Ctrl/Cmd-click to select several. Empty = all counties.">
            <Select id="cod_counties" name="cod_counties" multiple className="h-40 bg-none py-2" defaultValue={pm?.cash_on_delivery?.counties ?? []}>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </AdminForm>
      </Panel>
      <Panel title="M-Pesa connection">
        <dl className="space-y-2 text-sm">
          <div><dt className="text-fg-muted">Environment</dt><dd className="font-semibold">{m.env}</dd></div>
          <div><dt className="text-fg-muted">Shortcode</dt><dd>{m.shortcode ?? 'not set'}</dd></div>
          <div><dt className="text-fg-muted">Transaction type</dt><dd>{m.transactionType}</dd></div>
          <div><dt className="text-fg-muted">Credentials</dt><dd>{m.consumerKey && m.consumerSecret && m.passkey ? 'Configured' : 'Missing'}</dd></div>
          <div><dt className="text-fg-muted">Callback URL</dt><dd className="break-all text-xs">{m.callbackUrl ?? 'not set'}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-fg-muted">Daraja credentials are server environment variables (never stored in the database or sent to browsers). See PAYMENTS.md.</p>
      </Panel>
    </div>
  )
}
