import 'server-only'
import { logger } from '@/lib/logger'
import { clientIp } from '@/lib/security'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionUser } from '@/lib/auth'

/** Records a sensitive staff action (who, what, before/after, IP). Never throws. */
export async function audit(
  actor: SessionUser,
  action: string,
  resource: string,
  resourceId: string | null,
  change: { before?: unknown; after?: unknown } = {},
) {
  try {
    await createAdminClient()
      .from('audit_logs')
      .insert({
        actor_id: actor.id,
        actor_email: actor.email,
        action,
        resource,
        resource_id: resourceId,
        before: (change.before ?? null) as never,
        after: (change.after ?? null) as never,
        ip: await clientIp(),
      })
  } catch (error) {
    logger.error('audit.write_failed', { action, resource, error })
  }
  logger.info('admin.action', { actor: actor.email, action, resource, resourceId })
}
