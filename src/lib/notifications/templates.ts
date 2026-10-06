import { siteUrl } from '@/lib/env'
import { DELIVERY_TBC_NOTE, deliveryFeeLabel, isStorePickup } from '@/lib/ecommerce/delivery'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, paymentMethodLabels, type OrderStatus, type PaymentMethod } from '@/lib/ecommerce/orders'

export type OrderEmailData = {
  orderNumber: string
  accessToken: string
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  total: number
  subtotal: number
  discount: number
  deliveryFee: number
  paymentMethod: PaymentMethod
  deliveryZone: string | null
  deliveryAddress: string
  items: { name: string; sku?: string | null; quantity: number; total: number }[]
  status?: OrderStatus
  receipt?: string | null
}

/** Contact address shown under every email. */
export const EMAIL_CONTACT = 'info@cisssolutions.co.ke'

// Dark order card: brand wordmark, a card with a coloured top edge and status label,
// greeting, details, item list, totals and one button. Table layout with inline styles
// so it renders the same in Gmail, Outlook and phone mail apps.
const C = {
  page: '#1b1b1b',
  card: '#111111',
  cardBorder: '#2e2e2e',
  text: '#ffffff',
  body: '#c9c9c9',
  muted: '#9a9a9a',
  rule: '#3a3a3a',
  accent: '#2f8cff', // CISS blue: wordmark, total, button
}

/** Status colour for the card's top edge and label. */
export const TONES = {
  success: '#1fa34a',
  info: '#2f8cff',
  warning: '#e8a317',
  danger: '#e5484d',
} as const
type Tone = keyof typeof TONES

const FONT = "Roboto,'Helvetica Neue',Arial,sans-serif"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const firstName = (name: string) => esc(name.trim().split(/\s+/)[0] || name)

type Card = {
  tone: Tone
  /** Small uppercase label above the heading, e.g. "Order confirmed & paid". */
  label: string
  heading: string
  /** Already-escaped HTML paragraphs. */
  intro: string
  order?: OrderEmailData
  button?: { href: string; label: string }
  /** Extra escaped HTML below the button (staff emails). */
  after?: string
}

function layout(subject: string, card: Card) {
  const tone = TONES[card.tone]
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 28px;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:${C.text}">CISS<span style="color:${C.accent}">SOLUTIONS</span></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.cardBorder};border-top:4px solid ${tone};border-radius:18px;padding:36px 34px">
<p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:${tone}">${esc(card.label)}</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:${C.text}">${esc(card.heading)}</h1>
<div style="font-size:16px;line-height:1.65;color:${C.body}">${card.intro}</div>
${card.order ? orderTable(card.order) : ''}
${card.button ? button(card.button.href, card.button.label) : ''}
${card.after ?? ''}
</td></tr>
<tr><td align="center" style="padding:26px 12px 0;font-size:13px;line-height:1.6;color:${C.muted}">
Questions about your order? Email <a href="mailto:${EMAIL_CONTACT}" style="color:${C.text};text-decoration:none;font-weight:700">${EMAIL_CONTACT}</a><br>
CISS Solutions · Printers, spare parts, ink &amp; toner · <a href="${siteUrl}" style="color:${C.muted}">${siteUrl.replace(/^https?:\/\//, '')}</a>
</td></tr>
</table></td></tr></table></body></html>`
}

function orderTable(o: OrderEmailData) {
  const items = o.items
    .map(
      (i) => `<tr>
<td style="padding:14px 16px 14px 0;vertical-align:top"><div style="font-size:15px;font-weight:700;line-height:1.35;color:${C.text}">${esc(i.name)}</div>
<div style="padding-top:4px;font-size:13px;color:${C.muted}">${i.sku ? `${esc(i.sku)} × ${i.quantity}` : `× ${i.quantity}`}</div></td>
<td align="right" style="padding:14px 0;vertical-align:top;font-size:15px;font-weight:700;white-space:nowrap;color:${C.text}">${formatKES(i.total)}</td></tr>`,
    )
    .join('')
  const rule = `<tr><td colspan="2" style="padding:0"><div style="height:1px;line-height:1px;background:${C.rule}">&nbsp;</div></td></tr>`
  const row = (label: string, value: string) =>
    `<tr><td style="padding:14px 0;font-size:14px;color:${C.body}">${label}</td><td align="right" style="padding:14px 0;font-size:14px;white-space:nowrap;color:${C.body}">${esc(value)}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px">
${items}${rule}
${row('Subtotal', formatKES(o.subtotal))}${o.discount ? row('Discount', `-${formatKES(o.discount)}`) : ''}${row(isStorePickup(o.deliveryZone) ? 'Store pickup' : 'Delivery', deliveryFeeLabel(o.deliveryFee, o.deliveryZone))}${rule}
<tr><td style="padding:16px 0;font-size:17px;font-weight:800;color:${C.text}">Total</td><td align="right" style="padding:16px 0;font-size:17px;font-weight:800;white-space:nowrap;color:${C.accent}">${formatKES(o.total)}</td></tr>
</table>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 4px"><tr>
<td bgcolor="${C.accent}" style="border-radius:12px;background:${C.accent}"><a href="${href}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(label)}</a></td>
</tr></table>`
}

const orderLink = (o: OrderEmailData) => `${siteUrl}/order/${encodeURIComponent(o.orderNumber)}?t=${o.accessToken}`
const strong = (s: string) => `<strong style="color:${C.text};white-space:nowrap">${esc(s)}</strong>`

/** "Collection at …" / delivery sentence, as in the order card. */
function fulfilment(o: OrderEmailData) {
  if (isStorePickup(o.deliveryZone)) return `Collection at ${esc(o.deliveryAddress)}. We will call you when it is ready.`
  if (o.deliveryFee) return `Delivery to ${esc(o.deliveryAddress)}.`
  return `Delivery to ${esc(o.deliveryAddress)}. ${esc(DELIVERY_TBC_NOTE)}`
}

const textSummary = (o: OrderEmailData) =>
  [...o.items.map((i) => `- ${i.name}${i.sku ? ` (${i.sku})` : ''} x${i.quantity}: ${formatKES(i.total)}`), `Total: ${formatKES(o.total)}`].join('\n')
const textFooter = `\n\nQuestions? Email ${EMAIL_CONTACT}`

export function orderConfirmationEmail(o: OrderEmailData) {
  const subject = `Order received: ${o.orderNumber} | CISS Solutions`
  const awaitingMpesa = o.paymentMethod === 'mpesa'
  const payment = awaitingMpesa
    ? 'Complete the M&#8209;Pesa prompt on your phone to confirm it.'
    : `Payment: ${esc(paymentMethodLabels[o.paymentMethod])}.`
  const html = layout(subject, {
    tone: awaitingMpesa ? 'warning' : 'info',
    label: awaitingMpesa ? 'Order received · awaiting payment' : 'Order received',
    heading: `Thanks, ${o.customerName.trim().split(/\s+/)[0]}`,
    intro: `<p style="margin:0">We've received your order ${strong(o.orderNumber)}. ${payment} ${fulfilment(o)}</p>`,
    order: o,
    button: { href: orderLink(o), label: 'Track your order' },
  })
  return { subject, html, text: `Thanks for your order ${o.orderNumber}.\n\n${textSummary(o)}\n\nTrack: ${orderLink(o)}${textFooter}` }
}

export function paymentConfirmationEmail(o: OrderEmailData) {
  const subject = `Order confirmed: ${o.orderNumber} | CISS Solutions`
  const receipt = o.receipt ? `, M&#8209;Pesa receipt ${strong(o.receipt)}` : ''
  const html = layout(subject, {
    tone: 'success',
    label: 'Order confirmed & paid',
    heading: `Thanks, ${o.customerName.trim().split(/\s+/)[0]}`,
    intro: `<p style="margin:0">We've received your order ${strong(o.orderNumber)} and your payment has cleared${receipt}. ${fulfilment(o)}</p>`,
    order: o,
    button: { href: orderLink(o), label: 'Track your order' },
  })
  return {
    subject,
    html,
    text: `Payment received for ${o.orderNumber}${o.receipt ? ` (M-Pesa ${o.receipt})` : ''}.\n\n${textSummary(o)}\n\nTrack: ${orderLink(o)}${textFooter}`,
  }
}

export function orderStatusEmail(o: OrderEmailData & { status: OrderStatus }) {
  const copy: Partial<Record<OrderStatus, { tone: Tone; text: string }>> = {
    PROCESSING: { tone: 'info', text: 'We are preparing your order.' },
    READY_FOR_DISPATCH: {
      tone: 'info',
      text: isStorePickup(o.deliveryZone) ? 'Your order is packed and ready to collect.' : 'Your order is packed and ready for dispatch.',
    },
    SHIPPED: { tone: 'info', text: 'Your order is on its way with the courier.' },
    DELIVERED: { tone: 'success', text: 'Your order has been delivered. Thank you for shopping with us.' },
    CANCELLED: { tone: 'danger', text: 'Your order has been cancelled. If you paid, our team will contact you about the refund.' },
    REFUNDED: { tone: 'success', text: 'Your refund has been processed.' },
  }
  const c = copy[o.status] ?? { tone: 'info' as Tone, text: 'Your order status has changed.' }
  const subject = `Order ${orderStatusLabels[o.status].toLowerCase()}: ${o.orderNumber} | CISS Solutions`
  const html = layout(subject, {
    tone: c.tone,
    label: `Order ${orderStatusLabels[o.status]}`,
    heading: `Hi ${o.customerName.trim().split(/\s+/)[0]}`,
    intro: `<p style="margin:0">${esc(c.text)} Order ${strong(o.orderNumber)}.</p>`,
    order: o,
    button: { href: orderLink(o), label: 'Track your order' },
  })
  return { subject, html, text: `${c.text} Order ${o.orderNumber}.\n\n${orderLink(o)}${textFooter}` }
}

/** Staff alert. 'placed' goes out with every new order; 'paid' follows once an M-Pesa payment is confirmed. */
export function adminNewOrderEmail(o: OrderEmailData, stage: 'placed' | 'paid' = 'placed') {
  const method = paymentMethodLabels[o.paymentMethod]
  const awaiting = stage === 'placed' && o.paymentMethod === 'mpesa'
  const subject =
    stage === 'paid' ? `Payment received: order ${o.orderNumber} – ${formatKES(o.total)}` : `New order ${o.orderNumber} – ${formatKES(o.total)}${awaiting ? ' (awaiting payment)' : ''}`
  const intro =
    stage === 'paid'
      ? `${esc(o.customerName)} has paid for this order by ${esc(method)}${o.receipt ? ` (ref ${strong(o.receipt)})` : ''}.`
      : awaiting
        ? `${esc(o.customerName)} placed an order and is paying by ${esc(method)}. You will get another email when the payment is confirmed.`
        : `${esc(o.customerName)} placed an order paid by ${esc(method)}.`
  const pickup = isStorePickup(o.deliveryZone)
  const contact = [o.customerPhone ? `Phone: ${formatKenyanPhone(o.customerPhone)}` : null, o.customerEmail ? `Email: ${o.customerEmail}` : null].filter((l): l is string => Boolean(l))
  const delivery = pickup ? `${o.deliveryZone}: the customer will collect from the shop.` : `${o.deliveryZone ?? 'Delivery'}: ${o.deliveryAddress}. Call the customer to agree the courier and delivery cost.`
  const html = layout(subject, {
    tone: stage === 'paid' ? 'success' : awaiting ? 'warning' : 'info',
    label: stage === 'paid' ? 'Payment received' : awaiting ? 'New order · awaiting payment' : 'New order',
    heading: o.orderNumber,
    intro: `<p style="margin:0 0 12px">${intro}</p><p style="margin:0 0 12px">${contact.map(esc).join('<br>')}</p><p style="margin:0">${esc(delivery)}</p>`,
    order: o,
    button: { href: `${siteUrl}/admin/orders`, label: 'Open in admin' },
  })
  return { subject, html, text: [subject, intro.replace(/<[^>]+>/g, ''), ...contact, delivery, textSummary(o)].join('\n\n') }
}

export function adminLowStockEmail(items: { name: string; sku: string; available: number }[]) {
  const subject = `Low stock: ${items.length} product${items.length > 1 ? 's' : ''}`
  const list = items
    .map((i) => `<li style="margin:0 0 6px"><strong style="color:${C.text}">${esc(i.name)}</strong> <span style="color:${C.muted}">${esc(i.sku)}</span>: ${i.available} left</li>`)
    .join('')
  const html = layout(subject, {
    tone: 'warning',
    label: 'Low stock',
    heading: subject,
    intro: `<ul style="margin:0;padding-left:20px">${list}</ul>`,
    button: { href: `${siteUrl}/admin/inventory?low=1`, label: 'Review inventory' },
  })
  return { subject, html, text: `${subject}\n${items.map((i) => `${i.sku}: ${i.available}`).join('\n')}` }
}

export function welcomeEmail(name: string) {
  const subject = 'Welcome to CISS Solutions'
  const html = layout(subject, {
    tone: 'info',
    label: 'Account created',
    heading: `Welcome, ${name.trim().split(/\s+/)[0]}`,
    intro: `<p style="margin:0">Hi ${firstName(name)}, your account is ready. Track orders, save addresses and keep a wishlist of printers and parts.</p>`,
    button: { href: `${siteUrl}/account`, label: 'Go to your account' },
  })
  return { subject, html, text: `${subject}\n${siteUrl}/account${textFooter}` }
}
