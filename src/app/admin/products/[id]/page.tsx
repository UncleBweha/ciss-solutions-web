import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/admin-ui'
import { ImageManager } from '@/components/admin/image-manager'
import { ProductForm } from '@/components/admin/product-form'
import { requireStaff } from '@/lib/auth'
import { getAdminCatalogOptions } from '@/lib/admin/options'
import { createClient } from '@/lib/supabase/server'
import type { Spec } from '@/types/catalog'

export const metadata = { title: 'Edit product' }

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  await requireStaff('products.manage')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: p }, options] = await Promise.all([
    supabase
      .from('products')
      .select('*, cost:product_costs(cost_price), images:product_images(id, url, alt_text, sort_order, is_primary), variants:product_variants(*), compat:product_compatibility(printer_model_id)')
      .eq('id', id)
      .maybeSingle(),
    getAdminCatalogOptions(),
  ])
  if (!p) notFound()
  const s = (v: unknown) => (v == null ? '' : String(v))

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={p.name}
        back={{ href: '/admin/products', label: 'Products' }}
        actions={
          p.status === 'active' ? (
            <Link href={`/p/${p.slug}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface">
              View in store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />
      <ImageManager
        productId={p.id}
        productName={p.name}
        initial={[...p.images].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ id: i.id, url: i.url, alt: i.alt_text ?? '', isPrimary: i.is_primary }))}
      />
      <ProductForm
        {...options}
        stock={{ onHand: p.stock_quantity, reserved: p.reserved_quantity }}
        initial={{
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          barcode: s(p.barcode),
          brandId: s(p.brand_id),
          categoryId: s(p.category_id),
          printerModelId: s(p.printer_model_id),
          productType: p.product_type,
          status: p.status,
          shortDescription: s(p.short_description),
          description: s(p.description),
          partNumber: s(p.part_number),
          oemNumber: s(p.oem_number),
          condition: s(p.condition),
          warranty: s(p.warranty),
          price: Number(p.price),
          compareAtPrice: s(p.compare_at_price),
          costPrice: s(p.cost?.cost_price),
          lowStockThreshold: p.low_stock_threshold,
          weightKg: s(p.weight_kg),
          dimensions: s(p.dimensions),
          isFeatured: p.is_featured,
          isBestseller: p.is_bestseller,
          isNew: p.is_new,
          isOnSale: p.is_on_sale,
          specifications: (Array.isArray(p.specifications) ? (p.specifications as Spec[]) : []).map((x) => ({ label: x.label, value: x.value })),
          features: p.features.join('\n'),
          whatsIncluded: p.whats_included.join('\n'),
          compatibility: p.compat.map((c) => c.printer_model_id),
          variants: [...p.variants]
            .filter((v) => v.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              optionName: Object.keys((v.option_values ?? {}) as object)[0] ?? '',
              price: Number(v.price),
              compareAtPrice: s(v.compare_at_price),
              imageUrl: s(v.image_url),
              isActive: v.is_active,
            })),
          seoTitle: s(p.seo_title),
          seoDescription: s(p.seo_description),
          canonicalUrl: s(p.canonical_url),
          ogTitle: s(p.og_title),
          ogDescription: s(p.og_description),
          ogImageUrl: s(p.og_image_url),
        }}
      />
    </div>
  )
}
