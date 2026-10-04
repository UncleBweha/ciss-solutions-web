import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/env'
import { serverEnv } from '@/lib/server-env'
import type { Database } from '@/types/database'

let admin: ReturnType<typeof createClient<Database>> | undefined

/**
 * Service-role client: bypasses Row Level Security. Use only in server code after
 * the caller has been validated (checkout, payment callbacks, audit logging).
 */
export function createAdminClient() {
  if (!serverEnv.serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  admin ??= createClient<Database>(supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
  return admin
}
