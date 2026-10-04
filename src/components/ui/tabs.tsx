'use client'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TabItem = { id: string; label: string; content: ReactNode }

/** WAI-ARIA tabs with arrow-key navigation. */
export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id)
  const base = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(e: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    if (e.key in keys) {
      e.preventDefault()
      const next = (index + keys[e.key] + items.length) % items.length
      setActive(items[next].id)
      refs.current[next]?.focus()
    }
  }

  return (
    <div className={className}>
      <div role="tablist" aria-orientation="horizontal" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-border">
        {items.map((item, i) => {
          const selected = item.id === active
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              role="tab"
              type="button"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
                selected ? 'border-primary-light text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="pt-6 focus-visible:outline-none"
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}
