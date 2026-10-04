'use client'
import { createBrowserClient } from '@supabase/ssr'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'
import type { Database } from '@/types/database'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/** Browser client (anon key + user session cookie). Never has elevated rights. */
export function createClient() {
  client ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  return client
}
