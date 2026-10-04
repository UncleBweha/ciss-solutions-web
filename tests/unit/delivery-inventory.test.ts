import { describe, expect, it } from 'vitest'
import { deliveryEstimate, deliveryFee, resolveDeliveryZone, type DeliveryZone } from '@/lib/ecommerce/delivery'
import { applyAdjustment, availableQuantity, clampQuantity, stockStatus } from '@/lib/ecommerce/inventory'
import { formatKenyanPhone, maskPhone, normalizeKenyanPhone, KENYA_COUNTIES } from '@/lib/ecommerce/kenya'

const zone = (over: Partial<DeliveryZone>): DeliveryZone => ({
  id: 'z', name: 'z', counties: [], fee: 0, free_delivery_threshold: null, estimated_days_min: 1,
  estimated_days_max: 3, estimate_label: null, is_default: false, is_active: true, ...over,
})
const zones = [
  zone({ id: 'nbi', name: 'Nairobi', counties: ['Nairobi'], fee: 200 }),
  zone({ id: 'metro', name: 'Metro', counties: ['Kiambu', 'Machakos'], fee: 300 }),
  zone({ id: 'closed', name: 'Closed', counties: ['Mombasa'], fee: 1, is_active: false }),
  zone({ id: 'other', name: 'Other', fee: 600, is_default: true }),
]

describe('delivery calculation', () => {
  it('resolves the zone by county, case-insensitively', () => {
    expect(resolveDeliveryZone(zones, 'nairobi')?.id).toBe('nbi')
    expect(resolveDeliveryZone(zones, 'Kiambu')?.id).toBe('metro')
  })
  it('falls back to the default zone and ignores inactive zones', () => {
    expect(resolveDeliveryZone(zones, 'Turkana')?.id).toBe('other')
    expect(resolveDeliveryZone(zones, 'Mombasa')?.id).toBe('other')
    expect(resolveDeliveryZone(zones.filter((z) => !z.is_default), 'Turkana')).toBeNull()
  })
  it('applies free-delivery thresholds', () => {
    const z = zone({ fee: 300, free_delivery_threshold: 10000 })
    expect(deliveryFee(z, 9999)).toBe(300)
    expect(deliveryFee(z, 10000)).toBe(0)
  })
  it('describes the estimate', () => {
    expect(deliveryEstimate({ estimate_label: null, estimated_days_min: 0, estimated_days_max: 1 })).toBe('Same day / next day')
    expect(deliveryEstimate({ estimate_label: null, estimated_days_min: 1, estimated_days_max: 3 })).toBe('1–3 business days')
  })
  it('lists all 47 counties', () => {
    expect(KENYA_COUNTIES).toHaveLength(47)
  })
})

describe('inventory calculation', () => {
  it('computes available stock', () => {
    expect(availableQuantity({ stock_quantity: 10, reserved_quantity: 3 })).toBe(7)
    expect(availableQuantity({ stock_quantity: 2, reserved_quantity: 3 })).toBe(0)
  })
  it('classifies stock levels', () => {
    expect(stockStatus(0, 5)).toBe('out_of_stock')
    expect(stockStatus(5, 5)).toBe('low_stock')
    expect(stockStatus(6, 5)).toBe('in_stock')
  })
  it('clamps quantities to availability and per-item cap', () => {
    expect(clampQuantity(5, 3)).toBe(3)
    expect(clampQuantity(50, 100, 20)).toBe(20)
    expect(clampQuantity(-2, 10)).toBe(0)
    expect(clampQuantity(2.7, 10)).toBe(2)
  })
  it('refuses adjustments below reserved stock', () => {
    expect(applyAdjustment({ stock_quantity: 10, reserved_quantity: 4 }, -5)).toEqual({ ok: true, stock: 5 })
    expect(applyAdjustment({ stock_quantity: 10, reserved_quantity: 4 }, -7).ok).toBe(false)
  })
})

describe('Kenyan phone numbers', () => {
  it('normalises common formats to 2547XXXXXXXX', () => {
    for (const input of ['0712345678', '+254712345678', '254712345678', '712345678', '0712 345 678']) {
      expect(normalizeKenyanPhone(input)).toBe('254712345678')
    }
    expect(normalizeKenyanPhone('0110123456')).toBe('254110123456')
  })
  it('rejects invalid numbers', () => {
    for (const input of ['12345', '0212345678', '25471234567', 'abc']) expect(normalizeKenyanPhone(input)).toBeNull()
  })
  it('formats and masks', () => {
    expect(formatKenyanPhone('254712345678')).toBe('0712 345 678')
    expect(maskPhone('254712345678')).toBe('0712 *** 678')
  })
})
