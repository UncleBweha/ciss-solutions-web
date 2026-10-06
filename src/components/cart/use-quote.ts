'use client'
import { useEffect, useRef, useState } from 'react'
import { quoteCartAction } from '@/actions/cart'
import type { Quote } from '@/lib/ecommerce/quote'
import { useCart } from './cart-provider'

/** Server quote for the current cart (debounced). Keeps the cart in sync with stock. */
export function useQuote(options: { couponCode?: string | null } = {}) {
  const { items, ready, replace } = useCart()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const key = JSON.stringify([items.map((i) => [i.productId, i.variantId, i.quantity]), options.couponCode])

  useEffect(() => {
    if (!ready || !items.length) return
    const id = ++seq.current
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const q = await quoteCartAction(
          items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
          { couponCode: options.couponCode || null },
        )
        if (id !== seq.current) return
        setQuote(q)
        // Apply stock corrections and refresh display snapshots from the server.
        const corrected = items
          .map((item) => {
            const line = q.lines.find((l) => l.productId === item.productId && l.variantId === item.variantId)
            if (!line) return item
            return {
              ...item,
              quantity: line.quantity,
              snapshot: { name: line.name, slug: line.slug, price: line.unitPrice, imageUrl: line.imageUrl, variantName: line.variantName, sku: line.sku },
            }
          })
        // Also when a line had no snapshot yet (it came from the account), so the next visit renders at once.
        if (corrected.some((c, i) => c.quantity !== items[i].quantity || (c.snapshot && !items[i].snapshot))) replace(corrected)
      } finally {
        if (id === seq.current) setLoading(false)
      }
      // The first quote goes out at once; later ones wait for quantity taps to settle.
    }, quote ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  // An empty cart has no quote (derived, not stored).
  return { quote: items.length ? quote : null, loading: items.length ? loading : false }
}
