// Pure helpers for Daraja STK callbacks: parsing and validation (unit tested).
import { z } from 'zod'

const metadataItem = z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() })

export const stkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.union([z.number(), z.string()]),
      ResultDesc: z.string(),
      CallbackMetadata: z.object({ Item: z.array(metadataItem) }).optional(),
    }),
  }),
})

export type StkCallback = z.infer<typeof stkCallbackSchema>

export type ParsedStkResult =
  | {
      kind: 'success'
      merchantRequestId: string
      checkoutRequestId: string
      amount: number
      receipt: string
      phone: string | null
      transactionDate: string | null
    }
  | { kind: 'failure'; merchantRequestId: string; checkoutRequestId: string; code: string; description: string }

/** Validates the callback shape and extracts the fields we act on. */
export function parseStkCallback(payload: unknown): ParsedStkResult | null {
  const parsed = stkCallbackSchema.safeParse(payload)
  if (!parsed.success) return null
  const cb = parsed.data.Body.stkCallback
  const code = String(cb.ResultCode)
  if (code !== '0') {
    return {
      kind: 'failure',
      merchantRequestId: cb.MerchantRequestID,
      checkoutRequestId: cb.CheckoutRequestID,
      code,
      description: cb.ResultDesc,
    }
  }
  const items = new Map((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]))
  const amount = Number(items.get('Amount'))
  const receipt = items.get('MpesaReceiptNumber')
  if (!Number.isFinite(amount) || typeof receipt !== 'string' || !receipt) return null
  const phone = items.get('PhoneNumber')
  const date = items.get('TransactionDate')
  return {
    kind: 'success',
    merchantRequestId: cb.MerchantRequestID,
    checkoutRequestId: cb.CheckoutRequestID,
    amount,
    receipt,
    phone: phone != null ? String(phone) : null,
    transactionDate: date != null ? String(date) : null,
  }
}

/** Customer-friendly explanation of common STK result codes. */
export function describeResultCode(code: string, fallback?: string): string {
  switch (code) {
    case '0':
      return 'Payment received.'
    case '1':
      return 'Your M-Pesa balance is insufficient for this payment.'
    case '1032':
      return 'The payment request was cancelled on your phone.'
    case '1037':
      return 'We could not reach your phone. Make sure it is on and try again.'
    case '2001':
      return 'The M-Pesa PIN entered was incorrect.'
    case '1019':
      return 'The payment request expired before it was completed.'
    case '1001':
      return 'Another M-Pesa transaction is in progress on your line. Wait a moment and try again.'
    default:
      return fallback || 'The payment did not go through.'
  }
}

/** Daraja timestamp: YYYYMMDDHHmmss in Kenyan time. */
export function darajaTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}${get('month')}${get('day')}${hour}${get('minute')}${get('second')}`
}

export function darajaPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}
