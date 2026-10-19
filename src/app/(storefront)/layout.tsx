import { occasionCardVars } from '@/components/occasions/card-decor'
import { OccasionDecorations, OccasionRibbon } from '@/components/occasions/decorations'
import { BottomNav } from '@/components/storefront/bottom-nav'
import { Footer } from '@/components/storefront/footer'
import { Header, type NavData } from '@/components/storefront/header'
import { WhatsAppButton } from '@/components/storefront/whatsapp-button'
import { categoryHref, getBrands, getCategoryTree, getSettings } from '@/lib/catalog'
import { whatsappLink } from '@/lib/contact'
import { getActiveOccasion } from '@/lib/occasions/data'
import { nairobiToday, occasionIntensity, themeKeyFor } from '@/lib/occasions/themes'

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [tree, brands, settings, occasion] = await Promise.all([getCategoryTree(), getBrands(), getSettings(), getActiveOccasion()])
  // The occasion the store is dressed for (Admin, Settings, Occasions). Read from a
  // tagged cache, not cookies, so every page keeps its static caching.
  const theme = occasion ? themeKeyFor(occasion) : null
  // How far into its build-up it is today (Christmas: lights from the 15th, everything on the 25th).
  const level = occasion ? occasionIntensity(occasion, nairobiToday()) : 4
  // Product photos wear the occasion's ribbon and ornament from the second level up.
  const dressProducts = theme !== null && level >= 2
  const nav: NavData = {
    categories: tree.map((c) => ({
      name: c.name,
      href: categoryHref(c),
      count: c.product_count,
      children: c.children.map((child) => ({ name: child.name, href: categoryHref(child), count: child.product_count })),
    })),
    brands: brands.map((b) => ({ name: b.name, slug: b.slug })),
  }
  return (
    <>
      <OccasionDecorations occasion={occasion} level={level} />
      <Header
        nav={nav}
        contact={{
          phone: settings.business.phone,
          whatsappHref: whatsappLink(settings.business.whatsapp),
          location: settings.business.location,
          hours: settings.business.business_hours,
        }}
      />
      <OccasionRibbon occasion={occasion} level={level} />
      <main id="main" className="min-h-[60vh]" data-occasion-theme={dressProducts ? theme : undefined} style={dressProducts ? occasionCardVars(theme) : undefined}>
        {children}
      </main>
      <Footer business={settings.business} />
      {/* Room for the fixed bottom navigation on phones and tablets. */}
      <div aria-hidden="true" className="h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] lg:hidden" />
      <BottomNav categories={nav.categories} />
      <WhatsAppButton number={settings.business.whatsapp} />
    </>
  )
}
