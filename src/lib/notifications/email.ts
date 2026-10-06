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

let smtpProvider: SmtpEmailProvider | undefined

export function getEmailProvider(): EmailProvider {
  const { provider, apiKey, from, smtp } = serverEnv.email
  if (provider === 'resend' && apiKey) return new ResendEmailProvider(apiKey, from)
  if (provider === 'smtp' && smtp.host && smtp.user && smtp.password) {
    // One transport for the life of the server, so connections are reused.
    smtpProvider ??= new SmtpEmailProvider({ host: smtp.host, port: smtp.port, user: smtp.user, password: smtp.password }, from)
    return smtpProvider
  }
  return new LogEmailProvider()
}
