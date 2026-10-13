'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { moveCategoryAction, quickAddCategoryAction } from '@/actions/admin/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'

/** One field and a button: type a name, press Enter. Slug and position are worked out. */
export function QuickAddCategory({ parentId, label, placeholder }: { parentId: string | null; label: string; placeholder?: string }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const id = `add-category-${parentId ?? 'top'}`

  const add = () =>
    start(async () => {
      const r = await quickAddCategoryAction(name, parentId)
      toast(r.ok ? r.message ?? 'Added' : r.message, r.ok ? 'success' : 'error')
      if (r.ok) {
        setName('')
        router.refresh()
      }
    })

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) add()
      }}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder ?? label} className="h-10" maxLength={80} />
      <Button type="submit" size="sm" className="h-10 shrink-0" loading={pending} disabled={!name.trim()}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add
      </Button>
    </form>
  )
}

/** Up / down arrows to change where a category shows in the shop menu. */
export function MoveCategory({ id, name, first, last }: { id: string; name: string; first: boolean; last: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const move = (direction: 'up' | 'down') =>
    start(async () => {
      const r = await moveCategoryAction(id, direction)
      if (!r.ok) toast(r.message, 'error')
      router.refresh()
    })
  const cls = 'grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-surface hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <span className="inline-flex" aria-busy={pending || undefined}>
      <button type="button" className={cls} disabled={first || pending} onClick={() => move('up')} aria-label={`Move ${name} up`} title="Move up">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={cls} disabled={last || pending} onClick={() => move('down')} aria-label={`Move ${name} down`} title="Move down">
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  )
}
