import Link from 'next/link'
import { DiscountBadge, PriceDisplay, StockBadge } from '@/components/ui/commerce'
import { RatingStars } from '@/components/ui/misc'
import type { ProductCardData } from '@/types/catalog'
import { cn } from '@/lib/utils'
import { AddToCartButton, WishlistButton } from './product-card-actions'
import { ProductImage } from './product-image'

function badgeFor(p: ProductCardData): { label: string; tone: string } | null {
  if (p.available_quantity > 0 && p.available_quantity <= p.low_stock_threshold) return { label: 'Limited stock', tone: 'bg-warning text-background' }
  if (p.is_bestseller) return { label: 'Best Seller', tone: 'bg-primary text-white' }
  if (p.is_new) return { label: 'New', tone: 'bg-accent text-white' }
  if (p.discount_percent > 0 || p.is_on_sale) return { label: 'On Sale', tone: 'bg-danger text-white' }
  if (p.is_featured) return { label: 'Popular', tone: 'bg-white text-background' }
  return null
}

export function ProductCard({ product, priority, className }: { product: ProductCardData; priority?: boolean; className?: string }) {
  const badge = badgeFor(product)
  const href = `/p/${product.slug}`
  return (
    <article className={cn('glass-flat group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[var(--shadow-lift)]', className)}>
      <div className="product-stage relative aspect-square">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0">
          <ProductImage
            src={product.image_url}
            alt={product.image_alt ?? product.name}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
            className="object-contain p-5 transition-transform duration-500 group-hover:scale-105 sm:p-7"
          />
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {badge ? <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', badge.tone)}>{badge.label}</span> : null}
          <DiscountBadge price={product.price} compareAt={product.compare_at_price} />
        </div>
        <WishlistButton productId={product.id} name={product.name} className="absolute right-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        {product.brand_name ? <p className="text-xs font-semibold uppercase tracking-wider text-primary-light">{product.brand_name}</p> : null}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug sm:text-[15px]">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        {product.short_description ? <p className="line-clamp-1 text-xs text-fg-muted">{product.short_description}</p> : null}
        {product.rating_count > 0 ? <RatingStars rating={product.rating_avg} count={product.rating_count} /> : null}
        <div className="mt-auto space-y-2 pt-1">
          <PriceDisplay price={product.price} compareAt={product.compare_at_price} size="sm" from={product.has_variants} />
          <StockBadge available={product.available_quantity} lowThreshold={product.low_stock_threshold} />
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products, priorityCount = 0, className }: { products: ProductCardData[]; priorityCount?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass-flat overflow-hidden rounded-[var(--radius-card)]">
          <div className="skeleton aspect-square" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton mt-4 h-10 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
