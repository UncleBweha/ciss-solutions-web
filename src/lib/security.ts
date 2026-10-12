import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'
import { forwardedIp } from '@/lib/forwarded-ip'
import { createAdminClient } from '@/lib/supabase/admin'

export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return forwardedIp(h.get('x-forwarded-for')) || h.get('x-real-ip') || 'unknown'
}

const windows = new Map<string, { start: number; hits: number }>()

/**
 * Fixed-window rate limit held in this server's memory: for loose ceilings on busy
 * paths (search suggestions, status polls), where a database write per request would
 * cost more than the request it guards. Counts are per server process (the site runs as one).
 */
export function memoryRateLimit(key: string, max: number, windowSeconds: number): boolean {
  const now = Date.now()
  const current = windows.get(key)
  if (!current || now - current.start > windowSeconds * 1000) {
    // Bounded: drop finished windows before the map can grow without limit.
    if (windows.size > 20_000) {
      for (const [k, w] of windows) if (now - w.start > 3600_000) windows.delete(k)
      if (windows.size > 20_000) windows.clear()
    }
    windows.set(key, { start: now, hits: 1 })
    return true
  }
  current.hits += 1
  return current.hits <= max
}

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances).
 * Kenyan mobile networks put thousands of customers behind one shared address, so
 * per-IP limits are only a loose ceiling against floods; the tight limit belongs on
 * what is being guessed or spammed (an email, a phone number, an order number).
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('check_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds })
  if (error) return true // fail open: never block customers because the limiter errored
  return data !== false
}
