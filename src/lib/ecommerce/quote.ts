import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Coupon, CouponError } from './coupons'
import { couponErrorMessages } from './coupons'
import { deliveryEstimate, resolveDeliveryZone, type DeliveryZone } from './delivery'
import { calculateTotals, lineTotal, type OrderTotals, type PricedLine } from './pricing'
import type { CartItemInput } from '@/lib/validation/cart'

export type QuoteLine = PricedLine & {
  slug: string
  available: number
  lineTotal: number
  compareAtPrice: number | null
}

export type QuoteIssue = {
  productId: string
  variantId: string | null
  kind: 'unavailable' | 'insufficient_stock' | 'variant_required'
  message: string
  available?: number
}

export type Quote = OrderTotals & {
  lines: QuoteLine[]
  issues: QuoteIssue[]
  zone: { id: string; name: string; estimate: string } | null
  coupon: { id: string; code: string } | null
  couponMessage: string | null
}

type QuoteOptions = {
  county?: string | null
  couponCode?: string | null
  customer?: { userId?: string | null; phone?: string | null; email?: string | null }
  maxPerItem?: number
}

/** Escapes LIKE wildcards so user input matches literally (case-insensitive equality). */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Prices a cart from the database. Client-supplied prices are never accepted:
 * the browser sends product/variant ids and quantities only.
 */
export async function quoteCart(items: CartItemInput[], opts: QuoteOptions = {}): Promise<Quote> {
  const db = createAdminClient()
  const productIds = [...new Set(items.map((i) => i.productId))]

  const [{ data: products, error }, { data: zones }] = await Promise.all([
    productIds.length
      ? db
          .from('products')
          .select(
            'id, name, slug, sku, price, compare_at_price, status, available_quantity, category_id, ' +
              'images:product_images(url, is_primary, sort_order), ' +
              'variants:product_variants(id, name, sku, price, compare_at_price, available_quantity, image_url, is_active)',
          )
          .in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    opts.county ? db.from('delivery_zones').select('*').eq('is_active', true) : Promise.resolve({ data: [] }),
  ])
  if (error) throw new Error(`quote: ${error.message}`)

  type Row = {
    id: string
    name: string
    slug: string
    sku: string
    price: number
    compare_at_price: number | null
    status: string
    available_quantity: number
    category_id: string | null
    images: { url: string; is_primary: boolean; sort_order: number }[]
    variants: { id: string; name: string; sku: string; price: number; compare_at_price: number | null; available_quantity: number; image_url: string | null; is_active: boolean }[]
  }
  const byId = new Map(((products ?? []) as unknown as Row[]).map((p) => [p.id, p]))

  // Category ancestry so category-restricted coupons match subcategories.
  const { data: categories } = await db.from('categories').select('id, parent_id')
  const parentOf = new Map((categories ?? []).map((c) => [c.id, c.parent_id]))
  const ancestry = (id: string | null) => {
    const out: string[] = []
    let cur = id
    while (cur && !out.includes(cur)) {
      out.push(cur)
      cur = parentOf.get(cur) ?? null
    }
    return out
  }

  const lines: QuoteLine[] = []
  const issues: QuoteIssue[] = []
  const maxPerItem = opts.maxPerItem ?? 20

  for (const item of items) {
    const product = byId.get(item.productId)
    if (!product || product.status !== 'active') {
      issues.push({ productId: item.productId, variantId: item.variantId, kind: 'unavailable', message: 'This product is no longer available.' })
      continue
    }
    const activeVariants = product.variants.filter((v) => v.is_active)
    const variant = item.variantId ? activeVariants.find((v) => v.id === item.variantId) : null
    if (activeVariants.length > 0 && !variant) {
      issues.push({
        productId: item.productId,
        variantId: item.variantId,
        kind: item.variantId ? 'unavailable' : 'variant_required',
        message: item.variantId ? 'This option is no longer available.' : 'Please choose an option for this product.',
      })
      continue
    }
    const available = Math.max(0, variant ? variant.available_quantity : product.available_quantity)
    if (available <= 0) {
      issues.push({ productId: item.productId, variantId: item.variantId, kind: 'unavailable', message: 'Out of stock.', available: 0 })
      continue
    }
    let quantity = Math.min(item.quantity, maxPerItem)
    if (quantity > available) {
      issues.push({
        productId: item.productId,
        variantId: item.variantId,
        kind: 'insufficient_stock',
        message: `Only ${available} available. Quantity updated.`,
        available,
      })
      quantity = available
    }
    const image =
      variant?.image_url ?? [...product.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]?.url ?? null
    const unitPrice = Number(variant ? variant.price : product.price)
    const compare = variant ? variant.compare_at_price : product.compare_at_price
    const line: PricedLine = {
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product.sku,
      imageUrl: image,
      categoryIds: ancestry(product.category_id),
      unitPrice,
      quantity,
    }
    lines.push({
      ...line,
      slug: product.slug,
      available,
      lineTotal: lineTotal(line),
      compareAtPrice: compare == null ? null : Number(compare),
    })
  }

  const zone = opts.county ? resolveDeliveryZone((zones ?? []) as unknown as DeliveryZone[], opts.county) : null

  let coupon: Coupon | null = null
  let couponMessage: string | null = null
  let customerUses = 0
  if (opts.couponCode?.trim()) {
    const { data } = await db.from('coupons').select('*').ilike('code', escapeLike(opts.couponCode.trim())).maybeSingle()
    if (!data) {
      couponMessage = 'This coupon code is not valid.'
    } else {
      coupon = { ...(data as unknown as Coupon), value: Number(data.value), minimum_order: Number(data.minimum_order), maximum_discount: data.maximum_discount == null ? null : Number(data.maximum_discount) }
      const c = opts.customer
      if (coupon.per_customer_limit != null && c && (c.userId || c.phone || c.email)) {
        const ors = [
          c.userId ? `user_id.eq.${c.userId}` : null,
          c.phone ? `customer_phone.eq.${c.phone}` : null,
          c.email ? `customer_email.eq.${c.email.toLowerCase()}` : null,
        ].filter(Boolean)
        const { count } = await db.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).or(ors.join(','))
        customerUses = count ?? 0
      }
    }
  }

  const totals = calculateTotals(lines, { coupon, couponCustomerUses: customerUses, zone })
  const couponError: CouponError | null = totals.couponError
  if (couponError) couponMessage = couponErrorMessages[couponError]

  return {
    ...totals,
    lines,
    issues,
    zone: zone ? { id: zone.id, name: zone.name, estimate: deliveryEstimate(zone) } : null,
    coupon: coupon && !couponError ? { id: coupon.id, code: coupon.code.toUpperCase() } : null,
    couponMessage,
  }
}
