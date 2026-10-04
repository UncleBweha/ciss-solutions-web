import Link from 'next/link'
import { deletePrinterModelAction, savePrinterModelAction } from '@/actions/admin/catalog'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { AdminPageHeader, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { param } from '@/lib/utils'

export const metadata = { title: 'Printer models' }

export default async function PrinterModelsPage({ searchParams }: PageProps<'/admin/printer-models'>) {
  await requireStaff('catalog.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: models }, { data: brands }, { data: compat }] = await Promise.all([
    supabase.from('printer_models').select('*, brand:brands(name)').order('name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('compatibility_counts').select('printer_model_id, product_count'),
  ])
  const editing = (models ?? []).find((m) => m.id === param(sp.edit))
  return (
    <div>
      <AdminPageHeader title="Printer models" description="The printer model database behind spare-part compatibility and the parts finder." />
      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Panel padded={false}>
          <Table>
            <thead><tr><Th>Model</Th><Th>Brand</Th><Th>Model no.</Th><Th className="text-right">Compatible products</Th><Th /></tr></thead>
            <tbody>
              {(models ?? []).map((m) => (
                <tr key={m.id} className={editing?.id === m.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                  <Td className="font-medium">{m.name}</Td>
                  <Td>{m.brand?.name}</Td>
                  <Td className="font-mono text-xs">{m.model_number}</Td>
                  <Td className="text-right">{(compat ?? []).find((c) => c.printer_model_id === m.id)?.product_count ?? 0}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Link href={`/admin/printer-models?edit=${m.id}`} className="mr-2 text-sm font-semibold text-primary-light">Edit</Link>
                    <ConfirmAction action={deletePrinterModelAction.bind(null, m.id)} label="Delete" title={`Delete ${m.name}?`} description="Products will no longer be listed as compatible with this model." />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
        <Panel title={editing ? `Edit ${editing.name}` : 'New printer model'} actions={editing ? <Link href="/admin/printer-models" className="text-xs text-primary-light">+ New instead</Link> : null}>
          <AdminForm key={editing?.id ?? 'new'} action={savePrinterModelAction} resetOnSuccess={!editing} submitLabel={editing ? 'Save model' : 'Add model'} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <Field label="Brand" htmlFor="brandId" required>
              <Select id="brandId" name="brandId" defaultValue={editing?.brand_id ?? ''} required>
                <option value="">Choose brand</option>
                {(brands ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Full name" htmlFor="name" hint="e.g. HP LaserJet Pro M404dn" required><Input id="name" name="name" defaultValue={editing?.name} required /></Field>
            <Field label="Model number" htmlFor="modelNumber" hint="e.g. M404dn" required><Input id="modelNumber" name="modelNumber" defaultValue={editing?.model_number} required /></Field>
            <Field label="Notes" htmlFor="description"><Textarea id="description" name="description" rows={2} className="min-h-0" defaultValue={editing?.description ?? ''} /></Field>
          </AdminForm>
        </Panel>
      </div>
    </div>
  )
}
