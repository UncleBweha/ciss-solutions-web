import { describe, expect, it } from 'vitest'
import { awaitsPaymentConfirmation } from '@/lib/ecommerce/orders'
import { adminNewOrderEmail, orderConfirmationEmail, paymentConfirmationEmail, type OrderEmailData } from '@/lib/notifications/templates'

const order: OrderEmailData = {
  orderNumber: 'CS-48213',
  accessToken: '00000000-0000-4000-8000-0000000000aa',
  customerName: 'Wanjiku Kamau',
  customerPhone: '254712345678',
  customerEmail: 'wanjiku@example.com',
  total: 33499,
  subtotal: 33499,
  discount: 0,
  deliveryFee: 0,
  paymentMethod: 'mpesa_paybill',
  deliveryZone: 'Nairobi',
  deliveryAddress: 'Taveta Road, Nairobi',
  items: [{ name: 'Epson EcoTank L3250', sku: 'EPS-L3250', quantity: 1, total: 33499 }],
}

describe('emails for orders paid outside the site (Paybill, bank transfer)', () => {
  it('only Paybill and bank transfer wait for staff to confirm the money', () => {
    expect(awaitsPaymentConfirmation('mpesa_paybill')).toBe(true)
    expect(awaitsPaymentConfirmation('bank_transfer')).toBe(true)
    expect(awaitsPaymentConfirmation('mpesa')).toBe(false)
    expect(awaitsPaymentConfirmation('cash_on_delivery')).toBe(false)
  })

  it.each(['mpesa_paybill', 'bank_transfer'] as const)('at placement the customer is told the %s payment is still to be confirmed', (paymentMethod) => {
    const email = orderConfirmationEmail({ ...order, paymentMethod })
    expect(email.subject).toMatch(/awaiting payment confirmation/i)
    expect(email.html).toMatch(/awaiting payment confirmation/i)
    expect(email.html).toMatch(/not confirmed yet/i)
    expect(email.text).toMatch(/awaiting payment confirmation/i)
    expect(email.subject + email.html + email.text).not.toMatch(/confirmed &amp; paid|payment has cleared|has paid/i)
  })

  it('at placement staff are told to check the money, not that it is paid', () => {
    const email = adminNewOrderEmail(order, 'placed')
    expect(email.subject).toMatch(/awaiting payment confirmation/i)
    expect(email.html).toMatch(/NOT confirmed as paid/)
    expect(email.html).toMatch(/mark it Paid/)
    expect(email.subject + email.html + email.text).not.toMatch(/order paid by|has paid|\(paid\)/i)
  })

  it('once staff confirm, the customer and staff are told it is paid', () => {
    const customer = paymentConfirmationEmail(order)
    expect(customer.subject).toMatch(/order confirmed/i)
    expect(customer.html).toMatch(/confirmed your M-Pesa Paybill payment/)
    const staff = adminNewOrderEmail(order, 'paid')
    expect(staff.subject).toMatch(/^Payment confirmed: order CS-48213/)
    expect(staff.html).toMatch(/now paid/)
  })

  it('other methods keep their wording', () => {
    const cod = orderConfirmationEmail({ ...order, paymentMethod: 'cash_on_delivery' })
    expect(cod.subject).toMatch(/^Order received/)
    expect(cod.html).not.toMatch(/awaiting payment confirmation/i)
    const mpesa = adminNewOrderEmail({ ...order, paymentMethod: 'mpesa', receipt: 'NLJ7RT61SV' }, 'paid')
    expect(mpesa.subject).toMatch(/^New order CS-48213 .*\(paid\)$/)
    expect(mpesa.html).toMatch(/has paid by M-Pesa/)
  })
})
