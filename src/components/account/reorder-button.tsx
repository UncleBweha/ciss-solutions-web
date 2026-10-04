'use client'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { Button } from '@/components/ui/button'

/** Adds a past order's items to the cart; the cart re-prices and checks stock. */
export function ReorderButton({ items }: { items: { product_id: string | null; variant_id: string | null; quantity: number }[] }) {
  const { add } = useCart()
  const router = useRouter()
  const reorderable = items.filter((i) => i.product_id)
  if (!reorderable.length) return null
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        for (const i of reorderable) add({ productId: i.product_id!, variantId: i.variant_id, quantity: i.quantity })
        router.push('/cart')
      }}
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reorder
    </Button>
  )
}
