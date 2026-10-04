import type { Metadata } from 'next'
import { SearchTracker } from '@/components/storefront/search-tracker'
import { CatalogListing } from '@/components/storefront/catalog-listing'
import { SearchBar } from '@/components/storefront/search-bar'
import { Breadcrumbs } from '@/components/ui/misc'
import { getFacets, searchCatalog } from '@/lib/catalog'
import { parseCatalogParams } from '@/lib/catalog-params'
import { param } from '@/lib/utils'

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const q = param((await searchParams).q)
  return {
    title: q ? `Search results for “${q}”` : 'Search',
    // Internal search result pages are never indexed.
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams
  const q = param(sp.q)?.trim() ?? ''
  const [result, facets] = await Promise.all([q ? searchCatalog(parseCatalogParams(sp)) : null, getFacets()])

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Search', href: '/search' }]} />
      <h1 className="mb-6 mt-3 text-3xl font-bold sm:text-4xl">{q ? <>Results for “{q}”</> : 'Search products'}</h1>
      <SearchBar className="mb-8 max-w-2xl md:hidden" />
      {result ? (
        <>
          <SearchTracker query={q} results={result.total} />
          <CatalogListing
            result={result}
            facets={facets}
            searchParams={sp}
            basePath="/search"
            searchMode
            emptyTitle={`No results for “${q}”`}
            emptyDescription="Check the spelling, try the printer model (e.g. L3250, M404) or part number, or ask our team to find it for you."
          />
        </>
      ) : (
        <p className="text-fg-secondary">Search by product name, printer model, part number, SKU or brand.</p>
      )}
    </div>
  )
}
