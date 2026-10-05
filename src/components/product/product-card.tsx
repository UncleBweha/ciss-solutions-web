import Link from 'next/link'
import { DiscountBadge, PriceDisplay, StockBadge } from '@/components/ui/commerce'
import { RatingStars } from '@/components/ui/misc'
import type { ProductCardData } from '@/types/catalog'
import { cn } from '@/lib/utils'
import { AddToCartButton, WishlistButton } from './product-card-actions'
import { ProductImage } from './product-image'

export function ProductCard({ product, priority, className }: { product: ProductCardData; priority?: boolean; className?: string }) {
  const href = `/p/${product.slug}`
  const soldOut = product.available_quantity <= 0
  return (
    <article className={cn('glass-card group relative flex flex-col rounded-[var(--radius-card)]', className)}>
      <div className="relative m-1.5 aspect-[4/3.4] rounded-[calc(var(--radius-card)-4px)] bg-white/80">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
          <ProductImage
            src={product.image_url}
            alt={product.image_alt ?? product.name}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 18vw, (min-width: 768px) 28vw, 48vw"
            className={cn('object-contain p-4 sm:p-6', soldOut && 'opacity-50')}
          />
        </Link>
        <DiscountBadge price={product.price} compareAt={product.compare_at_price} className="pointer-events-none absolute left-2.5 top-2.5" />
        {product.is_new && !product.compare_at_price ? (
          <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-sm bg-ink-key px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">NEW</span>
        ) : null}
        <WishlistButton productId={product.id} name={product.name} className="absolute right-1.5 top-1.5" />
      </div>
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-1">
        {product.brand_name ? <p className="text-xs text-fg-muted">{product.brand_name}</p> : null}
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug text-fg">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] hover:text-primary-light focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.rating_count > 0 ? <RatingStars rating={product.rating_avg} count={product.rating_count} compact className="mt-1" /> : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <PriceDisplay price={product.price} compareAt={product.compare_at_price} size="sm" from={product.has_variants} className="gap-x-1.5" />
            <StockBadge available={product.available_quantity} lowThreshold={product.low_stock_threshold} className="mt-0.5 font-medium" />
          </div>
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  )
}

const gridColumns = {
  wide: 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  sidebar: 'md:grid-cols-3 xl:grid-cols-4',
}

export function ProductGrid({
  products,
  priorityCount = 0,
  layout = 'wide',
  className,
}: {
  products: ProductCardData[]
  priorityCount?: number
  layout?: keyof typeof gridColumns
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-2.5 sm:gap-3', gridColumns[layout], className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass-card overflow-hidden rounded-[var(--radius-card)]">
          <div className="skeleton aspect-[4/3.4]" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton mt-4 h-10 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** One horizontally scrolling row of cards (homepage shelves). */
export function ProductRail({ products, label }: { products: ProductCardData[]; label: string }) {
  return (
    <ul aria-label={label} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-3 sm:px-0">
      {products.map((p) => (
        <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19.2%]">
          <ProductCard product={p} className="h-full" />
        </li>
      ))}
    </ul>
  )
}
