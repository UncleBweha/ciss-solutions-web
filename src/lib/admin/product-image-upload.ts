import { addProductImageAction } from '@/actions/admin/products'
import { createClient } from '@/lib/supabase/client'

export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
export const PRODUCT_IMAGE_ACCEPT = PRODUCT_IMAGE_TYPES.join(',')
const MAX = 5 * 1024 * 1024

/** Why a file can't be used as a product photo, or null if it can. */
export function productImageProblem(file: File): string | null {
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) return `${file.name}: use JPG, PNG, WebP or AVIF`
  if (file.size > MAX) return `${file.name} is larger than 5 MB`
  return null
}

/**
 * Uploads one photo straight from the browser to the product-images bucket using the
 * staff member's session (storage RLS checks products.manage) and attaches it to the
 * product. The product's first photo becomes its main one. Returns an error message, or null.
 */
export async function uploadProductImage(productId: string, file: File, alt: string): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) return `Upload failed: ${error.message}`
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  const result = await addProductImageAction(productId, { url: data.publicUrl, storagePath: path, alt })
  return result.ok ? null : result.message
}
