import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductGrid } from '@/components/product/product-card'
import { ProductImage } from '@/components/product/product-image'
import { CatalogListing } from '@/components/storefront/catalog-listing'
import { Breadcrumbs, SectionHeading } from '@/components/ui/misc'
import { getBrand, getFacets, searchCatalog } from '@/lib/catalog'
import { parseCatalogParams } from '@/lib/catalog-params'
import { listingRobots } from '@/lib/seo/metadata'
import { breadcrumbSchema, collectionSchema } from '@/lib/seo/schema'

export async function generateMetadata({ params, searchParams }: PageProps<'/b/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const brand = await getBrand(slug)
  if (!brand) return { title: 'Brand not found' }
  return {
    title: brand.seo_title ? { absolute: brand.seo_title } : `${brand.name} Printers, Ink & Spare Parts in Kenya`,
    description: brand.seo_description || brand.description || `Shop ${brand.name} products at CISS Solutions.`,
    alternates: { canonical: `/b/${brand.slug}` },
    robots: listingRobots(await searchParams),
  }
}

export default async function BrandPage({ params, searchParams }: PageProps<'/b/[slug]'>) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const brand = await getBrand(slug)
  if (!brand) notFound()

  const filtered = Object.keys(sp).length > 0
  const [result, featured, facets] = await Promise.all([
    searchCatalog(parseCatalogParams(sp, { brands: [brand.slug] })),
    filtered ? Promise.resolve(null) : searchCatalog({ brands: [brand.slug], sort: 'best-selling', perPage: 5 }),
    getFacets({ brands: false }),
  ])
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Brands', href: '/brands' },
    { name: brand.name, href: `/b/${brand.slug}` },
  ]

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbSchema(crumbs), collectionSchema(brand.name, `/b/${brand.slug}`, brand.description)]} />
      <Breadcrumbs items={crumbs} />
      <header className="glass-flat mb-10 mt-4 flex flex-col gap-5 rounded-[var(--radius-card)] p-6 sm:flex-row sm:items-center sm:p-8">
        {brand.logo_url ? (
          <div className="grid h-20 w-40 shrink-0 place-items-center rounded-[var(--radius-card)] bg-white p-3">
            <ProductImage src={brand.logo_url} alt={`${brand.name} logo`} width={140} height={60} className="h-full w-auto object-contain" />
          </div>
        ) : null}
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{brand.name}</h1>
          {brand.description ? <p className="mt-2 max-w-2xl text-fg-secondary">{brand.description}</p> : null}
        </div>
      </header>

      {featured && featured.items.length >= 4 ? (
        <section className="mb-14" aria-labelledby="brand-featured">
          <SectionHeading id="brand-featured" title={`Popular ${brand.name} products`} />
          <ProductGrid products={featured.items} priorityCount={4} />
        </section>
      ) : null}

      <section aria-labelledby="brand-all">
        <h2 id="brand-all" className="mb-6 text-2xl font-bold">
          All {brand.name} products
        </h2>
        <CatalogListing result={result} facets={facets} searchParams={sp} basePath={`/b/${brand.slug}`} />
      </section>
    </div>
  )
}
