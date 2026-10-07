// A guest opens their order with the token from the confirmation link (/order/<number>?t=<token>).
// The proxy moves that token into an httpOnly cookie and redirects to the address without
// it, so the token is not left in the address bar, in browser history, or in the page
// address that analytics scripts report.

/** Cookie holding the access token of one order (order numbers are letters, digits and dashes). */
export function orderTokenCookie(orderNumber: string) {
  return `order_token_${orderNumber.replace(/[^A-Za-z0-9_-]/g, '')}`
}

/** Order access tokens are UUIDs; anything else is not worth storing. */
export const isOrderToken = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
