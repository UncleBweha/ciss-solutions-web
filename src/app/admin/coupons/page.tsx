import Link from 'next/link'
import { deleteCouponAction, saveCouponAction } from '@/actions/admin/coupons'
import { AdminForm, ConfirmAction } from '@/components/admin/admin-form'
import { AdminPageHeader, EmptyRow, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { requireStaff } from '@/lib/auth'
import { getAdminCatalogOptions } from '@/lib/admin/options'
import { formatKES } from '@/lib/ecommerce/money'
import { createClient } from '@/lib/supabase/server'
import { formatDate, param } from '@/lib/utils'
import { nowMs } from '@/lib/utils/time'

export const metadata = { title: 'Coupons' }
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) : '')

export default async function CouponsPage({ searchParams }: PageProps<'/admin/coupons'>) {
  await requireStaff('coupons.manage')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: coupons }, { categories }, { data: products }] = await Promise.all([
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    getAdminCatalogOptions(),
    supabase.from('products').select('id, name').eq('status', 'active').order('name').limit(1000),
  ])
  const editing = (coupons ?? []).find((c) => c.id === param(sp.edit))
  const now = nowMs()
  const state = (c: NonNullable<typeof coupons>[number]) =>
    !c.is_active ? ['Inactive', 'neutral'] as const
      : c.expires_at && new Date(c.expires_at).getTime() < now ? ['Expired', 'danger'] as const
        : c.starts_at && new Date(c.starts_at).getTime() > now ? ['Scheduled', 'info'] as const
          : c.usage_limit != null && c.usage_count >= c.usage_limit ? ['Used up', 'warning'] as const
            : ['Active', 'success'] as const

  return (
    <div>
      <AdminPageHeader title="Coupons" description="Discounts are validated and applied by the server at checkout." />
      <div className="grid gap-4 xl:grid-cols-[1fr_28rem]">
        <Panel padded={false}>
          <Table>
            <thead><tr><Th>Code</Th><Th>Discount</Th><Th>Conditions</Th><Th>Usage</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {(coupons ?? []).map((c) => {
                const [label, tone] = state(c)
                return (
                  <tr key={c.id} className={editing?.id === c.id ? 'bg-primary/10' : 'hover:bg-surface'}>
                    <Td><span className="font-mono font-bold">{c.code}</span>{c.description ? <span className="block text-xs text-fg-muted">{c.description}</span> : null}</Td>
                    <Td>{c.discount_type === 'percentage' ? `${Number(c.value)}%` : formatKES(c.value)}{c.maximum_discount ? <span className="block text-xs text-fg-muted">max {formatKES(c.maximum_discount)}</span> : null}</Td>
                    <Td className="text-xs text-fg-secondary">
                      {Number(c.minimum_order) ? `Min ${formatKES(c.minimum_order)}` : 'No minimum'}
                      {c.applicable_category_ids.length || c.applicable_product_ids.length ? <span className="block">Restricted</span> : null}
                      {c.expires_at ? <span className="block">Until {formatDate(c.expires_at)}</span> : null}
                    </Td>
                    <Td>{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</Td>
                    <Td><Badge tone={tone}>{label}</Badge></Td>
                    <Td className="whitespace-nowrap text-right">
                      <Link href={`/admin/coupons?edit=${c.id}`} className="mr-2 text-sm font-semibold text-primary-light">Edit</Link>
                      <ConfirmAction action={deleteCouponAction.bind(null, c.id)} label="Delete" title={`Delete ${c.code}?`} description="Used coupons are deactivated instead, to keep order history intact." />
                    </Td>
                  </tr>
                )
              })}
              {!coupons?.length ? <EmptyRow colSpan={6}>No coupons yet.</EmptyRow> : null}
            </tbody>
          </Table>
        </Panel>
        <Panel title={editing ? `Edit ${editing.code}` : 'New coupon'} actions={editing ? <Link href="/admin/coupons" className="text-xs text-primary-light">+ New instead</Link> : null}>
          <AdminForm key={editing?.id ?? 'new'} action={saveCouponAction} resetOnSuccess={!editing} submitLabel={editing ? 'Save coupon' : 'Create coupon'} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code" htmlFor="code" required><Input id="code" name="code" defaultValue={editing?.code} placeholder="CISS10" required className="uppercase" /></Field>
              <Field label="Type" htmlFor="discountType">
                <Select id="discountType" name="discountType" defaultValue={editing?.discount_type ?? 'percentage'}>
                  <option value="percentage">Percentage</option><option value="fixed">Fixed amount (KES)</option>
                </Select>
              </Field>
              <Field label="Value" htmlFor="value" required><Input id="value" name="value" inputMode="decimal" defaultValue={editing ? Number(editing.value) : ''} required /></Field>
              <Field label="Max discount (KES)" htmlFor="maximumDiscount"><Input id="maximumDiscount" name="maximumDiscount" inputMode="decimal" defaultValue={editing?.maximum_discount ?? ''} /></Field>
              <Field label="Minimum order (KES)" htmlFor="minimumOrder"><Input id="minimumOrder" name="minimumOrder" inputMode="decimal" defaultValue={editing ? Number(editing.minimum_order) : ''} /></Field>
              <Field label="Description" htmlFor="description"><Input id="description" name="description" defaultValue={editing?.description ?? ''} /></Field>
              <Field label="Starts" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="date" defaultValue={day(editing?.starts_at ?? null)} /></Field>
              <Field label="Expires" htmlFor="expiresAt"><Input id="expiresAt" name="expiresAt" type="date" defaultValue={day(editing?.expires_at ?? null)} /></Field>
              <Field label="Total uses limit" htmlFor="usageLimit"><Input id="usageLimit" name="usageLimit" inputMode="numeric" defaultValue={editing?.usage_limit ?? ''} /></Field>
              <Field label="Uses per customer" htmlFor="perCustomerLimit"><Input id="perCustomerLimit" name="perCustomerLimit" inputMode="numeric" defaultValue={editing?.per_customer_limit ?? ''} /></Field>
            </div>
            <Field label="Only for categories" htmlFor="categoryIds" hint="Hold Ctrl/Cmd to select several. Empty = whole cart.">
              <Select id="categoryIds" name="categoryIds" multiple className="h-28 bg-none py-2" defaultValue={editing?.applicable_category_ids ?? []}>
                {categories.map((c) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Only for products" htmlFor="productIds">
              <Select id="productIds" name="productIds" multiple className="h-28 bg-none py-2" defaultValue={editing?.applicable_product_ids ?? []}>
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={editing?.is_active ?? true} /> Active</label>
          </AdminForm>
        </Panel>
      </div>
    </div>
  )
}
