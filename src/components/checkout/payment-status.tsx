'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Smartphone, XCircle } from 'lucide-react'
import { retryMpesaPaymentAction } from '@/actions/checkout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { track } from '@/lib/analytics'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'

type View = { state: 'paid' | 'pending' | 'failed' | 'expired' | 'none'; message: string | null }

/**
 * Shows M-Pesa progress and polls the server. The server decides whether the
 * order is paid (callback / STK query); this component only displays it.
 */
export function MpesaPaymentStatus({
  orderNumber,
  token,
  phone,
  total,
  initial,
}: {
  orderNumber: string
  token: string | null
  phone: string
  total: number
  initial: View
}) {
  const router = useRouter()
  const [view, setView] = useState<View>(initial)
  const [retryPhone, setRetryPhone] = useState(formatKenyanPhone(phone))
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const polls = useRef(0)

  useEffect(() => {
    if (view.state !== 'pending' && view.state !== 'none') return
    polls.current = 0
    const t = setInterval(async () => {
      polls.current += 1
      if (polls.current > 60) return clearInterval(t) // ~5 minutes
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/status${token ? `?t=${token}` : ''}`, { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as View
        setView(next)
        if (next.state === 'paid') {
          track('purchase', { transaction_id: orderNumber, value: total })
          router.refresh()
        }
      } catch {
        // offline: keep polling
      }
    }, 5000)
    return () => clearInterval(t)
  }, [view.state, orderNumber, token, total, router])

  if (view.state === 'paid') {
    return (
      <div role="status" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-success/40 bg-success/10 p-4 text-success">
        <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
        <p className="font-semibold">Payment received. Thank you!</p>
      </div>
    )
  }
  if (view.state === 'expired') {
    return (
      <div role="alert" className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 p-4 text-danger">
        {view.message}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-primary/40 bg-primary/10 p-5" aria-live="polite">
      {view.state === 'pending' ? (
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-primary-light" aria-hidden="true" />
          <div>
            <p className="font-semibold">Check your phone</p>
            <p className="text-sm text-fg-secondary">An M-Pesa prompt was sent to {formatKenyanPhone(phone)}. Enter your PIN to pay. This page updates automatically.</p>
          </div>
        </div>
      ) : view.state === 'failed' ? (
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="font-semibold">Payment not completed</p>
            <p className="text-sm text-fg-secondary">{view.message} You can try again below.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-primary-light" aria-hidden="true" />
          <p className="text-sm text-fg-secondary">Complete payment with M-Pesa to confirm your order.</p>
        </div>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          setNotice(null)
          start(async () => {
            const result = await retryMpesaPaymentAction(orderNumber, token, retryPhone)
            setNotice(result.message)
            if (result.ok) setView({ state: 'pending', message: result.message })
          })
        }}
      >
        <label htmlFor="retry-phone" className="sr-only">
          M-Pesa phone number
        </label>
        <Input id="retry-phone" type="tel" value={retryPhone} onChange={(e) => setRetryPhone(e.target.value)} className="sm:max-w-56" />
        <Button type="submit" variant={view.state === 'pending' ? 'glass' : 'primary'} loading={pending}>
          {view.state === 'pending' ? 'Resend prompt' : 'Pay with M-Pesa'}
        </Button>
      </form>
      {notice ? <p className="text-sm text-fg-secondary">{notice}</p> : null}
    </div>
  )
}
