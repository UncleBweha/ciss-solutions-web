import { siteUrl } from '@/lib/env'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, paymentMethodLabels, type OrderStatus, type PaymentMethod } from '@/lib/ecommerce/orders'

export type OrderEmailData = {
  orderNumber: string
  accessToken: string
  customerName: string
  total: number
  subtotal: number
  discount: number
  deliveryFee: number
  paymentMethod: PaymentMethod
  deliveryZone: string | null
  deliveryAddress: string
  items: { name: string; quantity: number; total: number }[]
  status?: OrderStatus
  receipt?: string | null
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#ffffff;border-bottom:4px solid #0b6fd8;padding:20px 28px;color:#111827;font-size:20px;font-weight:800">CISS Solutions</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#06b6d4 0 25%,#db2777 25% 50%,#facc15 50% 75%,#e2e8f0 75%)"></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:22px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px">CISS Solutions · Printers, spare parts, ink &amp; toner in Kenya · <a href="${siteUrl}" style="color:#0b6fd8">${siteUrl.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`
}

function orderTable(o: OrderEmailData) {
  const rows = o.items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.quantity}</td><td align="right">${formatKES(i.total)}</td></tr>`)
    .join('')
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? 'font-weight:800' : 'color:#475569'}">${label}</td><td align="right" style="${bold ? 'font-weight:800' : ''}">${value}</td></tr>`
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:16px 0">${rows}
<tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:6px"></td></tr>
${line('Subtotal', formatKES(o.subtotal))}${o.discount ? line('Discount', `-${formatKES(o.discount)}`) : ''}${line('Delivery', formatKES(o.deliveryFee))}${line('Total', formatKES(o.total), true)}</table>`
}

const orderLink = (o: OrderEmailData) => `${siteUrl}/order/${encodeURIComponent(o.orderNumber)}?t=${o.accessToken}`
const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#0b6fd8;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${label}</a></p>`

const textSummary = (o: OrderEmailData) =>
  [...o.items.map((i) => `- ${i.name} x${i.quantity}: ${formatKES(i.total)}`), `Total: ${formatKES(o.total)}`].join('\n')

export function orderConfirmationEmail(o: OrderEmailData) {
  const title = `Order ${o.orderNumber} received`
  const html = layout(
    title,
    `<p>Hi ${esc(o.customerName.split(' ')[0])}, thank you for your order.</p>
<p>Payment: <strong>${paymentMethodLabels[o.paymentMethod]}</strong><br>Delivery: ${esc(o.deliveryZone ?? '')} – ${esc(o.deliveryAddress)}</p>
${orderTable(o)}${button(orderLink(o), 'View or track your order')}`,
  )
  return { subject: title, html, text: `${title}\n\n${textSummary(o)}\n\nTrack: ${orderLink(o)}` }
}

export function paymentConfirmationEmail(o: OrderEmailData) {
  const title = `Payment received for ${o.orderNumber}`
  const html = layout(
    title,
    `<p>We have received your payment of <strong>${formatKES(o.total)}</strong>${o.receipt ? ` (M-Pesa ref ${esc(o.receipt)})` : ''}. We are now preparing your order.</p>
${orderTable(o)}${button(orderLink(o), 'Track your order')}`,
  )
  return { subject: title, html, text: `${title}\n\n${textSummary(o)}\n\nTrack: ${orderLink(o)}` }
}

export function orderStatusEmail(o: OrderEmailData & { status: OrderStatus }) {
  const messages: Partial<Record<OrderStatus, string>> = {
    PROCESSING: 'Your order is being prepared.',
    READY_FOR_DISPATCH: 'Your order is packed and ready for dispatch.',
    SHIPPED: 'Your order is on its way.',
    DELIVERED: 'Your order has been delivered. Thank you for shopping with us!',
    CANCELLED: 'Your order has been cancelled. If you paid, our team will contact you about the refund.',
    REFUNDED: 'Your refund has been processed.',
  }
  const title = `Order ${o.orderNumber}: ${orderStatusLabels[o.status]}`
  const html = layout(title, `<p>${messages[o.status] ?? 'Your order status has changed.'}</p>${button(orderLink(o), 'View your order')}`)
  return { subject: title, html, text: `${title}\n\n${messages[o.status] ?? ''}\n\n${orderLink(o)}` }
}

export function adminNewOrderEmail(o: OrderEmailData) {
  const title = `New order ${o.orderNumber} – ${formatKES(o.total)}`
  const html = layout(
    title,
    `<p>${esc(o.customerName)} placed an order paid by ${paymentMethodLabels[o.paymentMethod]}.</p>${orderTable(o)}${button(`${siteUrl}/admin/orders`, 'Open in admin')}`,
  )
  return { subject: title, html, text: `${title}\n\n${textSummary(o)}` }
}

export function adminLowStockEmail(items: { name: string; sku: string; available: number }[]) {
  const title = `Low stock: ${items.length} product${items.length > 1 ? 's' : ''}`
  const list = items.map((i) => `<li>${esc(i.name)} (${esc(i.sku)}): ${i.available} left</li>`).join('')
  return { subject: title, html: layout(title, `<ul>${list}</ul>${button(`${siteUrl}/admin/inventory?low=1`, 'Review inventory')}`), text: `${title}\n${items.map((i) => `${i.sku}: ${i.available}`).join('\n')}` }
}

export function welcomeEmail(name: string) {
  const title = 'Welcome to CISS Solutions'
  return {
    subject: title,
    html: layout(title, `<p>Hi ${esc(name)}, your account is ready. Track orders, save addresses and keep a wishlist of printers and parts.</p>${button(`${siteUrl}/account`, 'Go to your account')}`),
    text: `${title}\n${siteUrl}/account`,
  }
}
