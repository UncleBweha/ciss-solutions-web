import { Footer } from '@/components/storefront/footer'
import { Header, type NavData } from '@/components/storefront/header'
import { WhatsAppButton } from '@/components/storefront/whatsapp-button'
import { categoryHref, getBrands, getCategoryTree, getSettings } from '@/lib/catalog'

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [tree, brands, settings] = await Promise.all([getCategoryTree(), getBrands(), getSettings()])
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
      <Header nav={nav} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer business={settings.business} />
      <WhatsAppButton number={settings.business.whatsapp} />
    </>
  )
}
