import { describe, expect, it } from 'vitest'
import { evaluateCoupon, type Coupon } from '@/lib/ecommerce/coupons'

const base: Coupon = {
  id: 'c1', code: 'CISS10', discount_type: 'percentage', value: 10, minimum_order: 5000, maximum_discount: null,
  starts_at: null, expires_at: null, usage_limit: null, usage_count: 0, per_customer_limit: null,
  applicable_product_ids: [], applicable_category_ids: [], is_active: true,
}
const lines = [
  { productId: 'printer', categoryIds: ['printers'], lineTotal: 30000 },
  { productId: 'ink', categoryIds: ['ink-toner', 'ink'], lineTotal: 4000 },
]
const now = new Date('2026-10-04T10:00:00Z')

describe('coupon validation', () => {
  it('discounts the whole cart', () => {
    expect(evaluateCoupon(base, lines, { now })).toEqual({ ok: true, discount: 3400, eligibleSubtotal: 34000 })
  })
  it('caps at maximum discount', () => {
    expect(evaluateCoupon({ ...base, maximum_discount: 1000 }, lines, { now })).toMatchObject({ ok: true, discount: 1000 })
  })
  it('rejects inactive, not started, expired and exhausted coupons', () => {
    expect(evaluateCoupon({ ...base, is_active: false }, lines, { now })).toEqual({ ok: false, reason: 'inactive' })
    expect(evaluateCoupon({ ...base, starts_at: '2026-11-01T00:00:00Z' }, lines, { now })).toEqual({ ok: false, reason: 'not_started' })
    expect(evaluateCoupon({ ...base, expires_at: '2026-10-01T00:00:00Z' }, lines, { now })).toEqual({ ok: false, reason: 'expired' })
    expect(evaluateCoupon({ ...base, usage_limit: 5, usage_count: 5 }, lines, { now })).toEqual({ ok: false, reason: 'exhausted' })
  })
  it('enforces per-customer limits', () => {
    expect(evaluateCoupon({ ...base, per_customer_limit: 1 }, lines, { now, customerUses: 1 })).toEqual({
      ok: false,
      reason: 'customer_limit',
    })
  })
  it('enforces the minimum order on the whole cart', () => {
    expect(evaluateCoupon({ ...base, minimum_order: 50000 }, lines, { now })).toEqual({ ok: false, reason: 'minimum_not_met' })
  })
  it('restricts discounts to applicable categories', () => {
    const inkOnly = { ...base, discount_type: 'fixed' as const, value: 500, minimum_order: 3000, applicable_category_ids: ['ink-toner'] }
    expect(evaluateCoupon(inkOnly, lines, { now })).toEqual({ ok: true, discount: 500, eligibleSubtotal: 4000 })
    expect(evaluateCoupon(inkOnly, [lines[0]], { now })).toEqual({ ok: false, reason: 'not_applicable' })
  })
  it('restricts discounts to applicable products', () => {
    const r = evaluateCoupon({ ...base, minimum_order: 0, applicable_product_ids: ['printer'] }, lines, { now })
    expect(r).toEqual({ ok: true, discount: 3000, eligibleSubtotal: 30000 })
  })
  it('never discounts more than the eligible amount', () => {
    const r = evaluateCoupon({ ...base, discount_type: 'fixed', value: 99999, minimum_order: 0 }, lines, { now })
    expect(r).toMatchObject({ ok: true, discount: 34000 })
  })
})
