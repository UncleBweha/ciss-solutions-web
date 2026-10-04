'use client'
import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import { RefreshCw, ServerCrash, WifiOff } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false)
  useEffect(() => {
    console.error(error)
  }, [error])
  const Icon = offline ? WifiOff : ServerCrash
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="mb-6 grid h-20 w-20 place-items-center rounded-[var(--radius-card)] bg-danger/15 text-danger">
        <Icon className="h-10 w-10" aria-hidden="true" />
      </span>
      <h1 className="text-3xl font-bold">{offline ? 'You appear to be offline' : 'Something went wrong'}</h1>
      <p className="mt-3 max-w-md text-fg-secondary">
        {offline ? 'Check your internet connection and try again. Your cart is saved on this device.' : 'We hit a problem loading this page. Please try again in a moment.'}
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-fg-muted">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
        <Link href="/" className={buttonClass('glass', 'lg')}>
          Go to homepage
        </Link>
      </div>
    </div>
  )
}
