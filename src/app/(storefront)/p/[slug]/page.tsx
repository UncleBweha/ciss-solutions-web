import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductGrid } from '@/components/product/product-card'
import { ProductInfo } from '@/components/product/product-info'
import { ProductPurchase } from '@/components/product/product-purchase'
import { VariantAwareGallery } from '@/components/product/variant-gallery'
import { Breadcrumbs, RatingStars, SectionHeading } from '@/components/ui/misc'
import { getProduct, getRecommendations, getSettings } from '@/lib/catalog'
import { productMetadata } from '@/lib/seo/metadata'
import { breadcrumbSchema, productSchema } from '@/lib/seo/schema'

// Product pages are statically regenerated at most daily, and immediately when
// staff edit the product (tag `product:<slug>`).
export const revalidate = 86400

export function generateStaticParams() {
  // Rendered on first request, then cached (keeps builds fast as the catalogue grows).
  return []
}

export async function generateMetadata({ params }: PageProps<'/p/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) return { title: 'Product not found', robots: { index: false } }
  return productMetadata(product)
}

export default async function ProductPage({ params }: PageProps<'/p/[slug]'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  const [{ compatible, related }, settings] = await Promise.all([getRecommendations(product), getSettings()])
  const crumbs = [
    { name: 'Home', href: '/' },
    ...product.categoryPath.map((c, i) => ({ name: c.name, href: `/c/${product.categoryPath.slice(0, i + 1).map((x) => x.slug).join('/')}` })),
    { name: product.name, href: `/p/${product.slug}` },
  ]
  const images = product.images.map((i) => ({ url: i.url, alt: i.alt_text || product.name }))
  const isPrinter = product.product_type === 'printer'

  return (
    <div className="container-page pb-24 pt-6 lg:pb-8">
      <JsonLd data={[productSchema(product), breadcrumbSchema(crumbs)]} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <VariantAwareGallery images={images} name={product.name} />

        <div>
          {product.brand ? (
            <Link href={`/b/${product.brand.slug}`} className="text-sm font-bold uppercase tracking-wider text-primary-light hover:underline">
              {product.brand.name}
            </Link>
          ) : null}
          <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
            {product.rating_count ? (
              <a href="#product-info" className="hover:text-fg">
                <RatingStars rating={product.rating_avg} count={product.rating_count} />
              </a>
            ) : null}
            <span>SKU: {product.sku}</span>
            {product.part_number ? <span>Part no: {product.part_number}</span> : null}
          </div>
          {product.short_description ? <p className="mt-4 text-fg-secondary">{product.short_description}</p> : null}

          <div className="mt-6">
            <ProductPurchase
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                price: product.price,
                compareAt: product.compare_at_price,
                available: product.available_quantity ?? 0,
                lowThreshold: product.low_stock_threshold,
                imageUrl: product.images[0]?.url ?? null,
                brand: product.brand?.name ?? null,
              }}
              variants={product.variants}
              maxPerItem={settings.checkout.max_quantity_per_item}
            />
          </div>

          {product.compatibility.length ? (
            <div className="glass-flat mt-6 rounded-2xl p-4 text-sm">
              <p className="font-semibold">Fits {product.compatibility.length} printer model{product.compatibility.length > 1 ? 's' : ''}:</p>
              <p className="mt-1 text-fg-secondary">
                {product.compatibility.slice(0, 6).map((m) => m.model_number).join(', ')}
                {product.compatibility.length > 6 ? ` +${product.compatibility.length - 6} more` : ''}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <section id="product-info" className="mt-14 scroll-mt-24" aria-label="Product information">
        <ProductInfo product={product} />
      </section>

      {compatible.length ? (
        <section className="mt-16" aria-labelledby="compatible">
          <SectionHeading id="compatible" title={isPrinter ? 'Compatible ink, toner & parts' : 'More parts for the same printers'} subtitle={isPrinter ? 'Keep your printer running with matching supplies.' : null} />
          <ProductGrid products={compatible.slice(0, 5)} />
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-16" aria-labelledby="related">
          <SectionHeading id="related" title="You may also like" />
          <ProductGrid products={related.slice(0, 5)} />
        </section>
      ) : null}
    </div>
  )
}
