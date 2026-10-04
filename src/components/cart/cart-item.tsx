'use client'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { ProductImage } from '@/components/product/product-image'
import { QuantitySelector } from '@/components/ui/quantity-selector'
import { formatKES } from '@/lib/ecommerce/money'

export function CartItem({
  name,
  slug,
  variantName,
  imageUrl,
  unitPrice,
  quantity,
  max,
  issue,
  onQuantity,
  onRemove,
}: {
  name: string
  slug: string
  variantName: string | null
  imageUrl: string | null
  unitPrice: number
  quantity: number
  max: number
  issue?: string
  onQuantity: (q: number) => void
  onRemove: () => void
}) {
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/p/${slug}`} className="product-stage relative h-24 w-24 shrink-0 overflow-hidden rounded-md sm:h-28 sm:w-28">
        <ProductImage src={imageUrl} alt={name} fill sizes="112px" className="object-contain p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/p/${slug}`} className="line-clamp-2 font-semibold hover:text-primary-light">
            {name}
          </Link>
          {variantName ? <p className="text-sm text-fg-muted">{variantName}</p> : null}
          <p className="mt-1 text-sm text-fg-secondary">{formatKES(unitPrice)} each</p>
          {issue ? (
            <p role="alert" className="mt-1 text-xs font-semibold text-amber-300">
              {issue}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          <p className="font-bold">{formatKES(unitPrice * quantity)}</p>
          <div className="flex items-center gap-2">
            <QuantitySelector size="sm" value={quantity} max={Math.max(1, max)} onChange={onQuantity} label={`Quantity of ${name}`} />
            <button type="button" onClick={onRemove} className="rounded-lg p-2 text-fg-muted hover:bg-surface hover:text-danger" aria-label={`Remove ${name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
