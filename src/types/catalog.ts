import type { Database } from './database'

type Tables = Database['public']['Tables']

export type ProductType = Database['public']['Enums']['product_type']

/** A row of the product_cards view (listing data). */
export type ProductCardData = {
  id: string
  name: string
  slug: string
  sku: string
  product_type: ProductType
  short_description: string | null
  part_number: string | null
  price: number
  compare_at_price: number | null
  discount_percent: number
  available_quantity: number
  low_stock_threshold: number
  is_featured: boolean
  is_bestseller: boolean
  is_new: boolean
  is_on_sale: boolean
  rating_avg: number
  rating_count: number
  sales_count: number
  created_at: string
  brand_id: string | null
  category_id: string | null
  brand_name: string | null
  brand_slug: string | null
  category_name: string | null
  category_slug: string | null
  image_url: string | null
  image_alt: string | null
  has_variants: boolean
}

export type Brand = Tables['brands']['Row']
export type Category = Tables['categories']['Row']
export type PrinterModel = Tables['printer_models']['Row']
export type HomepageBanner = Tables['homepage_banners']['Row']
export type HomepageSection = Tables['homepage_sections']['Row']
export type DeliveryZoneRow = Tables['delivery_zones']['Row']

export type CategoryNode = Category & { product_count: number; children: CategoryNode[]; path: string[] }

export type Spec = { label: string; value: string }

export type ProductImage = { id: string; url: string; alt_text: string | null; sort_order: number; is_primary: boolean; variant_id: string | null }

export type ProductVariant = {
  id: string
  name: string
  sku: string
  option_values: Record<string, string>
  price: number
  compare_at_price: number | null
  available_quantity: number
  low_stock_threshold: number
  image_url: string | null
  sort_order: number
}

export type CompatibleModel = { id: string; name: string; model_number: string; slug: string; brand_name: string | null; notes: string | null }

export type Review = {
  id: string
  author_name: string | null
  rating: number
  title: string | null
  comment: string | null
  photos: string[]
  is_verified_purchase: boolean
  created_at: string
}

export type ProductDetail = Omit<
  Tables['products']['Row'],
  'specifications' | 'search_text' | 'search_vector' | 'price' | 'compare_at_price' | 'rating_avg'
> & {
  price: number
  compare_at_price: number | null
  rating_avg: number
  specifications: Spec[]
  brand: Pick<Brand, 'id' | 'name' | 'slug'> | null
  category: Pick<Category, 'id' | 'name' | 'slug' | 'parent_id'> | null
  categoryPath: Pick<Category, 'name' | 'slug'>[]
  images: ProductImage[]
  variants: ProductVariant[]
  compatibility: CompatibleModel[]
  printerModel: Pick<PrinterModel, 'id' | 'name' | 'model_number' | 'slug'> | null
  reviews: Review[]
}

export type CatalogQuery = {
  q?: string
  category?: string
  brands?: string[]
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  minRating?: number
  onSale?: boolean
  types?: ProductType[]
  printerModelId?: string
  sort?: CatalogSort
  page?: number
  perPage?: number
}

export const catalogSorts = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  'best-selling': 'Best Selling',
  rating: 'Highest Rated',
} as const

export type CatalogSort = keyof typeof catalogSorts | 'relevance' | 'discount'

export type CatalogResult = { total: number; items: ProductCardData[]; page: number; pageCount: number; perPage: number }

export type BusinessSettings = {
  name: string
  tagline: string
  phone: string
  whatsapp: string
  email: string
  location: string
  address: string
  business_hours: string
  mpesa_paybill: string
  mpesa_account_hint: string
  socials: { instagram: string; facebook: string; tiktok: string; youtube: string }
}

export type PaymentMethodsSettings = {
  mpesa: { enabled: boolean; label: string }
  card: { enabled: boolean; label: string }
  bank_transfer: {
    enabled: boolean
    label: string
    bank_name: string
    account_name: string
    account_number: string
    branch: string
    instructions: string
  }
  cash_on_delivery: { enabled: boolean; label: string; counties: string[] }
  /** Manual Paybill: the customer pays themselves, staff mark the order paid. */
  mpesa_paybill: { enabled: boolean; label: string; paybill_number: string; account_number?: string; instructions: string }
}

export type CheckoutSettings = {
  mpesa_reservation_minutes: number
  bank_transfer_reservation_minutes: number
  max_quantity_per_item: number
}

export type SeoSettings = { default_title: string; default_description: string }

export type PublicSettings = {
  business: BusinessSettings
  payment_methods: PaymentMethodsSettings
  checkout: CheckoutSettings
  seo: SeoSettings
}
