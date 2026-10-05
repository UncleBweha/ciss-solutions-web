import 'server-only'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'

export type EmailMessage = { to: string | string[]; subject: string; html: string; text: string }

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id?: string }>
}

/** Development: write the email to the server log instead of sending it. */
class LogEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    logger.info('email.logged', { to: message.to, subject: message.subject, text: message.text.slice(0, 500) })
    return {}
  }
}

/** Resend (https://resend.com) over HTTPS; swap for another provider by implementing EmailProvider. */
class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly replyTo: string) {}
  async send(message: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, reply_to: this.replyTo, to: message.to, subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`)
    return (await res.json()) as { id?: string }
  }
}

export function getEmailProvider(): EmailProvider {
  const { provider, apiKey, from, orders } = serverEnv.email
  if (provider === 'resend' && apiKey) return new ResendEmailProvider(apiKey, from, orders)
  return new LogEmailProvider()
}
