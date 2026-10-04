'use client'
import { useActionState } from 'react'
import { trackOrderAction } from '@/actions/orders'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/form'

export function TrackOrderForm({ defaultOrder }: { defaultOrder: string }) {
  const [state, action, pending] = useActionState(trackOrderAction, {})
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Order number" htmlFor="orderNumber" required>
        <Input id="orderNumber" name="orderNumber" defaultValue={defaultOrder} placeholder="CISS-20261004-0012" required autoCapitalize="characters" />
      </Field>
      <Field label="Phone number" htmlFor="track-phone" required>
        <Input id="track-phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required />
      </Field>
      <FormMessage>{state.message}</FormMessage>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Track order
      </Button>
    </form>
  )
}
