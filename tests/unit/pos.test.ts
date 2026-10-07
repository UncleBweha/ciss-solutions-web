import { describe, expect, it } from 'vitest'
import { posSalePayload, type PosSaleOrder } from '@/lib/pos/payload'

const order: PosSaleOrder = {
  orderNumber: 'CS-48213',
  customerName: 'Wanjiku Kamau',
  customerPhone: '254712345678',
  paymentMethod: 'mpesa_paybill',
  discount: 500,
  deliveryFee: 300,
  total: 33799,
  deliveryZone: 'Nairobi',
  paidAt: '2026-10-07T09:30:00.000Z',
  items: [
    { name: 'Epson EcoTank L3250', variantName: null, quantity: 1, unitPrice: 32999 },
    { name: 'Epson 003 Ink', variantName: 'Black', quantity: 2, unitPrice: 500 },
  ],
}

describe('POS sale payload', () => {
  it('sends the order lines, with the delivery fee as a line of its own', () => {
    const p = posSalePayload(order)
    expect(p).toMatchObject({ order_number: 'CS-48213', customer_name: 'Wanjiku Kamau', discount: 500, total: 33799, paid_at: '2026-10-07T09:30:00.000Z' })
    expect(p.items).toEqual([
      { name: 'Epson EcoTank L3250', quantity: 1, unit_price: 32999 },
      { name: 'Epson 003 Ink (Black)', quantity: 2, unit_price: 500 },
      { name: 'Delivery (Nairobi)', quantity: 1, unit_price: 300 },
    ])
  })

  it('adds up to the order total, which the POS checks', () => {
    const p = posSalePayload(order)
    const lines = p.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
    expect(lines - p.discount).toBe(p.total)
  })

  it('adds no delivery line when delivery is free', () => {
    const p = posSalePayload({ ...order, deliveryFee: 0, total: 33499 })
    expect(p.items).toHaveLength(2)
  })

  it('maps each payment method to one the POS knows', () => {
    const method = (paymentMethod: PosSaleOrder['paymentMethod']) => posSalePayload({ ...order, paymentMethod }).payment_method
    expect(method('mpesa_paybill')).toBe('paybill')
    expect(method('mpesa')).toBe('mpesa')
    expect(method('bank_transfer')).toBe('bank')
    expect(method('cash_on_delivery')).toBe('cash')
  })
})
