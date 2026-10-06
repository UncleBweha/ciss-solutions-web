'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Bell, ClipboardList, ExternalLink, FolderTree, LayoutDashboard, LifeBuoy, LogOut, Menu, Package, Settings, Users, X } from 'lucide-react'
import { signOutAction } from '@/actions/auth'
import { cn } from '@/lib/utils'

export type AdminNavItem = {
  href: string
  label: string
  icon: keyof typeof icons
  badge?: number
  /** Other paths that belong to this entry (pages shown as tabs inside it). */
  match?: string[]
}

const icons = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  products: Package,
  categories: FolderTree,
  customers: Users,
  support: LifeBuoy,
  settings: Settings,
}

function SignOutButton({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={cn('flex items-center gap-3 rounded-lg text-sm font-medium text-fg-secondary transition-colors hover:bg-surface hover:text-fg', className)}>
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={compact ? 'sr-only' : undefined}>Log out</span>
      </button>
    </form>
  )
}

export function AdminShell({ nav, user, unread, children }: { nav: AdminNavItem[]; user: { name: string; role: string }; unread: number; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const isActive = (item: AdminNavItem) => (item.href === '/admin' ? pathname === '/admin' : under(item.href)) || Boolean(item.match?.some(under))
  const role = user.role.replace(/_/g, ' ')

  const navList = (
    <nav aria-label="Admin" className="space-y-0.5">
      {nav.map((item) => {
        const Icon = icons[item.icon]
        const active = isActive(item)
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors lg:min-h-0 lg:text-sm',
              active ? 'bg-primary/15 text-fg' : 'text-fg-secondary hover:bg-surface hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-primary-strong px-1.5 text-xs font-bold text-white">{item.badge}</span> : null}
          </Link>
        )
      })}
    </nav>
  )

  // Who is signed in, and the way out. Sits under the menu on every screen size.
  const account = (
    <div className="mt-3 border-t border-border pt-3">
      <Link href="/account/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface">
        <span className="block truncate text-sm font-semibold text-fg">{user.name}</span>
        <span className="block truncate text-xs capitalize text-fg-muted">{role}</span>
      </Link>
      <SignOutButton className="min-h-11 w-full px-3 py-2 lg:min-h-0" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-admin-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-white/80 bg-white/60 p-3 backdrop-blur-md lg:flex">
        <Link href="/admin" className="mb-4 flex items-center gap-2 px-3 py-2">
          <span className="ink-stripe h-6 w-1.5 rounded-full" aria-hidden="true" />
          <span className="font-display text-lg font-bold">CISS Admin</span>
        </Link>
        <div className="flex-1 overflow-y-auto">{navList}</div>
        {account}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between pl-3">
              <span className="font-display text-lg font-bold">CISS Admin</span>
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-surface" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navList}</div>
            {account}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/70 bg-white/80 px-2 backdrop-blur-md sm:px-6">
          <button onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-surface lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/admin" className="min-w-0 truncate font-display text-base font-bold lg:hidden">
            CISS Admin
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/" target="_blank" className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-fg-secondary hover:bg-surface hover:text-fg lg:h-9" aria-label="View store">
              <span className="hidden sm:inline">View store</span> <ExternalLink className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            </Link>
            <Link href="/admin/notifications" className="relative grid h-11 w-11 place-items-center rounded-lg text-fg-secondary hover:bg-surface hover:text-fg lg:h-9 lg:w-9" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-5 w-5" />
              {unread ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white">{unread > 99 ? '99+' : unread}</span> : null}
            </Link>
            <SignOutButton compact className="h-11 w-11 justify-center lg:hidden" />
            <SignOutButton className="hidden h-9 px-3 lg:flex" />
          </div>
        </header>
        <main id="main" className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
