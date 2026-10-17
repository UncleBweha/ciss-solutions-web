import { describe, expect, it } from 'vitest'
import { loadEnv } from './setup'

// HTTP-level checks for the public cron and order endpoints. Runs when an app
// server is available (E2E_BASE_URL, default http://localhost:3000).
loadEnv()
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const up = await fetch(base, { signal: AbortSignal.timeout(3000) }).then(() => true, () => false)
// CI starts the server and then requires these to run: skipped there, a removed secret
// check would go unnoticed.
if (!up && process.env.REQUIRE_APP_SERVER) throw new Error(`No app server at ${base}`)
const run = up ? describe : describe.skip

run('public endpoints (HTTP)', () => {
  it('protects the cron endpoint', async () => {
    expect((await fetch(`${base}/api/cron/release-reservations`)).status).toBe(401)
    const ok = await fetch(`${base}/api/cron/release-reservations`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
    expect(ok.status).toBe(200)
    expect(await ok.json()).toHaveProperty('released')
  })

  it('does not expose orders without the access token', async () => {
    expect((await fetch(`${base}/api/orders/CISS-AAAAAAAA/invoice`)).status).toBe(404)
  })
})
