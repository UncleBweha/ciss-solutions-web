'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Heart, Home, LayoutGrid, Tag, User } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { Avatar, firstName } from '@/components/ui/avatar'
import { Drawer } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { NavCategory } from './header'

const item = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors'

/** Thumb-reach navigation for phones and tablets; the desktop header covers the same links. */
export function BottomNav({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname()
  const { signedIn, wishlist, account } = useCart()
  const [open, setOpen] = useState(false)

  // Close the category sheet when the route changes (state adjusted during render).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setOpen(false)
  }

  const inCategories = pathname.startsWith('/c/') || pathname === '/shop'
  const links = [
    { label: 'Home', href: '/', icon: Home, active: pathname === '/' },
    { label: 'Deals', href: '/deals', icon: Tag, active: pathname.startsWith('/deals') },
    { label: 'Wishlist', href: signedIn ? '/account/wishlist' : '/login?next=/account/wishlist', icon: Heart, active: pathname.startsWith('/account/wishlist'), badge: wishlist.size },
    {
      label: signedIn ? (firstName(account?.name) ?? 'Profile') : 'Sign in',
      href: signedIn ? '/account' : '/login',
      icon: User,
      avatar: signedIn,
      active: (pathname.startsWith('/account') && !pathname.startsWith('/account/wishlist')) || pathname === '/login' || pathname === '/register',
    },
  ]
  const tone = (active: boolean) => (active ? 'text-primary-light' : 'text-fg-secondary hover:text-fg')

  const link = ({ label, href, icon: Icon, active, badge, avatar }: { label: string; href: string; icon: typeof User; active: boolean; badge?: number; avatar?: boolean }) => (
    <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn(item, tone(active))}>
      <span className="relative">
        {avatar ? <Avatar src={account?.avatarUrl} name={account?.name} className="h-5 w-5" /> : <Icon className="h-5 w-5" aria-hidden="true" />}
        {badge ? (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink-magenta px-1 text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>
        ) : null}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  )

  return (
    <>
      <nav
        aria-label="Quick links"
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.07] bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md backdrop-saturate-150 lg:hidden"
      >
        <div className="mx-auto flex h-[var(--bottom-nav-height)] max-w-2xl items-stretch px-1">
          {link(links[0])}
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={cn(item, tone(inCategories || open))}>
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">Categories</span>
          </button>
          {links.slice(1).map(link)}
        </div>
      </nav>

      <Drawer open={open} onClose={() => setOpen(false)} title="Categories" side="bottom">
        <nav aria-label="Categories">
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.href} className="py-3">
                <Link href={c.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 font-semibold text-fg">
                  {c.name}
                  <span className="font-mono text-xs font-normal text-fg-muted">{c.count}</span>
                </Link>
                {c.children.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setOpen(false)}
                        className="rounded-full border border-border-strong bg-white/60 px-3 py-1 text-sm text-fg-secondary"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
            <li className="py-3">
              <Link href="/shop" onClick={() => setOpen(false)} className="font-semibold text-primary-light">
                All products
              </Link>
            </li>
          </ul>
        </nav>
      </Drawer>
    </>
  )
}
