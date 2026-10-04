import type { Metadata } from 'next'
import { PackageSearch } from 'lucide-react'
import { TrackOrderForm } from '@/components/checkout/track-order-form'
import { Breadcrumbs } from '@/components/ui/misc'
import { param } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Check the status of your CISS Solutions order with your order number and phone number.',
  alternates: { canonical: '/track-order' },
}

export default async function TrackOrderPage({ searchParams }: PageProps<'/track-order'>) {
  const sp = await searchParams
  return (
    <div className="container-page max-w-xl py-10">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Track order', href: '/track-order' }]} />
      <div className="glass mt-6 rounded-[var(--radius-card)] p-6 sm:p-8">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-[var(--radius-card)] bg-primary/15 text-primary-light">
          <PackageSearch className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">Track your order</h1>
        <p className="mt-2 text-fg-secondary">Enter your order number (e.g. CISS-20261004-0012) and the phone number you used at checkout.</p>
        <TrackOrderForm defaultOrder={param(sp.order) ?? ''} />
      </div>
    </div>
  )
}
