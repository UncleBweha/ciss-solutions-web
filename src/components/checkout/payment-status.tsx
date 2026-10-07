'use client'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Clock, Loader2, Smartphone, XCircle } from 'lucide-react'
import { retryMpesaPaymentAction } from '@/actions/checkout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { track } from '@/lib/analytics'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'

type View = { state: 'paid' | 'pending' | 'failed' | 'expired' | 'none'; message: string | null }

const PaymentContext = createContext<{ view: View; setView: (view: View) => void } | null>(null)

/**
 * Holds the M-Pesa progress for the order page and polls the server. The server decides
 * whether the order is paid (callback / STK query); the heading and the status panel both
 * read it from here, so they change at the same moment.
 */
export function MpesaPaymentProvider({
  orderNumber,
  token,
  total,
  initial,
  children,
}: {
  orderNumber: string
  token: string | null
  total: number
  initial: View
  children: React.ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState<View>(initial)

  useEffect(() => {
    if (view.state !== 'pending' && view.state !== 'none') return
    let polls = 0
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const poll = async () => {
      polls += 1
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/status${token ? `?t=${token}` : ''}`, { cache: 'no-store' })
        if (res.ok && !stopped) {
          const next = (await res.json()) as View
          setView(next)
          if (next.state === 'paid') {
            track('purchase', { transaction_id: orderNumber, value: total })
            router.refresh()
            return
          }
        }
      } catch {
        // offline: keep polling
      }
      // Every 3s while the customer is likely entering their PIN, then every 6s; ~5 minutes in all.
      if (!stopped && polls < 65) timer = setTimeout(poll, polls < 30 ? 3000 : 6000)
    }
    timer = setTimeout(poll, 3000)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [view.state, orderNumber, token, total, router])

  return <PaymentContext.Provider value={{ view, setView }}>{children}</PaymentContext.Provider>
}

const CONFETTI_COLORS = ['var(--ink-cyan)', 'var(--ink-magenta)', 'var(--ink-yellow)', 'var(--primary-light)', 'var(--success)']

/** A short burst of confetti behind the heading. Decorative; hidden when motion is reduced. */
function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 7) * 90}ms`,
            animationDuration: `${1600 + ((i * 53) % 900)}ms`,
            rotate: `${(i * 47) % 360}deg`,
          }}
        />
      ))}
    </span>
  )
}

/**
 * The heading of the order page. `paid` is what the server rendered; for M-Pesa orders the
 * live payment state takes over as soon as the payment clears.
 */
export function OrderHeading({
  orderNumber,
  paid: paidOnServer,
  awaitingMpesa,
  awaitingConfirmation,
  failedLabel,
  celebrate,
}: {
  orderNumber: string
  paid: boolean
  /** An M-Pesa order that still has to be paid. */
  awaitingMpesa: boolean
  /** A Paybill or bank transfer order whose payment staff have not confirmed yet. */
  awaitingConfirmation: boolean
  /** Set when the order is cancelled, failed or refunded. */
  failedLabel: string | null
  /** Just placed (arrived from checkout): confetti once the payment is confirmed. */
  celebrate: boolean
}) {
  const live = useContext(PaymentContext)
  const paid = paidOnServer || live?.view.state === 'paid'
  const unconfirmed = awaitingConfirmation && !paid
  const waiting = (awaitingMpesa || awaitingConfirmation) && !paid
  const title = failedLabel
    ? `Order ${failedLabel.toLowerCase()}`
    : unconfirmed
      ? 'Order placed'
      : waiting
        ? 'Almost there'
        : awaitingMpesa || paid
          ? 'Payment confirmed'
          : 'Order confirmed'
  const text = failedLabel
    ? 'This order is no longer active.'
    : unconfirmed
      ? 'Awaiting payment confirmation by the admin. We will email you as soon as your payment has been checked.'
      : waiting
        ? 'Complete your M-Pesa payment to confirm your order.'
        : 'Thank you for your order. A confirmation has been sent to your email.'

  return (
    <header className="relative mb-8 text-center">
      {celebrate && paid && !failedLabel ? <Confetti /> : null}
      {failedLabel || (waiting && !unconfirmed) ? (
        <span className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${failedLabel ? 'bg-danger/15 text-danger' : 'bg-primary/15 text-primary-light'}`}>
          <Clock className="h-8 w-8" aria-hidden="true" />
        </span>
      ) : (
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </span>
      )}
      <h1 className="text-3xl font-bold sm:text-4xl" aria-live="polite">
        {title}
      </h1>
      <p className="mt-2 text-fg-secondary">{text}</p>
      <p className="mt-4 text-lg">
        Order <strong className="font-mono">#{orderNumber}</strong>
      </p>
    </header>
  )
}

/** The M-Pesa prompt panel: progress, failure and retry. Shows nothing once the order is paid. */
export function MpesaPaymentStatus({ orderNumber, token, phone }: { orderNumber: string; token: string | null; phone: string }) {
  const live = useContext(PaymentContext)
  const [retryPhone, setRetryPhone] = useState(formatKenyanPhone(phone))
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!live) return null
  const { view, setView } = live

  // The heading already says "Payment confirmed".
  if (view.state === 'paid') return null
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
        <Input id="retry-phone" type="tel" inputMode="tel" placeholder="0712345678" value={retryPhone} onChange={(e) => setRetryPhone(e.target.value)} className="sm:max-w-56" />
        <Button type="submit" variant={view.state === 'pending' ? 'glass' : 'primary'} loading={pending}>
          {view.state === 'pending' ? 'Resend prompt' : 'Pay with M-Pesa'}
        </Button>
      </form>
      {notice ? <p className="text-sm text-fg-secondary">{notice}</p> : null}
    </div>
  )
}
