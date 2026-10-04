import Link from 'next/link'
import { AdminPageHeader, EmptyRow, FilterBar, Panel, StatCard, Table, Td, Th } from '@/components/admin/admin-ui'
import { StockAdjustButton } from '@/components/admin/stock-adjust'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/form'
import { Pagination } from '@/components/ui/pagination'
import { requireStaff } from '@/lib/auth'
import { withParams } from '@/lib/catalog-params'
import { escapeLike } from '@/lib/ecommerce/quote'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'

export const metadata = { title: 'Inventory' }
const PER_PAGE = 50
const reasonLabels: Record<string, string> = {
  purchase: 'Purchase', sale: 'Sale', manual_adjustment: 'Manual', return: 'Return', damage: 'Damage', correction: 'Correction', order_cancellation: 'Order cancelled',
}

export default async function InventoryPage({ searchParams }: PageProps<'/admin/inventory'>) {
  await requireStaff('inventory.manage')
  const sp = await searchParams
  const q = param(sp.q)?.trim()
  const low = param(sp.low) === '1'
  const productFilter = param(sp.product)
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1)
  const supabase = await createClient()

  let query = supabase.from('inventory').select('*', { count: 'exact' }).order('available_quantity').range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (q) query = query.or(`name.ilike.%${escapeLike(q)}%,sku.ilike.%${escapeLike(q)}%`)
  if (low) query = query.eq('is_low_stock', true)
  let history = supabase
    .from('inventory_transactions')
    .select('id, created_at, change, previous_quantity, new_quantity, reason, reference, note, product:products(name, sku), variant:product_variants(name)')
    .order('created_at', { ascending: false })
    .limit(30)
  if (productFilter) history = history.eq('product_id', productFilter)

  const [{ data: rows, count }, { data: tx }, { count: lowCount }, { data: totals }] = await Promise.all([
    query,
    history,
    supabase.from('inventory').select('sku', { count: 'exact', head: true }).eq('is_low_stock', true).eq('status', 'active'),
    supabase.from('inventory_totals').select('stock, reserved').maybeSingle(),
  ])
  const units = { stock: totals?.stock ?? 0, reserved: totals?.reserved ?? 0 }

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Inventory" description="Available = on hand − reserved for unpaid/unfulfilled orders. Every change is recorded below." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="SKUs" value={count ?? 0} />
        <StatCard label="Units on hand" value={units.stock} />
        <StatCard label="Reserved" value={units.reserved} />
        <StatCard label="Low stock" value={lowCount ?? 0} tone={lowCount ? 'warning' : 'neutral'} href="/admin/inventory?low=1" />
      </div>
      <FilterBar>
        <Input name="q" defaultValue={q} placeholder="Product or SKU" className="h-10 w-64!" aria-label="Search inventory" />
        <label className="flex h-10 items-center gap-2 text-sm"><Checkbox name="low" value="1" defaultChecked={low} /> Low stock only</label>
        <Button type="submit" size="sm" className="h-10">Filter</Button>
      </FilterBar>
      <Panel padded={false}>
        <Table>
          <thead><tr><Th>Item</Th><Th>SKU</Th><Th className="text-right">On hand</Th><Th className="text-right">Reserved</Th><Th className="text-right">Available</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={`${r.product_id}:${r.variant_id}`} className="hover:bg-surface">
                <Td><Link href={`/admin/inventory?product=${r.product_id}`} className="font-medium hover:text-primary-light">{r.name}</Link></Td>
                <Td className="font-mono text-xs">{r.sku}</Td>
                <Td className="text-right tabular-nums">{r.stock_quantity}</Td>
                <Td className="text-right tabular-nums text-fg-muted">{r.reserved_quantity}</Td>
                <Td className="text-right font-semibold tabular-nums">{r.available_quantity}</Td>
                <Td>
                  {(r.available_quantity ?? 0) <= 0 ? <Badge tone="danger">Out of stock</Badge> : r.is_low_stock ? <Badge tone="warning">Low (≤{r.low_stock_threshold})</Badge> : <Badge tone="success">OK</Badge>}
                  {r.status !== 'active' ? <span className="ml-1 text-xs text-fg-muted">{r.status}</span> : null}
                </Td>
                <Td className="text-right">
                  <StockAdjustButton productId={r.product_id!} variantId={r.variant_id} name={r.name ?? ''} stock={r.stock_quantity ?? 0} reserved={r.reserved_quantity ?? 0} />
                </Td>
              </tr>
            ))}
            {!rows?.length ? <EmptyRow colSpan={7}>Nothing matches.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => withParams('/admin/inventory', sp, { page: String(p) })} />

      <Panel title={productFilter ? 'Stock history for this product' : 'Recent stock movements'} actions={productFilter ? <Link href="/admin/inventory" className="text-xs text-primary-light">Show all</Link> : null} padded={false}>
        <Table>
          <thead><tr><Th>When</Th><Th>Item</Th><Th>Reason</Th><Th className="text-right">Before</Th><Th className="text-right">Change</Th><Th className="text-right">After</Th><Th>Reference / note</Th></tr></thead>
          <tbody>
            {(tx ?? []).map((t) => (
              <tr key={t.id}>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(t.created_at)}</Td>
                <Td>{t.product?.name}{t.variant ? <span className="text-fg-muted"> — {t.variant.name}</span> : null}</Td>
                <Td>{reasonLabels[t.reason] ?? t.reason}</Td>
                <Td className="text-right tabular-nums">{t.previous_quantity}</Td>
                <Td className={`text-right font-semibold tabular-nums ${t.change < 0 ? 'text-red-300' : 'text-green-300'}`}>{t.change > 0 ? `+${t.change}` : t.change}</Td>
                <Td className="text-right tabular-nums">{t.new_quantity}</Td>
                <Td className="text-xs text-fg-muted">{[t.reference, t.note].filter(Boolean).join(' · ')}</Td>
              </tr>
            ))}
            {!tx?.length ? <EmptyRow colSpan={7}>No stock movements yet.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}
