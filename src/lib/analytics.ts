// Ecommerce event tracking. Events go to window.dataLayer (Google Analytics / GTM)
// and the Meta Pixel only when those scripts were loaded (see components/analytics).
// With no analytics configured these calls are no-ops.

export type AnalyticsEvent =
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'purchase'
  | 'wishlist_add'
  | 'whatsapp_order'

const metaNames: Partial<Record<AnalyticsEvent, string>> = {
  product_view: 'ViewContent',
  search: 'Search',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  wishlist_add: 'AddToWishlist',
}

type W = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }

export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as W
  const gaName = event === 'product_view' ? 'view_item' : event === 'wishlist_add' ? 'add_to_wishlist' : event
  if (w.gtag) w.gtag('event', gaName, { currency: 'KES', ...params })
  else w.dataLayer?.push({ event: gaName, ecommerce: { currency: 'KES', ...params } })
  const meta = metaNames[event]
  if (meta && w.fbq) w.fbq('track', meta, { currency: 'KES', ...params })
}
