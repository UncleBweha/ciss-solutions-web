import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock, FileText } from 'lucide-react'
import { MpesaPaymentStatus } from '@/components/checkout/payment-status'
import { OrderTimeline } from '@/components/checkout/order-timeline'
import { OrderSummary } from '@/components/cart/order-summary'
import { ProductImage } from '@/components/product/product-image'
import { LinkButton } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getSettings } from '@/lib/catalog'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { isTerminalFailure, orderStatusLabels, orderStatusTone, paymentMethodLabels } from '@/lib/ecommerce/orders'
import { getOrderForViewer } from '@/lib/orders'
import { refreshPaymentStatus } from '@/lib/payments/service'
import { formatDateTime, param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Your order', robots: { index: false } }

export default async function OrderPage({ params, searchParams }: PageProps<'/order/[number]'>) {
  const [{ number }, sp] = await Promise.all([params, searchParams])
  const token = param(sp.t) ?? null
  const order = await getOrderForViewer(decodeURIComponent(number), token)
  if (!order) notFound()

  const settings = await getSettings()
  const isMpesa = order.payment_method === 'mpesa'
  const view = !isMpesa
    ? null
    : order.payment_status === 'PAID'
      ? { state: 'paid' as const, message: null }
      : await refreshPaymentStatus(order.id)
  const failed = isTerminalFailure(order.order_status)
  const paid = order.payment_status === 'PAID'
  const bank = settings.payment_methods.bank_transfer
  const tokenQs = token ? `?t=${token}` : ''

  return (
    <div className="container-page max-w-5xl py-10">
      <header className="mb-8 text-center">
        {failed ? (
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-danger">
            <Clock className="h-8 w-8" aria-hidden="true" />
          </span>
        ) : (
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </span>
        )}
        <h1 className="text-3xl font-bold sm:text-4xl">
          {failed ? `Order ${orderStatusLabels[order.order_status].toLowerCase()}` : paid || !isMpesa ? 'Order Confirmed' : 'Almost there'}
        </h1>
        <p className="mt-2 text-fg-secondary">
          {failed
            ? 'This order is no longer active.'
            : paid || !isMpesa
              ? 'Thank you for your order. A confirmation has been sent to your email.'
              : 'Complete your M-Pesa payment to confirm your order.'}
        </p>
        <p className="mt-4 text-lg">
          Order <strong className="font-mono">#{order.order_number}</strong>
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {isMpesa && !failed && view ? (
            <MpesaPaymentStatus orderNumber={order.order_number} token={token} phone={order.customer_phone} total={Number(order.total)} initial={{ state: view.state, message: view.message }} />
          ) : null}

          {order.payment_method === 'bank_transfer' && !paid && !failed ? (
            <section className="glass-flat rounded-[var(--radius-card)] p-5">
              <h2 className="mb-3 font-bold">Pay by bank transfer</h2>
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
                {bank.bank_name ? (<><dt className="text-fg-muted">Bank</dt><dd>{bank.bank_name}</dd></>) : null}
                {bank.account_name ? (<><dt className="text-fg-muted">Account name</dt><dd>{bank.account_name}</dd></>) : null}
                {bank.account_number ? (<><dt className="text-fg-muted">Account no.</dt><dd className="font-mono">{bank.account_number}</dd></>) : null}
                {bank.branch ? (<><dt className="text-fg-muted">Branch</dt><dd>{bank.branch}</dd></>) : null}
                <dt className="text-fg-muted">Reference</dt>
                <dd className="font-mono font-bold">{order.order_number}</dd>
                <dt className="text-fg-muted">Amount</dt>
                <dd className="font-bold">{formatKES(order.total)}</dd>
              </dl>
              {!bank.account_number ? <p className="mt-3 text-sm text-warning">Our team will contact you with bank details.</p> : null}
              <p className="mt-3 text-sm text-fg-secondary">{bank.instructions}</p>
            </section>
          ) : null}

          <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Order status</h2>
              <Badge tone={orderStatusTone(order.order_status)}>{orderStatusLabels[order.order_status]}</Badge>
            </div>
            {failed ? <p className="text-sm text-fg-secondary">Status: {orderStatusLabels[order.order_status]}.</p> : <OrderTimeline order={order} />}
          </section>

          <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6">
            <h2 className="mb-4 text-lg font-bold">Items</h2>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <span className="product-stage relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <ProductImage src={item.image_url} alt="" fill sizes="56px" className="object-contain p-1" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold">{item.product_name}</span>
                    <span className="text-fg-muted">
                      {item.variant_name ? `${item.variant_name} · ` : ''}
                      {item.quantity} × {formatKES(item.unit_price)}
                    </span>
                  </span>
                  <span className="font-semibold">{formatKES(item.total_price)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <OrderSummary
            title="Payment"
            subtotal={Number(order.subtotal)}
            discount={Number(order.discount)}
            deliveryFee={Number(order.delivery_fee)}
            deliveryLabel={order.delivery_zone_name}
            total={Number(order.total)}
            couponCode={order.coupon_code}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Payment</dt>
                <dd>{paymentMethodLabels[order.payment_method]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Delivery</dt>
                <dd className="text-right">
                  {order.delivery_town}, {order.delivery_county}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Phone</dt>
                <dd>{formatKenyanPhone(order.customer_phone)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Placed</dt>
                <dd>{formatDateTime(order.created_at)}</dd>
              </div>
            </dl>
          </OrderSummary>
          <div className="grid gap-2">
            {paid ? (
              <Link href={`/api/orders/${encodeURIComponent(order.order_number)}/invoice${tokenQs}`} className="flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-sm font-semibold hover:bg-surface">
                <FileText className="h-4 w-4" aria-hidden="true" /> Download invoice
              </Link>
            ) : null}
            <LinkButton href={`/track-order?order=${encodeURIComponent(order.order_number)}`} variant="glass">
              Track Order
            </LinkButton>
            <LinkButton href="/shop">Continue Shopping</LinkButton>
          </div>
        </div>
      </div>
    </div>
  )
}
