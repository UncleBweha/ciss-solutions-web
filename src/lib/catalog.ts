import 'server-only'
import { cache } from 'react'
import { tags } from '@/lib/cache'
import { isSupabaseConfigured } from '@/lib/env'
import { logger } from '@/lib/logger'
import { CACHE, publicClient } from '@/lib/supabase/public'
import type {
  Brand,
  CatalogQuery,
  CatalogResult,
  Category,
  CategoryNode,
  CompatibleModel,
  DeliveryZoneRow,
  HomepageBanner,
  HomepageSection,
  PrinterModel,
  ProductCardData,
  ProductDetail,
  ProductVariant,
  PublicSettings,
  Spec,
} from '@/types/catalog'

// Public catalogue reads. Everything here is anonymous (RLS hides drafts) and
// cached in Next's data cache with tags from lib/cache.ts.

const DEFAULT_SETTINGS: PublicSettings = {
  business: {
    name: 'CISS Solutions',
    tagline: 'Printers, spare parts, ink & toner in Kenya',
    phone: '0721 578 080',
    whatsapp: '254721578080',
    email: 'info@cisssolutions.co.ke',
    location: 'Taveta Court, Taveta Road, Nairobi',
    address: 'Taveta Court, 2nd Floor, Room 217, Along Taveta Road, Nairobi',
    business_hours: '',
    mpesa_paybill: '',
    mpesa_account_hint: '',
    socials: { instagram: '', facebook: '', tiktok: '', youtube: '' },
  },
  payment_methods: {
    mpesa: { enabled: true, label: 'M-Pesa' },
    card: { enabled: false, label: 'Card' },
    bank_transfer: { enabled: false, label: 'Bank transfer', bank_name: '', account_name: '', account_number: '', branch: '', instructions: '' },
    cash_on_delivery: { enabled: false, label: 'Cash on delivery', counties: [] },
    mpesa_paybill: { enabled: false, label: 'M-Pesa Paybill', paybill_number: '', instructions: '' },
  },
  checkout: { mpesa_reservation_minutes: 30, bank_transfer_reservation_minutes: 2880, max_quantity_per_item: 20 },
  seo: {
    default_title: 'CISS Solutions | Printers, Spare Parts, Ink & Toner in Kenya',
    default_description:
      'Shop genuine printers, printer spare parts, ink, toner, scanners and accessories with nationwide delivery across Kenya.',
  },
}

/**
 * Without Supabase configured (e.g. a CI build) pages render empty instead of
 * failing. When Supabase *is* configured, errors propagate to error boundaries so
 * an outage never gets cached as an empty catalogue.
 */
async function read<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured) return fallback
  try {
    return await fn()
  } catch (error) {
    logger.error('catalog.read_failed', { label, error })
    throw error
  }
}

function must<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data as T
}

const toCard = (row: Record<string, unknown>): ProductCardData =>
  ({
    ...row,
    price: Number(row.price),
    compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price),
    rating_avg: Number(row.rating_avg ?? 0),
  }) as ProductCardData

// ---------------------------------------------------------------- settings

export const getSettings = cache(async (): Promise<PublicSettings> =>
  read('settings', DEFAULT_SETTINGS, async () => {
    const rows = must(
      await publicClient([tags.settings], CACHE.settings).from('settings').select('key, value').eq('is_public', true),
      'settings',
    )
    const merged = structuredClone(DEFAULT_SETTINGS) as Record<string, Record<string, unknown>>
    for (const row of rows) {
      if (row.key in merged) merged[row.key] = { ...merged[row.key], ...(row.value as Record<string, unknown>) }
    }
    return merged as unknown as PublicSettings
  }),
)

// ---------------------------------------------------------------- categories & brands

export const getCategories = cache(async (): Promise<Category[]> =>
  read('categories', [], async () =>
    must(
      await publicClient([tags.categories], CACHE.category).from('categories').select('*').eq('is_active', true).order('sort_order'),
      'categories',
    ),
  ),
)

/** Active categories as a tree with subtree product counts and URL paths. */
export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const [categories, counts] = await Promise.all([
    getCategories(),
    read('category_counts', [] as { category_id: string | null; product_count: number | null }[], async () =>
      must(await publicClient([tags.catalog], CACHE.catalog).from('category_product_counts').select('*'), 'category_counts'),
    ),
  ])
  const own = new Map(counts.map((c) => [c.category_id, c.product_count ?? 0]))
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, product_count: 0, children: [], path: [] }]))
  const roots: CategoryNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const walk = (node: CategoryNode, path: string[]): number => {
    node.path = [...path, node.slug]
    node.product_count = (own.get(node.id) ?? 0) + node.children.reduce((sum, child) => sum + walk(child, node.path), 0)
    return node.product_count
  }
  roots.forEach((r) => walk(r, []))
  return roots
})

export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)])
}

export function categoryHref(node: Pick<CategoryNode, 'path'>) {
  return `/c/${node.path.join('/')}`
}

/** Resolves /c/printers/ink-tank; returns null when the path is not canonical. */
export async function getCategoryByPath(segments: string[]) {
  const all = flattenTree(await getCategoryTree())
  const node = all.find((n) => n.slug === segments[segments.length - 1])
  if (!node) return null
  const canonical = node.path.join('/') === segments.join('/')
  const ancestors = node.path.slice(0, -1).map((slug) => all.find((n) => n.slug === slug)!).filter(Boolean)
  return { node, canonical, ancestors }
}

export async function getCategoryPathBySlug(slug: string) {
  const all = flattenTree(await getCategoryTree())
  return all.find((n) => n.slug === slug) ?? null
}

export const getBrands = cache(async (): Promise<Brand[]> =>
  read('brands', [], async () =>
    must(
      await publicClient([tags.brands], CACHE.brand).from('brands').select('*').eq('is_active', true).order('sort_order').order('name'),
      'brands',
    ),
  ),
)

export async function getBrand(slug: string) {
  return (await getBrands()).find((b) => b.slug === slug) ?? null
}

// ---------------------------------------------------------------- listings

export const searchCatalog = cache(async (query: CatalogQuery): Promise<CatalogResult> => {
  const perPage = Math.min(Math.max(query.perPage ?? 24, 1), 60)
  const page = Math.max(1, query.page ?? 1)
  const result = await read('catalog_search', { total: 0, items: [] as ProductCardData[] }, async () => {
    const data = must(
      await publicClient(
        [tags.catalog, ...(query.category ? [tags.category(query.category)] : []), ...(query.brands ?? []).map(tags.brand)],
        CACHE.catalog,
      ).rpc('catalog_search', {
        p_query: query.q?.trim() || undefined,
        p_category_slug: query.category || undefined,
        p_brand_slugs: query.brands?.length ? query.brands : undefined,
        p_min_price: query.minPrice,
        p_max_price: query.maxPrice,
        p_in_stock: query.inStock ?? false,
        p_min_rating: query.minRating,
        p_on_sale: query.onSale ?? false,
        p_product_types: query.types?.length ? query.types : undefined,
        p_printer_model_id: query.printerModelId || undefined,
        p_sort: query.sort ?? 'featured',
        p_limit: perPage,
        p_offset: (page - 1) * perPage,
      }),
      'catalog_search',
    ) as { total: number; items: Record<string, unknown>[] }
    return { total: Number(data.total), items: data.items.map(toCard) }
  })
  return { ...result, page, perPage, pageCount: Math.max(1, Math.ceil(result.total / perPage)) }
})

export async function getProductCards(
  filter: 'featured' | 'bestseller' | 'deals' | 'new',
  limit = 10,
): Promise<ProductCardData[]> {
  return read(`cards:${filter}`, [], async () => {
    let q = publicClient([tags.catalog], CACHE.homepage).from('product_cards').select('*').eq('status', 'active')
    if (filter === 'featured') q = q.eq('is_featured', true).order('sales_count', { ascending: false })
    if (filter === 'bestseller') q = q.order('is_bestseller', { ascending: false }).order('sales_count', { ascending: false })
    if (filter === 'deals') q = q.gt('discount_percent', 0).order('discount_percent', { ascending: false })
    if (filter === 'new') q = q.order('is_new', { ascending: false }).order('created_at', { ascending: false })
    return must(await q.limit(limit), filter).map((r) => toCard(r as Record<string, unknown>))
  })
}

export async function getCardsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return []
  return read('cards:ids', [], async () =>
    must(await publicClient([tags.catalog], CACHE.catalog).from('product_cards').select('*').in('id', ids), 'cards').map((r) =>
      toCard(r as Record<string, unknown>),
    ),
  )
}

// ---------------------------------------------------------------- product detail

export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> =>
  read('product', null, async () => {
    const client = publicClient([tags.product(slug), tags.catalog], CACHE.product)
    const { data, error } = await client
      .from('products')
      .select(
        `*,
        brand:brands(id, name, slug),
        category:categories(id, name, slug, parent_id),
        printer_model:printer_models(id, name, model_number, slug),
        images:product_images(id, url, alt_text, sort_order, is_primary, variant_id),
        variants:product_variants(id, name, sku, option_values, price, compare_at_price, available_quantity, low_stock_threshold, image_url, sort_order, is_active),
        compatibility:product_compatibility(compatibility_notes, model:printer_models(id, name, model_number, slug, brand:brands(name)))`,
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()
    if (error) throw new Error(`product: ${error.message}`)
    if (!data) return null

    const reviews = must(
      await client
        .from('reviews')
        .select('id, author_name, rating, title, comment, photos, is_verified_purchase, created_at')
        .eq('product_id', data.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50),
      'reviews',
    )

    const categoryPath = data.category ? (await getCategoryPathBySlug(data.category.slug))?.path ?? [data.category.slug] : []
    const all = flattenTree(await getCategoryTree())

    const {
      brand,
      category,
      printer_model,
      images,
      variants,
      compatibility,
      search_text: _searchText,
      search_vector: _searchVector,
      ...rest
    } = data
    void _searchText
    void _searchVector

    return {
      ...rest,
      price: Number(rest.price),
      compare_at_price: rest.compare_at_price == null ? null : Number(rest.compare_at_price),
      rating_avg: Number(rest.rating_avg),
      specifications: (Array.isArray(rest.specifications) ? rest.specifications : []) as Spec[],
      brand,
      category,
      categoryPath: categoryPath
        .map((s) => all.find((n) => n.slug === s))
        .filter((n): n is CategoryNode => Boolean(n))
        .map((n) => ({ name: n.name, slug: n.slug })),
      printerModel: printer_model,
      images: [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order),
      variants: variants
        .filter((v) => v.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (v): ProductVariant => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            option_values: (v.option_values ?? {}) as Record<string, string>,
            price: Number(v.price),
            compare_at_price: v.compare_at_price == null ? null : Number(v.compare_at_price),
            available_quantity: v.available_quantity ?? 0,
            low_stock_threshold: v.low_stock_threshold,
            image_url: v.image_url,
            sort_order: v.sort_order,
          }),
        ),
      compatibility: compatibility
        .filter((c) => c.model)
        .map(
          (c): CompatibleModel => ({
            id: c.model!.id,
            name: c.model!.name,
            model_number: c.model!.model_number,
            slug: c.model!.slug,
            brand_name: c.model!.brand?.name ?? null,
            notes: c.compatibility_notes,
          }),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
      reviews: reviews.map((r) => ({ ...r, photos: r.photos ?? [] })),
    }
  }),
)

/**
 * Cross-sell for a product page:
 *  - printers: parts and supplies compatible with this printer model
 *  - parts/supplies: other parts for the same printers
 *  - fallback: same category, then same brand
 */
export async function getRecommendations(product: ProductDetail, limit = 8) {
  const compatible: ProductCardData[] = []
  if (product.printerModel) {
    const r = await searchCatalog({ printerModelId: product.printerModel.id, perPage: limit + 1, sort: 'best-selling' })
    compatible.push(...r.items.filter((p) => p.id !== product.id))
  } else if (product.compatibility.length) {
    const r = await searchCatalog({ printerModelId: product.compatibility[0].id, perPage: limit + 1, sort: 'best-selling' })
    compatible.push(...r.items.filter((p) => p.id !== product.id))
  }

  const related: ProductCardData[] = []
  if (product.category) {
    const r = await searchCatalog({ category: product.category.slug, perPage: limit + 1, sort: 'best-selling' })
    related.push(...r.items.filter((p) => p.id !== product.id))
  }
  if (related.length < limit && product.brand) {
    const r = await searchCatalog({ brands: [product.brand.slug], perPage: limit + 1, sort: 'best-selling' })
    for (const p of r.items) if (p.id !== product.id && !related.some((x) => x.id === p.id)) related.push(p)
  }

  return {
    compatible: compatible.slice(0, limit),
    related: related.filter((p) => !compatible.some((c) => c.id === p.id)).slice(0, limit),
  }
}

// ---------------------------------------------------------------- printer models / parts finder

export const getPrinterModels = cache(async (): Promise<(PrinterModel & { brand_slug: string; brand_name: string })[]> =>
  read('printer_models', [], async () =>
    must(
      await publicClient([tags.printerModels], CACHE.catalog)
        .from('printer_models')
        .select('*, brand:brands(slug, name)')
        .order('name'),
      'printer_models',
    ).map(({ brand, ...m }) => ({ ...m, brand_slug: brand?.slug ?? '', brand_name: brand?.name ?? '' })),
  ),
)

// ---------------------------------------------------------------- homepage

export async function getHomepage() {
  return read(
    'homepage',
    { sections: [] as HomepageSection[], banners: [] as (HomepageBanner & { product: ProductCardData | null })[] },
    async () => {
      const client = publicClient([tags.homepage], CACHE.homepage)
      const [sections, banners] = await Promise.all([
        client.from('homepage_sections').select('*').eq('is_enabled', true).order('sort_order'),
        client.from('homepage_banners').select('*').order('sort_order'),
      ])
      const bannerRows = must(banners, 'banners')
      const productIds = bannerRows.map((b) => b.featured_product_id).filter((id): id is string => Boolean(id))
      const cards = await getCardsByIds(productIds)
      return {
        sections: must(sections, 'sections'),
        banners: bannerRows.map((b) => ({ ...b, product: cards.find((c) => c.id === b.featured_product_id) ?? null })),
      }
    },
  )
}

// ---------------------------------------------------------------- delivery

export const getDeliveryZones = cache(async (): Promise<DeliveryZoneRow[]> =>
  read('delivery_zones', [], async () =>
    must(
      await publicClient([tags.delivery], CACHE.settings).from('delivery_zones').select('*').eq('is_active', true).order('sort_order'),
      'delivery_zones',
    ),
  ),
)

/** Filter options for listing pages. */
export async function getFacets(opts: { categories?: boolean; brands?: boolean } = {}) {
  const [tree, brands] = await Promise.all([getCategoryTree(), getBrands()])
  const flat: { slug: string; name: string; depth: number }[] = []
  const walk = (nodes: CategoryNode[], depth: number) =>
    nodes.forEach((n) => {
      flat.push({ slug: n.slug, name: n.name, depth })
      walk(n.children, depth + 1)
    })
  walk(tree, 0)
  return {
    categories: opts.categories === false ? undefined : flat,
    brands: opts.brands === false ? undefined : brands.map((b) => ({ slug: b.slug, name: b.name })),
    types: ['printer', 'spare_part', 'ink_toner', 'scanner', 'paper', 'accessory'],
  }
}
