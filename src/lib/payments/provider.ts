import 'server-only'
import { serverEnv } from '@/lib/server-env'
import { KcbProvider } from './kcb'
import { MockMpesaProvider } from './mock'
import type { MpesaProvider } from './types'

let provider: MpesaProvider | null = null

/**
 * MPESA_ENV=sandbox|production -> KCB Buni; MPESA_ENV=mock -> simulator.
 * The simulator is refused in production builds unless explicitly allowed
 * (MPESA_ALLOW_MOCK=true, for staging only) so it can never take real orders.
 */
export function getMpesaProvider(): MpesaProvider {
  if (provider) return provider
  if (serverEnv.mpesa.env === 'mock') {
    if (process.env.NODE_ENV === 'production' && !serverEnv.mpesa.allowMockInProduction) {
      throw new Error('MPESA_ENV=mock is not allowed in production. Configure the KCB credentials.')
    }
    provider = new MockMpesaProvider()
  } else {
    provider = new KcbProvider()
  }
  return provider
}
