import Image, { type ImageProps } from 'next/image'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Product imagery via next/image (AVIF/WebP, responsive, lazy). Vector placeholders
 * are served as-is; uploaded photos from Supabase Storage are optimised.
 * `priority` marks the likely LCP image: Next 16 deprecated the prop of that name,
 * so it maps to loading="eager" + fetchPriority="high" as the docs recommend.
 */
export function ProductImage({
  src,
  alt,
  className,
  priority,
  ...props
}: Omit<ImageProps, 'src' | 'priority'> & { src: string | null | undefined; priority?: boolean }) {
  if (!src) {
    // alt="" marks a picture as decoration (a thumbnail beside the product's name): its
    // placeholder is decoration too, and must not be read out as "No image available".
    const label = alt === '' ? ({ 'aria-hidden': true } as const) : ({ role: 'img', 'aria-label': alt || 'No image available' } as const)
    return (
      <div className={cn('grid h-full w-full place-items-center text-fg-muted', className)} {...label}>
        <Printer className="h-1/3 w-1/3 opacity-40" aria-hidden="true" />
      </div>
    )
  }
  const eager = priority ? ({ loading: 'eager', fetchPriority: 'high' } as const) : {}
  return <Image src={src} alt={alt} className={className} unoptimized={src.endsWith('.svg')} {...eager} {...props} />
}
