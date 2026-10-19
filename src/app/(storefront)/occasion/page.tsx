import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductGrid } from '@/components/product/product-card'
import { buttonClass } from '@/components/ui/button'
import { getInStockCards } from '@/lib/catalog'
import { getActiveOccasion } from '@/lib/occasions/data'
import { occasionPicks, picksTitle } from '@/lib/occasions/picks'

// What is here changes with the calendar, so it stays out of search results;
// the products' own pages carry the search traffic.
export const metadata: Metadata = { title: 'Occasion picks', robots: { index: false, follow: true }, alternates: { canonical: '/occasion' } }

export default async function OccasionPicksPage() {
  const occasion = await getActiveOccasion()
  const picks = occasion ? occasionPicks(occasion, await getInStockCards()) : []
  const title = occasion ? picksTitle(occasion) : 'Occasion picks'
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {picks.length ? (
        <>
          <p className="mt-2 max-w-2xl text-fg-secondary">Picked for {occasion!.name}, all in stock and ready to collect or deliver.</p>
          <ProductGrid products={picks} priorityCount={2} className="mt-6" />
        </>
      ) : (
        <div className="glass-flat mt-6 rounded-[var(--radius-card)] px-6 py-14 text-center">
          <h2 className="text-lg font-bold">No occasion on right now</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-secondary">Picks for Christmas, Back to School and the other occasions show up here while they run.</p>
          <Link href="/shop" className={buttonClass('primary', 'md', 'mt-6')}>
            Browse the shop
          </Link>
        </div>
      )}
    </div>
  )
}
