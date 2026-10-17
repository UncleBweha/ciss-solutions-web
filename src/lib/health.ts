import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// What an uptime monitor needs to know: can the shop take orders, and is the work that
// follows an order (payment results, emails, stock release) still being done? Nothing
// else notices when the cron job stops or a payment never gets its answer.

const CRON_HEARTBEAT_KEY = 'cron_heartbeat'
/** The cron job runs every 5 minutes; three missed runs is a stopped job. */
const STALE_MS = 15 * 60_000

/** Called at the end of every cron run. */
export async function recordCronRun() {
  const { error } = await createAdminClient()
    .from('settings')
    .upsert({ key: CRON_HEARTBEAT_KEY, value: { at: new Date().toISOString() }, is_public: false })
  if (error) throw new Error(`cron heartbeat: ${error.message}`)
}

export type Health = {
  /** The database answers. */
  database: boolean
  /** The cron job has run in the last 15 minutes. */
  cron: boolean
  /** No background task is overdue, and none gave up in the last day. */
  outbox: boolean
}

export async function checkHealth(): Promise<Health> {
  const health: Health = { database: false, cron: false, outbox: false }
  try {
    const db = createAdminClient()
    const stale = new Date(Date.now() - STALE_MS).toISOString()
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString()
    const [heartbeat, overdue, dead] = await Promise.all([
      db.from('settings').select('value').eq('key', CRON_HEARTBEAT_KEY).maybeSingle(),
      db.from('outbox').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed']).lt('next_attempt_at', stale),
      db.from('outbox').select('id', { count: 'exact', head: true }).eq('status', 'dead').gte('updated_at', dayAgo),
    ])
    health.database = !heartbeat.error
    const at = (heartbeat.data?.value as { at?: unknown } | null)?.at
    health.cron = typeof at === 'string' && Date.now() - new Date(at).getTime() < STALE_MS
    health.outbox = !overdue.error && !dead.error && !overdue.count && !dead.count
  } catch {
    // Not configured or unreachable: every check stays false.
  }
  return health
}
