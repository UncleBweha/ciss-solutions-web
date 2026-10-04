export type StkRequest = {
  amount: number // whole KES
  phone: string // 2547XXXXXXXX
  reference: string // shown to the customer (order number)
  description: string
}

export type StkInitiated = {
  merchantRequestId: string
  checkoutRequestId: string
  customerMessage: string
}

export type StkQueryResult =
  | { state: 'pending' }
  | { state: 'success' }
  | { state: 'failed'; code: string; description: string }

/** An M-Pesa STK push provider (Daraja in sandbox/production, or the dev mock). */
export interface MpesaProvider {
  readonly name: 'mpesa_daraja' | 'mpesa_mock'
  initiate(request: StkRequest): Promise<StkInitiated>
  query(checkoutRequestId: string): Promise<StkQueryResult>
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly customerMessage = 'We could not start the M-Pesa payment. Please try again.',
  ) {
    super(message)
  }
}
