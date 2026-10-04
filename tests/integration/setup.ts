import { readFileSync } from 'node:fs'

/** Loads .env.local into process.env for integration tests (they need local Supabase). */
export function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const i = line.indexOf('=')
      if (i < 1 || line.startsWith('#')) continue
      const key = line.slice(0, i)
      process.env[key] ??= line.slice(i + 1).replace(/^"|"$/g, '')
    }
  } catch {
    // no .env.local: integration tests skip
  }
}

export async function supabaseReachable() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  try {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' }, signal: AbortSignal.timeout(2000) })
    return res.status < 500
  } catch {
    return false
  }
}
