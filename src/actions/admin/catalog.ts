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
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean(),
})

export async function saveCategoryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return staffAction('catalog.manage', async (user) => {
    const d = categorySchema.parse(formObject(formData, ['isActive']))
    if (d.id && d.parentId === d.id) return { ok: false, message: 'A category cannot be its own parent.' }
    const uploaded = await uploadImage(formData, 'image', 'category-images', 'categories')
    const supabase = await createClient()
    const row = {
      name: d.name,
      slug: d.slug || slugify(d.name),
      parent_id: d.parentId || null,
      description: d.description,
      image_url: uploaded ?? d.imageUrl,
      seo_title: d.seoTitle,
      seo_description: d.seoDescription,
      sort_order: d.sortOrder,
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
