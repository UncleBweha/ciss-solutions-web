'use client'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react'
import { LinkButton } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useCart } from './cart-provider'
import { CartItem } from './cart-item'
import { OrderSummary } from './order-summary'
import { useQuote } from './use-quote'

export function CartView() {
  const { items, ready, setQuantity, remove } = useCart()
  const { quote, loading } = useQuote()

  if (!ready) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" />}
        title="Your cart is empty."
        description="Find printers, spare parts and accessories for your next printing project."
        action={
          <>
            <LinkButton href="/shop">Start Shopping</LinkButton>
            <LinkButton href="/parts-finder" variant="glass">
              Find a spare part
            </LinkButton>
          </>
        }
      />
    )
  }

  const unavailable = quote?.issues.filter((i) => i.kind !== 'insufficient_stock') ?? []
  const canCheckout = Boolean(quote && quote.lines.length && !unavailable.length)

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Cart items" className="glass-flat rounded-[var(--radius-card)] px-5 sm:px-6">
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const line = quote?.lines.find((l) => l.productId === item.productId && l.variantId === item.variantId)
            const issue = quote?.issues.find((i) => i.productId === item.productId && i.variantId === item.variantId)
            const snap = item.snapshot
            return (
              <CartItem
                key={`${item.productId}:${item.variantId}`}
                name={line?.name ?? snap?.name ?? 'Product'}
                slug={line?.slug ?? snap?.slug ?? ''}
                variantName={line?.variantName ?? snap?.variantName ?? null}
                imageUrl={line?.imageUrl ?? snap?.imageUrl ?? null}
                unitPrice={line?.unitPrice ?? snap?.price ?? 0}
                quantity={item.quantity}
                max={line ? Math.min(line.available, 20) : 20}
                issue={issue?.message}
                onQuantity={(q) => setQuantity(item.productId, item.variantId, q)}
                onRemove={() => remove(item.productId, item.variantId)}
              />
            )
          })}
        </ul>
      </section>

      <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
        <OrderSummary
          subtotal={quote?.subtotal ?? 0}
          discount={0}
          deliveryFee={null}
          total={quote?.subtotal ?? 0}
          loading={loading || !quote}
        >
          {unavailable.length ? (
            <p role="alert" className="text-sm text-amber-300">
              Remove unavailable items to continue.
            </p>
          ) : null}
          <Link
            href="/checkout"
            aria-disabled={!canCheckout}
            onClick={(e) => !canCheckout && e.preventDefault()}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary-strong font-semibold text-white hover:bg-primary-hover ${canCheckout ? '' : 'pointer-events-none opacity-50'}`}
          >
            Proceed to Checkout <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="flex items-center justify-center gap-2 text-xs text-fg-muted">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Delivery and coupons are calculated at checkout
          </p>
        </OrderSummary>
        <Link href="/shop" className="block text-center text-sm font-semibold text-primary-light hover:text-fg">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
