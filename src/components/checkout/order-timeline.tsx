import { Check } from 'lucide-react'
import { orderTimeline, type OrderStatus, type PaymentMethod, type PaymentStatus } from '@/lib/ecommerce/orders'
import { cn } from '@/lib/utils'

export function OrderTimeline({ order }: { order: { order_status: OrderStatus; payment_status: PaymentStatus; payment_method: PaymentMethod } }) {
  const steps = orderTimeline(order)
  return (
    <ol className="space-y-0" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 ? (
            <span className={cn('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5', s.done ? 'bg-success' : 'bg-border')} aria-hidden="true" />
          ) : null}
          <span
            className={cn(
              'z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2',
              s.done ? 'border-success bg-success text-white' : s.current ? 'border-primary bg-primary/20' : 'border-border bg-background',
            )}
            aria-hidden="true"
          >
            {s.done ? <Check className="h-4 w-4" /> : null}
          </span>
          <div className="pt-1">
            <p className={cn('font-semibold', !s.done && !s.current && 'text-fg-muted')}>{s.label}</p>
            <p className="text-xs text-fg-muted">{s.done ? 'Done' : s.current ? 'In progress' : 'Pending'}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
