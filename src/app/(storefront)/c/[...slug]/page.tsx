import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { CatalogListing } from '@/components/storefront/catalog-listing'
import { Breadcrumbs } from '@/components/ui/misc'
import { categoryHref, getCategoryByPath, getFacets, searchCatalog } from '@/lib/catalog'
import { parseCatalogParams } from '@/lib/catalog-params'
import { listingRobots } from '@/lib/seo/metadata'
import { breadcrumbSchema, collectionSchema } from '@/lib/seo/schema'

export async function generateMetadata({ params, searchParams }: PageProps<'/c/[...slug]'>): Promise<Metadata> {
  const { slug } = await params
  const found = await getCategoryByPath(slug)
  if (!found) return { title: 'Category not found' }
  const { node } = found
  return {
    title: node.seo_title ? { absolute: node.seo_title } : `${node.name} in Kenya`,
    description: node.seo_description || node.description || `Shop ${node.name} at CISS Solutions with delivery across Kenya.`,
    alternates: { canonical: categoryHref(node) },
    robots: listingRobots(await searchParams),
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/c/[...slug]'>) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const found = await getCategoryByPath(slug)
  if (!found) notFound()
  const { node, canonical, ancestors } = found
  // /c/ink-tank -> /c/printers/ink-tank
  if (!canonical) permanentRedirect(categoryHref(node))

  const [result, facets] = await Promise.all([
    searchCatalog(parseCatalogParams(sp, { category: node.slug })),
    getFacets({ categories: false }),
  ])
  const crumbs = [
    { name: 'Home', href: '/' },
    ...ancestors.map((a) => ({ name: a.name, href: categoryHref(a) })),
    { name: node.name, href: categoryHref(node) },
  ]

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbSchema(crumbs), collectionSchema(node.name, categoryHref(node), node.description)]} />
      <Breadcrumbs items={crumbs} />
      <header className="mb-8 mt-3 max-w-3xl">
        <h1 className="text-3xl font-bold sm:text-4xl">{node.name}</h1>
        {node.description ? <p className="mt-2 text-fg-secondary">{node.description}</p> : null}
      </header>
      {node.children.length ? (
        <nav aria-label={`${node.name} subcategories`} className="scrollbar-none -mx-4 mb-8 flex gap-2 overflow-x-auto px-4">
          {node.children.map((child) => (
            <Link key={child.id} href={categoryHref(child)} className="glass-card shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold text-fg-secondary transition-colors hover:border-primary/50 hover:text-fg">
              {child.name} <span className="text-fg-muted">({child.product_count})</span>
            </Link>
          ))}
        </nav>
      ) : null}
      <CatalogListing result={result} facets={facets} searchParams={sp} basePath={categoryHref(node)} />
    </div>
  )
}
