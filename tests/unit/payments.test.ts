import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowedTransitions, orderTimeline } from '@/lib/ecommerce/orders'
import { describeResultCode, parseStkCallback } from '@/lib/payments/mpesa-result'

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
})

describe('payment and order status', () => {
  it('only allows manual "paid" for bank transfer and cash on delivery', () => {
    expect(allowedTransitions('PENDING', 'cash_on_delivery')).toContain('PAID')
    expect(allowedTransitions('PENDING', 'mpesa_paybill')).toContain('PAID')
    expect(allowedTransitions('PENDING', 'mpesa')).not.toContain('PAID')
    expect(allowedTransitions('PAYMENT_PENDING', 'mpesa')).toEqual(['CANCELLED'])
    expect(allowedTransitions('DELIVERED', 'mpesa')).toEqual(['REFUNDED'])
    // Money that arrives after a manual order expired can still be recorded.
    expect(allowedTransitions('FAILED', 'bank_transfer')).toContain('PAID')
    expect(allowedTransitions('FAILED', 'mpesa')).toEqual(['CANCELLED'])
    // A paid order that was cancelled can still be refunded; an unpaid one cannot.
    expect(allowedTransitions('CANCELLED', 'mpesa', 'PAID')).toEqual(['REFUNDED'])
    expect(allowedTransitions('CANCELLED', 'mpesa', 'CANCELLED')).toEqual([])
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
      redact({ phone: '2547', password: 'x', nested: { KCB_ORG_PASSKEY: 'k', access_token: 't', ok: 1 }, list: [{ apiKey: 'a' }] }),
    ).toEqual({ phone: '2547', password: '[redacted]', nested: { KCB_ORG_PASSKEY: '[redacted]', access_token: '[redacted]', ok: 1 }, list: [{ apiKey: '[redacted]' }] })
  })
})

describe('KcbProvider', () => {
  const config = {
    consumerKey: 'key',
    consumerSecret: 'secret',
    baseUrl: undefined,
    tokenUrl: undefined,
    orgShortCode: '522522',
    orgPassKey: undefined,
    sharedShortCode: true,
    invoicePrefix: '7654321',
  }
  const mpesa = { env: 'sandbox' as const, callbackUrl: 'https://example.com/api/mpesa/callback', callbackSecret: 'long-random-secret' }
  const accepted = {
    response: { MerchantRequestID: 'MR-1', CheckoutRequestID: 'ws_CO_1', ResponseCode: '0', ResponseDescription: 'Success. Request accepted for processing', CustomerMessage: 'Success. Request accepted for processing' },
    header: { statusCode: '0', statusDescription: 'Success. Request accepted for processing' },
  }

  function stubKcb(stkResponse: unknown, status = 200) {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('/token')) return Response.json({ access_token: 'tok', expires_in: 3600 })
      return Response.json(stkResponse, { status })
    })
    return calls
  }
  afterEach(async () => {
    vi.unstubAllGlobals()
    // The token is cached per server; without this only the first test would fetch one.
    ;(await import('@/lib/payments/kcb')).resetKcbToken()
  })

  it('sends the STK push to the UAT gateway and returns the request ids', async () => {
    const calls = stubKcb(accepted)
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const stk = await new KcbProvider(config, mpesa).initiate({ amount: 1499.5, phone: '254712345678', reference: '100042', description: 'CISS order' })
    expect(stk).toMatchObject({ merchantRequestId: 'MR-1', checkoutRequestId: 'ws_CO_1' })
    const push = calls.find((c) => c.url === 'https://uat.buni.kcbgroup.com/mm/api/request/1.0.0/stkpush')!
    expect(JSON.parse(push.init.body as string)).toEqual({
      phoneNumber: '254712345678',
      amount: '1500',
      invoiceNumber: '7654321-100042',
      sharedShortCode: true,
      orgShortCode: '',
      orgPassKey: '',
      callbackUrl: 'https://example.com/api/mpesa/callback?secret=long-random-secret',
      transactionDescription: 'CISS order',
    })
    expect(push.init.headers).toMatchObject({ operation: 'STKPush', routeCode: '207', messageId: expect.stringMatching(/^[0-9a-f]{32}$/) })
  })

  it('sends your own shortcode and passkey only when not on the shared shortcode', async () => {
    const calls = stubKcb(accepted)
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const own = { ...config, sharedShortCode: false, orgShortCode: '123456', orgPassKey: 'pass' }
    await new KcbProvider(own, mpesa).initiate({ amount: 10, phone: '254712345678', reference: '100042', description: 'CISS order' })
    const push = calls.find((c) => c.url.endsWith('/stkpush'))!
    expect(JSON.parse(push.init.body as string)).toMatchObject({ sharedShortCode: false, orgShortCode: '123456', orgPassKey: 'pass' })
    expect(() => new KcbProvider({ ...own, orgShortCode: undefined }, mpesa)).toThrow(/orgShortCode/)
    expect(() => new KcbProvider({ ...config, invoicePrefix: undefined }, mpesa)).toThrow(/invoicePrefix/)
  })

  it('treats a non-zero response code, or a gateway fault, as a failed prompt', async () => {
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const request = { amount: 10, phone: '254712345678', reference: '100042', description: 'CISS order' }
    stubKcb({ header: { statusCode: '1', statusDescription: 'Bad request' } })
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toThrow(/Bad request/)
    stubKcb({ fault: { code: 900901, message: 'Invalid Credentials' } }, 401)
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toThrow(/401 Invalid Credentials/)
    stubKcb({ header: { statusCode: '1', statusDescription: 'Bad Request - Invalid PhoneNumber' }, response: {} }, 400)
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toThrow(/400 Bad Request - Invalid PhoneNumber/)
  })

  it('flags a push that got no answer as outcome unknown, but not one KCB rejected', async () => {
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const request = { amount: 10, phone: '254712345678', reference: '100042', description: 'CISS order' }
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/token')) return Response.json({ access_token: 'tok', expires_in: 3600 })
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toMatchObject({ outcomeUnknown: true })
    stubKcb({}, 504)
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toMatchObject({ outcomeUnknown: true })
    stubKcb({ header: { statusCode: '1', statusDescription: 'Bad request' } }, 400)
    await expect(new KcbProvider(config, mpesa).initiate(request)).rejects.toMatchObject({ outcomeUnknown: false })
  })

  it('fetches one token for prompts sent together, and rejects a token response without a token', async () => {
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const request = { amount: 10, phone: '254712345678', reference: '100042', description: 'CISS order' }
    const calls = stubKcb(accepted)
    const provider = new KcbProvider(config, mpesa)
    await Promise.all([provider.initiate(request), provider.initiate(request), provider.initiate(request)])
    expect(calls.filter((c) => c.url.includes('/token'))).toHaveLength(1)

    ;(await import('@/lib/payments/kcb')).resetKcbToken()
    vi.stubGlobal('fetch', async () => Response.json({ expires_in: 3600 }))
    await expect(provider.initiate(request)).rejects.toThrow(/no access token/)
  })

  it('sends the push once more with a new token when the gateway rejects the cached one', async () => {
    const { KcbProvider } = await import('@/lib/payments/kcb')
    const urls: string[] = []
    let pushes = 0
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url)
      if (url.includes('/token')) return Response.json({ access_token: 'tok', expires_in: 3600 })
      return ++pushes === 1 ? Response.json({ fault: { code: 900901, message: 'Invalid Credentials' } }, { status: 401 }) : Response.json(accepted)
    })
    const stk = await new KcbProvider(config, mpesa).initiate({ amount: 10, phone: '254712345678', reference: '100042', description: 'CISS order' })
    expect(stk.checkoutRequestId).toBe('ws_CO_1')
    expect(urls.filter((u) => u.includes('/token'))).toHaveLength(2)
    expect(pushes).toBe(2)
  })

  it('refuses to start without a callback secret, or in production without the live host', async () => {
    const { KcbProvider } = await import('@/lib/payments/kcb')
    expect(() => new KcbProvider(config, { ...mpesa, callbackSecret: undefined })).toThrow(/callbackSecret/)
    expect(() => new KcbProvider(config, { ...mpesa, env: 'production' })).toThrow(/baseUrl/)
    expect(() => new KcbProvider({ ...config, baseUrl: 'https://live.example' }, { ...mpesa, env: 'production' })).not.toThrow()
  })
})
