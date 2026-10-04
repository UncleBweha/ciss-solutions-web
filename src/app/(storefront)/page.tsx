import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { ProductGrid } from '@/components/product/product-card'
import { BrandCard, CategoryCard } from '@/components/storefront/cards'
import { Hero, type HeroSlide } from '@/components/storefront/hero'
import { PartFinder } from '@/components/storefront/part-finder'
import { TrustBar } from '@/components/storefront/trust-bar'
import { buttonClass } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/misc'
import { JsonLd } from '@/components/seo/json-ld'
import {
  categoryHref,
  getBrands,
  getCategoryTree,
  getHomepage,
  getPrinterModels,
  getProductCards,
  getSettings,
} from '@/lib/catalog'
import { organizationSchema, websiteSchema } from '@/lib/seo/schema'
import type { HomepageSection } from '@/types/catalog'

export const metadata = { alternates: { canonical: '/' } }

// Homepage dynamic sections refresh hourly (and immediately when staff edit them).
export const revalidate = 3600

function limitOf(section: HomepageSection, fallback: number) {
  const n = Number((section.config as Record<string, unknown>)?.limit)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : fallback
}

export default async function HomePage() {
  const [{ sections, banners }, settings] = await Promise.all([getHomepage(), getSettings()])
  const ordered = sections.length
    ? sections
    : // No sections configured yet: sensible default order.
      (['hero', 'trust', 'categories', 'featured', 'part_finder', 'deals', 'bestsellers', 'brands', 'cta'].map((key, i) => ({
        id: key,
        key,
        title: null,
        subtitle: null,
        is_enabled: true,
        sort_order: i,
        config: {},
        updated_at: '',
      })) as HomepageSection[])

  const rendered = await Promise.all(ordered.map((section) => renderSection(section, banners)))

  return (
    <>
      <JsonLd data={[organizationSchema(settings.business), websiteSchema(settings.business.name)]} />
      <div className="space-y-16 pb-8 pt-6 sm:space-y-20 sm:pt-8">
        {rendered.map((node, i) => (
          <div key={ordered[i].key}>{node}</div>
        ))}
      </div>
    </>
  )
}

async function renderSection(section: HomepageSection, banners: Awaited<ReturnType<typeof getHomepage>>['banners']) {
  switch (section.key) {
    case 'hero': {
      const slides: HeroSlide[] = banners.map((b) => ({
        id: b.id,
        eyebrow: b.eyebrow,
        title: b.title,
        highlight: b.highlight,
        subtitle: b.subtitle,
        imageUrl: b.image_url,
        imageAlt: b.image_alt,
        ctaText: b.cta_text,
        ctaUrl: b.cta_url,
        secondaryCtaText: b.secondary_cta_text,
        secondaryCtaUrl: b.secondary_cta_url,
        background: b.background,
        product: b.product ? { name: b.product.name, slug: b.product.slug, price: b.product.price, short: b.product.short_description } : null,
      }))
      if (!slides.length) {
        return (
          <section className="container-page py-10">
            <h1 className="text-4xl font-bold sm:text-6xl">
              CISS Solutions <span className="block text-primary-light">Printers & Spare Parts</span>
            </h1>
          </section>
        )
      }
      return <Hero slides={slides} />
    }

    case 'trust':
      return <TrustBar />

    case 'categories': {
      const tree = await getCategoryTree()
      const roots = tree.slice(0, limitOf(section, 6))
      if (!roots.length) return null
      return (
        <section aria-labelledby="home-categories" className="container-page">
          <SectionHeading id="home-categories" title={section.title ?? 'Shop by category'} subtitle={section.subtitle} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {roots.map((c) => (
              <CategoryCard key={c.id} name={c.name} href={categoryHref(c)} imageUrl={c.image_url} count={c.product_count} />
            ))}
          </div>
        </section>
      )
    }

    case 'featured':
    case 'bestsellers':
    case 'deals': {
      const filter = section.key === 'featured' ? 'featured' : section.key === 'deals' ? 'deals' : 'bestseller'
      const products = await getProductCards(filter, limitOf(section, section.key === 'featured' ? 10 : 5))
      if (!products.length) return null
      const href = section.key === 'deals' ? '/deals' : section.key === 'featured' ? '/shop' : '/shop?sort=best-selling'
      const fallbackTitle = { featured: 'Featured Products', deals: 'Deals', bestsellers: 'Best Sellers' }[section.key]
      return (
        <section aria-labelledby={`home-${section.key}`} className="container-page">
          <SectionHeading
            id={`home-${section.key}`}
            title={section.title ?? fallbackTitle}
            subtitle={section.subtitle}
            action={
              <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-light hover:text-fg">
                View All <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <ProductGrid products={products} />
        </section>
      )
    }

    case 'part_finder': {
      const [models, tree] = await Promise.all([getPrinterModels(), getCategoryTree()])
      const parts = tree.find((c) => c.slug === 'spare-parts')
      const supplies = tree.find((c) => c.slug === 'ink-toner')
      const partTypes = [...(parts?.children ?? []), ...(supplies?.children ?? [])].map((c) => ({ slug: c.slug, name: c.name }))
      return (
        <section aria-labelledby="home-finder" className="container-page">
          <SectionHeading id="home-finder" title={section.title ?? 'Find the right spare part'} subtitle={section.subtitle} />
          <PartFinder
            models={models.map((m) => ({ id: m.id, slug: m.slug, name: m.name, model_number: m.model_number, brand_slug: m.brand_slug, brand_name: m.brand_name }))}
            partTypes={partTypes}
          />
        </section>
      )
    }

    case 'brands': {
      const brands = await getBrands()
      if (!brands.length) return null
      return (
        <section aria-labelledby="home-brands" className="container-page">
          <SectionHeading
            id="home-brands"
            title={section.title ?? 'Shop by brand'}
            subtitle={section.subtitle}
            action={
              <Link href="/brands" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-light hover:text-fg">
                All brands <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {brands.slice(0, 10).map((b) => (
              <BrandCard key={b.id} name={b.name} slug={b.slug} logoUrl={b.logo_url} />
            ))}
          </div>
        </section>
      )
    }

    case 'cta': {
      const config = (section.config ?? {}) as { cta_text?: string; cta_url?: string }
      return (
        <section className="container-page">
          <div className="flex flex-col items-start gap-6 rounded-[var(--radius-card)] border border-border bg-panel p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="label-mono mb-2 flex items-center gap-2 text-primary-light">
                <span className="reg-mark" aria-hidden="true" /> Parts desk
              </p>
              <h2 className="text-xl font-semibold sm:text-2xl">{section.title ?? 'Not sure which part you need?'}</h2>
              {section.subtitle ? <p className="mt-1 text-fg-secondary">{section.subtitle}</p> : null}
            </div>
            <Link href={config.cta_url || '/support/part-request'} className={buttonClass('primary', 'lg')}>
              <Wrench className="h-5 w-5" aria-hidden="true" />
              {config.cta_text || 'Get help finding a part'}
            </Link>
          </div>
        </section>
      )
    }

    default:
      return null
  }
}
