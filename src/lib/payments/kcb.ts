import 'server-only'
import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'
import { PaymentError, type MpesaProvider, type StkInitiated, type StkQueryResult, type StkRequest } from './types'

const UAT_BASE = 'https://uat.buni.kcbgroup.com'

let token: { value: string; expiresAt: number } | null = null
let tokenRequest: Promise<string> | null = null

/** Forgets the cached access token (tests). */
export function resetKcbToken() {
  token = null
  tokenRequest = null
}

type KcbFault = {
  fault?: { code?: number | string; message?: string; description?: string }
  header?: { statusCode?: string; statusDescription?: string }
}

/**
 * M-Pesa STK Push through KCB's Buni gateway: the customer pays by M-Pesa and the
 * money settles in the KCB till or account. KCB passes on Safaricom's
 * Body.stkCallback payload, which /api/mpesa/callback handles.
 */
export class KcbProvider implements MpesaProvider {
  readonly name = 'mpesa_kcb' as const
  private readonly base: string

  constructor(
    private readonly config = serverEnv.kcb,
    private readonly mpesa: Pick<typeof serverEnv.mpesa, 'env' | 'callbackUrl' | 'callbackSecret'> = serverEnv.mpesa,
  ) {
    if (mpesa.env === 'mock') throw new Error('KcbProvider requires MPESA_ENV=sandbox or production')
    const missing = [
      ...(['consumerKey', 'consumerSecret'] as const).filter((k) => !config[k]),
      // On the shared shortcode KCB finds the merchant by the till in the invoice number.
      ...(config.sharedShortCode ? (config.invoicePrefix ? [] : ['invoicePrefix']) : config.orgShortCode ? [] : ['orgShortCode']),
      ...(['callbackUrl', 'callbackSecret'] as const).filter((k) => !mpesa[k]),
      // KCB issues the live host at go-live; there is no safe default to guess.
      ...(mpesa.env === 'production' && !config.baseUrl ? ['baseUrl'] : []),
    ]
    if (missing.length) throw new Error(`KCB M-Pesa is not configured: missing ${missing.join(', ')}`)
    this.base = (config.baseUrl ?? UAT_BASE).replace(/\/+$/, '')
  }

  private accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return Promise.resolve(token.value)
    // Checkouts that arrive together share one token request.
    tokenRequest ??= this.fetchToken().finally(() => {
      tokenRequest = null
    })
    return tokenRequest
  }

  private async fetchToken(): Promise<string> {
    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64')
    const res = await fetch(this.config.tokenUrl ?? `${this.base}/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new PaymentError(`KCB auth failed: ${res.status}`)
    const body = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null
    if (typeof body?.access_token !== 'string' || !body.access_token) throw new PaymentError('KCB auth failed: no access token in the response')
    const seconds = Number(body.expires_in)
    token = { value: body.access_token, expiresAt: Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3000) * 1000 }
    return token.value
  }

  private callbackUrl() {
    const url = new URL(this.mpesa.callbackUrl!)
    if (this.mpesa.callbackSecret) url.searchParams.set('secret', this.mpesa.callbackSecret)
    return url.toString()
  }

  private async post<T>(path: string, body: unknown, headers: Record<string, string> = {}, retry = true): Promise<T> {
    const authorization = `Bearer ${await this.accessToken()}`
    let res: Response
    try {
      res = await fetch(`${this.base}${path}`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      // Sent but never answered (timeout, dropped connection): KCB may have acted on it.
      logger.warn('mpesa.kcb_no_response', { path, error })
      throw new PaymentError(`KCB ${path} gave no response: ${error instanceof Error ? error.message : String(error)}`, undefined, true)
    }
    const json = (await res.json().catch(() => ({}))) as T & KcbFault
    if (!res.ok) {
      // 401: the gateway no longer accepts the cached token (it usually says fault 900901).
      // A gateway checks the token before passing a request on, so nothing was sent to the
      // phone: send it once more with a new token. (Assumed, not confirmed with KCB: if a 401
      // could follow a prompt that did go out, this retry would send a second one.)
      if (res.status === 401) {
        token = null
        if (retry) return this.post(path, body, headers, false)
      }
      // The gateway answers with a fault; the STK API itself with header.statusDescription.
      const message = json.fault?.message ?? json.header?.statusDescription ?? ''
      logger.warn('mpesa.kcb_error', { path, status: res.status, code: json.fault?.code, message })
      // A gateway timeout (502/504) says nothing about whether the push went out.
      const unknown = res.status === 502 || res.status === 504
      throw Object.assign(new PaymentError(`KCB ${path} failed: ${res.status} ${message}`, undefined, unknown), { status: res.status, body: json })
    }
    return json
  }

  async initiate(request: StkRequest): Promise<StkInitiated> {
    const prefix = this.config.invoicePrefix
    const body = await this.post<{
      response?: {
        MerchantRequestID?: string
        CheckoutRequestID?: string
        ResponseCode?: string
        ResponseDescription?: string
        CustomerMessage?: string
      }
      header?: { statusCode?: string; statusDescription?: string }
    }>('/mm/api/request/1.0.0/stkpush', {
      phoneNumber: request.phone,
      amount: String(Math.ceil(request.amount)),
      // The part before the dash tells KCB which till or account to credit.
      invoiceNumber: prefix ? `${prefix}-${request.reference}` : request.reference,
      sharedShortCode: this.config.sharedShortCode,
      // Must be blank on the shared shortcode: KCB fills in its own, and answers
      // "Merchant does not exist" if one is sent (522522 included).
      orgShortCode: this.config.sharedShortCode ? '' : this.config.orgShortCode,
      orgPassKey: this.config.sharedShortCode ? '' : (this.config.orgPassKey ?? ''),
      callbackUrl: this.callbackUrl(),
      transactionDescription: request.description,
    }, { messageId: randomUUID().replace(/-/g, ''), operation: 'STKPush', routeCode: '207' })
    const stk = body.response
    if (!stk || String(stk.ResponseCode) !== '0' || !stk.MerchantRequestID || !stk.CheckoutRequestID) {
      throw new PaymentError(`KCB STK rejected: ${stk?.ResponseDescription ?? body.header?.statusDescription ?? 'no response body'}`)
    }
    return { merchantRequestId: stk.MerchantRequestID, checkoutRequestId: stk.CheckoutRequestID, customerMessage: stk.CustomerMessage ?? '' }
  }

  /**
   * Buni has no documented STK status query, so the callback is the only confirmation.
   * An attempt with no callback times out as usual (see refreshPaymentStatus); if the
   * callback arrives after that, confirm_payment() still accepts it.
   */
  async query(): Promise<StkQueryResult> {
    return { state: 'pending' }
  }
}
