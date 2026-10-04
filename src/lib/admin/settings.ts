import 'server-only'
import { createClient } from '@/lib/supabase/server'

/** Reads settings rows with the staff session (includes private ones the role may see). */
export async function readSettings<T extends Record<string, unknown>>(keys: string[]): Promise<Record<string, T>> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value').in('key', keys)
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value as T]))
}
