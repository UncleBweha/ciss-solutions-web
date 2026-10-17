import { CheckCircle2, Clock } from 'lucide-react'

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

/** The heading of the order page. */
export function OrderHeading({
  orderNumber,
  paid,
  awaitingConfirmation,
  failedLabel,
  celebrate,
}: {
  orderNumber: string
  paid: boolean
  /** A Paybill or bank transfer order whose payment staff have not confirmed yet. */
  awaitingConfirmation: boolean
  /** Set when the order is cancelled, failed or refunded. */
  failedLabel: string | null
  /** Just placed (arrived from checkout): confetti once the payment is confirmed. */
  celebrate: boolean
}) {
  const unconfirmed = awaitingConfirmation && !paid
  const title = failedLabel ? `Order ${failedLabel.toLowerCase()}` : unconfirmed ? 'Order placed' : paid ? 'Payment confirmed' : 'Order confirmed'
  const text = failedLabel
    ? 'This order is no longer active.'
    : unconfirmed
      ? 'Awaiting payment confirmation by the admin. We will email you as soon as your payment has been checked.'
      : 'Thank you for your order. A confirmation has been sent to your email.'

  return (
    <header className="relative mb-8 text-center">
      {celebrate && paid && !failedLabel ? <Confetti /> : null}
      {failedLabel ? (
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-danger">
          <Clock className="h-8 w-8" aria-hidden="true" />
        </span>
      ) : (
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </span>
      )}
      <h1 className="text-3xl font-bold sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-fg-secondary">{text}</p>
      <p className="mt-4 text-lg">
        Order <strong className="font-mono">#{orderNumber}</strong>
      </p>
    </header>
  )
}
