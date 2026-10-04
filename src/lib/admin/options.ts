import 'server-only'
import { createClient } from '@/lib/supabase/server'

/** Brands, categories (indented tree order) and printer models for admin forms. */
export async function getAdminCatalogOptions() {
  const supabase = await createClient()
  const [{ data: brands }, { data: categories }, { data: models }] = await Promise.all([
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('categories').select('id, name, parent_id, sort_order').order('sort_order'),
    supabase.from('printer_models').select('id, name, brand:brands(name)').order('name'),
  ])
  const cats = categories ?? []
  const ordered: { id: string; name: string; depth: number }[] = []
  const walk = (parent: string | null, depth: number) =>
    cats.filter((c) => c.parent_id === parent).forEach((c) => {
      ordered.push({ id: c.id, name: c.name, depth })
      walk(c.id, depth + 1)
    })
  walk(null, 0)
  return {
    brands: brands ?? [],
    categories: ordered,
    models: (models ?? []).map((m) => ({ id: m.id, name: m.name, brand: m.brand?.name ?? '' })),
  }
}
