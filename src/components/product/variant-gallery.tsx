'use client'
import { useEffect, useState } from 'react'
import { ProductGallery } from './product-gallery'

/** Gallery that follows the variant chosen in ProductPurchase. */
export function VariantAwareGallery(props: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const onChange = (e: Event) => setActive((e as CustomEvent<string | null>).detail)
    window.addEventListener('ciss:variant-image', onChange)
    return () => window.removeEventListener('ciss:variant-image', onChange)
  }, [])
  const images = active && !props.images.some((i) => i.url === active) ? [{ url: active, alt: props.name }, ...props.images] : props.images
  return <ProductGallery key={active ?? 'default'} images={images} name={props.name} activeUrl={active} />
}
