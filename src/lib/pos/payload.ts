import { toCents } from '@/lib/ecommerce/money'
import type { PaymentMethod } from '@/lib/ecommerce/orders'

// What the POS is told about a paid website order (register_web_sale() in the POS project).
// The POS keeps its own catalogue and stock: lines are recorded by name and move no stock there.

/** Values of sales.payment_method in the POS. */
export type PosPaymentMethod = 'mpesa' | 'paybill' | 'bank' | 'cash'

const posPaymentMethod: Record<PaymentMethod, PosPaymentMethod> = {
  mpesa: 'mpesa',
  mpesa_paybill: 'paybill',
  bank_transfer: 'bank',
  card: 'bank',
  cash_on_delivery: 'cash',
}

export type PosSaleOrder = {
  orderNumber: string
  customerName: string
  customerPhone: string
  paymentMethod: PaymentMethod
  discount: number
  deliveryFee: number
  total: number
  deliveryZone: string | null
  paidAt: string | null
  items: { name: string; variantName: string | null; quantity: number; unitPrice: number }[]
}

export type PosSalePayload = {
  order_number: string
  customer_name: string
  customer_phone: string
  payment_method: PosPaymentMethod
  discount: number
  total: number
  paid_at: string | null
  items: { name: string; quantity: number; unit_price: number }[]
}

/** The POS has no delivery field, so a delivery fee travels as a line of its own. */
export function posSalePayload(order: PosSaleOrder): PosSalePayload {
  const items = order.items.map((i) => ({
    name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
    quantity: i.quantity,
    unit_price: i.unitPrice,
  }))
  if (toCents(order.deliveryFee) > 0) {
    items.push({ name: order.deliveryZone ? `Delivery (${order.deliveryZone})` : 'Delivery', quantity: 1, unit_price: order.deliveryFee })
  }
  return {
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    payment_method: posPaymentMethod[order.paymentMethod],
    discount: order.discount,
    total: order.total,
    paid_at: order.paidAt,
    items,
  }
}
