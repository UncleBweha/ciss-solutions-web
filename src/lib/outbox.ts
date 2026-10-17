import 'server-only'
import { logger } from '@/lib/logger'
import { notifyOrderPlaced, notifyOrderStatus, notifyPaymentConfirmed } from '@/lib/notifications'
import { registerPosSale, voidPosSale } from '@/lib/pos/service'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderStatus } from '@/lib/ecommerce/orders'
import type { Database } from '@/types/database'

// Transactional outbox worker (see supabase/migrations/20261006000300_outbox.sql).
// Tasks are committed together with the change that caused them, then run here:
// straight away by the request that created them, and by the cron sweep for
// anything left behind (crash, deploy, provider outage). Handlers must be safe to
// repeat: emails are de-duplicated per order, the POS keeps one sale per order number.

type Task = Database['public']['Tables']['outbox']['Row']
export type OutboxKind = 'order_placed' | 'payment_confirmed' | 'order_status' | 'pos_sale' | 'pos_void'

export type TaskResult = {
  id: string
  kind: string
  orderId: string | null
  outcome: 'done' | 'retry' | 'dead'
}

async function handle(task: Task): Promise<{ note?: string }> {
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
    case 'pos_sale':
      return { note: await registerPosSale(task.order_id) }
    case 'pos_void':
      return { note: await voidPosSale(task.order_id) }
    default:
      // Queued by a newer database than this code knows: retry (and alert staff if it never
      // succeeds) rather than marking work done that nobody did.
      throw new Error(`unknown outbox kind ${task.kind}`)
  }
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
      const { note } = await handle(task)
      // The work is done either way; if this is not saved the task runs again when its lock
      // expires, which the handlers tolerate.
      const { error: doneError } = await db.rpc('complete_outbox', { p_id: task.id, p_note: note ?? (null as unknown as string) })
      if (doneError) logger.error('outbox.complete_not_saved', { taskId: task.id, kind: task.kind, error: doneError.message })
      results.push({ id: task.id, kind: task.kind, orderId: task.order_id, outcome: 'done' })
    } catch (e) {
      const reason = (e as Error).message ?? String(e)
      const { data: outcome, error: failError } = await db.rpc('fail_outbox', { p_id: task.id, p_error: reason })
      if (failError) logger.error('outbox.fail_not_saved', { taskId: task.id, kind: task.kind, error: failError.message })
      const final = outcome === 'dead' ? 'dead' : 'retry'
      logger[final === 'dead' ? 'error' : 'warn']('outbox.task_failed', { taskId: task.id, kind: task.kind, attempt: task.attempts, outcome: final, error: e })
      results.push({ id: task.id, kind: task.kind, orderId: task.order_id, outcome: final })
    }
  }
  return results
}

/**
 * Runs one order's task of the given kind now. If there is no task to run (the database
 * migration hasn't been applied yet, or the cron sweep already took it), runs `direct`
 * instead, so deploying the code before or after the migration both work.
 */
export async function runTaskNow(
  orderId: string,
  kind: OutboxKind,
  direct: () => Promise<void>,
): Promise<TaskResult> {
  try {
    const [result] = await runOutbox({ orderId, kinds: [kind] })
    if (result) return result
  } catch (error) {
    logger.warn('outbox.unavailable', { kind, error })
  }
  await direct()
  return { id: 'direct', kind, orderId, outcome: 'done' }
}
