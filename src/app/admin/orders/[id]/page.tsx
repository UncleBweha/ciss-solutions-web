import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { AdminPageHeader, Panel, Table, Td, Th } from '@/components/admin/admin-ui'
import { OrderNotes, OrderStatusActions } from '@/components/admin/order-actions'
import { Badge } from '@/components/ui/badge'
import { can, requireStaff } from '@/lib/auth'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { allowedTransitions, orderStatusLabels, orderStatusTone, paymentMethodLabels, paymentStatusLabels, paymentStatusTone } from '@/lib/ecommerce/orders'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Order' }

export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  const user = await requireStaff('orders.manage')
  const { id } = await params
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*), history:order_status_history(*), payments(*)')
    .eq('id', id)
    .maybeSingle()
  if (!order) notFound()

  const allowed = allowedTransitions(order.order_status, order.payment_method).filter((s) => s !== 'REFUNDED' || can(user, 'orders.refund'))
  const history = [...order.history].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const payments = [...order.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-4">
      <AdminPageHeader
        back={{ href: '/admin/orders', label: 'Orders' }}
        title={`Order #${order.order_number}`}
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <a href={`/api/orders/${encodeURIComponent(order.order_number)}/invoice`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface">
            <FileText className="h-4 w-4" aria-hidden="true" /> Print Invoice
          </a>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel title="Status" actions={<div className="flex gap-2"><Badge tone={paymentStatusTone(order.payment_status)}>Payment: {paymentStatusLabels[order.payment_status]}</Badge><Badge tone={orderStatusTone(order.order_status)}>Order: {orderStatusLabels[order.order_status]}</Badge></div>}>
            <OrderStatusActions orderId={order.id} allowed={allowed} />
            {order.stock_state === 'shortage' ? (
              <p role="alert" className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-amber-200">
                This order was paid after its stock reservation lapsed and some items are out of stock. Restock or contact the customer.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-fg-muted">Stock: {order.stock_state}{order.reservation_expires_at && order.stock_state === 'reserved' ? ` until ${formatDateTime(order.reservation_expires_at)}` : ''}</p>
          </Panel>

          <Panel title="Items" padded={false}>
            <Table>
              <thead><tr><Th>Product</Th><Th>SKU</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.product_name}{i.variant_name ? <span className="block text-xs text-fg-muted">{i.variant_name}</span> : null}</Td>
                    <Td className="font-mono text-xs">{i.sku}</Td>
                    <Td className="text-right">{i.quantity}</Td>
                    <Td className="text-right tabular-nums">{formatKES(i.unit_price)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{formatKES(i.total_price)}</Td>
                  </tr>
                ))}
                <tr><Td colSpan={4} className="text-right text-fg-muted">Subtotal</Td><Td className="text-right tabular-nums">{formatKES(order.subtotal)}</Td></tr>
                {Number(order.discount) ? <tr><Td colSpan={4} className="text-right text-fg-muted">Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</Td><Td className="text-right tabular-nums">-{formatKES(order.discount)}</Td></tr> : null}
                <tr><Td colSpan={4} className="text-right text-fg-muted">Delivery ({order.delivery_zone_name})</Td><Td className="text-right tabular-nums">{formatKES(order.delivery_fee)}</Td></tr>
                <tr><Td colSpan={4} className="text-right font-bold">Total</Td><Td className="text-right text-base font-bold tabular-nums">{formatKES(order.total)}</Td></tr>
              </tbody>
            </Table>
          </Panel>

          <Panel title="Payments" padded={false}>
            <Table>
              <thead><tr><Th>When</Th><Th>Method</Th><Th>Status</Th><Th>Reference</Th><Th>Phone</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-xs">{formatDateTime(p.created_at)}</Td>
                    <Td>{paymentMethodLabels[p.method]}<span className="block text-xs text-fg-muted">{p.provider}</span></Td>
                    <Td><Badge tone={paymentStatusTone(p.status)}>{paymentStatusLabels[p.status]}</Badge>{p.result_description ? <span className="block max-w-56 truncate text-xs text-fg-muted" title={p.result_description}>{p.result_description}</span> : null}</Td>
                    <Td className="font-mono text-xs">{p.transaction_reference ?? '—'}</Td>
                    <Td className="text-xs">{p.phone_number ? formatKenyanPhone(p.phone_number) : '—'}</Td>
                    <Td className="text-right tabular-nums">{formatKES(p.amount)}</Td>
                  </tr>
                ))}
                {!payments.length ? <tr><Td colSpan={6} className="text-center text-fg-muted">No payment attempts yet.</Td></tr> : null}
              </tbody>
            </Table>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Customer">
            <dl className="space-y-1.5 text-sm">
              <dt className="sr-only">Name</dt><dd className="font-semibold">{order.customer_name}</dd>
              <dt className="sr-only">Phone</dt><dd><a href={`tel:+${order.customer_phone}`} className="hover:text-primary-light">{formatKenyanPhone(order.customer_phone)}</a></dd>
              <dt className="sr-only">Email</dt><dd><a href={`mailto:${order.customer_email}`} className="hover:text-primary-light">{order.customer_email}</a></dd>
              <dd className="text-xs text-fg-muted">{order.user_id ? 'Registered customer' : 'Guest checkout'}</dd>
            </dl>
          </Panel>
          <Panel title="Delivery">
            <p className="text-sm">{order.delivery_address}<br />{order.delivery_town}, {order.delivery_county}</p>
            {order.delivery_instructions ? <p className="mt-2 text-sm text-fg-secondary">“{order.delivery_instructions}”</p> : null}
            {order.customer_notes ? <p className="mt-2 text-sm text-fg-secondary">Customer note: {order.customer_notes}</p> : null}
          </Panel>
          <Panel title="Internal notes">
            <OrderNotes orderId={order.id} initial={order.admin_notes ?? ''} />
          </Panel>
          <Panel title="History">
            <ol className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id}>
                  <Badge tone={orderStatusTone(h.status)}>{orderStatusLabels[h.status]}</Badge>
                  <span className="ml-2 text-xs text-fg-muted">{formatDateTime(h.created_at)}</span>
                  {h.note ? <p className="mt-1 text-fg-secondary">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}
