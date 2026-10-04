'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, Search, ShoppingCart, User } from 'lucide-react'
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

type MenuKey = 'shop' | 'printers' | 'spare-parts' | 'brands'

function Dropdown({
  label,
  open,
  onOpen,
  onClose,
  children,
  wide,
}: {
  label: string
  open: boolean
  onOpen: () => void
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const panelId = `menu-${label.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn('flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors', open ? 'text-fg' : 'text-fg-secondary hover:text-fg')}
      >
        {label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn('absolute left-0 top-full z-50 pt-2', wide ? 'w-[36rem]' : 'w-64')}
      >
        <div className="animate-fade-up rounded-2xl border border-border bg-background-secondary/98 p-3 shadow-[var(--shadow-lift)] backdrop-blur-xl">{children}</div>
      </div>
    </div>
  )
}

function MenuLink({ href, children, count, onClick }: { href: string; children: React.ReactNode; count?: number; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface hover:text-fg">
      <span>{children}</span>
      {count !== undefined ? <span className="text-xs text-fg-muted">{count}</span> : null}
    </Link>
  )
}

export function Header({ nav }: { nav: NavData }) {
  const { count, bump, signedIn } = useCart()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState<MenuKey | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menus when the route changes (state adjusted during render, per React docs).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenu(null)
    setMobileOpen(false)
    setSearchOpen(false)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const printers = nav.categories.find((c) => c.href === '/c/printers')
  const parts = nav.categories.find((c) => c.href === '/c/spare-parts')
  const close = () => setMenu(null)

  const mobileLinks: [string, string][] = [
    ['Home', '/'],
    ['Shop', '/shop'],
    ['Printers', '/c/printers'],
    ['Spare Parts', '/c/spare-parts'],
    ['Ink & Toner', '/c/ink-toner'],
    ['Scanners', '/c/scanners'],
    ['Paper & Media', '/c/paper-media'],
    ['Accessories', '/c/accessories'],
    ['Brands', '/brands'],
    ['Deals', '/deals'],
    ['Find a Part', '/parts-finder'],
    ['Track Order', '/track-order'],
    ['About', '/about'],
    ['Contact', '/contact'],
    [signedIn ? 'My Account' : 'Sign in', signedIn ? '/account' : '/login'],
  ]

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary-strong focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="ink-stripe h-1" aria-hidden="true" />
      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300',
          scrolled ? 'glass border-x-0 border-t-0 bg-background/70' : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="container-page flex h-[var(--header-height)] items-center gap-3 lg:gap-6">
          <Logo priority />

          <nav ref={navRef} aria-label="Main" className="hidden items-center lg:flex">
            <Link href="/" className={cn('rounded-lg px-3 py-2 text-sm font-semibold', pathname === '/' ? 'text-fg' : 'text-fg-secondary hover:text-fg')}>
              Home
            </Link>
            <Dropdown label="Shop" open={menu === 'shop'} onOpen={() => setMenu('shop')} onClose={close} wide>
              <div className="grid grid-cols-2 gap-1">
                {nav.categories.map((c) => (
                  <MenuLink key={c.href} href={c.href} count={c.count} onClick={close}>
                    {c.name}
                  </MenuLink>
                ))}
                <MenuLink href="/deals" onClick={close}>
                  Deals
                </MenuLink>
                <MenuLink href="/shop" onClick={close}>
                  <span className="font-semibold text-primary-light">All products →</span>
                </MenuLink>
              </div>
            </Dropdown>
            {printers ? (
              <Dropdown label="Printers" open={menu === 'printers'} onOpen={() => setMenu('printers')} onClose={close}>
                {printers.children.map((c) => (
                  <MenuLink key={c.href} href={c.href} count={c.count} onClick={close}>
                    {c.name}
                  </MenuLink>
                ))}
                <MenuLink href={printers.href} onClick={close}>
                  <span className="font-semibold text-primary-light">All printers →</span>
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
                  <span className="font-semibold text-primary-light">Find the right part →</span>
                </MenuLink>
              </Dropdown>
            ) : null}
            <Dropdown label="Brands" open={menu === 'brands'} onOpen={() => setMenu('brands')} onClose={close} wide>
              <div className="grid grid-cols-3 gap-1">
                {nav.brands.map((b) => (
                  <MenuLink key={b.slug} href={`/b/${b.slug}`} onClick={close}>
                    {b.name}
                  </MenuLink>
                ))}
              </div>
            </Dropdown>
            <Link href="/about" className="rounded-lg px-3 py-2 text-sm font-semibold text-fg-secondary hover:text-fg">
              About
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 text-sm font-semibold text-fg-secondary hover:text-fg">
              Contact
            </Link>
          </nav>

          <SearchBar className="ml-auto hidden w-full max-w-sm md:block xl:max-w-md" />

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button type="button" onClick={() => setSearchOpen(true)} className="rounded-xl p-2.5 text-fg-secondary hover:bg-surface hover:text-fg md:hidden" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <Link
              href={signedIn ? '/account' : '/login'}
              className="hidden items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-secondary hover:bg-surface hover:text-fg sm:flex"
            >
              <User className="h-5 w-5" aria-hidden="true" />
              <span className="hidden xl:inline">{signedIn ? 'Account' : 'Sign in'}</span>
            </Link>
            <Link href="/cart" className="relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-secondary hover:bg-surface hover:text-fg" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              <span className="hidden xl:inline">Cart</span>
              {count > 0 ? (
                <span key={bump} className="animate-cart-bump absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary-strong px-1 text-[11px] font-bold text-white xl:static">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Link>
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2.5 text-fg-secondary hover:bg-surface hover:text-fg lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="left">
        <nav aria-label="Mobile">
          <ul className="space-y-1">
            {mobileLinks.map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn('block rounded-xl px-3 py-2.5 font-semibold', pathname === href ? 'bg-surface text-fg' : 'text-fg-secondary hover:bg-surface hover:text-fg')}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>

      <Drawer open={searchOpen} onClose={() => setSearchOpen(false)} title="Search" side="bottom">
        <SearchBar autoFocus onNavigate={() => setSearchOpen(false)} />
        <p className="mt-4 text-sm text-fg-muted">Search by product name, model number (e.g. L3250), part number or brand.</p>
      </Drawer>
    </>
  )
}
