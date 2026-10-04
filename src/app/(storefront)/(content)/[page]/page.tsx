import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Markdown } from '@/components/content/markdown'
import { Breadcrumbs } from '@/components/ui/misc'
import { getDeliveryZones } from '@/lib/catalog'
import { CONTENT_PAGES, getContentPage } from '@/lib/content'
import { deliveryEstimate } from '@/lib/ecommerce/delivery'
import { formatKES } from '@/lib/ecommerce/money'

// /about, /faqs, /privacy, /terms, /refund-policy, /shipping-policy, /warranty
// Unknown slugs render notFound() (a clean 404).
export const revalidate = 86400

export function generateStaticParams() {
  return CONTENT_PAGES.map((page) => ({ page }))
}

export async function generateMetadata({ params }: PageProps<'/[page]'>): Promise<Metadata> {
  const { page } = await params
  const content = await getContentPage(page)
  if (!content) return {}
  return { title: content.title, description: content.description, alternates: { canonical: `/${page}` } }
}

export default async function ContentPage({ params }: PageProps<'/[page]'>) {
  const { page } = await params
  const content = await getContentPage(page)
  if (!content) notFound()
  const zones = page === 'shipping-policy' ? await getDeliveryZones() : []

  return (
    <div className="container-page max-w-3xl py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: content.title, href: `/${page}` }]} />
      <article className="glass-flat mt-6 rounded-[var(--radius-card)] p-6 sm:p-10">
        <h1 className="mb-6 text-3xl font-bold">{content.title}</h1>
        <Markdown source={content.body} />
        {zones.length ? (
          <table className="mt-8 w-full text-sm">
            <caption className="sr-only">Delivery zones</caption>
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Zone</th>
                <th scope="col" className="py-2 pr-3 font-medium">Counties</th>
                <th scope="col" className="py-2 pr-3 font-medium">Estimate</th>
                <th scope="col" className="py-2 text-right font-medium">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="py-2.5 pr-3 font-semibold">{z.name}</td>
                  <td className="py-2.5 pr-3 text-fg-secondary">{z.is_default ? 'All other counties' : z.counties.join(', ')}</td>
                  <td className="py-2.5 pr-3 text-fg-secondary">{deliveryEstimate(z)}</td>
                  <td className="py-2.5 text-right">
                    {formatKES(z.fee)}
                    {z.free_delivery_threshold ? <span className="block text-xs text-fg-muted">Free over {formatKES(z.free_delivery_threshold)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </div>
  )
}
