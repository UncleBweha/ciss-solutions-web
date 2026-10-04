import Link from 'next/link'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { formatKES } from '@/lib/ecommerce/money'
import { orderStatusLabels, orderStatusTone, type OrderStatus } from '@/lib/ecommerce/orders'
import { formatDate } from '@/lib/utils'
import { ReorderButton } from './reorder-button'

export type AccountOrder = {
  id: string
  order_number: string
  created_at: string
  total: number
  order_status: OrderStatus
  payment_status: string
  items: { product_id: string | null; variant_id: string | null; product_name: string; quantity: number }[]
}

export function OrderList({ orders }: { orders: AccountOrder[] }) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={<Package className="h-8 w-8" />}
        title="No orders yet"
        description="When you place an order it will appear here so you can track it."
        action={<LinkButton href="/shop">Start Shopping</LinkButton>}
      />
    )
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="glass-flat rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href={`/order/${encodeURIComponent(o.order_number)}`} className="font-mono font-bold hover:text-primary-light">
                #{o.order_number}
              </Link>
              <p className="text-sm text-fg-muted">
                {formatDate(o.created_at)} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={orderStatusTone(o.order_status)}>{orderStatusLabels[o.order_status]}</Badge>
              <span className="font-bold">{formatKES(o.total)}</span>
            </div>
          </div>
          <p className="mt-2 line-clamp-1 text-sm text-fg-secondary">{o.items.map((i) => i.product_name).join(', ')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton href={`/order/${encodeURIComponent(o.order_number)}`} size="sm" variant="glass">
              View & track
            </LinkButton>
            {o.payment_status === 'PAID' ? (
              <a href={`/api/orders/${encodeURIComponent(o.order_number)}/invoice`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-fg-secondary hover:bg-surface hover:text-fg">
                Invoice (PDF)
              </a>
            ) : null}
            <ReorderButton items={o.items} />
          </div>
        </li>
      ))}
    </ul>
  )
}
