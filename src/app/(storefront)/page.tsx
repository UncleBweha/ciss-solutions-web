import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { ProductRail } from '@/components/product/product-card'
import { BrandCard, CategoryCard } from '@/components/storefront/cards'
import { Hero, type HeroSlide } from '@/components/storefront/hero'
import { PartFinder, PartFinderPanel } from '@/components/storefront/part-finder'
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

  const heroShown = ordered.some((s) => s.key === 'hero')
  const rendered = await Promise.all(ordered.map((section) => renderSection(section, banners, heroShown)))

  return (
    <>
      <JsonLd data={[organizationSchema(settings.business), websiteSchema(settings.business.name)]} />
      <h1 className="sr-only">CISS Solutions: printers, spare parts, ink and toner in Kenya</h1>
      <div className="space-y-8 pb-6 pt-4 sm:space-y-10 sm:pt-5">
        {rendered.map((node, i) => (
          <div key={ordered[i].key}>{node}</div>
        ))}
      </div>
    </>
  )
}

async function renderSection(section: HomepageSection, banners: Awaited<ReturnType<typeof getHomepage>>['banners'], heroShown: boolean) {
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
      const models = await getPrinterModels()
      const finderModels = models.map((m) => ({ id: m.id, slug: m.slug, name: m.name, model_number: m.model_number, brand_slug: m.brand_slug, brand_name: m.brand_name }))
      return (
        <div className="container-page grid gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          {slides.length ? <Hero slides={slides} /> : <div className="hidden lg:block" />}
          <PartFinderPanel models={finderModels} />
        </div>
      )
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
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-6">
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
      const fallbackTitle = { featured: 'Popular right now', deals: 'Deals', bestsellers: 'Best sellers' }[section.key]
      return (
        <section aria-labelledby={`home-${section.key}`} className="container-page">
          <SectionHeading
            id={`home-${section.key}`}
            title={section.title ?? fallbackTitle}
            subtitle={section.subtitle}
            action={
              <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-light hover:underline">
                See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <ProductRail products={products} label={section.title ?? fallbackTitle} />
        </section>
      )
    }

    case 'part_finder': {
      // The hero row already carries the compact finder.
      if (heroShown) return null
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
              <Link href="/brands" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-light hover:underline">
                All brands <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
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
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-fg-secondary sm:grid">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="max-w-2xl">
                <h2 className="text-lg font-bold">{section.title ?? 'Not sure which part you need?'}</h2>
                {section.subtitle ? <p className="mt-0.5 text-sm text-fg-secondary">{section.subtitle}</p> : null}
              </div>
            </div>
            <Link href={config.cta_url || '/support/part-request'} className={buttonClass('secondary', 'md', 'shrink-0')}>
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
