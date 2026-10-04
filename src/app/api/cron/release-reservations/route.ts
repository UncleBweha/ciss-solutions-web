import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { releaseExpiredReservations } from '@/lib/payments/service'
import { safeEqual } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'

// Reconciles M-Pesa pushes still awaiting a result, then releases stock held by
// unpaid orders whose payment window has passed.
// Schedule every 5-10 minutes (Vercel Cron, GitHub Actions, or crontab + curl):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/release-reservations
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!serverEnv.cronSecret || !safeEqual(auth, serverEnv.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await releaseExpiredReservations()
  logger.info('cron.release_reservations', result)
  return NextResponse.json(result)
}
