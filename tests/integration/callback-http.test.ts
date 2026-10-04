import { describe, expect, it } from 'vitest'
import { loadEnv } from './setup'

// HTTP-level checks for the public payment and cron endpoints. Runs when an app
// server is available (E2E_BASE_URL, default http://localhost:3000).
loadEnv()
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const up = await fetch(base, { signal: AbortSignal.timeout(3000) }).then(() => true, () => false)
const run = up ? describe : describe.skip

run('public endpoints (HTTP)', () => {
  it('rejects M-Pesa callbacks without the shared secret', async () => {
    const res = await fetch(`${base}/api/mpesa/callback?secret=wrong`, { method: 'POST', body: JSON.stringify({ Body: {} }), headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(403)
  })

  it('acknowledges but ignores callbacks for unknown payments', async () => {
    const res = await fetch(`${base}/api/mpesa/callback?secret=${process.env.MPESA_CALLBACK_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Body: { stkCallback: { MerchantRequestID: 'x', CheckoutRequestID: 'ws_CO_unknown', ResultCode: 1032, ResultDesc: 'Cancelled' } } }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ResultCode: 0, outcome: 'unknown_payment' })
  })

  it('protects the cron endpoint', async () => {
    expect((await fetch(`${base}/api/cron/release-reservations`)).status).toBe(401)
    const ok = await fetch(`${base}/api/cron/release-reservations`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toHaveProperty('released')
  })

  it('does not expose orders without the access token', async () => {
    expect((await fetch(`${base}/api/orders/CISS-20261004-0001/status`)).status).toBe(404)
    expect((await fetch(`${base}/api/orders/CISS-20261004-0001/invoice`)).status).toBe(404)
  })
})
