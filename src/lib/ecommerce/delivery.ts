import { formatKES } from './money'

// How an order reaches the customer. Stored on the order as its delivery_zone_name.
export const STORE_PICKUP = 'Store pickup'
export const PARCEL_DELIVERY = 'Parcel delivery'
export type DeliveryMethod = 'pickup' | 'delivery'

export const DELIVERY_TBC = 'To be confirmed'
/** Why parcel orders carry no delivery charge at checkout. */
export const DELIVERY_TBC_NOTE =
  'We use third-party parcel couriers. The charge depends on your location, the weight of the products and the courier you prefer, so the delivery cost is confirmed after you place the order. Our representative will call you to arrange delivery.'

export const isStorePickup = (zoneName: string | null | undefined) => zoneName === STORE_PICKUP

/** What to show for an order's delivery charge: an amount once agreed, "Free" for pickup, otherwise "To be confirmed". */
export function deliveryFeeLabel(fee: number | string, zoneName: string | null | undefined): string {
  if (Number(fee) > 0) return formatKES(Number(fee))
  return isStorePickup(zoneName) ? 'Free' : DELIVERY_TBC
}

export type DeliveryZone = {
  id: string
  name: string
  counties: string[]
  fee: number
  free_delivery_threshold: number | null
  estimated_days_min: number
  estimated_days_max: number
  estimate_label: string | null
  is_default: boolean
  is_active: boolean
}

/** Finds the zone for a county; falls back to the default ("Other locations") zone. */
export function resolveDeliveryZone(zones: DeliveryZone[], county: string): DeliveryZone | null {
  const active = zones.filter((z) => z.is_active)
  const needle = county.trim().toLowerCase()
  return (
    active.find((z) => z.counties.some((c) => c.toLowerCase() === needle)) ??
    active.find((z) => z.is_default) ??
    null
  )
}

/** Delivery fee for a zone, honouring the free-delivery threshold (on subtotal after discount). */
export function deliveryFee(zone: DeliveryZone, merchandiseTotal: number): number {
  if (zone.free_delivery_threshold != null && merchandiseTotal >= zone.free_delivery_threshold) return 0
  return Number(zone.fee)
}

export function deliveryEstimate(zone: Pick<DeliveryZone, 'estimate_label' | 'estimated_days_min' | 'estimated_days_max'>) {
  if (zone.estimate_label) return zone.estimate_label
  if (zone.estimated_days_max <= 1) return 'Same day / next day'
  return `${zone.estimated_days_min}–${zone.estimated_days_max} business days`
}
