import Image, { type ImageProps } from 'next/image'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Product imagery via next/image (AVIF/WebP, responsive, lazy). Vector placeholders
 * are served as-is; uploaded photos from Supabase Storage are optimised.
 */
export function ProductImage({ src, alt, className, ...props }: Omit<ImageProps, 'src'> & { src: string | null | undefined }) {
  if (!src) {
    return (
      <div className={cn('grid h-full w-full place-items-center text-fg-muted', className)} role="img" aria-label={alt || 'No image available'}>
        <Printer className="h-1/3 w-1/3 opacity-40" aria-hidden="true" />
      </div>
    )
  }
  return <Image src={src} alt={alt} className={className} unoptimized={src.endsWith('.svg')} {...props} />
}
