import Link from 'next/link'
import { deleteZoneAction, saveZoneAction } from '@/actions/admin/settings'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { deliveryEstimate } from '@/lib/ecommerce/delivery'
import { KENYA_COUNTIES } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { createClient } from '@/lib/supabase/server'
import { param } from '@/lib/utils'

export const metadata = { title: 'Delivery zones' }

export default async function DeliverySettings({ searchParams }: PageProps<'/admin/settings/delivery'>) {
  await requireStaff('settings.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const { data: zones } = await supabase.from('delivery_zones').select('*').order('sort_order')
  const editing = (zones ?? []).find((z) => z.id === param(sp.edit))
  const assigned = new Set((zones ?? []).filter((z) => z.id !== editing?.id).flatMap((z) => z.counties))
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
      <Panel padded={false}>
        <Table>
          <thead><tr><Th>Zone</Th><Th>Counties</Th><Th>Estimate</Th><Th className="text-right">Fee</Th><Th /></tr></thead>
          <tbody>
            {(zones ?? []).map((z) => (
              <tr key={z.id} className={editing?.id === z.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                <Td className="font-medium">{z.name} {z.is_default ? <Badge tone="info">Default</Badge> : null} {!z.is_active ? <Badge>Off</Badge> : null}</Td>
                <Td className="max-w-sm text-xs text-fg-secondary">{z.is_default && !z.counties.length ? 'All other counties' : z.counties.join(', ')}</Td>
                <Td className="text-xs">{deliveryEstimate(z)}</Td>
                <Td className="text-right tabular-nums">{formatKES(z.fee)}{z.free_delivery_threshold ? <span className="block text-xs text-fg-muted">free over {formatKES(z.free_delivery_threshold)}</span> : null}</Td>
                <Td className="whitespace-nowrap text-right">
                  <Link href={`/admin/settings/delivery?edit=${z.id}`} className="mr-2 text-sm font-semibold text-primary-light">Edit</Link>
                  <ConfirmAction action={deleteZoneAction.bind(null, z.id)} label="Delete" title={`Delete ${z.name}?`} description="Counties in this zone fall back to the default zone." />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Panel title={editing ? `Edit ${editing.name}` : 'New zone'} actions={editing ? <Link href="/admin/settings/delivery" className="text-xs text-primary-light">+ New instead</Link> : null}>
        <AdminForm key={editing?.id ?? 'new'} action={saveZoneAction} resetOnSuccess={!editing} submitLabel="Save zone" className="space-y-3">
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <Field label="Zone name" htmlFor="z-name" required><Input id="z-name" name="name" defaultValue={editing?.name} required /></Field>
          <Field label="Counties" htmlFor="z-counties" hint="Ctrl/Cmd-click to select. Greyed counties belong to another zone.">
            <Select id="z-counties" name="counties" multiple className="h-48 bg-none py-2" defaultValue={editing?.counties ?? []}>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c} className={assigned.has(c) ? 'text-fg-muted' : ''}>{c}{assigned.has(c) ? ' (other zone)' : ''}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fee (KES)" htmlFor="z-fee" required><Input id="z-fee" name="fee" inputMode="decimal" defaultValue={editing ? Number(editing.fee) : ''} required /></Field>
            <Field label="Free delivery over" htmlFor="z-free"><Input id="z-free" name="freeOver" inputMode="decimal" defaultValue={editing?.free_delivery_threshold ?? ''} /></Field>
            <Field label="Min days" htmlFor="z-min"><Input id="z-min" name="daysMin" type="number" defaultValue={editing?.estimated_days_min ?? 1} /></Field>
            <Field label="Max days" htmlFor="z-max"><Input id="z-max" name="daysMax" type="number" defaultValue={editing?.estimated_days_max ?? 3} /></Field>
          </div>
          <Field label="Estimate label" htmlFor="z-label" hint="e.g. Same day / next day"><Input id="z-label" name="label" defaultValue={editing?.estimate_label ?? ''} /></Field>
          <Field label="Sort order" htmlFor="z-sort"><Input id="z-sort" name="sortOrder" type="number" defaultValue={editing?.sort_order ?? 0} /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="isDefault" defaultChecked={editing?.is_default ?? false} /> Default zone (counties not listed elsewhere)</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={editing?.is_active ?? true} /> Active</label>
        </AdminForm>
      </Panel>
    </div>
  )
}
