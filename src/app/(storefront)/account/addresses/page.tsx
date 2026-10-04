import type { Metadata } from 'next'
import { AddressForm } from '@/components/account/address-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteAddressAction, setDefaultAddressAction } from '@/actions/account'
import { requireUser } from '@/lib/auth'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Saved addresses', robots: { index: false } }

export default async function AddressesPage() {
  const user = await requireUser('/account/addresses')
  const supabase = await createClient()
  const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false })
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Saved addresses</h1>
      {data?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="glass-flat rounded-[var(--radius-card)] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{a.label || `${a.town}, ${a.county}`}</p>
                {a.is_default ? <Badge tone="info">Default</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-fg-secondary">
                {a.full_name} · {formatKenyanPhone(a.phone)}
                <br />
                {a.address_line}, {a.town}, {a.county}
              </p>
              <div className="mt-3 flex gap-2">
                {!a.is_default ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Make default
                    </Button>
                  </form>
                ) : null}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <Button type="submit" size="sm" variant="ghost" className="text-red-300">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-secondary">You have no saved addresses yet.</p>
      )}
      <section className="glass-flat rounded-[var(--radius-card)] p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Add an address</h2>
        <AddressForm />
      </section>
    </div>
  )
}
