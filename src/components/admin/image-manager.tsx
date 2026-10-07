'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react'
import { deleteProductImageAction, updateProductImagesAction } from '@/actions/admin/products'
import { ProductImage } from '@/components/product/product-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { PRODUCT_IMAGE_ACCEPT, productImageProblem, uploadProductImage } from '@/lib/admin/product-image-upload'
import { cn } from '@/lib/utils'
import { Panel } from './admin-ui'

type Img = { id: string; url: string; alt: string; isPrimary: boolean }

/**
 * A product's photos: upload, order, main photo, alt text. Uploads go straight from the
 * browser to storage (lib/admin/product-image-upload). Delivery is optimised to AVIF/WebP
 * by next/image.
 */
export function ImageManager({ productId, productName, initial }: { productId: string; productName: string; initial: Img[] }) {
  const [images, setImages] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()
  const [dirty, setDirty] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  // After an upload the page re-fetches and passes a longer list; show it (state
  // adjusted during render, per React docs). Unsaved order/alt edits are kept.
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    const known = new Set(images.map((x) => x.id))
    const added = initial.filter((x) => !known.has(x.id))
    if (added.length) setImages([...images, ...added])
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    let uploaded = 0
    for (const file of Array.from(files)) {
      const problem = productImageProblem(file) ?? (await uploadProductImage(productId, file, productName))
      if (problem) toast(problem, 'error')
      else uploaded++
    }
    setUploading(false)
    if (input.current) input.current.value = ''
    if (!uploaded) return
    router.refresh()
    toast(uploaded === 1 ? 'Image uploaded' : `${uploaded} images uploaded`)
  }

  const move = (i: number, d: number) => {
    const next = [...images]
    const [item] = next.splice(i, 1)
    next.splice(i + d, 0, item)
    setImages(next)
    setDirty(true)
  }

  return (
    <Panel
      title={`Photos (${images.length})`}
      actions={
        <>
          <input ref={input} type="file" accept={PRODUCT_IMAGE_ACCEPT} multiple className="sr-only" id="image-upload" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" variant="glass" loading={uploading} onClick={() => input.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Upload
          </Button>
        </>
      }
    >
      {images.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className={cn('rounded-lg border p-2', img.isPrimary ? 'border-primary' : 'border-border')}>
              <div className="product-stage relative aspect-square overflow-hidden rounded-md">
                <ProductImage src={img.url} alt={img.alt} fill sizes="200px" className="object-contain p-2" />
                {img.isPrimary ? <span className="absolute left-1.5 top-1.5 rounded bg-primary-strong px-1.5 text-[10px] font-bold text-white">MAIN</span> : null}
              </div>
              <Input
                aria-label="Alt text"
                value={img.alt}
                placeholder="Alt text"
                onChange={(e) => {
                  setImages(images.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))
                  setDirty(true)
                }}
                className="mt-2 h-8 text-xs"
              />
              <div className="mt-1 flex justify-between">
                <div className="flex">
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move later"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setImages(images.map((x) => ({ ...x, isPrimary: x.id === img.id }))); setDirty(true) }} aria-label="Make main image"><Star className={cn('h-3.5 w-3.5', img.isPrimary && 'fill-current text-warning')} /></Button>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" aria-label="Delete image" onClick={() => start(async () => {
                  if (!confirm('Delete this image?')) return
                  const r = await deleteProductImageAction(img.id)
                  toast(r.ok ? 'Image removed' : r.message, r.ok ? 'success' : 'error')
                  if (r.ok) setImages(images.filter((x) => x.id !== img.id))
                  router.refresh()
                })}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">No photos yet. Upload clear product photos on a plain background (square works best).</p>
      )}
      {dirty ? (
        <Button className="mt-3" size="sm" loading={pending} onClick={() => start(async () => {
          const r = await updateProductImagesAction(productId, images.map((x) => ({ id: x.id, alt: x.alt, isPrimary: x.isPrimary })))
          toast(r.ok ? 'Image order saved' : r.message, r.ok ? 'success' : 'error')
          setDirty(false)
          router.refresh()
        })}>
          Save image order & alt text
        </Button>
      ) : null}
    </Panel>
  )
}
