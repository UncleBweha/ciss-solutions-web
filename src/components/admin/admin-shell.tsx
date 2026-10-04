'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3, Bell, Boxes, ClipboardList, ExternalLink, FolderTree, Home, LayoutDashboard, LifeBuoy, Menu, MessageSquareText, Package,
  Printer, Settings, Tag, TicketPercent, Users, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminNavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number }

const icons = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  products: Package,
  inventory: Boxes,
  categories: FolderTree,
  brands: Tag,
  printers: Printer,
  customers: Users,
  coupons: TicketPercent,
  homepage: Home,
  reviews: MessageSquareText,
  support: LifeBuoy,
  reports: BarChart3,
  settings: Settings,
}

export function AdminShell({ nav, user, unread, children }: { nav: AdminNavItem[]; user: { name: string; role: string }; unread: number; children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href))

  const navList = (
    <nav aria-label="Admin" className="space-y-0.5">
      {nav.map((item) => {
        const Icon = icons[item.icon]
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href) ? 'bg-primary/15 text-fg' : 'text-fg-secondary hover:bg-surface hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{item.badge}</span> : null}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-admin-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-admin-panel p-3 lg:flex">
        <Link href="/admin" className="mb-4 flex items-center gap-2 px-3 py-2">
          <span className="ink-stripe h-6 w-1.5 rounded-full" aria-hidden="true" />
          <span className="font-display text-lg font-extrabold">CISS Admin</span>
        </Link>
        <div className="flex-1 overflow-y-auto">{navList}</div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-admin-panel p-3">
            <button onClick={() => setOpen(false)} className="mb-3 ml-auto block rounded-lg p-2 hover:bg-surface" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {navList}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-admin-bg/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-surface lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-fg-secondary hover:bg-surface hover:text-fg sm:flex">
              View store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link href="/admin/notifications" className="relative rounded-lg p-2 text-fg-secondary hover:bg-surface hover:text-fg" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-5 w-5" />
              {unread ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span> : null}
            </Link>
            <Link href="/account" className="rounded-lg px-3 py-1.5 text-right text-xs hover:bg-surface">
              <span className="block font-semibold text-fg">{user.name}</span>
              <span className="text-fg-muted">{user.role.replace(/_/g, ' ')}</span>
            </Link>
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
