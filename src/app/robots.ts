import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  // Non-production deployments (staging, previews) are never indexed.
  // The host exactly: staging.cisssolutions.co.ke contains the name too.
  const host = URL.canParse(siteUrl) ? new URL(siteUrl).hostname : ''
  const production = host === 'cisssolutions.co.ke' || process.env.ALLOW_INDEXING === 'true'
  return {
    rules: production
      ? [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/cart', '/order/', '/api/', '/auth/', '/login', '/register', '/search'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
