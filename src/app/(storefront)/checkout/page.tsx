import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/checkout/checkout-form'
import { LinkButton } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { getSessionUser } from '@/lib/auth'
import { getDeliveryZones, getSettings } from '@/lib/catalog'
import { deliveryEstimate } from '@/lib/ecommerce/delivery'
import { formatKenyanPhone } from '@/lib/ecommerce/kenya'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } }

export default async function CheckoutPage() {
  const [settings, zones, user] = await Promise.all([getSettings(), getDeliveryZones(), getSessionUser()])

  if (user && user.role !== 'customer') {
    return (
      <div className="container-page py-8">
        <EmptyState
          title="Staff accounts cannot place orders."
          description="Sign out and use a customer account to buy from the store."
          action={<LinkButton href="/admin">Go to the admin dashboard</LinkButton>}
        />
      </div>
    )
  }

  let addresses: { id: string; full_name: string; phone: string; county: string; town: string; address_line: string; instructions: string | null }[] = []
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('addresses')
      .select('id, full_name, phone, county, town, address_line, instructions')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
    addresses = data ?? []
  }

  const pm = settings.payment_methods
  return (
    <div className="container-page py-8">
      <h1 className="mb-8 text-3xl font-bold sm:text-4xl">Checkout</h1>
      <CheckoutForm
        signedIn={Boolean(user)}
        defaults={{
          fullName: user?.fullName ?? '',
          email: user?.email ?? '',
          phone: user?.phone ? formatKenyanPhone(user.phone) : '',
        }}
        addresses={addresses}
        zones={zones.map((z) => ({ name: z.name, counties: z.counties, fee: Number(z.fee), isDefault: z.is_default, estimate: deliveryEstimate(z), freeOver: z.free_delivery_threshold == null ? null : Number(z.free_delivery_threshold) }))}
        methods={{
          mpesa: pm.mpesa.enabled,
          bank_transfer: pm.bank_transfer.enabled,
          cash_on_delivery: pm.cash_on_delivery.enabled,
          mpesa_paybill: pm.mpesa_paybill.enabled && Boolean(pm.mpesa_paybill.paybill_number),
          card: false,
        }}
        codCounties={pm.cash_on_delivery.counties ?? []}
        bank={pm.bank_transfer}
        paybill={pm.mpesa_paybill}
      />
    </div>
  )
}
