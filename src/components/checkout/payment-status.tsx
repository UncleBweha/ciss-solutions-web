'use client'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Clock, Loader2, Smartphone, XCircle } from 'lucide-react'
import { retryMpesaPaymentAction } from '@/actions/checkout'
import { SantaCelebrationAnnouncement, SantaSleighCelebration } from '@/components/occasions/santa-sleigh'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { track } from '@/lib/analytics'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'

type View = { state: 'paid' | 'pending' | 'failed' | 'expired' | 'none'; message: string | null }

const PaymentContext = createContext<{
  view: View
  setView: (view: View) => void
  /** Checking stopped while the payment was still open (long wait, or the server refusing). */
  stalled: boolean
  /** Starts checking again. */
  restart: () => void
} | null>(null)

/**
 * Holds the M-Pesa progress for the order page and polls the server. The server decides
 * whether the order is paid (from the payment provider's callback); the heading and the status panel both
 * read it from here, so they change at the same moment.
 */
export function MpesaPaymentProvider({
  orderNumber,
  total,
  initial,
  children,
}: {
  orderNumber: string
  total: number
  initial: View
  children: React.ReactNode
}) {
  const router = useRouter()
  const [view, setView] = useState<View>(initial)
  // Counts rounds of checking: a resend (or "Check again") starts a new one even though
  // the payment is "pending" both before and after.
  const [round, setRound] = useState(0)
  const [stalled, setStalled] = useState(false)
  const restart = useCallback(() => {
    setStalled(false)
    setRound((r) => r + 1)
  }, [])

  useEffect(() => {
    if (view.state !== 'pending' && view.state !== 'none') return
    let polls = 0
    let refused = 0
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const poll = async () => {
      // Nobody is looking: check again when the tab is back in view.
      if (document.hidden) {
        timer = setTimeout(poll, 3000)
        return
      }
      polls += 1
      try {
        // The order's access cookie authorises this; the token is never put in the address.
        const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/status`, { cache: 'no-store' })
        if (stopped) return
        if (res.ok) {
          refused = 0
          const next = (await res.json()) as View
          setView(next)
          if (next.state === 'paid') {
            track('purchase', { transaction_id: orderNumber, value: total })
            router.refresh()
            return
          }
        } else if (++refused >= 3) {
          // The server keeps saying no (access lapsed, or too many requests): say so rather than wait in silence.
          setStalled(true)
          return
        }
      } catch {
        // offline: keep polling
      }
      if (stopped) return
      // Every 3s while the customer is likely entering their PIN, then slower; ~6 minutes in all.
      if (polls < 60) timer = setTimeout(poll, polls < 15 ? 3000 : polls < 35 ? 5000 : 8000)
      else setStalled(true)
    }
    timer = setTimeout(poll, 3000)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [view.state, round, orderNumber, total, router])

  return <PaymentContext.Provider value={{ view, setView, stalled, restart }}>{children}</PaymentContext.Provider>
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
  christmas = false,
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
  /** The store is dressed for Christmas: Santa's sleigh flies past with the confetti. */
  christmas?: boolean
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
      {celebrate && paid && !failedLabel && christmas ? (
        <>
          <SantaSleighCelebration />
          <SantaCelebrationAnnouncement />
        </>
      ) : null}
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
export function MpesaPaymentStatus({ orderNumber, phone }: { orderNumber: string; phone: string }) {
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
      {live.stalled && view.state === 'pending' ? (
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-primary-light" aria-hidden="true" />
          <div>
            <p className="font-semibold">We have stopped checking</p>
            <p className="text-sm text-fg-secondary">We have not heard from M-Pesa yet. If you entered your PIN, check again. If no prompt reached your phone, send it again below.</p>
            <Button type="button" size="sm" variant="glass" className="mt-2" onClick={live.restart}>
              Check again
            </Button>
          </div>
        </div>
      ) : view.state === 'pending' ? (
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
            const result = await retryMpesaPaymentAction(orderNumber, retryPhone)
            setNotice(result.message)
            if (result.ok) {
              setView({ state: 'pending', message: result.message })
              live.restart()
            }
          })
        }}
      >
        <label htmlFor="retry-phone" className="sr-only">
          M-Pesa phone number
        </label>
        <Input id="retry-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712345678" value={retryPhone} onChange={(e) => setRetryPhone(e.target.value)} className="sm:max-w-56" />
        <Button type="submit" variant={view.state === 'pending' ? 'glass' : 'primary'} loading={pending}>
          {view.state === 'pending' ? 'Resend prompt' : 'Pay with M-Pesa'}
        </Button>
      </form>
      {notice ? <p className="text-sm text-fg-secondary">{notice}</p> : null}
    </div>
  )
}
