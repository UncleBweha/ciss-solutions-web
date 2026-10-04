import { Download } from 'lucide-react'
import { AdminPageHeader, EmptyRow, FilterBar, Panel, StatCard, Table, Td, Th } from '@/components/admin/admin-ui'
import { BarList } from '@/components/admin/charts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { can, requireStaff } from '@/lib/auth'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, paymentMethodLabels, type OrderStatus, type PaymentMethod } from '@/lib/ecommerce/orders'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'
import { nowMs } from '@/lib/utils/time'

export const metadata = { title: 'Reports' }

const isoDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  const user = await requireStaff('reports.view')
  const sp = await searchParams
  const to = param(sp.to) ?? isoDay(new Date(nowMs()))
  const from = param(sp.from) ?? isoDay(new Date(nowMs() - 29 * 86400_000))
  const fromTs = new Date(`${from}T00:00:00+03:00`).toISOString()
  const toTs = new Date(`${to}T23:59:59.999+03:00`).toISOString()
  const supabase = await createClient()

  const [{ data: orders }, { data: logs }] = await Promise.all([
    can(user, 'orders.manage') || can(user, 'customers.view')
      ? supabase.from('orders').select('total, discount, delivery_fee, payment_status, order_status, payment_method').gte('created_at', fromTs).lte('created_at', toTs).limit(10000)
      : Promise.resolve({ data: [] as { total: number; discount: number; delivery_fee: number; payment_status: string; order_status: OrderStatus; payment_method: PaymentMethod }[] }),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ])
  const list = orders ?? []
  const paid = list.filter((o) => o.payment_status === 'PAID')
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0)
  const byMethod = Object.entries(
    paid.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.payment_method]: (acc[o.payment_method] ?? 0) + Number(o.total) }), {}),
  ).map(([k, v]) => ({ label: paymentMethodLabels[k as PaymentMethod], value: v }))
  const byStatus = Object.entries(list.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.order_status]: (acc[o.order_status] ?? 0) + 1 }), {}))
    .map(([k, v]) => ({ label: orderStatusLabels[k as OrderStatus], value: v }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Reports"
        actions={
          <a href={`/api/admin/orders-export?from=${from}&to=${to}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface">
            <Download className="h-4 w-4" aria-hidden="true" /> Export orders CSV
          </a>
        }
      />
      <FilterBar>
        <label className="text-sm">From<Input type="date" name="from" defaultValue={from} className="h-10 w-44!" /></label>
        <label className="text-sm">To<Input type="date" name="to" defaultValue={to} className="h-10 w-44!" /></label>
        <Button type="submit" size="sm" className="h-10">Apply</Button>
      </FilterBar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Paid revenue" value={formatKES(revenue)} tone="success" />
        <StatCard label="Paid orders" value={paid.length} />
        <StatCard label="Average order" value={formatKES(paid.length ? Math.round(revenue / paid.length) : 0)} />
        <StatCard label="Discounts given" value={formatKES(paid.reduce((s, o) => s + Number(o.discount), 0))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Paid revenue by payment method"><BarList title="Revenue by payment method" data={byMethod} unit="kes" /></Panel>
        <Panel title="All orders by status"><BarList title="Orders by status" data={byStatus} /></Panel>
      </div>
      <Panel title="Audit log (latest 50 sensitive actions)" padded={false}>
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Resource</Th><Th>IP</Th></tr></thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</Td>
                <Td className="text-xs">{l.actor_email ?? 'system'}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="text-xs text-fg-muted">{l.resource}{l.resource_id ? ` · ${l.resource_id.slice(0, 18)}` : ''}</Td>
                <Td className="text-xs text-fg-muted">{l.ip ?? '—'}</Td>
              </tr>
            ))}
            {!logs?.length ? <EmptyRow colSpan={5}>No audit entries visible to your role.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}
