import { siteUrl } from '@/lib/env'
import type { BusinessSettings, ProductDetail } from '@/types/catalog'

const abs = (path: string | null | undefined) => (!path ? undefined : path.startsWith('http') ? path : `${siteUrl}${path}`)

export function organizationSchema(business: BusinessSettings) {
  const sameAs = Object.values(business.socials ?? {}).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${siteUrl}/#organization`,
    name: business.name,
    url: siteUrl,
    logo: abs('/logo.webp'),
    image: abs('/logo.webp'),
    description: business.tagline,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address || undefined,
      addressLocality: business.location || 'Nairobi',
      addressCountry: 'KE',
    },
    openingHours: business.business_hours || undefined,
    currenciesAccepted: 'KES',
    paymentAccepted: 'M-Pesa, Cash, Bank Transfer',
    sameAs: sameAs.length ? sameAs : undefined,
  }
}

export function websiteSchema(name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: abs(item.href) })),
  }
}

export function productSchema(product: ProductDetail) {
  const available = product.variants.length
    ? product.variants.some((v) => v.available_quantity > 0)
    : (product.available_quantity ?? 0) > 0
  const offers = product.variants.length
    ? {
        '@type': 'AggregateOffer',
        priceCurrency: 'KES',
        lowPrice: Math.min(...product.variants.map((v) => v.price)),
        highPrice: Math.max(...product.variants.map((v) => v.price)),
        offerCount: product.variants.length,
        availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      }
    : {
        '@type': 'Offer',
        url: `${siteUrl}/p/${product.slug}`,
        priceCurrency: 'KES',
        price: product.price,
        availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': `${siteUrl}/#organization` },
      }
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description || product.description || undefined,
    sku: product.sku,
    mpn: product.part_number || undefined,
    gtin13: product.barcode && /^\d{13}$/.test(product.barcode) ? product.barcode : undefined,
    image: product.images.map((i) => abs(i.url)),
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name,
    offers,
    aggregateRating:
      product.rating_count > 0
        ? { '@type': 'AggregateRating', ratingValue: product.rating_avg, reviewCount: product.rating_count, bestRating: 5, worstRating: 1 }
        : undefined,
    review: product.reviews.slice(0, 5).map((r) => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      author: { '@type': 'Person', name: r.author_name || 'Customer' },
      name: r.title || undefined,
      reviewBody: r.comment || undefined,
      datePublished: r.created_at.slice(0, 10),
    })),
  }
}

export function collectionSchema(name: string, path: string, description?: string | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: `${siteUrl}${path}`,
    description: description || undefined,
    isPartOf: { '@type': 'WebSite', url: siteUrl },
  }
}
