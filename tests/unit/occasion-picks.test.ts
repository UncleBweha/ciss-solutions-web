import { describe, expect, it } from 'vitest'
import { formulaDates, occasionCovers } from '@/lib/occasions/dates'
import { occasionFit, occasionPicks } from '@/lib/occasions/picks'
import type { ProductCardData } from '@/types/catalog'

const valentines = { slug: 'valentines-day', name: "Valentine's Day", kind: 'international', decoration: 'hearts', pickKeyword: null } as const
const service = { slug: 'customer-service-week', name: 'Customer Service Week', kind: 'international', decoration: 'none', pickKeyword: 'roller' } as const

function product(name: string, category_slug: string, available_quantity = 5) {
  return { name, category_slug, category_name: category_slug.replace(/-/g, ' '), product_type: 'simple', available_quantity } as Pick<
    ProductCardData,
    'name' | 'category_name' | 'category_slug' | 'product_type' | 'available_quantity'
  >
}

const photoPrinter = product('Epson L805 Wi-Fi Photo Printer', 'photo-printers')
const photoPaper = product('Epson Premium Glossy Photo Paper A4', 'paper-media')
const toner = product('HP 59A Black Toner', 'toner')
const roller = product('HP M404 Pickup Roller', 'pickup-rollers')
const fuser = product('HP M404 Fuser Unit', 'fuser-units')

describe('occasion picks', () => {
  it("picks photo printers and photo paper for Valentine's Day", () => {
    expect(occasionPicks(valentines, [toner, photoPaper, roller, photoPrinter]).map((p) => p.name)).toEqual([photoPrinter.name, photoPaper.name])
  })

  it('matches whole words only', () => {
    expect(occasionFit(valentines, product('Photocopier drum', 'spare-parts'))).toBe(0)
  })

  it("puts products matching the occasion's keyword first", () => {
    expect(occasionPicks(service, [fuser, roller])[0]).toBe(roller)
  })

  it('leaves out what is out of stock', () => {
    expect(occasionPicks(valentines, [product('Photo Printer', 'photo-printers', 0)])).toEqual([])
  })
})

describe('occasion dates', () => {
  it('covers ranges, including across New Year', () => {
    const newYear = { startMonth: 12, startDay: 31, endMonth: 1, endDay: 2 }
    expect(occasionCovers(newYear, 12, 31)).toBe(true)
    expect(occasionCovers(newYear, 1, 2)).toBe(true)
    expect(occasionCovers(newYear, 1, 3)).toBe(false)
    expect(occasionCovers({ startMonth: 10, startDay: 20, endMonth: 10, endDay: 20 }, 10, 20)).toBe(true)
  })

  it('puts Customer Service Week on the first full working week of October', () => {
    expect(formulaDates('customer_service_week', 2026)).toEqual({ start: { month: 10, day: 5 }, end: { month: 10, day: 9 } })
    expect(formulaDates('customer_service_week', 2029).start).toEqual({ month: 10, day: 1 })
  })

  it("dates Mother's and Father's Day by rule", () => {
    expect(formulaDates('mothers_day', 2026).start).toEqual({ month: 5, day: 10 })
    expect(formulaDates('fathers_day', 2026).start).toEqual({ month: 6, day: 21 })
  })
})
