import 'server-only'
import { z } from 'zod'
import { assertPermission, AuthorizationError, type Permission, type SessionUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; message: string; errors?: Record<string, string> }

/**
 * Wraps a staff server action: verifies the permission server-side (the database
 * enforces it again through RLS), validates input, and turns failures into a
 * message instead of a crash.
 */
export async function staffAction<T>(permission: Permission, fn: (user: SessionUser) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const user = await assertPermission(permission)
    return await fn(user)
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message }
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      for (const issue of error.issues) errors[issue.path.join('.')] ??= issue.message
      return { ok: false, message: 'Please check the highlighted fields.', errors }
    }
    // Next's redirect()/notFound() work by throwing: let them through.
    if (error && typeof error === 'object' && 'digest' in error && String((error as { digest: unknown }).digest).startsWith('NEXT_')) throw error
    logger.error('admin.action_failed', { permission, error })
    return { ok: false, message: (error as Error).message?.slice(0, 300) || 'Something went wrong.' }
  }
}

/** Maps Postgres/PostgREST errors to readable admin messages. */
export function dbError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null
  if (error.code === '23505') {
    if (error.message.includes('slug')) return 'That slug is already used. Choose another.'
    if (error.message.includes('sku')) return 'That SKU is already used by another product.'
    if (error.message.includes('code')) return 'That code already exists.'
    return 'A record with the same unique value already exists.'
  }
  if (error.code === '23503') return 'This record is still referenced elsewhere (e.g. by products or orders).'
  if (error.code === '42501') return 'You do not have permission to do that.'
  return error.message
}
