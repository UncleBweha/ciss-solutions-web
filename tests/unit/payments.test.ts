import { describe, expect, it } from 'vitest'
import { allowedTransitions, orderTimeline } from '@/lib/ecommerce/orders'
import { darajaPassword, darajaTimestamp, describeResultCode, parseStkCallback } from '@/lib/payments/mpesa-result'

const success = {
  Body: {
    stkCallback: {
      MerchantRequestID: '29115-34620561-1',
      CheckoutRequestID: 'ws_CO_191220191020363925',
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 33199 },
          { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
          { Name: 'Balance' },
          { Name: 'TransactionDate', Value: 20191219102115 },
          { Name: 'PhoneNumber', Value: 254708374149 },
        ],
      },
    },
  },
}

describe('M-Pesa callback parsing', () => {
  it('extracts a successful payment', () => {
    expect(parseStkCallback(success)).toEqual({
      kind: 'success',
      merchantRequestId: '29115-34620561-1',
      checkoutRequestId: 'ws_CO_191220191020363925',
      amount: 33199,
      receipt: 'NLJ7RT61SV',
      phone: '254708374149',
      transactionDate: '20191219102115',
    })
  })
  it('extracts a failure', () => {
    const failed = { Body: { stkCallback: { MerchantRequestID: 'm', CheckoutRequestID: 'c', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } }
    expect(parseStkCallback(failed)).toEqual({
      kind: 'failure', merchantRequestId: 'm', checkoutRequestId: 'c', code: '1032', description: 'Request cancelled by user',
    })
  })
  it('rejects malformed payloads and successes without a receipt', () => {
    expect(parseStkCallback({})).toBeNull()
    expect(parseStkCallback({ Body: { stkCallback: { ResultCode: 0 } } })).toBeNull()
    const noReceipt = structuredClone(success)
    noReceipt.Body.stkCallback.CallbackMetadata.Item = [{ Name: 'Amount', Value: 1 }]
    expect(parseStkCallback(noReceipt)).toBeNull()
  })
  it('describes result codes for customers', () => {
    expect(describeResultCode('1032')).toMatch(/cancelled/)
    expect(describeResultCode('999', 'Odd')).toBe('Odd')
  })
  it('builds Daraja timestamp and password', () => {
    expect(darajaTimestamp(new Date('2026-10-04T08:05:09Z'))).toBe('20261004110509') // EAT = UTC+3
    expect(darajaPassword('174379', 'key', '20261004110509')).toBe(Buffer.from('174379key20261004110509').toString('base64'))
  })
})

describe('payment and order status', () => {
  it('only allows manual "paid" for bank transfer and cash on delivery', () => {
    expect(allowedTransitions('PENDING', 'cash_on_delivery')).toContain('PAID')
    expect(allowedTransitions('PENDING', 'mpesa')).not.toContain('PAID')
    expect(allowedTransitions('PAYMENT_PENDING', 'mpesa')).toEqual(['CANCELLED'])
    expect(allowedTransitions('DELIVERED', 'mpesa')).toEqual(['REFUNDED'])
  })
  it('builds the tracking timeline', () => {
    const steps = orderTimeline({ order_status: 'PROCESSING', payment_status: 'PAID', payment_method: 'mpesa' })
    expect(steps.map((s) => s.done)).toEqual([true, true, true, false, false])
    expect(steps.find((s) => s.current)?.key).toBe('dispatched')
    const pending = orderTimeline({ order_status: 'PAYMENT_PENDING', payment_status: 'PENDING', payment_method: 'mpesa' })
    expect(pending.map((s) => s.done)).toEqual([true, false, false, false, false])
  })
})

import { redact } from '@/lib/logger'

describe('logging redaction', () => {
  it('redacts secrets at any depth', () => {
    expect(
      redact({ phone: '2547', password: 'x', nested: { MPESA_PASSKEY: 'k', access_token: 't', ok: 1 }, list: [{ apiKey: 'a' }] }),
    ).toEqual({ phone: '2547', password: '[redacted]', nested: { MPESA_PASSKEY: '[redacted]', access_token: '[redacted]', ok: 1 }, list: [{ apiKey: '[redacted]' }] })
  })
})
