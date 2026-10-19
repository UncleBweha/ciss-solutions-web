import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { syncOccasionDates } from '@/lib/occasions/data'
import { safeEqual } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'

// Re-dates the movable occasions (Easter, Ramadan, both Eids, Diwali, Mazingira Day
// from Google's public holiday calendars; Mother's Day, Father's Day and Customer
// Service Week by rule). Daily is plenty:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/sync-occasion-dates
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!serverEnv.cronSecret || !safeEqual(auth, serverEnv.cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const results = await syncOccasionDates()
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    logger.error('cron.occasion_sync_failed', { error })
    return NextResponse.json({ ok: false, error: 'sync failed' }, { status: 500 })
  }
}
