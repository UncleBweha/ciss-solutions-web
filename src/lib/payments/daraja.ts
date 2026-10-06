import 'server-only'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'
import { darajaPassword, darajaTimestamp } from './mpesa-result'
import { PaymentError, type MpesaProvider, type StkInitiated, type StkQueryResult, type StkRequest } from './types'

const BASE = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
}

let token: { value: string; expiresAt: number } | null = null

/** Safaricom Daraja STK Push (Lipa na M-Pesa Online). Credentials never leave the server. */
export class DarajaProvider implements MpesaProvider {
  readonly name = 'mpesa_daraja' as const
  private readonly base: string

  constructor(private readonly config = serverEnv.mpesa) {
    if (config.env === 'mock') throw new Error('DarajaProvider requires MPESA_ENV=sandbox or production')
    const missing = (['consumerKey', 'consumerSecret', 'shortcode', 'passkey', 'callbackUrl', 'callbackSecret'] as const).filter((k) => !config[k])
    if (missing.length) throw new Error(`M-Pesa is not configured: missing ${missing.join(', ')}`)
    this.base = BASE[config.env]
  }

  private async accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value
    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64')
    const res = await fetch(`${this.base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new PaymentError(`Daraja auth failed: ${res.status}`)
    const body = (await res.json()) as { access_token: string; expires_in: string }
    token = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in) * 1000 }
    return token.value
  }

  private callbackUrl() {
    const url = new URL(this.config.callbackUrl!)
    if (this.config.callbackSecret) url.searchParams.set('secret', this.config.callbackSecret)
    return url.toString()
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    const json = (await res.json().catch(() => ({}))) as T & { errorMessage?: string; errorCode?: string }
    if (!res.ok) {
      logger.warn('mpesa.daraja_error', { path, status: res.status, code: json.errorCode, message: json.errorMessage })
      throw Object.assign(new PaymentError(`Daraja ${path} failed: ${res.status} ${json.errorMessage ?? ''}`), { status: res.status, body: json })
    }
    return json
  }

  async initiate(request: StkRequest): Promise<StkInitiated> {
    const timestamp = darajaTimestamp()
    const shortcode = this.config.shortcode!
    const body = await this.post<{
      MerchantRequestID: string
      CheckoutRequestID: string
      ResponseCode: string
      ResponseDescription: string
      CustomerMessage: string
    }>('/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: shortcode,
      Password: darajaPassword(shortcode, this.config.passkey!, timestamp),
      Timestamp: timestamp,
      TransactionType: this.config.transactionType,
      Amount: Math.ceil(request.amount),
      PartyA: request.phone,
      PartyB: this.config.partyB || shortcode,
      PhoneNumber: request.phone,
      CallBackURL: this.callbackUrl(),
      AccountReference: request.reference.slice(0, 12),
      TransactionDesc: request.description.slice(0, 13),
    })
    if (body.ResponseCode !== '0') throw new PaymentError(`STK rejected: ${body.ResponseDescription}`)
    return { merchantRequestId: body.MerchantRequestID, checkoutRequestId: body.CheckoutRequestID, customerMessage: body.CustomerMessage }
  }

  async query(checkoutRequestId: string): Promise<StkQueryResult> {
    const timestamp = darajaTimestamp()
    const shortcode = this.config.shortcode!
    try {
      const body = await this.post<{ ResultCode?: string; ResultDesc?: string }>('/mpesa/stkpushquery/v1/query', {
        BusinessShortCode: shortcode,
        Password: darajaPassword(shortcode, this.config.passkey!, timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      })
      // 4999: "The transaction is still under processing" (the customer has not entered their PIN yet).
      if (body.ResultCode === undefined || String(body.ResultCode) === '4999') return { state: 'pending' }
      if (String(body.ResultCode) === '0') return { state: 'success' }
      return { state: 'failed', code: String(body.ResultCode), description: body.ResultDesc ?? 'Payment failed' }
    } catch (error) {
      // "The transaction is being processed" comes back as HTTP 500 with errorCode 500.001.1001
      const code = (error as { body?: { errorCode?: string } }).body?.errorCode
      if (code === '500.001.1001') return { state: 'pending' }
      throw error
    }
  }
}
