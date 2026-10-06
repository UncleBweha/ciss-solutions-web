'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Tab bar for admin pages that share one sidebar entry (Settings, Catalog, Products…).
 * Shown only on the tab pages themselves, not on pages nested below them (e.g. editing a product).
 */
export function AdminTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname()
  if (tabs.length < 2 || !tabs.some((t) => t.href === pathname)) return null
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold',
            pathname === t.href ? 'border-primary-light text-fg' : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
