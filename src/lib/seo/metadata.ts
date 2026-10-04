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
  const keys = Object.keys(searchParams).filter((k) => searchParams[k] !== undefined && k !== 'page')
  return keys.length ? { index: false, follow: true } : undefined
}
