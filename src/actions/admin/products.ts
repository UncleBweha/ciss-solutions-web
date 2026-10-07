'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { dbError, staffAction, type ActionResult } from '@/lib/admin/action'
import { audit } from '@/lib/admin/audit'
import { revalidateProducts } from '@/lib/admin/revalidate'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'
import { CSV_COLUMNS, csvRowSchema, parseCsv, productSchema, type ProductInput } from '@/lib/validation/product'

// All writes use the staff member's own session, so Row Level Security checks
// their permission again in the database.

export async function saveProductAction(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  return staffAction('products.manage', async (user) => {
    const parsed = productSchema.safeParse(input)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const i of parsed.error.issues) errors[i.path.join('.')] ??= i.message
      return { ok: false, message: 'Please fix the highlighted fields.', errors }
    }
    const d = parsed.data
    const supabase = await createClient()

    // A new product's address comes from its name; if that address is taken, the SKU makes it unique.
    if (!d.id) {
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('slug', d.slug)
      if (count) d.slug = `${d.slug}-${slugify(d.sku)}`.slice(0, 140)
    }
    const compatibleWith = [...new Set(d.compatibleWith.filter(Boolean))]

    const row = {
      name: d.name,
      slug: d.slug,
      sku: d.sku,
      barcode: d.barcode,
      brand_id: d.brandId,
      category_id: d.categoryId,
      printer_model_id: d.printerModelId,
      product_type: d.productType,
      status: d.status,
      short_description: d.shortDescription,
      description: d.description,
      part_number: d.partNumber,
      oem_number: d.oemNumber,
      condition: d.condition,
      warranty: d.warranty,
      price: d.price,
      compare_at_price: d.compareAtPrice,
      low_stock_threshold: d.lowStockThreshold,
      weight_kg: d.weightKg,
      dimensions: d.dimensions,
      is_featured: d.isFeatured,
      is_bestseller: d.isBestseller,
      is_new: d.isNew,
      is_on_sale: d.isOnSale,
      specifications: d.specifications.filter((s) => s.label && s.value),
      features: d.features.filter(Boolean),
      whats_included: d.whatsIncluded.filter(Boolean),
      compatible_with: compatibleWith,
      seo_title: d.seoTitle,
      seo_description: d.seoDescription,
      canonical_url: d.canonicalUrl,
      og_title: d.ogTitle,
      og_description: d.ogDescription,
      og_image_url: d.ogImageUrl,
    }

    let productId = d.id
    let before: { slug: string; price: number; compare_at_price: number | null; status: string; stock_quantity: number } | null = null
    if (productId) {
      const { data: existing } = await supabase.from('products').select('slug, price, compare_at_price, status, stock_quantity').eq('id', productId).single()
      before = existing
      const { error } = await supabase.from('products').update(row).eq('id', productId)
      if (error) return { ok: false, message: dbError(error)! }
      // Quantity typed on the product page: record the difference as a stock correction.
      if (before && d.stockQuantity != null && !d.variants.length && d.stockQuantity !== before.stock_quantity) {
        const { error: stockError } = await supabase.rpc('adjust_stock', { p_product_id: productId, p_variant_id: null as unknown as string, p_change: d.stockQuantity - before.stock_quantity, p_reason: 'correction', p_note: 'Quantity set on the product page' })
        if (stockError) {
          const reserved = stockError.message.includes('STOCK_BELOW_RESERVED')
          return { ok: false, message: reserved ? 'Product saved, but the quantity was not changed: it cannot go below what unpaid orders are holding.' : `Product saved, but the quantity was not changed: ${stockError.message}`, errors: { stockQuantity: reserved ? 'Cannot go below the quantity held by open orders' : 'Not changed' } }
        }
      }
    } else {
      const { data: created, error } = await supabase.from('products').insert(row).select('id').single()
      if (error) return { ok: false, message: dbError(error)! }
      productId = created.id
      if (d.initialStock && !d.variants.length) {
        const { error: stockError } = await supabase.rpc('adjust_stock', { p_product_id: productId, p_variant_id: null as unknown as string, p_change: d.initialStock, p_reason: 'purchase', p_note: 'Opening stock' })
        if (stockError) return { ok: false, message: `Product created, but opening stock failed: ${stockError.message}` }
      }
    }

    // Internal cost price
    await supabase.from('product_costs').upsert({ product_id: productId, cost_price: d.costPrice, updated_at: new Date().toISOString() })

    // Compatibility: entries that name a known printer model (by name or model number) are
    // linked to it, so the parts finder lists this product. Replace the set.
    const wanted = new Set(d.compatibility)
    if (compatibleWith.length) {
      const { data: models } = await supabase.from('printer_models').select('id, name, model_number')
      const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
      const byName = new Map<string, string>()
      for (const m of models ?? []) {
        byName.set(key(m.name), m.id)
        byName.set(key(m.model_number), m.id)
      }
      for (const entry of compatibleWith) {
        const id = byName.get(key(entry))
        if (id) wanted.add(id)
      }
    }
    const { data: currentCompat } = await supabase.from('product_compatibility').select('printer_model_id').eq('product_id', productId)
    const current = new Set((currentCompat ?? []).map((c) => c.printer_model_id))
    const toRemove = [...current].filter((id) => !wanted.has(id))
    const toAdd = [...wanted].filter((id) => !current.has(id))
    if (toRemove.length) await supabase.from('product_compatibility').delete().eq('product_id', productId).in('printer_model_id', toRemove)
    if (toAdd.length) await supabase.from('product_compatibility').insert(toAdd.map((printer_model_id) => ({ product_id: productId!, printer_model_id })))

    // Variants: update existing, insert new, deactivate removed (orders keep their snapshots)
    const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId)
    const keep = new Set(d.variants.map((v) => v.id).filter(Boolean))
    const removed = (existingVariants ?? []).map((v) => v.id).filter((id) => !keep.has(id))
    if (removed.length) await supabase.from('product_variants').update({ is_active: false }).in('id', removed)
    for (const [i, v] of d.variants.entries()) {
      const variantRow = {
        product_id: productId,
        name: v.name,
        sku: v.sku,
        option_values: v.optionName ? { [v.optionName]: v.name } : {},
        price: v.price,
        compare_at_price: v.compareAtPrice,
        image_url: v.imageUrl,
        is_active: v.isActive,
        sort_order: i,
      }
      if (v.id) {
        const { error } = await supabase.from('product_variants').update(variantRow).eq('id', v.id)
        if (error) return { ok: false, message: `Variant ${v.name}: ${dbError(error)}` }
      } else {
        const { data: created, error } = await supabase.from('product_variants').insert(variantRow).select('id').single()
        if (error) return { ok: false, message: `Variant ${v.name}: ${dbError(error)}` }
        if (v.stock) await supabase.rpc('adjust_stock', { p_product_id: productId, p_variant_id: created.id, p_change: v.stock, p_reason: 'purchase', p_note: 'Opening stock' })
      }
    }
    // Variable products list the lowest variant price.
    const activeVariantPrices = d.variants.filter((v) => v.isActive).map((v) => v.price)
    if (activeVariantPrices.length) await supabase.from('products').update({ price: Math.min(...activeVariantPrices) }).eq('id', productId)

    const priceChanged = before && (Number(before.price) !== d.price || Number(before.compare_at_price ?? 0) !== Number(d.compareAtPrice ?? 0))
    await audit(user, d.id ? (priceChanged ? 'product.price_changed' : 'product.updated') : 'product.created', 'products', productId!, {
      before: before ?? undefined,
      after: { slug: d.slug, price: d.price, compare_at_price: d.compareAtPrice, status: d.status },
    })
    revalidateProducts([d.slug, before?.slug])
    revalidatePath('/admin/products')
    return { ok: true, message: 'Product saved.', data: { id: productId! } }
  })
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  return staffAction('products.manage', async (user) => {
    const pid = z.string().uuid().parse(id)
    const supabase = await createClient()
    const { data: product } = await supabase.from('products').select('slug, name, sku, price').eq('id', pid).single()
    const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', pid)
    const { error } = await supabase.from('products').delete().eq('id', pid)
    if (error) return { ok: false, message: dbError(error)! }
    const paths = (images ?? []).map((i) => i.storage_path).filter((p): p is string => Boolean(p))
    if (paths.length) await supabase.storage.from('product-images').remove(paths)
    await audit(user, 'product.deleted', 'products', pid, { before: product })
    revalidateProducts([product?.slug])
    revalidatePath('/admin/products')
    return { ok: true, message: 'Product deleted.' }
  })
}

const bulkSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('activate'), ids: z.array(z.string().uuid()).min(1) }),
  z.object({ op: z.literal('deactivate'), ids: z.array(z.string().uuid()).min(1) }),
  z.object({ op: z.literal('delete'), ids: z.array(z.string().uuid()).min(1), confirm: z.literal('DELETE') }),
  z.object({ op: z.literal('price_percent'), ids: z.array(z.string().uuid()).min(1), value: z.coerce.number().min(-90).max(500) }),
  z.object({ op: z.literal('stock_set'), ids: z.array(z.string().uuid()).min(1), value: z.coerce.number().int().min(0) }),
  z.object({ op: z.literal('category'), ids: z.array(z.string().uuid()).min(1), value: z.string().uuid() }),
  z.object({ op: z.literal('brand'), ids: z.array(z.string().uuid()).min(1), value: z.string().uuid() }),
])

export type BulkInput = z.input<typeof bulkSchema>

export async function bulkProductsAction(input: BulkInput): Promise<ActionResult> {
  return staffAction('products.manage', async (user) => {
    const b = bulkSchema.parse(input)
    const supabase = await createClient()
    const { data: products } = await supabase.from('products').select('id, slug, price, compare_at_price, stock_quantity, reserved_quantity').in('id', b.ids)
    const list = products ?? []
    let message = ''

    switch (b.op) {
      case 'activate':
      case 'deactivate': {
        const { error } = await supabase.from('products').update({ status: b.op === 'activate' ? 'active' : 'draft' }).in('id', b.ids)
        if (error) return { ok: false, message: dbError(error)! }
        message = `${list.length} products ${b.op === 'activate' ? 'activated' : 'deactivated'}.`
        break
      }
      case 'delete': {
        const { error } = await supabase.from('products').delete().in('id', b.ids)
        if (error) return { ok: false, message: dbError(error)! }
        message = `${list.length} products deleted.`
        break
      }
      case 'price_percent': {
        for (const p of list) {
          const price = Math.max(0, Math.round(Number(p.price) * (1 + b.value / 100)))
          const compare = p.compare_at_price != null && Number(p.compare_at_price) > price ? p.compare_at_price : null
          await supabase.from('products').update({ price, compare_at_price: compare }).eq('id', p.id)
        }
        message = `Prices updated by ${b.value}% on ${list.length} products.`
        break
      }
      case 'stock_set': {
        const skipped: string[] = []
        for (const p of list) {
          const change = b.value - p.stock_quantity
          if (!change) continue
          const { error } = await supabase.rpc('adjust_stock', { p_product_id: p.id, p_variant_id: null as unknown as string, p_change: change, p_reason: 'correction', p_note: 'Bulk stock update' })
          if (error) skipped.push(p.slug)
        }
        message = `Stock set to ${b.value}.${skipped.length ? ` Skipped ${skipped.length} with reserved stock above that level.` : ''}`
        break
      }
      case 'category':
      case 'brand': {
        const { error } = await supabase.from('products').update(b.op === 'category' ? { category_id: b.value } : { brand_id: b.value }).in('id', b.ids)
        if (error) return { ok: false, message: dbError(error)! }
        message = `${b.op === 'category' ? 'Category' : 'Brand'} assigned to ${list.length} products.`
        break
      }
    }
    await audit(user, `product.bulk_${b.op}`, 'products', null, {
      before: list.map((p) => ({ id: p.id, price: p.price, stock: p.stock_quantity })),
      after: { op: b.op, value: 'value' in b ? b.value : null, count: list.length },
    })
    revalidateProducts(list.map((p) => p.slug))
    revalidatePath('/admin/products')
    return { ok: true, message }
  })
}

// ---- Images -------------------------------------------------------------------

export async function addProductImageAction(productId: string, image: { url: string; storagePath: string | null; alt: string }): Promise<ActionResult> {
  return staffAction('products.manage', async (user) => {
    const pid = z.string().uuid().parse(productId)
    const img = z.object({ url: z.string().url().or(z.string().startsWith('/')), storagePath: z.string().nullable(), alt: z.string().max(200) }).parse(image)
    const supabase = await createClient()
    const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', pid)
    const { error } = await supabase.from('product_images').insert({
      product_id: pid,
      url: img.url,
      storage_path: img.storagePath,
      alt_text: img.alt || null,
      sort_order: count ?? 0,
      is_primary: !count,
    })
    if (error) return { ok: false, message: dbError(error)! }
    await audit(user, 'product.image_added', 'products', pid)
    await revalidateProductById(pid)
    return { ok: true, message: 'Image added.' }
  })
}

export async function updateProductImagesAction(
  productId: string,
  images: { id: string; alt: string; isPrimary: boolean }[],
): Promise<ActionResult> {
  return staffAction('products.manage', async () => {
    const pid = z.string().uuid().parse(productId)
    const list = z.array(z.object({ id: z.string().uuid(), alt: z.string().max(200), isPrimary: z.boolean() })).parse(images)
    const supabase = await createClient()
    await supabase.from('product_images').update({ is_primary: false }).eq('product_id', pid)
    for (const [i, img] of list.entries()) {
      await supabase.from('product_images').update({ sort_order: i, alt_text: img.alt || null, is_primary: img.isPrimary }).eq('id', img.id).eq('product_id', pid)
    }
    await revalidateProductById(pid)
    return { ok: true, message: 'Images updated.' }
  })
}

export async function deleteProductImageAction(imageId: string): Promise<ActionResult> {
  return staffAction('products.manage', async (user) => {
    const id = z.string().uuid().parse(imageId)
    const supabase = await createClient()
    const { data: img } = await supabase.from('product_images').select('product_id, storage_path, is_primary').eq('id', id).single()
    if (!img) return { ok: false, message: 'Image not found.' }
    await supabase.from('product_images').delete().eq('id', id)
    if (img.storage_path) await supabase.storage.from('product-images').remove([img.storage_path])
    if (img.is_primary) {
      const { data: next } = await supabase.from('product_images').select('id').eq('product_id', img.product_id).order('sort_order').limit(1).maybeSingle()
      if (next) await supabase.from('product_images').update({ is_primary: true }).eq('id', next.id)
    }
    await audit(user, 'product.image_deleted', 'products', img.product_id)
    await revalidateProductById(img.product_id)
    return { ok: true, message: 'Image removed.' }
  })
}

async function revalidateProductById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('slug').eq('id', id).single()
  revalidateProducts([data?.slug])
  revalidatePath(`/admin/products/${id}`)
}

// ---- CSV import -------------------------------------------------------------------

export type ImportPreviewRow = {
  line: number
  sku: string
  name: string
  price: number | null
  action: 'create' | 'update'
  errors: string[]
}

async function analyseCsv(csv: string) {
  const rows = parseCsv(csv)
  if (!rows.length) return { error: 'The file is empty.' as const }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const missing = ['name', 'sku', 'price'].filter((c) => !header.includes(c))
  if (missing.length) return { error: `Missing required columns: ${missing.join(', ')}. Expected: ${CSV_COLUMNS.join(', ')}` as const }
  if (rows.length > 2001) return { error: 'Import up to 2,000 products at a time.' as const }

  const db = createAdminClient()
  const [{ data: brands }, { data: categories }, { data: existing }] = await Promise.all([
    db.from('brands').select('id, name, slug'),
    db.from('categories').select('id, name, slug'),
    db.from('products').select('id, sku, slug'),
  ])
  const findBy = (list: { id: string; name: string; slug: string }[] | null, value?: string) => {
    if (!value) return null
    const v = value.trim().toLowerCase()
    return list?.find((x) => x.slug === v || x.name.toLowerCase() === v) ?? undefined
  }
  const bySku = new Map((existing ?? []).map((p) => [p.sku.toUpperCase(), p]))
  const seen = new Set<string>()
  const parsed = rows.slice(1).map((cells, i) => {
    const record = Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? '').trim()]))
    const result = csvRowSchema.safeParse(record)
    const errors = result.success ? [] : result.error.issues.map((e) => `${String(e.path[0])}: ${e.message}`)
    const brand = findBy(brands, record.brand)
    const category = findBy(categories, record.category)
    if (record.brand && brand === undefined) errors.push(`brand "${record.brand}" not found`)
    if (record.category && category === undefined) errors.push(`category "${record.category}" not found`)
    const skuKey = (record.sku ?? '').toUpperCase()
    if (skuKey && seen.has(skuKey)) errors.push('duplicate sku in file')
    seen.add(skuKey)
    return { line: i + 2, record, data: result.success ? result.data : null, brand, category, existing: bySku.get(skuKey), errors }
  })
  return { parsed }
}

export async function previewImportAction(csv: string): Promise<ActionResult<{ rows: ImportPreviewRow[] }>> {
  return staffAction('products.manage', async () => {
    const result = await analyseCsv(z.string().max(5_000_000).parse(csv))
    if ('error' in result) return { ok: false, message: result.error! }
    return {
      ok: true,
      data: {
        rows: result.parsed.map((r) => ({
          line: r.line,
          sku: r.record.sku ?? '',
          name: r.record.name ?? '',
          price: r.data?.price ?? null,
          action: r.existing ? 'update' : 'create',
          errors: r.errors,
        })),
      },
    }
  })
}

export async function importProductsAction(csv: string): Promise<ActionResult<{ created: number; updated: number }>> {
  return staffAction('products.manage', async (user) => {
    const result = await analyseCsv(z.string().max(5_000_000).parse(csv))
    if ('error' in result) return { ok: false, message: result.error! }
    const invalid = result.parsed.filter((r) => r.errors.length)
    if (invalid.length) return { ok: false, message: `${invalid.length} rows have errors. Fix them and preview again.` }

    const supabase = await createClient()
    const { data: slugRows } = await supabase.from('products').select('slug')
    const slugs = new Set((slugRows ?? []).map((r) => r.slug))
    let created = 0
    let updated = 0
    for (const r of result.parsed) {
      const d = r.data!
      const fields = {
        name: d.name,
        price: d.price,
        compare_at_price: d.compare_at_price === '' || d.compare_at_price === undefined ? null : d.compare_at_price,
        description: d.description || null,
        short_description: d.short_description || null,
        product_type: d.product_type || 'simple',
        weight_kg: d.weight === '' || d.weight === undefined ? null : d.weight,
        status: d.status || 'draft',
        ...(r.brand ? { brand_id: r.brand.id } : {}),
        ...(r.category ? { category_id: r.category.id } : {}),
      }
      const stock = d.stock === '' || d.stock === undefined ? null : d.stock
      if (r.existing) {
        const { error } = await supabase.from('products').update(fields).eq('id', r.existing.id)
        if (error) return { ok: false, message: `Line ${r.line}: ${dbError(error)} (${created + updated} rows imported before this)` }
        if (stock != null) {
          const { data: cur } = await supabase.from('products').select('stock_quantity').eq('id', r.existing.id).single()
          const change = stock - (cur?.stock_quantity ?? 0)
          if (change) await supabase.rpc('adjust_stock', { p_product_id: r.existing.id, p_variant_id: null as unknown as string, p_change: change, p_reason: 'correction', p_note: 'CSV import' })
        }
        updated++
      } else {
        let slug = slugify(d.name) || slugify(d.sku)
        for (let n = 2; slugs.has(slug); n++) slug = `${slugify(d.name)}-${n}`
        slugs.add(slug)
        const { data: row, error } = await supabase.from('products').insert({ ...fields, sku: d.sku, slug }).select('id').single()
        if (error) return { ok: false, message: `Line ${r.line}: ${dbError(error)} (${created + updated} rows imported before this)` }
        if (stock) await supabase.rpc('adjust_stock', { p_product_id: row.id, p_variant_id: null as unknown as string, p_change: stock, p_reason: 'purchase', p_note: 'CSV import' })
        created++
      }
    }
    await audit(user, 'product.csv_import', 'products', null, { after: { created, updated } })
    revalidateProducts()
    revalidatePath('/admin/products')
    return { ok: true, message: `Imported: ${created} created, ${updated} updated.`, data: { created, updated } }
  })
}

export async function duplicateProductAction(id: string) {
  const result = await staffAction('products.manage', async (user) => {
    const pid = z.string().uuid().parse(id)
    const supabase = await createClient()
    const { data: p } = await supabase.from('products').select('*').eq('id', pid).single()
    if (!p) return { ok: false as const, message: 'Not found' }
    const { id: _id, search_vector: _sv, available_quantity: _aq, discount_percent: _dp, created_at: _c, updated_at: _u, build_product_search_text: _b, ...rest } = p as typeof p & { build_product_search_text?: unknown }
    void [_id, _sv, _aq, _dp, _c, _u, _b]
    const { data: copy, error } = await supabase
      .from('products')
      .insert({ ...rest, name: `${p.name} (copy)`, slug: `${p.slug}-copy-${Date.now().toString(36)}`, sku: `${p.sku}-COPY-${Date.now().toString(36).toUpperCase()}`, status: 'draft', stock_quantity: 0, reserved_quantity: 0, sales_count: 0, rating_avg: 0, rating_count: 0 })
      .select('id')
      .single()
    if (error) return { ok: false as const, message: dbError(error)! }
    await audit(user, 'product.duplicated', 'products', copy.id, { before: { from: pid } })
    return { ok: true as const, data: { id: copy.id } }
  })
  if (result.ok && result.data) redirect(`/admin/products/${result.data.id}`)
  return result
}
