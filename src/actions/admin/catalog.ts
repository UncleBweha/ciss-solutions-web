'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { formObject } from '@/lib/admin/form-data'
import { revalidateBrands, revalidateCategories, revalidatePrinterModels } from '@/lib/admin/revalidate'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes').max(100)
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

/** Uploads an image from a form to a public bucket with the staff session; returns its public URL. */
async function uploadImage(formData: FormData, field: string, bucket: 'brand-logos' | 'category-images' | 'banners', prefix: string) {
  const file = formData.get(field)
  if (!(file instanceof File) || file.size === 0) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller')
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'].includes(file.type)) throw new Error('Use JPG, PNG, WebP, AVIF or SVG')
  const supabase = await createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// ---- Categories ------------------------------------------------------------------

const categorySchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(2).max(80),
  slug: slug.optional().or(z.literal('')),
  parentId: z.string().uuid().optional().or(z.literal('')),
  description: optional(1000),
  imageUrl: optional(500),
  seoTitle: optional(70),
  seoDescription: optional(170),
  sortOrder: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().optional()),
  isActive: z.boolean(),
})

export async function saveCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const d = categorySchema.parse(formObject(formData, ['isActive']))
    if (d.id && d.parentId === d.id) return { ok: false, message: 'A category cannot be its own parent.' }
    const uploaded = await uploadImage(formData, 'image', 'category-images', 'categories')
    const supabase = await createClient()
    const parentId = d.parentId || null
    if (d.id && parentId) {
      // Moving a category under one of its own subcategories would hide the whole branch.
      const { data: all } = await supabase.from('categories').select('id, parent_id')
      const parentOf = new Map((all ?? []).map((c) => [c.id, c.parent_id]))
      for (let at: string | null | undefined = parentId, hops = 0; at && hops < 50; at = parentOf.get(at), hops++) {
        if (at === d.id) return { ok: false, message: 'A category cannot go inside one of its own subcategories.' }
      }
    }
    const row = {
      name: d.name,
      slug: d.slug || (d.id ? slugify(d.name) : await freeCategorySlug(supabase, d.name)),
      parent_id: parentId,
      description: d.description,
      image_url: uploaded ?? d.imageUrl,
      seo_title: d.seoTitle,
      seo_description: d.seoDescription,
      // Left empty: a new category goes to the end of its list; an edited one keeps its place.
      ...(d.sortOrder !== undefined ? { sort_order: d.sortOrder } : d.id ? {} : { sort_order: await nextSortOrder(supabase, parentId) }),
      is_active: d.isActive,
    }
    const { error } = d.id ? await supabase.from('categories').update(row).eq('id', d.id) : await supabase.from('categories').insert(row)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, d.id ? 'category.updated' : 'category.created', 'categories', d.id || row.slug, { after: row })
    revalidateCategories([row.slug])
    revalidatePath('/admin/categories')
    return { ok: true, message: 'Category saved.' }
  })
}

/** A slug not used by any other category: "cables", then "cables-2", "cables-3"... */
async function freeCategorySlug(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const base = slugify(name) || `category-${Date.now().toString(36)}`
  const { data } = await supabase.from('categories').select('slug').like('slug', `${base}%`)
  const taken = new Set((data ?? []).map((c) => c.slug))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

/** Next sort order at the end of a parent's list (or the top level). */
async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, parentId: string | null) {
  const query = supabase.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const { data } = await (parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)).maybeSingle()
  return (data?.sort_order ?? 0) + 10
}

/**
 * Adds a category by name only (optionally under a parent), from the categories page or
 * the product page. The slug and position are worked out; everything else can be filled
 * in later. Returns it so a product form can select it.
 */
export async function quickAddCategoryAction(name: string, parentId: string | null): Promise<ActionResult<{ id: string; name: string; parentId: string | null }>> {
  return staffAction('catalog.manage', async (user) => {
    const parsed = z
      .object({ name: z.string().trim().min(2, 'Enter a name of at least 2 letters').max(80), parentId: z.string().uuid().nullable() })
      .safeParse({ name, parentId: parentId || null })
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
    const supabase = await createClient()
    const parent = parsed.data.parentId
    // The same name under the same parent (whatever the capitals): use that one.
    const same = supabase.from('categories').select('id, name, parent_id').ilike('name', parsed.data.name.replace(/[%_\\]/g, '\\$&')).limit(1)
    const { data: existing } = await (parent ? same.eq('parent_id', parent) : same.is('parent_id', null)).maybeSingle()
    if (existing) return { ok: true, message: `${existing.name} already exists.`, data: { id: existing.id, name: existing.name, parentId: existing.parent_id } }
    const row = {
      name: parsed.data.name,
      slug: await freeCategorySlug(supabase, parsed.data.name),
      parent_id: parent,
      sort_order: await nextSortOrder(supabase, parent),
      is_active: true,
    }
    const { data: created, error } = await supabase.from('categories').insert(row).select('id, name, parent_id').single()
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'category.created', 'categories', row.slug, { after: row })
    revalidateCategories([row.slug])
    revalidatePath('/admin/categories')
    return { ok: true, message: parent ? 'Subcategory added.' : 'Category added.', data: { id: created.id, name: created.name, parentId: created.parent_id } }
  })
}

/** Moves a category one place up or down among its siblings (renumbers them 10, 20, 30...). */
export async function moveCategoryAction(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const supabase = await createClient()
    const { data: cat } = await supabase.from('categories').select('id, parent_id').eq('id', z.string().uuid().parse(id)).single()
    if (!cat) return { ok: false, message: 'Category not found.' }
    const siblings = supabase.from('categories').select('id, slug, sort_order, name').order('sort_order').order('name')
    const { data } = await (cat.parent_id ? siblings.eq('parent_id', cat.parent_id) : siblings.is('parent_id', null))
    const list = data ?? []
    const from = list.findIndex((c) => c.id === id)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= list.length) return { ok: true, message: 'Already there.' }
    ;[list[from], list[to]] = [list[to], list[from]]
    const changed = list.map((c, i) => ({ ...c, next: (i + 1) * 10 })).filter((c) => c.sort_order !== c.next)
    for (const c of changed) {
      const { error } = await supabase.from('categories').update({ sort_order: c.next }).eq('id', c.id)
      if (error) return { ok: false, message: dbError(error)! }
    }
    await audit(user, 'category.moved', 'categories', id, { after: { direction } })
    revalidateCategories(changed.map((c) => c.slug))
    revalidatePath('/admin/categories')
    return { ok: true, message: 'Order updated.' }
  })
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const supabase = await createClient()
    const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id)
    if (count) return { ok: false, message: `Move the ${count} products in this category first.` }
    const { data } = await supabase.from('categories').select('slug, name').eq('id', id).single()
    const { error } = await supabase.from('categories').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'category.deleted', 'categories', id, { before: data })
    revalidateCategories(data ? [data.slug] : [])
    revalidatePath('/admin/categories')
    return { ok: true, message: 'Category deleted. Subcategories moved to the top level.' }
  })
}

// ---- Brands ----------------------------------------------------------------------

const brandSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(1).max(80),
  slug: slug.optional().or(z.literal('')),
  description: optional(1000),
  website: optional(300),
  logoUrl: optional(500),
  seoTitle: optional(70),
  seoDescription: optional(170),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean(),
})

export async function saveBrandAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const d = brandSchema.parse(formObject(formData, ['isActive']))
    const uploaded = await uploadImage(formData, 'logo', 'brand-logos', 'brands')
    const supabase = await createClient()
    const row = {
      name: d.name,
      slug: d.slug || slugify(d.name),
      description: d.description,
      website: d.website,
      logo_url: uploaded ?? d.logoUrl,
      seo_title: d.seoTitle,
      seo_description: d.seoDescription,
      sort_order: d.sortOrder,
      is_active: d.isActive,
    }
    const { error } = d.id ? await supabase.from('brands').update(row).eq('id', d.id) : await supabase.from('brands').insert(row)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, d.id ? 'brand.updated' : 'brand.created', 'brands', d.id || row.slug, { after: row })
    revalidateBrands([row.slug])
    revalidatePath('/admin/brands')
    return { ok: true, message: 'Brand saved.' }
  })
}

/** Adds a brand by name only, from the product page. Returns it so the form can select it. */
export async function quickAddBrandAction(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  return staffAction('catalog.manage', async (user) => {
    const parsed = z.string().trim().min(1, 'Enter the brand name').max(80).safeParse(name)
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
    const supabase = await createClient()
    // Already there (whatever the capitals): use it instead of making a second one.
    const { data: existing } = await supabase.from('brands').select('id, name').ilike('name', parsed.data.replace(/[%_\\]/g, '\\$&')).limit(1).maybeSingle()
    if (existing) return { ok: true, message: `${existing.name} is already a brand.`, data: existing }
    const row = { name: parsed.data, slug: slugify(parsed.data) || `brand-${Date.now().toString(36)}`, is_active: true }
    const { data: created, error } = await supabase.from('brands').insert(row).select('id, name').single()
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'brand.created', 'brands', row.slug, { after: row })
    revalidateBrands([row.slug])
    revalidatePath('/admin/brands')
    return { ok: true, message: 'Brand added.', data: created }
  })
}

export async function deleteBrandAction(id: string): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const supabase = await createClient()
    const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('brand_id', id)
    if (count) return { ok: false, message: `${count} products use this brand. Reassign them or deactivate the brand instead.` }
    const { data } = await supabase.from('brands').select('slug').eq('id', id).single()
    const { error } = await supabase.from('brands').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'brand.deleted', 'brands', id, { before: data })
    revalidateBrands(data ? [data.slug] : [])
    revalidatePath('/admin/brands')
    return { ok: true, message: 'Brand deleted.' }
  })
}

// ---- Printer models -------------------------------------------------------------------

const modelSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  brandId: z.string().uuid('Choose a brand'),
  name: z.string().trim().min(2).max(120),
  modelNumber: z.string().trim().min(1).max(60),
  description: optional(500),
})

export async function savePrinterModelAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const d = modelSchema.parse(formObject(formData))
    const supabase = await createClient()
    const row = { brand_id: d.brandId, name: d.name, model_number: d.modelNumber, slug: slugify(d.name), description: d.description }
    const { error } = d.id ? await supabase.from('printer_models').update(row).eq('id', d.id) : await supabase.from('printer_models').insert(row)
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, d.id ? 'printer_model.updated' : 'printer_model.created', 'printer_models', d.id || row.slug, { after: row })
    revalidatePrinterModels()
    revalidatePath('/admin/printer-models')
    return { ok: true, message: 'Printer model saved.' }
  })
}

export async function deletePrinterModelAction(id: string): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const supabase = await createClient()
    const { error } = await supabase.from('printer_models').delete().eq('id', z.string().uuid().parse(id))
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'printer_model.deleted', 'printer_models', id)
    revalidatePrinterModels()
    revalidatePath('/admin/printer-models')
    return { ok: true, message: 'Printer model deleted (its compatibility links were removed).' }
  })
}
