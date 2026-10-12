import { NextResponse } from 'next/server'
import { checkHealth } from '@/lib/health'
import { clientIp, memoryRateLimit } from '@/lib/security'

// For an uptime monitor: 200 while the shop can take orders and finish them, 503 when
// something needs a person. It says which check failed and nothing more.
export async function GET() {
  if (!memoryRateLimit(`health:${await clientIp()}`, 30, 60)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const checks = await checkHealth()
  const ok = Object.values(checks).every(Boolean)
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
