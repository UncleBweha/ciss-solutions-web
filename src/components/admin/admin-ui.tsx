import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AdminPageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back ? (
          <Link href={back.href} className="mb-1 inline-block text-sm text-fg-muted hover:text-fg">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('rounded-xl border border-border bg-admin-panel', className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  )
}

export function StatCard({ label, value, hint, tone = 'neutral', href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'warning' | 'danger' | 'success'; href?: string }) {
  const accent = { neutral: 'text-fg', warning: 'text-amber-300', danger: 'text-red-300', success: 'text-green-300' }[tone]
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', accent)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </>
  )
  return href ? (
    <Link href={href} className="rounded-xl border border-border bg-admin-panel p-4 transition-colors hover:border-border-strong">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-border bg-admin-panel p-4">{body}</div>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={cn('whitespace-nowrap border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted', className)}>{children}</th>
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('border-b border-border/60 px-3 py-2.5 align-middle', className)}>{children}</td>
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-fg-muted">
        {children}
      </td>
    </tr>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <form className="mb-4 flex flex-wrap items-end gap-2">{children}</form>
}
