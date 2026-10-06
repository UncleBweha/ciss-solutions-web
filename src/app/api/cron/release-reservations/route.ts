import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { runOutbox } from '@/lib/outbox'
import { releaseExpiredReservations } from '@/lib/payments/service'
import { safeEqual } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'

// Reconciles M-Pesa pushes still awaiting a result, releases stock held by unpaid
// orders whose payment window has passed, and sweeps the outbox (emails, STK pushes).
// Schedule every 5-10 minutes (Vercel Cron, GitHub Actions, or crontab + curl):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/release-reservations
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!serverEnv.cronSecret || !safeEqual(auth, serverEnv.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await releaseExpiredReservations()
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
  logger.info('cron.release_reservations', { ...result, outbox })
  return NextResponse.json({ ...result, outbox })
}
