import type { Database } from '@/types/database'

export type OrderStatus = Database['public']['Enums']['order_status']
export type PaymentStatus = Database['public']['Enums']['payment_status']
export type PaymentMethod = Database['public']['Enums']['payment_method']

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PAYMENT_PENDING: 'Awaiting payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for dispatch',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cash_on_delivery: 'Cash on delivery',
  mpesa_paybill: 'M-Pesa Paybill',
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function orderStatusTone(status: OrderStatus): Tone {
  switch (status) {
    case 'DELIVERED':
    case 'PAID':
      return 'success'
    case 'PROCESSING':
    case 'READY_FOR_DISPATCH':
    case 'SHIPPED':
      return 'info'
    case 'PENDING':
    case 'PAYMENT_PENDING':
      return 'warning'
    case 'CANCELLED':
    case 'FAILED':
    case 'REFUNDED':
      return 'danger'
  }
}

export function paymentStatusTone(status: PaymentStatus): Tone {
  if (status === 'PAID') return 'success'
  if (status === 'PENDING' || status === 'PROCESSING') return 'warning'
  return 'danger'
}

/** Methods staff confirm by hand; mpesa (STK) and card are confirmed by the provider. */
export function isManualPayment(method: PaymentMethod) {
  return method === 'bank_transfer' || method === 'cash_on_delivery' || method === 'mpesa_paybill'
}

/**
 * Paid by the customer themselves, outside the site (Paybill, bank transfer): the order
 * waits until staff have checked the money arrived and marked it Paid.
 */
export function awaitsPaymentConfirmation(method: PaymentMethod) {
  return method === 'mpesa_paybill' || method === 'bank_transfer'
}

/** Next statuses staff may choose (mirrors update_order_status() in the database). */
export function allowedTransitions(status: OrderStatus, method: PaymentMethod): OrderStatus[] {
  const manual = isManualPayment(method)
  switch (status) {
    case 'PENDING':
      return manual ? ['PAID', 'PROCESSING', 'CANCELLED'] : ['PROCESSING', 'CANCELLED']
    case 'PAYMENT_PENDING':
      return ['CANCELLED']
    case 'PAID':
      return ['PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']
    case 'PROCESSING':
      return ['READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED', 'REFUNDED']
    case 'READY_FOR_DISPATCH':
      return ['SHIPPED', 'CANCELLED', 'REFUNDED']
    case 'SHIPPED':
      return ['DELIVERED', 'REFUNDED']
    case 'DELIVERED':
      return ['REFUNDED']
    case 'FAILED':
      return ['CANCELLED']
    default:
      return []
  }
}

export type TimelineStep = { key: string; label: string; done: boolean; current: boolean }

/** Customer-facing tracking timeline. */
export function orderTimeline(order: {
  order_status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
}): TimelineStep[] {
  const rank: Record<OrderStatus, number> = {
    PENDING: 0,
    PAYMENT_PENDING: 0,
    FAILED: 0,
    CANCELLED: 0,
    REFUNDED: 0,
    PAID: 1,
    PROCESSING: 2,
    READY_FOR_DISPATCH: 2,
    SHIPPED: 3,
    DELIVERED: 4,
  }
  const paid = order.payment_status === 'PAID' || order.payment_status === 'REFUNDED'
  const r = rank[order.order_status]
  // Cash on delivery is "confirmed" once staff start processing.
  const confirmed = paid || (order.payment_method !== 'mpesa' && order.payment_method !== 'card' && r >= 2)
  const steps = [
    { key: 'placed', label: 'Order placed', done: true },
    {
      key: 'payment',
      label: order.payment_method === 'cash_on_delivery' ? 'Order confirmed' : 'Payment confirmed',
      done: confirmed || r >= 1,
    },
    { key: 'processing', label: 'Processing', done: r >= 2 },
    { key: 'dispatched', label: 'Dispatched', done: r >= 3 },
    { key: 'delivered', label: 'Delivered', done: r >= 4 },
  ]
  const firstOpen = steps.findIndex((s) => !s.done)
  return steps.map((s, i) => ({ ...s, current: i === firstOpen }))
}

export function isTerminalFailure(status: OrderStatus) {
  return status === 'CANCELLED' || status === 'FAILED' || status === 'REFUNDED'
}
