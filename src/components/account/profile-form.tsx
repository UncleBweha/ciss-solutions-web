'use client'
import { useActionState, useEffect } from 'react'
import { updateProfileAction } from '@/actions/account'
import { useCart } from '@/components/cart/cart-provider'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/form'

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, {})
  // The header and bottom bar show the name too.
  const { refreshAccount } = useCart()
  useEffect(() => {
    if (state.ok) refreshAccount()
  }, [state, refreshAccount])
  return (
    <form action={action} className="space-y-4">
      <Field label="Full name" htmlFor="fullName" error={state.errors?.fullName} required>
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </Field>
      <Field label="Phone" htmlFor="phone" error={state.errors?.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} />
      </Field>
      <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage>
      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  )
}
