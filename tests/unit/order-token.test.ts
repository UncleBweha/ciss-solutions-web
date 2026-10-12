import { describe, expect, it } from 'vitest'
import { isOrderToken, orderTokenCookie } from '@/lib/order-token'

describe('order access token cookie', () => {
  it('names one cookie per order, from the order number only', () => {
    expect(orderTokenCookie('CISS-7K2MQ9XA')).toBe('order_token_CISS-7K2MQ9XA')
    // Nothing that could break out of a cookie name.
    expect(orderTokenCookie('CISS-1; Path=/; x=')).toBe('order_token_CISS-1Pathx')
  })

  it('accepts only UUID tokens', () => {
    expect(isOrderToken('3f0c2a1e-7b4d-4c8e-9a51-0d2f6b7c8e90')).toBe(true)
    expect(isOrderToken('not-a-token')).toBe(false)
    expect(isOrderToken('3f0c2a1e-7b4d-4c8e-9a51-0d2f6b7c8e90; Path=/')).toBe(false)
    expect(isOrderToken('')).toBe(false)
  })
})
