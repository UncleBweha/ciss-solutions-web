import type { Metadata } from 'next'
import { BrandCard } from '@/components/storefront/cards'
import { Breadcrumbs } from '@/components/ui/misc'
import { getBrands } from '@/lib/catalog'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Printer Brands',
  description: 'Shop printers, ink, toner and genuine spare parts by brand: Epson, HP, Canon, Brother, Kyocera, Pantum and more.',
  alternates: { canonical: '/brands' },
}

export default async function BrandsPage() {
  const brands = await getBrands()
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Brands', href: '/brands' }]} />
      <h1 className="mb-8 mt-3 text-3xl font-extrabold sm:text-4xl">Shop by brand</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {brands.map((b) => (
          <BrandCard key={b.id} name={b.name} slug={b.slug} logoUrl={b.logo_url} description={b.description} />
        ))}
      </div>
    </div>
  )
}
