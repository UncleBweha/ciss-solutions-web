import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'
import type { Database } from '@/types/database'

/** Cache lifetimes (seconds) for catalogue data. */
export const CACHE = {
  product: 86400,
  category: 86400,
  brand: 86400,
  catalog: 3600,
  homepage: 3600,
  settings: 3600,
} as const

/**
 * Anonymous, cookie-free client for public catalogue reads. Every request goes
 * through Next's data cache with the given tags so admin edits can revalidate
 * exactly the pages they affect (see lib/cache.ts).
 */
export function publicClient(tags: string[], revalidate: number = CACHE.catalog) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate, tags } }),
    },
  })
}
