'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowDown, ArrowUp, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { ActionResult } from '@/lib/admin/action'

/** Runs a bound server action and refreshes (for small inline buttons). */
export function ActionButton({ action, children, variant = 'glass', className, label }: { action: () => Promise<ActionResult<unknown>>; children: React.ReactNode; variant?: 'glass' | 'primary' | 'danger' | 'ghost' | 'success'; className?: string; label?: string }) {
  const [pending, start] = useTransition()
  const toast = useToast()
  const router = useRouter()
  return (
    <Button size="sm" variant={variant} className={className} aria-label={label} loading={pending} onClick={() => start(async () => {
      const r = await action()
      if (!r.ok) toast(r.message, 'error')
      else if (r.message) toast(r.message)
      router.refresh()
    })}>
      {children}
    </Button>
  )
}

export function MoveButtons({ up, down, first, last }: { up: () => Promise<ActionResult>; down: () => Promise<ActionResult>; first: boolean; last: boolean }) {
  return (
    <span className="inline-flex">
      {!first ? <ActionButton action={up} variant="ghost" label="Move up"><ArrowUp className="h-4 w-4" /></ActionButton> : null}
      {!last ? <ActionButton action={down} variant="ghost" label="Move down"><ArrowDown className="h-4 w-4" /></ActionButton> : null}
    </span>
  )
}

export function AttachmentLink({ action }: { action: () => Promise<ActionResult<{ url: string }>> }) {
  const [pending, start] = useTransition()
  const toast = useToast()
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => start(async () => {
      const r = await action()
      if (r.ok && r.data) window.open(r.data.url, '_blank', 'noopener')
      else toast(r.ok ? 'Unavailable' : r.message, 'error')
    })}>
      <Paperclip className="h-4 w-4" aria-hidden="true" /> View attachment
    </Button>
  )
}
