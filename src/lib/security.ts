import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
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
