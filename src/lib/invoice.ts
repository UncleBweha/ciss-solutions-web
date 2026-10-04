import 'server-only'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatKES } from '@/lib/ecommerce/money'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { paymentMethodLabels } from '@/lib/ecommerce/orders'
import type { ViewerOrder } from '@/lib/orders'
import type { BusinessSettings } from '@/types/catalog'
import { formatDate } from '@/lib/utils'

// Standard PDF fonts are WinAnsi-encoded: replace characters they cannot draw.
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, '')

/** Server-side PDF invoice (pdf-lib, no headless browser required). */
export async function renderInvoicePdf(order: ViewerOrder, business: BusinessSettings, paymentReference: string | null) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Invoice ${order.order_number}`)
  pdf.setAuthor(business.name)
  const page = pdf.addPage([595.28, 841.89]) // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const navy = rgb(0.03, 0.08, 0.18)
  const muted = rgb(0.4, 0.45, 0.53)
  const blue = rgb(0.09, 0.55, 1)
  const { width, height } = page.getSize()
  const margin = 48

  const text = (p: PDFPage, s: string, x: number, y: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' } = {}) => {
    const font = opts.font ?? regular
    const size = opts.size ?? 10
    const value = clean(s)
    const w = font.widthOfTextAtSize(value, size)
    p.drawText(value, { x: opts.align === 'right' ? x - w : x, y, size, font, color: opts.color ?? navy })
  }

  // Header band
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: navy })
  const stripe = [rgb(0.02, 0.71, 0.83), rgb(0.86, 0.15, 0.47), rgb(0.98, 0.8, 0.08), rgb(0.89, 0.91, 0.94)]
  stripe.forEach((c, i) => page.drawRectangle({ x: (width / 4) * i, y: height - 100, width: width / 4, height: 4, color: c }))
  text(page, business.name, margin, height - 52, { font: bold, size: 22, color: rgb(1, 1, 1) })
  text(page, business.tagline, margin, height - 72, { size: 9, color: rgb(0.73, 0.78, 0.87) })
  text(page, 'INVOICE', width - margin, height - 52, { font: bold, size: 20, color: rgb(1, 1, 1), align: 'right' })

  let y = height - 135
  const businessLines = [business.address || business.location, business.phone, business.email].filter(Boolean)
  businessLines.forEach((l, i) => text(page, l, margin, y - i * 13, { size: 9, color: muted }))

  const meta: [string, string][] = [
    ['Invoice no.', `INV-${order.order_number.replace(/^CISS-/, '')}`],
    ['Order no.', order.order_number],
    ['Date', formatDate(order.paid_at ?? order.created_at)],
    ['Payment', paymentMethodLabels[order.payment_method]],
    ...(paymentReference ? ([['Payment ref.', paymentReference]] as [string, string][]) : []),
  ]
  meta.forEach(([k, v], i) => {
    text(page, k, width - margin - 150, y - i * 14, { size: 9, color: muted })
    text(page, v, width - margin, y - i * 14, { size: 9, font: bold, align: 'right' })
  })

  y -= Math.max(businessLines.length, meta.length) * 14 + 24
  text(page, 'BILL TO', margin, y, { font: bold, size: 9, color: blue })
  y -= 15
  ;[order.customer_name, formatKenyanPhone(order.customer_phone), order.customer_email, `${order.delivery_address}, ${order.delivery_town}, ${order.delivery_county}`].forEach((l, i) =>
    text(page, l, margin, y - i * 13, { size: 10, font: i === 0 ? bold : regular }),
  )
  y -= 4 * 13 + 24

  // Items table
  const cols = { item: margin, qty: width - margin - 210, unit: width - margin - 90, total: width - margin }
  page.drawRectangle({ x: margin - 8, y: y - 6, width: width - 2 * margin + 16, height: 22, color: rgb(0.94, 0.96, 0.98) })
  text(page, 'Item', cols.item, y, { font: bold, size: 9 })
  text(page, 'Qty', cols.qty, y, { font: bold, size: 9, align: 'right' })
  text(page, 'Unit price', cols.unit, y, { font: bold, size: 9, align: 'right' })
  text(page, 'Total', cols.total, y, { font: bold, size: 9, align: 'right' })
  y -= 22
  for (const item of order.items) {
    const name = item.variant_name ? `${item.product_name} (${item.variant_name})` : item.product_name
    const maxChars = 58
    text(page, name.length > maxChars ? name.slice(0, maxChars - 1) + '...' : name, cols.item, y, { size: 9 })
    text(page, `SKU ${item.sku}`, cols.item, y - 11, { size: 7.5, color: muted })
    text(page, String(item.quantity), cols.qty, y, { size: 9, align: 'right' })
    text(page, formatKES(item.unit_price), cols.unit, y, { size: 9, align: 'right' })
    text(page, formatKES(item.total_price), cols.total, y, { size: 9, align: 'right' })
    y -= 28
    if (y < 180) break // single-page invoice; very long orders are summarised
  }

  page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, color: rgb(0.85, 0.88, 0.92), thickness: 1 })
  const totals: [string, string, boolean][] = [
    ['Subtotal', formatKES(order.subtotal), false],
    ...(Number(order.discount) ? ([[`Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, `-${formatKES(order.discount)}`, false]] as [string, string, boolean][]) : []),
    ['Delivery', formatKES(order.delivery_fee), false],
    ['Total', formatKES(order.total), true],
  ]
  y -= 8
  totals.forEach(([k, v, strong]) => {
    text(page, k, cols.unit, y, { size: strong ? 12 : 10, font: strong ? bold : regular, align: 'right' })
    text(page, v, cols.total, y, { size: strong ? 12 : 10, font: strong ? bold : regular, align: 'right' })
    y -= strong ? 20 : 15
  })

  text(page, order.payment_status === 'PAID' ? 'PAID' : `Payment status: ${order.payment_status}`, margin, y + 18, {
    font: bold,
    size: 14,
    color: order.payment_status === 'PAID' ? rgb(0.13, 0.77, 0.37) : rgb(0.96, 0.62, 0.04),
  })
  text(page, `Thank you for shopping with ${business.name}.`, margin, 60, { size: 9, color: muted })
  text(page, 'Prices in Kenya Shillings (KES).', margin, 46, { size: 8, color: muted })

  return pdf.save()
}
