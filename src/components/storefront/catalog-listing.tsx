import { PackageSearch } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { LinkButton } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { Pagination } from '@/components/ui/pagination'
import { withParams, type SearchParams } from '@/lib/catalog-params'
import type { CatalogResult } from '@/types/catalog'
import { FilterSidebar, MobileFilterDrawer, SortSelect, type Facets } from './filters'

/** Filters + sort + grid + pagination, shared by shop, category, brand, search and deals. */
export function CatalogListing({
  result,
  facets,
  searchParams,
  basePath,
  searchMode,
  emptyTitle = 'No products found',
  emptyDescription = 'Try removing some filters or searching for a different model or part number.',
}: {
  result: CatalogResult
  facets: Facets
  searchParams: SearchParams
  basePath: string
  searchMode?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  const from = result.total === 0 ? 0 : (result.page - 1) * result.perPage + 1
  const to = Math.min(result.total, result.page * result.perPage)
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="glass-flat sticky top-[calc(var(--header-height)+1rem)] rounded-[var(--radius-card)] p-5">
          <FilterSidebar facets={facets} current={searchParams} />
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-secondary" aria-live="polite">
            {result.total ? (
              <>
                Showing <strong className="text-fg">{from}–{to}</strong> of <strong className="text-fg">{result.total}</strong> products
              </>
            ) : (
              'No matching products'
            )}
          </p>
          <div className="flex items-center gap-2">
            <MobileFilterDrawer facets={facets} current={searchParams} />
            <SortSelect current={searchParams} includeRelevance={searchMode} />
          </div>
        </div>
        {result.items.length ? (
          <>
            <ProductGrid products={result.items} priorityCount={4} layout="sidebar" />
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(p) => withParams(basePath, searchParams, { page: p > 1 ? String(p) : undefined })}
            />
          </>
        ) : (
          <EmptyState
            icon={<PackageSearch className="h-8 w-8" />}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <>
                <LinkButton href={basePath}>Clear filters</LinkButton>
                <LinkButton href="/support/part-request" variant="glass">
                  Ask us to find it
                </LinkButton>
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
