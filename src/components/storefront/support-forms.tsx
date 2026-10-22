'use client'
import { useActionState, useEffect, useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { startAttachmentUploadAction, submitContactAction, submitPartRequestAction } from '@/actions/support'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input, Textarea } from '@/components/ui/form'
import { createClient } from '@/lib/supabase/client'

/**
 * Uploads the chosen file straight to storage through a signed URL and submits only its
 * path, as "attachment": the file never passes through a server action (4.5 MB cap on Vercel).
 * The form waits while it uploads; a failed upload asks for another file or none.
 */
function AttachmentInput(props: Omit<ComponentProps<'input'>, 'name' | 'type' | 'onChange'>) {
  const [path, setPath] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const latest = useRef(0)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    const clear = () => {
      latest.current++
      ref.current?.setCustomValidity('')
      setPath('')
      setStatus(null)
    }
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [])

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const attempt = ++latest.current
    setPath('')
    if (!file) {
      input.setCustomValidity('')
      setStatus(null)
      return
    }
    const fail = (message: string) => {
      if (attempt !== latest.current) return
      input.setCustomValidity(message)
      setStatus(message)
    }
    input.setCustomValidity('Wait for the file to finish uploading.')
    setStatus('Uploading…')
    const signed = await startAttachmentUploadAction(file.type, file.size).catch(() => ({ error: 'We could not upload the file. Choose another, or remove it.' }))
    if ('error' in signed) return fail(signed.error)
    const { error } = await createClient().storage.from('support-attachments').uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
    if (error) return fail('We could not upload the file. Choose another, or remove it.')
    if (attempt !== latest.current) return
    input.setCustomValidity('')
    setPath(signed.path)
    setStatus('Attached.')
  }

  return (
    <>
      <Input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={onChange}
        className="h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-fg"
        {...props}
      />
      <input type="hidden" name="attachment" value={path} />
      {status ? <p className="mt-1 text-xs text-fg-muted" aria-live="polite">{status}</p> : null}
    </>
  )
}

// Hidden from people; bots tend to fill it in.
const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
    <label>
      Website <input name="website" tabIndex={-1} autoComplete="off" />
    </label>
  </div>
)

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactAction, {})
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>
  return (
    <form action={action} className="relative grid gap-4 sm:grid-cols-2">
      <Honeypot />
      <Field label="Name" htmlFor="c-name" error={state.errors?.name} required>
        <Input id="c-name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="c-email" error={state.errors?.email} required>
        <Input id="c-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Phone" htmlFor="c-phone" error={state.errors?.phone}>
        <Input id="c-phone" name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Subject" htmlFor="c-subject" error={state.errors?.subject} required>
        <Input id="c-subject" name="subject" required />
      </Field>
      <Field label="Message" htmlFor="c-message" error={state.errors?.message} required className="sm:col-span-2">
        <Textarea id="c-message" name="message" rows={5} required />
      </Field>
      <div className="sm:col-span-2">
        <FormMessage>{state.message}</FormMessage>
      </div>
      <Button type="submit" size="lg" loading={pending} className="w-fit">
        Send Message
      </Button>
    </form>
  )
}

export function PartRequestForm({ brand, model }: { brand?: string; model?: string }) {
  const [state, action, pending] = useActionState(submitPartRequestAction, {})
  if (state.ok) return <FormMessage tone="success">{state.message}</FormMessage>
  return (
    <form action={action} className="relative grid gap-4 sm:grid-cols-2">
      <Honeypot />
      <Field label="Printer brand" htmlFor="p-brand" error={state.errors?.printerBrand} required>
        <Input id="p-brand" name="printerBrand" defaultValue={brand} placeholder="e.g. HP" required />
      </Field>
      <Field label="Printer model" htmlFor="p-model" error={state.errors?.printerModel} required>
        <Input id="p-model" name="printerModel" defaultValue={model} placeholder="e.g. LaserJet M404dn" required />
      </Field>
      <Field label="Problem / error / part needed" htmlFor="p-message" error={state.errors?.message} required className="sm:col-span-2">
        <Textarea id="p-message" name="message" rows={4} placeholder="e.g. Printer is showing paper jam even with no paper inside" required />
      </Field>
      <Field label="Photo (optional)" htmlFor="p-file" error={state.errors?.attachment} hint="A photo of the part, label or error screen helps. JPG, PNG, WebP or PDF up to 5 MB." className="sm:col-span-2">
        <AttachmentInput id="p-file" />
      </Field>
      <Field label="Your name" htmlFor="p-name" error={state.errors?.name} required>
        <Input id="p-name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Phone" htmlFor="p-phone" error={state.errors?.phone} required>
        <Input id="p-phone" name="phone" type="tel" autoComplete="tel" required />
      </Field>
      <Field label="Email (optional)" htmlFor="p-email" error={state.errors?.email} className="sm:col-span-2">
        <Input id="p-email" name="email" type="email" autoComplete="email" />
      </Field>
      <div className="sm:col-span-2">
        <FormMessage>{state.message}</FormMessage>
      </div>
      <Button type="submit" size="lg" loading={pending} className="w-fit">
        Submit Request
      </Button>
    </form>
  )
}
