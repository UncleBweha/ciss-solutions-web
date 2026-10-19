import type { ProductCardData } from '@/types/catalog'
import { themeKeyFor, type OccasionThemeKey } from './themes'
import type { Occasion } from './types'

// Which products go with an occasion: photo printers and photo paper for
// Valentine's and Mother's Day, printers, ink and paper for Back to School,
// spare parts and maintenance kits in Customer Service Week...
//
// Matched on each product's name, category and type, so the picks are there
// without tagging anything. Products matching the occasion's own keyword
// (Admin, Settings, Occasions) always come first, so staff can still push a
// particular line to the front.

/** Words in a product's name, category or type that make it a fit. Matched as whole words. */
const FITS: Partial<Record<OccasionThemeKey, string[]>> = {
  school: ['ink-tank', 'ink tank', 'printer', 'printers', 'ink', 'toner', 'paper', 'paper-media', 'a4', 'scanner', 'scanners', 'cable', 'cables'],
  christmas: ['photo-printers', 'photo printer', 'photo', 'ink-tank', 'ink tank', 'printer', 'printers', 'photo paper', 'glossy', 'ink'],
  'new-year': ['printer', 'printers', 'laser', 'toner', 'ink', 'paper', 'maintenance-kits', 'maintenance', 'printheads', 'spare-parts', 'scanner', 'scanners'],
  love: ['photo-printers', 'photo printer', 'photo', 'photo paper', 'glossy'],
  mothers: ['photo-printers', 'photo printer', 'photo', 'photo paper', 'glossy', 'ink-tank', 'ink tank'],
  womens: ['photo-printers', 'photo', 'ink-tank', 'ink tank', 'printer', 'printers'],
  fathers: ['printer', 'printers', 'laser', 'scanner', 'scanners', 'ink-tank', 'ink tank'],
  mazingira: ['ink-tank', 'ink tank', 'ecotank', 'refill', 'ink', 'ciss', 'recycled'],
  kenya: ['printer', 'printers', 'ink', 'toner', 'paper'],
  eid: ['photo-printers', 'photo', 'photo paper', 'printer', 'printers'],
  diwali: ['photo-printers', 'photo', 'photo paper', 'printer', 'printers'],
  easter: ['photo-printers', 'photo', 'photo paper', 'printer', 'printers'],
  halloween: ['photo', 'photo paper', 'ink'],
  service: ['spare-parts', 'spare part', 'printheads', 'printhead', 'pickup-rollers', 'roller', 'fuser', 'maintenance-kits', 'maintenance', 'waste ink'],
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wholeWords = (words: string[]) => new RegExp(`(^|[^a-z0-9])(${words.map(escape).join('|')})($|[^a-z0-9])`, 'i')

const PATTERNS = new Map<OccasionThemeKey, RegExp>(Object.entries(FITS).map(([key, words]) => [key as OccasionThemeKey, wholeWords(words)]))

type PickMatch = Pick<Occasion, 'slug' | 'name' | 'kind' | 'decoration' | 'pickKeyword'>
type Pickable = Pick<ProductCardData, 'name' | 'category_name' | 'category_slug' | 'product_type' | 'available_quantity'>

/** How well a product fits the occasion: 0 is not at all. */
export function occasionFit(occasion: PickMatch, product: Pickable): number {
  const category = `${product.category_slug ?? ''} ${product.category_name ?? ''} ${product.product_type.replace(/_/g, ' ')}`
  let score = 0
  const keyword = occasion.pickKeyword?.trim()
  if (keyword && wholeWords([keyword]).test(`${product.name} ${category}`)) score += 100
  const pattern = PATTERNS.get(themeKeyFor(occasion))
  if (pattern) {
    if (pattern.test(category)) score += 3
    if (pattern.test(product.name)) score += 2
  }
  return score
}

/** In-stock products that go with the occasion, best fit first, then in the order given. Empty when nothing fits. */
export function occasionPicks<P extends Pickable>(occasion: PickMatch, products: P[], limit = 48): P[] {
  return products
    .map((product, index) => ({ product, index, score: occasionFit(occasion, product) }))
    .filter(({ product, score }) => score > 0 && product.available_quantity > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ product }) => product)
}

/** "Christmas picks", "Back to School picks". */
export function picksTitle(occasion: Pick<Occasion, 'name'>): string {
  return `${occasion.name} picks`
}
