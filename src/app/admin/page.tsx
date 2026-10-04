import Link from 'next/link'
import { AlertTriangle, Bell, ShieldAlert } from 'lucide-react'
import { AdminPageHeader, Panel, StatCard, Table, Td, Th, EmptyRow } from '@/components/admin/admin-ui'
import { BarList, ColumnChart } from '@/components/admin/charts'
import { Badge } from '@/components/ui/badge'
import { can, requireStaff } from '@/lib/auth'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, orderStatusTone, paymentMethodLabels } from '@/lib/ecommerce/orders'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'

type Stats = {
  today_sales: number
  today_orders: number
  open_orders: number
  customers: number
  products: number
  low_stock: number
  pending_payments: number
  series: { day: string; sales: number; orders: number }[]
  top_products: { name: string; quantity: number; revenue: number }[]
  top_categories: { name: string; revenue: number }[]
}

export default async function AdminDashboard({ searchParams }: PageProps<'/admin'>) {
  const user = await requireStaff()
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: stats }, { data: recent }, { data: notes }] = await Promise.all([
    supabase.rpc('admin_dashboard_stats', { p_days: 30 }),
    can(user, 'orders.manage')
      ? supabase.from('orders').select('id, order_number, customer_name, total, order_status, payment_method, created_at').order('created_at', { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    supabase.from('notifications').select('id, kind, subject, created_at, read_at').eq('channel', 'admin').order('created_at', { ascending: false }).limit(8),
  ])
  const s = stats as Stats | null
  const day = (d: string) => new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(d))

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Dashboard" description={`Welcome back${user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}. Here is today at a glance.`} />
      {param(sp.denied) ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Your role does not have access to that page.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Today's sales" value={formatKES(s?.today_sales ?? 0)} tone="success" />
        <StatCard label="Orders today" value={s?.today_orders ?? 0} hint={`${s?.open_orders ?? 0} open`} href="/admin/orders" />
        <StatCard label="Customers" value={s?.customers ?? 0} href="/admin/customers" />
        <StatCard label="Active products" value={s?.products ?? 0} href="/admin/products" />
        <StatCard label="Low stock" value={s?.low_stock ?? 0} tone={s?.low_stock ? 'warning' : 'neutral'} href="/admin/inventory?low=1" />
        <StatCard label="Pending payments" value={s?.pending_payments ?? 0} tone={s?.pending_payments ? 'warning' : 'neutral'} href="/admin/orders?status=PAYMENT_PENDING" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Sales (paid, KES) – last 30 days">
          <ColumnChart title="Paid sales per day, last 30 days" data={(s?.series ?? []).map((p) => ({ label: day(p.day), value: Number(p.sales) }))} unit="kes" />
        </Panel>
        <Panel title="Orders placed – last 30 days">
          <ColumnChart title="Orders per day, last 30 days" data={(s?.series ?? []).map((p) => ({ label: day(p.day), value: Number(p.orders) }))} />
        </Panel>
        <Panel title="Top products by revenue (30 days)">
          <BarList title="Top products by revenue" data={(s?.top_products ?? []).map((p) => ({ label: `${p.name} (×${p.quantity})`, value: Number(p.revenue) }))} unit="kes" />
        </Panel>
        <Panel title="Top categories by revenue (30 days)">
          <BarList title="Top categories by revenue" data={(s?.top_categories ?? []).map((p) => ({ label: p.name, value: Number(p.revenue) }))} unit="kes" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {can(user, 'orders.manage') ? (
          <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-semibold text-primary-light">All orders →</Link>} padded={false}>
            <Table>
              <thead>
                <tr><Th>Order</Th><Th>Customer</Th><Th>Payment</Th><Th>Status</Th><Th className="text-right">Total</Th></tr>
              </thead>
              <tbody>
                {(recent ?? []).map((o) => (
                  <tr key={o.id} className="hover:bg-surface">
                    <Td><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold hover:text-primary-light">{o.order_number}</Link><span className="block text-xs text-fg-muted">{formatDateTime(o.created_at)}</span></Td>
                    <Td>{o.customer_name}</Td>
                    <Td>{paymentMethodLabels[o.payment_method]}</Td>
                    <Td><Badge tone={orderStatusTone(o.order_status)}>{orderStatusLabels[o.order_status]}</Badge></Td>
                    <Td className="text-right font-semibold tabular-nums">{formatKES(o.total)}</Td>
                  </tr>
                ))}
                {!recent?.length ? <EmptyRow colSpan={5}>No orders yet.</EmptyRow> : null}
              </tbody>
            </Table>
          </Panel>
        ) : null}
        <Panel title="Notifications" actions={<Link href="/admin/notifications" className="text-xs font-semibold text-primary-light">View all →</Link>}>
          <ul className="space-y-3">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="flex gap-3 text-sm">
                {n.kind === 'low_stock' || n.kind === 'payment_failed' || n.kind === 'stock_shortage' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                ) : (
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary-light" aria-hidden="true" />
                )}
                <span>
                  <span className={n.read_at ? 'text-fg-secondary' : 'font-semibold'}>{n.subject}</span>
                  <span className="block text-xs text-fg-muted">{formatDateTime(n.created_at)}</span>
                </span>
              </li>
            ))}
            {!notes?.length ? <li className="text-sm text-fg-muted">Nothing new.</li> : null}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
