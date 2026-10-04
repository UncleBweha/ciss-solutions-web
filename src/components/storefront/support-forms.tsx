'use client'
import { useActionState } from 'react'
import { submitContactAction, submitPartRequestAction } from '@/actions/support'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input, Textarea } from '@/components/ui/form'

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
        <Input id="p-file" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="h-auto py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-fg" />
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
