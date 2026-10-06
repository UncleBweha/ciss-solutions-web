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
    // Phones: image + details on top, then quantity / remove / line total on a full-width
    // row (beside the image there is no room for them). From sm: one row, controls at the end.
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:py-5">
      <Link href={`/p/${slug}`} className="product-stage relative aspect-square w-full self-start overflow-hidden rounded-md">
        <ProductImage src={imageUrl} alt={name} fill sizes="112px" className="object-contain p-1.5 sm:p-2" />
      </Link>
      <div className="min-w-0">
        <Link href={`/p/${slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary-light sm:text-base">
          {name}
        </Link>
        {variantName ? <p className="text-sm text-fg-muted">{variantName}</p> : null}
        <p className="mt-1 text-sm text-fg-secondary">{formatKES(unitPrice)} each</p>
        {issue ? (
          <p role="alert" className="mt-1 text-xs font-semibold text-warning">
            {issue}
          </p>
        ) : null}
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col-reverse sm:items-end sm:justify-start">
        <div className="flex items-center gap-1">
          <QuantitySelector size="sm" value={quantity} max={Math.max(1, max)} onChange={onQuantity} label={`Quantity of ${name}`} />
          <button type="button" onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-full text-fg-muted hover:bg-surface hover:text-danger" aria-label={`Remove ${name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="whitespace-nowrap font-bold">{formatKES(unitPrice * quantity)}</p>
      </div>
    </li>
  )
}
