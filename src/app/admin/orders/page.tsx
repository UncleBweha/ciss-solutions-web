import Link from 'next/link'
import { AdminPageHeader, EmptyRow, FilterBar, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { Pagination } from '@/components/ui/pagination'
import { requireStaff } from '@/lib/auth'
import { escapeLike } from '@/lib/ecommerce/quote'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, orderStatusTone, paymentMethodLabels, paymentStatusLabels, paymentStatusTone, type OrderStatus, type PaymentStatus } from '@/lib/ecommerce/orders'
import { withParams } from '@/lib/catalog-params'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime, param } from '@/lib/utils'

export const metadata = { title: 'Orders' }
const PER_PAGE = 50

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  await requireStaff('orders.manage')
  const sp = await searchParams
  const status = param(sp.status) as OrderStatus | undefined
  const payment = param(sp.payment) as PaymentStatus | undefined
  const q = param(sp.q)?.trim()
  const page = Math.max(1, Number(param(sp.page) ?? 1) || 1)

  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, total, order_status, payment_status, payment_method, delivery_county, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (status && status in orderStatusLabels) query = query.eq('order_status', status)
  if (payment && payment in paymentStatusLabels) query = query.eq('payment_status', payment)
  if (q) {
    const like = `%${escapeLike(q)}%`
    query = query.or(`order_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like},customer_email.ilike.${like}`)
  }
  const { data, count } = await query

  return (
    <div>
      <AdminPageHeader title="Orders" description={`${count ?? 0} orders`} />
      <FilterBar>
        <Input name="q" defaultValue={q} placeholder="Order no., name, phone, email" className="h-10 w-64!" aria-label="Search orders" />
        <Select name="status" defaultValue={status ?? ''} className="h-10 w-48!" aria-label="Order status">
          <option value="">All statuses</option>
          {Object.entries(orderStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="payment" defaultValue={payment ?? ''} className="h-10 w-44!" aria-label="Payment status">
          <option value="">All payments</option>
          {Object.entries(paymentStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Button type="submit" size="sm" className="h-10">Filter</Button>
      </FilterBar>
      <Panel padded={false}>
        <Table>
          <thead>
            <tr><Th>Order</Th><Th>Customer</Th><Th>Delivery</Th><Th>Payment</Th><Th>Status</Th><Th className="text-right">Total</Th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-surface">
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold hover:text-primary-light">{o.order_number}</Link>
                  <span className="block text-xs text-fg-muted">{formatDateTime(o.created_at)}</span>
                </Td>
                <Td>{o.customer_name}<span className="block text-xs text-fg-muted">{o.customer_phone}</span></Td>
                <Td>{o.delivery_county}</Td>
                <Td>
                  <Badge tone={paymentStatusTone(o.payment_status)}>{paymentStatusLabels[o.payment_status]}</Badge>
                  <span className="block text-xs text-fg-muted">{paymentMethodLabels[o.payment_method]}</span>
                </Td>
                <Td><Badge tone={orderStatusTone(o.order_status)}>{orderStatusLabels[o.order_status]}</Badge></Td>
                <Td className="text-right font-semibold tabular-nums">{formatKES(o.total)}</Td>
              </tr>
            ))}
            {!data?.length ? <EmptyRow colSpan={6}>No orders match these filters.</EmptyRow> : null}
          </tbody>
        </Table>
      </Panel>
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => withParams('/admin/orders', sp, { page: String(p) })} />
    </div>
  )
}
