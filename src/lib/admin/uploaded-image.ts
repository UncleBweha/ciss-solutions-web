import 'server-only'
import { supabaseUrl } from '@/lib/env'

/**
 * Public URL of an image the browser uploaded with DirectImageUpload, or null when none was.
 * Only a URL inside the expected bucket and folder of our own Supabase project is accepted.
 */
export function uploadedImageUrl(formData: FormData, field: string, bucket: string, prefix: string): string | null {
  const value = formData.get(field)
  if (typeof value !== 'string' || !value) return null
  const base = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${prefix}/`
  const rest = value.startsWith(base) ? value.slice(base.length) : ''
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(rest)) throw new Error('The uploaded image was not recognised. Choose the file again.')
  return value
}
