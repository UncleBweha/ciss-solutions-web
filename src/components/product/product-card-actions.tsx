'use client'
import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { useToast } from '@/components/ui/toast'
import type { ProductCardData } from '@/types/catalog'
import { cn } from '@/lib/utils'

export function AddToCartButton({ product }: { product: ProductCardData }) {
  const { add, ready } = useCart()
  const toast = useToast()
  const soldOut = product.available_quantity <= 0

  // Products with options are added from the product page, where the option is chosen.
  if (product.has_variants || soldOut) {
    return (
      <Link
        href={`/p/${product.slug}`}
        className="relative z-10 shrink-0 rounded-full border border-border-strong bg-white/70 px-3 py-1.5 text-xs font-semibold text-fg hover:border-primary hover:text-primary-light"
      >
        {soldOut ? 'Details' : 'Options'}
      </Link>
    )
  }

  return (
    <button
      type="button"
      // Disabled until hydrated so an early tap is never silently lost.
      disabled={!ready}
      aria-label={`Add ${product.name} to cart`}
      title="Add to cart"
      className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-strong text-white shadow-[0_6px_16px_rgba(11,111,216,0.35)] transition-colors hover:bg-primary-strong-hover disabled:opacity-60"
      onClick={() => {
        add({
          productId: product.id,
          variantId: null,
          quantity: 1,
          snapshot: { name: product.name, slug: product.slug, price: product.price, imageUrl: product.image_url, variantName: null, sku: product.sku },
        })
        toast(
          <span>
            Added <strong>{product.name}</strong> to your cart.{' '}
            <Link href="/cart" className="font-semibold text-primary-light underline">
              View cart
            </Link>
          </span>,
        )
      }}
    >
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

export function WishlistButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const { wishlist, toggleWishlist } = useCart()
  const toast = useToast()
  const saved = wishlist.has(productId)
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={async () => {
        const result = await toggleWishlist(productId, name)
        if (result === 'local' && !saved) {
          toast(
            <span>
              Saved on this device.{' '}
              <Link href="/login?next=/account/wishlist" className="font-semibold text-primary-light underline">
                Sign in
              </Link>{' '}
              to keep your wishlist.
            </span>,
            'info',
          )
        }
      }}
      className={cn(
        'z-10 grid h-9 w-9 place-items-center rounded-full border border-white bg-white/85 shadow-sm transition-colors',
        saved ? 'text-ink-magenta' : 'text-fg-muted hover:text-ink-magenta',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
