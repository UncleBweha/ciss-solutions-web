import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type Role = Database['public']['Enums']['user_role']

export type Permission =
  | 'products.manage'
  | 'inventory.manage'
  | 'catalog.manage'
  | 'orders.manage'
  | 'orders.refund'
  | 'customers.view'
  | 'coupons.manage'
  | 'content.manage'
  | 'reviews.moderate'
  | 'support.manage'
  | 'settings.manage'
  | 'payments.settings'
  | 'reports.view'
  | 'admins.manage'

export type SessionUser = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  role: Role
  permissions: Set<Permission>
}

/** The signed-in user with role and permissions (verified with Supabase Auth). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('full_name, phone, role, email').eq('id', user.id).maybeSingle()
  const role = (profile?.role ?? 'customer') as Role
  let permissions = new Set<Permission>()
  if (role === 'super_admin') {
    permissions = new Set(ALL_PERMISSIONS)
  } else if (role !== 'customer') {
    const { data } = await supabase.from('role_permissions').select('permission').eq('role', role)
    permissions = new Set((data ?? []).map((r) => r.permission as Permission))
  }
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    phone: profile?.phone ?? null,
    role,
    permissions,
  }
})

export const ALL_PERMISSIONS: Permission[] = [
  'products.manage',
  'inventory.manage',
  'catalog.manage',
  'orders.manage',
  'orders.refund',
  'customers.view',
  'coupons.manage',
  'content.manage',
  'reviews.moderate',
  'support.manage',
  'settings.manage',
  'payments.settings',
  'reports.view',
  'admins.manage',
]

export function isStaff(user: SessionUser | null): user is SessionUser {
  return Boolean(user && user.role !== 'customer')
}

export function can(user: SessionUser | null, permission: Permission) {
  return Boolean(user?.permissions.has(permission))
}

export async function requireUser(next = '/account') {
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

/** For admin pages: staff with the given permission, otherwise redirect. */
export async function requireStaff(permission?: Permission) {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/admin')
  if (!isStaff(user)) redirect('/account')
  if (permission && !can(user, permission)) redirect('/admin?denied=1')
  return user
}

export class AuthorizationError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message)
  }
}

/** For server actions: throws instead of redirecting. */
export async function assertPermission(permission: Permission) {
  const user = await getSessionUser()
  if (!user || !can(user, permission)) throw new AuthorizationError()
  return user
}
