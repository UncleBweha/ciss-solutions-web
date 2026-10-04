import type { ReactNode } from 'react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12">
      <div className="glass w-full max-w-md rounded-[var(--radius-card)] p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mb-6 mt-1 text-fg-secondary">{subtitle}</p> : <div className="mb-6" />}
        {children}
      </div>
    </div>
  )
}
