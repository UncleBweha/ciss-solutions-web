'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, LayoutDashboard, LogOut, MapPin, Package, Shield, User } from 'lucide-react'
import { signOutAction } from '@/actions/auth'
import { cn } from '@/lib/utils'

const links = [
  { href: '/account', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/addresses', label: 'Saved addresses', icon: MapPin },
  { href: '/account/profile', label: 'Profile & password', icon: User },
]

export function AccountNav({ name, staff }: { name: string; staff: boolean }) {
  const pathname = usePathname()
  return (
    <aside className="glass-flat h-fit rounded-[var(--radius-card)] p-4 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
      <p className="px-3 pb-3 text-sm text-fg-muted">
        Signed in as <span className="block truncate font-semibold text-fg">{name}</span>
      </p>
      <nav aria-label="Account" className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold',
              pathname === href ? 'bg-primary/15 text-fg' : 'text-fg-secondary hover:bg-surface hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
        {staff ? (
          <Link href="/admin" className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary-light hover:bg-surface">
            <Shield className="h-4 w-4" aria-hidden="true" /> Admin dashboard
          </Link>
        ) : null}
      </nav>
      <form action={signOutAction} className="mt-1 border-t border-border pt-1 lg:mt-2 lg:pt-2">
        <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-secondary hover:bg-surface hover:text-fg">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </form>
    </aside>
  )
}
