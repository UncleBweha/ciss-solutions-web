import { describe, expect, it } from 'vitest'
import { csvRowSchema } from '@/lib/validation/product'

describe('CSV product rows', () => {
  const row = { name: 'Epson 003 Black Ink', sku: 'EPS-003-BK', price: '650' }

  it('reads the price as a number', () => {
    expect(csvRowSchema.parse(row).price).toBe(650)
    expect(csvRowSchema.parse({ ...row, price: ' 1299.50 ' }).price).toBe(1299.5)
    expect(csvRowSchema.parse({ ...row, price: '0' }).price).toBe(0)
  })

  it('refuses an empty price instead of pricing the product at nothing', () => {
    expect(csvRowSchema.safeParse({ ...row, price: '' }).success).toBe(false)
    expect(csvRowSchema.safeParse({ ...row, price: '   ' }).success).toBe(false)
  })

  it('refuses a price that is not a number, or is negative', () => {
    expect(csvRowSchema.safeParse({ ...row, price: 'KSh 650' }).success).toBe(false)
    expect(csvRowSchema.safeParse({ ...row, price: '-5' }).success).toBe(false)
  })

  it('leaves the optional cells optional', () => {
    const parsed = csvRowSchema.parse({ ...row, stock: '', status: '', description: '' })
    expect(parsed.stock).toBe('')
    expect(parsed.status).toBe('')
  })
})
