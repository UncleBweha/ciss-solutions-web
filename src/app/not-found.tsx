import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import { buttonClass } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <span className="mb-6 grid h-20 w-20 place-items-center rounded-[var(--radius-card)] bg-primary/15 text-primary-light">
        <WifiOff className="h-10 w-10" aria-hidden="true" />
      </span>
      <p className="label-mono text-primary-light">404</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Looks like this page went offline.</h1>
      <p className="mt-3 max-w-md text-fg-secondary">The product or page you&apos;re looking for could not be found.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={buttonClass('primary', 'lg')}>
          Continue Shopping
        </Link>
        <Link href="/search" className={buttonClass('glass', 'lg')}>
          Search products
        </Link>
      </div>
    </div>
  )
}
