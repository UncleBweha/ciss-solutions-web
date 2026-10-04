import 'server-only'
import { createHash } from 'node:crypto'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'
import { siteUrl } from '@/lib/env'
import type { MpesaProvider, StkInitiated, StkQueryResult, StkRequest } from './types'

/**
 * Development stand-in for Daraja. It never moves money. It mimics Safaricom's
 * behaviour: the STK push is accepted, and a few seconds later the result is
 * delivered to our callback endpoint (and answered by query()).
 *
 * Test numbers: phone ending in 1 -> cancelled by user (1032), ending in 2 ->
 * insufficient balance (1); anything else succeeds.
 */
export class MockMpesaProvider implements MpesaProvider {
  readonly name = 'mpesa_mock' as const
  static readonly delayMs = 4000

  private outcome(phone: string) {
    if (phone.endsWith('1')) return { code: '1032', description: 'Request cancelled by user' }
    if (phone.endsWith('2')) return { code: '1', description: 'The balance is insufficient for the transaction' }
    return { code: '0', description: 'The service request is processed successfully.' }
  }

  async initiate(request: StkRequest): Promise<StkInitiated> {
    const now = Date.now()
    const checkoutRequestId = `ws_CO_MOCK_${now}_${request.phone}_${Math.round(request.amount)}`
    const merchantRequestId = `MOCK-${now}`
    const outcome = this.outcome(request.phone)

    // Deliver the callback like Safaricom would (best effort; query() covers the rest).
    setTimeout(() => {
      const url = new URL(serverEnv.mpesa.callbackUrl || `${siteUrl}/api/mpesa/callback`)
      if (serverEnv.mpesa.callbackSecret) url.searchParams.set('secret', serverEnv.mpesa.callbackSecret)
      const body =
        outcome.code === '0'
          ? {
              Body: {
                stkCallback: {
                  MerchantRequestID: merchantRequestId,
                  CheckoutRequestID: checkoutRequestId,
                  ResultCode: 0,
                  ResultDesc: outcome.description,
                  CallbackMetadata: {
                    Item: [
                      { Name: 'Amount', Value: Math.round(request.amount) },
                      { Name: 'MpesaReceiptNumber', Value: mockReceipt(checkoutRequestId) },
                      { Name: 'TransactionDate', Value: Number(new Date().toISOString().replace(/\D/g, '').slice(0, 14)) },
                      { Name: 'PhoneNumber', Value: Number(request.phone) },
                    ],
                  },
                },
              },
            }
          : {
              Body: {
                stkCallback: {
                  MerchantRequestID: merchantRequestId,
                  CheckoutRequestID: checkoutRequestId,
                  ResultCode: Number(outcome.code),
                  ResultDesc: outcome.description,
                },
              },
            }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch((error) =>
        logger.warn('mpesa.mock_callback_failed', { error }),
      )
    }, MockMpesaProvider.delayMs)

    return { merchantRequestId, checkoutRequestId, customerMessage: 'Success. Request accepted for processing (mock)' }
  }

  async query(checkoutRequestId: string): Promise<StkQueryResult> {
    const [, , , ts, phone] = checkoutRequestId.split('_')
    if (Date.now() - Number(ts) < MockMpesaProvider.delayMs) return { state: 'pending' }
    const outcome = this.outcome(phone ?? '')
    return outcome.code === '0' ? { state: 'success' } : { state: 'failed', code: outcome.code, description: outcome.description }
  }
}

export function mockReceipt(checkoutRequestId: string) {
  // Deterministic per request (callback and query agree) and unique across requests.
  return `MCK${createHash('sha256').update(checkoutRequestId).digest('hex').slice(0, 7).toUpperCase()}`
}
