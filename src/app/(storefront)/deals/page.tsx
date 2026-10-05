import type { Metadata } from 'next'
import { CatalogListing } from '@/components/storefront/catalog-listing'
import { Breadcrumbs } from '@/components/ui/misc'
import { getFacets, searchCatalog } from '@/lib/catalog'
import { parseCatalogParams } from '@/lib/catalog-params'
import { listingRobots } from '@/lib/seo/metadata'
import { param } from '@/lib/utils'

export async function generateMetadata({ searchParams }: PageProps<'/deals'>): Promise<Metadata> {
  return {
    title: 'Deals on Printers, Ink & Spare Parts',
    description: 'Current discounts on printers, toner, ink and spare parts at CISS Solutions Kenya.',
    alternates: { canonical: '/deals' },
    robots: listingRobots(await searchParams),
  }
}

export default async function DealsPage({ searchParams }: PageProps<'/deals'>) {
  const sp = await searchParams
  const query = parseCatalogParams(sp, { onSale: true })
  if (!param(sp.sort)) query.sort = 'discount'
  const [result, facets] = await Promise.all([searchCatalog(query), getFacets()])
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Deals', href: '/deals' }]} />
      <header className="glass-flat mb-8 mt-4 overflow-hidden rounded-[var(--radius-card)] p-6 sm:p-8">
        <p className="label-mono text-primary-light">Limited-time savings</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Deals</h1>
        <p className="mt-2 max-w-2xl text-fg-secondary">Every product below is currently priced under its regular price. Discounts shown are against our previous selling price.</p>
      </header>
      <CatalogListing
        result={result}
        facets={facets}
        searchParams={sp}
        basePath="/deals"
        emptyTitle="No deals right now"
        emptyDescription="New offers are added regularly. Check back soon or browse the full catalogue."
      />
    </div>
  )
}
