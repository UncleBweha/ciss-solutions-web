import { CircleCheck, CircleAlert, CircleX } from 'lucide-react'
import { discountPercent, formatKES, savings } from '@/lib/ecommerce/money'
import { stockLabels, stockStatus } from '@/lib/ecommerce/inventory'
import { cn } from '@/lib/utils'

export function PriceDisplay({
  price,
  compareAt,
  size = 'md',
  showSavings,
  from,
  className,
}: {
  price: number
  compareAt?: number | null
  size?: 'sm' | 'md' | 'lg'
  showSavings?: boolean
  from?: boolean
  className?: string
}) {
  const discounted = compareAt != null && Number(compareAt) > Number(price)
  const priceSize = { sm: 'text-base', md: 'text-lg', lg: 'text-3xl sm:text-4xl' }[size]
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-extrabold tracking-tight text-fg', priceSize)}>
        {from ? <span className="mr-1 text-xs font-medium text-fg-muted">From</span> : null}
        {formatKES(price)}
      </span>
      {discounted ? (
        <>
          <span className="text-sm text-fg-muted line-through">
            <span className="sr-only">Was </span>
            {formatKES(compareAt)}
          </span>
          {showSavings ? (
            <span className="text-sm font-semibold text-green-300">Save {formatKES(savings(Number(price), Number(compareAt)))}</span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function DiscountBadge({ price, compareAt, className }: { price: number; compareAt?: number | null; className?: string }) {
  const pct = discountPercent(Number(price), compareAt != null ? Number(compareAt) : null)
  if (!pct) return null
  return <span className={cn('rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white', className)}>-{pct}%</span>
}

/** Stock state with icon + text (never colour alone). */
export function StockBadge({ available, lowThreshold = 5, className }: { available: number; lowThreshold?: number; className?: string }) {
  const status = stockStatus(available, lowThreshold)
  const Icon = status === 'in_stock' ? CircleCheck : status === 'low_stock' ? CircleAlert : CircleX
  const color = status === 'in_stock' ? 'text-green-300' : status === 'low_stock' ? 'text-amber-300' : 'text-red-300'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', color, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status === 'low_stock' ? `Only ${available} left` : stockLabels[status]}
    </span>
  )
}
