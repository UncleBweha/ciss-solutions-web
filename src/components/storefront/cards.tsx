import Link from 'next/link'
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
      className={cn('glass-card group flex flex-col items-center rounded-[var(--radius-card)] px-2 pb-3 pt-2 text-center', className)}
    >
      <span className="relative block h-20 w-full sm:h-24">
        <ProductImage src={imageUrl} alt="" fill sizes="(min-width: 1024px) 12vw, 30vw" className="object-contain p-2" />
      </span>
      <span className="text-sm font-semibold leading-tight group-hover:text-primary-light">{name}</span>
      <span className="mt-0.5 text-xs text-fg-muted">
        {count} {count === 1 ? 'product' : 'products'}
      </span>
    </Link>
  )
}

export function BrandCard({ name, slug, logoUrl, description }: { name: string; slug: string; logoUrl?: string | null; description?: string | null }) {
  return (
    <Link
      href={`/b/${slug}`}
      className="glass-card group flex h-full flex-col justify-center gap-1.5 rounded-[var(--radius-card)] px-4 py-4"
    >
      <span className="flex h-9 items-center">
        {logoUrl ? (
          <ProductImage src={logoUrl} alt={`${name} logo`} width={120} height={36} className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-lg font-bold tracking-tight text-fg group-hover:text-primary-light">{name}</span>
        )}
      </span>
      {description ? <span className="line-clamp-2 text-sm text-fg-secondary">{description}</span> : null}
    </Link>
  )
}
