'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { updateOrderNotesAction, updateOrderStatusAction } from '@/actions/admin/orders'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/form'
import { useToast } from '@/components/ui/toast'
import type { OrderStatus } from '@/lib/ecommerce/orders'

const labels: Partial<Record<OrderStatus, string>> = {
  PAID: 'Mark Paid',
  PROCESSING: 'Mark Processing',
  READY_FOR_DISPATCH: 'Mark Ready',
  SHIPPED: 'Mark Shipped',
  DELIVERED: 'Mark Delivered',
  CANCELLED: 'Cancel',
  REFUNDED: 'Refund',
  FAILED: 'Mark Failed',
}
const destructive: OrderStatus[] = ['CANCELLED', 'REFUNDED', 'FAILED']

export function OrderStatusActions({ orderId, allowed }: { orderId: string; allowed: OrderStatus[] }) {
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState<OrderStatus | null>(null)
  const [note, setNote] = useState('')
  const toast = useToast()
  const router = useRouter()

  const run = (status: OrderStatus, n?: string) =>
    start(async () => {
      const result = await updateOrderStatusAction(orderId, status, n)
      toast(result.ok ? result.message ?? 'Updated' : result.message, result.ok ? 'success' : 'error')
      setConfirm(null)
      setNote('')
      router.refresh()
    })

  if (!allowed.length) return <p className="text-sm text-fg-muted">No further status changes are available.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((s) => (
        <Button key={s} size="sm" variant={destructive.includes(s) ? 'danger' : 'primary'} disabled={pending} onClick={() => (destructive.includes(s) || s === 'PAID' ? setConfirm(s) : run(s))}>
          {labels[s] ?? s}
        </Button>
      ))}
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={`${confirm ? labels[confirm] : ''} this order?`}>
        <p className="mb-3 text-sm text-fg-secondary">
          {confirm === 'CANCELLED'
            ? 'Reserved or sold stock is returned to inventory. If the customer paid, arrange the refund and then mark it refunded.'
            : confirm === 'REFUNDED'
              ? 'Records the refund. Make sure the money has been returned to the customer.'
              : confirm === 'PAID'
                ? 'Only confirm after you have verified the bank transfer or cash was received.'
                : 'This cannot be undone.'}
        </p>
        <label htmlFor="status-note" className="mb-1 block text-sm text-fg-secondary">
          Note (shown in order history)
        </label>
        <Input id="status-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={confirm === 'PAID' ? 'e.g. Bank ref 12345' : 'Reason'} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Back</Button>
          <Button variant={confirm && destructive.includes(confirm) ? 'danger' : 'primary'} loading={pending} onClick={() => confirm && run(confirm, note)}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export function OrderNotes({ orderId, initial }: { orderId: string; initial: string }) {
  const [value, setValue] = useState(initial)
  const [pending, start] = useTransition()
  const toast = useToast()
  return (
    <div className="space-y-2">
      <label htmlFor="admin-notes" className="sr-only">Internal notes</label>
      <Textarea id="admin-notes" rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Internal notes (not shown to the customer)" />
      <Button size="sm" variant="glass" loading={pending} onClick={() => start(async () => {
        const r = await updateOrderNotesAction(orderId, value)
        toast(r.ok ? 'Notes saved' : r.message, r.ok ? 'success' : 'error')
      })}>
        Save notes
      </Button>
    </div>
  )
}
