import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ProductImage } from '@/components/product/product-image'
import { cn } from '@/lib/utils'

export function CategoryCard({
  name,
  href,
  imageUrl,
  count,
  className,
}: {
  name: string
  href: string
  imageUrl: string | null
  count: number
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'glass-flat group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/50',
        className,
      )}
    >
      <div className="product-stage relative aspect-[4/3]">
        <ProductImage src={imageUrl} alt="" fill sizes="(min-width: 1024px) 16vw, 45vw" className="object-contain p-6 transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="flex items-center justify-between gap-2 p-4">
        <div>
          <h3 className="font-bold">{name}</h3>
          <p className="text-xs text-fg-muted">
            {count} {count === 1 ? 'product' : 'products'}
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-fg-secondary transition-colors group-hover:bg-primary-strong group-hover:text-white">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

export function BrandCard({ name, slug, logoUrl, description }: { name: string; slug: string; logoUrl?: string | null; description?: string | null }) {
  return (
    <Link
      href={`/b/${slug}`}
      className="glass-flat group flex h-full flex-col justify-between gap-3 rounded-[var(--radius-card)] p-5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/50"
    >
      <div className="flex h-12 items-center">
        {logoUrl ? (
          <ProductImage src={logoUrl} alt={`${name} logo`} width={120} height={48} className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-display text-2xl font-extrabold tracking-tight text-fg">{name}</span>
        )}
      </div>
      {description ? <p className="line-clamp-2 text-sm text-fg-secondary">{description}</p> : null}
      <span className="flex items-center gap-1 text-sm font-semibold text-primary-light">
        Shop {name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  )
}
