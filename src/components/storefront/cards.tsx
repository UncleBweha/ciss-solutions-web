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
        'glass-flat group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] transition-colors duration-200 hover:border-border-strong',
        className,
      )}
    >
      <div className="product-stage relative aspect-[4/3]">
        <ProductImage src={imageUrl} alt="" fill sizes="(min-width: 1024px) 16vw, 45vw" className="object-contain p-6 transition-transform duration-300 group-hover:scale-[1.04]" />
      </div>
      <div className="flex items-baseline justify-between gap-2 px-4 py-3">
        <h3 className="font-semibold group-hover:underline">{name}</h3>
        <p className="label-mono text-[11px] text-fg-muted">{count}</p>
      </div>
    </Link>
  )
}

export function BrandCard({ name, slug, logoUrl, description }: { name: string; slug: string; logoUrl?: string | null; description?: string | null }) {
  return (
    <Link
      href={`/b/${slug}`}
      className="glass-flat group flex h-full flex-col justify-between gap-3 rounded-[var(--radius-card)] p-5 transition-colors duration-200 hover:border-border-strong"
    >
      <div className="flex h-12 items-center">
        {logoUrl ? (
          <ProductImage src={logoUrl} alt={`${name} logo`} width={120} height={48} className="h-10 w-auto object-contain" />
        ) : (
          <span className="text-xl font-semibold tracking-tight text-fg">{name}</span>
        )}
      </div>
      {description ? <p className="line-clamp-2 text-sm text-fg-secondary">{description}</p> : null}
      <span className="flex items-center gap-1 text-sm font-semibold text-primary-light">
        Shop {name} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  )
}
