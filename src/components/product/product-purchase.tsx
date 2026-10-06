'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MessageCircle, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { Button, buttonClass } from '@/components/ui/button'
import { PriceDisplay, StockBadge } from '@/components/ui/commerce'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { useToast } from '@/components/ui/toast'
import { track } from '@/lib/analytics'
import { whatsappLink } from '@/lib/contact'
import { siteUrl } from '@/lib/env'
import { formatKES } from '@/lib/ecommerce/money'
import type { ProductVariant } from '@/types/catalog'
import { cn } from '@/lib/utils'
import { WishlistButton } from './product-card-actions'

type Props = {
  product: {
    id: string
    name: string
    slug: string
    sku: string
    price: number
    compareAt: number | null
    available: number
    lowThreshold: number
    imageUrl: string | null
    brand: string | null
  }
  variants: ProductVariant[]
  maxPerItem: number
  whatsappNumber?: string
}

export function ProductPurchase({ product, variants, maxPerItem, whatsappNumber }: Props) {
  const { add, ready } = useCart()
  const toast = useToast()
  const router = useRouter()
  const firstAvailable = variants.find((v) => v.available_quantity > 0) ?? variants[0]
  const [variantId, setVariantId] = useState<string | null>(firstAvailable?.id ?? null)
  const [requestedQuantity, setQuantity] = useState(1)
  const variant = variants.find((v) => v.id === variantId) ?? null

  const price = variant ? variant.price : product.price
  const compareAt = variant ? variant.compare_at_price : product.compareAt
  const available = variant ? variant.available_quantity : product.available
  const lowThreshold = variant ? variant.low_stock_threshold : product.lowThreshold
  const max = Math.max(1, Math.min(available, maxPerItem))
  const soldOut = available <= 0
  const canBuy = ready && !soldOut
  const quantity = Math.min(requestedQuantity, max)

  useEffect(() => {
    track('product_view', { value: product.price, items: [{ item_id: product.sku, item_name: product.name, item_brand: product.brand, price: product.price }] })
  }, [product])

  // Let the gallery follow the chosen variant.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ciss:variant-image', { detail: variant?.image_url ?? null }))
  }, [variant])

  const addToCart = () => {
    add({
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
      snapshot: {
        name: product.name,
        slug: product.slug,
        price,
        imageUrl: variant?.image_url ?? product.imageUrl,
        variantName: variant?.name ?? null,
        sku: variant?.sku ?? product.sku,
      },
    })
  }

  // Pre-filled chat so staff know exactly which item, option and quantity is wanted.
  const whatsappHref = whatsappLink(
    whatsappNumber,
    [
      'Hello CISS Solutions, I would like to order:',
      `${product.name}${variant ? ` (${variant.name})` : ''}`,
      `SKU: ${variant?.sku ?? product.sku}`,
      `Quantity: ${quantity}`,
      `Price: ${formatKES(price)} each`,
      `${siteUrl}/p/${product.slug}`,
    ].join('\n'),
  )

  // Group options by attribute name (e.g. Colour, Size).
  const optionKeys = [...new Set(variants.flatMap((v) => Object.keys(v.option_values)))]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PriceDisplay price={price} compareAt={compareAt} size="lg" showSavings />
        <StockBadge available={available} lowThreshold={lowThreshold} className="text-sm" />
      </div>

      {variants.length ? (
        <fieldset>
          <legend className="mb-2.5 text-sm font-semibold text-fg-secondary">
            {optionKeys.length === 1 ? optionKeys[0] : 'Option'}: <span className="text-fg">{variant?.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = v.available_quantity <= 0
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === variantId}
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    v.id === variantId ? 'border-primary bg-primary/15 text-fg' : 'border-border text-fg-secondary hover:border-border-strong hover:text-fg',
                    out && 'line-through opacity-60',
                  )}
                >
                  {v.name}
                  {v.price !== price && v.id !== variantId ? <span className="ml-1.5 font-normal text-fg-muted">{formatKES(v.price)}</span> : null}
                  {out ? <span className="sr-only"> (out of stock)</span> : null}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuantitySelector value={quantity} onChange={setQuantity} max={max} disabled={soldOut} />
        <WishlistButton productId={product.id} name={product.name} className="h-11 w-11" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          disabled={!canBuy}
          onClick={() => {
            addToCart()
            toast(
              <span>
                Added to cart.{' '}
                <Link href="/cart" className="font-semibold text-primary-light underline">
                  View cart
                </Link>
              </span>,
            )
          }}
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          {soldOut ? 'Out of stock' : 'Add to Cart'}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={!canBuy}
          onClick={() => {
            addToCart()
            router.push('/checkout')
          }}
        >
          <Zap className="h-5 w-5" aria-hidden="true" />
          Buy Now
        </Button>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_order', { items: [{ item_id: variant?.sku ?? product.sku, item_name: product.name, quantity }] })}
            className={buttonClass('success', 'lg', 'sm:col-span-2')}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Order via WhatsApp
          </a>
        ) : null}
      </div>

      <ul className="space-y-2.5 text-sm text-fg-secondary">
        <li className="flex items-center gap-2.5">
          <Truck className="h-4 w-4 text-primary-light" aria-hidden="true" />
          Collect in store or have it sent by courier.{' '}
          <Link href="/shipping-policy" className="underline hover:text-fg">
            Delivery info
          </Link>
        </li>
        <li className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary-light" aria-hidden="true" />
          Pay with M-Pesa, bank transfer or cash on delivery
        </li>
      </ul>

      {/* Sticky purchase bar on mobile, sitting on top of the bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-black/[0.07] bg-white/80 px-4 py-3 backdrop-blur-md backdrop-saturate-150 lg:hidden">
        <div>
          <p className="text-xs text-fg-muted">{variant ? variant.name : 'Price'}</p>
          <p className="text-lg font-bold">{formatKES(price)}</p>
        </div>
        <Button
          disabled={!canBuy}
          onClick={() => {
            addToCart()
            toast('Added to cart.')
          }}
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {soldOut ? 'Out of stock' : 'Add to Cart'}
        </Button>
      </div>
    </div>
  )
}
