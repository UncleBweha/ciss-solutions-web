import type { Metadata } from 'next'
import { formatKES } from '@/lib/ecommerce/money'
import { truncate } from '@/lib/utils'
import type { ProductDetail } from '@/types/catalog'

/** Product metadata with sensible defaults when SEO fields are empty. */
export function productMetadata(product: ProductDetail): Metadata {
  const title = product.seo_title || `${product.name} Price in Kenya`
  const description = truncate(product.seo_description || productSnippet(product), 160)
  const image = shareableImage(product.og_image_url) ?? product.images.map((i) => shareableImage(i.url)).find(Boolean) ?? DEFAULT_IMAGE
  const canonical = product.canonical_url || `/p/${product.slug}`
  return {
    title: { absolute: withSiteName(title) },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: SITE,
      locale: 'en_KE',
      title: product.og_title || title,
      description: product.og_description || description,
      url: canonical,
      images: [{ url: image, alt: product.name }],
    },
    twitter: { card: 'summary_large_image', title: product.og_title || title, description: product.og_description || description, images: [image] },
  }
}

/**
 * The search-result snippet when staff have not written one. Most catalogue descriptions just
 * repeat the product name, which gives a searcher no reason to click; a short one is rounded off
 * with the price, stock and how to buy, the things people compare in the results.
 */
export function productSnippet(
  product: Pick<ProductDetail, 'name' | 'short_description' | 'description' | 'price' | 'available_quantity'> & {
    variants: { price: number; available_quantity: number }[]
  },
): string {
  const base = (product.short_description || product.description || '').replace(/\s+/g, ' ').trim()
  if (base.length >= 110) return base
  const prices = product.variants.length ? product.variants.map((v) => v.price) : [product.price]
  const low = Math.min(...prices)
  const price = `${prices.length > 1 && Math.max(...prices) > low ? 'From ' : ''}${formatKES(low)}`
  const inStock = product.variants.length ? product.variants.some((v) => v.available_quantity > 0) : (product.available_quantity ?? 0) > 0
  const lead = base && base.toLowerCase() !== product.name.toLowerCase() ? base.replace(/\.?$/, '.') : `Buy ${product.name} in Kenya.`
  return `${lead} ${price}${inStock ? ', in stock' : ''}. Delivery across Kenya, pay with M-Pesa.`
}

const SITE = 'CISS Solutions'

/** The site's default share card (app/opengraph-image.tsx) for pages without a picture of their own. */
const DEFAULT_IMAGE = '/opengraph-image'

/**
 * "<title> | CISS Solutions", unless that runs past what Google shows (about 60
 * characters): then the page's own words matter more than the name.
 */
export function withSiteName(title: string) {
  if (title.includes('CISS')) return title
  const full = `${title} | ${SITE}`
  return full.length <= 62 ? full : title
}

/** Raster images only: social networks and Google do not show SVG previews. */
export const shareableImage = (url: string | null | undefined) => (url && !/\.svg(\?|$)/i.test(url) ? url : undefined)

/**
 * Metadata for a public page: title, description, canonical, and the same title and
 * description for link previews (WhatsApp, Facebook, X), which otherwise fall back to the
 * homepage's. `absolute` titles are used as written; others get " | CISS Solutions".
 */
export function pageMetadata({
  title,
  absolute,
  description,
  path,
  image,
  robots,
}: {
  title: string
  absolute?: boolean
  description: string
  path: string
  image?: string | null
  robots?: Metadata['robots']
}): Metadata {
  const fullTitle = absolute ? title : withSiteName(title)
  // A one-line description leaves Google to pick random page text; round it off instead.
  const base = description.trim()
  const tail = 'Shop online at CISS Solutions with delivery across Kenya.'
  const desc = truncate(!base ? tail : base.length < 90 && !/kenya/i.test(base) ? `${base.replace(/\.?$/, '.')} ${tail}` : base, 160)
  const img = shareableImage(image) ?? DEFAULT_IMAGE
  return {
    title: { absolute: fullTitle },
    description: desc,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE, locale: 'en_KE', url: path, title: fullTitle, description: desc, images: [{ url: img, alt: title }] },
    twitter: { card: 'summary_large_image', title: fullTitle, description: desc, images: [img] },
    robots,
  }
}

/**
 * Listing pages: filtered/sorted/paged variants point their canonical at the
 * clean URL and are kept out of the index to avoid duplicate content.
 */
export function listingRobots(searchParams: Record<string, string | string[] | undefined>): Metadata['robots'] {
  return isFilteredListing(searchParams) ? { index: false, follow: true } : undefined
}

/** What changes which products a listing shows (see parseCatalogParams). */
const LISTING_FILTERS = ['q', 'category', 'brand', 'min', 'max', 'stock', 'rating', 'sale', 'type', 'sort']

/**
 * Whether the address asks for a filtered or sorted view. Anything else in it (utm_source,
 * fbclid and the like, added by shared and advertised links) shows the same page as the
 * clean address and must not take it out of the index.
 */
export function isFilteredListing(searchParams: Record<string, string | string[] | undefined>) {
  return LISTING_FILTERS.some((key) => searchParams[key] !== undefined)
}
