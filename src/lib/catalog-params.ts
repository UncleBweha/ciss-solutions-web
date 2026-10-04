import type { CatalogQuery, CatalogSort, ProductType } from '@/types/catalog'
import { catalogSorts } from '@/types/catalog'
import { param, paramList } from '@/lib/utils'

export type SearchParams = Record<string, string | string[] | undefined>

export const productTypeLabels: Record<ProductType, string> = {
  printer: 'Printers',
  spare_part: 'Spare parts',
  ink_toner: 'Ink & toner',
  scanner: 'Scanners',
  paper: 'Paper & media',
  accessory: 'Accessories',
  simple: 'Other',
  variable: 'Other (options)',
}

const validTypes = new Set(Object.keys(productTypeLabels))
const validSorts = new Set<string>([...Object.keys(catalogSorts), 'relevance', 'discount'])

function num(value: string | undefined) {
  if (value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * URL search params -> catalogue query. Invalid values are dropped rather than
 * trusted (the database function validates again).
 */
export function parseCatalogParams(sp: SearchParams, fixed: Partial<CatalogQuery> = {}): CatalogQuery {
  const sort = param(sp.sort)
  const rating = num(param(sp.rating))
  const page = Math.floor(num(param(sp.page)) ?? 1)
  return {
    q: param(sp.q)?.slice(0, 100) || undefined,
    category: param(sp.category) || undefined,
    brands: paramList(sp.brand).slice(0, 20),
    minPrice: num(param(sp.min)),
    maxPrice: num(param(sp.max)),
    inStock: param(sp.stock) === '1',
    minRating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
    onSale: param(sp.sale) === '1',
    types: paramList(sp.type).filter((t) => validTypes.has(t)) as ProductType[],
    sort: sort && validSorts.has(sort) ? (sort as CatalogSort) : param(sp.q) ? 'relevance' : 'featured',
    page: Math.max(1, Math.min(page, 500)),
    perPage: 24,
    ...fixed,
  }
}

/** Builds a URL that keeps current params, applying overrides (undefined removes). */
export function withParams(path: string, current: SearchParams, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(current)) {
    const v = Array.isArray(value) ? value.join(',') : value
    if (v) params.set(key, v)
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === '') params.delete(key)
    else params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export function activeFilterCount(sp: SearchParams) {
  return ['brand', 'min', 'max', 'stock', 'rating', 'sale', 'type', 'category'].filter((k) => param(sp[k])).length
}
