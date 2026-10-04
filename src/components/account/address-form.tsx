'use client'
import { useActionState } from 'react'
import { addAddressAction } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, FormMessage, Input, Select } from '@/components/ui/form'
import { KENYA_COUNTIES } from '@/lib/ecommerce/kenya'

export function AddressForm() {
  const [state, action, pending] = useActionState(addAddressAction, {})
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Label" htmlFor="label" hint="e.g. Office, Home">
        <Input id="label" name="label" />
      </Field>
      <Field label="Contact name" htmlFor="fullName" error={state.errors?.fullName} required>
        <Input id="fullName" name="fullName" required />
      </Field>
      <Field label="Phone" htmlFor="phone" error={state.errors?.phone} required>
        <Input id="phone" name="phone" type="tel" required />
      </Field>
      <Field label="County" htmlFor="county" error={state.errors?.county} required>
        <Select id="county" name="county" required defaultValue="">
          <option value="">Select county</option>
          {KENYA_COUNTIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Town / City" htmlFor="town" error={state.errors?.town} required>
        <Input id="town" name="town" required />
      </Field>
      <Field label="Address" htmlFor="addressLine" error={state.errors?.addressLine} required>
        <Input id="addressLine" name="addressLine" required />
      </Field>
      <Field label="Instructions" htmlFor="instructions" className="sm:col-span-2">
        <Input id="instructions" name="instructions" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-fg-secondary sm:col-span-2">
        <Checkbox name="isDefault" /> Make this my default address
      </label>
      <div className="sm:col-span-2">
        <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage>
      </div>
      <Button type="submit" loading={pending} className="w-fit">
        Save address
      </Button>
    </form>
  )
}
