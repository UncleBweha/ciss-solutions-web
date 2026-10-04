'use client'
import Link from 'next/link'
import { ArrowRight, Heart, ShoppingCart } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { buttonClass } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { ProductCardData } from '@/types/catalog'
import { cn } from '@/lib/utils'

export function AddToCartButton({ product }: { product: ProductCardData }) {
  const { add } = useCart()
  const toast = useToast()
  const soldOut = product.available_quantity <= 0

  // Products with options are added from the product page, where the option is chosen.
  if (product.has_variants || soldOut) {
    return (
      <Link href={`/p/${product.slug}`} className={buttonClass('glass', 'sm', 'relative z-10 w-full')}>
        {soldOut ? 'View details' : 'Choose options'}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={buttonClass('primary', 'sm', 'relative z-10 w-full')}
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
      Add to Cart
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
        'relative z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/60 backdrop-blur transition-colors hover:border-border-strong',
        saved ? 'text-ink-magenta' : 'text-fg-secondary hover:text-fg',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', saved && 'fill-current')} aria-hidden="true" />
    </button>
  )
}
