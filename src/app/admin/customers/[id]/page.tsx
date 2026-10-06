import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminPageHeader, EmptyRow, Panel, StatCard, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { requireStaff } from '@/lib/auth'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, orderStatusTone } from '@/lib/ecommerce/orders'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Customer' }

export default async function CustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  await requireStaff('customers.view')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: c }, { data: orders }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle(),
    supabase.from('orders').select('id, order_number, total, order_status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
  ])
  if (!c) notFound()
  return (
    <div className="space-y-4">
      <AdminPageHeader title={c.full_name || c.email || 'Customer'} back={{ href: '/admin/customers', label: 'Customers' }} description={`${c.email ?? ''}${c.phone ? ` · ${c.phone}` : ''} · joined ${c.created_at ? formatDate(c.created_at) : ''}`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Orders" value={c.orders_count ?? 0} />
        <StatCard label="Total spent (paid)" value={formatKES(c.total_spent ?? 0)} />
        <StatCard label="Last order" value={c.last_order_at ? formatDate(c.last_order_at) : '—'} />
      </div>
      <Panel title="Orders" padded={false}>
        <Table>
          <thead><tr><Th>Order</Th><Th>Date</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <Td><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold hover:text-primary-light">{o.order_number}</Link></Td>
                <Td>{formatDateTime(o.created_at)}</Td>
                <Td><Badge tone={orderStatusTone(o.order_status)}>{orderStatusLabels[o.order_status]}</Badge></Td>
                <Td className="text-right tabular-nums">{formatKES(o.total)}</Td>
              </tr>
            ))}
            {!orders?.length ? <EmptyRow colSpan={4}>No orders yet.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
    </div>
  )
}
