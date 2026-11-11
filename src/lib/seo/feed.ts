import { conditionOf } from './schema'
import { shareableImage } from './metadata'

/** What the product feed needs of each active product. */
export type FeedProduct = {
  id: string
  sku: string
  slug: string
  name: string
  short_description: string | null
  description: string | null
  price: number
  compare_at_price: number | null
  available_quantity: number | null
  part_number: string | null
  barcode: string | null
  condition: string | null
  brand: string | null
  category: string | null
  /** Primary first. */
  images: string[]
  /** Active variants in display order. */
  variants: { price: number; compare_at_price: number | null; available_quantity: number }[]
}

const CONDITION = { NewCondition: 'new', RefurbishedCondition: 'refurbished', UsedCondition: 'used' } as const

const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const kes = (n: number) => `${n.toFixed(2)} KES`

/** Plain text from staff-written descriptions, which may hold simple markup. */
const plain = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The Google Merchant Center product feed (RSS 2.0 with the g: namespace), which lists the
 * products in Google's free Shopping listings and image results.
 *
 * A product with variants is one item at the price of the variant its page opens on (the
 * first in stock), so the feed's price matches the landing page as Google requires.
 * Shipping is not in the feed: the courier charge is confirmed per order, so it is set as
 * a rule in the Merchant Center account instead of being stated here.
 */
export function merchantFeed(products: FeedProduct[], site: { url: string; name: string }): string {
  const items = products
    .map((p) => {
      const images = p.images.map(shareableImage).filter((u): u is string => Boolean(u))
      // Google rejects items without a raster image.
      if (!images.length) return null
      const shown = p.variants.length ? (p.variants.find((v) => v.available_quantity > 0) ?? p.variants[0]) : null
      const price = shown ? shown.price : p.price
      const compareAt = shown ? shown.compare_at_price : p.compare_at_price
      const inStock = shown ? shown.available_quantity > 0 : (p.available_quantity ?? 0) > 0
      const description = plain(p.description || p.short_description || '') || `${p.name}. Delivery across Kenya, pay with M-Pesa.`
      const gtin = p.barcode && /^\d{8}$|^\d{12,14}$/.test(p.barcode) ? p.barcode : null
      const sale = compareAt != null && compareAt > price
      const fields: [string, string | null][] = [
        ['g:id', p.sku || p.id],
        ['g:title', p.name.slice(0, 150)],
        ['g:description', description.slice(0, 5000)],
        ['g:link', `${site.url}/p/${p.slug}`],
        ['g:image_link', images[0]],
        ...images.slice(1, 11).map((u): [string, string] => ['g:additional_image_link', u]),
        ['g:availability', inStock ? 'in_stock' : 'out_of_stock'],
        ['g:price', kes(sale ? compareAt : price)],
        ['g:sale_price', sale ? kes(price) : null],
        ['g:condition', CONDITION[conditionOf(p.condition)]],
        ['g:brand', p.brand],
        ['g:gtin', gtin],
        ['g:mpn', p.part_number],
        // Without a brand plus a GTIN or MPN, Google needs telling the item has no identifiers.
        ['g:identifier_exists', p.brand && (gtin || p.part_number) ? null : 'no'],
        ['g:product_type', p.category],
      ]
      const body = fields
        .filter((f): f is [string, string] => Boolean(f[1]))
        .map(([k, v]) => `<${k}>${xml(v)}</${k}>`)
        .join('')
      return `<item>${body}</item>`
    })
    .filter(Boolean)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xml(site.name)}</title>
<link>${xml(site.url)}</link>
<description>${xml(`${site.name} products`)}</description>
${items}
</channel>
</rss>
`
}
