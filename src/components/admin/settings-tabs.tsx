'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings sections" className="scrollbar-none mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href ? 'page' : undefined} className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold', pathname === t.href ? 'border-primary-light text-fg' : 'border-transparent text-fg-muted hover:text-fg')}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
