import type { Metadata } from 'next'
import { Wrench } from 'lucide-react'
import { PartRequestForm } from '@/components/storefront/support-forms'
import { Breadcrumbs } from '@/components/ui/misc'
import { param } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Need help finding a printer part?',
  description: 'Tell us your printer model and the problem. Our technicians will identify the right spare part.',
  alternates: { canonical: '/support/part-request' },
}

export default async function PartRequestPage({ searchParams }: PageProps<'/support/part-request'>) {
  const sp = await searchParams
  return (
    <div className="container-page max-w-3xl py-8">
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Part request', href: '/support/part-request' }]} />
      <div className="glass-flat mt-6 rounded-[var(--radius-card)] p-6 sm:p-8">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-[var(--radius-card)] bg-primary/15 text-primary-light">
          <Wrench className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">Need help finding a part?</h1>
        <p className="mb-6 mt-2 text-fg-secondary">Send us your printer model and what is wrong. A technician will confirm the right part and its price.</p>
        <PartRequestForm brand={param(sp.brand)} model={param(sp.model)} />
      </div>
    </div>
  )
}
