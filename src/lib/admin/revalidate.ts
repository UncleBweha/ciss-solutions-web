import 'server-only'
import { updateTag } from 'next/cache'
import { tags } from '@/lib/cache'

// Targeted cache invalidation after staff edits: only the affected tags expire,
// never the whole site. updateTag gives read-your-writes for the editor.

export function revalidateProducts(slugs: (string | null | undefined)[] = []) {
  updateTag(tags.catalog)
  for (const slug of slugs) if (slug) updateTag(tags.product(slug))
}

export function revalidateCategories(slugs: string[] = []) {
  updateTag(tags.categories)
  updateTag(tags.catalog)
  for (const s of slugs) updateTag(tags.category(s))
}

export function revalidateBrands(slugs: string[] = []) {
  updateTag(tags.brands)
  updateTag(tags.catalog)
  for (const s of slugs) updateTag(tags.brand(s))
}

export function revalidateHomepage() {
  updateTag(tags.homepage)
}

export function revalidateSettings() {
  updateTag(tags.settings)
  updateTag(tags.delivery)
}

export function revalidatePrinterModels() {
  updateTag(tags.printerModels)
  updateTag(tags.catalog)
}
