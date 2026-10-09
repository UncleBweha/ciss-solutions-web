'use server'
import { createClient as createBareClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { ActionResult } from '@/lib/admin/action'
import { getSessionUser, isStaff } from '@/lib/auth'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'

const schema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    password: z.string().min(8, 'Use at least 8 characters').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
  .refine((v) => v.password !== v.current, { message: 'Choose a password different from the current one', path: ['password'] })

/** Any staff member changes their own password; the current one is checked first. */
export async function changeOwnPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getSessionUser()
  if (!isStaff(user) || !user.email) return { ok: false, message: 'Please sign in again.' }
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  if (!(await rateLimit(`change-password:${user.id}`, 5, 900))) return { ok: false, message: 'Too many attempts. Please wait 15 minutes.' }

  // Check the current password on a throwaway client so the signed-in session is untouched.
  const check = createBareClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email, password: parsed.data.current })
  if (wrong) return { ok: false, message: 'Your current password is incorrect.' }
  await check.auth.signOut({ scope: 'local' }).catch(() => undefined)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    logger.warn('admin.password_change_failed', { userId: user.id, code: error.code })
    return { ok: false, message: error.code === 'weak_password' ? 'Choose a stronger password.' : 'We could not change your password. Please try again.' }
  }
  logger.info('admin.password_changed', { userId: user.id })
  return { ok: true, message: 'Your password has been changed.' }
}
