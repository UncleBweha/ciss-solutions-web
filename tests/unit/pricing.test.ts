import { describe, expect, it } from 'vitest'
import type { Coupon } from '@/lib/ecommerce/coupons'
import type { DeliveryZone } from '@/lib/ecommerce/delivery'
import { discountPercent, formatKES, savings } from '@/lib/ecommerce/money'
import { calculateTotals, lineTotal, subtotal, type PricedLine } from '@/lib/ecommerce/pricing'

const line = (over: Partial<PricedLine> = {}): PricedLine => ({
  productId: 'p1',
  variantId: null,
  name: 'Epson L3250',
  variantName: null,
  sku: 'EPS-L3250',
  imageUrl: null,
  categoryIds: ['printers'],
  unitPrice: 32999,
  quantity: 1,
  ...over,
})

const nairobi: DeliveryZone = {
  id: 'z1', name: 'Nairobi', counties: ['Nairobi'], fee: 200, free_delivery_threshold: null,
  estimated_days_min: 0, estimated_days_max: 1, estimate_label: null, is_default: false, is_active: true,
}

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: 'c1', code: 'CISS10', discount_type: 'percentage', value: 10, minimum_order: 5000, maximum_discount: null,
  starts_at: null, expires_at: null, usage_limit: null, usage_count: 0, per_customer_limit: null,
  applicable_product_ids: [], applicable_category_ids: [], is_active: true, ...over,
})

describe('money', () => {
  it('formats KES without decimals for whole amounts', () => {
    expect(formatKES(32999)).toBe('KSh\u00a032,999')
    expect(formatKES('1150.00')).toBe('KSh\u00a01,150')
    expect(formatKES(10.5)).toBe('KSh\u00a010.50')
  })
  it('computes discount percentage and savings', () => {
    expect(discountPercent(32999, 35000)).toBe(5)
    expect(savings(32999, 35000)).toBe(2001)
    expect(discountPercent(100, null)).toBe(0)
    expect(discountPercent(100, 90)).toBe(0)
  })
})

describe('price calculation', () => {
  it('multiplies and sums lines without float drift', () => {
    expect(lineTotal({ unitPrice: 0.1, quantity: 3 })).toBe(0.3)
    expect(subtotal([line({ unitPrice: 1150, quantity: 3 }), line({ unitPrice: 450, quantity: 2 })])).toBe(4350)
  })

  it('adds delivery for the zone', () => {
    const t = calculateTotals([line()], { zone: nairobi })
    expect(t).toEqual({ subtotal: 32999, discount: 0, deliveryFee: 200, total: 33199, couponError: null })
  })

  it('applies a percentage coupon before delivery', () => {
    const t = calculateTotals([line()], { zone: nairobi, coupon: coupon() })
    expect(t.discount).toBe(3299) // 10% rounded down to whole shillings
    expect(t.total).toBe(32999 - 3299 + 200)
  })

  it('reports coupon errors without discounting', () => {
    const t = calculateTotals([line({ unitPrice: 1000 })], { zone: nairobi, coupon: coupon() })
    expect(t.discount).toBe(0)
    expect(t.couponError).toBe('minimum_not_met')
    expect(t.total).toBe(1200)
  })

  it('makes delivery free above the threshold, measured after discount', () => {
    const zone = { ...nairobi, free_delivery_threshold: 30000 }
    expect(calculateTotals([line()], { zone }).deliveryFee).toBe(0)
    const discounted = calculateTotals([line()], { zone, coupon: coupon({ discount_type: 'fixed', value: 5000 }) })
    expect(discounted.deliveryFee).toBe(200) // 27,999 after discount is under the threshold
  })

  it('never produces a negative total', () => {
    const t = calculateTotals([line({ unitPrice: 600 })], {
      coupon: coupon({ discount_type: 'fixed', value: 5000, minimum_order: 0 }),
    })
    expect(t.discount).toBe(600)
    expect(t.total).toBe(0)
  })
})
