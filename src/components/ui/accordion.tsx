import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Native <details>-based accordion: accessible and works without JavaScript. */
export function Accordion({ items, className }: { items: { id: string; title: string; content: ReactNode; open?: boolean }[]; className?: string }) {
  return (
    <div className={cn('divide-y divide-border rounded-[var(--radius-card)] border border-border', className)}>
      {items.map((item) => (
        <details key={item.id} open={item.open} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown className="h-5 w-5 text-fg-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-5">{item.content}</div>
        </details>
      ))}
    </div>
  )
}
