import type { Metadata } from 'next'
import { truncate } from '@/lib/utils'
import type { ProductDetail } from '@/types/catalog'

/** Product metadata with sensible defaults when SEO fields are empty. */
export function productMetadata(product: ProductDetail): Metadata {
  const title = product.seo_title || `${product.name} Price in Kenya`
  const description = truncate(
    product.seo_description ||
      product.short_description ||
      product.description ||
      `Buy ${product.name} in Kenya with nationwide delivery and M-Pesa payment.`,
    160,
  )
  const image = product.og_image_url || product.images[0]?.url
  const canonical = product.canonical_url || `/p/${product.slug}`
  return {
    title: { absolute: title.includes('CISS') ? title : `${title} | CISS Solutions` },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: product.og_title || title,
      description: product.og_description || description,
      url: canonical,
      images: image && !image.endsWith('.svg') ? [{ url: image, alt: product.name }] : undefined,
    },
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
