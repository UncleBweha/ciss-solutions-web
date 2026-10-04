import { fromCents, toCents } from './money'

export type Coupon = {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  value: number
  minimum_order: number
  maximum_discount: number | null
  starts_at: string | null
  expires_at: string | null
  usage_limit: number | null
  usage_count: number
  per_customer_limit: number | null
  applicable_product_ids: string[]
  applicable_category_ids: string[]
  is_active: boolean
}

export type CouponLine = { productId: string; categoryIds: string[]; lineTotal: number }

export type CouponResult =
  | { ok: true; discount: number; eligibleSubtotal: number }
  | { ok: false; reason: CouponError }

export type CouponError =
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'customer_limit'
  | 'minimum_not_met'
  | 'not_applicable'

export const couponErrorMessages: Record<CouponError, string> = {
  inactive: 'This coupon is not valid.',
  not_started: 'This coupon is not active yet.',
  expired: 'This coupon has expired.',
  exhausted: 'This coupon has reached its usage limit.',
  customer_limit: 'You have already used this coupon.',
  minimum_not_met: 'Your order does not meet the minimum amount for this coupon.',
  not_applicable: 'This coupon does not apply to the items in your cart.',
}

/**
 * Validates a coupon and computes the discount. Restricted coupons (products or
 * categories) only discount the eligible lines; the minimum order applies to the
 * whole cart subtotal. `customerUses` is how often this customer used it before.
 */
export function evaluateCoupon(
  coupon: Coupon,
  lines: CouponLine[],
  opts: { now?: Date; customerUses?: number } = {},
): CouponResult {
  const now = opts.now ?? new Date()
  if (!coupon.is_active) return { ok: false, reason: 'inactive' }
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { ok: false, reason: 'not_started' }
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) return { ok: false, reason: 'expired' }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) return { ok: false, reason: 'exhausted' }
  if (coupon.per_customer_limit != null && (opts.customerUses ?? 0) >= coupon.per_customer_limit) {
    return { ok: false, reason: 'customer_limit' }
  }

  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.lineTotal), 0)
  if (subtotalCents < toCents(coupon.minimum_order)) return { ok: false, reason: 'minimum_not_met' }

  const restricted = coupon.applicable_product_ids.length > 0 || coupon.applicable_category_ids.length > 0
  const eligible = restricted
    ? lines.filter(
        (l) =>
          coupon.applicable_product_ids.includes(l.productId) ||
          l.categoryIds.some((c) => coupon.applicable_category_ids.includes(c)),
      )
    : lines
  const eligibleCents = eligible.reduce((sum, l) => sum + toCents(l.lineTotal), 0)
  if (eligibleCents === 0) return { ok: false, reason: 'not_applicable' }

  let discountCents =
    coupon.discount_type === 'percentage'
      ? Math.floor((eligibleCents * Number(coupon.value)) / 100)
      : toCents(coupon.value)
  if (coupon.maximum_discount != null) discountCents = Math.min(discountCents, toCents(coupon.maximum_discount))
  discountCents = Math.min(discountCents, eligibleCents)
  // Whole shillings keep M-Pesa amounts clean.
  discountCents = Math.floor(discountCents / 100) * 100

  return { ok: true, discount: fromCents(discountCents), eligibleSubtotal: fromCents(eligibleCents) }
}
