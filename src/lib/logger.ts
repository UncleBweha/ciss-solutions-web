// Structured JSON logging for the server. Values under sensitive keys are redacted
// so passwords, PINs, tokens and payment secrets never reach the logs.

const SENSITIVE = /pass(word|key)?|pin|secret|token|authorization|api[_-]?key|service[_-]?role|cookie|credential/i

function redact(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message }
  if (value === null || typeof value !== 'object' || depth > 4) return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1)]),
  )
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, event: string, data?: Record<string, unknown>) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...(redact(data ?? {}) as object) })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => log('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
}

export { redact }
