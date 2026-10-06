import type { ReactNode } from 'react'
import { formatKES } from '@/lib/ecommerce/money'
import { cn } from '@/lib/utils'

export function OrderSummary({
  subtotal,
  discount,
  deliveryFee,
  total,
  deliveryLabel,
  deliveryText,
  totalNote,
  couponCode,
  loading,
  children,
  className,
  title = 'Order summary',
}: {
  subtotal: number
  discount: number
  deliveryFee: number | null
  total: number
  deliveryLabel?: string | null
  /** Replaces the amount, e.g. "To be confirmed" for courier orders. */
  deliveryText?: string | null
  /** Small print under the total. */
  totalNote?: string | null
  couponCode?: string | null
  loading?: boolean
  children?: ReactNode
  className?: string
  title?: string
}) {
  const row = 'flex items-baseline justify-between gap-4 py-1.5 text-sm'
  return (
    <section aria-labelledby="summary-title" className={cn('glass-flat rounded-[var(--radius-card)] p-5 sm:p-6', className)} aria-busy={loading}>
      <h2 id="summary-title" className="mb-4 text-lg font-bold">
        {title}
      </h2>
      <dl className={cn('transition-opacity', loading && 'opacity-50')}>
        <div className={row}>
          <dt className="text-fg-secondary">Subtotal</dt>
          <dd className="font-semibold">{formatKES(subtotal)}</dd>
        </div>
        <div className={row}>
          <dt className="text-fg-secondary">
            Delivery{deliveryLabel ? <span className="block text-xs text-fg-muted">{deliveryLabel}</span> : null}
          </dt>
          <dd className="font-semibold">{deliveryText ?? (deliveryFee === null ? <span className="text-fg-muted">At checkout</span> : deliveryFee === 0 ? 'Free' : formatKES(deliveryFee))}</dd>
        </div>
        {discount > 0 ? (
          <div className={row}>
            <dt className="text-fg-secondary">Discount{couponCode ? ` (${couponCode})` : ''}</dt>
            <dd className="font-semibold text-success">-{formatKES(discount)}</dd>
          </div>
        ) : null}
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <dt className="font-bold">Total</dt>
          <dd className="text-2xl font-bold">{formatKES(total)}</dd>
        </div>
        {totalNote ? <p className="mt-1 text-right text-xs text-fg-muted">{totalNote}</p> : null}
      </dl>
      {children ? <div className="mt-5 space-y-3">{children}</div> : null}
    </section>
  )
}
