import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { MpesaPaymentProvider, MpesaPaymentStatus, OrderHeading } from '@/components/checkout/payment-status'
import { OrderTimeline } from '@/components/checkout/order-timeline'
import { OrderSummary } from '@/components/cart/order-summary'
import { ProductImage } from '@/components/product/product-image'
import { LinkButton } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getSettings } from '@/lib/catalog'
import { DELIVERY_TBC_NOTE, deliveryFeeLabel, isStorePickup } from '@/lib/ecommerce/delivery'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { awaitsPaymentConfirmation, isTerminalFailure, orderStatusLabels, orderStatusTone, paymentMethodLabels } from '@/lib/ecommerce/orders'
import { getOrderForViewer } from '@/lib/orders'
import { refreshPaymentStatus } from '@/lib/payments/service'
import { formatDateTime, param } from '@/lib/utils'

export const metadata: Metadata = { title: 'Your order', robots: { index: false } }

export default async function OrderPage({ params, searchParams }: PageProps<'/order/[number]'>) {
  const [{ number }, sp] = await Promise.all([params, searchParams])
  const token = param(sp.t) ?? null
  // Straight from checkout: a payment confirmation. Order progress is for people tracking an order.
  const justPlaced = param(sp.placed) === '1'
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
  // Paybill / bank transfer: the customer says they paid; staff have not confirmed it yet.
  const awaitingConfirmation = awaitsPaymentConfirmation(order.payment_method) && !paid && !failed
  const bank = settings.payment_methods.bank_transfer
  const paybill = settings.payment_methods.mpesa_paybill
  const tokenQs = token ? `?t=${token}` : ''

  const page = (
    <div className="container-page max-w-5xl py-10">
      <OrderHeading
        orderNumber={order.order_number}
        paid={paid}
        awaitingMpesa={isMpesa && !paid}
        awaitingConfirmation={awaitingConfirmation}
        failedLabel={failed ? orderStatusLabels[order.order_status] : null}
        celebrate={justPlaced}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {isMpesa && !failed && view ? (
            <MpesaPaymentStatus orderNumber={order.order_number} token={token} phone={order.customer_phone} />
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

          {order.payment_method === 'mpesa_paybill' && !paid && !failed ? (
            <section className="glass-flat rounded-[var(--radius-card)] p-5">
              <h2 className="mb-3 font-bold">Not paid yet? Pay with M-Pesa Paybill</h2>
              {paybill.paybill_number && paybill.account_number ? (
                <>
                  <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-fg-secondary">
                    <li>On your phone, open M-Pesa and choose Lipa na M-Pesa, then Pay Bill.</li>
                    <li>Enter the business number, account number and amount below.</li>
                    <li>Enter your M-Pesa PIN and confirm.</li>
                  </ol>
                  <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5 text-sm">
                    <dt className="text-fg-muted">Business number</dt>
                    <dd className="font-mono font-bold">{paybill.paybill_number}</dd>
                    <dt className="text-fg-muted">Account number</dt>
                    <dd className="font-mono font-bold">{paybill.account_number}</dd>
                    <dt className="text-fg-muted">Amount</dt>
                    <dd className="font-bold">{formatKES(order.total)}</dd>
                  </dl>
                </>
              ) : (
                <p className="text-sm text-warning">Our team will contact you with payment details.</p>
              )}
              <p className="mt-3 text-sm text-fg-secondary">{paybill.instructions}</p>
            </section>
          ) : null}

          {justPlaced ? null : (
          <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Order status</h2>
              <Badge tone={orderStatusTone(order.order_status)}>{awaitingConfirmation ? 'Awaiting payment confirmation' : orderStatusLabels[order.order_status]}</Badge>
            </div>
            {failed ? <p className="text-sm text-fg-secondary">Status: {orderStatusLabels[order.order_status]}.</p> : <OrderTimeline order={order} />}
          </section>
          )}

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
            deliveryText={deliveryFeeLabel(order.delivery_fee, order.delivery_zone_name)}
            totalNote={!isStorePickup(order.delivery_zone_name) && !Number(order.delivery_fee) ? 'Excludes delivery' : null}
            total={Number(order.total)}
            couponCode={order.coupon_code}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Payment</dt>
                <dd>{paymentMethodLabels[order.payment_method]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">{isStorePickup(order.delivery_zone_name) ? 'Collect from' : 'Delivery'}</dt>
                <dd className="text-right">
                  {isStorePickup(order.delivery_zone_name) ? order.delivery_address : `${order.delivery_town}, ${order.delivery_county}`}
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
            {!isStorePickup(order.delivery_zone_name) && !Number(order.delivery_fee) ? <p className="text-xs text-fg-muted">{DELIVERY_TBC_NOTE}</p> : null}
          </OrderSummary>
          <div className="grid gap-2">
            {paid ? (
              <Link href={`/api/orders/${encodeURIComponent(order.order_number)}/invoice${tokenQs}`} className="flex items-center justify-center gap-2 rounded-full border border-white bg-white/70 py-2.5 text-sm font-semibold hover:bg-white">
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
  // M-Pesa orders share one live payment state between the heading and the prompt panel.
  return isMpesa && !failed && view ? (
    <MpesaPaymentProvider orderNumber={order.order_number} token={token} total={Number(order.total)} initial={{ state: view.state, message: view.message }}>
      {page}
    </MpesaPaymentProvider>
  ) : (
    page
  )
}
