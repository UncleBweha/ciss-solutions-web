import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Clears rate-limit counters so repeated local runs are not throttled by the
// app's own abuse protection (checkout, login, support forms).
export default async function globalSetup() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
  )
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  await createClient(url, key).from('rate_limits').delete().neq('key', '')
}
