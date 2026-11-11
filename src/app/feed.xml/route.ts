import { getSettings } from '@/lib/catalog'
import { tags } from '@/lib/cache'
import { isSupabaseConfigured, siteUrl } from '@/lib/env'
import { merchantFeed, type FeedProduct } from '@/lib/seo/feed'
import { publicClient } from '@/lib/supabase/public'

// Google Merchant Center fetches the feed about daily; an hour keeps prices and stock close.
export const revalidate = 3600

/** Product feed for Google Merchant Center (free Shopping listings). Register this URL there. */
export async function GET() {
  const products: FeedProduct[] = []
  if (isSupabaseConfigured) {
    const client = publicClient([tags.catalog], 3600)
    for (let from = 0; ; from += 500) {
      const { data, error } = await client
        .from('products')
        .select(
          `id, sku, slug, name, short_description, description, price, compare_at_price, available_quantity, part_number, barcode, condition,
          brand:brands(name), category:categories(name),
          images:product_images(url, is_primary, sort_order, variant_id),
          variants:product_variants(price, compare_at_price, available_quantity, sort_order, is_active)`,
        )
        .eq('status', 'active')
        .order('slug')
        .range(from, from + 499)
      // Fail rather than cache a feed missing part of the catalogue: Google would delist those items.
      if (error) throw new Error(`feed products: ${error.message}`)
      for (const p of data) {
        products.push({
          ...p,
          price: Number(p.price),
          compare_at_price: p.compare_at_price == null ? null : Number(p.compare_at_price),
          brand: p.brand?.name ?? null,
          category: p.category?.name ?? null,
          images: [...p.images]
            .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.variant_id != null) - Number(b.variant_id != null) || a.sort_order - b.sort_order)
            .map((i) => i.url),
          variants: p.variants
            .filter((v) => v.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => ({ price: Number(v.price), compare_at_price: v.compare_at_price == null ? null : Number(v.compare_at_price), available_quantity: v.available_quantity ?? 0 })),
        })
      }
      if (data.length < 500) break
    }
  }
  const { business } = await getSettings()
  return new Response(merchantFeed(products, { url: siteUrl, name: business.name }), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
