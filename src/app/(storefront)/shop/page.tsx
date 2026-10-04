import type { Metadata } from 'next'
import { CatalogListing } from '@/components/storefront/catalog-listing'
import { Breadcrumbs } from '@/components/ui/misc'
import { getFacets, searchCatalog } from '@/lib/catalog'
import { parseCatalogParams } from '@/lib/catalog-params'
import { listingRobots } from '@/lib/seo/metadata'

export async function generateMetadata({ searchParams }: PageProps<'/shop'>): Promise<Metadata> {
  return {
    title: 'Shop Printers, Spare Parts, Ink & Toner',
    description: 'Browse printers, genuine spare parts, ink, toner, scanners and accessories from Epson, HP, Canon, Brother and more. Delivery across Kenya.',
    alternates: { canonical: '/shop' },
    robots: listingRobots(await searchParams),
  }
}

export default async function ShopPage({ searchParams }: PageProps<'/shop'>) {
  const sp = await searchParams
  const [result, facets] = await Promise.all([searchCatalog(parseCatalogParams(sp)), getFacets()])
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Shop', href: '/shop' }]} />
      <h1 className="mb-8 mt-3 text-3xl font-extrabold sm:text-4xl">Shop all products</h1>
      <CatalogListing result={result} facets={facets} searchParams={sp} basePath="/shop" />
    </div>
  )
}
