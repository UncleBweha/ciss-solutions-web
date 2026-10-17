import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/health'
import { logger } from '@/lib/logger'
import { emailUrgentAlerts } from '@/lib/notifications'
import { runOutbox } from '@/lib/outbox'
import { safeEqual } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'
import { createAdminClient } from '@/lib/supabase/admin'

// Releases stock held by unpaid orders whose payment window has passed, and sweeps the
// outbox (emails, POS sales).
// Schedule every 5-10 minutes (Vercel Cron, GitHub Actions, or crontab + curl):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/release-reservations
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!serverEnv.cronSecret || !safeEqual(auth, serverEnv.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // One failing step must not stop the others: the outbox still has emails to send.
  let result: Record<string, number | string>
  try {
    const { data, error } = await createAdminClient().rpc('expire_stale_orders')
    if (error) throw new Error(error.message)
    result = { released: data ?? 0 }
  } catch (error) {
    logger.error('cron.release_failed', { error })
    result = { error: 'release failed' }
  }
  // Rate limit rows are only read inside their window (an hour at most); old ones just pile up.
  const { error: purgeError } = await createAdminClient().from('rate_limits').delete().lt('window_start', new Date(Date.now() - 24 * 3600_000).toISOString())
  if (purgeError) logger.warn('cron.rate_limit_purge_failed', { error: purgeError })
  // Sweep the outbox: anything not finished by the request that created it.
  let outbox: Record<string, number | string>
  try {
    const tasks = await runOutbox({ limit: 50 })
    outbox = {
      done: tasks.filter((t) => t.outcome === 'done').length,
      retry: tasks.filter((t) => t.outcome === 'retry').length,
      dead: tasks.filter((t) => t.outcome === 'dead').length,
    }
  } catch (error) {
    // Outbox migration not applied yet: everything else in this job still runs.
    logger.warn('cron.outbox_unavailable', { error })
    outbox = { error: 'unavailable' }
  }
  // Staff are emailed what cannot wait (stock shortages, tasks that gave up).
  let alerts: number | string
  try {
    alerts = await emailUrgentAlerts()
  } catch (error) {
    logger.error('cron.alerts_failed', { error })
    alerts = 'failed'
  }
  // /api/health reports the job as stopped when this goes stale.
  await recordCronRun().catch((error) => logger.error('cron.heartbeat_failed', { error }))
  logger.info('cron.release_reservations', { ...result, outbox, alerts })
  // A step that failed is a failed run: whoever watches the job must be able to tell.
  const failed = 'error' in result || 'error' in outbox || alerts === 'failed'
  return NextResponse.json({ ...result, outbox, alerts }, { status: failed ? 500 : 200 })
}
