'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, Menu, MessageCircle, Phone, ShoppingCart, Truck, User } from 'lucide-react'
import { useCart } from '@/components/cart/cart-provider'
import { Drawer } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import { SearchBar } from './search-bar'

export type NavCategory = { name: string; href: string; count: number; children: { name: string; href: string; count: number }[] }
export type NavData = {
  categories: NavCategory[]
  brands: { name: string; slug: string }[]
}
export type HeaderContact = { phone: string; whatsappHref: string | null; location: string; hours: string }

type MenuKey = 'all' | 'printers' | 'spare-parts' | 'brands'

function Dropdown({
  label,
  open,
  onOpen,
  onClose,
  children,
  wide,
  className,
}: {
  label: React.ReactNode
  open: boolean
  onOpen: () => void
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  className?: string
}) {
  const panelId = `menu-${String(typeof label === 'string' ? label : 'all').toLowerCase().replace(/\W+/g, '-')}`
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn('flex h-11 items-center gap-1 whitespace-nowrap px-3 text-sm font-semibold transition-colors', open ? 'text-primary-light' : 'text-fg hover:text-primary-light', className)}
      >
        {label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open} className={cn('absolute left-0 top-full z-50', wide ? 'w-[40rem]' : 'w-64')}>
        <div className="rounded-b-md border border-border bg-white p-2 shadow-[var(--shadow-lift)]">{children}</div>
      </div>
    </div>
  )
}

function MenuLink({ href, children, count, onClick }: { href: string; children: React.ReactNode; count?: number; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center justify-between gap-3 rounded px-3 py-2 text-sm text-fg-secondary hover:bg-surface hover:text-fg">
      <span>{children}</span>
      {count !== undefined ? <span className="font-mono text-xs text-fg-muted">{count}</span> : null}
    </Link>
  )
}

export function Header({ nav, contact }: { nav: NavData; contact: HeaderContact }) {
  const { count, bump, signedIn } = useCart()
  const pathname = usePathname()
  const [menu, setMenu] = useState<MenuKey | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close menus when the route changes (state adjusted during render, per React docs).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenu(null)
    setMobileOpen(false)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const printers = nav.categories.find((c) => c.href === '/c/printers')
  const parts = nav.categories.find((c) => c.href === '/c/spare-parts')
  const others = nav.categories.filter((c) => c !== printers && c !== parts)
  const close = () => setMenu(null)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const mobileLinks: [string, string][] = [
    ...nav.categories.map((c): [string, string] => [c.name, c.href]),
    ['Brands', '/brands'],
    ['Deals', '/deals'],
    ['Find a part', '/parts-finder'],
    ['Track order', '/track-order'],
    ['About', '/about'],
    ['Contact', '/contact'],
    [signedIn ? 'My account' : 'Sign in', signedIn ? '/account' : '/login'],
  ]

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-primary-strong focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {/* Info bar: who we are and how to reach us. Scrolls away. */}
      <div className="hidden border-b border-border bg-surface text-xs text-fg-secondary md:block">
        <div className="container-page flex h-9 items-center gap-5">
          <span>{[contact.location, contact.hours].filter(Boolean).join(' · ')}</span>
          <span className="ml-auto flex items-center gap-5">
            {contact.phone ? (
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-fg">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {contact.phone}
              </a>
            ) : null}
            {contact.whatsappHref ? (
              <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-fg">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp us
              </a>
            ) : null}
            <Link href="/track-order" className="flex items-center gap-1.5 hover:text-fg">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Track order
            </Link>
            <Link href="/contact" className="hover:text-fg">
              Help
            </Link>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 md:h-[var(--header-height)] md:flex-nowrap md:gap-6 md:py-0">
          <button type="button" onClick={() => setMobileOpen(true)} className="-ml-2 rounded p-2 text-fg lg:hidden" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <Logo priority />

          <SearchBar className="order-last w-full md:order-none md:max-w-3xl md:flex-1" />

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={signedIn ? '/account' : '/login'}
              className="flex items-center gap-2 whitespace-nowrap rounded px-2 py-2 text-sm text-fg hover:text-primary-light"
            >
              <User className="h-6 w-6" aria-hidden="true" />
              <span className="hidden leading-tight xl:block">
                <span className="block text-xs text-fg-muted">{signedIn ? 'My' : 'Hello,'}</span>
                <span className="block font-semibold">{signedIn ? 'Account' : 'Sign in'}</span>
              </span>
              <span className="sr-only xl:hidden">{signedIn ? 'Account' : 'Sign in'}</span>
            </Link>
            <Link
              href="/cart"
              className="relative flex items-center gap-2 rounded px-2 py-2 text-sm font-semibold text-fg hover:text-primary-light"
              aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
            >
              <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              <span className="hidden xl:inline">Cart</span>
              {count > 0 ? (
                <span key={bump} className="animate-cart-bump absolute left-6 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink-magenta px-1 text-[11px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {/* Mobile: scrollable category shortcuts */}
        <nav aria-label="Categories" className="scrollbar-none flex gap-2 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
          {[...nav.categories.map((c): [string, string] => [c.name, c.href]), ['Deals', '/deals'] as [string, string], ['Find a part', '/parts-finder'] as [string, string]].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm',
                isActive(href) ? 'border-primary bg-primary/5 text-primary-light' : 'border-border-strong text-fg-secondary',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Category bar */}
        <nav aria-label="Main" className="hidden border-t border-border lg:block">
          <div className="container-page flex items-center">
            <Dropdown label="All categories" open={menu === 'all'} onOpen={() => setMenu('all')} onClose={close} wide className="-ml-3">
              <div className="grid grid-cols-2 gap-1">
                {nav.categories.map((c) => (
                  <MenuLink key={c.href} href={c.href} count={c.count} onClick={close}>
                    {c.name}
                  </MenuLink>
                ))}
                <MenuLink href="/shop" onClick={close}>
                  <span className="font-semibold text-primary-light">All products</span>
                </MenuLink>
              </div>
            </Dropdown>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
            {printers ? (
              <Dropdown label="Printers" open={menu === 'printers'} onOpen={() => setMenu('printers')} onClose={close}>
                {printers.children.map((c) => (
                  <MenuLink key={c.href} href={c.href} count={c.count} onClick={close}>
                    {c.name}
                  </MenuLink>
                ))}
                <MenuLink href={printers.href} onClick={close}>
                  <span className="font-semibold text-primary-light">All printers</span>
                </MenuLink>
              </Dropdown>
            ) : null}
            {parts ? (
              <Dropdown label="Spare Parts" open={menu === 'spare-parts'} onOpen={() => setMenu('spare-parts')} onClose={close}>
                {parts.children.map((c) => (
                  <MenuLink key={c.href} href={c.href} count={c.count} onClick={close}>
                    {c.name}
                  </MenuLink>
                ))}
                <MenuLink href="/parts-finder" onClick={close}>
                  <span className="font-semibold text-primary-light">Find the right part</span>
                </MenuLink>
              </Dropdown>
            ) : null}
            {others.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={cn('flex h-11 items-center whitespace-nowrap px-3 text-sm font-semibold hover:text-primary-light', isActive(c.href) ? 'text-primary-light' : 'text-fg')}
              >
                {c.name}
              </Link>
            ))}
            <Dropdown label="Brands" open={menu === 'brands'} onOpen={() => setMenu('brands')} onClose={close} wide>
              <div className="grid grid-cols-3 gap-1">
                {nav.brands.map((b) => (
                  <MenuLink key={b.slug} href={`/b/${b.slug}`} onClick={close}>
                    {b.name}
                  </MenuLink>
                ))}
                <MenuLink href="/brands" onClick={close}>
                  <span className="font-semibold text-primary-light">All brands</span>
                </MenuLink>
              </div>
            </Dropdown>
            <Link href="/deals" className="flex h-11 items-center px-3 text-sm font-semibold text-danger hover:underline">
              Deals
            </Link>
            <Link href="/parts-finder" className="ml-auto flex h-11 items-center gap-2 whitespace-nowrap pl-3 text-sm font-semibold text-primary-light hover:underline">
              <span className="reg-mark" aria-hidden="true" /> Find parts for your printer
            </Link>
          </div>
        </nav>
      </header>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="left">
        <nav aria-label="Mobile">
          <ul className="divide-y divide-border">
            {mobileLinks.map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn('block px-1 py-3 font-semibold', isActive(href) ? 'text-primary-light' : 'text-fg')}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          {contact.phone || contact.whatsappHref ? (
            <div className="mt-6 space-y-2 text-sm text-fg-secondary">
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2">
                  <Phone className="h-4 w-4" aria-hidden="true" /> {contact.phone}
                </a>
              ) : null}
              {contact.whatsappHref ? (
                <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp us
                </a>
              ) : null}
            </div>
          ) : null}
        </nav>
      </Drawer>
    </>
  )
}
