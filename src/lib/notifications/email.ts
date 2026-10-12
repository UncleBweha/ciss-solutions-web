import 'server-only'
import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/lib/server-env'

export type EmailMessage = { to: string | string[]; subject: string; html: string; text: string; from?: string }

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id?: string }>
}

/** Development: write the email to the server log instead of sending it. */
class LogEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    logger.info('email.logged', { to: message.to, from: message.from, subject: message.subject, text: message.text.slice(0, 500) })
    return {}
  }
}

/** Resend (https://resend.com) over HTTPS; swap for another provider by implementing EmailProvider. */
class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(message: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: message.from ?? this.from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`)
    return (await res.json()) as { id?: string }
  }
}

/** Sends through a mailbox over SMTP. Port 465 uses TLS from the start; 587 upgrades with STARTTLS. */
class SmtpEmailProvider implements EmailProvider {
  private readonly transport
  constructor(smtp: { host: string; port: number; user: string; password: string }, private readonly from: string) {
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      // Greet the mail server with the shop's domain. The default is the container's random
      // hostname, which spam filters count against the message.
      name: from.match(/@([^>\s]+)/)?.[1],
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: 15_000,
      socketTimeout: 20_000,
    })
  }
  async send(message: EmailMessage) {
    const info = await this.transport.sendMail({ from: message.from ?? this.from, to: message.to, subject: message.subject, html: message.html, text: message.text })
    return { id: info.messageId }
  }
}

/**
 * A real provider was chosen but its settings are incomplete. Every send fails, so the
 * email is recorded as failed and retried; writing it to the log instead would record
 * it as sent when nothing went out.
 */
class UnconfiguredEmailProvider implements EmailProvider {
  constructor(private readonly missing: string) {}
  async send(): Promise<never> {
    throw new Error(`Email is not configured: missing ${this.missing}`)
  }
}

let smtpProvider: SmtpEmailProvider | undefined

export function getEmailProvider(): EmailProvider {
  const { provider, apiKey, from, smtp } = serverEnv.email
  if (provider === 'resend') return apiKey ? new ResendEmailProvider(apiKey, from) : new UnconfiguredEmailProvider('EMAIL_API_KEY')
  if (provider === 'smtp') {
    const missing = [!smtp.host && 'SMTP_HOST', !smtp.user && 'SMTP_USER', !smtp.password && 'SMTP_PASSWORD'].filter(Boolean)
    if (!smtp.host || !smtp.user || !smtp.password) return new UnconfiguredEmailProvider(missing.join(', '))
    // One transport for the life of the server.
    smtpProvider ??= new SmtpEmailProvider({ host: smtp.host, port: smtp.port, user: smtp.user, password: smtp.password }, from)
    return smtpProvider
  }
  return new LogEmailProvider()
}
