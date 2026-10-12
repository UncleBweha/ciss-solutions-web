import { describe, expect, it } from 'vitest'
import { forwardedIp, trustedProxyHops } from '@/lib/forwarded-ip'

describe('visitor address from X-Forwarded-For', () => {
  it('takes the entry our own proxy added, not one the client sent', () => {
    expect(forwardedIp('41.90.1.2', 1)).toBe('41.90.1.2')
    expect(forwardedIp('1.1.1.1, 41.90.1.2', 1)).toBe('41.90.1.2')
  })

  it('skips the proxies in front when there are more than one', () => {
    expect(forwardedIp('1.1.1.1, 41.90.1.2, 172.64.0.9', 2)).toBe('41.90.1.2')
    // Fewer entries than proxies (a request that skipped one): the nearest we have.
    expect(forwardedIp('41.90.1.2', 2)).toBe('41.90.1.2')
    expect(forwardedIp('1.1.1.1, 41.90.1.2', 3)).toBe('41.90.1.2')
  })

  it('has no address without the header', () => {
    expect(forwardedIp(null, 1)).toBeNull()
    expect(forwardedIp(' , ', 1)).toBeNull()
  })

  it('reads the number of proxies, falling back to one', () => {
    expect(trustedProxyHops('2')).toBe(2)
    expect(trustedProxyHops(undefined)).toBe(1)
    expect(trustedProxyHops('0')).toBe(1)
    expect(trustedProxyHops('many')).toBe(1)
  })
})
