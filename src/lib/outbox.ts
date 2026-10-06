import 'server-only'
import { logger } from '@/lib/logger'
import { notifyOrderPlaced, notifyOrderStatus, notifyPaymentConfirmed } from '@/lib/notifications'
import { initiateMpesaPayment } from '@/lib/payments/service'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderStatus } from '@/lib/ecommerce/orders'
import type { Database } from '@/types/database'

// Transactional outbox worker (see supabase/migrations/20261006000100_outbox.sql).
// Tasks are committed together with the change that caused them, then run here:
// straight away by the request that created them, and by the cron sweep for
// anything left behind (crash, deploy, provider outage). Handlers must be safe to
// repeat: emails are de-duplicated per order, the STK push checks for earlier attempts.

type Task = Database['public']['Tables']['outbox']['Row']
export type OutboxKind = 'order_placed' | 'mpesa_stk_push' | 'payment_confirmed' | 'order_status'

export type TaskResult = {
  id: string
  kind: string
  orderId: string | null
  outcome: 'done' | 'retry' | 'dead'
  /** For the STK push: the message to show the customer. */
  message?: string
}

/** An STK push sent minutes late would surprise the customer; they can retry from the order page. */
const STK_MAX_AGE_MS = 10 * 60_000

async function handle(task: Task): Promise<{ note?: string; message?: string }> {
  if (!task.order_id) return { note: 'no order' }
  switch (task.kind as OutboxKind) {
    case 'order_placed':
      await notifyOrderPlaced(task.order_id)
      return {}
    case 'payment_confirmed':
      await notifyPaymentConfirmed(task.order_id)
      return {}
    case 'order_status': {
      const status = (task.payload as { status?: OrderStatus }).status
      if (status) await notifyOrderStatus(task.order_id, status)
      return {}
    }
    case 'mpesa_stk_push':
      return sendStkPush(task)
    default:
      return { note: `unknown kind ${task.kind}` }
  }
}

async function sendStkPush(task: Task): Promise<{ note?: string; message?: string }> {
  const db = createAdminClient()
  const orderId = task.order_id!
  // Any earlier attempt (sent, failed or paid) means this task already ran or the
  // customer retried themselves: never send a second prompt from here.
  const { count } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
  if (count) return { note: 'skipped: payment already attempted' }
  if (Date.now() - new Date(task.created_at).getTime() > STK_MAX_AGE_MS) return { note: 'skipped: too late to prompt' }

  const phone = (task.payload as { phone?: string }).phone
  if (!phone) return { note: 'skipped: no phone' }
  // Business outcomes (expired order, provider declined) come back as ok:false and are
  // final; only unexpected errors (e.g. database unavailable) throw and get retried.
  const result = await initiateMpesaPayment(orderId, phone)
  return { note: result.ok ? 'sent' : `not sent: ${result.message}`, message: result.message }
}

/**
 * Claims due tasks (optionally one order's, optionally some kinds) and runs them.
 * Failures are rescheduled with back-off by fail_outbox(); after the last attempt the
 * task is marked dead and staff get an admin notification.
 */
export async function runOutbox(opts: { orderId?: string; kinds?: OutboxKind[]; limit?: number } = {}): Promise<TaskResult[]> {
  const db = createAdminClient()
  const { data: tasks, error } = await db.rpc('claim_outbox', {
    p_limit: opts.limit ?? 20,
    p_order_id: opts.orderId ?? (null as unknown as string),
    p_kinds: opts.kinds ?? (null as unknown as string[]),
  })
  if (error) throw new Error(`claim_outbox: ${error.message}`)

  const results: TaskResult[] = []
  for (const task of tasks ?? []) {
    try {
      const { note, message } = await handle(task)
      await db.rpc('complete_outbox', { p_id: task.id, p_note: note ?? (null as unknown as string) })
      results.push({ id: task.id, kind: task.kind, orderId: task.order_id, outcome: 'done', message })
    } catch (e) {
      const reason = (e as Error).message ?? String(e)
      const { data: outcome } = await db.rpc('fail_outbox', { p_id: task.id, p_error: reason })
      const final = outcome === 'dead' ? 'dead' : 'retry'
      logger[final === 'dead' ? 'error' : 'warn']('outbox.task_failed', { taskId: task.id, kind: task.kind, attempt: task.attempts, outcome: final, error: e })
      results.push({ id: task.id, kind: task.kind, orderId: task.order_id, outcome: final })
    }
  }
  return results
}
