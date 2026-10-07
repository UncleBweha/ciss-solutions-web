import { z } from 'zod'

const money = z.coerce.number({ message: 'Enter an amount' }).min(0, 'Must be 0 or more').max(100_000_000)
const optionalMoney = z.preprocess((v) => (v === '' || v == null ? null : v), money.nullable())
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

export const productTypes = ['simple', 'variable', 'printer', 'spare_part', 'accessory', 'ink_toner', 'scanner', 'paper'] as const
export const productStatuses = ['draft', 'active', 'archived'] as const

export const variantSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(1, 'Name required').max(80),
  sku: z.string().trim().min(2, 'SKU required').max(60),
  optionName: z.string().trim().max(40).optional(),
  price: money,
  compareAtPrice: optionalMoney,
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  imageUrl: optionalText(500),
  isActive: z.boolean().default(true),
})

export const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(3, 'Enter the product name').max(200),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes').max(140),
    sku: z.string().trim().min(2, 'Enter a SKU').max(60),
    barcode: optionalText(40),
    brandId: z.string().uuid().nullable().or(z.literal('')).transform((v) => v || null),
    categoryId: z.string().uuid().nullable().or(z.literal('')).transform((v) => v || null),
    printerModelId: z.string().uuid().nullable().or(z.literal('')).transform((v) => v || null),
    productType: z.enum(productTypes),
    status: z.enum(productStatuses),
    shortDescription: optionalText(300),
    description: optionalText(20000),
    partNumber: optionalText(80),
    oemNumber: optionalText(80),
    condition: optionalText(40),
    warranty: optionalText(120),
    price: money,
    compareAtPrice: optionalMoney,
    costPrice: optionalMoney,
    /** New product: the opening stock. */
    initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
    /** Existing product without variants: the quantity on hand; a change is recorded as a stock correction. */
    stockQuantity: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int('Enter a whole number').min(0, 'Must be 0 or more').max(1_000_000).optional()),
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
    weightKg: optionalMoney,
    dimensions: optionalText(80),
    isFeatured: z.boolean(),
    isBestseller: z.boolean(),
    isNew: z.boolean(),
    isOnSale: z.boolean(),
    specifications: z.array(z.object({ label: z.string().trim().max(80), value: z.string().trim().max(300) })).max(60),
    features: z.array(z.string().trim().max(300)).max(40),
    whatsIncluded: z.array(z.string().trim().max(200)).max(40),
    /** Typed by staff, one printer model (or range) per entry. Entries that name a known model are linked to it. */
    compatibleWith: z.array(z.string().trim().max(120)).max(200),
    /** Links to printer models that aren't named in compatibleWith (kept as they are). */
    compatibility: z.array(z.string().uuid()).max(500),
    variants: z.array(variantSchema).max(50),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    canonicalUrl: optionalText(300),
    ogTitle: optionalText(100),
    ogDescription: optionalText(200),
    ogImageUrl: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPrice != null && v.compareAtPrice <= v.price) {
      ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'Compare-at price must be higher than the price (or leave it empty)' })
    }
    const skus = new Set<string>([v.sku.toUpperCase()])
    v.variants.forEach((variant, i) => {
      const key = variant.sku.toUpperCase()
      if (skus.has(key)) ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU must be unique' })
      skus.add(key)
    })
  })

export type ProductInput = z.input<typeof productSchema>
export type ProductData = z.output<typeof productSchema>

// ---- CSV import -------------------------------------------------------------

export const CSV_COLUMNS = ['name', 'sku', 'brand', 'category', 'price', 'compare_at_price', 'stock', 'description', 'short_description', 'product_type', 'weight', 'status'] as const

export const csvRowSchema = z.object({
  name: z.string().trim().min(3, 'name is required'),
  sku: z.string().trim().min(2, 'sku is required').max(60),
  brand: z.string().trim().optional(),
  category: z.string().trim().optional(),
  price: z.coerce.number({ message: 'price must be a number' }).min(0, 'price must be 0 or more'),
  compare_at_price: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  stock: z.union([z.literal(''), z.coerce.number().int('stock must be a whole number').min(0)]).optional(),
  description: z.string().optional(),
  short_description: z.string().max(300).optional(),
  product_type: z.union([z.literal(''), z.enum(productTypes)]).optional(),
  weight: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  status: z.union([z.literal(''), z.enum(productStatuses)]).optional(),
})

/** RFC 4180-style CSV parser (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}
