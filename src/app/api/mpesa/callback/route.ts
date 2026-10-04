import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { handleStkCallback } from '@/lib/payments/service'
import { safeEqual } from '@/lib/security'
import { serverEnv } from '@/lib/server-env'

// Safaricom Daraja STK callback. Daraja does not sign callbacks, so we require the
// secret we put in CallBackURL, optionally an IP allow-list, then verify the
// payment against our own records (amount, request ids, receipt uniqueness)
// before anything is marked paid. Processing is idempotent.
const ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' }

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const expected = serverEnv.mpesa.callbackSecret
  // Fail closed in production: without a configured secret, nothing is accepted.
  if (expected ? !safeEqual(secret, expected) : process.env.NODE_ENV === 'production') {
    logger.warn('mpesa.callback_rejected', { reason: expected ? 'bad_secret' : 'secret_not_configured' })
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Rejected' }, { status: 403 })
  }

  const allowList = (process.env.MPESA_ALLOWED_IPS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowList.length) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    if (!allowList.includes(ip)) {
      logger.warn('mpesa.callback_rejected', { reason: 'ip', ip })
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Rejected' }, { status: 403 })
    }
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const outcome = await handleStkCallback(payload)
    return NextResponse.json({ ...ACCEPTED, outcome })
  } catch (error) {
    // Let Safaricom retry: our processing failed (e.g. database unavailable).
    logger.error('mpesa.callback_error', { error })
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Temporary error' }, { status: 500 })
  }
}
