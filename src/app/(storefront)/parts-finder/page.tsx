import type { Metadata } from 'next'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { JsonLd } from '@/components/seo/json-ld'
import { ProductGrid } from '@/components/product/product-card'
import { PartFinder } from '@/components/storefront/part-finder'
import { LinkButton } from '@/components/ui/button'
import { Breadcrumbs, EmptyState } from '@/components/ui/misc'
import { getCategoryTree, getPrinterModels, searchCatalog } from '@/lib/catalog'
import { breadcrumbSchema } from '@/lib/seo/schema'
import { param } from '@/lib/utils'

export async function generateMetadata({ searchParams }: PageProps<'/parts-finder'>): Promise<Metadata> {
  const sp = await searchParams
  const models = await getPrinterModels()
  const model = models.find((m) => m.slug === param(sp.model))
  return {
    title: model ? `Spare parts & supplies for ${model.name}` : 'Printer Spare Parts Finder',
    description: model
      ? `Compatible ink, toner and spare parts for the ${model.name}, available in Kenya.`
      : 'Find compatible printer spare parts, ink and toner by printer brand and model, or search by part number.',
    alternates: { canonical: model ? `/parts-finder?model=${model.slug}` : '/parts-finder' },
    robots: param(sp.type) || param(sp.brand) ? { index: false, follow: true } : undefined,
  }
}

export default async function PartsFinderPage({ searchParams }: PageProps<'/parts-finder'>) {
  const sp = await searchParams
  const [models, tree] = await Promise.all([getPrinterModels(), getCategoryTree()])
  const parts = tree.find((c) => c.slug === 'spare-parts')
  const supplies = tree.find((c) => c.slug === 'ink-toner')
  const partTypes = [...(parts?.children ?? []), ...(supplies?.children ?? [])].map((c) => ({ slug: c.slug, name: c.name }))

  const model = models.find((m) => m.slug === param(sp.model))
  const brand = param(sp.brand) ?? model?.brand_slug
  const type = partTypes.find((t) => t.slug === param(sp.type))
  const result = model ? await searchCatalog({ printerModelId: model.id, category: type?.slug, sort: 'best-selling', perPage: 48 }) : null
  // A printer model's own listing also matches; show parts/supplies only.
  const items = result?.items.filter((p) => p.product_type !== 'printer') ?? []
  const brandModels = !model && brand ? models.filter((m) => m.brand_slug === brand) : []
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Spare Parts', href: '/c/spare-parts' },
    { name: 'Parts finder', href: '/parts-finder' },
  ]

  return (
    <div className="container-page py-8">
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <header className="mb-8 mt-3 max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{model ? `Parts & supplies for ${model.name}` : 'Find the right spare part'}</h1>
        <p className="mt-2 text-fg-secondary">
          Choose your printer brand and model to see every compatible spare part, ink and toner we stock, or search by part number.
        </p>
      </header>

      <PartFinder
        models={models.map((m) => ({ id: m.id, slug: m.slug, name: m.name, model_number: m.model_number, brand_slug: m.brand_slug, brand_name: m.brand_name }))}
        partTypes={partTypes}
        initial={{ brand, model: model?.slug, type: type?.slug }}
      />

      {brandModels.length ? (
        <section className="mt-12" aria-labelledby="brand-models">
          <h2 id="brand-models" className="mb-4 text-xl font-bold">
            Choose your {brandModels[0].brand_name} printer
          </h2>
          <ul className="flex flex-wrap gap-2">
            {brandModels.map((m) => (
              <li key={m.id}>
                <Link href={`/parts-finder?model=${m.slug}`} className="glass-flat block rounded-full px-4 py-2 text-sm font-semibold text-fg-secondary hover:border-primary/50 hover:text-fg">
                  {m.model_number}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model ? (
        <section className="mt-12" aria-labelledby="finder-results">
          <h2 id="finder-results" className="mb-6 text-xl font-bold">
            {items.length} compatible {type ? type.name.toLowerCase() : 'parts & supplies'} for {model.model_number}
          </h2>
          {items.length ? (
            <ProductGrid products={items} />
          ) : (
            <EmptyState
              icon={<Wrench className="h-8 w-8" />}
              title="We couldn't find a listed part"
              description={`We may still be able to source it. Tell us what you need for your ${model.name} and our technicians will get back to you.`}
              action={<LinkButton href={`/support/part-request?brand=${encodeURIComponent(model.brand_name)}&model=${encodeURIComponent(model.model_number)}`}>Request this part</LinkButton>}
            />
          )}
        </section>
      ) : null}

      <div className="glass-flat mt-14 flex flex-col items-start gap-4 rounded-[var(--radius-card)] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Need help finding a part?</h2>
          <p className="text-sm text-fg-secondary">Send your printer model, the error or problem, and a photo if you have one.</p>
        </div>
        <LinkButton href="/support/part-request" variant="glass">
          Ask a technician
        </LinkButton>
      </div>
    </div>
  )
}
