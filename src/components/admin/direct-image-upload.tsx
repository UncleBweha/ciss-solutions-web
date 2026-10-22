'use client'
import { useEffect, useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { Input } from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'

export type DirectUploadBucket = 'brand-logos' | 'category-images' | 'banners'

/**
 * File picker that uploads the chosen image straight from the browser to a public bucket
 * with the staff session (storage RLS checks the permission, the bucket caps size and type)
 * and submits only its public URL, under `name`. Hosting caps a server action's request
 * body (4.5 MB on Vercel), so images never pass through the server.
 * The form cannot be submitted while an upload is running or after one failed.
 */
export function DirectImageUpload({
  bucket,
  prefix,
  name,
  className,
  ...props
}: { bucket: DirectUploadBucket; prefix: string; name: string } & Omit<ComponentProps<'input'>, 'name' | 'type' | 'onChange'>) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const latest = useRef(0)
  const ref = useRef<HTMLInputElement>(null)

  // Form reset (after a successful save, or React's reset after an action): forget the upload too.
  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    const clear = () => {
      latest.current++
      ref.current?.setCustomValidity('')
      setUrl('')
      setStatus(null)
    }
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [])

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const attempt = ++latest.current
    setUrl('')
    if (!file) {
      input.setCustomValidity('')
      setStatus(null)
      return
    }
    input.setCustomValidity('Wait for the image to finish uploading.')
    setStatus('Uploading…')
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (attempt !== latest.current) return // another file was picked meanwhile
    if (error) {
      input.setCustomValidity(`Upload failed: ${error.message}`)
      setStatus(`Upload failed: ${error.message}. Choose the file again or paste a URL.`)
      return
    }
    input.setCustomValidity('')
    setUrl(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl)
    setStatus('Uploaded. Save to use it.')
  }

  return (
    <>
      <Input ref={ref} type="file" onChange={onChange} className={className ?? 'h-auto py-2'} {...props} />
      <input type="hidden" name={name} value={url} />
      {status ? <p className="mt-1 text-xs text-fg-muted" aria-live="polite">{status}</p> : null}
    </>
  )
}
