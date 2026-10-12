import type { MetadataRoute } from 'next'
import { categoryHref, flattenTree, getBrands, getCategoryTree, getPrinterModels } from '@/lib/catalog'
import { CONTENT_PAGES, getContentPage } from '@/lib/content'
import { isSupabaseConfigured, siteUrl } from '@/lib/env'
import { publicClient } from '@/lib/supabase/public'
import { tags } from '@/lib/cache'

export const revalidate = 3600

/** All indexable URLs: products, categories, brands and content pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const fixed: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/deals`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/brands`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/parts-finder`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/contact`, changeFrequency: 'monthly', priority: 0.5 },
  ]
  if (!isSupabaseConfigured) return fixed

  // Only content pages staff have marked as reviewed (drafts are noindex).
  const pages = await Promise.all(CONTENT_PAGES.map(async (p) => ((await getContentPage(p))?.reviewed ? p : null)))
  for (const p of pages) if (p) fixed.push({ url: `${siteUrl}/${p}`, changeFrequency: 'monthly', priority: 0.3 })

  const [tree, brands] = await Promise.all([getCategoryTree(), getBrands()])
  // Page through products so large catalogues are fully included.
  const products: { slug: string; updated_at: string }[] = []
  const client = publicClient([tags.catalog], 3600)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from('products').select('slug, updated_at').eq('status', 'active').order('slug').range(from, from + 999)
    // Fail rather than publish (and cache for an hour) a sitemap missing part of the catalogue.
    if (error) throw new Error(`sitemap products: ${error.message}`)
    products.push(...data)
    if (data.length < 1000) break
  }
  // "Parts for <printer>" pages: the address is the page's own canonical.
  const models = await getPrinterModels()

  return [
    ...fixed,
    ...models.map((m) => ({ url: `${siteUrl}/parts-finder?model=${encodeURIComponent(m.slug)}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...flattenTree(tree).map((c) => ({ url: `${siteUrl}${categoryHref(c)}`, lastModified: new Date(c.updated_at), changeFrequency: 'daily' as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: `${siteUrl}/b/${b.slug}`, lastModified: new Date(b.updated_at), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${siteUrl}/p/${p.slug}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}
