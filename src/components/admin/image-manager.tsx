'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react'
import { addProductImageAction, deleteProductImageAction, updateProductImagesAction } from '@/actions/admin/products'
import { ProductImage } from '@/components/product/product-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Panel } from './admin-ui'

type Img = { id: string; url: string; alt: string; isPrimary: boolean }
const MAX = 5 * 1024 * 1024

/**
 * Uploads go straight from the browser to the product-images bucket using the
 * staff member's session (storage RLS checks products.manage). Delivery is
 * optimised to AVIF/WebP by next/image.
 */
export function ImageManager({ productId, productName, initial }: { productId: string; productName: string; initial: Img[] }) {
  const [images, setImages] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()
  const [dirty, setDirty] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const router = useRouter()

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
        toast(`${file.name}: use JPG, PNG, WebP or AVIF`, 'error')
        continue
      }
      if (file.size > MAX) {
        toast(`${file.name} is larger than 5 MB`, 'error')
        continue
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${productId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
      if (error) {
        toast(`Upload failed: ${error.message}`, 'error')
        continue
      }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      const result = await addProductImageAction(productId, { url: data.publicUrl, storagePath: path, alt: productName })
      if (!result.ok) toast(result.message, 'error')
    }
    setUploading(false)
    if (input.current) input.current.value = ''
    router.refresh()
    toast('Images uploaded')
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
      title={`Images (${images.length})`}
      actions={
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" id="image-upload" onChange={(e) => upload(e.target.files)} />
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
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setImages(images.map((x) => ({ ...x, isPrimary: x.id === img.id }))); setDirty(true) }} aria-label="Make main image"><Star className={cn('h-3.5 w-3.5', img.isPrimary && 'fill-current text-amber-300')} /></Button>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-300" aria-label="Delete image" onClick={() => start(async () => {
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
        <p className="text-sm text-fg-muted">No images yet. Upload clear product photos on a plain background (square works best).</p>
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
