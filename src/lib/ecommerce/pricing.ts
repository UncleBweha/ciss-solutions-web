import { evaluateCoupon, type Coupon, type CouponError } from './coupons'
import { deliveryFee, type DeliveryZone } from './delivery'
import { fromCents, toCents } from './money'

/** A cart line priced from the database (never from the browser). */
export type PricedLine = {
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  sku: string
  imageUrl: string | null
  categoryIds: string[]
  unitPrice: number
  quantity: number
}

export type OrderTotals = {
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  couponError: CouponError | null
}

export function lineTotal(line: Pick<PricedLine, 'unitPrice' | 'quantity'>): number {
  return fromCents(toCents(line.unitPrice) * line.quantity)
}

export function subtotal(lines: Pick<PricedLine, 'unitPrice' | 'quantity'>[]): number {
  return fromCents(lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.quantity, 0))
}

/**
 * The single source of truth for what a customer pays:
 *   subtotal (DB prices) − coupon discount + delivery fee = total
 * Free-delivery thresholds apply to the discounted merchandise value.
 */
export function calculateTotals(
  lines: PricedLine[],
  opts: { coupon?: Coupon | null; couponCustomerUses?: number; zone?: DeliveryZone | null; now?: Date } = {},
): OrderTotals {
  const sub = subtotal(lines)
  let discount = 0
  let couponError: CouponError | null = null

  if (opts.coupon) {
    const result = evaluateCoupon(
      opts.coupon,
      lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: lineTotal(l) })),
      { now: opts.now, customerUses: opts.couponCustomerUses },
    )
    if (result.ok) discount = result.discount
    else couponError = result.reason
  }

  const merchandise = fromCents(toCents(sub) - toCents(discount))
  const delivery = opts.zone ? deliveryFee(opts.zone, merchandise) : 0
  const total = fromCents(toCents(merchandise) + toCents(delivery))

  return { subtotal: sub, discount, deliveryFee: delivery, total, couponError }
}
