// The visitor's address from X-Forwarded-For. Each proxy appends the address it received
// the request from, so only the entries added by our own proxies can be believed: with one
// proxy in front (Caddy) that is the last entry, with two (Cloudflare, then Caddy) the one
// before it. Anything further left was sent by the client and can say whatever it likes.

/** Proxies in front of the app that append to X-Forwarded-For (TRUSTED_PROXY_HOPS, default 1). */
export function trustedProxyHops(value = process.env.TRUSTED_PROXY_HOPS) {
  const hops = Number(value)
  return Number.isInteger(hops) && hops >= 1 ? hops : 1
}

export function forwardedIp(header: string | null | undefined, hops = trustedProxyHops()): string | null {
  const entries = (header ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  // Fewer entries than proxies (a request that skipped one): the last is still the one our own proxy wrote.
  return entries[entries.length - hops] ?? entries.at(-1) ?? null
}
