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

import { parseCatalogParams, withParams } from '@/lib/catalog-params'

describe('catalogue URL params', () => {
  it('parses filters from the URL', () => {
    expect(
      parseCatalogParams({ category: 'printers', brand: 'epson,hp', sort: 'price-asc', min: '1000', max: 'abc', stock: '1', type: 'printer,bogus', page: '2' }),
    ).toMatchObject({ category: 'printers', brands: ['epson', 'hp'], sort: 'price-asc', minPrice: 1000, maxPrice: undefined, inStock: true, types: ['printer'], page: 2 })
  })
  it('defaults to relevance when searching and ignores unknown sorts', () => {
    expect(parseCatalogParams({ q: 'L3250', sort: 'drop table' }).sort).toBe('relevance')
    expect(parseCatalogParams({}).sort).toBe('featured')
  })
  it('builds URLs that keep other params and reset as asked', () => {
    expect(withParams('/shop', { brand: 'epson', page: '3' }, { sort: 'newest', page: undefined })).toBe('/shop?brand=epson&sort=newest')
  })
})

import { csvRowSchema, parseCsv, productSchema } from '@/lib/validation/product'

describe('product CSV import', () => {
  it('parses quoted fields, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('name,sku,price\n"Epson L3250, Wi-Fi",EPS-1,32999\n"Toner ""59A""","HP-59A","14500"\r\n"Line\nbreak",X,1\n')
    expect(rows).toEqual([
      ['name', 'sku', 'price'],
      ['Epson L3250, Wi-Fi', 'EPS-1', '32999'],
      ['Toner "59A"', 'HP-59A', '14500'],
      ['Line\nbreak', 'X', '1'],
    ])
  })
  it('validates rows', () => {
    expect(csvRowSchema.safeParse({ name: 'Roller', sku: 'R-1', price: '2500', stock: '10' }).success).toBe(true)
    const bad = csvRowSchema.safeParse({ name: 'X', sku: '', price: 'abc', product_type: 'robot' })
    expect(bad.success).toBe(false)
  })
})

describe('product validation', () => {
  const base = {
    name: 'Test printer', slug: 'test-printer', sku: 'T-1', brandId: '', categoryId: '', printerModelId: '', productType: 'printer', status: 'active',
    price: '1000', compareAtPrice: '', costPrice: '', lowStockThreshold: '3', isFeatured: false, isBestseller: false, isNew: false, isOnSale: false,
    specifications: [], features: [], whatsIncluded: [], compatibility: [], variants: [],
  } as const
  it('accepts a valid product', () => {
    expect(productSchema.safeParse(base).success).toBe(true)
  })
  it('rejects compare-at price at or below the price and duplicate variant SKUs', () => {
    expect(productSchema.safeParse({ ...base, compareAtPrice: '900' }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, variants: [{ name: 'A', sku: 't-1', price: '1' }] }).success).toBe(false)
  })
  it('rejects bad slugs', () => {
    expect(productSchema.safeParse({ ...base, slug: 'Bad Slug!' }).success).toBe(false)
  })
})
